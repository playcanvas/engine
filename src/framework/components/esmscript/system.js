import { ScriptCache } from '../../../framework/handlers/esmscript.js';
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

        Debug.warnOnce('The EsmScriptComponentSystem is experimental and the api is likely to change, use at your own discretion');

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
        this._componentDataMap.set(component, data);
        const modules = data.modules || [];

        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        // Initiate the imports concurrently
        const scripts = modules.map(({ moduleSpecifier }) => ScriptCache.get(moduleSpecifier));

        // add the modules to the components
        for (const i in modules) {
            const { attributes, enabled } = modules[i];
            const script = scripts[i];
            if (script) component.add(scripts[i], attributes, enabled);
        }
    }

    cloneComponent(entity, clone) {

        const component = entity.esmscript;

        Debug.assert(component, `The entity '${entity.name}' does not have an 'EsmScriptComponent' to clone`);

        // const { enabled } = this._componentDataMap.get(component);

        const cloneComponent = this.addComponent(clone, { enabled: component.enabled });

        component.modules.forEach((module) => {
            const enabled = component.isModuleEnabled(module);

            // Use the previous module's attributes as the default values for the new module
            cloneComponent.add(module.constructor, module, enabled);
        });

        return cloneComponent;

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

        // Call `active()` on any scripts that have become active/enabled during the current game step
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

        // Call `inactive()` on any scripts that have become inactive/disabled during the current game step
        for (const component of this._components) {
            component.flushInactiveModules();
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
