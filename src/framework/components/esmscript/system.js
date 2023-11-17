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

    initializeComponentData(component, data) {

        this._components.add(component);

        const ImportAndAddScript = async (moduleSpecifier, attributes) => {
            const EsmModuleClass = await DynamicImport(this.app, moduleSpecifier);
            component.add(EsmModuleClass, attributes);
            return EsmModuleClass;
        };

        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        if (data.hasOwnProperty('modules')) {
            for (let i = 0; i < data.modules.length; i++) {
                const { moduleSpecifier, attributes } = data.modules[i];
                ImportAndAddScript(moduleSpecifier, attributes);
            }
        }
    }

    cloneComponent(entity, clone) {

        const component = entity.esmscript;

        Debug.assert(component, `The entity '${entity.name}' does not have a 'ESMScriptComponent' to clone`);

        const moduleEntries = Object.entries(component.modules);

        // For each module in the esm script component
        const data = moduleEntries.map(([moduleSpecifier, moduleInstance]) => {

            // Get the associated attribute definition and enabled state
            const attributeDefinitions = component.attributeDefinitions.get(moduleSpecifier);
            const attributes = {};
            const enabled = !!moduleInstance.enabled;

            // Copy each attribute in the definition from the module to the new attributes object
            EsmScriptComponent.populateWithAttributes(attributes, attributeDefinitions, moduleInstance);

            return {
                enabled,
                moduleSpecifier,
                attributes
            };
        });

        return this.addComponent(clone, data);
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
    }

    destroy() {
        super.destroy();

        this.app.systems.off('initialize', this._onInitialize, this);
        this.app.systems.off('update', this._onUpdate, this);
        this.app.systems.off('postUpdate', this._onPostUpdate, this);
    }
}

export { EsmScriptComponentSystem };
