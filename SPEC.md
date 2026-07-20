# SPEC.md

# OpenBadge Functional Specification

Version: 1.0

Status: Draft

---

# Purpose

This document defines the functional behavior of OpenBadge.

It describes what the platform must do.

It intentionally does not describe implementation details, database design or programming languages.

Every component of the platform should be implemented according to this specification.

---

# Guiding Principles

Every feature described in this document must follow these principles.

- Simplicity over complexity.
- Event First.
- Self Hosted First.
- API First.
- Mobile Friendly.
- Secure by Default.

---

# Actors

The platform currently supports three actor types.

## Visitor

A person who has not authenticated.

Can:

- View public events.
- View public galleries.
- Verify credentials.

Cannot:

- Create events.
- Claim credentials.

---

## Organizer

Authenticated user capable of creating events.

Can:

- Create events.
- Edit draft events.
- Publish events.
- Generate claim codes.
- Export claims.
- View statistics.

---

## Attendee

Authenticated wallet owner.

Can:

- Claim credentials.
- View gallery.
- Share gallery.
- Verify owned credentials.

---

# Authentication

## Feature

Wallet Authentication

---

Purpose

Authenticate a user using a supported blockchain wallet.

---

Supported Wallets (Version 1)

- MetaMask
- WalletConnect

Future versions may support additional wallets.

---

Main Flow

1. User clicks "Connect Wallet".
2. Wallet prompts signature request.
3. User signs challenge.
4. Signature is verified.
5. User session is created.
6. Dashboard opens.

---

Business Rules

Wallet ownership must always be verified by signature.

Passwords are never stored.

Private keys are never requested.

---

Errors

INVALID_SIGNATURE

WALLET_NOT_SUPPORTED

SESSION_EXPIRED

---

Acceptance Criteria

Authentication completes in less than 10 seconds.

---

# Event Lifecycle

## Feature

Create Event

---

Purpose

Allow organizers to create an event.

---

Required Fields

Title

Description

Artwork

Start Date

End Date

Blockchain

Maximum Claims

---

Optional Fields

Banner

Location

Website

Tags

External Links

---

Main Flow

1. Organizer opens dashboard.
2. Selects "Create Event".
3. Completes required information.
4. Uploads artwork.
5. Saves draft.
6. Publishes event.

---

Business Rules

Title is required.

Artwork is required.

Maximum Claims must be greater than zero.

Published events cannot change blockchain.

Published events cannot change contract configuration.

---

Errors

TITLE_REQUIRED

INVALID_DATE

ARTWORK_REQUIRED

INVALID_BLOCKCHAIN

INVALID_MAX_CLAIMS

---

Acceptance Criteria

Event can be created in under five minutes.

---

## Feature

Publish Event

Purpose

Make an event publicly available for claiming.

---

Main Flow

Organizer presses Publish.

System validates event.

If valid:

Status becomes Published.

Claim endpoints become active.

Gallery becomes visible.

---

Business Rules

Only Draft events can be published.

Archived events cannot be published.

Deleted events cannot be restored.

---

# Claim Lifecycle

## Feature

Generate Claim Codes

Purpose

Generate claimable codes for an event.

---

Supported Methods

Unique Code

QR Code

---

Business Rules

Codes must be unique.

Codes cannot be reused.

Expired codes become invalid.

---

Acceptance Criteria

Generation of 10,000 claim codes must complete in less than one minute.

---

## Feature

Claim Credential

Purpose

Allow an attendee to receive a credential.

---

Main Flow

1. Scan QR.
2. Connect wallet.
3. Validate eligibility.
4. Create claim.
5. Queue mint.
6. Show confirmation.

---

Business Rules

One code equals one claim.

One claim equals one credential.

Claim codes expire according to event configuration.

Duplicate claims are rejected.

---

Errors

INVALID_CODE

CODE_ALREADY_USED

EVENT_CLOSED

EVENT_NOT_FOUND

WALLET_ALREADY_CLAIMED

MAX_CLAIMS_REACHED

---

Acceptance Criteria

Successful claims complete in less than 30 seconds.

---

# Credential Lifecycle

## Feature

Mint Credential

Purpose

Issue the blockchain credential.

---

Main Flow

Claim validated.

Mint request enters queue.

Worker signs transaction.

Blockchain confirms transaction.

Credential status becomes Minted.

Gallery updates.

---

Business Rules

Minting is asynchronous.

User should never wait for blockchain confirmation.

Failed minting should automatically retry.

---

Credential Status

Pending

Minting

Minted

Failed

Revoked

---

Errors

BLOCKCHAIN_ERROR

TRANSACTION_FAILED

QUEUE_TIMEOUT

---

# Gallery

Purpose

Display credentials owned by a wallet.

---

Features

Grid View

Credential Detail

Event Detail

Search

Share URL

---

Business Rules

Only Minted credentials appear.

Pending credentials remain hidden.

---

# Verification

Purpose

Verify credential authenticity.

---

Verification Result

Credential exists

Issuer

Owner

Mint Date

Blockchain

Transaction

Status

---

# Event States

Draft

Published

Paused

Archived

Deleted

---

Allowed Transitions

Draft

↓

Published

↓

Paused

↓

Published

↓

Archived

↓

Deleted

Deleted is permanent.

---

# File Uploads

Supported

PNG

JPG

WEBP

SVG

Maximum Size

10 MB

---

# Blockchain

Version One supports one blockchain.

Future versions may support multiple.

The blockchain implementation must remain abstract enough to allow additional networks without changing business logic.

---

# Notifications

Version One includes only system notifications.

Examples

Credential Claimed

Mint Completed

Mint Failed

No email or messaging integrations are included in Version One.

---

# Permissions

Visitor

Read Only

Organizer

Manage Own Events

Attendee

Manage Own Credentials

System Administrator

Manage Platform

---

# Search

Version One supports searching by

Event Name

Organization

Wallet Address

Credential ID

---

# Non Functional Requirements

Responsive UI

Dark Mode

Docker Deployment

REST API

OpenAPI Documentation

Mobile Friendly

Accessibility AA

95+ Lighthouse

Horizontal Scalability

---

# Performance Targets

Dashboard Load

< 2 seconds

Gallery Load

< 2 seconds

Claim

< 30 seconds

API Response

< 500 ms

QR Validation

< 300 ms

---

# Security

Wallet signature authentication.

CSRF protection.

Rate limiting.

Input validation.

File validation.

Signed uploads.

Audit logging.

---

# Future Extensions

This specification intentionally excludes:

Certificates

Reputation

DAO integrations

Discord

Telegram

Identity

Plugins

Analytics

SDK

Multi-chain

These features belong to future versions and must not influence Version One architecture.

---

# Definition of Done

Version One is complete when:

An organizer can create an event.

An attendee can claim a credential.

The credential is minted.

The credential appears in a public gallery.

The credential can be independently verified.

The platform can be deployed using Docker Compose.

No additional functionality is required for Version One.