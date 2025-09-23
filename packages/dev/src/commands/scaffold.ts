import fs from 'fs';
import path from 'path';

import { Command } from 'commander';
import degit from 'degit';
import prompts from 'prompts';

interface ScaffoldOptions {
  template?: string;
  name?: string;
  yes?: boolean;
}

export function scaffoldCommand(program: Command): void {
  program
    .command('scaffold')
    .description('Scaffold a new project from templates')
    .option('-t, --template <template>', 'Template to use')
    .option('-n, --name <name>', 'Project name')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(async (options: ScaffoldOptions) => {
      await scaffoldProject(options);
    });
}

async function scaffoldProject(options: ScaffoldOptions): Promise<void> {
  const templates = {
    'node-api': 'auriclabs/node-api-template',
    'react-app': 'auriclabs/react-app-template',
    'sst-app': 'auriclabs/sst-app-template',
    fullstack: 'auriclabs/fullstack-template',
  };

  let template = options.template;
  let projectName = options.name;

  if (!options.yes) {
    // Interactive prompts
    const response = await prompts([
      {
        type: 'select',
        name: 'template',
        message: 'Choose a template:',
        choices: Object.keys(templates).map((key) => ({
          title: key,
          value: key,
          description: `Scaffold a ${key} project`,
        })),
      },
      {
        type: 'text',
        name: 'projectName',
        message: 'What is your project name?',
        initial: 'my-project',
      },
    ]);

    template = response.template as string;
    projectName = response.projectName as string;
  }

  if (!template || !projectName) {
    console.error('❌ Template and project name are required');
    process.exit(1);
  }

  const templateUrl = templates[template as keyof typeof templates];
  if (!templateUrl) {
    console.error(`❌ Unknown template: ${template}`);
    process.exit(1);
  }

  const targetPath = path.join(process.cwd(), projectName);

  if (fs.existsSync(targetPath)) {
    console.error(`❌ Directory ${projectName} already exists`);
    process.exit(1);
  }

  console.log(`🚀 Scaffolding ${template} project: ${projectName}`);
  console.log(`📦 Using template: ${templateUrl}`);

  try {
    const emitter = degit(templateUrl, {
      cache: false,
      force: true,
      verbose: true,
    });

    await emitter.clone(targetPath);

    console.log('✅ Project scaffolded successfully!');
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${projectName}`);
    console.log('  pnpm install');
    console.log('  auricdev setup ' + getProjectType(template));
    console.log('  pnpm dev');
  } catch (error) {
    console.error('❌ Failed to scaffold project:', error);
    process.exit(1);
  }
}

function getProjectType(template: string): string {
  switch (template) {
    case 'node-api':
      return 'node';
    case 'react-app':
      return 'react';
    case 'sst-app':
      return 'sst';
    case 'fullstack':
      return 'react';
    default:
      return 'node';
  }
}
