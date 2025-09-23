import fs from 'fs';

// We use path indirectly through the constructProperties function
import { constructProperties } from '../construct-properties';

// Mock fs module
jest.mock('fs');

describe('constructProperties', () => {
  // Set up mocks
  const mockFs = fs as jest.Mocked<typeof fs>;

  // Virtual file system for tests
  const virtualFileSystem: Record<string, string> = {};

  // Helper to add a file to the virtual system
  function addFile(filePath: string, content: string) {
    virtualFileSystem[filePath] = content;
  }

  beforeEach(() => {
    // Clear virtual file system
    Object.keys(virtualFileSystem).forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete virtualFileSystem[key];
    });

    // Reset all mocks
    jest.restoreAllMocks();

    // Mock implementations
    mockFs.existsSync.mockImplementation((filePath) => {
      return filePath.toString() in virtualFileSystem;
    });

    mockFs.readFileSync.mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath in virtualFileSystem) {
        return virtualFileSystem[filePath];
      }
      throw new Error(`File not found: ${filePath.toString()}`);
    });
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

  test('should substitute variables from propertyVariables', () => {
    // Add a file with variable references
    addFile('/base/folder.properties', 'cognito.userPoolId=${userPool.id}\napp.region=${region}');

    const propertyVariables = {
      userPool: {
        id: 'us-east-1_abc123',
      },
      region: 'us-east-1',
    };

    const result = constructProperties('/base', 'folder/file.ts', propertyVariables);
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

    const propertyVariables = {
      api: {
        // No secretKey defined
      },
    };

    expect(() => constructProperties('/base', 'folder/file.ts', propertyVariables)).toThrow();
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
    const propertyVariables = {
      dynamoDB: {
        tablePrefix: 'dev_',
      },
    };

    const result = constructProperties('/base', 'folder/api/users/handler.ts', propertyVariables);

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

    const propertyVariables = {
      env: 'dev',
      region: 'us-east-1',
      app: {
        name: 'MyAPI',
        version: '2.0.0',
      },
    };

    const result = constructProperties('/base', 'folder/file.ts', propertyVariables);
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

    const propertyVariables = { invalid: {} };

    expect(() => constructProperties('/base', 'folder/file.ts', propertyVariables)).toThrow(
      /Error evaluating/,
    );
  });

  test('should properly interpolate with $interpolate function', () => {
    // Test the $interpolate function specifically
    addFile('/base/folder.properties', 'message=Hello ${name}! Your ID is ${id}');

    // Use jest.spyOn to mock the global $interpolate function
    const interpolateSpy = jest
      .spyOn(global as unknown as { $interpolate: typeof $interpolate }, '$interpolate')
      .mockImplementation((strings: Parameters<typeof $interpolate>[0], ...values: string[]) => {
        return `Hello ${values[0]}! Your ID is ${values[1]}` as unknown as $util.Output<string>;
      });

    const propertyVariables = {
      name: 'John',
      id: 12345,
    };

    const result = constructProperties('/base', 'folder/file.ts', propertyVariables);
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
});
