import { SortedLoopArray } from '../../../core/sorted-loop-array.js';

import { ComponentSystem } from '../system.js';

import { ScriptComponent } from './component.js';
import { ScriptComponentData } from './data.js';

const METHOD_INITIALIZE_ATTRIBUTES = '_onInitializeAttributes';
const METHOD_INITIALIZE = '_onInitialize';
const METHOD_POST_INITIALIZE = '_onPostInitialize';
const METHOD_UPDATE = '_onUpdate';
const METHOD_POST_UPDATE = '_onPostUpdate';

// Ever-increasing integer used as the
// execution order of new script components.
// We are using an ever-increasing number and not
// the order of the script component in the components
// array because if we ever remove components from the array
// we would have to re-calculate the execution order for all subsequent
// script components in the array every time, which would be slow
var executionOrderCounter = 0;

/**
 * @class
 * @name ScriptComponentSystem
 * @augments ComponentSystem
 * @description Create a new ScriptComponentSystem.
 * @classdesc Allows scripts to be attached to an Entity and executed.
 * @param {Application} app - The application.
 */
class ScriptComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'script';

        this.ComponentType = ScriptComponent;
        this.DataType = ScriptComponentData;

        // list of all entities script components
        // we are using pc.SortedLoopArray because it is
        // safe to modify while looping through it
        this._components = new SortedLoopArray({
            sortBy: '_executionOrder'
        });

        // holds all the enabled script components
        // (whose entities are also enabled). We are using pc.SortedLoopArray
        // because it is safe to modify while looping through it. This array often
        // change during update and postUpdate loops as entities and components get
        // enabled or disabled
        this._enabledComponents = new SortedLoopArray({
            sortBy: '_executionOrder'
        });


        // if true then we are currently preloading scripts
        this.preloading = true;

        this.on('beforeremove', this._onBeforeRemove, this);
        ComponentSystem.bind('initialize', this._onInitialize, this);
        ComponentSystem.bind('postInitialize', this._onPostInitialize, this);
        ComponentSystem.bind('update', this._onUpdate, this);
        ComponentSystem.bind('postUpdate', this._onPostUpdate, this);
    }

    initializeComponentData(component, data) {
        // Set execution order to an ever-increasing number
        // and add to the end of the components array.
        component._executionOrder = executionOrderCounter++;
        this._components.append(component);

        // check we don't overflow executionOrderCounter
        if (executionOrderCounter > Number.MAX_SAFE_INTEGER) {
            this._resetExecutionOrder();
        }

        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;
        // if enabled then add this component to the end of the enabledComponents array
        // Note, we should be OK to just append this to the end instead of using insert()
        // which will search for the right slot to insert the component based on execution order,
        // because the execution order of this script should be larger than all the others in the
        // enabledComponents array since it was just added.
        if (component.enabled && component.entity.enabled) {
            this._enabledComponents.append(component);
        }

        if (data.hasOwnProperty('order') && data.hasOwnProperty('scripts')) {
            component._scriptsData = data.scripts;

            for (var i = 0; i < data.order.length; i++) {
                component.create(data.order[i], {
                    enabled: data.scripts[data.order[i]].enabled,
                    attributes: data.scripts[data.order[i]].attributes,
                    preloading: this.preloading
                });
            }
        }
    }

    cloneComponent(entity, clone) {
        var i, key;
        var order = [];
        var scripts = { };

        for (i = 0; i < entity.script._scripts.length; i++) {
            var scriptInstance = entity.script._scripts[i];
            var scriptName = scriptInstance.__scriptType.__name;
            order.push(scriptName);

            var attributes = { };
            for (key in scriptInstance.__attributes)
                attributes[key] = scriptInstance.__attributes[key];

            scripts[scriptName] = {
                enabled: scriptInstance._enabled,
                attributes: attributes
            };
        }

        for (key in entity.script._scriptsIndex) {
            if (key.awaiting) {
                order.splice(key.ind, 0, key);
            }
        }

        var data = {
            enabled: entity.script.enabled,
            order: order,
            scripts: scripts
        };

        return this.addComponent(clone, data);
    }

    _resetExecutionOrder() {
        executionOrderCounter = 0;
        for (var i = 0, len = this._components.length; i < len; i++) {
            this._components.items[i]._executionOrder = executionOrderCounter++;
        }
    }

    _callComponentMethod(components, name, dt) {
        for (components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++) {
            components.items[components.loopIndex][name](dt);
        }
    }

    _onInitialize() {
        this.preloading = false;

        // initialize attributes on all components
        this._callComponentMethod(this._components, METHOD_INITIALIZE_ATTRIBUTES);

        // call onInitialize on enabled components
        this._callComponentMethod(this._enabledComponents, METHOD_INITIALIZE);
    }

    _onPostInitialize() {
        // call onPostInitialize on enabled components
        this._callComponentMethod(this._enabledComponents, METHOD_POST_INITIALIZE);
    }

    _onUpdate(dt) {
        // call onUpdate on enabled components
        this._callComponentMethod(this._enabledComponents, METHOD_UPDATE, dt);
    }

    _onPostUpdate(dt) {
        // call onPostUpdate on enabled components
        this._callComponentMethod(this._enabledComponents, METHOD_POST_UPDATE, dt);
    }

    // inserts the component into the enabledComponents array
    // which finds the right slot based on component._executionOrder
    _addComponentToEnabled(component)  {
        this._enabledComponents.insert(component);
    }

    // removes the component from the enabledComponents array
    _removeComponentFromEnabled(component) {
        this._enabledComponents.remove(component);
    }

    _onBeforeRemove(entity, component) {
        var ind = this._components.items.indexOf(component);
        if (ind >= 0) {
            component._onBeforeRemove();
        }

        this._removeComponentFromEnabled(component);

        // remove from components array
        this._components.remove(component);
    }
}

export { ScriptComponentSystem };
