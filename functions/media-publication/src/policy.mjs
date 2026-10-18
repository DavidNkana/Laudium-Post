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

export function mediaPermissionDecision({userId, memberships = [], action, approvalStatus, fileId}) {
  if (!fileId || !isAuthorizedEditor(userId, memberships)) return {allowed: false, reason: 'authenticated editor membership required'};
  if (action === 'publish') {
    if (!['Published', 'Approved'].includes(approvalStatus)) return {allowed: false, reason: 'media is not approved for publication'};
    return {allowed: true, permissions: [PUBLIC_READ]};
  }
  if (action === 'unpublish') return {allowed: true, permissions: []};
  return {allowed: false, reason: 'unsupported publication action'};
}

export function hasAllowedMediaType(name, mimeType) {
  const extension = name?.toLowerCase().split('.').pop();
  return MEDIA_POLICY.extensions.includes(extension) && MEDIA_POLICY.mimeTypes.includes(mimeType) && (extension === 'mp4' ? mimeType === 'video/mp4' : mimeType.startsWith('image/'));
}
