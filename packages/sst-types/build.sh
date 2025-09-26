#!/bin/bash

rm -rf .sst dist
npx sst install
touch .sst/types.generated.ts

# perform the type generation
cd .sst/platform && tsc --noEmit false --noEmitOnError false --declaration true && cd ../..

# delete all files that are not .d.ts
find .sst -type f \( -name "*.js" -o -name "*.cjs" -o -name "*.mjs" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) ! -name "*.d.ts" -delete

# clean up the .sst platform
rm -rf .sst/platform/functions .sst/platform/node_modules .sst/stage .sst/platform/bun.lockb .sst/platform/version .sst/platform/dist

# move the .sst platform to the src folder
mv .sst dist
