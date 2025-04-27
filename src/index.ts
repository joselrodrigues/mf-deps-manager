import { DepsCLI, DepsCLIConfig } from './deps-cli.ts';
import { validateCatalog } from './validator.js';
import { DependencyManager } from './dependency-manager.js';
import { UpdateChecker } from './update-checker.js';

export interface CreateCLIOptions {
  catalogPath?: string;
  categories?: string[];
  defaultBehavior?: Record<string, 'dev' | 'peer' | 'dependencies'>;
}

export function createCLI(config: CreateCLIOptions = {}): DepsCLI {
  const {
    catalogPath = process.cwd(),
    categories = [],
    defaultBehavior = {},
  } = config;

  // Validar que el catálogo existe y tiene la estructura correcta
  validateCatalog(catalogPath, categories);

  // Crear instancia del CLI
  const cli = new DepsCLI({
    catalogPath,
    categories,
    defaultBehavior,
  });

  return cli;
}

export { DepsCLI, DependencyManager, UpdateChecker };

export type { DepsCLIConfig };
