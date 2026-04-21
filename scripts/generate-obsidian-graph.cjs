const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspaceRoot = process.cwd();
const vaultRoot = path.join(workspaceRoot, 'knowledge', 'obsidian-vault');
const notesRoot = path.join(vaultRoot, 'notes');
const ragRoot = path.join(workspaceRoot, 'knowledge', 'rag');

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'keys',
  'node_modules',
  'out',
]);

const ignoredPathPrefixes = [
  '.idea/',
  '.vscode/',
  'knowledge/obsidian-vault/',
  'knowledge/rag/',
];

const includedExtensions = new Set([
  '.bat',
  '.cjs',
  '.css',
  '.json',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
]);

const importableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const chunkableExtensions = new Set([
  '.bat',
  '.cjs',
  '.css',
  '.json',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
]);

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function getRelativePath(absolutePath) {
  return normalizePath(path.relative(workspaceRoot, absolutePath));
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearDirectory(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  ensureDirectory(dirPath);
}

function shouldIgnore(relativePath, isDirectory) {
  if (!relativePath) {
    return false;
  }

  const clean = normalizePath(relativePath);
  const first = clean.split('/')[0];
  if (ignoredDirectories.has(first)) {
    return true;
  }

  for (const prefix of ignoredPathPrefixes) {
    if (clean.startsWith(prefix)) {
      return true;
    }
  }

  if (isDirectory) {
    return false;
  }

  const ext = path.extname(clean).toLowerCase();
  return !includedExtensions.has(ext);
}

function collectWorkspace() {
  const folders = [];
  const files = [];

  function walk(currentPath) {
    const relative = getRelativePath(currentPath);
    folders.push(relative);

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absoluteChild = path.join(currentPath, entry.name);
      const childRelative = getRelativePath(absoluteChild);

      if (shouldIgnore(childRelative, entry.isDirectory())) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(absoluteChild);
        continue;
      }

      const stats = fs.statSync(absoluteChild);
      files.push({
        absolutePath: absoluteChild,
        relativePath: childRelative,
        extension: path.extname(childRelative).toLowerCase(),
        mtimeIso: stats.mtime.toISOString(),
        size: stats.size,
      });
    }
  }

  walk(workspaceRoot);

  folders.sort();
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return { folders, files };
}

function folderNoteRelative(folderPath) {
  if (!folderPath) {
    return 'notes/folders/workspace-root.md';
  }

  const directory = path.dirname(folderPath);
  const name = path.basename(folderPath);
  return normalizePath(path.join('notes', 'folders', directory, `${name}.md`));
}

function fileNoteRelative(filePath) {
  return normalizePath(path.join('notes', 'files', `${filePath}.md`));
}

function wikiLink(noteRelativePath, label) {
  const target = normalizePath(noteRelativePath).replace(/\.md$/i, '');
  if (!label) {
    return `[[${target}]]`;
  }
  return `[[${target}|${label}]]`;
}

function classifySourceKind(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('/readme.md') || lower === 'readme.md') {
    return 'readme';
  }
  if (lower.startsWith('documentation/')) {
    return 'docs';
  }

  const ext = path.extname(lower);
  if (codeExtensions.has(ext)) {
    return 'code';
  }
  if (ext === '.json' || ext === '.yml' || ext === '.yaml' || ext === '.prisma') {
    return 'config';
  }
  if (ext === '.md') {
    return 'docs';
  }
  return 'tree';
}

function safeReadUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

function resolveRelativeImport(sourceFileRelative, specifier, fileMap) {
  if (!specifier || !specifier.startsWith('.')) {
    return null;
  }

  const sourceAbsolute = path.join(workspaceRoot, sourceFileRelative);
  const sourceDir = path.dirname(sourceAbsolute);
  const basePath = path.resolve(sourceDir, specifier);
  const candidates = [];

  candidates.push(basePath);
  for (const ext of importableExtensions) {
    candidates.push(`${basePath}${ext}`);
  }
  for (const ext of importableExtensions) {
    candidates.push(path.join(basePath, `index${ext}`));
  }

  for (const candidate of candidates) {
    const relative = getRelativePath(candidate);
    if (fileMap.has(relative)) {
      return relative;
    }
  }

  return null;
}

