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
        var pack = this.openEntity(data, options);

        return pack;
    };
    
    PackResourceHandler.prototype.openEntity = function (data, options) {
        var guid = data.resource_id;

        options = options || {};
    	options.priority = options.priority || 1; // default priority of 1
        options.batch = options.batch || null;
        
        var entity = new pc.fw.Entity();

        entity.setName(data.name);
        entity.setGuid(guid);
        if (data.transform) {
            entity.setLocalTransform(pc.math.mat4.clone(data.transform));    
        } else {
            entity.setLocalTransform(pc.math.mat4.clone(pc.math.mat4.compose(data['translate'], data['rotate'], data['scale'])));
        }
        
        
        if (data.labels) {
            data.labels.forEach(function (label) {
                entity.addLabel(label);
            });            
        }
        
        // Parent and child data is stored temporarily until children are patched.
        entity.__parent = data.parent;
        entity.__children = data.children;

        entity._rev = data._rev;
        entity.version = data.version;
        entity.name = data.name;
        entity.template = data.template;
        
        entity.setRequestBatch(options.batch);
        // Load component data
        for (name in data.components) {
            if (data.components.hasOwnProperty(name)) {
                if (this._registry[name]) {
                    component = this._registry[name].createComponent(entity, data.components[name]);
                } else {
                    logWARNING(name + " Component does not exist.");
                }
            }
        }
        entity.setRequestBatch(null);
        
        // Open all children and add them to the node
        var i, child, length = data.children.length;
        for (i = 0; i < length; i++) {
            child = this.openEntity(data.children[i], options);
            entity.addChild(child);
        }

        return entity;
    };
    
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
