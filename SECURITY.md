# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

We recommend always using the latest version of the bot to ensure you have the most recent security patches.

## Reporting a Vulnerability

We take the security of the Fear and Greed Telegram Bot seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories (Preferred)**:
   - Go to the [Security tab](https://github.com/dustfeather/fear-greed-telegram-bot/security) in this repository
   - Click "Report a vulnerability"
   - Fill out the security advisory form

2. **Email**: If you prefer email, contact the maintainers directly (contact information available in repository settings for collaborators)

### What to Include

When reporting a vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Impact**: Potential impact of the vulnerability
- **Severity**: Your assessment of the severity (if possible)
- **Proof of Concept**: If available, a proof of concept or exploit code (please keep this private)
- **Suggested Fix**: If you have ideas on how to fix the issue, please share them

### What to Expect

- **Acknowledgment**: You will receive an acknowledgment within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Updates**: We will keep you informed of our progress
- **Resolution**: We will work to resolve the issue as quickly as possible
- **Credit**: With your permission, we will credit you in our security advisories and release notes

### Disclosure Policy

- We ask that you keep the vulnerability confidential until we have had a chance to address it
- We will work with you to coordinate public disclosure after a fix is available
- We aim to provide a fix within 30 days for critical vulnerabilities, and within 90 days for other vulnerabilities
- If you need more time for coordinated disclosure, please let us know

## Security Best Practices

### For Users

- **Keep your bot updated**: Always use the latest version
- **Secure your secrets**:
  - Never commit `.dev.vars` or secrets to version control
  - Use strong, unique values for `TELEGRAM_WEBHOOK_SECRET`
  - Rotate secrets regularly
- **Monitor your bot**: Regularly check bot activity and logs
- **Use HTTPS**: Ensure webhook URLs use HTTPS
- **Limit access**: Only grant necessary permissions to your Cloudflare Workers

### For Contributors

- **Follow secure coding practices**:
  - Validate and sanitize all user inputs
  - Use parameterized queries and prepared statements where applicable
  - Implement proper authentication and authorization checks
  - Avoid exposing sensitive information in error messages
- **Review dependencies**: Keep dependencies up to date and review security advisories
- **Security testing**: Include security considerations in your testing
- **Secret management**: Never commit secrets, tokens, or API keys

## Known Security Considerations

### Current Security Measures

- **Webhook Verification**: All Telegram webhook requests are verified using `TELEGRAM_WEBHOOK_SECRET`
- **Input Validation**: User inputs are validated before processing
- **Error Handling**: Sensitive information is not exposed in error messages
- **Cloudflare Workers**: Runs on Cloudflare's secure infrastructure
- **D1 Database**: User data is stored securely in Cloudflare D1 SQL database

### Areas of Focus

We pay special attention to:

- **Authentication and Authorization**: Ensuring only authorized users can access admin features
- **Input Validation**: Preventing injection attacks and malformed input
- **Secret Management**: Proper handling of API keys and tokens
- **Data Privacy**: Protecting user data and trading information
- **Rate Limiting**: Preventing abuse and DoS attacks

## Security Updates

Security updates will be:

- Released as soon as possible after a fix is available
- Documented in the [CHANGELOG.md](CHANGELOG.md)
- Tagged with appropriate severity levels
- Communicated through GitHub releases and security advisories

## Questions?

If you have questions about security that are not related to vulnerabilities, please:

- Open a regular GitHub issue with the `question` label
- Check existing issues and discussions
- Review the [CONTRIBUTING.md](CONTRIBUTING.md) for general contribution guidelines

## Acknowledgments

We appreciate the security research community's efforts to help keep this project secure. Thank you for responsibly disclosing vulnerabilities and helping us improve the security of the Fear and Greed Telegram Bot.

---

**Last Updated**: 2025-11-19


