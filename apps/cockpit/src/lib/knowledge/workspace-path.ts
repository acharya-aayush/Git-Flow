import fs from 'node:fs';
import path from 'node:path';

type WorkspacePackageJson = {
  workspaces?: unknown;
};

function isWorkspaceRoot(candidatePath: string): boolean {
  const packageJsonPath = path.join(candidatePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as WorkspacePackageJson;
    return Array.isArray(parsed.workspaces);
  } catch {
    return false;
  }
}

export function resolveWorkspacePath(...segments: string[]): string {
  let cursor = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (isWorkspaceRoot(cursor)) {
      return path.join(cursor, ...segments);
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }

    cursor = parent;
  }

  return path.join(process.cwd(), ...segments);
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
