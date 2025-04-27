import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import semver from 'semver';
import readline from 'readline';

/**
 * Represents the type of dependency in package.json
 */
export type DependencyType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies';

/**
 * Interface representing the structure of package.json
 */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Information about a dependency update
 */
interface UpdateInfo {
  current: string;
  new: string;
  category: string;
  isDowngrade?: boolean;
  isRangeSatisfied?: boolean;
}

/**
 * Manages dependencies in package.json files
 */
export class DependencyManager {
  /**
   * Creates a new DependencyManager instance
   * @param catalogPath - Path to the catalog directory containing dependency definitions
   */
  constructor(private catalogPath: string) {}

  /**
   * Prompts user for confirmation
   */
  private async promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${question} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  /**
   * Compares versions and determines if it's a downgrade
   */
  private compareVersions(
    current: string,
    target: string,
  ): { isDowngrade: boolean; isRangeSatisfied?: boolean } {
    // Handle version ranges for peerDependencies
    if (
      current.startsWith('>=') ||
      current.startsWith('<=') ||
      current.startsWith('>') ||
      current.startsWith('<')
    ) {
      const isRangeSatisfied = semver.satisfies(target, current);
      return {
        isDowngrade: false,
        isRangeSatisfied,
      };
    }

    // Clean versions for comparison
    const cleanCurrent = current.replace(/[\^~>=<]/g, '');
    const cleanTarget = target.replace(/[\^~>=<]/g, '');

    // For ^ and ~ prefixes, we still need to check for downgrades
    if (current.startsWith('^') || current.startsWith('~')) {
      return {
        isDowngrade: semver.gt(cleanCurrent, cleanTarget),
      };
    }

    return {
      isDowngrade: semver.gt(cleanCurrent, cleanTarget),
    };
  }

