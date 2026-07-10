# Alp-Viram

An app currently in development, intended for release on the Google Play Store.

> Project scope and tech stack to be documented here as they are finalized.

## Branch strategy

This repository uses three long-lived branches:

| Branch        | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `Development` | Active development. Day-to-day work lands here.      |
| `Test`        | QA / staging. Stabilized builds for testing.         |
| `Production`  | Release-ready code. What ships to the Play Store.    |

Typical flow: `Development` → `Test` → `Production`.
