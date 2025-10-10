/**
 * Example usage of the @auriclabs/metrics package
 * Run this file to see the metrics display in action
 *
 * To run: tsx src/example.ts
 */

import { displayMetrics, recordMetrics, span, writeMetricsToFile } from './index';

/**
 * Simulate various API operations with metrics tracking
 */
async function runExample() {
  console.log('Running metrics example...\n');

  // Example 1: Manual metric recording
  console.log('1. Recording manual metrics...');
  recordMetrics('manual.operation.fast', 45.23);
  recordMetrics('manual.operation.slow', 234.56);
  recordMetrics('manual.operation.fast', 38.91);

  // Example 2: Using spans for automatic tracking (with automatic dot notation)
  console.log('2. Using spans for automatic tracking...');

  await span('api', async () => {
    await span('users', async () => {
      await span('get', async () => {
        await delay(100);
      });
    });
  });

  await span('api', async () => {
    await span('users', async () => {
      await span('create', async () => {
        await delay(150);
      });
    });
  });

  await span('api', async () => {
    await span('posts', async () => {
      await span('list', async () => {
        await delay(80);
      });
    });
  });

  // Example 3: Nested spans (hierarchical metrics built automatically)
  console.log('3. Creating hierarchical metrics with nested spans...');

  await span('api', async () => {
    await span('request', async () => {
      await delay(50);

      await span('auth', async () => {
        await delay(30);
      });

      await span('validation', async () => {
        await delay(20);
      });

      await span('processing', async () => {
        await delay(100);

        await span('database', async () => {
          await delay(60);
        });

        await span('cache', async () => {
          await delay(15);
        });
      });
    });
  });

  // Example 4: Recording errors
  console.log('4. Recording metrics with errors...');

  await span('api', async () => {
    await span('users', async () => {
      await span('delete', async () => {
        await delay(50);
        throw new Error('Permission denied');
      });
    });
  }).catch(() => {
    // Ignore error
  });

  await span('api', async () => {
    await span('posts', async () => {
      await span('create', async () => {
        await delay(120);
        throw new Error('Validation failed');
      });
    });
  }).catch(() => {
    // Ignore error
  });

  // Example 5: Multiple calls to same metric
  console.log('5. Recording multiple calls to same metrics...');

  for (let i = 0; i < 5; i++) {
    await span('database', async () => {
      await span('query', async () => {
        await delay(Math.random() * 100 + 50);
      });
    });
  }

  // Example 6: Various duration ranges
  console.log('6. Recording metrics with various durations...');

  await span('service', async () => {
    await span('fast', async () => {
      await delay(10);
    });
  });

  await span('service', async () => {
    await span('medium', async () => {
      await delay(100);
    });
  });

  await span('service', async () => {
    await span('slow', async () => {
      await delay(500);
    });
  });

  // Display all collected metrics
  console.log('\n7. Displaying all metrics...\n');
  displayMetrics();
  await writeMetricsToFile('./metrics.csv');
}

/**
 * Helper function to simulate async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the example
runExample().catch(console.error);
