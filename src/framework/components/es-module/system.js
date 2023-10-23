import { ComponentSystem } from '../system.js';
import { ESModuleComponent } from './component.js';
import { ESModuleComponentData } from './data.js';

/**
 * Allows scripts to be attached to an Entity and executed.
 *
 * @augments ComponentSystem
 */
class ESModuleComponentSystem extends ComponentSystem {
    /**
     * Create a new ScriptComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */

    _components = new Set();

    constructor(app) {
        super(app);

        this.id = 'esmodule';

        this.ComponentType = ESModuleComponent;
        this.DataType = ESModuleComponentData;

        this.on('beforeremove', this._onBeforeRemove, this);
        this.app.systems.on('initialize', this._onInitialize, this);
        this.app.systems.on('update', this._onUpdate, this);
    }

    initializeComponentData(component, data) {

        this._components.add(component);

        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        if (data.hasOwnProperty('modules')) {
            for (let i = 0; i < data.modules.length; i++) {
                const { moduleSpecifier, enabled, attributes } = data.modules[i];
                component.create(moduleSpecifier, {
                    enabled,
                    attributes
                });
            }
        }
    }

    cloneComponent(entity, clone) {
        const order = [];
        const scripts = { };

        for (let i = 0; i < entity.script._scripts.length; i++) {
            const scriptInstance = entity.script._scripts[i];
            const scriptName = scriptInstance.__scriptType.__name;
            order.push(scriptName);

            const attributes = { };
            for (const key in scriptInstance.__attributes)
                attributes[key] = scriptInstance.__attributes[key];

            scripts[scriptName] = {
                enabled: scriptInstance._enabled,
                attributes: attributes
            };
        }

        for (const key in entity.script._scriptsIndex) {
            if (key.awaiting) {
                order.splice(key.ind, 0, key);
            }
        }

        const data = {
            enabled: entity.script.enabled,
            order: order,
            scripts: scripts
        };

        return this.addComponent(clone, data);
    }

    _onInitialize() {
        this._components.forEach(component => component._onInitialize());
    }

    _onUpdate(dt) {
        this._components.forEach((component) => {
            if (component.enabled) component._onUpdate();
        });
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

export { ESModuleComponentSystem };
