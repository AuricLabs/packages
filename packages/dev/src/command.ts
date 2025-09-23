#!/usr/bin/env node

import { Command } from 'commander';

import { registerCommands } from './commands';

const program = new Command();

program
  .name('auricdev')
  .description('AuricLabs development CLI for project setup and tooling')
  .version('0.0.1');

// Register all commands
registerCommands(program);

program.parse();
