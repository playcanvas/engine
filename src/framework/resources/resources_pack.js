pc.extend(pc.resources, function () {
    /**
     * @name pc.resources.PackResourceHandler
     * @class Handle requests for Pack resources
     */
    var PackResourceHandler = function (registry, depot) {
        this._registry = registry;
        this._depot = depot;
    
    };
    PackResourceHandler = pc.inherits(PackResourceHandler, pc.resources.ResourceHandler);
    
    PackResourceHandler.prototype.load = function (request, options) {
        options = options || {};
        
        var promise = new RSVP.Promise(function (resolve, reject) {
            var guid = request.canonical;
            if(guid in pc.content.packs) {
                // Get the pack from the content file
                setTimeout( function () {
                    resolve(pc.content.packs[guid]);
                }, 0);
            } else {
                // Request pack from the API
                this._depot.packs.getOne(guid, function (pack) {
                    resolve(pack);
                }.bind(this), function (errors) {
                    reject(errors);
                });
            }
        }.bind(this));

        return promise;

    };

    PackResourceHandler.prototype.open = function (data, request, options) {
        var pack = this.openPack(data, request);

        return pack;
    };
    
    PackResourceHandler.prototype.openPack = function (data, request) {
        var pack = data.hierarchy;
        return new pc.fw.Pack(this.openEntity(pack, request));
    };

    PackResourceHandler.prototype.openEntity = function (data, request) {
        var hierarchy;

        hierarchy = this.openEntityHierarchy(data, request);
        hierarchy.syncHierarchy();
        hierarchy = this.openComponentData(hierarchy, data, request);
        
        return hierarchy;
    };
    
    PackResourceHandler.prototype.openEntityHierarchy = function (data, request) {
        var entity = new pc.fw.Entity();

        entity.setName(data.name);
        entity.setGuid(data.resource_id);
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
            child = this.openEntityHierarchy(data.children[i], request);
            entity.addChild(child);
        }

        return entity;
    };

    PackResourceHandler.prototype.openComponentData = function (entity, data, request) {
        entity.setRequest(request);

        // Create Components in order
        var systems = this._registry.list();
        var i, len = systems.length;
        for (i = 0; i < len; i++) {
            var componentData = data.components[systems[i].id];
            if (componentData) {
                this._registry[systems[i].id].addComponent(entity, componentData);
            }
        }

        entity.setRequest(null);

        // Open all children and add them to the node
        var child, length = data.children.length;
        var children = entity.getChildren();
        for (i = 0; i < length; i++) {
            children[i] = this.openComponentData(children[i], data.children[i], request);
        }

        return entity;
    };

    /**
    * @name pc.resources.PackRequest
    * @class Make a request for a Pack resource
    * @param {String} identifier GUID that identifies the Pack on the server
    * @example
    * var guid = ...; // get pack GUID from somewhere
    * var r = new pc.resources.PackRequest(guid);
    * context.loader.request(r).then(function (resources) {
    *     var pack = resources[0];
    * });
    */
    var PackRequest = function PackRequest(identifier) {
    };
    PackRequest = pc.inherits(PackRequest, pc.resources.ResourceRequest);
    PackRequest.prototype.type = "pack";
    PackRequest.prototype.Type = pc.fw.Pack;
        
    return {
        PackResourceHandler: PackResourceHandler,
        PackRequest: PackRequest
    };
}());
