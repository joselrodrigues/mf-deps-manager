# @joselrodrigues/mf-deps-manager

A powerful CLI tool for managing dependencies across microfrontend projects with centralized version control.

## Features

- 🎯 Centralized dependency management for microfrontends
- 📦 Category-based dependency organization
- 🔄 Smart version comparison with downgrade detection
- 🎨 Beautiful CLI interface with color-coded output
- 🔍 Dry-run mode for safe updates
- 🛠️ Flexible configuration options
- 📝 TypeScript support

## Installation

```bash
npm install @joselrodrigues/mf-deps-manager
```

## Usage

### Creating a Dependency Catalog

Create a new package that will serve as your dependency catalog:

```javascript
// your-catalog/package.json
{
  "name": "@company/deps-catalog",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "company-deps": "./bin/cli.js"
  },
  "dependencies": {
    "@joselrodrigues/mf-deps-manager": "^0.0.3"
  }
}
```

Create the CLI entry point:

```javascript
// your-catalog/bin/cli.js
#!/usr/bin/env node
import { createCLI } from '@joselrodrigues/mf-deps-manager';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cli = createCLI({
  catalogPath: join(__dirname, '..'),
  categories: ['core', 'ui', 'typescript'],
  defaultBehavior: {
    typescript: 'dev',
    testing: 'dev'
  }
});

cli.run(process.argv);
```

Create your dependency catalogs:

```json
// your-catalog/core.json
{
  "react": "18.2.0",
  "react-dom": "18.2.0"
}

// your-catalog/ui.json
{
  "@mui/material": "5.14.0",
  "@emotion/react": "11.11.1",
  "@emotion/styled": "11.11.0"
}
```

### Using the Catalog

After publishing or linking your catalog package:

```bash
# List available categories
company-deps list

# Show dependencies in a category
company-deps show core

# Add dependencies to your project
company-deps add core
company-deps add --dev typescript
company-deps add --peer core:react

# Update dependencies
company-deps update
company-deps update --dry-run

# Check for updates in the catalog
company-deps check-updates
```

## Commands

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `add`            | Add dependencies from catalog           |
| `list`           | List available categories               |
| `show`           | Show dependencies in a category         |
| `update`         | Update dependencies to catalog versions |
| `check-updates`  | Check for available updates in catalog  |
| `update-catalog` | Update catalog to latest versions       |

### Add Command Options

- `--dev`: Add to devDependencies
- `--peer`: Add to peerDependencies

### Update Command Options

- `--dry-run`: Show what would be updated without making changes

## Advanced Features

### Version Range Detection

The tool intelligently handles version ranges in peerDependencies:

- Detects when current ranges already satisfy catalog versions
- Skips unnecessary updates for satisfied ranges
- Provides clear visual feedback

### Downgrade Protection

When a catalog version is lower than the current version:

- Warns about potential downgrades
- Requires explicit confirmation
- Displays clear indicators in the output

## Configuration

### CreateCLI Options

```typescript
interface CreateCLIOptions {
  catalogPath?: string; // Path to catalog files
  categories?: string[]; // Available categories
  defaultBehavior?: Record<string, 'dev' | 'peer' | 'dependencies'>;
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Jose Luis Rodrigues Da Silva
