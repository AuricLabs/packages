import fs from 'fs';
import path from 'path';

import { vol } from 'memfs';
import { describe, expect, beforeEach, vi, test } from 'vitest';

// We use path indirectly through the constructProperties function
import { constructProperties } from './construct-properties.js';

describe('constructProperties', () => {
  // Helper to add a file to the virtual system
  function addFile(filePath: string, content: string) {
    const basepath = path.dirname(filePath);
    if (!fs.existsSync(basepath)) {
      fs.mkdirSync(basepath, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }

  beforeEach(() => {
    // Reset all mocks
    vi.restoreAllMocks();
    vol.reset();
  });

  test('should return empty object when no property files exist', () => {
    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({});
  });

  test('should load properties from a folder.properties file', () => {
    // Add a folder.properties file
    addFile('/base/folder.properties', 'test.key=value\ntest.number=123');

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      test: {
        key: 'value',
        number: 123,
      },
    });
  });

  test('should load properties from index.properties files', () => {
    // Add an index.properties file in the folder
    addFile('/base/folder/index.properties', 'app.name=MyApp\napp.version=1.0.0');

    const result = constructProperties('/base', 'folder/subfolder/file.ts', {});
    expect(result).toStrictEqual({
      app: {
        name: 'MyApp',
        version: '1.0.0',
      },
    });
  });

  test('should load properties from file-specific properties file', () => {
    // Add a file-specific properties file
    addFile('/base/folder/file.properties', 'handler.type=lambda\nhandler.timeout=30');

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      handler: {
        type: 'lambda',
        timeout: 30,
      },
    });
  });

  test('should override properties from deeper levels', () => {
    // Add properties files at multiple levels
    addFile('/base/folder.properties', 'api.version=1.0.0\napi.url=https://example.com');
    addFile('/base/folder/index.properties', 'api.version=2.0.0\napi.env=dev');
    addFile('/base/folder/subfolder/file.properties', 'api.url=https://api.dev.example.com');

    const result = constructProperties('/base', 'folder/subfolder/file.ts', {});
    expect(result).toStrictEqual({
      api: {
        version: '2.0.0', // Overridden by folder/index.properties
        url: 'https://api.dev.example.com', // Overridden by file.properties
        env: 'dev', // Added by folder/index.properties
      },
    });
  });

  test('should substitute variables from variables', () => {
    // Add a file with variable references
    addFile('/base/folder.properties', 'cognito.userPoolId=${userPool.id}\napp.region=${region}');

    const variables = {
      userPool: {
        id: 'us-east-1_abc123',
      },
      region: 'us-east-1',
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      cognito: {
        userPoolId: 'us-east-1_abc123',
      },
      app: {
        region: 'us-east-1',
      },
    });
  });

  test('should throw error if variable not found', () => {
    addFile('/base/folder.properties', 'db.url=${database.url}\napi.key=${api.secretKey}');

    const variables = {
      api: {
        // No secretKey defined
      },
    };

    expect(() => constructProperties('/base', 'folder/file.ts', variables)).toThrow();
  });

  test('should handle complex nested properties', () => {
    // Add different property files at multiple levels
    addFile('/base/folder.properties', 'app.name=MyAPI\napp.env=dev');
    addFile('/base/folder/api/index.properties', 'api.version=1.0.0\napi.timeout=30000');
    addFile(
      '/base/folder/api/users/index.properties',
      'users.tableName=UsersTable\nusers.indexes.primary=id',
    );
    addFile(
      '/base/folder/api/users/handler.properties',
      'handler.method=GET\nhandler.path=/users\nusers.fullTableName=dev_UsersTable',
    );

    // Set up property variables
    const variables = {
      dynamoDB: {
        tablePrefix: 'dev_',
      },
    };

    const result = constructProperties('/base', 'folder/api/users/handler.ts', variables);

    expect(result).toStrictEqual({
      app: {
        name: 'MyAPI',
        env: 'dev',
      },
      api: {
        version: '1.0.0',
        timeout: 30000,
      },
      users: {
        tableName: 'UsersTable',
        indexes: {
          primary: 'id',
        },
        fullTableName: 'dev_UsersTable',
      },
      handler: {
        method: 'GET',
        path: '/users',
      },
    });
  });

  test('should handle comments and empty lines in property files', () => {
    const fileContent = `
      # This is a comment
      app.name=MyApp

      # Another comment
      app.version=1.0.0

      # Empty lines should be ignored
    `;

    addFile('/base/config.properties', fileContent);

    const result = constructProperties('/base', 'config/app.ts', {});
    expect(result).toStrictEqual({
      app: {
        name: 'MyApp',
        version: '1.0.0',
      },
    });
  });

  test('should substitute multiple variables within a single string', () => {
    // Add a file with multiple variable references in single strings
    addFile(
      '/base/folder.properties',
      'api.url=https://${env}.${region}.example.com\napp.description=${app.name} v${app.version}',
    );

    const variables = {
      env: 'dev',
      region: 'us-east-1',
      app: {
        name: 'MyAPI',
        version: '2.0.0',
      },
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      api: {
        url: 'https://dev.us-east-1.example.com',
      },
      app: {
        description: 'MyAPI v2.0.0',
      },
    });
  });

  test('should handle null and undefined values in properties files', () => {
    // Test handling of "null" and "undefined" values
    addFile(
      '/base/folder.properties',
      'prop.null=null\nprop.defined=value\nprop.undefined=undefined\nprop.empty=',
    );

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      prop: {
        null: null,
        defined: 'value',
        empty: '',
      },
      // The "undefined" property should be unset completely
    });

    // Verify that undefined property is completely unset
    expect(result.prop).not.toHaveProperty('undefined');
  });

  test('should handle non-string values in properties', () => {
    addFile(
      '/base/folder/file.properties',
      'test.number=123\ntest.boolean=true\ntest.object={key:value}',
    );
    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      test: {
        number: 123,
        boolean: true,
        object: '{key:value}',
      },
    });
  });

  test('should throw error when variable evaluation fails', () => {
    // Test the error handling in resolveVariable
    addFile('/base/folder.properties', 'test.invalid=${invalid.syntax..}');

    const variables = { invalid: {} };

    expect(() => constructProperties('/base', 'folder/file.ts', variables)).toThrow(
      /Error evaluating/,
    );
  });

  test('should properly interpolate with $interpolate function', () => {
    // Test the $interpolate function specifically
    addFile('/base/folder.properties', 'message=Hello ${name}! Your ID is ${id}');

    // Use vi.spyOn to mock the global $interpolate function
    const interpolateSpy = vi
      .spyOn(global as unknown as { $interpolate: typeof $interpolate }, '$interpolate')
      .mockImplementation((_strings: Parameters<typeof $interpolate>[0], ...values: string[]) => {
        return `Hello ${values[0]}! Your ID is ${values[1]}` as unknown as $util.Output<string>;
      });

    const variables = {
      name: 'John',
      id: 12345,
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      message: 'Hello John! Your ID is 12345',
    });
    expect(interpolateSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['Hello ', '! Your ID is ', '']),
      'John',
      12345,
    );

    interpolateSpy.mockRestore();
  });

  test('should parse array syntax with simple values', () => {
    // Test basic array parsing
    addFile('/base/folder.properties', 'array=[hello,world,test]');

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      array: ['hello', 'world', 'test'],
    });
  });

  test('should parse empty array', () => {
    addFile('/base/folder.properties', 'emptyArray=[]');

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      emptyArray: [],
    });
  });

  test('should parse array with variable substitution', () => {
    addFile('/base/folder.properties', 'array=[hello,world,${value}]');

    const variables = {
      value: 'test',
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      array: ['hello', 'world', 'test'],
    });
  });

  test('should parse array with multiple variables', () => {
    addFile('/base/folder.properties', 'array=[${prefix},middle,${suffix}]');

    const variables = {
      prefix: 'start',
      suffix: 'end',
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      array: ['start', 'middle', 'end'],
    });
  });

  test('should parse array with object references', () => {
    addFile('/base/folder.properties', 'array=[${user},${admin}]');

    const variables = {
      user: { name: 'Alice', role: 'user' },
      admin: { name: 'Bob', role: 'admin' },
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      array: [
        { name: 'Alice', role: 'user' },
        { name: 'Bob', role: 'admin' },
      ],
    });
  });

  test('should parse array with mixed literals and variables', () => {
    addFile('/base/folder.properties', 'array=[${env},prod,${region}]');

    const variables = {
      env: 'dev',
      region: 'us-east-1',
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      array: ['dev', 'prod', 'us-east-1'],
    });
  });

  test('should parse array with nested variable references', () => {
    addFile('/base/folder.properties', 'array=[${config.name},${config.version}]');

    const variables = {
      config: {
        name: 'MyApp',
        version: '1.0.0',
      },
    };

    const result = constructProperties('/base', 'folder/file.ts', variables);
    expect(result).toStrictEqual({
      array: ['MyApp', '1.0.0'],
    });
  });

  test('should handle array with spaces around elements', () => {
    addFile('/base/folder.properties', 'array=[ hello , world , test ]');

    const result = constructProperties('/base', 'folder/file.ts', {});
    expect(result).toStrictEqual({
      array: ['hello', 'world', 'test'],
    });
  });

  test('should throw error for undefined variable in array', () => {
    addFile('/base/folder.properties', 'array=[hello,${undefinedVar},world]');

    const variables = {};

    expect(() => constructProperties('/base', 'folder/file.ts', variables)).toThrow(
      'Property undefinedVar not found in variables',
    );
  });
});
