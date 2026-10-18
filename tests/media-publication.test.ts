import {describe, expect, it} from 'vitest';
import {hasAllowedMediaType, mediaPermissionDecision} from '../functions/media-publication/src/policy.mjs';

const editor = [{userId: 'user-1', roles: ['editor']}];

describe('media publication permission boundary', () => {
  it('publishes only for an authenticated team editor and approved status', () => {
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'publish', approvalStatus: 'Published', fileId: 'file-1'})).toEqual({allowed: true, permissions: ['read("any")']});
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'publish', approvalStatus: 'Draft', fileId: 'file-1'}).allowed).toBe(false);
    expect(mediaPermissionDecision({userId: 'anonymous', memberships: editor, action: 'publish', approvalStatus: 'Published', fileId: 'file-1'}).allowed).toBe(false);
  });

  it('revokes public read without granting it to drafts', () => {
    expect(mediaPermissionDecision({userId: 'user-1', memberships: editor, action: 'unpublish', approvalStatus: 'Draft', fileId: 'file-1'})).toEqual({allowed: true, permissions: []});
    expect(mediaPermissionDecision({userId: 'user-1', memberships: [{userId: 'user-2', roles: ['editor']}], action: 'unpublish', fileId: 'file-1'}).allowed).toBe(false);
  });

  it('allows only the documented image types and MP4 video', () => {
    expect(hasAllowedMediaType('clip.mp4', 'video/mp4')).toBe(true);
    expect(hasAllowedMediaType('clip.mp4', 'video/webm')).toBe(false);
    expect(hasAllowedMediaType('photo.png', 'image/png')).toBe(true);
    expect(hasAllowedMediaType('photo.svg', 'image/svg+xml')).toBe(false);
  });
});
