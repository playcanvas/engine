pc.extend(pc.fw, function () {

    // Script components must all be enabled / disabled AFTER all other components.
    // So every time we need to call onEnable / onDisable
    // recursively for an Entity and its children, we
    // collect all script components in this array
    // so that we call onEnable / onDisable on them after
    // we've done so for the rest of the components.
    var _childScriptsTempBuffer = [];
    // holds the start index of the array above for every enable / disable loop
    var _childScriptsStart = 0;
    // holds the end index of the array above for every enable / disable loop
    var _childScriptsEnd = 0;

    var ON_ENABLE = 'onEnable';
    var ON_DISABLE = 'onDisable';

    /**
     * @name pc.fw.Entity
     * @class <p>The Entity is the core primitive of a PlayCanvas game. Each one contains a globally unique identifier (GUID) to distinguish
     * it from other Entities, and associates it with tool-time data on the server.
     * An object in your game consists of an {@link pc.fw.Entity}, and a set of {@link pc.fw.Component}s which are
     * managed by their respective {@link pc.fw.ComponentSystem}s.</p>
     * <p>
     * The Entity uniquely identifies the object and also provides a transform for position and orientation
     * which it inherits from {@link pc.scene.GraphNode} so can be added into the scene graph.
     * The Component and ComponentSystem provide the logic to give an Entity a specific type of behaviour. e.g. the ability to
     * render a model or play a sound. Components are specific to a instance of an Entity and are attached (e.g. `this.entity.model`)
     * ComponentSystems allow access to all Entities and Components and are attached to the {@link pc.fw.ApplicationContext}.
     * </p>
     *
     * <p>Every object created in the PlayCanvas Designer is an Entity.</p>
     *
     * @example
     * var entity = new pc.fw.Entity();
     * var context = ... // Get the pc.fw.ApplicationContext
     *
     * // Add a Component to the Entity
     * context.systems.camera.addComponent(entity, {
     *   fov: 45,
     *   nearClip: 1,
     *   farClip: 10000
     * });
     *
     * // Add the Entity into the scene graph
     * context.root.addChild(entity);
     *
     * // Move the entity
     * entity.translate(10, 0, 0);
     *
     * // Or translate it by setting it's position directly
     * var p = entity.getPosition();
     * entity.setPosition(p[0] + 10, p[1], p[2]);
     *
     * // Change the entity's rotation in local space
     * var e = entity.getLocalEulerAngles
     * entity.setLocalEulerAngles(e[0], e[1] + 90, e[2]);
     *
     * // Or use rotateLocal
     * entity.rotateLocal(0, 90, 0);
     *
     * @extends pc.scene.GraphNode
     */
    var Entity = function(){
        this._guid = pc.guid.create(); // Globally Unique Identifier
        this._batchHandle = null; // The handle for a RequestBatch, set this if you want to Component's to load their resources using a pre-existing RequestBatch.
        this.c = {}; // Component storage

        pc.events.attach(this);
    };
    Entity = pc.inherits(Entity, pc.scene.GraphNode);

    /**
     * @function
     * @name pc.fw.Entity#getGuid
     * @description Get the GUID value for this Entity
     * @returns {String} The GUID of the Entity
     */
    Entity.prototype.getGuid = function () {
        return this._guid;
    };

    /**
     * @function
     * @name pc.fw.Entity#setGuid
     * @description Set the GUID value for this Entity.
     *
     * N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
     * @param {String} guid The GUID to assign to the Entity
     */
    Entity.prototype.setGuid = function (guid) {
        this._guid = guid;
    };

    Entity.prototype._notifyHierarchyStateChanged = function (node, enabled) {
        var scripts = _childScriptsTempBuffer;

        // Before we start enabling/disabling components we need
        // to reset the start index for the buffer that holds all the
        // scripts. Enabling / disabling this Entity will create a
        // window in our buffer that will hold all the script components of
        // this Entity and its children. The start of the buffer window is
        // _childScriptStart and the end is _childScriptEnd
        _childScriptsStart = 0;
        for (var i=0,len=scripts.length; i<len; i++) {
            if (scripts[i]) {
                _childScriptsStart = i+1;
            } else {
                break;
            }
        }

        // The end index should start from the same place as the start. As we add scripts
        // to the buffer we will increase _childScriptsEnd
        _childScriptsEnd = _childScriptsStart;

        // Recursively enable/disable all components except scripts. Scripts will be
        // inserted into the buffer instead
        pc.fw.Entity._super._notifyHierarchyStateChanged.call(this, node, enabled);

        // Now that we have collected all the child scripts, enable / disable them accordingly
        var method = enabled ? ON_ENABLE : ON_DISABLE;

        // Cache start and end indices because when we enable / disable a script,
        // that might kick of another Enable / Disable recursion which will modify the same
        // static variables
        var end = _childScriptsEnd;
        var start = _childScriptsStart;

        // enable / disable the scripts in our buffer window
        for (var i=start; i<end; i++) {
            // Calling this method may start enabling / disabling
            // other Entities before we're done with this one. This is
            // why setting the entries in our buffer window to null needs
            // to happen in a different loop otherwise we risk overwriting
            // entries
            scripts[i][method]();
        }

        // Set all the scripts in our buffer window to null.
        for (var i=start; i<end; i++) {
            scripts[i] = null;
        }

    };

    Entity.prototype._onHierarchyStateChanged = function (enabled) {
        pc.fw.Entity._super._onHierarchyStateChanged.call(this, enabled);

        var scripts = _childScriptsTempBuffer;
        var scriptsLen = scripts.length;

        // enable / disable all the components except scripts
        var component;
        var components = this.c;
        var method = enabled ? ON_ENABLE : ON_DISABLE;

        for (type in components) {
            if (components.hasOwnProperty(type)) {
                component = components[type];
                if (component.enabled) {
                    if (type !== 'script') {
                        component[method]();
                    } else {
                        // if this is a script then store it to call
                        // onEnable / onDisable after the other components
                        if (_childScriptsEnd < scriptsLen) {
                            // avoid allocating memory if possible
                            scripts[_childScriptsEnd] = component;
                        } else {
                            scripts.push(component);
                            scriptsLen++;
                        }

                        _childScriptsEnd++;
                    }
                }
            }
        }
    };

    /**
     * @private
     * @function
     * @name pc.fw.Entity#setRequest
     * @description Used during resource loading to ensure that child resources of Entities are tracked
     * @param {ResourceRequest} request The request being used to load this entity
     */
    Entity.prototype.setRequest = function (request) {
        this._request = request;
    };

    /**
     * @private
     * @function
     * @name pc.fw.Entity#getRequest
     * @description Get the Request that is being used to load this Entity
     * @returns {ResourceRequest} The Request
     */
    Entity.prototype.getRequest = function () {
        return this._request;
    };

    Entity.prototype.addChild = function (child) {
        if(child instanceof pc.fw.Entity) {
            var _debug = true;
            if (_debug) {
                var root = this.getRoot();
                var dupe = root.findOne("getGuid", child.getGuid());
                if (dupe) {
                    throw new Error("GUID already exists in graph");
                }
            }
        }

        pc.scene.GraphNode.prototype.addChild.call(this, child);
    };

    /**
     * @function
     * @name pc.fw.Entity#findByGuid
     * @description Find a descendant of this Entity with the GUID
     * @returns {pc.fw.Entity} The Entity with the GUID or null
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
    * @name pc.fw.Entity#destroy
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
            if (child instanceof pc.fw.Entity) {
                child.destroy();
            }
            child = children.shift();
        }
    };

    /**
    * @function
    * @name pc.fw.Entity#clone
    * @description Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components and all descendants.
    * Note, this Entity is not in the hierarchy and must be added manually.
    * @returns {pc.fw.Entity} A new Entity which is a deep copy of the original.
    * @example
    *   var e = this.entity.clone(); // Clone Entity
    *   this.entity.getParent().addChild(e); // Add it as a sibling to the original
    */
    Entity.prototype.clone = function () {
        var type;
        var c = new pc.fw.Entity();
        pc.fw.Entity._super._cloneInternal.call(this, c);

        for (type in this.c) {
            var component = this.c[type];
            component.system.cloneComponent(this, c);
        }

        var i;
        for (i = 0; i < this.getChildren().length; i++) {
            var child = this.getChildren()[i];
            if (child instanceof pc.fw.Entity) {
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