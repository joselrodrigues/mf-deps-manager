import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

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
              updates[depType][pkg] = {
                current: currentVersion,
                new: catalog[pkg],
                category,
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

    // Display updates
    for (const depType of dependencyTypes) {
      if (Object.keys(updates[depType]).length > 0) {
        console.log(chalk.bold(`${depType}:`));
        for (const [pkg, info] of Object.entries(updates[depType])) {
          console.log(
            `  ${pkg}: ${info.current} → ${info.new} (${info.category})`,
          );
        }
        console.log('');
      }
    }

    if (dryRun) {
      console.log(chalk.yellow('(Dry run - no changes made)'));
      return;
    }

    // Apply updates
    for (const [depType, deps] of Object.entries(updates)) {
      for (const [pkg, info] of Object.entries(deps)) {
        packageJson[depType as DependencyType]![pkg] = info.new;
      }
    }

    await this.savePackageJson(packageJson);
    console.log(
      chalk.green('✅ package.json updated. Run npm install to apply changes'),
    );
  }
}
