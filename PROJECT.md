# EchoRent

## Goal

Build a voice-first airport car-rental agent.

Supported airports:

- Dubai International Airport — DXB
- Singapore Changi Airport — SIN

Traveller flow:

speak
→ provide rental requirements
→ receive cars
→ select a car
→ create a reservation request
→ human approval
→ final status

The current MVP uses demo inventory until an approved live rental provider
is integrated.

## Architecture

Browser
→ AssemblyAI Voice Agent API
→ EchoRent backend
→ demo inventory / reservation workflow

AssemblyAI owns the conversational voice pipeline.

EchoRent backend owns business truth, validation, persistence,
authorization, and consequential actions.

The model proposes.
The backend validates and controls effects.

## Team ownership

Seng owns frontend design and frontend implementation.

Tenzy owns:

- AssemblyAI integration
- voice-agent behavior
- backend
- tools
- validation
- reservation workflow
- approval flow
- reliability and backend tests

Shared:

- API contracts
- end-to-end verification
- repository

## Booking authority

The voice agent cannot independently confirm a booking.

Lifecycle:

draft
→ pending
→ confirmed | rejected
→ cancelled where applicable

Only an authorized human may transition pending → confirmed.

The agent must never describe a pending request as confirmed.

## Current phase

Frontend + Voice Integration v1.

Current objective:

Seng UI
→ real Shen voice conversation
→ backend search
→ exact same structured results rendered in UI and spoken by Shen.

This phase excludes:

- booking implementation
- agreement submission
- email delivery
- Google authentication
- database
- human approval
- payment
- live rental inventory
- additional airports

## Engineering workflow

Inspect
→ plan
→ implement
→ test
→ inspect diff
→ human verification
→ commit
→ PR
→ merge

Default:

one phase → one branch → one PR
