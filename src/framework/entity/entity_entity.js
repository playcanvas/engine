pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.Entity
     * @class The Entity is the core primitive of a PlayCanvas game. Each one contains a globally unique identifier (GUID) to distinguish
     * it from other Entities, and associates it with tool-time data on the server.
     * A game object in the engine consists of an Entity which provides the transform matrix and can be added into the scene graph; 
     * logic provided provided by a pc.fw.ComponentSystem object; and data provided by a  pc.fw.ComponentData object.
     * Every object created in the PlayCanvas Designer is an Entity.
     * 
     * Use the Entity object to access Component logic and data
     * @example
     * var entity = ... // Get your entity
     * var context = ... // Get your pc.fw.ApplicationContext
     * 
     * var fov = context.components.camera.get(entity, "fov"); // Get the fov (field of view) value from entity's camera component
     * fov = 90;
     * context.components.camera.set(entity, "fov", fov); // Set the fov value for entity's camera component.
     * @extends pc.scene.GraphNode
     */
    var Entity = function(){
        this._guid = pc.guid.create(); // Globally Unique Identifier 
        this._batchHandle = null; // The handle for a RequestBatch, set this if you want to Component's to load their resources using a pre-existing RequestBatch.  
    };
    Entity = pc.inherits(Entity, pc.scene.GraphNode);
    
	/**
     * @function
     * @name pc.fw.Entity#getGuid
     * @description Get the GUID value for this Entity
     */
    Entity.prototype.getGuid = function () {
        return this._guid;
    };

    /**
     * @function
     * @name pc.fw.Entity#setGuid
     * @description Set the GUID value for this Entity. N.B. It is unlikely that you should need to change the GUID value of an Entity at run-time.
     * Doing so will corrupt the graph this Entity is in.
     * @param {Object} guid
     */
    Entity.prototype.setGuid = function (guid) {
        this._guid = guid;
    };
	
	/**
	 * @function
	 * @name pc.fw.Entity#setRequestBatch
	 * @description Used during resource loading to ensure that child resources of Entities are tracked
	 * @param {Number} handle The handle of the RequestBatch used to load this Entity
	 */
	Entity.prototype.setRequestBatch = function (handle) {
		this._batchHandle = handle;
	};
	
	/**
	 * @function
	 * @name pc.fw.Entity#getRequestBatch
	 * @description Get the RequestBatch handle that is being used to load this Entity
	 * @returns {Number} The RequestBatch handle
	 */
	Entity.prototype.getRequestBatch = function () {
		return this._batchHandle;
	};
	
    Entity.prototype.addChild = function (child) {
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
    };

    /**
     * @function
     * @name pc.fw.Entity#findByGuid
     * @description Find a descendant of this Entity with the GUID
     * @returns {pc.fw.Entity}
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
     * @name pc.fw.Entity#reparent
     * @description Remove Entity from current parent and add as child to new parent
     * @param {pc.scene.GraphNode} parent New parent to attach Entity to 
     */
    Entity.prototype.reparent = function(parent) {
        var current = this.getParent();
        if(current) {
            current.removeChild(this);
        }
        if(parent) {
            parent.addChild(this);            
        }
    };
    
    Entity.prototype.close = function (registry) {
        var parent = this.getParent();
        var childGuids;
        
        // Remove all components
        pc.fw.ComponentSystem.deleteComponents(this, registry);

        // Detach from parent
        if(parent) {
            parent.removeChild(this);
        }
        
        var children = this.getChildren();
        var length = children.length;
        var child;
        while(child = children.shift()) {
            if(child instanceof pc.fw.Entity) {
                child.close(registry);
            }
        }
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
