pc.extend(pc.resources, function () {
    /**
     * @name pc.resources.PackResourceHandler
     * @class Handle requests for Pack resources
     */
    var PackResourceHandler = function (registry, depot) {
        this._registry = registry
        this._depot = depot;
    
    };
    PackResourceHandler = pc.inherits(PackResourceHandler, pc.resources.ResourceHandler);
    
    PackResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
        options = options || {};
        
        var guid = identifier;
        if(guid in pc.content.data) {
            setTimeout( function () {
                success(pc.content.data[guid], options) 
            }, 0);
        } else {
            this._depot.packs.getOne(guid, function (pack) {
                success(pack, options);
            }.bind(this), function (errors) {
                error(errors);
            });
        }
    };

    PackResourceHandler.prototype.open = function (data, options) {
        var pack = this.openPack(data, options);

        return pack;
    };
    
    PackResourceHandler.prototype.openPack = function (data, options) {
        options = options || {};
        options.priority = options.priority || 1; // default priority of 1
        options.batch = options.batch || null;

        var pack = data['hierarchy'];
        return {
            application_data: data['application_data'],
            hierarchy: this.openEntity(pack, options)
        };
    };

    PackResourceHandler.prototype.openEntity = function (data, options) {
        var hierarchy;

        hierarchy = this.openEntityHierarchy(data, options);
        hierarchy.syncHierarchy();
        hierarchy = this.openComponentData(hierarchy, data, options);
        
        return hierarchy;
    };
    
    PackResourceHandler.prototype.openEntityHierarchy = function (data, options) {
        var entity = new pc.fw.Entity();

        entity.setName(data['name']);
        entity.setGuid(data['resource_id']);
        entity.setLocalPosition(data.position);
        entity.setLocalEulerAngles(data.rotation);
        entity.setLocalScale(data.scale);
        
        if (data.labels) {
            data.labels.forEach(function (label) {
                entity.addLabel(label);
            });            
        }
        
        // Parent and child data is stored temporarily until children are patched.
        entity.__parent = data.parent;
        entity.__children = data.children;

        // entity._rev = data._rev;
        // entity.version = data.version;
        entity.name = data.name;
        entity.template = data.template;
                
        // Open all children and add them to the node
        var i, child, length = data.children.length;
        for (i = 0; i < length; i++) {
            child = this.openEntityHierarchy(data.children[i], options);
            entity.addChild(child);
        }

        return entity;
    };

    PackResourceHandler.prototype.openComponentData = function (entity, data, options) {
        entity.setRequestBatch(options.batch);

        // Create Components in order
        var systems = this._registry.getComponentSystemOrder();
        var i, len = systems.length;
        for (i = 0; i < len; i++) {
            var componentData = data.components[systems[i]];
            if (componentData) {
                this._registry[systems[i]].addComponent(entity, componentData);
            }
        }

        entity.setRequestBatch(null);

        // Open all children and add them to the node
        var i, child, length = data.children.length;
        var children = entity.getChildren();
        for (i = 0; i < length; i++) {
            children[i] = this.openComponentData(children[i], data.children[i], options);
        }

        return entity;
    }
    /**
    * @name pc.fw.PackRequest
    * @class Make a request for a Pack resource
    * @param {String} identifier GUID that identifies the Pack on the server
    */
    var PackRequest = function PackRequest(identifier) {
    }
    PackRequest = pc.inherits(PackRequest, pc.resources.ResourceRequest);
    PackRequest.prototype.type = "pack";
    
    return {
        PackResourceHandler: PackResourceHandler,
        PackRequest: PackRequest
    }
}());
