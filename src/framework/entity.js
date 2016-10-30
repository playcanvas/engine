pc.extend(pc, function () {
    /**
     * @name pc.Entity
     * @class The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game will consist of an {@link pc.Entity},
     * and a set of {@link pc.Component}s which are managed by their respective {@link pc.ComponentSystem}s. One of those components maybe a
     * {@link pc.ScriptComponent} which allows you to write custom code to attach to your Entity.
     * <p>
     * The Entity uniquely identifies the object and also provides a transform for position and orientation
     * which it inherits from {@link pc.GraphNode} so can be added into the scene graph.
     * The Component and ComponentSystem provide the logic to give an Entity a specific type of behaviour. e.g. the ability to
     * render a model or play a sound. Components are specific to a instance of an Entity and are attached (e.g. `this.entity.model`)
     * ComponentSystems allow access to all Entities and Components and are attached to the {@link pc.Application}.
     * </p>
     *
     * @example
     * var app = ... // Get the pc.Application
     *
     * var entity = new pc.Entity();
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
                console.error("Couldn't find current application");
            }
        }

        pc.events.attach(this);
    };
    Entity = pc.inherits(Entity, pc.GraphNode);

    /**
     * @function
     * @name pc.Entity#addComponent
     * @description Create a new Component and add attach it to the Entity.
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
     };

    /**
     * @private
     * @function
     * @name pc.Entity#getGuid
     * @description Get the GUID value for this Entity
     * @returns {String} The GUID of the Entity
     */
    Entity.prototype.getGuid = function () {
        return this._guid;
    };

    /**
     * @private
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

    Entity.prototype._notifyHierarchyStateChanged = function (node, enabled) {
        var enableFirst = false;
        if (node === this && this._app._enableList.length === 0)
            enableFirst = true;

        node._onHierarchyStateChanged(enabled);

        if (node._onHierarchyStatePostChanged)
            this._app._enableList.push(node);

        var i, len;
        var c = node._children;
        for (i = 0, len = c.length; i < len; i++) {
            if (c[i]._enabled)
                this._notifyHierarchyStateChanged(c[i], enabled);
        }

        if (enableFirst) {
            for(i = 0, len = this._app._enableList.length; i < len; i++)
                this._app._enableList[i]._onHierarchyStatePostChanged();

            this._app._enableList.length = 0;
        }
    };

    Entity.prototype._onHierarchyStateChanged = function (enabled) {
        pc.Entity._super._onHierarchyStateChanged.call(this, enabled);

        // enable / disable all the components
        var component;
        var components = this.c;
        for (var type in components) {
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

    Entity.prototype._onHierarchyStatePostChanged = function () {
        // post enable all the components
        var components = this.c;
        for (var type in components) {
            if (components.hasOwnProperty(type))
                components[type].onPostStateChange();
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
    * var firstChild = this.entity.children[0];
    * firstChild.destroy(); // delete child, all components and remove from hierarchy
    */
    Entity.prototype.destroy = function () {
        var childGuids;
        var name;

        // Disable all enabled components first
        for (name in this.c) {
            this.c[name].enabled = false;
        }

        // Remove all components
        for (name in this.c) {
            this.c[name].system.removeComponent(this);
        }

        // Detach from parent
        if (this._parent)
            this._parent.removeChild(this);

        var children = this._children;
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
    *   this.entity.parent.addChild(e); // Add it as a sibling to the original
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
        for (i = 0; i < this._children.length; i++) {
            var child = this._children[i];
            if (child instanceof pc.Entity) {
                c.addChild(child.clone());
            }
        }

        return c;
    };

    return {
        Entity: Entity
    };
}());
