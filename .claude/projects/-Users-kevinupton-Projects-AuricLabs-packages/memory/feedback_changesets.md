---
name: changesets-patch-for-beta
description: Use patch changesets for 0.x beta packages to avoid unintended major version bumps
type: feedback
---

For 0.x (beta) packages, always use `patch` in changesets, never `minor`. Changesets treats `minor` on 0.x packages as a major bump to 1.0.0, which is not desired for beta packages.

**Why:** A `minor` changeset on 0.3.0 packages caused an unintended bump to 1.0.0 in production, which was already published and couldn't be reverted.

**How to apply:** When creating changesets for any package with version 0.x.x, always use `patch` as the bump type. Only use `minor` or `major` if the user explicitly wants to graduate the package out of beta.