  /**
   * Loads a catalog file for a specific category
   * @param category - The category to load
   * @returns The catalog contents as a record of package names to versions
   */
  private async loadCatalog(category: string): Promise<Record<string, string>> {
    const filePath = path.join(this.catalogPath, `${category}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      throw new Error(`Category '${category}' not found`);
    }
  }

  /**
   * Loads the package.json file from the current directory
   * @returns The parsed package.json contents
   */
  private async loadPackageJson(): Promise<PackageJson> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      throw new Error('package.json not found in current directory');
    }
  }

  /**
   * Saves changes to package.json
   * @param packageJson - The updated package.json contents
   */
  private async savePackageJson(packageJson: PackageJson): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
    );
  }

  /**
   * Adds dependencies to package.json
   * @param items - List of categories or specific dependencies (category:package)
   * @param targetType - The type of dependency to add
   * @param defaultBehavior - Optional mapping of categories to dependency types
   */
  public async add(
    items: string[],
    targetType: DependencyType,
    defaultBehavior: Record<string, 'dev' | 'peer' | 'dependencies'> = {},
  ): Promise<void> {
    const packageJson = await this.loadPackageJson();
    packageJson[targetType] = packageJson[targetType] || {};

    for (const item of items) {
      if (item.includes(':')) {
        const [category, packageName] = item.split(':');
        const catalog = await this.loadCatalog(category);

        if (catalog[packageName]) {
          packageJson[targetType]![packageName] = catalog[packageName];
          console.log(
            chalk.green(
              `✅ Added ${packageName}@${catalog[packageName]} to ${targetType}`,
            ),
          );
        } else {
          console.log(
            chalk.red(
              `❌ Package '${packageName}' not found in category '${category}'`,
            ),
          );
        }
      } else {
        const catalog = await this.loadCatalog(item);
        let actualTargetType = targetType;
        if (targetType === 'dependencies' && defaultBehavior[item]) {
          actualTargetType =
            defaultBehavior[item] === 'dev'
              ? 'devDependencies'
              : defaultBehavior[item] === 'peer'
                ? 'peerDependencies'
                : 'dependencies';
        }

        packageJson[actualTargetType] = packageJson[actualTargetType] || {};
        Object.assign(
          packageJson[actualTargetType] as Record<string, string>,
          catalog,
        );
        console.log(
          chalk.green(`✅ Added category '${item}' to ${actualTargetType}`),
        );
      }
    }

    await this.savePackageJson(packageJson);
    console.log(
      chalk.blue('\n📦 package.json updated. Run npm install to apply changes'),
    );
  }

  /**
   * Shows the contents of a specific category
   * @param category - The category to display
   */
  public async show(category: string): Promise<void> {
    try {
      const catalog = await this.loadCatalog(category);
      console.log(chalk.bold(`\n${category}:`));
      console.log(JSON.stringify(catalog, null, 2));
    } catch (error) {
      console.log(chalk.red((error as Error).message));
    }
  }

  /**
   * Updates dependencies to match catalog versions
   * @param dryRun - If true, only show what would be updated without making changes
   */
  public async update(dryRun = false): Promise<void> {
    const packageJson = await this.loadPackageJson();
    const updates: Record<DependencyType, Record<string, UpdateInfo>> = {
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
    };
    let hasUpdates = false;

    // Load all catalogs
    const files = await fs.readdir(this.catalogPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const catalogs: Record<string, Record<string, string>> = {};
    for (const file of jsonFiles) {
      const category = path.basename(file, '.json');
      const content = await fs.readFile(
        path.join(this.catalogPath, file),
        'utf-8',
      );
      catalogs[category] = JSON.parse(content);
    }

    // Check each dependency type
    const dependencyTypes: DependencyType[] = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ];

    for (const depType of dependencyTypes) {
      if (packageJson[depType]) {
        for (const [pkg, currentVersion] of Object.entries(
          packageJson[depType]!,
        )) {
          for (const [category, catalog] of Object.entries(catalogs)) {
            if (catalog[pkg] && catalog[pkg] !== currentVersion) {
              const comparison = this.compareVersions(
                currentVersion,
                catalog[pkg],
              );

              updates[depType][pkg] = {
                current: currentVersion,
                new: catalog[pkg],
                category,
                isDowngrade: comparison.isDowngrade,
                isRangeSatisfied: comparison.isRangeSatisfied,
              };
              hasUpdates = true;
            }
          }
        }
      }
    }

    if (!hasUpdates) {
      console.log(chalk.green('✅ All dependencies are up to date'));
      return;
    }

    console.log(chalk.bold('\n📦 Updates available:\n'));

    // Display updates with additional information
    for (const depType of dependencyTypes) {
      if (Object.keys(updates[depType]).length > 0) {
        console.log(chalk.bold(`${depType}:`));
        for (const [pkg, info] of Object.entries(updates[depType])) {
          let updateString = `  ${pkg}: ${info.current} → ${info.new} (${info.category})`;

          if (info.isDowngrade) {
            updateString += chalk.yellow(' [DOWNGRADE]');
          }

          if (
            depType === 'peerDependencies' &&
            info.isRangeSatisfied !== undefined
          ) {
            if (info.isRangeSatisfied) {
              updateString += chalk.green(' [Already satisfied]');
            } else {
              updateString += chalk.red(' [Not satisfied]');
            }
          }

          console.log(updateString);
        }
        console.log('');
      }
    }

    if (dryRun) {
      console.log(chalk.yellow('(Dry run - no changes made)'));
      return;
    }

    // Apply updates with confirmation for downgrades
    for (const [depType, deps] of Object.entries(updates)) {
      for (const [pkg, info] of Object.entries(deps)) {
        let shouldUpdate = true;

        // Ask for confirmation on downgrades
        if (info.isDowngrade) {
          shouldUpdate = await this.promptUser(
            chalk.yellow(
              `${pkg} will be downgraded from ${info.current} to ${info.new}. Continue?`,
            ),
          );
        }

        // For peerDependencies with ranges, only update if the range is not satisfied
        if (depType === 'peerDependencies' && info.isRangeSatisfied) {
          console.log(
            chalk.blue(
              `Skipping ${pkg} - current range ${info.current} already satisfies ${info.new}`,
            ),
          );
          shouldUpdate = false;
        }

        if (shouldUpdate) {
          packageJson[depType as DependencyType]![pkg] = info.new;
        }
      }
    }

    await this.savePackageJson(packageJson);
    console.log(
      chalk.green('✅ package.json updated. Run npm install to apply changes'),
    );
  }
}
