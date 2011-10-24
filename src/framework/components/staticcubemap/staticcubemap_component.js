pc.extend(pc.fw, function () {

    var _cubeMapNames = [
        "posx",
        "negx",
        "posy",
        "negy",
        "posz",
        "negz"
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

    function _onSet(entity, name, oldValue, newValue) {
        function _loadTextureAsset(name, guid) {
            if(!guid)
                return;

            var index = _cubeMapNames.indexOf(name);
            var assets = this.get(entity, "assets");
            var options = {
            	batch: entity.getRequestBatch()
            };
            
            // clear existing cubemap
            this.set(entity, "cubemap", null);

            if(guid) {
                this.context.loader.request(new pc.resources.AssetRequest(guid), function (resources) {
                    assets[index] = resources[guid];
                    this.set(entity, "assets", assets);
                    
                    if(assets[0] && assets[1] && assets[2] 
                    && assets[3] && assets[4] && assets[5]) {
                        var urls = assets.map(function (asset) { 
                            return asset.getFileUrl(); 
                        });
                        var cubemap = _createCubemap(entity, this.context, urls);
                        this.set(entity, "cubemap", cubemap);
                    }
                }.bind(this), function (errors) {
                	
                }, function (progress) {
                	
                }, options);
            } else {
                delete assets[index];                
            }
        };

        var functions = {
            "posx": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                },
            "negx": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                },
            "posy": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                },
            "negy": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                },
            "posz": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                },
            "negz": function (entity, name, oldValue, newValue) { 
                    _loadTextureAsset.call(this, name, newValue) 
                }
        }

        if (functions[name]) {
            functions[name].call(this, entity, name, oldValue, newValue);
        }
    }
    
    /**
     * @name pc.fw.StaticCubeMapComponentSystem
     * @constructor Create a new StaticCubeMapComponentSystem
     * @class Creates a static cubemap from assigned images
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var StaticCubeMapComponentSystem = function StaticCubeMapComponentSystem (context) {
        context.systems.add("staticcubemap", this);
        
        this._dataDir = "../../../tests/data/";
        
        this.bind("set", pc.callback(this, _onSet));
    }
    StaticCubeMapComponentSystem = StaticCubeMapComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    StaticCubeMapComponentSystem.prototype.setDataDir = function (dir) {
        this._dataDir = dir;
    }    
    
    StaticCubeMapComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.StaticCubeMapComponentData();
        data = data || {posx: "", negx: "", posy: "", negy: "", posz: "", negz: ""};

        this.addComponent(entity, componentData);

        _cubeMapNames.forEach(function(value, index, arr) {
            this.set(entity, value, data[value]);    
        }, this);

        return componentData;
    };
    
    StaticCubeMapComponentSystem.prototype.deleteComponent = function (entity) {
        var component = this._getComponentData(entity);
        delete component.cubemap;
        this.removeComponent(entity);
    };
    
    return {
        StaticCubeMapComponentSystem: StaticCubeMapComponentSystem
    }
}());

