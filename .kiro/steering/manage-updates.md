---
inclusion: always
---

# Update Management Guidelines

## Changelog Maintenance

When making changes to the codebase, update `CHANGELOG.md` following these rules:

- Use the current date (2025-11-27) in YYYY-MM-DD format for new entries
- Consolidate all changes made on the same date under a single date heading
- If today's date already exists in the changelog, append changes to that section rather than creating a duplicate entry
- Keep entries concise and group related changes together when they occur on the same day
- Use clear, descriptive language that explains what changed and why it matters to users

## Command Documentation

When modifying bot commands or adding new ones:

- Update the "Available commands" helper message in the codebase to reflect current functionality
- Ensure command descriptions are accurate and up-to-date
- This helps users discover and understand available features

## Type Safety

Before completing work:

- Run `npx tsc --noEmit` to verify there are no TypeScript type errors
- Fix any type issues before considering the work complete
- This ensures type safety across the codebase
