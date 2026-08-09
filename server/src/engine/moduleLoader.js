/**
 * ==============================================================================
 * CGK MEDICUS FRAMEWORK - DYNAMIC MODULE LOADER & ROUTE REGISTRY
 * ==============================================================================
 * @file        moduleLoader.js
 * @description Dynamic discovery and runtime registration of models, routes,
 *              and controllers following the Odoo Addons Architecture.
 * @author      CGK Core Engineering Team
 * @license     Enterprise / Proprietary
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const manifestValidator = require('./manifestValidator');

class ModuleLoader {
  constructor() {
    this.loadedModules = new Map();
    this.addonDirectories = [
      path.join(__dirname, '../addons_core'),
      path.join(__dirname, '../custom_addons')
    ];
  }

  /**
   * Scans designated addon directories, loads manifests, resolves dependencies,
   * and mounts Express routes dynamically under `/api/v1/addons/:moduleName`.
   * @param {Object} app - Express application instance
   * @param {Object} sequelizeInstance - Sequelize DB connection instance
   * @returns {Object} Report of loaded modules
   */
  async loadAllModules(app, sequelizeInstance = null) {
    const discoveredModules = new Map();

    // 1. Scan filesystem for __manifest__.js
    for (const addonDir of this.addonDirectories) {
      if (!fs.existsSync(addonDir)) continue;

      const subdirs = fs.readdirSync(addonDir);
      for (const folder of subdirs) {
        const fullModulePath = path.join(addonDir, folder);
        const manifestPath = path.join(fullModulePath, '__manifest__.js');

        if (fs.existsSync(manifestPath) && fs.statSync(fullModulePath).isDirectory()) {
          try {
            const rawManifest = require(manifestPath);
            const validated = manifestValidator.validateManifest(rawManifest, fullModulePath);
            if (validated.installable) {
              discoveredModules.set(folder, validated);
            }
          } catch (err) {
            console.error(`[ModuleLoader] Failed to parse manifest for "${folder}":`, err.message);
          }
        }
      }
    }

    // 2. Resolve Topological Dependency Order
    const loadOrder = manifestValidator.resolveDependencyGraph(discoveredModules);
    console.log(`[ModuleLoader] Resolved module execution order: [${loadOrder.join(' -> ')}]`);

    // 3. Register Models & Express Routes for each module in order
    for (const moduleName of loadOrder) {
      const manifest = discoveredModules.get(moduleName);
      const routesPath = path.join(manifest.modulePath, 'routes/index.js');
      const alternateRoutesPath = path.join(manifest.modulePath, 'routes.js');

      let targetRouteFile = null;
      if (fs.existsSync(routesPath)) targetRouteFile = routesPath;
      else if (fs.existsSync(alternateRoutesPath)) targetRouteFile = alternateRoutesPath;

      if (app && targetRouteFile) {
        const router = require(targetRouteFile);
        const mountPoint = `/api/v1/addons/${moduleName}`;
        app.use(mountPoint, router);
        console.log(`[ModuleLoader] Mounted routes for "${moduleName}" at ${mountPoint}`);
      }

      this.loadedModules.set(moduleName, {
        manifest,
        mountedAt: targetRouteFile ? `/api/v1/addons/${moduleName}` : null,
        status: 'ACTIVE'
      });
    }

    return {
      totalLoaded: this.loadedModules.size,
      order: loadOrder,
      modules: Array.from(this.loadedModules.entries())
    };
  }

  /**
   * Get status of loaded module
   * @param {string} moduleName
   */
  getModuleInfo(moduleName) {
    return this.loadedModules.get(moduleName) || null;
  }
}

module.exports = new ModuleLoader();
