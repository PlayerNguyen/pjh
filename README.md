# pjh

**pjh → Pi Job Headless** is a web application with a dashboard to manage repetition jobs, designed to be modularizable.

## Structure

This is a Bun workspace monorepo:

```
apps/       # runnable applications (e.g. dashboard)
packages/   # shared, modular packages
```

Sub-packages are importable via path aliases:

- `@pjh/*` → `packages/*/src`
- `@pjh/app/*` → `apps/*/src`

## Getting started

To install dependencies:

```bash
bun install
```

To run the dashboard:

```bash
bun run apps/dashboard/src/index.ts
```

To typecheck:

```bash
bun run typecheck
```

This project was created using `bun init` in bun v1.4.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
