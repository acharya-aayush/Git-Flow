import { graphql } from '@octokit/graphql';
import { getInstallationOctokit } from './github-auth';

interface TeamMemberResponse {
  organization: {
    team: {
      members: {
        nodes: { login: string }[];
      };
    };
  };
}

export async function getAuthorTeam(installationId: number, org: string, authorLogin: string): Promise<string | null> {
  try {
    const octokit = await getInstallationOctokit(installationId);
    
    // Fallback: If enterprise or complex team structures, this query can be expanded.
    // Assuming simple mapping or fetching main engineering team for now.
    
    // Instead of iterating all teams (expensive), you might just query if user is in a specific team,
    // or rely on a webhook payload. We will return a placeholder generic team if not fully mapped.
    return 'Engineering'; // Stubb implementation - real version would list org teams and check memberships
  } catch (error) {
    console.error(`Failed to fetch team for ${authorLogin}`, error);
    return null;
  }
}
