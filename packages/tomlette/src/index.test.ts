import { describe, it, expect } from 'vitest';
import { parse, detectFormat, inferType, resolveVariables } from '../src/index.js';

describe('Tomlette Parser', () => {
  describe('detectFormat', () => {
    it('should detect TOML format', () => {
      const tomlContent = `
[section]
key = "value"
array = [1, 2, 3]
      `.trim();
      
      expect(detectFormat(tomlContent)).toBe('toml');
    });

    it('should detect YAML format', () => {
      const yamlContent = `
section:
  key: value
  array:
    - 1
    - 2
    - 3
      `.trim();
      
      expect(detectFormat(yamlContent)).toBe('yaml');
    });

    it('should detect Properties format', () => {
      const propsContent = `
key=value
section.key=value
array[]=item1
array[]=item2
      `.trim();
      
      expect(detectFormat(propsContent)).toBe('properties');
    });
  });

  describe('inferType', () => {
    it('should infer numbers', () => {
      expect(inferType('123')).toBe(123);
      expect(inferType('123.45')).toBe(123.45);
      expect(inferType('1e5')).toBe(100000);
    });

    it('should infer booleans', () => {
      expect(inferType('true')).toBe(true);
      expect(inferType('false')).toBe(false);
    });

    it('should infer null/undefined', () => {
      expect(inferType('null')).toBe(null);
      expect(inferType('undefined')).toBe(undefined);
    });

    it('should infer arrays', () => {
      expect(inferType('[1, 2, 3]')).toEqual([1, 2, 3]);
      expect(inferType('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
      expect(inferType('[]')).toEqual([]);
    });

    it('should infer objects', () => {
      expect(inferType('{key: value}')).toEqual({ key: 'value' });
      expect(inferType('{a: 1, b: 2}')).toEqual({ a: 1, b: 2 });
      expect(inferType('{}')).toEqual({});
    });

    it('should handle quoted strings', () => {
      expect(inferType('"hello"')).toBe('hello');
      expect(inferType("'world'")).toBe('world');
    });

    it('should return strings as-is', () => {
      expect(inferType('hello')).toBe('hello');
      expect(inferType('123abc')).toBe('123abc');
    });
  });

  describe('resolveVariables', () => {
    const variables = {
      user: { name: 'John', age: 30 },
      config: { debug: true },
      api: { url: 'https://api.example.com' },
    };

    it('should resolve ${} syntax', () => {
      expect(resolveVariables('${user.name}', variables)).toBe('John');
      expect(resolveVariables('${user.age}', variables)).toBe(30);
    });

    it('should resolve $ syntax', () => {
      expect(resolveVariables('$user.name', variables)).toBe('John');
      expect(resolveVariables('$config.debug', variables)).toBe(true);
    });

    it('should resolve {{}} syntax', () => {
      expect(resolveVariables('{{user.name}}', variables)).toBe('John');
      expect(resolveVariables('{{api.url}}', variables)).toBe('https://api.example.com');
    });

    it('should interpolate multiple variables', () => {
      expect(resolveVariables('Hello ${user.name}, you are ${user.age} years old', variables))
        .toBe('Hello John, you are 30 years old');
    });

    it('should handle arrays with variables', () => {
      expect(resolveVariables('[${user.name}, ${user.age}]', variables))
        .toEqual(['John', 30]);
    });

    it('should throw error for undefined variables', () => {
      expect(() => resolveVariables('${nonexistent.key}', variables))
        .toThrow('Variable nonexistent.key not found in variables');
    });
  });

  describe('parse TOML', () => {
    it('should parse basic TOML', () => {
      const tomlContent = `
[user]
name = "John"
age = 30
active = true

[config]
debug = false
timeout = 5000
      `.trim();

      const result = parse(tomlContent, { format: 'toml' });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
          active: true,
        },
        config: {
          debug: false,
          timeout: 5000,
        },
      });
    });

    it('should parse TOML with variables', () => {
      const tomlContent = `
[user]
name = "${user.name}"
age = ${user.age}

[config]
debug = ${config.debug}
      `.trim();

      const variables = {
        user: { name: 'John', age: 30 },
        config: { debug: true },
      };

      const result = parse(tomlContent, { format: 'toml', variables });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
        config: {
          debug: true,
        },
      });
    });
  });

  describe('parse YAML', () => {
    it('should parse basic YAML', () => {
      const yamlContent = `
user:
  name: John
  age: 30
  active: true

config:
  debug: false
  timeout: 5000
      `.trim();

      const result = parse(yamlContent, { format: 'yaml' });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
          active: true,
        },
        config: {
          debug: false,
          timeout: 5000,
        },
      });
    });

    it('should parse YAML with variables', () => {
      const yamlContent = `
user:
  name: "${user.name}"
  age: ${user.age}

config:
  debug: ${config.debug}
      `.trim();

      const variables = {
        user: { name: 'John', age: 30 },
        config: { debug: true },
      };

      const result = parse(yamlContent, { format: 'yaml', variables });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
        config: {
          debug: true,
        },
      });
    });
  });

  describe('parse Properties', () => {
    it('should parse basic Properties', () => {
      const propsContent = `
user.name=John
user.age=30
user.active=true
config.debug=false
config.timeout=5000
      `.trim();

      const result = parse(propsContent, { format: 'properties' });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
          active: true,
        },
        config: {
          debug: false,
          timeout: 5000,
        },
      });
    });

    it('should parse Properties with arrays', () => {
      const propsContent = `
users[]=John
users[]=Jane
users[]=Bob
      `.trim();

      const result = parse(propsContent, { format: 'properties' });
      
      expect(result.data).toEqual({
        users: ['John', 'Jane', 'Bob'],
      });
    });

    it('should parse Properties with variables', () => {
      const propsContent = `
user.name=${user.name}
user.age=${user.age}
config.debug=${config.debug}
      `.trim();

      const variables = {
        user: { name: 'John', age: 30 },
        config: { debug: true },
      };

      const result = parse(propsContent, { format: 'properties', variables });
      
      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
        config: {
          debug: true,
        },
      });
    });
  });

  describe('mixed syntax parsing', () => {
    it('should parse mixed TOML and YAML content', () => {
      const mixedContent = `
# TOML section
[database]
host = "localhost"
port = 5432
name = "myapp"

# YAML section
api:
  version: "v1"
  timeout: 5000
  endpoints:
    - /users
    - /posts
      `.trim();

      const result = parse(mixedContent);
      
      expect(result.data).toEqual({
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp',
        },
        api: {
          version: 'v1',
          timeout: 5000,
          endpoints: ['/users', '/posts'],
        },
      });
    });

    it('should parse mixed Properties and TOML content', () => {
      const mixedContent = `
# Properties section
app.name=MyApp
app.version=1.0.0
app.debug=true

# TOML section
[server]
host = "0.0.0.0"
port = 3000
ssl = true
      `.trim();

      const result = parse(mixedContent);
      
      expect(result.data).toEqual({
        app: {
          name: 'MyApp',
          version: '1.0.0',
          debug: true,
        },
        server: {
          host: '0.0.0.0',
          port: 3000,
          ssl: true,
        },
      });
    });

    it('should parse mixed content with variables', () => {
      const mixedContent = `
# Properties section
app.name=${app.name}
app.version=${app.version}

# YAML section
database:
  host: ${db.host}
  port: ${db.port}
  name: ${db.name}

# TOML section
[redis]
host = "${redis.host}"
port = ${redis.port}
password = "${redis.password}"
      `.trim();

      const variables = {
        app: { name: 'MyApp', version: '1.0.0' },
        db: { host: 'localhost', port: 5432, name: 'myapp' },
        redis: { host: 'redis.example.com', port: 6379, password: 'secret123' },
      };

      const result = parse(mixedContent, { variables });
      
      expect(result.data).toEqual({
        app: {
          name: 'MyApp',
          version: '1.0.0',
        },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp',
        },
        redis: {
          host: 'redis.example.com',
          port: 6379,
          password: 'secret123',
        },
      });
    });

    it('should handle Properties arrays in mixed content', () => {
      const mixedContent = `
# Properties arrays
users[]=John
users[]=Jane
users[]=Bob

# TOML section
[config]
debug = true
timeout = 5000
      `.trim();

      const result = parse(mixedContent);
      
      expect(result.data).toEqual({
        users: ['John', 'Jane', 'Bob'],
        config: {
          debug: true,
          timeout: 5000,
        },
      });
    });
  });

  describe('auto-detection', () => {
    it('should auto-detect and parse TOML', () => {
      const content = `
[section]
key = "value"
      `.trim();

      const result = parse(content);
      expect(result.format).toBe('auto');
    });

    it('should auto-detect and parse YAML', () => {
      const content = `
section:
  key: value
      `.trim();

      const result = parse(content);
      expect(result.format).toBe('auto');
    });

    it('should auto-detect and parse Properties', () => {
      const content = `
key=value
      `.trim();

      const result = parse(content);
      expect(result.format).toBe('auto');
    });
  });
});
