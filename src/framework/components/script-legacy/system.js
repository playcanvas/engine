Object.assign(pc, function () {

    var _schema = [
        'enabled',
        'scripts',
        'instances',
        'runInTools'
    ];

    var INITIALIZE = "initialize";
    var POST_INITIALIZE = "postInitialize";
    var UPDATE = "update";
    var POST_UPDATE = "postUpdate";
    var FIXED_UPDATE = "fixedUpdate";
    var TOOLS_UPDATE = "toolsUpdate";
    var ON_ENABLE = 'onEnable';
    var ON_DISABLE = 'onDisable';

    var ScriptLegacyComponentSystem = function ScriptLegacyComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'script';
        this.description = "Allows the Entity to run JavaScript fragments to implement custom behavior.";

        this.ComponentType = pc.ScriptLegacyComponent;
        this.DataType = pc.ScriptLegacyComponentData;
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
        pc.ComponentSystem.bind(INITIALIZE, this.onInitialize, this);
        pc.ComponentSystem.bind(POST_INITIALIZE, this.onPostInitialize, this);
        pc.ComponentSystem.bind(UPDATE, this.onUpdate, this);
        pc.ComponentSystem.bind(FIXED_UPDATE, this.onFixedUpdate, this);
        pc.ComponentSystem.bind(POST_UPDATE, this.onPostUpdate, this);
        pc.ComponentSystem.bind(TOOLS_UPDATE, this.onToolsUpdate, this);
    };
    ScriptLegacyComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ScriptLegacyComponentSystem.prototype.constructor = ScriptLegacyComponentSystem;

    pc.Component._buildAccessors(pc.ScriptLegacyComponent.prototype, _schema);

    Object.assign(ScriptLegacyComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['runInTools', 'enabled', 'scripts'];

            // convert attributes array to dictionary
            if (data.scripts && data.scripts.length) {
                data.scripts.forEach(function (script) {
                    if (script.attributes && pc.type(script.attributes) === 'array') {
                        var dict = {};
                        for (var i = 0; i < script.attributes.length; i++) {
                            dict[script.attributes[i].name] = script.attributes[i];
                        }

                        script.attributes = dict;
                    }
                });
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
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

                data.scripts.push(pc.extend({}, scripts[i]));

                if (attributes) {
                    data.scripts[i].attributes = this._cloneAttributes(attributes);
                    scripts[i].attributes = attributes;
                }
            }

            return this.addComponent(clone, data);
        },

        onBeforeRemove: function (entity, component) {
            // if the script component is enabled
            // call onDisable on all its instances first
            if (component.enabled) {
                this._disableScriptComponent(component);
            }

            // then call destroy on all the script instances
            this._destroyScriptComponent(component);
        },

        onInitialize: function (root) {
            this._registerInstances(root);

            if (root.enabled) {
                if (root.script && root.script.enabled) {
                    this._initializeScriptComponent(root.script);
                }

                var children = root._children;
                var i, len = children.length;
                for (i = 0; i < len; i++) {
                    if (children[i] instanceof pc.Entity) {
                        this.onInitialize(children[i]);
                    }
                }
            }
        },

        onPostInitialize: function (root) {
            if (root.enabled) {
                if (root.script && root.script.enabled) {
                    this._postInitializeScriptComponent(root.script);
                }

                var children = root._children;
                var i, len = children.length;
                for (i = 0; i < len; i++) {
                    if (children[i] instanceof pc.Entity) {
                        this.onPostInitialize(children[i]);
                    }
                }
            }
        },

        _callInstancesMethod: function (script, method) {
            var instances = script.data.instances;
            for (var name in instances) {
                if (instances.hasOwnProperty(name)) {
                    var instance = instances[name].instance;
                    if (instance[method]) {
                        instance[method]();
                    }
                }
            }
        },

        _initializeScriptComponent: function (script) {
            this._callInstancesMethod(script, INITIALIZE);
            script.data.initialized = true;

            // check again if the script and the entity are enabled
            // in case they got disabled during initialize
            if (script.enabled && script.entity.enabled) {
                this._enableScriptComponent(script);
            }
        },

        _enableScriptComponent: function (script) {
            this._callInstancesMethod(script, ON_ENABLE);
        },

        _disableScriptComponent: function (script) {
            this._callInstancesMethod(script, ON_DISABLE);
        },

        _destroyScriptComponent: function (script) {
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
        },

        _postInitializeScriptComponent: function (script) {
            this._callInstancesMethod(script, POST_INITIALIZE);
            script.data.postInitialized = true;
        },

        _updateInstances: function (method, updateList, dt) {
            var item;
            for (var i = 0, len = updateList.length; i < len; i++) {
                item = updateList[i];
                if (item && item.entity && item.entity.enabled && item.entity.script.enabled) {
                    item[method](dt);
                }
            }
        },

        onUpdate: function (dt) {
            this._updateInstances(UPDATE, this.instancesWithUpdate, dt);
        },

        onFixedUpdate: function (dt) {
            this._updateInstances(FIXED_UPDATE, this.instancesWithFixedUpdate, dt);
        },

        onPostUpdate: function (dt) {
            this._updateInstances(POST_UPDATE, this.instancesWithPostUpdate, dt);
        },

        onToolsUpdate: function (dt) {
            this._updateInstances(TOOLS_UPDATE, this.instancesWithToolsUpdate, dt);
        },

        broadcast: function (name, functionName) {
            console.warn("DEPRECATED: ScriptLegacyComponentSystem.broadcast() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/");
            var args = pc.makeArray(arguments).slice(2);

            var id, data, fn;
            var dataStore = this.store;
            // var results = [];

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
        },

        _preRegisterInstance: function (entity, url, name, instance) {
            if (entity.script) {
                entity.script.data._instances = entity.script.data._instances || {};
                if (entity.script.data._instances[name]) {
                    throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, entity.script.data._instances[name].url, entity.getGuid()));
                }
                entity.script.data._instances[name] = {
                    url: url,
                    name: name,
                    instance: instance
                };
            }
        },

        _registerInstances: function (entity) {
            var preRegistered, instance, instanceName;

            if (entity.script) {
                if (entity.script.data._instances) {
                    entity.script.instances = entity.script.data._instances;

                    for (instanceName in entity.script.instances) {
                        preRegistered = entity.script.instances[instanceName];
                        instance = preRegistered.instance;

                        pc.events.attach(instance);

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
                            throw Error(pc.string.format("Script with name '{0}' is already attached to Script Component", instanceName));
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
                if (children[i] instanceof pc.Entity) {
                    this._registerInstances(children[i]);
                }
            }
        },

        _cloneAttributes: function (attributes) {
            var result = {};

            for (var key in attributes) {
                if (!attributes.hasOwnProperty(key))
                    continue;

                if (attributes[key].type !== 'entity') {
                    result[key] = pc.extend({}, attributes[key]);
                } else {
                    // don't pc.extend an entity
                    var val = attributes[key].value;
                    delete attributes[key].value;

                    result[key] = pc.extend({}, attributes[key]);
                    result[key].value = val;

                    attributes[key].value = val;
                }
            }

            return result;
        },

        _createAccessors: function (entity, instance) {
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
        },

        _createAccessor: function (attribute, instance) {
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
        },

        _updateAccessors: function (entity, instance) {
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
        },

        _convertAttributeValue: function (attribute) {
            if (attribute.type === 'rgb' || attribute.type === 'rgba') {
                if (pc.type(attribute.value) === 'array') {
                    attribute.value = attribute.value.length === 3 ?
                        new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2]) :
                        new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
                }
            } else if (attribute.type === 'vec2') {
                if (pc.type(attribute.value) === 'array')
                    attribute.value = new pc.Vec2(attribute.value[0], attribute.value[1]);

            } else if (attribute.type === 'vec3' || attribute.type === 'vector') {
                if (pc.type(attribute.value) === 'array')
                    attribute.value = new pc.Vec3(attribute.value[0], attribute.value[1], attribute.value[2]);

            } else if (attribute.type === 'vec4') {
                if (pc.type(attribute.value) === 'array')
                    attribute.value = new pc.Vec4(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);

            } else if (attribute.type === 'entity') {
                if (attribute.value !== null && typeof attribute.value === 'string')
                    attribute.value = this.app.root.findByGuid(attribute.value);

            } else if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
                var curveType = attribute.value.keys[0] instanceof Array ? pc.CurveSet : pc.Curve;
                attribute.value = new curveType(attribute.value.keys);

                /* eslint-disable no-self-assign */
                attribute.value.type = attribute.value.type;
                /* eslint-enable no-self-assign */
            }
        }
    });

    return {
        ScriptLegacyComponentSystem: ScriptLegacyComponentSystem
    };
}());
