pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.Entity
     * @class The Entity is the core primitive of a PlayCanvas game. Each one contains a globally unique identifier (GUID) to distinguish
     * it from other Entities, and associates it with tool-time data on the server.
     * An object in your game consists of an {@link pc.fw.Entity}, and a set of {@link pc.fw.Component}s which are 
     * managed by a {@link pc.fw.ComponentSystem}.
     * The Entity uniquely identifies the object and also provides a transform for position and orientation 
     * an inherits from {@pc.scene.GraphNode} so can be added into the scene graph.
     * The Component and ComponentSystem provide provide the logic to give an Entity a specific type of behaviour. e.g. the ability to 
     * render a model or play a sound. Components are specific to a instance of an Entity and are attached (e.g. `this.entity.model`) 
     * ComponentSystems allow access to all Entities and Components and are attached to the {@link pc.fw.ApplicationContext}
     * 
     * Every object created in the PlayCanvas Designer is an Entity.
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
     * @extends pc.scene.GraphNode
     */
    var Entity = function(){
        this._guid = pc.guid.create(); // Globally Unique Identifier 
        this._batchHandle = null; // The handle for a RequestBatch, set this if you want to Component's to load their resources using a pre-existing RequestBatch.
        this.c = {}; // Component storage

        pc.extend(this, pc.events);
    };
    Entity = pc.inherits(Entity, pc.scene.GraphNode);
    
    Entity.prototype = pc.extend(Entity.prototype, {
        /**
         * @function
         * @name pc.fw.Entity#getGuid
         * @description Get the GUID value for this Entity
         */
        getGuid: function () {
            return this._guid;
        },
    
        /**
         * @function
         * @name pc.fw.Entity#setGuid
         * @description Set the GUID value for this Entity. N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time.
         * Doing so will corrupt the graph this Entity is in.
         * @param {Object} guid
         */
        setGuid: function (guid) {
            this._guid = guid;
        },

        /**
         * @function
         * @name pc.fw.Entity#setRequestBatch
         * @description Used during resource loading to ensure that child resources of Entities are tracked
         * @param {Number} handle The handle of the RequestBatch used to load this Entity
         */
        setRequestBatch: function (handle) {
            this._batchHandle = handle;
        },

        /**
         * @function
         * @name pc.fw.Entity#getRequestBatch
         * @description Get the RequestBatch handle that is being used to load this Entity
         * @returns {Number} The RequestBatch handle
         */
        getRequestBatch: function () {
            return this._batchHandle;
        },

        addChild: function (child) {
            if(child instanceof pc.fw.Entity) {
                var _debug = true
                if(_debug) {
                    var root = this.getRoot();
                    var dupe = root.findOne("getGuid", child.getGuid());
                    if(dupe) {
                        throw new Error("GUID already exists in graph");
                    }
                }            
            }
            
            pc.scene.GraphNode.prototype.addChild.call(this, child);
        },

        /**
         * @function
         * @name pc.fw.Entity#findByGuid
         * @description Find a descendant of this Entity with the GUID
         * @returns {pc.fw.Entity}
         */
        findByGuid: function (guid) {
            if (this._guid === guid) return this;

            for (var i = 0; i < this._children.length; i++) {
                if(this._children[i].findByGuid) {
                    var found = this._children[i].findByGuid(guid);
                    if (found !== null) return found;                
                }
            }
            return null;
        },

        /**
         * @function
         * @name pc.fw.Entity#reparent
         * @description Remove Entity from current parent and add as child to new parent
         * @param {pc.scene.GraphNode} parent New parent to attach Entity to 
         */
        reparent: function(parent) {
            var current = this.getParent();
            if(current) {
                current.removeChild(this);
            }
            if(parent) {
                parent.addChild(this);            
            }
        },

        /**
        * @function
        * @name pc.fw.Entity#destroy
        * @description Remove all components from the Entity and detach it from the Entity hierarchy. Then recursively destroy all ancestor Entities
        */
        destroy: function () {
            var parent = this.getParent();
            var childGuids;
            
            // Remove all components
            for (name in this.c) {
                this.c[name].system.removeComponent(this);
            }

            // Detach from parent
            if(parent) {
                parent.removeChild(this);
            }
            
            var children = this.getChildren();
            var length = children.length;
            var child;
            while(child = children.shift()) {
                if(child instanceof pc.fw.Entity) {
                    child.destroy();
                }
            }
        },

        clone: function () {
            var c = new pc.fw.Entity();
            pc.fw.Entity._super._cloneInternal.call(this, c);

            for (type in this.c) {
                var component = this.c[type];
                component.system.cloneComponent(this, c);
            }
            
            var i;
            for (i = 0; i < this.getChildren().length; i++) {
                var child = this.getChildren()[i];
                c.addChild(child.clone());
            }
            
            return c;
        }

    });
    
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
            labels: pc.json.stringify(model.labels),
            template: pc.json.stringify(model.template),
            parent: pc.json.stringify(model.parent),
            children: pc.json.stringify(model.children),
            transform: pc.json.stringify(model.transform),
            components: pc.json.stringify(model.components)
        };
        
        if(model._rev) {
            data._rev = model._rev
        }
        
        return data;
    };
    
    return {
        Entity: Entity
    }
    
}());
