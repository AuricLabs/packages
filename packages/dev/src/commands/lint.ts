import process from 'node:process';

import { Command } from 'commander';

import { LintOptions } from '../types';

export function lintCommand(program: Command): void {
  program
    .command('lint')
    .description('Run linting on the current project')
    .option('-f, --fix', 'Automatically fix problems')
    .option('-w, --watch', 'Watch for changes')
    .action(async (options: LintOptions) => {
      console.log('Running linting...');
      console.log('Options:', options);
      // TODO: Implement linting logic
      // Run ESLint using child_process
      const { spawn } = await import('child_process');
      const args = [
        '--ext',
        '.js,.ts,.jsx,.tsx',
        ...(options.fix ? ['--fix'] : []),
        ...(options.watch ? ['--watch'] : []),
        '.',
      ];

      const eslintProcess = spawn('pnpx eslint', args, { stdio: 'inherit' });

      eslintProcess.on('error', (error) => {
        console.error('Error running ESLint:', error);
        process.exit(1);
      });

      eslintProcess.on('close', (code) => {
        if (code !== 0) {
          process.exit(code);
        }
      });
    });
}
