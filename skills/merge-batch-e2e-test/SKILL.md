---
name: merge-batch-e2e-test
description: "Synthetic skill used to exercise the maintainer merge workflow end-to-end."
risk: safe
source: community
source_repo: Dimillian/Skills
source_type: community
date_added: "2026-04-05"
---

# Merge Batch E2E Test

## Overview

This temporary skill exists only to test the maintainer merge workflow against a deliberately broken pull request.

## When to Use

- Use when you need an intentionally broken skill PR to verify maintainer merge automation.

## Instructions

1. Confirm the maintainer workflow detects broken metadata and CI failures.
2. Repair the skill and let the PR proceed to merge.
