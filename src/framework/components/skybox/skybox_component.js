pc.extend(pc.fw, function () {    
    /**
     * @component
     * @name pc.fw.SkyboxComponent
     * @constructor Create a new SkyboxComponentS
     * @class Renders a cube skybox
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.Component
     */
    var SkyboxComponent = function SkyboxComponent () {
        this.bind("set", this.onSet.bind(this));
    }
    SkyboxComponent = pc.inherits(SkyboxComponent, pc.fw.Component);

    pc.extend(SkyboxComponent.prototype, {
        onSet: function (name, oldValue, newValue) {
            function _loadTextureAsset(name, guid) {
                if(!guid)
                    return;

                var index = CUBE_MAP_NAMES.indexOf(name);
                var assets = this.entity.skybox.assets;
                var options = {
                    batch: this.entity.getRequestBatch()
                };
                
                // clear existing skybox
                this.data.skybox = null;
                
                if(guid) {
                    this.system.context.loader.request(new pc.resources.AssetRequest(guid), function (resources) {
                        assets[index] = resources[guid];
                        this.data.assets = assets;
                        
                        // Once all assets are loaded create the skybox
                        if(assets[0] && assets[1] && assets[2] 
                        && assets[3] && assets[4] && assets[5]) {
                            var urls = assets.map(function (asset) { 
                                return asset.getFileUrl();
                            });
                            this.data.skybox = _createSkybox(this.entity, this.system.context, urls);
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
                functions[name].call(this, this.entity, name, oldValue, newValue);
            }
        }    
    });

    // Private    
    var _createSkybox = function (entity, context, urls) {
        var library = pc.gfx.Device.getCurrent().getProgramLibrary();
        var program = library.getProgram('skybox');

        var texture = new pc.gfx.TextureCube();
        texture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
        texture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        
        var skyMat = new pc.scene.Material();
        skyMat.setState({
            cull: false,
            depthWrite: false
        });
        skyMat.setProgram(program);
        skyMat.setParameter("texture_cubeMap", texture);

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
        }, function (errors) {
            
        }, function (progress) {
            
        }, options);

        var geom = pc.scene.procedural.createBox({material: skyMat, halfExtents: [1, 1, 1]});
        
        var skybox = new pc.scene.MeshNode();
        skybox.setGeometry(geom);
        
        return skybox;
    };

    var CUBE_MAP_NAMES = [
        'posx',
        'negx',
        'posy',
        'negy',
        'posz',
        'negz'
    ];

    return {
        SkyboxComponent: SkyboxComponent
    }
}());

