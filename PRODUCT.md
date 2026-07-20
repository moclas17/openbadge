# Product Requirements Document

Project: OpenBadge

Version: 1.0

Status: Draft

---

# 1. Introduction

OpenBadge is an open-source platform that allows organizations to create, distribute and verify digital participation credentials.

The initial objective is simple:

Replace the core functionality of POAP with a modern, self-hosted and extensible alternative.

Version 1 intentionally focuses on one thing:

Participation credentials.

Nothing more.

---

# 2. Product Goal

OpenBadge allows event organizers to issue digital credentials in minutes.

Attendees can claim those credentials using a wallet.

Each credential becomes part of the attendee's permanent public collection.

---

# 3. Target Users

Version 1 supports only two user types.

## Organizer

Creates events.

Publishes claim codes.

Tracks issued credentials.

Nothing more.

---

## Attendee

Claims credentials.

Views personal collection.

Shares collection.

Nothing more.

---

# 4. User Journey

Organizer

↓

Login

↓

Create Event

↓

Upload Artwork

↓

Generate Claim Codes

↓

Publish Event

↓

Share QR

--------------------------------

Attendee

↓

Scan QR

↓

Connect Wallet

↓

Claim Credential

↓

Credential appears in Gallery

End

---

# 5. Core Modules

Version 1 contains only six modules.

## Authentication

Wallet login.

No usernames.

No passwords.

Future versions may support email login.

---

## Organizations

An organization owns events.

Version 1 fields:

Name

Slug

Logo

Website

Description

---

## Events

Every credential belongs to one event.

Fields:

Title

Description

Artwork

Banner (optional)

Location

Start Date

End Date

Blockchain

Maximum Claims

Visibility

Status

---

## Claims

Claims represent the process of obtaining a credential.

Supported methods:

Unique Code

QR Code

Future versions:

Dynamic QR

Email

Telegram

NFC

---

## Credentials

One event.

One credential type.

Attendance.

Fields:

Recipient

Issuer

Transaction

Claim Date

Status

---

## Gallery

Public page showing all credentials owned by a wallet.

Features:

Grid View

Event Detail

Organization

Search

Share URL

---

# 6. Out of Scope

Version 1 intentionally excludes:

Speaker credentials

Volunteer credentials

Reputation

Certificates

DAO integrations

Analytics

Plugin system

Notifications

Discord

Telegram

Marketplace

Templates

These ideas belong to future versions.

---

# 7. Success Criteria

The product succeeds when:

An organizer creates an event in less than five minutes.

An attendee claims a credential in less than thirty seconds.

The complete platform installs using Docker Compose.

The entire workflow requires zero technical knowledge.

---

# 8. Functional Requirements

The system shall allow:

Create Organization

Update Organization

Delete Organization

Create Event

Edit Event

Publish Event

Generate Claim Codes

Claim Credential

View Gallery

View Event

View Credential

Export Claims

---

# 9. Non Functional Requirements

Fast.

Responsive.

Mobile Friendly.

Accessible.

Self Hosted.

Docker Ready.

Open Source.

API First.

Simple UI.

---

# 10. Product Philosophy

OpenBadge deliberately starts small.

Every feature added to the project must answer one question.

Does this help organizations issue participation credentials more easily?

If the answer is no,

the feature probably does not belong in Version 1.

---

# 11. Future Growth

OpenBadge is intentionally designed to grow gradually.

Version 2 may introduce:

Credential Types

Scanner PWA

Email Login

Organizations

Permissions

Statistics

SDK

Public API

Version 3 may introduce:

Attestations

Reputation

Plugins

Integrations

Identity

Those features are outside the scope of Version 1.

---

# 12. Closing

OpenBadge Version 1 is not trying to solve every problem.

It is trying to solve one problem exceptionally well.

Helping communities issue participation credentials that they fully own.