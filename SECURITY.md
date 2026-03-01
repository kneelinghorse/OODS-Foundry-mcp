# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in OODS Foundry MCP, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email **security@oods-foundry.dev** with:

- A description of the vulnerability.
- Steps to reproduce or a proof of concept.
- The impact you believe the vulnerability has.

You should receive an acknowledgment within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

This policy covers:

- The MCP server (`packages/mcp-server/`)
- The MCP bridge (`packages/mcp-bridge/`)
- Tool input validation and authorization policies
- HTML rendering output (XSS prevention)
- Token build pipeline

## Security Measures

- All MCP tool calls go through an authorization policy layer (`policy.json`).
- HTML rendering escapes user-controlled values to prevent XSS.
- The bridge enforces a fallback policy for unregistered tools.
- Structured data inputs are validated against JSON Schema before processing.
