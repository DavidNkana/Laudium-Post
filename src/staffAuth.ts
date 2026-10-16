import {Account, Client, Teams} from 'appwrite';

export type StaffAccess = {allowed: boolean; message: string};

export function isLocalDemoMode() {
  return import.meta.env.VITE_LOCAL_DEMO_MODE === 'true';
}

/** Demo access is intentionally opt-in. Live access requires a signed-in Appwrite team member. */
export async function requestStaffAccess(): Promise<StaffAccess> {
  if (isLocalDemoMode()) return {allowed: true, message: ''};
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
  const project = import.meta.env.VITE_APPWRITE_PROJECT_ID;
  const teamId = import.meta.env.VITE_APPWRITE_STAFF_TEAM_ID;
  if (!endpoint || !project || !teamId) {
    return {allowed: false, message: 'Configure Appwrite Auth, VITE_APPWRITE_STAFF_TEAM_ID, endpoint, and project ID before enabling staff access. This is not production admin security.'};
  }
  try {
    const client = new Client().setEndpoint(endpoint).setProject(project);
    const account = new Account(client);
    const teams = new Teams(client);
    await account.get();
    const memberships = await teams.listMemberships(teamId, [], '');
    return memberships.memberships.length > 0
      ? {allowed: true, message: ''}
      : {allowed: false, message: 'Your signed-in account is not a member of the configured editorial team.'};
  } catch {
    return {allowed: false, message: 'Staff authentication is unavailable. Sign in with an Appwrite editorial-team account; the workspace is not rendered without verified membership.'};
  }
}
