pc.extend(pc.fw, function () {

    
    
    /**
     * @name pc.fw.StaticCubeMapComponentSystem
     * @constructor Create a new StaticCubeMapComponentSystem
     * @class Creates a static cubemap from assigned images
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var StaticCubeMapComponent = function StaticCubeMapComponent () {
        this.bind("set", this.onSet.bind(this));
    };
    StaticCubeMapComponent = pc.inherits(StaticCubeMapComponent, pc.fw.Component);
    
    pc.extend(StaticCubeMapComponent.prototype, {
        onSet: function (name, oldValue, newValue) {
            function _loadTextureAsset(name, guid) {
                if(!guid)
                    return;

                var index = CUBE_MAP_NAMES.indexOf(name);
                var assets = this.assets;
                var options = {
                    batch: this.entity.getRequestBatch()
                };
                
                // clear existing cubemap
                //this.set(entity, "cubemap", null);
                this.cubemap = null;

                if(guid) {
                    this.system.context.loader.request(new pc.resources.AssetRequest(guid), function (resources) {
                        assets[index] = resources[guid];
                        //this.set(entity, "assets", assets);
                        this.assets = assets;

                        if(assets[0] && assets[1] && assets[2] 
                        && assets[3] && assets[4] && assets[5]) {
                            var urls = assets.map(function (asset) { 
                                return asset.getFileUrl(); 
                            });
                            var cubemap = _createCubemap(this.entity, this.system.context, urls);
                            //this.set(entity, "cubemap", cubemap);
                            this.cubemap = cubemap;
                        }
                    }.bind(this), function (errors) {
                        
                    }, function (progress) {
                        
                    }, options);
                } else {
                    delete assets[index];                
                }
            };

            var functions = {
                "posx": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    },
                "negx": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    },
                "posy": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    },
                "negy": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    },
                "posz": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    },
                "negz": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue) 
                    }
            }

            if (functions[name]) {
                functions[name].call(this, name, oldValue, newValue);
            }
        }
    });

    var CUBE_MAP_NAMES = [
        'posx',
        'negx',
        'posy',
        'negy',
        'posz',
        'negz'
    ];

    // Private    
    var _createCubemap = function (entity, context, urls) {
        var texture = new pc.gfx.TextureCube();
        texture.setFilterMode(pc.gfx.TextureFilter.LINEAR_MIPMAP_LINEAR, pc.gfx.TextureFilter.LINEAR);
        texture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        
        var requests = urls.map(function (url) {
            return new pc.resources.ImageRequest(url);
        });
        var options = {
            batch: entity.getRequestBatch()
        };
        context.loader.request(requests, function (resources) {
            var images = urls.map(function (url) {
                return resources[url];
            });
            texture.setSource(images);
        }.bind(this), function (errors) {
        }, function (progress) {
        }, options);
        
        return texture;
    };

    return {
        StaticCubeMapComponent: StaticCubeMapComponent
    }
}());