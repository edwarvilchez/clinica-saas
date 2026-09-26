/**
 * ==============================================================================
 * CGK MEDICUS FRAMEWORK - MANIFEST VALIDATOR & DEPENDENCY RESOLVER
 * ==============================================================================
 * @file        manifestValidator.js
 * @description Ingestion, validation, and topological dependency graph resolver
 *              for Odoo-style module manifests (__manifest__.js).
 * @author      CGK Core Engineering Team
 * @license     Enterprise / Proprietary
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

class ManifestValidator {
  /**
   * Validate standard mandatory properties of a module manifest.
   * @param {Object} manifest - Parsed JSON/JS object from __manifest__.js
   * @param {string} modulePath - Absolute filesystem path of the module
   * @returns {Object} Validated and normalized manifest object
   * @throws {Error} If required attributes are missing
   */
  validateManifest(manifest, modulePath) {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error(`[ManifestValidator] Invalid manifest object at ${modulePath}`);
    }

    const mandatoryFields = ['name', 'version', 'summary'];
    for (const field of mandatoryFields) {
      if (!manifest[field]) {
        throw new Error(`[ManifestValidator] Missing required field "${field}" in ${modulePath}`);
      }
    }

    return {
      name: manifest.name,
      version: manifest.version || '1.0.0',
      category: manifest.category || 'Uncategorized',
      summary: manifest.summary,
      author: manifest.author || 'CGK Ecosystem',
      website: manifest.website || '',
      depends: Array.isArray(manifest.depends) ? manifest.depends : ['base'],
      data: Array.isArray(manifest.data) ? manifest.data : [],
      installable: manifest.installable !== false,
      auto_install: manifest.auto_install === true,
      application: manifest.application === true,
      modulePath
    };
  }

  /**
   * Performs topological sort (Kahn's / DFS algorithm) to resolve loading order
   * based on the `depends` key, preventing cyclic dependency deadlock.
   * @param {Map<string, Object>} modulesMap - Map of module_name -> validatedManifest
   * @returns {Array<string>} Ordered list of module names for execution
   * @throws {Error} If circular dependency is detected or dependency is missing
   */
  resolveDependencyGraph(modulesMap) {
    const visited = new Set();
    const tempVisiting = new Set();
    const sortedList = [];

    const visit = (moduleName) => {
      if (tempVisiting.has(moduleName)) {
        throw new Error(`[ManifestValidator] Circular dependency detected involving module: "${moduleName}"`);
      }

      if (!visited.has(moduleName)) {
        tempVisiting.add(moduleName);

        const manifest = modulesMap.get(moduleName);
        if (!manifest) {
          throw new Error(`[ManifestValidator] Missing required dependency module: "${moduleName}"`);
        }

        for (const dep of manifest.depends) {
          if (dep !== 'base') { // 'base' is system root
            visit(dep);
          }
        }

        tempVisiting.delete(moduleName);
        visited.add(moduleName);
        sortedList.push(moduleName);
      }
    };

    for (const [modName] of modulesMap.entries()) {
      if (!visited.has(modName)) {
        visit(modName);
      }
    }

    return sortedList;
  }
}

module.exports = new ManifestValidator();
