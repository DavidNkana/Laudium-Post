import {describe, expect, it} from 'vitest';
import {hasStaffMembership} from '../src/staffAuth';

describe('live staff gate', () => {
  it('requires the signed-in user to be a team member with a role', () => {
    expect(hasStaffMembership('user-1', [{userId: 'user-2', roles: ['editor']}])).toBe(false);
    expect(hasStaffMembership('user-1', [{userId: 'user-1', roles: []}])).toBe(false);
    expect(hasStaffMembership('user-1', [{userId: 'user-1', roles: ['editor']}])).toBe(true);
  });
});
