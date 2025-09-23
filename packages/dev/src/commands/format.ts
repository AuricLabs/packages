import { Command } from 'commander';

export function formatCommand(program: Command): void {
  program
    .command('format')
    .description('Format code in the current project')
    .option('-w, --write', 'Write changes to files')
    .option('-c, --check', 'Check if files are formatted')
    .action((options) => {
      console.log('Running formatting...');
      console.log('Options:', options);
      // TODO: Implement formatting logic
    });
}
