# MegaORM Config

This package is designed to help with loading, managing, validating, and ensuring the existence of configuration files in a Node.js project root.

## Table of Contents

1. **[Installation](#1-installation)**
2. **[Setting Up a Custom Configuration](#2-setting-up-a-custom-configuration)**
3. **[Loading Configuration](#3-loading-configuration)**
4. **[Registering Validators](#4-registering-validators)**
5. **[Reloading Configuration](#5-reloading-configuration)**
6. **[Resolving Project Root](#6-resolving-project-root)**
7. **[Checking and Ensuring File/Directory Existence](#7-checking-and-ensuring-filedirectory-existence)**
8. **[Validating Configuration](#8-validating-configuration)**
9. **[Config Loading Methods](#9-config-loading-methods)**
10. **[MegaConfig Code](#10-megaconfig-code)**

### 1. **Installation**

To install this package, run the following command:

```bash
npm install @megaorm/config
```

This will install the package and make the `Config` class available for use in your Node.js project.

### 2. **Setting Up a Custom Configuration**

- You can extend the `Config` class to load a custom configuration file.

```js
const { Config } = require('@megaorm/config');

class MyConfig extends Config {
  static file = 'myconfig.json'; // Custom config file
  static default = { key: 'value' }; // Default configuration
}

module.exports = { MyConfig };
```

### 3. **Loading Configuration**

- The `load` method loads the configuration file (`.json` or `.js`), applying any registered validators, and uses the default configuration if the file is missing.

```js
const { MyConfig } = require('./MyConfig');

MyConfig.load().then((config) => console.log(config));
```

> This method looks for the configuration file in your root folder, loads it, and caches it. The next time you execute `load`, it will resolve with the cached configuration.

### 4. **Registering Validators**

- You can register validators to check and modify the configuration before using it. Each validator is a function that modifies the config or throws an error.

```js
const { MyConfig } = require('./MyConfig');
const { ConfigError } = require('@megaorm/config');

MyConfig.register((config) => {
  if (!config.option) {
    throw new ConfigError('This option is required');
  }

  // You must always return the config for the next validator
  return config;
});
```

> Validators ensure your configuration is valid. You can use them to assign default values or throw an error if a required option is missing or the type is invalid.

### 5. **Reloading Configuration**

- If you want to refresh the configuration (e.g., after modifying it), use the `reload()` method.

```js
const { MyConfig } = require('./MyConfig');

MyConfig.reload().then((config) => console.log(config));
```

> Use this method to reload the original config and cache it again. It's useful in case you made changes to your config object and decided to load the original one.

### 6. **Resolving Project Root**

- The `resolveSync()` and `resolve()` methods resolve the project root directory. They work by traversing backward from the current working directory to locate your project's root directory.

```js
const { MyConfig } = require('./MyConfig');

console.log(MyConfig.resolveSync()); // Outputs your project root

MyConfig.resolve().then((root) => console.log(root)); // Outputs the project root
```

> Both of these methods cache the absolute path to your project root and return it whenever you need it.

### 7. **Checking and Ensuring File/Directory Existence**

- `exist(path)` checks if a file or directory exists at a given path.
- `mkdir(path)` ensures a directory exists, creating it if necessary.
- `mkfile(path, content)` ensures a file exists and creates it with the specified content if necessary.

```js
const { MyConfig } = require('./MyConfig');
const { resolve } = require('path');

// Project root
const root = MyConfig.resolveSync();

// Ensure `myConfig.json` file exists
MyConfig.exist(resolve(root, 'myConfig.json')).then(() =>
  console.log('My Config exists in the root directory')
);

// Ensure the `config` directory exists in the root folder
MyConfig.mkdir(resolve(root, 'config')).then(() =>
  console.log('Directory created or already exists')
);

// Ensure `db.json` exists in the `config` directory
MyConfig.mkfile(resolve(root, 'config/db.json'), '{"database": "main"}').then(
  () => console.log('Config file created or already exists')
);
```

> You can also use `existMany(paths)` to ensure multiple paths exist.

### 8. **Validating Configuration**

- The `validate` method runs all registered validators on the configuration object. It ensures the configuration is in the correct state before being used.

```js
const { MyConfig } = require('./MyConfig');
const { resolve } = require('path');

// Register Validators
MyConfig.register((config) => {
  // Ensure config is an object
  if (typeof config !== 'object') {
    throw new Error('Invalid configuration');
  }

  // Return the config object for the next validator
  return config;
});

MyConfig.register((config) => {
  // Ensure the name option is defined and valid
  if (typeof config.name !== 'string') {
    throw new Error('Invalid name');
  }

  // Return the config object for the next validator
  return config;
});

// Resolve the root
const root = MyConfig.resolveSync();

// Load JSON Config
MyConfig.loadJSON(resolve(root, 'test.json')).then((config) => {
  // Validate the config
  console.log(MyConfig.validate(config));
});
```

> The `load` and `reload` methods execute the `validate` method after loading or reloading the configuration the first time to ensure your configuration is valid.

### 9. **Config Loading Methods**

- **loadJS(path):** Loads a `.js` configuration file.
- **loadJSON(path):** Loads a `.json` configuration file.

```js
const { MyConfig } = require('./MyConfig');
const { resolve } = require('path');

// Resolve the root
const root = MyConfig.resolveSync();

// Load JS configuration
MyConfig.loadJS(resolve(root, 'config.js')).then((config) =>
  console.log(config)
);

// Load JSON configuration
MyConfig.loadJSON(resolve(root, 'config.json')).then((config) =>
  console.log(config)
);
```

### 10. **MegaConfig Code**

This code demonstrates how I implemented the MegaConfig class in MegaORM. It provides an overview of how the Config class should be used.

```js
import { Config, ConfigError } from '@megaorm/config';
import { isBool, isChildOf, isObj, isStr } from '@megaorm/test';
import { MegaCluster } from '@megaorm/core/MegaCluster';


/**
 * MegaConfig is a specialized configuration manager for MegaORM.
 * It handles validation and defaulting for various configuration properties,
 * including paths, TypeScript settings, and cluster details.
 */
export class MegaConfig extends Config {
  /**
   * The default name of the configuration file.
   */
  protected static file: string = 'mega.config.js';
}

/**
 * Ensures the configuration is an object before proceeding.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isObj(config)) {
    throw new ConfigError(
      `Invalid config: Expected an object but received ${typeof config}.`
    );
  }
  return config;
});

/**
 * Ensures that `config.cluster` is an instance of `MegaCluster`.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isChildOf(config.cluster, MegaCluster)) {
    throw new ConfigError(
      `Invalid config.cluster: Expected an instance of MegaCluster but received ${typeof config.cluster}.`
    );
  }
  return config;
});

/**
 * Ensures that `config.default` is a string.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isStr(config.default)) {
    throw new ConfigError(
      `Invalid config.default: Expected a valid default pool name but received ${typeof config.default}.`
    );
  }
  return config;
});

/**
 * Ensures `config.paths` is an object.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isObj(config.paths)) config.paths = {};

  return config;
});

/**
 * Set default values for the `paths` property in the configuration.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isStr(config.paths.models)) config.paths.models = 'models';
  if (!isStr(config.paths.seeders)) config.paths.seeders = 'seeders';
  if (!isStr(config.paths.commands)) config.paths.commands = 'commands';
  if (!isStr(config.paths.generators)) config.paths.generators = 'generators';

  return config;
});

/**
 * Ensures `config.typescript` is an object.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isObj(config.typescript)) config.typescript = {} as any;

  return config;
});

/**
 * Set default values for the `typescript` property in the configuration.
 */
MegaConfig.register((config: MegaORMConfig) => {
  if (!isBool(config.typescript.enabled)) config.typescript.enabled = false;
  if (!isStr(config.typescript.src)) config.typescript.src = 'src';
  if (!isStr(config.typescript.dist)) config.typescript.dist = 'dist';

  return config;
});
```

The `Config` class provides a comprehensive and flexible way to manage configuration files while ensuring they are validated, loaded efficiently, and accessible throughout your Node.js project.
