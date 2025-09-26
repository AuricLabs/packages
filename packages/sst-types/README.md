# @auriclabs/sst-types

A TypeScript typings package that provides comprehensive type definitions for SST (Serverless Stack) development.

## Overview

This package contains TypeScript declaration files (`.d.ts`) for SST components, utilities, and platform-specific types. It's designed to enhance the developer experience by providing full type safety and IntelliSense support when working with SST applications.

## What's Included

- **AWS Components**: Type definitions for all AWS-based SST components including:
  - API Gateway (v1 & v2)
  - Lambda functions
  - DynamoDB tables
  - S3 buckets
  - SQS queues
  - SNS topics
  - RDS databases
  - VPC configurations
  - And many more...

- **Cloudflare Components**: Type definitions for Cloudflare-based SST components
- **Vercel Components**: Type definitions for Vercel-based SST components
- **Base Components**: Core SST component types and utilities
- **Platform Types**: Internal SST platform type definitions

## Installation

```bash
npm install @auriclabs/sst-types
# or
pnpm add @auriclabs/sst-types
# or
yarn add @auriclabs/sst-types
```

## Usage

This package is purely for TypeScript type definitions. Once installed, you'll automatically get:

- Full type safety for SST components
- IntelliSense autocompletion in your IDE
- Compile-time type checking for SST configurations

No additional imports or configuration are required - the types are automatically available when using SST in your TypeScript projects.

## Building

This package is built by extracting type definitions from the SST platform:

```bash
npm run build
```

The build process:
1. Installs SST platform types
2. Compiles TypeScript declarations
3. Extracts only the `.d.ts` files
4. Organizes them into a clean distribution structure

## Development

This package is part of the AuricLabs monorepo. The types are automatically generated from the SST platform and should not be manually edited.

## License

ISC