function extractRelativeImports(fileRelative, fileMap) {
  const ext = path.extname(fileRelative).toLowerCase();
  if (!codeExtensions.has(ext)) {
    return [];
  }

  const absolutePath = path.join(workspaceRoot, fileRelative);
  const source = safeReadUtf8(absolutePath);
  if (!source) {
    return [];
  }

  const regexes = [
    /\bimport\s+(?:[^'"\n]+\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];

  const targets = new Set();

  for (const regex of regexes) {
    let match = regex.exec(source);
    while (match) {
      const specifier = match[1];
      const resolved = resolveRelativeImport(fileRelative, specifier, fileMap);
      if (resolved) {
        targets.add(resolved);
      }
      match = regex.exec(source);
    }
  }

  return Array.from(targets).sort();
}

function splitMarkdownChunks(text) {
  const lines = text.split(/\r?\n/);
  const chunks = [];

  let currentHeading = 'Document';
  let currentLines = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (!content) {
      return;
    }

    chunks.push({
      headingPath: currentHeading,
      content,
    });
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }

  flush();

  if (chunks.length === 0) {
    return [{ headingPath: 'Document', content: text.trim() }];
  }

  return chunks;
}

function splitCodeChunks(text) {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  const chunkSize = 80;

  for (let index = 0; index < lines.length; index += chunkSize) {
    const start = index + 1;
    const end = Math.min(lines.length, index + chunkSize);
    const content = lines.slice(index, end).join('\n').trim();
    if (!content) {
      continue;
    }

    chunks.push({
      headingPath: `lines ${start}-${end}`,
      content,
    });
  }

  return chunks;
}

function buildRagChunks(files, repoName, snapshotId) {
  const chunks = [];

  for (const file of files) {
    if (!chunkableExtensions.has(file.extension)) {
      continue;
    }

    if (file.size > 512_000) {
      continue;
    }

    const body = safeReadUtf8(file.absolutePath).trim();
    if (!body) {
      continue;
    }

    const split = file.extension === '.md'
      ? splitMarkdownChunks(body)
      : splitCodeChunks(body);

    for (let index = 0; index < split.length; index += 1) {
      const chunk = split[index];
      chunks.push({
        id: `${file.relativePath}::${index + 1}`,
        repo_name: repoName,
        branch_or_snapshot_id: snapshotId,
        file_path: file.relativePath,
        file_type: file.extension.replace('.', '') || 'unknown',
        heading_path: chunk.headingPath,
        last_updated_at: file.mtimeIso,
        source_kind: classifySourceKind(file.relativePath),
        content: chunk.content,
      });
    }
  }

  return chunks;
}

function writeFile(relativePath, content) {
  const absolutePath = path.join(vaultRoot, relativePath);
  ensureDirectory(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function writeRootFile(absolutePath, content) {
  ensureDirectory(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function getSnapshotId() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch (error) {
    return 'unknown';
  }
}

function getRepoName() {
  try {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.name || 'workspace';
  } catch (error) {
    return 'workspace';
  }
}

function build() {
  const startedAt = Date.now();
  const generatedAt = new Date().toISOString();
  const snapshotId = getSnapshotId();
  const repoName = getRepoName();

  const { folders, files } = collectWorkspace();
  const fileMap = new Map(files.map((file) => [file.relativePath, file]));

  clearDirectory(notesRoot);
  ensureDirectory(vaultRoot);
  ensureDirectory(ragRoot);

  const folderChildren = new Map();
  for (const folder of folders) {
    folderChildren.set(folder, { folders: [], files: [] });
  }

  for (const folder of folders) {
    if (!folder) {
      continue;
    }
    const parent = normalizePath(path.dirname(folder));
    const parentKey = parent === '.' ? '' : parent;
    if (folderChildren.has(parentKey)) {
      folderChildren.get(parentKey).folders.push(folder);
    }
  }

  for (const file of files) {
    const parent = normalizePath(path.dirname(file.relativePath));
    const parentKey = parent === '.' ? '' : parent;
    if (folderChildren.has(parentKey)) {
      folderChildren.get(parentKey).files.push(file.relativePath);
    }
  }

  for (const entry of folderChildren.values()) {
    entry.folders.sort();
    entry.files.sort();
  }

  const importEdges = [];

  for (const folder of folders) {
    const noteRelative = folderNoteRelative(folder);
    const children = folderChildren.get(folder) || { folders: [], files: [] };

    const parentPath = folder
      ? normalizePath(path.dirname(folder))
      : '';
    const parentKey = parentPath === '.' ? '' : parentPath;

    const lines = [
      '---',
      'kind: folder',
      `source_path: ${folder || '.'}`,
      `snapshot: ${snapshotId}`,
      `generated_at: ${generatedAt}`,
      '---',
      '',
      `# Folder: ${folder || 'workspace-root'}`,
      '',
      `- Source path: \`${folder || '.'}\``,
      `- Parent: ${folder ? wikiLink(folderNoteRelative(parentKey), parentKey || 'workspace-root') : 'none'}`,
      '',
      '## Child folders',
    ];

    if (children.folders.length === 0) {
      lines.push('- none');
    } else {
      for (const childFolder of children.folders) {
        lines.push(`- ${wikiLink(folderNoteRelative(childFolder), childFolder)}`);
      }
    }

    lines.push('', '## Child files');

    if (children.files.length === 0) {
      lines.push('- none');
    } else {
      for (const childFile of children.files) {
        lines.push(`- ${wikiLink(fileNoteRelative(childFile), childFile)}`);
      }
    }

    writeFile(noteRelative, `${lines.join('\n')}\n`);
  }

  for (const file of files) {
    const imports = extractRelativeImports(file.relativePath, fileMap);
    for (const target of imports) {
      importEdges.push({
        from: file.relativePath,
        to: target,
        type: 'imports',
      });
    }

    const parent = normalizePath(path.dirname(file.relativePath));
    const parentKey = parent === '.' ? '' : parent;

    const lines = [
      '---',
      'kind: file',
      `source_path: ${file.relativePath}`,
      `file_type: ${file.extension.replace('.', '') || 'unknown'}`,
      `source_kind: ${classifySourceKind(file.relativePath)}`,
      `size_bytes: ${file.size}`,
      `last_updated_at: ${file.mtimeIso}`,
      `snapshot: ${snapshotId}`,
      `generated_at: ${generatedAt}`,
      '---',
      '',
      `# File: ${file.relativePath}`,
      '',
      `- Parent folder: ${wikiLink(folderNoteRelative(parentKey), parentKey || 'workspace-root')}`,
      `- Source kind: \`${classifySourceKind(file.relativePath)}\``,
      `- Size: \`${file.size}\` bytes`,
      '',
      '## Imports',
    ];

    if (imports.length === 0) {
      lines.push('- none');
    } else {
      for (const target of imports) {
        lines.push(`- ${wikiLink(fileNoteRelative(target), target)}`);
      }
    }

    lines.push('', '## Preview', '', '```text');
    const previewLines = safeReadUtf8(file.absolutePath).split(/\r?\n/).slice(0, 20);
    lines.push(...previewLines);
    lines.push('```', '');

    writeFile(fileNoteRelative(file.relativePath), lines.join('\n'));
  }

  const topFolders = (folderChildren.get('') || { folders: [] }).folders;
  const mermaidLines = ['graph TD', '  ROOT[workspace-root]'];
  for (const folder of topFolders.slice(0, 18)) {
    const nodeName = `N_${folder.replace(/[^a-zA-Z0-9]/g, '_')}`;
    mermaidLines.push(`  ROOT --> ${nodeName}[${folder}]`);
  }

  const graphNodes = [];
  for (const folder of folders) {
    graphNodes.push({
      id: `folder:${folder || '.'}`,
      kind: 'folder',
      path: folder || '.',
      note: folderNoteRelative(folder).replace(/\.md$/i, ''),
      group: (folder || '.').split('/')[0] || '.',
    });
  }

  for (const file of files) {
    graphNodes.push({
      id: `file:${file.relativePath}`,
      kind: 'file',
      path: file.relativePath,
      note: fileNoteRelative(file.relativePath).replace(/\.md$/i, ''),
      group: file.relativePath.split('/')[0] || '.',
    });
  }

  const graphEdges = [];
  for (const folder of folders) {
    const children = folderChildren.get(folder) || { folders: [], files: [] };
    for (const childFolder of children.folders) {
      graphEdges.push({
        from: `folder:${folder || '.'}`,
        to: `folder:${childFolder}`,
        type: 'contains',
      });
    }
    for (const childFile of children.files) {
      graphEdges.push({
        from: `folder:${folder || '.'}`,
        to: `file:${childFile}`,
        type: 'contains',
      });
    }
  }

  for (const edge of importEdges) {
    graphEdges.push({
      from: `file:${edge.from}`,
      to: `file:${edge.to}`,
      type: 'imports',
    });
  }

  const ragChunks = buildRagChunks(files, repoName, snapshotId);

  const vaultReadme = [
    '# GitFlow Knowledge Vault',
    '',
    `Generated at: ${generatedAt}`,
    `Snapshot: ${snapshotId}`,
    '',
    '## Entry points',
    '',
    '- [[Project Graph]]',
    `- ${wikiLink(folderNoteRelative(''), 'workspace-root')}`,
    '',
    '## How to use in Obsidian',
    '',
    '1. Open this folder as an Obsidian vault: `knowledge/obsidian-vault`.',
    '2. Open `Project Graph` for the generated topology summary.',
    '3. Open Obsidian Graph View to explore note links as a live project map.',
    '',
    '## Auto-update',
    '',
    '- Build once: `npm run graph:build`',
    '- Watch continuously: `npm run graph:watch`',
    '',
  ].join('\n');

  writeRootFile(path.join(vaultRoot, 'README.md'), vaultReadme);

  const projectGraph = [
    '---',
    `generated_at: ${generatedAt}`,
    `snapshot: ${snapshotId}`,
    `folder_count: ${folders.length}`,
    `file_count: ${files.length}`,
    `import_edge_count: ${importEdges.length}`,
    `chunk_count: ${ragChunks.length}`,
    '---',
    '',
    '# Project Graph',
    '',
    `- Workspace root: \`${workspaceRoot}\``,
    `- Snapshot: \`${snapshotId}\``,
    `- Folders indexed: **${folders.length}**`,
    `- Files indexed: **${files.length}**`,
    `- Import edges: **${importEdges.length}**`,
    `- RAG chunks: **${ragChunks.length}**`,
    '',
    '## Top-level domains',
    '',
    ...topFolders.map((folder) => `- ${wikiLink(folderNoteRelative(folder), folder)}`),
    '',
    '## Mermaid topology',
    '',
    '```mermaid',
    ...mermaidLines,
    '```',
    '',
    '## Notes',
    '',
    '- Full folder and file notes are generated under `notes/folders` and `notes/files`.',
    '- Import edges are generated from relative imports in JS/TS files.',
    '- Use Obsidian Graph View for a full interactive dependency and structure graph.',
    '',
  ].join('\n');

  writeRootFile(path.join(vaultRoot, 'Project Graph.md'), projectGraph);

  writeRootFile(
    path.join(vaultRoot, 'graph-data.json'),
    `${JSON.stringify({
      generated_at: generatedAt,
      snapshot: snapshotId,
      repo_name: repoName,
      node_count: graphNodes.length,
      edge_count: graphEdges.length,
      nodes: graphNodes,
      edges: graphEdges,
    }, null, 2)}\n`
  );

  writeRootFile(
    path.join(ragRoot, 'chunks.json'),
    `${JSON.stringify(ragChunks, null, 2)}\n`
  );

  writeRootFile(
    path.join(ragRoot, 'manifest.json'),
    `${JSON.stringify({
      generated_at: generatedAt,
      snapshot: snapshotId,
      repo_name: repoName,
      chunk_count: ragChunks.length,
      source_file_count: files.length,
      source_folder_count: folders.length,
    }, null, 2)}\n`
  );

  const durationMs = Date.now() - startedAt;
  console.log(`[graph] build complete in ${durationMs}ms`);
  console.log(`[graph] folders=${folders.length} files=${files.length} imports=${importEdges.length} chunks=${ragChunks.length}`);
  console.log('[graph] output: knowledge/obsidian-vault and knowledge/rag');
}

build();
