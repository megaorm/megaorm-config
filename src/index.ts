import * as fs from 'fs';
import { dirname, extname, join, parse } from 'path';
import {
  isArr,
  isArrOfFunc,
  isArrOfStr,
  isDefined,
  isFunc,
  isStr,
  isUndefined,
} from '@megaorm/test';

/**
 * Error class for handling configuration-related errors.
 */
export class ConfigError extends Error {}

/**
 * A function type representing a validator for configuration objects.
 *
 * Each validator takes a configuration object as input, validates or modifies it,
 * and returns the modified configuration. Validators are expected to throw an
 * error if the configuration is invalid.
 *
 * @param config The configuration object to validate or modify.
 * @returns The modified configuration object.
 */
type Validator = (config: any) => any;

/**
 * A helper class for loading, managing, and validating configuration files.
 *
 * This class provides methods to load configuration files (both `.js` and `.json`)
 * from the file system.
 *
 * It supports default configurations, caching, and validation
 * through a set of registered validator functions, as well as utilities for file
 * and directory management.
 *
 * @example
 * // Extend the Config helper
 * class MegaConfig extends Config {
 *   // Set the config file name
 *   protected static file = 'mega.config.js';
 *
 *   // Provide a default configuration
 *   protected static default = {};
 * }
 *
 * // Load your config file (JS or JSON)
 * MegaConfig.load().then(config => console.log(config));
 *
 * // The `load` method:
 * // - Loads your config file once and caches it for future calls.
 * // - Executes all registered validators on the loaded configuration.
 * // - Resolves with the default configuration if the specified file is missing.
 *
 * // Register validator to ensure `config.cluster` exists and is valid
 * MegaConfig.register((config) => {
 *   if (!(config.cluster instanceof MegaCluster)) {
 *     throw new ConfigError('Invalid cluster');
 *   }
 * });
 *
 * // Register validator to ensure `config.paths` exists and is valid
 * MegaConfig.register((config) => {
 *   if (typeof config.paths !== 'object') config.paths = {};
 *   if (typeof config.paths.models !== 'string') config.paths.models = 'models';
 *   if (typeof config.paths.seeders !== 'string') config.paths.seeders = 'seeders';
 *   if (typeof config.paths.commands !== 'string') config.paths.commands = 'commands';
 *   if (typeof config.paths.generators !== 'string') config.paths.generators = 'generators';
 * });
 *
 * // Load your validated configuration
 * MegaConfig.load().then(config => console.log(config)); // Validation applied
 *
 * // Reload the previously loaded configuration
 * MegaConfig.reload(); // Refreshes the cached configuration
 *
 * // Use `loadJS` and `loadJSON` directly if needed
 * MegaConfig.loadJS(path).then(config => console.log(config));
 * MegaConfig.loadJSON(path).then(config => console.log(config));
 *
 * // Performance:
 * // - Always use the `load` method to benefit from caching.
 * // - The `loadJS` and `loadJSON`, executes I/O operations each time.
 * // - While `load` caches the configuration for better performance.
 * // - Use `reload` to refresh the cached configuration.
 *
 * // Resolve the project root synchronously
 * console.log(MegaConfig.resolveSync());
 *
 * // Resolve the project root asynchronously
 * MegaConfig.resolve().then((root) => console.log(root));
 *
 * // Ensure a file or directory exists
 * MegaConfig.exist(path).then(() => console.log('Exists'));
 *
 * // Ensure multiple files or directories exist
 * MegaConfig.existMany(paths).then(() => console.log('All exist'));
 *
 * // Create a directory if it does not exist
 * MegaConfig.mkdir(path).then(() => console.log('Directory created'));
 *
 * // Create a configuration file if it does not exist
 * MegaConfig.mkfile(path, content).then(() => console.log('File created'));
 *
 * // Notes:
 * // - `mkdir` creates the full directory structure if needed.
 * // - `mkfile` creates the necessary directories and writes the file.
 * // - Both methods validate paths and handle errors gracefully.
 */
export class Config {
  /**
   * Stores the configuration data once it is loaded.
   * This ensures the configuration is cached for subsequent access.
   *
   * @private
   * @static
   */
  private static config: Record<string, unknown>;

  /**
   * The default name of the config file to be loaded.
   * This file name can be overridden in subclasses.
   *
   * @protected
   * @static
   */
  protected static file: string;

  /**
   * The root directory of the project, where the config file will be searched by default.
   * This property defaults to the current working directory of the Node.js process.
   *
   * @public
   * @static
   */
  protected static root: string;

  /**
   * The path of the previously loaded config file.
   * This property keeps track of the file path that was last successfully loaded.
   *
   * @private
   * @static
   */
  private static loaded: string;

  /**
   * A collection of validator functions to validate or modify the configuration.
   * Each validator function is executed in order when the configuration is loaded or validated.
   *
   * @private
   * @static
   */
  private static validators: Array<Validator>;

  /**
   * The default configuration object.
   * This property can be overridden in subclasses to provide a custom default configuration.
   *
   * @protected
   * @static
   */
  protected static default: Record<string, unknown>;

