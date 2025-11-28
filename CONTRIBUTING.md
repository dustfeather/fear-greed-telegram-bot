# Contributing to Fear and Greed Telegram Bot

Thank you for investing your time in contributing to this project! Any contribution you make will help improve the bot for all users :sparkles:.

This guide provides information about how to contribute to the Fear and Greed Telegram Bot project. Please read through this document before submitting issues or pull requests.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [New Contributor Guide](#new-contributor-guide)
- [Contribution Types](#contribution-types)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful, inclusive, and constructive in all interactions.

## New Contributor Guide

If you're new to contributing to open source projects, here are some helpful resources:

- [Finding ways to contribute to open source on GitHub](https://docs.github.com/en/get-started/exploring-projects-on-github/finding-ways-to-contribute-to-open-source-on-github)
- [Set up Git](https://docs.github.com/en/get-started/git-basics/set-up-git)
- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Collaborating with pull requests](https://docs.github.com/en/github/collaborating-with-pull-requests)

## Contribution Types

We welcome various types of contributions:

### Content We Accept

- **Bug fixes**: Fixes for bugs in the bot functionality, trading signals, or data processing
- **Feature enhancements**: New commands, improved trading signal logic, or additional integrations
- **Code improvements**: Refactoring, performance optimizations, or code quality improvements
- **Documentation**: Updates to README, code comments, or documentation files
- **Tests**: New test cases or improvements to existing tests
- **TypeScript improvements**: Better type definitions, type safety improvements

### Content We May Not Accept

- Changes that break existing functionality without migration paths
- Features that significantly increase complexity without clear benefits
- Changes that compromise security or user privacy
- Modifications to core trading logic without thorough testing and discussion

If you're unsure whether your contribution would be accepted, feel free to open an issue to discuss it first!

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```sh
   git clone https://github.com/yourusername/fear-greed-telegram-bot.git
   cd fear-greed-telegram-bot
   ```
3. **Set up the upstream remote**:
   ```sh
   git remote add upstream https://github.com/dustfeather/fear-greed-telegram-bot.git
   ```

## Development Setup

### Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)
- A Cloudflare account (for deployment testing)
- A Telegram bot token (get from [@BotFather](https://t.me/BotFather))

### Installation

1. **Install dependencies**:
   ```sh
   npm install
   ```

2. **Set up local development environment**:
   - Copy `.dev.vars.example` to `.dev.vars`:
     ```sh
     cp .dev.vars.example .dev.vars
     ```
   - Edit `.dev.vars` and fill in your values:
     - `TELEGRAM_BOT_TOKEN_SECRET`: Your Telegram bot token
     - `TELEGRAM_WEBHOOK_SECRET`: A secure random string (generate using `openssl rand -hex 32`)
     - `ADMIN_CHAT_ID`: Your chat ID for error notifications (optional)
     - `FEAR_GREED_KV_NAMESPACE_ID`: KV namespace ID (optional for local dev)

3. **Start the development server**:
   ```sh
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with local config
- `npm run dev:scheduled` - Test scheduled events locally
- `npm test` - Run all tests
- `npm run type-check` - Run TypeScript type checking
- `npm run deploy` - Deploy to Cloudflare Workers (requires authentication)

For more details, see the [README.md](README.md) and [TESTING.md](TESTING.md) files.

## Making Changes

### Before You Start

1. **Check existing issues**: Search [existing issues](https://github.com/dustfeather/fear-greed-telegram-bot/issues) to see if your idea or bug is already being discussed
2. **Create an issue** (if needed): For significant changes, it's helpful to discuss your approach in an issue first
3. **Create a branch**: Create a new branch from `main` for your changes:
   ```sh
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

### Coding Standards

- **TypeScript**: This project uses TypeScript with strict mode enabled
- **Code style**: Follow existing code patterns and conventions
- **Type safety**: Use proper TypeScript types; avoid `any` when possible
- **Error handling**: Include proper error handling and validation
- **Comments**: Add comments for complex logic, but prefer self-documenting code

### Project Structure

- `src/` - Main source code
  - `index.ts` - Worker entry point
  - `sched.ts` - Scheduled event handlers
  - `trading-signal.ts` - Trading signal logic
  - `indicators.ts` - Technical indicator calculations
  - `utils/` - Utility functions
- `tests/` - Test files
- `scripts/` - Build and deployment scripts

## Testing

This project uses Jest for automated testing with automatic Wrangler dev server management.

### Running Tests

Before submitting your changes, make sure all tests pass:

```sh
# Run all automated tests (Jest automatically manages the worker)
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run type checking
npm run type-check
```

### Automatic Worker Management

Jest automatically handles the Wrangler dev server lifecycle:
- **Before tests**: Starts the worker and waits for it to be ready
- **During tests**: All tests run with the worker available
- **After tests**: Stops the worker and cleans up

**No manual worker startup is required** - just run `npm test`.

### Troubleshooting Test Issues

If tests fail with worker connection errors:
1. Check that port 8787 is available
2. Verify `.dev.vars` file exists with required environment variables
3. Check `wrangler.jsonc` configuration is valid
4. Look for errors in the global setup output

### Writing Tests

When adding new features or fixing bugs, include tests:

- **Use Jest's `expect()` API** for assertions
- **Organize tests** with `describe()` blocks
- **Use setup/teardown hooks**: `beforeEach()` and `afterEach()`
- **Test both success and error cases**
- **Use mock helpers** from `tests/utils/test-helpers.js`:
  - `createMockEnv()` - Mock Cloudflare Worker environment
  - `createMockD1()` - Mock D1 database
  - `createMockKV()` - Mock KV namespace
  - `createMockFetch()` - Mock fetch with hostname routing
  - `createTelegramUpdate()` - Mock Telegram update payload

### Test Organization

- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test complete user flows
- **Property-based tests**: Use `fast-check` for testing properties across many inputs

### Example Test

```javascript
import { createMockEnv } from '../utils/test-helpers.js';

describe('MyFeature', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  test('should do something specific', () => {
    const result = myFunction(env);
    expect(result).toBe(expected);
  });
});
```

For comprehensive testing guidelines, see [.kiro/steering/testing.md](.kiro/steering/testing.md) and [TESTING.md](TESTING.md).

## Commit Guidelines

### Commit Messages

Write clear, descriptive commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

**Good commit message example**:
```
Add support for custom watchlist limits

Implements per-user watchlist size limits with configurable maximum.
Fixes #123
```

### Commit Structure

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **test**: Adding or updating tests
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Performance improvements
- **chore**: Changes to build process or auxiliary tools

## Pull Request Process

### Before Submitting

1. **Update your branch**: Make sure your branch is up to date with `main`:
   ```sh
   git checkout main
   git pull upstream main
   git checkout your-branch-name
   git rebase main
   ```

2. **Run tests**: Ensure all tests pass and there are no type errors
3. **Update documentation**: If you've changed functionality, update relevant documentation
4. **Update CHANGELOG.md**: Add an entry describing your changes (if applicable)

### Submitting a Pull Request

1. **Push your branch** to your fork:
   ```sh
   git push origin your-branch-name
   ```

2. **Create a Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Fill out the PR template (if available)
   - Link to related issues
   - Describe what changes you made and why
   - Include screenshots or examples if applicable

3. **Enable maintainer edits**: Allow maintainers to make edits to your PR branch

### PR Review Process

- A maintainer will review your PR
- Address any feedback or requested changes
- Keep your PR focused - avoid mixing unrelated changes
- Respond to comments in a timely manner

### After Your PR is Merged

Congratulations! 🎉 Your contribution is now part of the project.

Once merged:
- Your changes will be automatically deployed via GitHub Actions
- Delete your branch (if you haven't already)
- Consider contributing again!

## Additional Resources

- [README.md](README.md) - Project overview and quick start
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [TESTING.md](TESTING.md) - Testing guide
- [CHANGELOG.md](CHANGELOG.md) - Project changelog

## Questions?

If you have questions about contributing, feel free to:
- Open an issue with the `question` label
- Check existing issues and discussions
- Review the codebase and documentation

Thank you for contributing to the Fear and Greed Telegram Bot! 🙏

