# Knowledge System

This directory contains the tracked foundation for GitFlow's knowledge and graph workflows.

## Obsidian Graph

- Build graph snapshot: `npm run graph:build`
- Keep graph auto-updating while you code: `npm run graph:watch`

Graph output location:

- Vault root: `knowledge/obsidian-vault`
- Entry note: `knowledge/obsidian-vault/Project Graph.md`

## RAG Index Foundations

The graph build also creates a chunk index used by the Knowledge Assistant foundation.

- Chunk output: `knowledge/rag/chunks.json`
- Manifest: `knowledge/rag/manifest.json`

These generated files are ignored in git and regenerated locally.
