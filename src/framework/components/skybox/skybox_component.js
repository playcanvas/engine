pc.extend(pc.fw, function () {

    var _cubeMapNames = [
        'posx',
        'negx',
        'posy',
        'negy',
        'posz',
        'negz'
    ];

    // Private    
    var _createSkybox = function (entity, context, urls) {
        var vertSrc = [
            "attribute vec3 vertex_position;",
            "uniform mat4 matrix_projection;",
            "uniform mat4 matrix_view;",
            "uniform mat4 matrix_model;",
            "varying vec3 vViewDir;",
            "",
            "void main(void)",
            "{",
            "    mat4 viewMat = matrix_view;",
            // We only want the rotational part of the view matrix
            "    viewMat[3][0] = viewMat[3][1] = viewMat[3][2] = 0.0;",
            "    gl_Position = matrix_projection * viewMat * matrix_model * vec4(vertex_position, 1.0);",
            "    vViewDir = vertex_position;",
            "}"
        ].join("\n");

        var fragSrc = [
            "precision mediump float;",
            "",
            "varying vec3 vViewDir;",
            "uniform samplerCube texture_cubeMap;",
            "",
            "void main(void)",
            "{",
            "    gl_FragColor = textureCube(texture_cubeMap, normalize(vViewDir));",
            "}"
        ].join("\n");

        var vertexShader   = new pc.gfx.Shader(pc.gfx.ShaderType.VERTEX, vertSrc);
        var fragmentShader = new pc.gfx.Shader(pc.gfx.ShaderType.FRAGMENT, fragSrc);
        var program        = new pc.gfx.Program(vertexShader, fragmentShader);

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
    
    function _onSet(entity, name, oldValue, newValue) {
        function _loadTextureAsset(name, guid) {
            if(!guid)
                return;

            var index = _cubeMapNames.indexOf(name);
            var assets = this.get(entity, "assets");
            var options = {
            	batch: entity.getRequestBatch()
            };
            // clear existing skybox
            this.set(entity, "skybox", null);

            if(guid) {
            	this.context.loader.request(new pc.resources.AssetRequest(guid), function (resources) {
                	assets[index] = resources[guid];
                	this.set(entity, "assets", assets);
                    if(assets[0] && assets[1] && assets[2] 
                    && assets[3] && assets[4] && assets[5]) {
                        var urls = assets.map(function (asset) { 
                            return asset.getFileUrl();
                        });
                        var skybox = _createSkybox(entity, this.context, urls);
                        this.set(entity, "skybox", skybox);
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
     * @name pc.fw.SkyboxComponentSystem
     * @constructor Create a new SkyboxComponentSystem
     * @class Renders a cube skybox
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var SkyboxComponentSystem = function SkyboxComponentSystem (context) {
        context.systems.add("skybox", this);

        this.bind("set", pc.callback(this, _onSet));
    }
    SkyboxComponentSystem = SkyboxComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    SkyboxComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.SkyboxComponentData();

        this.initialiseComponent(entity, componentData, data, _cubeMapNames);

        return componentData;
    };

    SkyboxComponentSystem.prototype.deleteComponent = function (entity) {
        var component = this.getComponentData(entity);
        delete component.skybox;
        this.removeComponent(entity);
    };

    SkyboxComponentSystem.prototype.update = function (dt) {
        var components = this.getComponents();

        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = components[id].component;

                if (componentData.skybox) {
                    this.context.scene.enqueue('first', (function (context, skybox) {
                            return function () {
                                // Create a transform that will scale the skybox to always sit
                                // in between the near and far clip planes
                                var camSys = context.systems.camera;
                                var currentCamera = camSys.getCurrent();
                                var near = camSys.get(currentCamera, 'nearClip');
                                var far = camSys.get(currentCamera, 'farClip');
                                var average = (near + far) * 0.5;

                                // Set the scale - easy since the matrix is identity
                                var wtm = skybox.getWorldTransform();
                                wtm[0] = average;
                                wtm[5] = average;
                                wtm[10] = average;
                                skybox.dispatch();
                            }
                        })(this.context, componentData.skybox));
                }
            }
        }
    };

    return {
        SkyboxComponentSystem: SkyboxComponentSystem
    }
}());

