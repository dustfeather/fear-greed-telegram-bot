---
inclusion: fileMatch
fileMatchPattern: ['package.json', 'package-lock.json']
---

# NPM Package Management

## When Modifying Dependencies

After any changes to `package.json`:

1. Run `npm install` to update `package-lock.json` and install dependencies
2. Run `npm audit` to check for security vulnerabilities
3. Address any audit findings before completing the work

## Adding New Packages

When adding new dependencies:

- Use `npm install <package>` for runtime dependencies
- Use `npm install --save-dev <package>` for development dependencies
- Always run `npm audit` after installation
- Fix critical and high severity vulnerabilities immediately
- Document the reason for adding the package if it's not obvious

## Security Best Practices

- Never ignore security vulnerabilities without explicit user approval
- Prefer `npm audit fix` for automatic fixes when available
- For breaking changes, use `npm audit fix --force` only with user confirmation
- Check for deprecated packages and suggest alternatives when found

## Lock File Management

- Never manually edit `package-lock.json`
- Commit both `package.json` and `package-lock.json` together
- If lock file conflicts occur, regenerate with `npm install` after resolving package.json conflicts
