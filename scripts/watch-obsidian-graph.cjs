const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const workspaceRoot = process.cwd();
const generatorScript = path.join(workspaceRoot, 'scripts', 'generate-obsidian-graph.cjs');

const ignoredPrefixes = [
  '.git/',
  '.next/',
  '.turbo/',
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  'knowledge/obsidian-vault/',
  'knowledge/rag/',
];

let running = false;
let pending = false;
let debounceTimer = null;
let lastReason = 'startup';

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function shouldIgnore(relativePath) {
  const clean = normalizePath(relativePath || '');
  if (!clean) {
    return true;
  }

  for (const prefix of ignoredPrefixes) {
    if (clean.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function runBuild(reason) {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  console.log(`[graph-watch] rebuilding (${reason})`);

  const child = spawn(process.execPath, [generatorScript], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    running = false;
    if (code !== 0) {
      console.error(`[graph-watch] build failed with code ${code}`);
    }

    if (pending) {
      pending = false;
      scheduleBuild('queued changes');
    }
  });
}

function scheduleBuild(reason) {
  lastReason = reason;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runBuild(lastReason);
  }, 450);
}

function startWatching() {
  try {
    fs.watch(workspaceRoot, { recursive: true }, (eventType, filename) => {
      const relative = normalizePath(filename || '');
      if (!relative || shouldIgnore(relative)) {
        return;
      }

      scheduleBuild(`${eventType}: ${relative}`);
    });

    console.log('[graph-watch] watching workspace for changes');
    console.log('[graph-watch] press Ctrl+C to stop');
  } catch (error) {
    console.error('[graph-watch] recursive watch unavailable on this platform');
    console.error('[graph-watch] run `npm run graph:build` manually after changes');
    process.exit(1);
  }
}

runBuild('startup');
startWatching();
