import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Checks and updates dependency versions in catalog files
 */
export class UpdateChecker {
  /**
   * Creates a new UpdateChecker instance
   * @param catalogPath - Path to the catalog directory containing dependency definitions
   */
  constructor(private catalogPath: string) {}

  /**
   * Checks for available updates across all categories
   * @param categories - List of categories to check
   */
  public async checkAll(categories: string[]): Promise<void> {
    let totalUpdates = 0;

    for (const category of categories) {
      const filePath = path.join(this.catalogPath, `${category}.json`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const deps = JSON.parse(content);

        console.log(chalk.bold(`\n🔍 Checking updates for ${category}...`));

        let categoryUpdates = 0;

        for (const [pkg, version] of Object.entries(deps)) {
          try {
            const latestVersion = execSync(`npm view ${pkg} version`, {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'ignore'],
            }).trim();

            if (latestVersion !== version) {
              console.log(
                chalk.yellow(`  📦 ${pkg}: ${version} → ${latestVersion}`),
              );
              categoryUpdates++;
              totalUpdates++;
            }
          } catch (error) {
            console.log(
              chalk.red(
                `  ❌ Error checking ${pkg}: ${(error as Error).message}`,
              ),
            );
          }
        }

        if (categoryUpdates > 0) {
          console.log(
            chalk.blue(`  Found ${categoryUpdates} update(s) for ${category}`),
          );
        } else {
          console.log(
            chalk.green(`  ✅ All packages in ${category} are up to date`),
          );
        }
      } catch {
        console.log(
          chalk.yellow(`⚠️  File ${category}.json not found, skipping...`),
        );
      }
    }

    console.log(
      chalk.bold(`\n📊 Summary: Found ${totalUpdates} total update(s)`),
    );

    if (totalUpdates > 0) {
      console.log(chalk.blue('\n💡 To update specific categories, run:'));
      console.log(chalk.blue('   mf-deps update-catalog <category>'));
    }
  }

  /**
   * Updates a specific category to latest versions
   * @param category - The category to update
   */
  public async updateCategory(category: string): Promise<void> {
    const filePath = path.join(this.catalogPath, `${category}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const deps = JSON.parse(content);

      console.log(chalk.bold(`\n🔄 Updating ${category}...`));

      const updatedDeps: Record<string, string> = {};
      let updateCount = 0;

      for (const [pkg, currentVersion] of Object.entries(deps)) {
        try {
          const latestVersion = execSync(`npm view ${pkg} version`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          }).trim();

          updatedDeps[pkg] = latestVersion;

          if (latestVersion !== currentVersion) {
            console.log(
              chalk.green(`✅ ${pkg}: ${currentVersion} → ${latestVersion}`),
            );
            updateCount++;
          } else {
            console.log(chalk.gray(`  ${pkg}: ${currentVersion} (no changes)`));
          }
        } catch (error) {
          console.log(
            chalk.red(`❌ Error updating ${pkg}: ${(error as Error).message}`),
          );
          updatedDeps[pkg] = currentVersion as string;
        }
      }

      if (updateCount > 0) {
        const backupPath = `${filePath}.backup`;
        await fs.copyFile(filePath, backupPath);
        await fs.writeFile(
          filePath,
          JSON.stringify(updatedDeps, null, 2) + '\n',
        );

        console.log(chalk.green(`\n✨ ${category}.json updated successfully!`));
        console.log(
          chalk.blue(`📁 Backup saved to ${path.basename(backupPath)}`),
        );
        console.log(chalk.blue(`\n🚀 Don't forget to:`));
        console.log(chalk.blue(`   1. Review the changes`));
        console.log(chalk.blue(`   2. Test compatibility`));
        console.log(chalk.blue(`   3. Update package version`));
        console.log(chalk.blue(`   4. Commit and publish`));
      } else {
        console.log(chalk.green(`\n✨ No updates needed for ${category}`));
      }
    } catch {
      console.log(chalk.red(`❌ File ${category}.json not found`));
    }
  }

  /**
   * Updates all categories to latest versions
   * @param categories - List of categories to update
   */
  public async updateAll(categories: string[]): Promise<void> {
    for (const category of categories) {
      await this.updateCategory(category);
    }
  }
}
