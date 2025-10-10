# @auriclabs/metrics

A TypeScript metrics collection and visualization package for tracking function execution times, errors, and performance statistics with beautiful hierarchical tree displays.

## Features

- 📊 **Hierarchical Metrics**: Track metrics with dot-separated namespaces (e.g., `api.users.get`)
- 🎨 **Beautiful Visualization**: Display metrics using:
  - **cli-table3**: Professional tables with borders showing hierarchical tree structure and all metrics
  - **Unicode box-drawing characters**: Tree visualization (├──, └──, │) in table format
  - **chalk**: Color-coded statistics for better readability
- ⏱️ **Performance Tracking**: Automatically record min, max, average, and total duration
- 🚨 **Error Tracking**: Track and display error counts
- 🔄 **Sync & Async Support**: Built-in `span` helper for both sync and async function tracking
- 🎯 **Return Value Preservation**: Span functions preserve and return values from wrapped functions

## Installation

```bash
pnpm add @auriclabs/metrics
```

## Dependencies

- `cli-table3` - For professional table formatting with borders
- `chalk` - For color-coded output
- `lodash-es` - For utility functions

## Usage

### Basic Metrics Recording

```typescript
import { recordMetrics, displayMetrics } from '@auriclabs/metrics';

// Record a metric manually
recordMetrics('api.users.get', 145.23);

// Record with error
recordMetrics('api.users.create', 230.45, new Error('Validation failed'));

// Display all metrics
displayMetrics();
```

### Using Spans for Automatic Tracking

```typescript
import { span, displayMetrics } from '@auriclabs/metrics';

async function getUserData(userId: string) {
  return await span('api.users.get', async () => {
    // Your async code here
    const user = await fetchUserFromDatabase(userId);
    return user; // Return values are preserved
  });
}

async function createUser(userData: UserData) {
  return await span('api.users.create', async () => {
    // Your async code here
    const newUser = await saveUserToDatabase(userData);
    return newUser; // Return values are preserved
  });
}

// After execution
displayMetrics();
```

### Return Value Preservation

The `span` function automatically preserves return values from both sync and async functions:

```typescript
import { span } from '@auriclabs/metrics';

// Synchronous function with return value
const result = span('calculate', () => {
  return 42 * 2;
});
console.log(result); // 84

// Async function with return value
const user = await span('fetchUser', async () => {
  return await db.users.findById('123');
});
console.log(user); // User object

// Mixed sync and async spans
const total = await span('processOrder', async () => {
  const price = span('calculatePrice', () => 100); // Sync
  const tax = await span('fetchTax', async () => 10); // Async
  return price + tax;
});
console.log(total); // 110
```

### Hierarchical Metrics

```typescript
import { span } from '@auriclabs/metrics';

async function handleRequest() {
  await span('api', async () => {
    await span('request', async () => {
      await span('auth', async () => {
        // Authentication logic
        // This creates metric: api.request.auth
      });

      await span('validation', async () => {
        // Validation logic
        // This creates metric: api.request.validation
      });

      await span('processing', async () => {
        // Processing logic
        // This creates metric: api.request.processing
      });
    });
  });
}
```

## Display Output

The `displayMetrics()` function produces two sections:

### 1. Summary Table

```
═══ Metrics Summary ═══
┌─────────────┬────────────────┬──────────────┬──────────────┐
│ Total Calls │ Total Duration │ Total Errors │ Avg Duration │
├─────────────┼────────────────┼──────────────┼──────────────┤
│ 42          │ 1234.56ms      │ 3            │ 29.39ms      │
└─────────────┴────────────────┴──────────────┴──────────────┘
```

### 2. Hierarchical Metrics Tree Table

Tree structure with Unicode box-drawing characters in the first column, followed by all metrics:

```
═══ Metrics Tree ═══
┌──────────────────────────────────┬────────┬────────────┬────────────┬────────────┬────────────┬────────┐
│ Span                             │ Calls  │ Avg        │ Min        │ Max        │ Total      │ Errors │
├──────────────────────────────────┼────────┼────────────┼────────────┼────────────┼────────────┼────────┤
│ ├── api                          │ 15     │ 145.23ms   │ 100.00ms   │ 200.00ms   │ 2178.45ms  │ 0      │
│ │   ├── users                    │ 8      │ 230.45ms   │ 180.00ms   │ 300.00ms   │ 1843.60ms  │ 2      │
│ │   │   ├── get                  │ 7      │ 142.50ms   │ 100.00ms   │ 200.00ms   │ 997.50ms   │ 0      │
│ │   │   └── create               │ 1      │ 846.10ms   │ 846.10ms   │ 846.10ms   │ 846.10ms   │ 2      │
│ │   └── posts                    │ 5      │ 150.00ms   │ 130.00ms   │ 180.00ms   │ 750.00ms   │ 0      │
│ │       ├── list                 │ 3      │ 80.12ms    │ 60.00ms    │ 120.00ms   │ 240.36ms   │ 0      │
│ │       └── create               │ 2      │ 254.82ms   │ 180.00ms   │ 329.64ms   │ 509.64ms   │ 0      │
│ └── database                     │ 4      │ 50.00ms    │ 40.00ms    │ 65.00ms    │ 200.00ms   │ 0      │
│     └── query                    │ 4      │ 50.00ms    │ 40.00ms    │ 65.00ms    │ 200.00ms   │ 0      │
└──────────────────────────────────┴────────┴────────────┴────────────┴────────────┴────────────┴────────┘
```

