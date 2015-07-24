pc.extend(pc, function () {
    /**
     * @name pc.Entity
     * @class The Entity is the core primitive of a PlayCanvas game. Each one contains a globally unique identifier (GUID) to distinguish
     * it from other Entities, and associates it with tool-time data on the server.
     * An object in your game consists of an {@link pc.Entity}, and a set of {@link pc.Component}s which are
     * managed by their respective {@link pc.ComponentSystem}s.
     * <p>
     * The Entity uniquely identifies the object and also provides a transform for position and orientation
     * which it inherits from {@link pc.GraphNode} so can be added into the scene graph.
     * The Component and ComponentSystem provide the logic to give an Entity a specific type of behaviour. e.g. the ability to
     * render a model or play a sound. Components are specific to a instance of an Entity and are attached (e.g. `this.entity.model`)
     * ComponentSystems allow access to all Entities and Components and are attached to the {@link pc.Application}.
     * </p>
     *
     * <p>Every object created in the PlayCanvas Editor is an Entity.</p>
     *
     * @example
     * var app = ... // Get the pc.Application
     * var entity = new pc.Entity(app);
     *
     * // Add a Component to the Entity
     * entity.addComponent("camera", {
     *   fov: 45,
     *   nearClip: 1,
     *   farClip: 10000
     * });
     *
     * // Add the Entity into the scene graph
     * app.root.addChild(entity);
     *
     * // Move the entity
     * entity.translate(10, 0, 0);
     *
     * // Or translate it by setting it's position directly
     * var p = entity.getPosition();
     * entity.setPosition(p.x + 10, p.y, p.z);
     *
     * // Change the entity's rotation in local space
     * var e = entity.getLocalEulerAngles();
     * entity.setLocalEulerAngles(e.x, e.y + 90, e.z);
     *
     * // Or use rotateLocal
     * entity.rotateLocal(0, 90, 0);
     *
     * @extends pc.GraphNode
     */
    var Entity = function(app){
        this._guid = pc.guid.create(); // Globally Unique Identifier
        this._batchHandle = null; // The handle for a RequestBatch, set this if you want to Component's to load their resources using a pre-existing RequestBatch.
        this.c = {}; // Component storage
        this._app = app; // store app
        if (!app) {
            this._app = pc.Application.getApplication(); // get the current application
            if (!this._app) {
                console.error("Couldn't find current application")
            }
        }

        pc.events.attach(this);
    };
    Entity = pc.inherits(Entity, pc.GraphNode);

    /**
     * @function
     * @name pc.Entity#addComponent
     * @description Create a new {pc.Component} and add attach it to the Entity.
     * Use this to add functionality to the Entity like rendering a model, adding light, etc.
     * @param {String} type The name of the component type. e.g. "model", "light"
     * @param {Object} data The initialization data for the specific component type
     * @returns {pc.Component} The new Component that was attached to the entity
     * @example
     * var entity = new pc.Entity();
     * entity.addComponent("light"); // Add a light component with default properties
     * entity.addComponent("camera", { // Add a camera component with some specified properties
     *   fov: 45,
     *   clearColor: new pc.Color(1,0,0),
     * });
     */
    Entity.prototype.addComponent = function (type, data) {
        var system = this._app.systems[type];
        if (system) {
            if (!this.c[type]) {
                return system.addComponent(this, data);
            } else {
                logERROR(pc.string.format("Entity already has {0} Component", type));
            }
        } else {
            logERROR(pc.string.format("System: '{0}' doesn't exist", type));
            return null;
        }
     };

     /**
      * @function
      * @name pc.Entity#removeComponent
      * @description Remove a component from the Entity.
      * @param {String} type The name of the Component type
      * @example
      * var entity = new pc.Entity();
      * entity.addComponent("light"); // add new light component
      * //...
      * entity.removeComponent("light"); // remove light component
      */
     Entity.prototype.removeComponent = function (type) {
        var system = this._app.systems[type];
        if (system) {
            if (this.c[type]) {
                system.removeComponent(this);
            } else {
                logERROR(pc.string.format("Entity doesn't have {0} Component", type));
            }
        } else {
            logERROR(pc.string.format("System: '{0}' doesn't exist", type));
        }
     }

    /**
     * @function
     * @name pc.Entity#getGuid
     * @description Get the GUID value for this Entity
     * @returns {String} The GUID of the Entity
     */
    Entity.prototype.getGuid = function () {
        return this._guid;
    };

    /**
     * @function
     * @name pc.Entity#setGuid
     * @description Set the GUID value for this Entity.
     *
     * N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
     * @param {String} guid The GUID to assign to the Entity
     */
    Entity.prototype.setGuid = function (guid) {
        this._guid = guid;
    };

    Entity.prototype._onHierarchyStateChanged = function (enabled) {
        pc.Entity._super._onHierarchyStateChanged.call(this, enabled);

        // enable / disable all the components
        var component;
        var components = this.c;
        for (type in components) {
            if (components.hasOwnProperty(type)) {
                component = components[type];
                if (component.enabled) {
                    if (enabled) {
                        component.onEnable();
                    } else {
                        component.onDisable();
                    }
                }
            }
        }
    };

    /**
     * @private
     * @function
     * @name pc.Entity#setRequest
     * @description Used during resource loading to ensure that child resources of Entities are tracked
     * @param {ResourceRequest} request The request being used to load this entity
     */
    Entity.prototype.setRequest = function (request) {
        this._request = request;
    };

    /**
     * @private
     * @function
     * @name pc.Entity#getRequest
     * @description Get the Request that is being used to load this Entity
     * @returns {ResourceRequest} The Request
     */
    Entity.prototype.getRequest = function () {
        return this._request;
    };

    Entity.prototype.addChild = function (child) {
        if(child instanceof pc.Entity) {
            var _debug = true;
            if (_debug) {
                var root = this.getRoot();
                var dupe = root.findOne("getGuid", child.getGuid());
                if (dupe) {
                    throw new Error("GUID already exists in graph");
                }
            }
        }

        pc.GraphNode.prototype.addChild.call(this, child);
    };

    /**
     * @function
     * @name pc.Entity#findByGuid
     * @description Find a descendant of this Entity with the GUID
     * @returns {pc.Entity} The Entity with the GUID or null
     */
    Entity.prototype.findByGuid = function (guid) {
        if (this._guid === guid) return this;

        for (var i = 0; i < this._children.length; i++) {
            if(this._children[i].findByGuid) {
                var found = this._children[i].findByGuid(guid);
                if (found !== null) return found;
            }
        }
        return null;
    };

    /**
    * @function
    * @name pc.Entity#destroy
    * @description Remove all components from the Entity and detach it from the Entity hierarchy. Then recursively destroy all ancestor Entities
    * @example
    * var firstChild = this.entity.getChildren()[0];
    * firstChild.destroy(); // delete child, all components and remove from hierarchy
    */
    Entity.prototype.destroy = function () {
        var parent = this.getParent();
        var childGuids;

        // Disable all enabled components first
        for (var name in this.c) {
            this.c[name].enabled = false;
        }

        // Remove all components
        for (var name in this.c) {
            this.c[name].system.removeComponent(this);
        }

        // Detach from parent
        if (parent) {
            parent.removeChild(this);
        }

        var children = this.getChildren();
        var length = children.length;
        var child = children.shift();
        while (child) {
            if (child instanceof pc.Entity) {
                child.destroy();
            }
            child = children.shift();
        }
    };

    /**
    * @function
    * @name pc.Entity#clone
    * @description Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components and all descendants.
    * Note, this Entity is not in the hierarchy and must be added manually.
    * @returns {pc.Entity} A new Entity which is a deep copy of the original.
    * @example
    *   var e = this.entity.clone(); // Clone Entity
    *   this.entity.getParent().addChild(e); // Add it as a sibling to the original
    */
    Entity.prototype.clone = function () {
        var type;
        var c = new pc.Entity(this._app);
        pc.Entity._super._cloneInternal.call(this, c);

        for (type in this.c) {
            var component = this.c[type];
            component.system.cloneComponent(this, c);
        }

        var i;
        for (i = 0; i < this.getChildren().length; i++) {
            var child = this.getChildren()[i];
            if (child instanceof pc.Entity) {
                c.addChild(child.clone());
            }
        }

        return c;
    };

    Entity.deserialize = function (data) {
        var template = pc.json.parse(data.template);
        var parent = pc.json.parse(data.parent);
        var children = pc.json.parse(data.children);
        var transform = pc.json.parse(data.transform);
        var components = pc.json.parse(data.components);
        var labels = pc.json.parse(data.labels);

        var model = {
            _id: data._id,
            resource_id: data.resource_id,
            _rev: data._rev,
            name: data.name,
            enabled: data.enabled,
            labels: labels,
            template: template,
            parent: parent,
            children: children,
            transform: transform,
            components: components
        };

        return model;
    };

    Entity.serialize = function (model) {
        var data = {
            _id: model._id,
            resource_id: model.resource_id,
            name: model.name,
            enabled: model.enabled,
            labels: pc.json.stringify(model.labels),
            template: pc.json.stringify(model.template),
            parent: pc.json.stringify(model.parent),
            children: pc.json.stringify(model.children),
            transform: pc.json.stringify(model.transform),
            components: pc.json.stringify(model.components)
        };

        if(model._rev) {
            data._rev = model._rev;
        }

        return data;
    };

    return {
        Entity: Entity
    };
}());
