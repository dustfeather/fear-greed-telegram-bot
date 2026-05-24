# Project Guidelines

- Change bot commands → update "Available commands" helper message to match.
- `npm run type-check` before completing work; fix all type errors.
- After dep changes → `npm audit`, fix critical/high before completing.
- Trading signal logic, thresholds, indicator periods, API endpoints, `CHROME_HEADERS` live in `src/core/constants/index.ts` + `src/trading/services/signal-service.ts` — read those, do NOT hardcode values elsewhere.
- 1% buffers (1.01 entry, 0.99 exit) = intentional early-trigger margins, not bugs.
- BUY frequency capped 1 trade per calendar month — preserve when touching signal logic.
