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
        this.components = [ ];

        this.on('beforeremove', this.onBeforeRemove, this);
        pc.ComponentSystem.on('initialize', this.onInitialize, this);
        pc.ComponentSystem.on('postInitialize', this.onPostInitialize, this);
        pc.ComponentSystem.on('update', this.onUpdate, this);
        pc.ComponentSystem.on('postUpdate', this.onPostUpdate, this);
    };
    ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.ComponentSystem);

    pc.extend(ScriptComponentSystem.prototype, {
        initializeComponentData: function(component, data, properties) {
            this.components.push(component);

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

        callComponentMethod: function(name, dt) {
            for(var i = 0; i < this.components.length; i++) {
                if (! this.components[i].entity.enabled || ! this.components[i].enabled)
                    continue;

                this.components[i][name](dt);
            }
        },

        onInitialize: function() {
            // initialize attributes
            for(var i = 0; i < this.components.length; i++)
                this.components[i].onInitializeAttributes();

            this.callComponentMethod('onInitialize');
        },
        onPostInitialize: function() {
            this.callComponentMethod('onPostInitialize');
        },
        onUpdate: function(dt) {
            this.callComponentMethod('onUpdate', dt);
        },
        onPostUpdate: function(dt) {
            this.callComponentMethod('onPostUpdate', dt);
        },

        onBeforeRemove: function(entity, component) {
            var ind = this.components.indexOf(component);
            if (ind === -1) return;

            component.onBeforeRemove();

            this.components.splice(ind, 1);
        }
    });

    return {
        ScriptComponentSystem: ScriptComponentSystem
    };
}());
