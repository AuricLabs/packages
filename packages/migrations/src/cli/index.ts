import { Command } from 'commander';

import * as commands from './commands';

const program = new Command();

program.name('auric-migrate').description('Auric migration CLI').version('0.0.1');

Object.values(commands).forEach((command) => {
  program.addCommand(command);
});

export { program };
