pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.EntityLoader
     * @class Used to load and open Entity Nodes from data files or the Corazon API.
     * @param {pc.scene.GraphManager} manager GraphManager instance used to create Nodes. 
     */
    var EntityLoader = function (manager) {
        this._manager = manager;
    };
    
    /**
     * @function
     * @name pc.fw.EntityLoader#load
     * @description Load and open an Entity node from the database or from a local storage in pc.content.data
     * @param {String} guid The GUID of the Entity to load
     * @param {pc.common.Corazon} api The Corazon API object
     * @param {pc.fw.ComponentSystemRegistry} registry The ComponentSystemRegistry
     * @param {Function} success Function to execute on successful load
     */
     EntityLoader.prototype.load = function(guid, api, registry, success) {
        function _loaded (data, success) {
            var entity = this.open(data, registry);
            var length = entity.__children.length;
            var count = 0;
            var childEntities = [];

            if(length) {
                entity.__children.forEach(function(child, index, arr) {
                    this.load(child, api, registry, pc.callback(this, function (child) {
                        childEntities.push(child);
                        if(childEntities.length == length) {
                            this.patchChildren(entity, childEntities);
                            success(entity);
                        }
                    }));
                }, this);
            } else {
                success(entity);
            }            
        }

        var data;
        success = success || function() {};

        if(guid in pc.content.data) {
            data = pc.content.data[guid];
            _loaded.call(this, data, success);
        } else {
            api.entity.getOne(guid, pc.callback(this, function (entity) {
                _loaded.call(this, entity, success);
            }), function (errors) {
                alert(errors);
            });
        }

    };
    
    /**
     * @function
     * @name pc.fw.EntityLoader#open
     * @description Open a Entity node from data passed in.
     * @param {Object} data Entity data in the form got from a database or data file
     * @param {pc.fw.ComponentSystemRegistry} registry ComponentSystemRegistry
     */
    EntityLoader.prototype.open = function (data, registry) {
        var guid = data.resource_id;
        logINFO("Open: " + guid);

        var entity = this._manager.create(pc.fw.Entity);

        entity.setName(data.name);
        entity.setGuid(guid, this._manager);
        entity.setLocalTransform(pc.math.mat4.clone(data.transform));

        // Parent and child data is stored temporarily until children are patched.
        entity.__parent = data.parent;
        entity.__children = data.children;

        entity._rev = data._rev;
        entity.version = data.version;
        entity.name = data.name;
        entity.template = data.template;

        // Load component data
        for (name in data.components) {
            if (data.components.hasOwnProperty(name)) {
                if (registry[name]) {
                    component = registry[name].createComponent(entity, data.components[name]);
                } else {
                    logWARNING(name + " Component does not exist.");
                }
            }
        }

        return entity;
    };
    
    /**
     * @function
     * @name pc.fw.EntityLoader#close
     * @description Close an Entity, removed from graph and delete all Components.
     * @param {String} guid The GUID of the Entity to close
     * @param {pc.scene.GraphNode} root A node in the hierarchy about the Entity to close
     * @param {ComponentSystemRegistry} registry The ComponentSystemRegistry
     */
    EntityLoader.prototype.close = function(guid, root, registry) {
        // Remove from tree
        //var entity = root.findOne("getGuid", guid);
        var entity = this._manager.findByGuid(guid);
        var parent = entity.getParent();
        // Remove all components
        pc.fw.ComponentSystem.deleteComponents(entity, registry);

        // Detach from parent
        if(parent) {
            parent.removeChild(entity);
        }

        // Get child ids
        var childGuids = entity.getChildren().map(function(child) {
            return child.getGuid();
        }, this);

        // Close all children
        childGuids.forEach(function (guid) {
            this.close(guid, entity, registry);
        }, this);
    };
    
    /**
     * @function
     * @name pc.fw.EntityLoader#patchChildren
     * @description Once all Entities are loaded call patchChildren add the actual pc.fw.Entity objects as children. N.B. Usually you
     * won't have to patch Entities yourself. Calling load() will patch them for you.
     * @param {pc.fw.Entity} entity The Entity to have it's children patched
     * @param {Array.<pc.fw.Entity>} children List of Entities including all children of Entity to be patched
     */
    EntityLoader.prototype.patchChildren = function (entity, children) {
        // patch up children list now that all entities are loaded
        var i;
        var child;
        function _get(guid) {
            var result = null;
            children.forEach(function(child) {
                if(child.getGuid() == guid) {
                    result = child;
                }
            }, this);
            return result;
        }

        for(i = 0 ; i < entity.__children.length; ++i) {
            child = _get(entity.__children[i]);
            entity.addChild(child);
        }
    };
    
    return {
        EntityLoader: EntityLoader
    }
}());
