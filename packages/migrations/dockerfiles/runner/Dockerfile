# syntax=docker/dockerfile:1.6
#
# Generic migrations-runner image, published to Docker Hub as
# `auriclabs/migrations-runner:<version>`. Consumers of @auriclabs/migrations
# never build their own Dockerfile — they upload a bundle to S3 and point
# a Fargate Task at this image with `MIGRATION_BUNDLE_URL` set.
#
# The image bundles only the AWS SDK packages migrations typically import
# (the bundle externalises @aws-sdk/*, @smithy/*, @aws-crypto/*). Everything
# else is in the user's bundle. See packages/migrations/dockerfiles/runner
# /runner-package.json for the pinned set.

FROM node:22-slim AS runtime

# Add curl + ca-certificates for diagnostic and TLS — npm install needs ca-certificates.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Install the AWS SDK + transitives. The bundle's externalised imports
# resolve here at runtime via Node's standard resolution.
COPY runner-package.json ./package.json
RUN npm install --omit=dev --no-package-lock --no-audit --no-fund

# Wrapper: fetch + verify + exec.
COPY wrapper.mjs ./wrapper.mjs

# Run as non-root for least privilege. node:22-slim ships a `node` user.
USER node

CMD ["node", "/app/wrapper.mjs"]
