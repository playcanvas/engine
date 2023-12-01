import { DynamicImport } from '../../../framework/handlers/esmscript.js';
import { Debug } from '../../../core/debug.js';
import { ComponentSystem } from '../system.js';
import { EsmScriptComponent } from './component.js';
import { EsmScriptComponentData } from './data.js';

/**
 * Allows scripts to be attached to an Entity and executed.
 *
 * **The api is likely to change, use at your own discretion**
 *
 * @ignore
 * @augments ComponentSystem
 */
class EsmScriptComponentSystem extends ComponentSystem {
    /**
     * Create a new EsmScriptComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */

    _components = new Set();

    _componentDataMap = new Map();

    constructor(app) {
        super(app);

        this.id = 'esmscript';

        this.ComponentType = EsmScriptComponent;
        this.DataType = EsmScriptComponentData;

        this.on('beforeremove', this._onBeforeRemove, this);
        this.app.systems.on('initialize', this._onInitialize, this);
        this.app.systems.on('update', this._onUpdate, this);
        this.app.systems.on('postUpdate', this._onPostUpdate, this);
    }

    async initializeComponentData(component, data) {

        this._components.add(component);
        this._componentDataMap.set(component, data);
        const modules = data.modules || [];

        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        // Initiate the imports concurrently
        const imports = modules.map(({ moduleSpecifier }) => DynamicImport(this.app, moduleSpecifier));

        // wait for them to resolve and retain the ordering
        const esmExports = await Promise.all(imports);

        // add the modules to the components
        for (const i in modules) {
            const { attributes, enabled } = modules[i];
            const esmModuleExport = esmExports[i];
            component.add(esmModuleExport, attributes, enabled);
        }
    }

    cloneComponent(entity, clone) {

        const component = entity.esmscript;

        Debug.assert(component, `The entity '${entity.name}' does not have an 'EsmScriptComponent' to clone`);

        const { enabled = true } = this._componentDataMap.get(component);

        const clonedComponent = this.addComponent(clone, { enabled });

        component.modules.forEach((module, key) => {
            const enabled = component.isModuleEnabled(module);
            const attributeDefinition = component.attributeDefinitions.get(module);
            const attributes = EsmScriptComponent.populateWithAttributes(this.app, attributeDefinition, module);
            const EsmModuleExport = { attributes: attributeDefinition, default: module.constructor };
            clonedComponent.add(EsmModuleExport, attributes, enabled);
        });

        return clonedComponent;
    }

    _onInitialize() {
        for (const component of this._components) {
            if (component.enabled) component._onInitialize();
        }
    }

    _onPostInitialize() {
        for (const component of this._components) {
            if (component.enabled) component._onPostInitialize();
        }
    }

    _onUpdate(dt) {
        for (const component of this._components) {
            if (component.enabled) component.flushUninitializedModules();
        }

        for (const component of this._components) {
            if (component.enabled) component.flushActiveModules();
        }

        for (const component of this._components) {
            if (component.enabled) component._onUpdate(dt);
        }
    }

    _onPostUpdate(dt) {
        for (const component of this._components) {
            if (component.enabled) component._onPostUpdate(dt);
        }

        for (const component of this._components) {
            if (component.enabled) component.flushInactiveModules();
        }
    }

    _onBeforeRemove(entity, component) {
        if (this._components.has(component)) {
            component._onBeforeRemove();
        }

        // remove from components array
        this._components.delete(component);
        this._componentDataMap.delete(component);
    }

    destroy() {
        super.destroy();

        this.app.systems.off('initialize', this._onInitialize, this);
        this.app.systems.off('update', this._onUpdate, this);
        this.app.systems.off('postUpdate', this._onPostUpdate, this);
    }
}

export { EsmScriptComponentSystem };
