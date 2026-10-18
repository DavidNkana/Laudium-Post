import {describe, expect, it} from 'vitest';
import {hasAllowedMediaType, mediaPermissionDecision} from '../functions/media-publication/src/policy.mjs';
import {executePublication} from '../functions/media-publication/src/index.mjs';

const editor = [{userId: 'user-1', roles: ['editor']}];
const settings = {endpoint: 'https://appwrite.example/v1', project: 'project', key: 'server-only', bucket: 'media', team: 'editors', database: 'laudium_post', articleSourceTable: 'editorial_articles', advertiserSourceTable: 'advertiser_records'};

function appwriteFetch(source, file = {name: 'photo.png', mimeType: 'image/png', permissions: []}) {
  return async (url, init = {}) => {
    if (url.includes('/teams/')) return new Response(JSON.stringify({memberships: editor}), {status: 200});
    if (url.includes('/rows/')) return new Response(JSON.stringify(source), {status: 200});
    if (url.includes('/files/')) {
      if (init.method === 'PUT') return new Response('{}', {status: 200});
      return new Response(JSON.stringify(file), {status: 200});
    }
    throw new Error(`unexpected request ${url}`);
  };
}

describe('media publication permission boundary', () => {
  it('publishes only for an authenticated team editor and server-loaded live source', () => {
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'publish', source: {status: 'Published', publishedAt: '2026-10-17T00:00:00Z', media: {fileId: 'file-1'}}, sourceType: 'article', fileId: 'file-1', now: new Date('2026-10-18T00:00:00Z')})).toEqual({allowed: true, permissions: ['read("any")']});
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'publish', approvalStatus: 'Published', source: {status: 'Draft', media: {fileId: 'file-1'}}, sourceType: 'article', fileId: 'file-1'}).allowed).toBe(false);
    expect(mediaPermissionDecision({userId: 'anonymous', memberships: editor, action: 'publish', approvalStatus: 'Published', fileId: 'file-1'}).allowed).toBe(false);
  });

  it('revokes public read without granting it to drafts', () => {
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'unpublish', source: {status: 'Draft', media: {fileId: 'file-1'}}, sourceType: 'article', fileId: 'file-1'})).toEqual({allowed: true, permissions: []});
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'publish', source: {status: 'Published', publishedAt: '2026-10-17T00:00:00Z', media: {fileId: 'other'}}, sourceType: 'article', fileId: 'file-1', now: new Date('2026-10-18T00:00:00Z')}).allowed).toBe(false);
    expect(mediaPermissionDecision({userId: 'user-1', memberships: [{userId: 'user-2', roles: ['editor']}], action: 'unpublish', fileId: 'file-1'}).allowed).toBe(false);
  });

  it('allows only the documented image types and MP4 video', () => {
    expect(hasAllowedMediaType('clip.mp4', 'video/mp4')).toBe(true);
    expect(hasAllowedMediaType('clip.mp4', 'video/webm')).toBe(false);
    expect(hasAllowedMediaType('photo.png', 'image/png')).toBe(true);
    expect(hasAllowedMediaType('photo.svg', 'image/svg+xml')).toBe(false);
  });

  it('rejects unpublished and mismatched records before touching the file permissions', async () => {
    const unpublished = {status: 'Draft', media: JSON.stringify({fileId: 'file-1'})};
    const unpublishedResult = await executePublication({body: {action: 'publish', sourceType: 'article', sourceId: 'article-1', fileId: 'file-1', approvalStatus: 'Published'}, headers: {'x-appwrite-user-id': 'user-1'}}, {...settings, fetcher: appwriteFetch(unpublished)});
    expect(unpublishedResult.statusCode).toBe(403);

    const mismatched = {status: 'Published', publishedAt: '2026-10-17T00:00:00Z', media: JSON.stringify({fileId: 'other-file'})};
    const mismatchedResult = await executePublication({body: {action: 'publish', sourceType: 'article', sourceId: 'article-1', fileId: 'file-1'}, headers: {'x-appwrite-user-id': 'user-1'}}, {...settings, fetcher: appwriteFetch(mismatched)});
    expect(mismatchedResult.statusCode).toBe(403);
  });

  it('uses the server-loaded source, not approvalStatus, before granting file read', async () => {
    let putBody;
    const fetcher = async (url, init = {}) => {
      const response = await appwriteFetch({status: 'Published', publishedAt: '2026-10-17T00:00:00Z', media: {fileId: 'file-1'}}, {name: 'clip.mp4', mimeType: 'video/mp4', permissions: []})(url, init);
      if (init.method === 'PUT') putBody = JSON.parse(init.body as string);
      return response;
    };
    const result = await executePublication({body: {action: 'publish', sourceType: 'article', sourceId: 'article-1', fileId: 'file-1', approvalStatus: 'Draft'}, headers: {'x-appwrite-user-id': 'user-1'}}, {...settings, fetcher});
    expect(result.statusCode).toBe(200);
    expect(putBody.permissions).toEqual(['read("any")']);
  });
});