  /**
   * Resolves the project root directory synchronously.
   *
   * This method caches the resolved root directory to avoid repeated I/O operations
   * on subsequent calls.
   *
   * @returns The path to the project root directory.
   * @throws `ConfigError` if no project root is found.
   */
  public static resolveSync() {
    if (this.root) return this.root;

    let root = process.cwd();

    while (root !== parse(root).root) {
      const nodeModules = join(root, 'node_modules');
      if (fs.existsSync(nodeModules)) return (this.root = root);
      root = dirname(root);
    }

    throw new ConfigError('Could not find project root');
  }

  /**
   * Resolves the project root directory asynchronously.
   *
   * This method caches the resolved root directory to avoid repeated I/O operations
   * on subsequent calls.
   *
   * @returns A promise that resolves to the project root directory path.
   * @throws `ConfigError` if no project root is found.
   */
  public static resolve(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.root) return resolve(this.root);

      const find = (path: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (path === parse(path).root) {
            return reject(new ConfigError('Could not find project root'));
          }

          fs.promises
            .access(join(path, 'node_modules'))
            .then(() => resolve(path))
            .catch(() => find(dirname(path)).then(resolve).catch(reject));
        });
      };

      return find(process.cwd())
        .then((root) => resolve((this.root = root)))
        .catch((error) => reject(error));
    });
  }

  /**
   * Checks if a specified path exists.
   *
   * This method tests whether a given file or directory path exists in the file system.
   * If the path is valid and accessible, the promise resolves successfully.
   *
   * @param path The path to check for existence.
   * @returns A promise that resolves to `void` if the path exists or rejects with a `ConfigError` if it doesn't.
   * @throws `ConfigError` if the path is invalid or inaccessible.
   */
  public static exist(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isStr(path)) {
        return reject(new ConfigError(`Invalid path: ${String(path)}`));
      }

      fs.promises
        .access(path)
        .then(resolve)
        .catch((error) => reject(new ConfigError(error.message)));
    });
  }

  /**
   * Checks if multiple paths exist.
   *
   * This method validates the existence of multiple file or directory paths.
   * It resolves if all paths exist or rejects if any path is missing or invalid.
   *
   * @param paths An array of paths to check for existence.
   * @returns A promise that resolves to `void` if all paths exist or rejects with a `ConfigError` if any path doesn't.
   * @throws `ConfigError` if any path is invalid or inaccessible.
   */
  public static existMany(paths: Array<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isArrOfStr(paths)) {
        return reject(new ConfigError(`Invalid paths: ${String(paths)}`));
      }

      return Promise.all(paths.map((path) => this.exist(path)))
        .then(() => resolve())
        .catch(reject);
    });
  }

  /**
   * Ensures that a directory exists, creating it if necessary.
   *
   * - If the directory already exists, the method resolves immediately.
   * - If the directory does not exist, it creates the necessary directories recursively.
   *
   * @param path The path to the directory to check or create.
   * @returns A promise that resolves when the directory exists or is created successfully.
   * @throws `ConfigError` if the path is invalid or directory creation fails.
   */
  public static mkdir(path: string): Promise<void | string> {
    return new Promise((resolve, reject) => {
      if (!isStr(path)) {
        return reject(new ConfigError(`Invalid path: ${String(path)}`));
      }

      this.exist(path)
        .then(resolve)
        .catch(() => fs.promises.mkdir(path, { recursive: true }))
        .then(resolve)
        .catch((error) => reject(new ConfigError(error.message)));
    });
  }

  /**
   * Ensures that a configuration file exists, creating it along with its directories if necessary.
   *
   * - If the file already exists, the method resolves immediately.
   * - If the file does not exist, it ensures all parent directories are created and writes the file.
   *
   * @param path The full path to the configuration file.
   * @param content The content to write if the file is created. Defaults to an empty string.
   * @returns A Promise that resolves when the file is confirmed to exist or is created successfully.
   * @throws `ConfigError` if the path is invalid or if file creation fails.
   */
  public static mkfile(path: string, content: string = ''): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isStr(path)) {
        return reject(new ConfigError(`Invalid path: ${String(path)}`));
      }

      if (!isStr(content)) {
        return reject(new ConfigError(`Invalid content: ${String(content)}`));
      }

      this.exist(path) // Ensure the file exist
        .then(resolve)
        .catch(() => this.mkdir(dirname(path))) // Ensure the directory exists
        .then(() => fs.promises.writeFile(path, content)) // Write the file
        .then(resolve)
        .catch((error) => reject(new ConfigError(error.message)));
    });
  }

  /**
   * Registers a new validator function to be applied to the config.
   *
   * The validator function is expected to either modify the config or throw an error if validation fails.
   *
   * @param validator A function that takes the current config and either modifies it or throws an error.
   * @returns The Config instance, allowing for method chaining.
   * @throws `ConfigError` if the validator is not a function.
   */
  public static register(validator: Validator): Config {
    if (!isFunc(validator)) {
      throw new ConfigError(`Invalid validator: ${String(validator)}`);
    }

    if (!isArr(this.validators)) this.validators = [];
    this.validators.push(validator);
    return this;
  }

  /**
   * Validates the config by applying all registered validators in order.
   *
   * Each validator will modify the config or throw an error. The final modified config is returned.
   *
   * @param config The configuration object to be validated and potentially modified.
   * @returns The final modified config after all validators have been applied.
   * @throws `ConfigError` if the validators are not properly registered or if any validator throws an error.
   */
  public static validate(
    config: Record<string, unknown>
  ): Record<string, unknown> {
    if (isUndefined(this.validators)) return config;

    if (!isArrOfFunc(this.validators)) {
      throw new ConfigError(`Invalid validators: ${String(this.validators)}`);
    }

    return this.validators.reduce(
      (config, validator) => validator(config),
      config
    );
  }

  /**
   * Loads a JSON config file.
   *
   * - This method reads and parses the JSON config file.
   * - If the config file does not exist this method resolves with the default configuration if provided.
   *
   * @param path The path to the JSON config file.
   * @returns A Promise that resolves with the parsed JSON configuration.
   * @throws `ConfigError` if there is an issue reading or parsing the JSON file.
   */
  public static loadJSON(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!isStr(path)) {
        return reject(new ConfigError(`Invalid path: ${String(path)}`));
      }

      if (extname(path).toLowerCase() !== '.json') {
        return reject(new ConfigError(`Invalid JSON path: ${String(path)}`));
      }

      this.exist(path)
        .then(() => {
          fs.promises
            .readFile(path, 'utf-8')
            .then((content) => {
              this.config = this.validate(JSON.parse(content));
              this.loaded = path;
              return resolve(this.config);
            })
            .catch((error) => reject(new ConfigError(error.message)));
        })
        .catch((error) => {
          // resolve with default config
          if (this.default) return resolve(this.default);

          // or reject
          reject(new ConfigError(error.message));
        });
    });
  }

  /**
   * Loads a JavaScript config file.
   *
   * - This method loads the JavaScript config file using `require()`.
   * - If the config file does not exist this method resolves with the default configuration if provided.
   *
   * @param path The path to the JavaScript config file.
   * @returns A Promise that resolves with the loaded configuration.
   * @throws `ConfigError` if there is an issue requiring or evaluating the JavaScript file.
   */
  public static loadJS(path: string): Promise<unknown> {
    return new Promise<any>((resolve, reject) => {
      if (!isStr(path)) {
        return reject(new ConfigError(`Invalid path: ${String(path)}`));
      }

      if (extname(path).toLowerCase() !== '.js') {
        return reject(new ConfigError(`Invalid JS path: ${String(path)}`));
      }

      this.exist(path)
        .then(() => {
          try {
            const config = require(path);
            this.config = this.validate(config);
            this.loaded = path;
            resolve(this.config);
          } catch (error) {
            reject(new ConfigError(error.message));
          }
        })
        .catch((error) => {
          // resolve with default config
          if (this.default) return resolve(this.default);

          // or reject
          reject(new ConfigError(error.message));
        });
    });
  }

  /**
   * Loads the config file or resolves with a default configuration if the config file is missing.
   *
   * - If the configuration is already loaded, it resolves immediately with the cached configuration.
   * - If the config file does not exist this method resolves with the default configuration if provided.
   *
   * @template T The expected structure of the configuration object.
   * @returns A Promise that resolves with the loaded configuration or the default configuration.
   * @throws `ConfigError` if the file format is unsupported or if loading the configuration fails.
   */
  public static load<T extends Record<string, unknown>>(): Promise<T> {
    // Return the cached config if already loaded
    if (isDefined(this.config)) {
      return Promise.resolve(this.config as T);
    }

    const extension = extname(this.file).toLocaleLowerCase();

    // Load default JS config
    if (extension === '.js') {
      return this.loadJS(join(this.resolveSync(), this.file)) as Promise<T>;
    }

    // Load default JSON config
    if (extension === '.json') {
      return this.loadJSON(join(this.resolveSync(), this.file)) as Promise<T>;
    }

    return Promise.reject(
      new ConfigError(`Unsupported config file extention: ${extension}`)
    );
  }

  /**
   * Reloads the config file and returns its contents.
   * This method attempts to reload a previously loaded config file.
   *
   * @template T The expected structure of the loaded configuration.
   * @returns A promise that resolves to the reloaded configuration object.
   * @throws `ConfigError` if no file is loaded or the file extension is unsupported.
   */
  public static reload<T extends Record<string, unknown>>(): Promise<T> {
    if (!isStr(this.loaded)) {
      return Promise.reject(new ConfigError('Nothing to reload'));
    }

    const extension = extname(this.loaded).toLocaleLowerCase();

    // Load default JS config
    if (extension === '.js') return this.loadJS(this.loaded) as Promise<T>;

    // Load default JSON config
    if (extension === '.json') return this.loadJSON(this.loaded) as Promise<T>;

    return Promise.reject(
      new ConfigError(`Unsupported config file extention: ${extension}`)
    );
  }
}
