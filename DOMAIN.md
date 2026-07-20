# DOMAIN.md

# OpenBadge Domain Model

Version: 1.0

Status: Draft

---

# Purpose

This document defines the core business concepts of OpenBadge.

Its objective is to establish a common language for developers, designers, contributors and AI coding assistants.

Every component of the platform must use these definitions consistently.

---

# Domain Philosophy

OpenBadge is an Event Credential Platform.

Everything in the system exists because of an Event.

Events generate Claims.

Claims generate Credentials.

Credentials belong to Wallets.

Nothing exists independently.

---

# Domain Relationships

Organization
    │
    ├── owns
    │
    ▼
Event
    │
    ├── generates
    │
    ▼
Claim
    │
    ├── creates
    │
    ▼
Credential
    │
    ├── belongs to
    │
    ▼
Wallet

---

# Organization

## Definition

An Organization represents the entity responsible for creating events.

Examples:

- ETH Cinco de Mayo
- Ethereum México
- Starknet Foundation
- Universidad Nacional
- Company
- Meetup Group

Organizations are logical containers.

They own Events.

They never own Credentials.

---

## Responsibilities

Create Events.

Manage Events.

Publish Events.

View Claims.

Export Reports.

---

## Does NOT

Store credentials.

Store wallets.

Mint NFTs.

---

# Event

## Definition

An Event is the central entity of OpenBadge.

Everything starts with an Event.

Without an Event, nothing else exists.

Examples:

ETH Cinco de Mayo 2027

ETHGlobal New York

Monthly Community Call

Workshop

University Course

Conference

---

## Responsibilities

Defines when claims are allowed.

Defines artwork.

Defines metadata.

Defines blockchain configuration.

Defines claim rules.

Defines credential template.

---

## Lifecycle

Draft

↓

Published

↓

Paused

↓

Archived

↓

Deleted

---

## Owns

Claims

Credential Template

Media

Configuration

---

## Never Owns

Wallets

Organizations

---

# Claim

## Definition

A Claim represents the intention to receive a credential.

A Claim is NOT the credential.

A Claim exists before blockchain minting.

Think of it as a reservation.

---

## Responsibilities

Validate eligibility.

Reserve supply.

Trigger minting.

Track progress.

---

## Lifecycle

Pending

↓

Validated

↓

Minting

↓

Completed

↓

Failed

↓

Expired

---

## Important

One Claim can produce only one Credential.

---

# Credential

## Definition

A Credential is the final digital proof of participation.

Version One implements Credentials as ERC-1155 tokens.

The blockchain representation is an implementation detail.

The business concept is simply "Credential."

---

## Responsibilities

Represent participation.

Provide verification.

Appear in galleries.

Remain permanently associated with a wallet.

---

## Lifecycle

Pending

↓

Minted

↓

Verified

↓

Revoked (optional future)

---

## Properties

Immutable.

Transfer policy defined by the event.

Publicly verifiable.

---

# Wallet

## Definition

A Wallet represents the identity of an attendee.

In Version One it is also the authentication method.

The Wallet owns Credentials.

The Wallet never owns Events.

---

## Responsibilities

Authenticate users.

Receive credentials.

Display gallery.

Sign requests.

---

# Gallery

## Definition

A Gallery is a public collection of credentials owned by a wallet.

It is a projection.

It does not own data.

It only displays it.

---

## Contains

Credentials.

Events.

Organizations.

Blockchain links.

---

# Artwork

## Definition

Artwork is the primary visual representation of an Event.

Each Event has one Artwork.

Credentials reference the Event Artwork.

Artwork is immutable after publication.

---

# QR Code

## Definition

A QR Code is simply one possible transport mechanism for a Claim.

A QR Code is not a Credential.

A QR Code is not proof of attendance.

It only provides access to the Claim flow.

---

# Claim Code

## Definition

A Claim Code authorizes a single Claim.

It may be represented as:

- QR
- Text
- URL

A Claim Code becomes invalid immediately after successful use.

---

# Minting

## Definition

Minting is the blockchain process that creates a Credential.

Minting is asynchronous.

Users should never wait for blockchain confirmation before receiving feedback.

---

# Verification

## Definition

Verification confirms that a Credential is authentic.

Verification answers:

Does this credential exist?

Who issued it?

Who owns it?

Which event created it?

When was it minted?

---

# Metadata

## Definition

Metadata describes an Event and its Credentials.

Examples:

Title

Description

Image

Location

Date

Organization

Tags

Metadata may evolve.

The Credential itself does not.

---

# Blockchain

## Definition

Blockchain is the persistence layer for Credentials.

It is not the business domain.

OpenBadge should be designed so business logic remains independent from any specific blockchain.

---

# User

## Definition

A User represents a person interacting with OpenBadge.

Version One associates Users with Wallets.

Future versions may introduce additional authentication providers.

---

# Attendee

## Definition

An Attendee is a User who claims Credentials.

Attendees never manage platform configuration.

---

# Organizer

## Definition

An Organizer is a User authorized to create and manage Events.

Organizers issue Credentials.

They do not own them.

---

# Administrator

## Definition

An Administrator manages the OpenBadge installation.

Administrators do not automatically become Organizers.

These roles are independent.

---

# Ownership Model

Organizations own Events.

Events own Claims.

Claims generate Credentials.

Wallets own Credentials.

Galleries display Credentials.

This ownership chain must never be violated.

---

# Business Rules

A Credential cannot exist without an Event.

A Claim cannot exist without an Event.

A Claim cannot exist without a Wallet.

A Credential cannot exist without a successful Claim.

Deleting an Event never deletes existing Credentials.

Published Events become immutable except for administrative metadata.

Every Credential always references exactly one Event.

Every Claim references exactly one Wallet.

Every Event belongs to exactly one Organization.

---

# Ubiquitous Language

Always use these terms consistently.

Organization

Event

Claim

Credential

Wallet

Gallery

Artwork

Claim Code

Minting

Verification

Avoid ambiguous terms such as:

NFT (use Credential)

Token (use Credential when discussing business logic)

Collection (use Gallery unless referring to blockchain contracts)

User Address (use Wallet)

Asset (use Credential)

Badge (marketing term only, not a domain entity)

---

# Final Principle

The domain model should remain stable even if:

- the blockchain changes,
- the database changes,
- the frontend changes,
- the API changes.

Technology evolves.

The domain should not.