pc.extend(pc, function () {
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

        this.schema = [ 'enabled' ];

        // list of all entities script components
        this._components = [ ];

        this.on('beforeremove', this._onBeforeRemove, this);
        pc.ComponentSystem.on('initialize', this._onInitialize, this);
        pc.ComponentSystem.on('postInitialize', this._onPostInitialize, this);
        pc.ComponentSystem.on('update', this._onUpdate, this);
        pc.ComponentSystem.on('postUpdate', this._onPostUpdate, this);
    };
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.ComponentSystem);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function(component, data, properties) {
            this._components.push(component);

            component.enabled = !! data.enabled;

            if (data.hasOwnProperty('order') && data.hasOwnProperty('scripts')) {
                for(var i = 0; i < data.order.length; i++) {
                    component.create(data.order[i], {
                        enabled: data.scripts[data.order[i]].enabled,
                        attributes: data.scripts[data.order[i]].attributes,
                        preloading: true
                    });
                }
            }
        },

        cloneComponent: function() {
            throw new Error('not implemented');
        },

        _callComponentMethod: function(name, dt) {
            for(var i = 0; i < this._components.length; i++) {
                if (! this._components[i].entity.enabled || ! this._components[i].enabled)
                    continue;

                this._components[i][name](dt);
            }
        },

        _onInitialize: function() {
            // initialize attributes
            for(var i = 0; i < this._components.length; i++)
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

            this._components.splice(ind, 1);
        }
    });

    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());
