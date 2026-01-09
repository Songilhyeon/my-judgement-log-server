# Repository Guidelines

## Project Structure & Module Organization
- `src/app` contains Next.js App Router routes, layouts, and UI entry points.
- `src/lib` holds shared utilities and reusable logic.
- `src/types` defines TypeScript types shared across modules.
- `public/` contains static assets served at the site root.
- `data/` stores local data files used by the app (keep schema changes documented in PRs).

## Build, Test, and Development Commands
- `npm run dev`: start the Next.js development server at `http://localhost:3000`.
- `npm run build`: create a production build in `.next/`.
- `npm run start`: run the production server from the built output.
- `npm run lint`: run ESLint with the Next.js TypeScript + Core Web Vitals rules.

## Coding Style & Naming Conventions
- Language: TypeScript with React/Next.js App Router conventions.
- Indentation: follow existing formatting (2 spaces in config files; rely on your editor for TS/TSX).
- Naming: React components in `PascalCase` (e.g., `JudgementList.tsx`), hooks in `useCamelCase`, utilities in `camelCase`.
- Linting: ESLint is configured via `eslint.config.mjs`; fix or justify lint warnings before merging.

## Testing Guidelines
- No automated test framework is configured yet.
- If you add tests, keep them near the code (`src/**/__tests__`) or in a top-level `tests/` folder and document how to run them in this file.

## Commit & Pull Request Guidelines
- No commit message convention is established (history is minimal). Use concise, imperative summaries (e.g., `Add judgement list UI`).
- PRs should include: purpose, key changes, and any manual validation steps (screenshots for UI changes are recommended).

## Configuration & Security Notes
- Environment-specific values should go in `.env.local` (do not commit secrets).
- Update `next.config.ts` only when you have a clear runtime or build need and describe the change in the PR.
