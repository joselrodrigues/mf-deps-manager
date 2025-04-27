import { promises as fs } from 'fs';
import path from 'path';

export async function validateCatalog(
  catalogPath: string,
  categories: string[],
): Promise<void> {
  // Verificar que el directorio existe
  try {
    await fs.access(catalogPath);
  } catch {
    throw new Error(`Catalog path '${catalogPath}' does not exist`);
  }

  // Verificar que cada categoría tiene su archivo JSON
  const missingCategories: string[] = [];
  for (const category of categories) {
    const filePath = path.join(catalogPath, `${category}.json`);
    try {
      await fs.access(filePath);
    } catch {
      missingCategories.push(category);
    }
  }

  if (missingCategories.length > 0) {
    throw new Error(`Missing category files: ${missingCategories.join(', ')}`);
  }

  // Validar que cada archivo JSON tiene el formato correcto
  for (const category of categories) {
    const filePath = path.join(catalogPath, `${category}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const json = JSON.parse(content);

      // Verificar que es un objeto
      if (typeof json !== 'object' || json === null) {
        throw new Error(
          `Invalid format in ${category}.json: must be an object`,
        );
      }

      // Verificar que todas las entradas son strings
      for (const [pkg, version] of Object.entries(json)) {
        if (typeof version !== 'string') {
          throw new Error(
            `Invalid version for ${pkg} in ${category}.json: must be a string`,
          );
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${category}.json: ${error.message}`);
      }
      throw error;
    }
  }
}
