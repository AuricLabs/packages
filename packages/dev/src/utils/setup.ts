import fs from 'fs';
import path from 'path';

import { PackageJson } from '../types';

export type ProjectType = 'node' | 'react' | 'sst';

const PROJECT_TYPES: ProjectType[] = ['node', 'react', 'sst'];

export function setupProject(projectType: string): void {
  if (!PROJECT_TYPES.includes(projectType as ProjectType)) {
    console.error('❌ Invalid project type. Use: node, react, or sst');

    process.exit(1);
  }

  console.log(`🚀 Setting up ${projectType} project...`);

  updatePackageJson(projectType as ProjectType);
  createEslintConfig(projectType as ProjectType);
  createJestConfig(projectType as ProjectType);
  installDependencies(projectType as ProjectType);

  console.log('');
  console.log('🎉 Setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log(
    '1. Install dependencies: pnpm add -D @auriclabs/eslint-config @auriclabs/prettier-config @auriclabs/jest-config eslint prettier jest ts-jest @types/jest',
  );
  console.log('2. Run linting: pnpm lint');
  console.log('3. Run formatting: pnpm format');
  console.log('4. Run tests: pnpm test');
}

function updatePackageJson(_projectType: ProjectType): void {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ No package.json found in current directory');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;

  // Add prettier config
  packageJson.prettier = '@auriclabs/prettier-config';

  // Add scripts if they don't exist
  packageJson.scripts ??= {};

  if (!packageJson.scripts.lint) {
    packageJson.scripts.lint = 'eslint . --fix';
  }

  if (!packageJson.scripts.format) {
    packageJson.scripts.format = 'prettier --write .';
  }

  if (!packageJson.scripts.test) {
    packageJson.scripts.test = 'jest';
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');
}

function createEslintConfig(projectType: ProjectType): void {
  const eslintConfigPath = path.join(process.cwd(), 'eslint.config.js');

  const configContent = `import ${projectType}Config from '@auriclabs/eslint-config/${projectType}';

export default ${projectType}Config;
`;

  fs.writeFileSync(eslintConfigPath, configContent);
  console.log(`✅ Created eslint.config.js for ${projectType}`);
}

function createJestConfig(projectType: ProjectType): void {
  const jestConfigPath = path.join(process.cwd(), 'jest.config.js');

  const configContent = `import ${projectType}Config from '@auriclabs/jest-config/${projectType}';

export default ${projectType}Config;
`;

  fs.writeFileSync(jestConfigPath, configContent);
  console.log(`✅ Created jest.config.js for ${projectType}`);
}

function installDependencies(projectType: ProjectType): void {
  console.log('📦 Installing dependencies...');

  const dependencies = [
    '@auriclabs/eslint-config',
    '@auriclabs/prettier-config',
    '@auriclabs/jest-config',
    'eslint',
    'prettier',
    'jest',
    'ts-jest',
    '@types/jest',
  ];

  // Add type-specific dependencies
  if (projectType === 'react') {
    dependencies.push(
      '@types/react',
      '@types/react-dom',
      'jsdom',
      '@testing-library/react',
      '@testing-library/jest-dom',
    );
  }

  if (projectType === 'sst') {
    dependencies.push('sst');
  }

  console.log(`Run: pnpm add -D ${dependencies.join(' ')}`);
}
