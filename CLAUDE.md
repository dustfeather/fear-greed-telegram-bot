# Project Guidelines

- When changing bot commands, update the "Available commands" helper message to match.
- Run `npm run type-check` before completing work; fix all type errors.
- After changing dependencies, run `npm audit` and fix critical/high findings before completing.
- Trading signal logic, thresholds, indicator periods, API endpoints, and `CHROME_HEADERS` live in `src/core/constants/index.ts` and `src/trading/services/signal-service.ts` — read those, do not hardcode values elsewhere.
- The 1% buffers (1.01 on entry, 0.99 on exit) are intentional early-trigger margins, not bugs.
- BUY frequency is capped at 1 trade per calendar month — keep that constraint when touching signal logic.
