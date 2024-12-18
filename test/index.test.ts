jest.mock('fs', () => ({
  ...jest.requireActual('fs'), // Keep the actual `fs` methods
  existsSync: jest.fn(), // Mock `existsSync`
  promises: {
    ...jest.requireActual('fs').promises,
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(), // Mock `access` method in `fs.promises`
  },
}));

import path, { join } from 'path';
import { Config, ConfigError } from '../src/index';
import * as fs from 'fs';

describe('Config', () => {
  describe('resolveSync', () => {
    const cwd = jest.spyOn(process, 'cwd');
    const existSync = jest.spyOn(fs, 'existsSync');

    afterEach(() => {
      jest.clearAllMocks();
      (Config as any).root = undefined; // Reset cache
    });

    test('should return the root directory if node_modules is found', () => {
      cwd.mockReturnValue('/mock/root/project');
      existSync
        .mockImplementationOnce(() => false) // First directory, no node_modules
        .mockImplementationOnce(() => true); // Second directory, node_modules found

      expect(Config.resolveSync()).toBe('/mock/root');
      expect(existSync).toHaveBeenCalledTimes(2);

      // Should cache the root
      expect(Config.resolveSync()).toBe('/mock/root'); // Same
      expect(existSync).toHaveBeenCalledTimes(2); // Never executed again
    });

    test('should throw ConfigError if no node_modules is found', () => {
      cwd.mockReturnValue('/mock/root');
      existSync.mockReturnValue(false);

      expect(() => Config.resolveSync()).toThrow(ConfigError);
      expect(existSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolve', () => {
    const cwd = jest.spyOn(process, 'cwd');
    const access = jest.spyOn(fs.promises, 'access');

    afterEach(() => {
      jest.clearAllMocks();
      (Config as any).root = undefined; // Reset cache
    });

    test('should resolve the root directory if node_modules is found', async () => {
      cwd.mockReturnValue('/mock/root/project');

      access
        .mockRejectedValueOnce(new Error()) // First directory, no node_modules
        .mockResolvedValueOnce(); // Second directory, node_modules found

      await expect(Config.resolve()).resolves.toBe('/mock/root');
      expect(access).toHaveBeenCalledTimes(2);

      // Should cache the root
      expect(Config.resolve()).resolves.toBe('/mock/root'); // Same
      expect(access).toHaveBeenCalledTimes(2); // Never executed again
    });

    test('should reject with ConfigError if no node_modules is found', async () => {
      cwd.mockReturnValue('/mock/root');

      access.mockRejectedValue(new Error());

      await expect(Config.resolve()).rejects.toThrow(ConfigError);
      expect(access).toHaveBeenCalledTimes(2);
    });
  });

  describe('exist', () => {
    const access = jest.spyOn(fs.promises, 'access');

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should resolve if path exists', async () => {
      access.mockResolvedValueOnce(undefined); // Simulate path exists

      await expect(Config.exist('/valid/path')).resolves.toBeUndefined();
      expect(access).toHaveBeenCalledWith('/valid/path');
    });

    test('should reject with ConfigError if path does not exist', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // Simulate path does not exist

      await expect(Config.exist('/invalid/path')).rejects.toThrow(ConfigError);
      expect(access).toHaveBeenCalledWith('/invalid/path');
    });

    test('should reject with ConfigError if path is invalid', async () => {
      await expect(Config.exist(123 as any)).rejects.toThrow(ConfigError); // Invalid path (empty string)
    });
  });

  describe('existMany', () => {
    const access = jest.spyOn(fs.promises, 'access');

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should resolve if all paths exist', async () => {
      access.mockResolvedValueOnce(undefined); // Simulate first path exists
      access.mockResolvedValueOnce(undefined); // Simulate second path exists

      await expect(
        Config.existMany(['/valid/path1', '/valid/path2'])
      ).resolves.toBeUndefined();
      expect(access).toHaveBeenCalledTimes(2);
    });

    test('should reject with ConfigError if any path does not exist', async () => {
      access.mockResolvedValueOnce(undefined); // Simulate first path exists
      access.mockRejectedValueOnce(new Error('ENOENT')); // Simulate second path does not exist

      await expect(
        Config.existMany(['/valid/path1', '/invalid/path2'])
      ).rejects.toThrow(ConfigError);
      expect(access).toHaveBeenCalledTimes(2);
    });

    test('should reject with ConfigError if any path is invalid', async () => {
      await expect(
        Config.existMany([123 as any, '/valid/path2'])
      ).rejects.toThrow(ConfigError); // Invalid path (empty string)
    });
  });

  describe('mkdir', () => {
    const mkdir = jest.spyOn(fs.promises, 'mkdir');
    const access = jest.spyOn(fs.promises, 'access');

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should resolve if the directory already exists', async () => {
      access.mockResolvedValueOnce(undefined); // Directory exists

      await expect(
        Config.mkdir('/existing/directory')
      ).resolves.toBeUndefined();
      expect(mkdir).not.toHaveBeenCalled(); // No need to create
    });

    test('should create the directory if it does not exist', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // Directory does not exist

      mkdir.mockResolvedValueOnce(undefined); // Simulate successful mkdir

      await expect(Config.mkdir('/new/directory')).resolves.toBeUndefined();
      expect(mkdir).toHaveBeenCalledWith('/new/directory', { recursive: true });
    });

    test('should reject with ConfigError if path is invalid', async () => {
      await expect(Config.mkdir(123 as any)).rejects.toThrow(ConfigError); // Invalid path (empty string)
    });

    test('should reject with ConfigError if mkdir fails', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // Directory does not exist
      mkdir.mockRejectedValueOnce(new Error('Failed to create directory')); // mkdir fails

      await expect(Config.mkdir('/new/directory')).rejects.toThrow(ConfigError);
      expect(mkdir).toHaveBeenCalledWith('/new/directory', { recursive: true });
    });
  });

  describe('mkfile', () => {
    const writeFile = jest.spyOn(fs.promises, 'writeFile');
    const access = jest.spyOn(fs.promises, 'access');
    const mkdir = jest.spyOn(fs.promises, 'mkdir');
    const dirname = jest.spyOn(path, 'dirname');

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should resolve if the file already exists', async () => {
      access.mockResolvedValueOnce(undefined); // File exists

      await expect(
        Config.mkfile('/existing/file.txt')
      ).resolves.toBeUndefined();
      expect(mkdir).not.toHaveBeenCalled(); // No need to create directory
      expect(writeFile).not.toHaveBeenCalled(); // No need to write file
    });

    test('should create the file and directories if they do not exist', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // File does not exist
      mkdir.mockResolvedValueOnce(undefined); // Directory creation success
      writeFile.mockResolvedValueOnce(undefined); // File write success

      await expect(
        Config.mkfile('/new/file.txt', 'content')
      ).resolves.toBeUndefined();
      expect(mkdir).toHaveBeenCalledWith('/new', { recursive: true }); // Ensure directory exists
      expect(writeFile).toHaveBeenCalledWith('/new/file.txt', 'content'); // Write the file
    });

    test('should reject with ConfigError if path is invalid', async () => {
      await expect(Config.mkfile(123 as any, 'content')).rejects.toThrow(
        ConfigError
      ); // Invalid path
    });

    test('should reject with ConfigError if content is invalid', async () => {
      await expect(Config.mkfile('/new/file.txt', 123 as any)).rejects.toThrow(
        ConfigError
      ); // Invalid content
    });

    test('should reject with ConfigError if file creation fails', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // File does not exist
      mkdir.mockResolvedValueOnce(undefined); // Directory creation success
      writeFile.mockRejectedValueOnce(new Error('Failed to create file')); // File write failure

      await expect(Config.mkfile('/new/file.txt', 'content')).rejects.toThrow(
        ConfigError
      );
    });

    test('should reject with ConfigError if dir creation fails', async () => {
      access.mockRejectedValueOnce(new Error('ENOENT')); // File does not exist
      mkdir.mockRejectedValueOnce(new Error('Failed to create dir')); // Directory creation success

      await expect(Config.mkfile('/new/file.txt', 'content')).rejects.toThrow(
        ConfigError
      );
    });
  });

  describe('register', () => {
    afterEach(() => {
      // Clear the validators array after each test
      (Config as any).validators = [];
    });

    test('should register a valid validator', () => {
      const validator = jest.fn((config) => ({ ...config, validated: true }));

      Config.register(validator);

      // Ensure that the validator has been added to the validators array
      expect((Config as any).validators).toHaveLength(1);
      expect((Config as any).validators[0]).toBe(validator);
    });

    test('should throw ConfigError if the validator is not a function', () => {
      expect(() => Config.register('invalidValidator' as any)).toThrow(
        ConfigError
      );

      expect(() => Config.register('invalidValidator' as any)).toThrow(
        'Invalid validator: invalidValidator'
      );
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      // Reset validators for each test to ensure clean state
      (Config as any).validators = [];
    });

    test('should apply all registered validators to the config', () => {
      const validator1 = jest.fn((config) => ({ ...config, step1: true }));
      const validator2 = jest.fn((config) => ({ ...config, step2: true }));

      Config.register(validator1);
      Config.register(validator2);

      const config = { initial: true };
      const validatedConfig = Config.validate(config);

      // Ensure validators were applied in order
      expect(validator1).toHaveBeenCalledWith(config);
      expect(validator2).toHaveBeenCalledWith({ ...config, step1: true });
      expect(validatedConfig).toEqual({
        initial: true,
        step1: true,
        step2: true,
      });
    });

    test('should throw ConfigError if validators are not properly registered', () => {
      (Config as any).validators = null; // Invalid state for validators

      const config = { initial: true };
      expect(() => Config.validate(config)).toThrow(ConfigError);
      expect(() => Config.validate(config)).toThrow('Invalid validators: null');
    });

    test('should throw ConfigError if any validator throws an error', () => {
      const validator1 = jest.fn((config) => ({ ...config, step1: true }));
      const validator2 = jest.fn(() => {
        throw new Error('Validation failed');
      });

      Config.register(validator1);
      Config.register(validator2);

      const config = { initial: true };
      expect(() => Config.validate(config)).toThrow('Validation failed');
    });
  });

  describe('loadJSON', () => {
    beforeEach(() => {
      // Reset default config and mock functions before each test
      (Config as any).default = undefined;
      jest.clearAllMocks();

      // Removes validators
      (Config as any).validators = undefined;
    });

    test('should load JSON file successfully', async () => {
      const mockPath = 'config.json';
      const mockConfig = { key: 'value' };

      (fs.promises.readFile as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockConfig)
      );

      Config.exist = jest.fn().mockResolvedValueOnce(undefined);

      const config = await Config.loadJSON(mockPath);

      expect(fs.promises.readFile).toHaveBeenCalledWith(mockPath, 'utf-8');
      expect(config).toEqual(mockConfig);
    });

    test('should resolve with default config if file does not exist', async () => {
      const mockPath = 'config.json';
      const defaultConfig = { defaultKey: 'defaultValue' };
      (Config as any).default = defaultConfig;

      Config.exist = jest
        .fn()
        .mockRejectedValueOnce(new Error('File does not exist'));

      const config = await Config.loadJSON(mockPath);

      expect(config).toEqual(defaultConfig);
    });

    test('should reject with ConfigError if path is invalid', async () => {
      await expect(Config.loadJSON(123 as any)).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if the file extension is not .json', async () => {
      await expect(Config.loadJSON('config.txt')).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if reading the JSON file fails', async () => {
      const mockPath = 'config.json';
      (fs.promises.readFile as jest.Mock).mockRejectedValueOnce(
        new Error('Error reading file')
      );

      Config.exist = jest.fn().mockResolvedValueOnce(undefined);

      await expect(Config.loadJSON(mockPath)).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if no default config found', async () => {
      const mockPath = 'config.json';

      Config.exist = jest
        .fn()
        .mockRejectedValueOnce(new Error('File does not exist'));

      await expect(Config.loadJSON(mockPath)).rejects.toThrow(ConfigError);
    });
  });

  describe('loadJS', () => {
    beforeEach(() => {
      // Reset default config and mock functions before each test
      (Config as any).default = undefined;
      jest.clearAllMocks();

      // Removes validators
      (Config as any).validators = undefined;
    });

    test('should load JS file successfully', async () => {
      const mockPath = 'config.js';
      const mockConfig = { key: 'value' };

      // Use jest.mock to simulate the module loading for the mock path
      jest.doMock(mockPath, () => mockConfig, { virtual: true });

      Config.exist = jest.fn().mockResolvedValueOnce(undefined);

      const config = await Config.loadJS(mockPath);

      expect(config).toEqual(mockConfig);
    });

    test('should resolve with default config if JS file does not exist', async () => {
      const mockPath = 'config.js';
      const defaultConfig = { defaultKey: 'defaultValue' };
      (Config as any).default = defaultConfig;

      Config.exist = jest
        .fn()
        .mockRejectedValueOnce(new Error('File does not exist'));

      const config = await Config.loadJS(mockPath);

      expect(config).toEqual(defaultConfig);
    });

    test('should reject with ConfigError if path is invalid', async () => {
      await expect(Config.loadJS(123 as any)).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if the file extension is not .js', async () => {
      await expect(Config.loadJS('config.json')).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if requiring the JS file fails', async () => {
      const mockPath = 'my/config.js';

      // Simulate throwing an error while requiring the file
      jest.doMock(
        mockPath,
        () => {
          throw new Error('Error requiring file');
        },
        { virtual: true }
      );

      Config.exist = jest.fn().mockResolvedValueOnce(undefined);

      await expect(Config.loadJS(mockPath)).rejects.toThrow(ConfigError);
    });

    test('should reject with ConfigError if no default config found', async () => {
      const mockPath = 'config.js';

      Config.exist = jest
        .fn()
        .mockRejectedValueOnce(new Error('File does not exist'));

      expect(Config.loadJS(mockPath)).rejects.toThrow(ConfigError);
    });
  });

  describe('reload', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (Config as any).loaded = undefined; // Reset loaded file path
    });

    test('should reload JS config successfully', async () => {
      const mockPath = 'config.js';
      const mockConfig = { key: 'value' };
      (Config as any).loaded = mockPath;

      // Mocking the loadJS method using jest.fn()
      Config.loadJS = jest.fn().mockResolvedValue(mockConfig);

      const config = await Config.reload<typeof mockConfig>();

      expect(config).toEqual(mockConfig);
      expect(Config.loadJS).toHaveBeenCalledWith(mockPath);
    });

    test('should reload JSON config successfully', async () => {
      const mockPath = 'config.json';
      const mockConfig = { key: 'value' };
      (Config as any).loaded = mockPath;

      // Mocking the loadJSON method using jest.fn()
      Config.loadJSON = jest.fn().mockResolvedValue(mockConfig);

      const config = await Config.reload<typeof mockConfig>();

      expect(config).toEqual(mockConfig);
      expect(Config.loadJSON).toHaveBeenCalledWith(mockPath);
    });

    test('should reject with ConfigError if no file is loaded', async () => {
      (Config as any).loaded = undefined;

      await expect(Config.reload()).rejects.toThrow(ConfigError);
      await expect(Config.reload()).rejects.toThrow('Nothing to reload');
    });

    test('should reject with ConfigError if file extension is unsupported', async () => {
      const mockPath = 'config.txt';
      (Config as any).loaded = mockPath;

      await expect(Config.reload()).rejects.toThrow(ConfigError);
      await expect(Config.reload()).rejects.toThrow(
        'Unsupported config file extention: .txt'
      );
    });
  });

  describe('load', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (Config as any).config = undefined; // Reset the cached config
    });

    test('should return cached config if already loaded', async () => {
      const mockConfig = { key: 'cached' };
      (Config as any).config = mockConfig;

      const config = await Config.load<typeof mockConfig>();

      expect(config).toEqual(mockConfig);
      expect(Config.loadJS).not.toHaveBeenCalled();
      expect(Config.loadJSON).not.toHaveBeenCalled();
    });

    test('should load JS config successfully', async () => {
      const mockPath = 'config.js';
      const mockConfig = { key: 'value' };
      (Config as any).file = mockPath;

      // Mocking the loadJS method using jest.fn()
      Config.loadJS = jest.fn().mockResolvedValue(mockConfig);
      Config.resolveSync = jest.fn().mockReturnValue('root');

      const config = await Config.load<typeof mockConfig>();

      expect(config).toEqual(mockConfig);
      expect(Config.loadJS).toHaveBeenCalledWith(join('root', mockPath));
    });

    test('should load JSON config successfully', async () => {
      const mockPath = 'config.json';
      const mockConfig = { key: 'value' };
      (Config as any).file = mockPath;

      // Mocking the loadJSON method using jest.fn()
      Config.loadJSON = jest.fn().mockResolvedValue(mockConfig);
      Config.resolveSync = jest.fn().mockReturnValue('root');

      const config = await Config.load<typeof mockConfig>();

      expect(config).toEqual(mockConfig);
      expect(Config.loadJSON).toHaveBeenCalledWith(join('root', mockPath));
    });

    test('should reject with ConfigError if file extension is unsupported', async () => {
      const mockPath = 'config.txt';
      (Config as any).file = mockPath;

      await expect(Config.load()).rejects.toThrow(ConfigError);
      await expect(Config.load()).rejects.toThrow(
        'Unsupported config file extention: .txt'
      );
    });
  });
});
