
# CONTRIBUTING.md

# Contributing to OpenBadge

Thank you for your interest in contributing to OpenBadge.

OpenBadge is an open-source, self-hosted event credential platform designed as an independent replacement for POAP. We value clear design, security, simplicity, and long-term maintainability over feature count.

---

# Guiding Principles

Every contribution should align with these principles:

- Event First
- API First
- Self Hosted
- Open Source
- Blockchain as the source of truth for credentials
- Simplicity over unnecessary abstraction
- Security before convenience
- Documentation before implementation

If a contribution conflicts with these principles, open a discussion before implementing it.

---

# Before You Start

Please read the project documentation first:

- README.md
- VISION.md
- PRODUCT.md
- SPEC.md
- DOMAIN.md
- DATABASE.md
- API.md
- CONTRACT.md
- ARCHITECTURE.md
- ROADMAP.md

These documents define the expected behavior of the project.

---

# Ways to Contribute

We welcome contributions in:

- Bug fixes
- Security improvements
- Documentation
- Tests
- Performance improvements
- Accessibility
- Developer experience
- Infrastructure
- Frontend
- Backend
- Smart contracts

Large new features should begin with a design discussion.

---

# Development Workflow

1. Fork the repository.
2. Create a feature branch.
3. Keep changes focused.
4. Add or update tests.
5. Update documentation when behavior changes.
6. Ensure CI passes.
7. Open a Pull Request.

Branch naming examples:

- feature/event-publication
- fix/duplicate-claim
- docs/api
- refactor/indexer

---

# Pull Request Expectations

A good Pull Request should:

- Solve one problem.
- Include tests where appropriate.
- Explain the motivation.
- Describe design decisions.
- Reference related issues.
- Keep commits clean and reviewable.

Avoid mixing unrelated changes.

---

# Coding Standards

General expectations:

- Prefer readability over cleverness.
- Keep functions small.
- Avoid duplicated logic.
- Prefer explicit naming.
- Fail fast.
- Use immutable data where practical.
- Document public interfaces.

---

# Smart Contract Contributions

The contract is intentionally conservative.

Changes affecting:

- Roles
- Minting
- Supply
- Metadata
- Transfer rules
- Revocation
- Storage layout
- Events

require additional review.

Every contract change must include:

- Unit tests
- Fuzz tests where appropriate
- Gas impact review
- Updated documentation

---

# API Changes

API changes must:

- Preserve backward compatibility when possible.
- Update OpenAPI documentation.
- Include request and response examples.
- Document new error conditions.

---

# Database Changes

Database changes require:

- Versioned migrations.
- Rollback consideration.
- Documentation updates.
- Performance review for large tables.

Do not introduce a Credential table without an accepted architecture decision.

---

# Documentation

Documentation is part of the product.

When changing behavior, update the relevant document.

Documentation should explain:

- Why
- What
- Tradeoffs
- Limitations

---

# Testing

Contributors should run:

- Formatting
- Linting
- Unit tests
- Integration tests (when affected)
- Smart contract tests (when affected)

No Pull Request should intentionally reduce test coverage.

---

# Security

If you discover a security issue:

- Do not open a public issue.
- Contact the maintainers privately.
- Include reproduction steps.
- Allow time for remediation before public disclosure.

---

# Issue Labels

Suggested labels:

- area:api
- area:web
- area:contract
- area:indexer
- area:worker
- area:database
- area:docs
- type:bug
- type:feature
- type:security
- good first issue
- help wanted

---

# Code Reviews

Reviewers should focus on:

- Correctness
- Security
- Simplicity
- Maintainability
- Documentation
- Test quality

Preference should be given to designs that reduce long-term complexity.

---

# Commit Messages

Examples:

- feat: add event publication worker
- fix: prevent duplicate wallet claims
- docs: update contract documentation
- refactor: simplify gallery projection
- test: add mint invariant tests

---

# Version One Scope

Contributors should avoid expanding the MVP with:

- DAO functionality
- Marketplace features
- Royalties
- Reputation systems
- Social features
- Plugin frameworks

These belong to future roadmap discussions.

---

# License

Unless otherwise stated, all contributions are made under the project's open-source license.

By submitting a contribution, you agree that your work may be distributed under that license.

---

# Final Principle

OpenBadge aims to become dependable infrastructure for communities.

Every contribution should make the project:

- Easier to understand.
- Easier to operate.
- Easier to audit.
- Easier to self-host.
- More secure.
