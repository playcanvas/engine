pc.extend(pc, function () {
    var _schema = ['enabled'];

    /**
     * @name pc.ScriptComponentSystem
     * @description Create a new ScriptComponentSystem
     * @class Allows scripts to be attached to an Entity and executed
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ScriptComponentSystem = function ScriptComponentSystem(app) {
        this.id = 'script';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ScriptComponent;
        this.DataType = pc.ScriptComponentData;

        this.schema = _schema;

        // list of all entities script components
        this._components = [];
        this._destroyedComponents = [];
        this._isLoopingThroughComponents = false;

        this.preloading = true;

        this.on('beforeremove', this._onBeforeRemove, this);
        pc.ComponentSystem.on('initialize', this._onInitialize, this);
        pc.ComponentSystem.on('postInitialize', this._onPostInitialize, this);
        pc.ComponentSystem.on('update', this._onUpdate, this);
        pc.ComponentSystem.on('postUpdate', this._onPostUpdate, this);
    };
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ScriptComponent.prototype, _schema);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function(component, data, properties) {
            this._components.push(component);

            component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

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
        },

        cloneComponent: function(entity, clone) {
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
                if (key.awayting)
                    order.splice(key.ind, 0, key);
            }

            var data = {
                enabled: entity.script.enabled,
                order: order,
                scripts: scripts
            };

            return this.addComponent(clone, data);
        },

        _callComponentMethod: function(name, dt) {
            var wasLooping = this._beginLooping();

            for (var i = 0; i < this._components.length; i++) {
                if (this._components[i]._destroyed || ! this._components[i].entity.enabled || ! this._components[i].enabled) {
                    continue;
                }

                this._components[i][name](dt);
            }

            this._endLooping(wasLooping);
        },

        _beginLooping: function () {
            var looping = this._isLoopingThroughComponents;
            this._isLoopingThroughComponents = true;
            return looping;
        },

        _endLooping: function (wasLooping) {
            this._isLoopingThroughComponents = wasLooping;

            if (! this._isLoopingThroughComponents) {
                // remove destroyed components
                var len = this._destroyedComponents.length;
                if (len) {
                    for (var i = 0; i < len; i++) {
                        var idx = this._components.indexOf(this._destroyedComponents[i]);
                        if (idx >= 0) {
                            this._components.splice(idx, 1);
                        }
                    }

                    this._destroyedComponents.length = 0;
                }
            }
        },

        _onInitialize: function() {
            this.preloading = false;

            // initialize attributes
            for (var i = 0; i < this._components.length; i++)
                this._components[i]._onInitializeAttributes();

            this._callComponentMethod('_onInitialize');
        },
        _onPostInitialize: function() {
            this._callComponentMethod('_onPostInitialize');
        },
        _onUpdate: function(dt) {
            this._callComponentMethod('_onUpdate', dt);
        },
        _onPostUpdate: function(dt) {
            this._callComponentMethod('_onPostUpdate', dt);
        },

        _onBeforeRemove: function(entity, component) {
            var ind = this._components.indexOf(component);
            if (ind === -1) return;

            component._onBeforeRemove();

            // if we are not currently looping through components then
            // remove the components from our list
            if (! this._isLoopingThroughComponents) {
                this._components.splice(ind, 1);
            } else {
                // otherwise push it to be destroyed when
                // the current loop is over
                component._destroyed = true;
                this._destroyedComponents.push(component);
            }
        }
    });

    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());
