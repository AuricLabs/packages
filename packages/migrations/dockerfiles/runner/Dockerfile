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

# Resolver smoke: write a probe at the same path the runtime wrapper uses
# (/app/migrations-bundle.mjs) and import every pinned AWS SDK client. Fails
# the image build if any package can't be resolved from the bundle's location
# — catches drift between DEFAULT_BUNDLE_EXTERNALS, runner-package.json, and
# BUNDLE_PATH at build time rather than at first consumer deploy.
RUN printf '%s\n' \
  "import '@aws-sdk/client-dynamodb';" \
  "import '@aws-sdk/client-eventbridge';" \
  "import '@aws-sdk/client-kms';" \
  "import '@aws-sdk/client-lambda';" \
  "import '@aws-sdk/client-s3';" \
  "import '@aws-sdk/client-sns';" \
  "import '@aws-sdk/client-sqs';" \
  "import '@aws-sdk/lib-dynamodb';" \
  "import '@aws-sdk/s3-request-presigner';" \
  > /app/migrations-bundle.mjs \
  && node /app/migrations-bundle.mjs \
  && rm /app/migrations-bundle.mjs

# Wrapper: fetch + verify + exec.
COPY wrapper.mjs ./wrapper.mjs

# Run as non-root for least privilege. node:22-slim ships a `node` user.
USER node

CMD ["node", "/app/wrapper.mjs"]
