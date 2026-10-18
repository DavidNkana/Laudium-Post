export const EDITOR_ROLES = new Set(['owner', 'editor', 'contributor']);
export const PUBLIC_READ = 'read("any")';
export const MEDIA_POLICY = Object.freeze({
  maximumFileSize: 50 * 1024 * 1024,
  extensions: Object.freeze(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4']),
  mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']),
});

export function isAuthorizedEditor(userId, memberships, roles = EDITOR_ROLES) {
  return Boolean(userId) && memberships.some(member => member.userId === userId && (member.roles ?? []).some(role => roles.has(role)));
}

function parseValue(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

export function sourceContainsFile(source, fileId) {
  const media = parseValue(source?.media);
  const visit = value => {
    if (value === fileId) return true;
    if (Array.isArray(value)) return value.some(visit);
    if (value && typeof value === 'object') return Object.values(value).some(visit);
    return false;
  };
  return visit(media);
}

function liveSource(source, sourceType, fileId, now = new Date()) {
  if (!source || !sourceContainsFile(source, fileId)) return false;
  if (sourceType === 'article') {
    const publishedAt = new Date(source.publishedAt);
    return source.status === 'Published' && Number.isFinite(publishedAt.getTime()) && publishedAt <= now;
  }
  if (sourceType === 'advertisement') {
    const startsAt = new Date(source.startsAt);
    const endsAt = new Date(source.endsAt);
    return source.status === 'Approved' && source.active === true && Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && startsAt <= now && now <= endsAt;
  }
  return false;
}

export function mediaPermissionDecision({userId, memberships = [], action, source, sourceType, fileId, now = new Date()}) {
  if (!fileId || !isAuthorizedEditor(userId, memberships)) return {allowed: false, reason: 'authenticated editor membership required'};
  if (!source || !sourceContainsFile(source, fileId)) return {allowed: false, reason: 'media is not associated with the source record'};
  if (action === 'publish') {
    if (!liveSource(source, sourceType, fileId, now)) return {allowed: false, reason: 'source record is not currently approved for publication'};
    return {allowed: true, permissions: [PUBLIC_READ]};
  }
  if (action === 'unpublish') return {allowed: true, permissions: []};
  return {allowed: false, reason: 'unsupported publication action'};
}

export function hasAllowedMediaType(name, mimeType) {
  const extension = name?.toLowerCase().split('.').pop();
  return MEDIA_POLICY.extensions.includes(extension) && MEDIA_POLICY.mimeTypes.includes(mimeType) && (extension === 'mp4' ? mimeType === 'video/mp4' : mimeType.startsWith('image/'));
}