## API Reference

### `recordMetrics(name: string, duration: number, error?: unknown)`

Manually record a metric.

**Parameters:**
- `name`: Dot-separated metric name (e.g., 'api.users.get')
- `duration`: Execution duration in milliseconds
- `error` (optional): Error object if the operation failed

### `getMetrics(): Record<string, MetricsRecord>`

Get all recorded metrics as a plain object.

**Returns:** Object with metric names as keys and `MetricsRecord` objects as values.

### `displayMetrics()`

Display all metrics in a beautiful formatted output with:
- Summary table showing totals and averages
- Hierarchical tree showing all metrics with their statistics

### `span<T>(name: string, fn: () => T | Promise<T>): T | Promise<T>`

Execute a synchronous or asynchronous function and automatically record its execution time.

**Parameters:**
- `name`: Metric name for this span
- `fn`: Function to execute (can be sync or async)

**Returns:** The return value from the wrapped function (preserves both sync and async returns)

**Features:**
- ✅ **Sync & Async Support**: Works with both synchronous and asynchronous functions
- ✅ **Return Value Preservation**: Returns whatever your function returns
- ✅ **Automatic Duration Tracking**: Captures execution time automatically
- ✅ **Error Handling**: Records errors while still throwing them for proper error propagation
- ✅ **Nested Spans**: Supports hierarchical metrics with dot-notation (e.g., `parent.child.grandchild`)
- ✅ **Type Safety**: Full TypeScript support with generic type parameter

**Examples:**

```typescript
// Synchronous function
const result = span('math.add', () => 1 + 1); // Returns: 2

// Asynchronous function
const data = await span('api.fetch', async () => {
  return await fetch('/api/data');
}); // Returns: Response object

// Nested spans with return values
const user = await span('users', async () => {
  const id = span('generateId', () => uuid()); // Sync
  return await span('save', async () => {
    return await db.users.insert({ id }); // Async
  });
});
```

## MetricsRecord Interface

```typescript
interface MetricsRecord {
  totalRecords: number;      // Number of times this metric was recorded
  totalDuration: number;     // Sum of all durations
  averageDuration: number;   // Average duration per call
  maxDuration: number;       // Maximum duration observed
  minDuration: number;       // Minimum duration observed
  duration: number;          // Last recorded duration
  totalErrors: number;       // Count of errors
  lastError?: unknown;       // Last error object
}
```

## Color Coding

The display uses color coding for better readability:

- **Cyan**: Metric names
- **White**: Call counts
- **Yellow**: Average duration
- **Green**: Minimum duration
- **Red**: Maximum duration and errors
- **Magenta**: Total duration
- **Gray**: Labels and borders

## Examples

### Express.js Middleware

```typescript
import { span, displayMetrics } from '@auriclabs/metrics';
import express from 'express';

const app = express();

app.use(async (req, res, next) => {
  await span('http', async () => {
    await span(req.method, async () => {
      await span(req.path, async () => {
        next();
      });
    });
  });
});

// Display metrics on shutdown
process.on('SIGTERM', () => {
  displayMetrics();
  process.exit(0);
});
```

### Database Operations

```typescript
import { span } from '@auriclabs/metrics';

class UserRepository {
  async findById(id: string): Promise<User | null> {
    return await span('database', async () => {
      return await span('users', async () => {
        return await span('findById', async () => {
          // Return value is preserved through all nested spans
          return await this.db.users.findOne({ id });
        });
      });
    });
  }

  async create(user: User): Promise<User> {
    return await span('database', async () => {
      return await span('users', async () => {
        return await span('create', async () => {
          // Validates before inserting
          const isValid = span('validate', () => this.validate(user)); // Sync span
          if (!isValid) throw new Error('Invalid user');
          
          // Return the created user
          return await this.db.users.insert(user);
        });
      });
    });
  }
}

// Usage - all return values work as expected
const user = await userRepo.findById('123');
if (user) {
  console.log(user.name);
}

const newUser = await userRepo.create({ name: 'Alice', email: 'alice@example.com' });
console.log(newUser.id); // Newly created user ID
```

## License

ISC

