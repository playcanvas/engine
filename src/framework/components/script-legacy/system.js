import { extend } from '../../../core/core.js';
import { events } from '../../../core/events.js';

import { Color } from '../../../math/color.js';
import { Curve } from '../../../math/curve.js';
import { CurveSet } from '../../../math/curve-set.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ScriptLegacyComponent } from './component.js';
import { ScriptLegacyComponentData } from './data.js';

const _schema = [
    'enabled',
    'scripts',
    'instances',
    'runInTools'
];

const INITIALIZE = "initialize";
const POST_INITIALIZE = "postInitialize";
const UPDATE = "update";
const POST_UPDATE = "postUpdate";
const FIXED_UPDATE = "fixedUpdate";
const TOOLS_UPDATE = "toolsUpdate";
const ON_ENABLE = 'onEnable';
const ON_DISABLE = 'onDisable';

class ScriptLegacyComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'script';

        this.ComponentType = ScriptLegacyComponent;
        this.DataType = ScriptLegacyComponentData;
        this.schema = _schema;

        // used by application during preloading phase to ensure scripts aren't
        // initialized until everything is loaded
        this.preloading = false;

        // arrays to cache script instances for fast iteration
        this.instancesWithUpdate = [];
        this.instancesWithFixedUpdate = [];
        this.instancesWithPostUpdate = [];
        this.instancesWithToolsUpdate = [];

        this.on('beforeremove', this.onBeforeRemove, this);
        ComponentSystem.bind(INITIALIZE, this.onInitialize, this);
        ComponentSystem.bind(POST_INITIALIZE, this.onPostInitialize, this);
        ComponentSystem.bind(UPDATE, this.onUpdate, this);
        ComponentSystem.bind(FIXED_UPDATE, this.onFixedUpdate, this);
        ComponentSystem.bind(POST_UPDATE, this.onPostUpdate, this);
        ComponentSystem.bind(TOOLS_UPDATE, this.onToolsUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = ['runInTools', 'enabled', 'scripts'];

        // convert attributes array to dictionary
        if (data.scripts && data.scripts.length) {
            data.scripts.forEach(function (script) {
                if (script.attributes && Array.isArray(script.attributes)) {
                    var dict = {};
                    for (var i = 0; i < script.attributes.length; i++) {
                        dict[script.attributes[i].name] = script.attributes[i];
                    }

                    script.attributes = dict;
                }
            });
        }

        super.initializeComponentData(component, data, properties);
    }

    cloneComponent(entity, clone) {
        // overridden to make sure urls list is duplicated
        var src = this.store[entity.getGuid()];
        var data = {
            runInTools: src.data.runInTools,
            scripts: [],
            enabled: src.data.enabled
        };

        // manually clone scripts so that we don't clone attributes with pc.extend
        // which will result in a stack overflow when extending 'entity' script attributes
        var scripts = src.data.scripts;
        for (var i = 0, len = scripts.length; i < len; i++) {
            var attributes = scripts[i].attributes;
            if (attributes) {
                delete scripts[i].attributes;
            }

            data.scripts.push(extend({}, scripts[i]));

            if (attributes) {
                data.scripts[i].attributes = this._cloneAttributes(attributes);
                scripts[i].attributes = attributes;
            }
        }

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        // if the script component is enabled
        // call onDisable on all its instances first
        if (component.enabled) {
            this._disableScriptComponent(component);
        }

        // then call destroy on all the script instances
        this._destroyScriptComponent(component);
    }

    onInitialize(root) {
        this._registerInstances(root);

        if (root.enabled) {
            if (root.script && root.script.enabled) {
                this._initializeScriptComponent(root.script);
            }

            var children = root._children;
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof Entity) {
                    this.onInitialize(children[i]);
                }
            }
        }
    }

    onPostInitialize(root) {
        if (root.enabled) {
            if (root.script && root.script.enabled) {
                this._postInitializeScriptComponent(root.script);
            }

            var children = root._children;
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof Entity) {
                    this.onPostInitialize(children[i]);
                }
            }
        }
    }

    _callInstancesMethod(script, method) {
        var instances = script.data.instances;
        for (var name in instances) {
            if (instances.hasOwnProperty(name)) {
                var instance = instances[name].instance;
                if (instance[method]) {
                    instance[method]();
                }
            }
        }
    }

    _initializeScriptComponent(script) {
        this._callInstancesMethod(script, INITIALIZE);
        script.data.initialized = true;

        // check again if the script and the entity are enabled
        // in case they got disabled during initialize
        if (script.enabled && script.entity.enabled) {
            this._enableScriptComponent(script);
        }
    }

    _enableScriptComponent(script) {
        this._callInstancesMethod(script, ON_ENABLE);
    }

    _disableScriptComponent(script) {
        this._callInstancesMethod(script, ON_DISABLE);
    }

    _destroyScriptComponent(script) {
        var index;
        var instances = script.data.instances;
        for (var name in instances) {
            if (instances.hasOwnProperty(name)) {
                var instance = instances[name].instance;
                if (instance.destroy) {
                    instance.destroy();
                }

                if (instance.update) {
                    index = this.instancesWithUpdate.indexOf(instance);
                    if (index >= 0) {
                        this.instancesWithUpdate.splice(index, 1);
                    }
                }

                if (instance.fixedUpdate) {
                    index = this.instancesWithFixedUpdate.indexOf(instance);
                    if (index >= 0) {
                        this.instancesWithFixedUpdate.splice(index, 1);
                    }
                }

                if (instance.postUpdate) {
                    index = this.instancesWithPostUpdate.indexOf(instance);
                    if (index >= 0) {
                        this.instancesWithPostUpdate.splice(index, 1);
                    }
                }

                if (instance.toolsUpdate) {
                    index = this.instancesWithToolsUpdate.indexOf(instance);
                    if (index >= 0) {
                        this.instancesWithToolsUpdate.splice(index, 1);
                    }
                }

                if (script.instances[name].instance === script[name]) {
                    delete script[name];
                }
                delete script.instances[name];
            }
        }
    }

    _postInitializeScriptComponent(script) {
        this._callInstancesMethod(script, POST_INITIALIZE);
        script.data.postInitialized = true;
    }

    _updateInstances(method, updateList, dt) {
        var item;
        for (var i = 0, len = updateList.length; i < len; i++) {
            item = updateList[i];
            if (item && item.entity && item.entity.enabled && item.entity.script.enabled) {
                item[method](dt);
            }
        }
    }

    onUpdate(dt) {
        this._updateInstances(UPDATE, this.instancesWithUpdate, dt);
    }

    onFixedUpdate(dt) {
        this._updateInstances(FIXED_UPDATE, this.instancesWithFixedUpdate, dt);
    }

    onPostUpdate(dt) {
        this._updateInstances(POST_UPDATE, this.instancesWithPostUpdate, dt);
    }

    onToolsUpdate(dt) {
        this._updateInstances(TOOLS_UPDATE, this.instancesWithToolsUpdate, dt);
    }

    broadcast(name, functionName) {
        // #ifdef DEBUG
        console.warn("DEPRECATED: ScriptLegacyComponentSystem.broadcast() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/");
        // #endif
        var args = Array.prototype.slice.call(arguments, 2);

        var id, data, fn;
        var dataStore = this.store;

        for (id in dataStore) {
            if (dataStore.hasOwnProperty(id)) {
                data = dataStore[id].data;
                if (data.instances[name]) {
                    fn = data.instances[name].instance[functionName];
                    if (fn) {
                        fn.apply(data.instances[name].instance, args);
                    }
                }
            }
        }
    }

    _preRegisterInstance(entity, url, name, instance) {
        if (entity.script) {
            entity.script.data._instances = entity.script.data._instances || {};
            if (entity.script.data._instances[name]) {
                throw Error("Script name collision '" + name + "'. Scripts from '" + url + "' and '" + entity.script.data._instances[name].url + "' {" + entity.getGuid() + "}");
            }
            entity.script.data._instances[name] = {
                url: url,
                name: name,
                instance: instance
            };
        }
    }

    _registerInstances(entity) {
        var preRegistered, instance, instanceName;

        if (entity.script) {
            if (entity.script.data._instances) {
                entity.script.instances = entity.script.data._instances;

                for (instanceName in entity.script.instances) {
                    preRegistered = entity.script.instances[instanceName];
                    instance = preRegistered.instance;

                    events.attach(instance);

                    if (instance.update) {
                        this.instancesWithUpdate.push(instance);
                    }

                    if (instance.fixedUpdate) {
                        this.instancesWithFixedUpdate.push(instance);
                    }

                    if (instance.postUpdate) {
                        this.instancesWithPostUpdate.push(instance);
                    }

                    if (instance.toolsUpdate) {
                        this.instancesWithToolsUpdate.push(instance);
                    }

                    if (entity.script.scripts) {
                        this._createAccessors(entity, preRegistered);
                    }

                    // Make instance accessible from the script component of the Entity
                    if (entity.script[instanceName]) {
                        throw Error("Script with name '" + instanceName + "' is already attached to Script Component");
                    } else {
                        entity.script[instanceName] = instance;
                    }
                }

                // Remove temp storage
                delete entity.script.data._instances;
            }

        }

        var children = entity._children;
        var i, len = children.length;
        for (i = 0; i < len; i++) {
            if (children[i] instanceof Entity) {
                this._registerInstances(children[i]);
            }
        }
    }

    _cloneAttributes(attributes) {
        var result = {};

        for (var key in attributes) {
            if (!attributes.hasOwnProperty(key))
                continue;

            if (attributes[key].type !== 'entity') {
                result[key] = extend({}, attributes[key]);
            } else {
                // don't pc.extend an entity
                var val = attributes[key].value;
                delete attributes[key].value;

                result[key] = extend({}, attributes[key]);
                result[key].value = val;

                attributes[key].value = val;
            }
        }

        return result;
    }

    _createAccessors(entity, instance) {
        var self = this;
        var i;
        var len = entity.script.scripts.length;
        var url = instance.url;

        for (i = 0; i < len; i++) {
            var script = entity.script.scripts[i];
            if (script.url === url) {
                var attributes = script.attributes;
                if (script.name && attributes) {
                    for (var key in attributes) {
                        if (attributes.hasOwnProperty(key)) {
                            self._createAccessor(attributes[key], instance);
                        }
                    }

                    entity.script.data.attributes[script.name] = self._cloneAttributes(attributes);
                }
                break;
            }
        }
    }

    _createAccessor(attribute, instance) {
        var self = this;

        // create copy of attribute data
        // to avoid overwriting the same attribute values
        // that are used by the Editor
        attribute = {
            name: attribute.name,
            value: attribute.value,
            type: attribute.type
        };

        self._convertAttributeValue(attribute);

        Object.defineProperty(instance.instance, attribute.name, {
            get: function () {
                return attribute.value;
            },
            set: function (value) {
                var oldValue = attribute.value;
                attribute.value = value;
                self._convertAttributeValue(attribute);
                instance.instance.fire("set", attribute.name, oldValue, attribute.value);
            },
            configurable: true
        });
    }

    _updateAccessors(entity, instance) {
        var self = this;
        var i;
        var len = entity.script.scripts.length;
        var key;
        var url = instance.url;
        var scriptComponent, script, name, attributes;
        var previousAttributes;
        var oldAttribute;

        for (i = 0; i < len; i++) {
            scriptComponent = entity.script;
            script = scriptComponent.scripts[i];
            if (script.url === url) {
                name = script.name;
                attributes = script.attributes;
                if (name) {
                    if (attributes) {
                        // create / update attribute accessors
                        for (key in attributes) {
                            if (attributes.hasOwnProperty(key)) {
                                self._createAccessor(attributes[key], instance);
                            }
                        }
                    }

                    // delete accessors for attributes that no longer exist
                    // and fire onAttributeChange when an attribute value changed
                    previousAttributes = scriptComponent.data.attributes[name];
                    if (previousAttributes) {
                        for (key in previousAttributes) {
                            oldAttribute = previousAttributes[key];
                            if (!(key in attributes)) {
                                delete instance.instance[oldAttribute.name];
                            } else {
                                if (attributes[key].value !== oldAttribute.value) {
                                    if (instance.instance.onAttributeChanged) {
                                        instance.instance.onAttributeChanged(oldAttribute.name, oldAttribute.value, attributes[key].value);
                                    }
                                }
                            }
                        }
                    }

                    if (attributes) {
                        scriptComponent.data.attributes[name] = self._cloneAttributes(attributes);
                    } else {
                        delete scriptComponent.data.attributes[name];
                    }
                }

                break;
            }
        }
    }

    _convertAttributeValue(attribute) {
        if (attribute.type === 'rgb' || attribute.type === 'rgba') {
            if (Array.isArray(attribute.value)) {
                attribute.value = attribute.value.length === 3 ?
                    new Color(attribute.value[0], attribute.value[1], attribute.value[2]) :
                    new Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
            }
        } else if (attribute.type === 'vec2') {
            if (Array.isArray(attribute.value))
                attribute.value = new Vec2(attribute.value[0], attribute.value[1]);

        } else if (attribute.type === 'vec3' || attribute.type === 'vector') {
            if (Array.isArray(attribute.value))
                attribute.value = new Vec3(attribute.value[0], attribute.value[1], attribute.value[2]);

        } else if (attribute.type === 'vec4') {
            if (Array.isArray(attribute.value))
                attribute.value = new Vec4(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);

        } else if (attribute.type === 'entity') {
            if (attribute.value !== null && typeof attribute.value === 'string')
                attribute.value = this.app.root.findByGuid(attribute.value);

        } else if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
            var curveType = attribute.value.keys[0] instanceof Array ? CurveSet : Curve;
            attribute.value = new curveType(attribute.value.keys);

            /* eslint-disable no-self-assign */
            attribute.value.type = attribute.value.type;
            /* eslint-enable no-self-assign */
        }
    }
}

Component._buildAccessors(ScriptLegacyComponent.prototype, _schema);

export { ScriptLegacyComponentSystem };
