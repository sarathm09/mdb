# Contributing

Thanks for your interest in contributing to markdown-browser!

## Prerequisites

- [Bun](https://bun.sh/) v1.x or later

## Getting Started

1. Fork the repository and clone your fork
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies and build:
   ```sh
   bun install && bun run build && bun run dev
   ```

## Commit Conventions

Use conventional commit prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature

## Pull Requests

- One issue per PR
- Use a descriptive title (e.g., `feat: add PDF export support`)
- Reference the related issue in the PR description
- Ensure the project builds cleanly before submitting
