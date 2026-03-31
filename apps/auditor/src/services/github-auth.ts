import { createAppAuth } from '@octokit/auth-app';
import { Redis } from 'ioredis';
import { Octokit } from '@octokit/core';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  let privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY');
  }

  // Handle newlines if passed as single string from env
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Try Redis cache first for Installation token
  const cacheKey = `github:installation:${installationId}`;
  const cachedToken = await redis.get(cacheKey);

  if (cachedToken) {
    return new Octokit({ auth: cachedToken });
  }

  // Generate new token via JWT App Auth
  const appAuth = createAppAuth({
    appId,
    privateKey,
  });

  const authData = await appAuth({
    type: 'installation',
    installationId,
  });

  // authData for installation contains the token
  const token = authData.token;

  // Cache token in Redis
  // GitHub tokens typically expire in 1 hour (3600s), caching for 3500s to be safe
  await redis.set(cacheKey, token, 'EX', 3500);

  return new Octokit({ auth: token });
}
