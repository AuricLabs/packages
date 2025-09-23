import { Command } from 'commander';

export interface ListOptions {
  templates: boolean;
  commands: boolean;
}

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List available templates and commands')
    .option('-t, --templates', 'Show only templates')
    .option('-c, --commands', 'Show only commands')
    .action((options: ListOptions) => {
      if (options.templates) {
        listTemplates();
      } else if (options.commands) {
        listCommands();
      } else {
        listAll();
      }
    });
}

function listTemplates(): void {
  console.log('📋 Available Templates:');
  console.log('');

  const templates = [
    {
      name: 'node-api',
      description: 'Node.js API with Express, TypeScript, and testing setup',
      type: 'node',
    },
    {
      name: 'react-app',
      description: 'React application with Vite, TypeScript, and modern tooling',
      type: 'react',
    },
    {
      name: 'sst-app',
      description: 'SST application with AWS infrastructure and serverless setup',
      type: 'sst',
    },
    {
      name: 'fullstack',
      description: 'Full-stack application with React frontend and Node.js backend',
      type: 'react',
    },
  ];

  templates.forEach((template) => {
    console.log(`  ${template.name.padEnd(12)} - ${template.description}`);
    console.log(`  ${' '.repeat(12)}   Type: ${template.type}`);
    console.log('');
  });
}

function listCommands(): void {
  console.log('🔧 Available Commands:');
  console.log('');

  const commands = [
    {
      name: 'scaffold',
      description: 'Create a new project from templates',
      usage: 'auricdev scaffold [options]',
    },
    {
      name: 'setup',
      description: 'Setup existing project with ESLint, Prettier, and Jest',
      usage: 'auricdev setup <type>',
    },
    {
      name: 'lint',
      description: 'Run ESLint on the project',
      usage: 'auricdev lint [options]',
    },
    {
      name: 'format',
      description: 'Format code with Prettier',
      usage: 'auricdev format [options]',
    },
  ];

  commands.forEach((command) => {
    console.log(`  ${command.name.padEnd(10)} - ${command.description}`);
    console.log(`  ${' '.repeat(10)}   Usage: ${command.usage}`);
    console.log('');
  });
}

function listAll(): void {
  console.log('🎯 AuricLabs Development CLI');
  console.log('');
  listTemplates();
  listCommands();
  console.log('💡 Tip: Use --help for detailed command information');
}
