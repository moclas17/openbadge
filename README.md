# OpenBadge

<p align="center">
  <img src="./docs/assets/logo.png" width="180">
</p>

<p align="center">
<b>The Open Source Alternative to POAP.</b><br>
Create, distribute and verify digital participation credentials.
</p>

<p align="center">
<img src="https://img.shields.io/badge/license-MIT-blue">
<img src="https://img.shields.io/badge/self-hosted-yes-success">
<img src="https://img.shields.io/badge/docker-supported-blue">
<img src="https://img.shields.io/badge/web3-open-orange">
</p>

---

# Why OpenBadge?

For years, POAP became the standard for digital attendance credentials.

Communities, hackathons, conferences and DAOs used it to issue collectible NFTs that represented participation.

With the announced sunset of the POAP platform, thousands of organizers need an open, transparent and self-hosted alternative.

OpenBadge exists to solve exactly that problem.

Not by reinventing everything.

But by providing a modern, open-source replacement that anyone can install, extend and own.

---

# Project Goals

OpenBadge has a very focused first objective.

> Allow any organization to issue digital participation credentials in less than five minutes.

That's it.

Everything else comes later.

The project intentionally starts small.

Our philosophy is:

> Build a great product first.
>
> Build a protocol later.

---

# What is OpenBadge?

OpenBadge is an open source platform that allows organizations to:

• Create events

• Generate participation credentials

• Distribute claim links or QR codes

• Allow attendees to claim credentials

• Verify ownership

• Display public collections

---

# What OpenBadge is NOT

OpenBadge is NOT:

- a DAO
- a social network
- a reputation protocol
- a marketplace
- an educational platform
- LinkedIn for Web3

Those ideas are interesting.

But they are intentionally outside the scope of v1.

---

# Design Principles

OpenBadge follows a few simple principles.

## Simplicity

Every feature should be understandable by a non-technical event organizer.

---

## Self Hosted

Every organization should be able to own its own infrastructure.

No vendor lock-in.

---

## API First

Every action available in the UI should also be available through the API.

---

## Open Source

Every line of code should be auditable.

Community contributions are welcome.

---

## Event First

The center of OpenBadge is the Event.

Not the NFT.

Not the wallet.

Everything revolves around an event.

---

# Core Features

Version 1 intentionally includes only the essentials.

## Organizations

Organizations represent communities that create events.

Examples:

ETH Cinco de Mayo

ETHGlobal

Starknet Foundation

Polygon

Universities

Companies

---

## Events

Events contain:

Name

Artwork

Description

Location

Date

Claim configuration

Blockchain

---

## Credentials

Each event issues one digital credential.

For v1 there is only one credential type:

Attendance

Future versions will include:

Speaker

Volunteer

Mentor

Judge

Winner

Organizer

Contributor

---

## Claims

Attendees can claim credentials using:

Unique code

QR Code

Future versions will support:

Dynamic QR

Email invitations

Telegram

NFC

Bluetooth

Allow Lists

---

## Gallery

Every wallet receives a public gallery.

Example:

https://openbadge.org/u/0x123...

Collections display:

Artwork

Event

Date

Organization

Blockchain

---

# User Journey

Organizer

↓

Create Event

↓

Upload Artwork

↓

Generate Claim Codes

↓

Publish

↓

Share QR

-------------------------------------

Attendee

↓

Scan QR

↓

Connect Wallet

↓

Claim

↓

Credential appears in Gallery

Done.

---

# Technical Overview

Frontend

Next.js

TypeScript

TailwindCSS

shadcn/ui

Backend

Fastify

Node.js

Prisma

PostgreSQL

Redis

BullMQ

Blockchain

ERC-1155

Base Network

Storage

S3 Compatible

IPFS

Deployment

Docker Compose

---

# Why ERC-1155?

Version 1 uses ERC-1155 instead of ERC-721.

Reasons:

Lower gas costs

Batch minting

One contract for all events

Better scalability

Simpler indexing

---

# Why Self Hosted?

Communities should own their infrastructure.

If OpenBadge disappeared tomorrow, every organization should still be able to issue credentials.

That is a core project principle.

---

# Roadmap

## Version 0.1

Organizations

Events

Claims

ERC1155

Gallery

Wallet Login

Docker

REST API

---

## Version 0.2

Email Login

Scanner PWA

Dynamic QR

Analytics

---

## Version 0.3

SDK

Webhooks

Public API

---

## Version 1.0

Production Ready

---

## Version 2

Credential Types

Organizations

Permissions

Public Profiles

---

## Version 3

Reputation

Attestations

Plugin System

---

# Repository Structure

openbadge/

backend/

frontend/

contracts/

docker/

docs/

.github/

---

# Documentation

The project documentation is organized as follows.

README.md

VISION.md

PRODUCT.md

SPEC.md

ARCHITECTURE.md

DATABASE.md

API.md

CONTRACT.md

ROADMAP.md

CONTRIBUTING.md

Each document describes one specific area of the system.

---

# Contributing

OpenBadge welcomes contributions.

Please read CONTRIBUTING.md before opening Pull Requests.

---

# License

MIT

---

# Acknowledgements

OpenBadge would not exist without the work done by the POAP team.

They helped define an entirely new category of digital participation credentials.

This project exists to continue that vision through an open, community-driven alternative.

---

# Status

🚧 Early Design Phase

No production code has been written yet.

The current focus is defining a complete functional specification before implementation begins.

---

Made with ❤️ by the OpenBadge community.