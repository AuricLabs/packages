import { Command } from 'commander';

import { setupProject } from '../utils/setup';

export function setupCommand(program: Command): void {
  program
    .command('setup')
    .description('Setup project with ESLint, Prettier, and Jest configurations')
    .argument('<type>', 'Project type: node, react, or sst')
    .action((type: string) => {
      setupProject(type);
    });
}
