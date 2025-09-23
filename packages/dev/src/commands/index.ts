import { Command } from 'commander';

import { formatCommand } from './format';
import { lintCommand } from './lint';
import { listCommand } from './list';
import { scaffoldCommand } from './scaffold';
import { setupCommand } from './setup';

export interface CommandModule {
  name: string;
  description: string;
  register: (program: Command) => void;
}

export const commands: CommandModule[] = [
  {
    name: 'setup',
    description: 'Setup existing project with ESLint, Prettier, and Jest',
    register: setupCommand,
  },
  {
    name: 'lint',
    description: 'Run ESLint on the project',
    register: lintCommand,
  },
  {
    name: 'format',
    description: 'Format code with Prettier',
    register: formatCommand,
  },
  {
    name: 'scaffold',
    description: 'Create a new project from templates',
    register: scaffoldCommand,
  },
  {
    name: 'list',
    description: 'List available templates and commands',
    register: listCommand,
  },
];

export function registerCommands(program: Command): void {
  commands.forEach((command) => {
    command.register(program);
  });
}
