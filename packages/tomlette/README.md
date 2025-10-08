# Tomlette

A flexible parser for TOML/YAML/Properties files with variable substitution and JSON5-like type inference. **Supports mixed syntax within a single file!**

## Features

- **Mixed syntax support**: Parse TOML, YAML, and Properties sections all in one file
- **Variable substitution**: Support for `${variable}`, `$variable`, and `{{variable}}` syntaxes
- **Type inference**: JSON5-like automatic type detection for numbers, booleans, arrays, and objects
- **Smart parsing**: Automatically detects syntax per section and parses accordingly
- **Lenient parsing**: Graceful handling of malformed syntax with warnings
- **Nested variables**: Support for nested object property access (e.g., `${user.profile.name}`)

## Installation

```bash
pnpm add @auriclabs/tomlette
```

## Usage

### Basic Parsing

```typescript
import { parse } from '@auriclabs/tomlette';

// Parse mixed syntax content
const result = parse(`
[user]
name = "John"
age = 30
active = true
`);

console.log(result.data); // { user: { name: 'John', age: 30, active: true } }
```

### Mixed Syntax Parsing

```typescript
import { parse } from '@auriclabs/tomlette';

// Mix TOML, YAML, and Properties in one file!
const result = parse(`
# TOML section
[database]
host = "localhost"
port = 5432

# YAML section
api:
  version: "v1"
  timeout: 5000
  endpoints:
    - /users
    - /posts

# Properties section
app.name=MyApp
app.debug=true
users[]=John
users[]=Jane
`);

console.log(result.data);
// {
//   database: { host: 'localhost', port: 5432 },
//   api: { version: 'v1', timeout: 5000, endpoints: ['/users', '/posts'] },
//   app: { name: 'MyApp', debug: true },
//   users: ['John', 'Jane']
// }
```

### With Variables

```typescript
import { parse } from '@auriclabs/tomlette';

const variables = {
  user: { name: 'John', age: 30 },
  config: { debug: true },
};

const result = parse(`
[user]
name = "${user.name}"
age = ${user.age}

[config]
debug = ${config.debug}
`, { variables });

console.log(result.data);
// {
//   user: { name: 'John', age: 30 },
//   config: { debug: true }
// }
```

### Forcing Specific Formats

```typescript
import { parseTomlContent, parseYamlContent, parsePropertiesContent } from '@auriclabs/tomlette';

// Use individual parsers for specific formats
const tomlResult = parseTomlContent(content, { variables });
const yamlResult = parseYamlContent(content, { variables });
const propsResult = parsePropertiesContent(content, { variables });
```

### File Parsing

```typescript
import { parseFile, parseFileSync } from '@auriclabs/tomlette';

// Async
const result = await parseFile('config.toml', { variables });

// Sync
const result = parseFileSync('config.toml', { variables });
```

### Supported Formats

#### TOML
```toml
[section]
key = "value"
array = [1, 2, 3]
multiline = """
This is a multiline
string in TOML
"""
```

#### YAML
```yaml
section:
  key: value
  array:
    - 1
    - 2
    - 3
  multiline: |
    This is a multiline
    string in YAML
```

#### Properties
```properties
section.key=value
section.array[]=item1
section.array[]=item2
section.multiline=This is a multiline string
```

### Variable Syntaxes

Tomlette supports three variable syntax formats:

1. **`${variable}`** - Standard format
2. **`$variable`** - Simple format (no spaces in variable names)
3. **`{{variable}}`** - Template format

```typescript
const variables = { user: { name: 'John' }, api: { url: 'https://api.com' } };

// All of these work:
'${user.name}'        // → 'John'
'$user.name'          // → 'John'
'{{user.name}}'       // → 'John'

// Mixed interpolation:
'Hello ${user.name}, API: ${api.url}'  // → 'Hello John, API: https://api.com'
```

### Type Inference

Tomlette automatically infers types like JSON5:

```typescript
// Numbers
'123'        // → 123
'123.45'     // → 123.45
'1e5'        // → 100000

// Booleans
'true'       // → true
'false'      // → false

// Null/Undefined
'null'       // → null
'undefined'  // → undefined

// Arrays
'[1, 2, 3]'           // → [1, 2, 3]
'["a", "b", "c"]'     // → ['a', 'b', 'c']

// Objects
'{key: value}'        // → { key: 'value' }
'{a: 1, b: 2}'       // → { a: 1, b: 2 }

// Quoted strings
'"hello"'            // → 'hello'
"'world'"            // → 'world'
```

### API Reference

#### `parse(content, options?)`

Parse content string with optional configuration.

**Parameters:**
- `content: string` - The content to parse
- `options: ParseOptions` - Optional configuration

**Returns:** `ParseResult`

#### `parseFile(filePath, options?)`

Parse content from a file (async).

**Parameters:**
- `filePath: string` - Path to the file
- `options: ParseOptions` - Optional configuration

**Returns:** `Promise<ParseResult>`

#### `parseFileSync(filePath, options?)`

Parse content from a file (sync).

**Parameters:**
- `filePath: string` - Path to the file
- `options: ParseOptions` - Optional configuration

**Returns:** `ParseResult`

#### `ParseOptions`

```typescript
interface ParseOptions {
  variables?: Record<string, unknown>;  // Variables for substitution
  lenient?: boolean;                   // Use lenient parsing (true by default)
  logger?: {                           // Logger for debugging
    debug: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}
```

#### `ParseResult`

```typescript
interface ParseResult {
  data: Record<string, unknown>;  // Parsed data
  warnings: string[];            // Any warnings encountered
}
```

## Error Handling

Tomlette provides detailed error information:

```typescript
import { TomletteParseError } from '@auriclabs/tomlette';

try {
  const result = parse(invalidContent);
} catch (error) {
  if (error instanceof TomletteParseError) {
    console.log(error.format);    // The format being parsed
    console.log(error.line);      // Line number (if available)
    console.log(error.column);    // Column number (if available)
  }
}
```

## License

ISC
