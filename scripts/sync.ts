import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function sync() {
  console.log('Starting historical data sync...');

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!appId || !privateKey) {
    throw new Error('Missing GitHub App credentials');
  }

  const appAuth = createAppAuth({
    appId,
    privateKey,
  });

  // Get all installations
  const octokitApp = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    }
  });

  const { data: installations } = await octokitApp.apps.listInstallations();
  console.log(`Found ${installations.length} installations.`);
  
  if (installations.length === 0) {
    console.log("WAIT! Your GitHub app hasn't been installed on any repositories yet, or the App ID is incorrect.");
    return;
  }

  for (const installation of installations) {
    console.log(`Syncing Installation ID: ${installation.id} for account ${installation.account?.login}`);

    const authData = await appAuth({
      type: 'installation',
      installationId: installation.id,
    });

    const octokit = new Octokit({ auth: authData.token });

    const { data: { repositories } } = await octokit.apps.listReposAccessibleToInstallation();
    
    for (const repo of repositories) {
      console.log(`Syncing Repository: ${repo.full_name}`);
      
      const dbRepo = await prisma.repository.upsert({
        where: { github_id: repo.id },
        create: {
          github_id: repo.id,
          full_name: repo.full_name,
          owner: repo.owner.login,
        },
        update: {
          full_name: repo.full_name,
          owner: repo.owner.login,
        }
      });

      // Get PRs
      const { data: prs } = await octokit.pulls.list({
        owner: repo.owner.login,
        repo: repo.name,
        state: 'all',
        per_page: 50
      });

      let added = 0;
      for (const pr of prs) {
        let user = null;
        if (pr.user) {
          user = await prisma.user.upsert({
            where: { github_id: pr.user.id },
            create: {
              github_id: pr.user.id,
              login: pr.user.login,
              avatar_url: pr.user.avatar_url,
            },
            update: {}
          });
        }

        const createdAt = new Date(pr.created_at);
        const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;
        const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;

        // Roughly calculate lifecycle mins
        let lifecycleMins = null;
        let mergeTimeMins = null;

        if (closedAt) {
           lifecycleMins = Math.floor((closedAt.getTime() - createdAt.getTime()) / 60000);
        }
        if (mergedAt) {
           mergeTimeMins = Math.floor((mergedAt.getTime() - createdAt.getTime()) / 60000);
        }

        await prisma.pullRequest.upsert({
          where: { repo_id_number: { repo_id: dbRepo.id, number: pr.number } },
          create: {
            github_id: pr.id,
            repo_id: dbRepo.id,
            author_id: user?.id,
            number: pr.number,
            title: pr.title,
            state: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
            draft: pr.draft || false,
            created_at: createdAt,
            updated_at: pr.updated_at ? new Date(pr.updated_at) : null,
            closed_at: closedAt,
            merged_at: mergedAt,
            lifecycle_mins: lifecycleMins,
            merge_time_mins: mergeTimeMins,
            health_grade: mergedAt && mergeTimeMins! < 1440 ? 'A' : (mergedAt ? 'B' : null)
          },
          update: {
            title: pr.title,
            state: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
            draft: pr.draft || false,
            updated_at: pr.updated_at ? new Date(pr.updated_at) : null,
            closed_at: closedAt,
            merged_at: mergedAt,
            lifecycle_mins: lifecycleMins,
            merge_time_mins: mergeTimeMins,
          }
        });
        added++;
        
        try {
          // Let's also sync reviews for the PR to get review latency
          const { data: reviews } = await octokit.pulls.listReviews({
            owner: repo.owner.login,
            repo: repo.name,
            pull_number: pr.number
          });

          for (const review of reviews) {
            if (!review.user) continue;
            
            const reviewer = await prisma.user.upsert({
              where: { github_id: review.user.id },
              create: {
                github_id: review.user.id,
                login: review.user.login,
                avatar_url: review.user.avatar_url,
              },
              update: {}
            });

            const createdPr = await prisma.pullRequest.findUnique({
              where: { repo_id_number: { repo_id: dbRepo.id, number: pr.number } }
            });

            if (createdPr && review.submitted_at) {
              const subAt = new Date(review.submitted_at);
              await prisma.review.createMany({
                data: [{
                  pr_id: createdPr.id,
                  reviewer_id: reviewer.id,
                  state: review.state.toLowerCase(),
                  submitted_at: subAt
                }],
                skipDuplicates: true
              });

              if (!createdPr.first_review_at || subAt < createdPr.first_review_at) {
                  const latency = Math.floor((subAt.getTime() - createdAt.getTime()) / 60000);
                  await prisma.pullRequest.update({
                    where: { id: createdPr.id },
                    data: { 
                      first_review_at: subAt,
                      review_latency_mins: latency,
                    }
                  });
              }
            }
          }
        } catch (err) {
          console.log(`Failed fetching reviews for PR ${pr.number}`);
        }
      }
      console.log(`-> Added/Updated ${added} PRs and their reviews!`);
    }
  }

  console.log('Sync complete!');
}

sync().catch(e => {
  console.error('Migration failed: ', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
