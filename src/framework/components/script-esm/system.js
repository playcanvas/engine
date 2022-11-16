// import { SortedLoopArray } from '../../../core/sorted-loop-array.js';

import { ComponentSystem } from '../system.js';

import { ScriptESMComponent } from './component.js';
import { ScriptESMComponentData } from './data.js';
import { METHOD_INITIALIZE, METHOD_POST_INITIALIZE, METHOD_UPDATE, METHOD_POST_UPDATE } from './constants.js';

/** @typedef {import('../../app-base.js').AppBase} AppBase */

// const METHOD_INITIALIZE_ATTRIBUTES = '_onInitializeAttributes';

// Ever-increasing integer used as the execution order of new script components. We are using an
// ever-increasing number and not the order of the script component in the components array because
// if we ever remove components from the array, we would have to re-calculate the execution order
// for all subsequent script components in the array every time, which would be slow.
// let executionOrderCounter = 0;

/**
 * Allows scripts to be attached to an Entity and executed.
 *
 * @augments ComponentSystem
 */
class ScriptESMComponentSystem extends ComponentSystem {
    /**
     * Create a new ScriptESMComponentSystem.
     *
     * @param {AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'esmscript';

        this.ComponentType = ScriptESMComponent;
        this.DataType = ScriptESMComponentData;

        // this.on('beforeremove', this._onBeforeRemove, this);
        this.app.systems.on('initialize', this._onInitialize, this);
        this.app.systems.on('postInitialize', this._onPostInitialize, this);
        this.app.systems.on('update', this._onUpdate, this);
        this.app.systems.on('postUpdate', this._onPostUpdate, this);
    }

    initializeComponentData(component, data) {
    }

    cloneComponent(entity, clone) {
        const data = {
            enabled: entity.esmscript.enabled
        };

        return this.addComponent(clone, data);
    }

    _callComponentMethod(method, arg) {
        const components = this.store;

        for (const id in components) {
            if (components.hasOwnProperty(id)) {
                const component = components[id].entity.esmscript;
                const componentData = component.data;

                if (componentData.enabled && component.entity.enabled) {
                    component._callMethodForScripts(method, arg);
                }
            }
        }
    }

    _onInitialize() {
        this._callComponentMethod(METHOD_INITIALIZE);
    }

    _onPostInitialize() {
        this._callComponentMethod(METHOD_POST_INITIALIZE);
    }

    _onUpdate(dt) {
        this._callComponentMethod(METHOD_UPDATE, dt);
    }

    _onPostUpdate(dt) {
        this._callComponentMethod(METHOD_POST_UPDATE, dt);
    }

    destroy() {
        super.destroy();
        this.app.systems.off('initialize', this._onInitialize, this);
        this.app.systems.off('postInitialize', this._onPostInitialize, this);
        this.app.systems.off('update', this._onUpdate, this);
        this.app.systems.off('postUpdate', this._onPostUpdate, this);
    }
}

export { ScriptESMComponentSystem };
