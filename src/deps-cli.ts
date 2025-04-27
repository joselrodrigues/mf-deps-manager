import { Command } from 'commander';
import chalk from 'chalk';
import { DependencyManager } from './dependency-manager.ts';
import { UpdateChecker } from './update-checker.ts';

/**
 * Configuration for the DepsCLI
 */
export interface DepsCLIConfig {
  /** Path to the catalog directory containing dependency definitions */
  catalogPath: string;
  /** List of available categories */
  categories: string[];
  /** Optional mapping of categories to dependency types */
  defaultBehavior?: Record<string, 'dev' | 'peer' | 'dependencies'>;
}

/**
 * CLI interface for managing microfrontend dependencies
 */
export class DepsCLI {
  private program: Command;
  private dependencyManager: DependencyManager;
  private updateChecker: UpdateChecker;
  private config: DepsCLIConfig;

  /**
   * Creates a new DepsCLI instance
   * @param config - Configuration for the CLI
   */
  constructor(config: DepsCLIConfig) {
    this.config = config;
    this.program = new Command();
    this.dependencyManager = new DependencyManager(config.catalogPath);
    this.updateChecker = new UpdateChecker(config.catalogPath);

    this.setupCommands();
  }

  /**
   * Sets up the CLI commands
   */
  private setupCommands(): void {
    this.program
      .name('@joselrodrigues/mf-deps-manager')
      .description('CLI for managing microfrontend dependencies')
      .version('1.0.0');

    // Add command
    this.program
      .command('add')
      .description('Add dependencies from catalog')
      .argument(
        '<items...>',
        'Categories or specific dependencies (category:package)',
      )
      .option('--dev', 'Add to devDependencies')
      .option('--peer', 'Add to peerDependencies')
      .action(
        async (items: string[], options: { dev?: boolean; peer?: boolean }) => {
          const targetType = options.dev
            ? 'devDependencies'
            : options.peer
              ? 'peerDependencies'
              : 'dependencies';

          await this.dependencyManager.add(
            items,
            targetType,
            this.config.defaultBehavior,
          );
        },
      );

    // List command
    this.program
      .command('list')
      .description('List available categories')
      .action(() => {
        console.log(chalk.bold('\nAvailable categories:'));
        this.config.categories.forEach((category) => {
          console.log(`  - ${category}`);
        });
      });

    // Show command
    this.program
      .command('show')
      .description('Show dependencies in a category')
      .argument('<category>', 'Category to show')
      .action(async (category: string) => {
        await this.dependencyManager.show(category);
      });

    // Update command
    this.program
      .command('update')
      .description('Update dependencies to catalog versions')
      .option('--dry-run', 'Show what would be updated without making changes')
      .action(async (options: { dryRun?: boolean }) => {
        await this.dependencyManager.update(options.dryRun);
      });

    // Check updates command
    this.program
      .command('check-updates')
      .description('Check for available updates in catalog')
      .action(async () => {
        await this.updateChecker.checkAll(this.config.categories);
      });

    // Update catalog command
    this.program
      .command('update-catalog')
      .description('Update catalog to latest versions')
      .argument('[category]', 'Category to update (optional)')
      .action(async (category?: string) => {
        if (category) {
          await this.updateChecker.updateCategory(category);
        } else {
          await this.updateChecker.updateAll(this.config.categories);
        }
      });
  }

  /**
   * Runs the CLI with the provided arguments
   * @param argv - Command line arguments
   */
  public run(argv: string[]): void {
    this.program.parse(argv);
  }
}
