pc.extend(pc.fw, function () {
    
    /**
     * @name pc.fw.SkyboxComponentSystem
     * @constructor Create a new SkyboxComponentSystem
     * @class Renders a cube skybox
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var SkyboxComponentSystem = function SkyboxComponentSystem (context) {
        this.id = 'skybox'
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.SkyboxComponent;
        this.DataType = pc.fw.SkyboxComponentData;

        this.schema = [{
             name: "posx",
             displayName: "POSX",
             description: "URL of the positive X face of skybox cubemap",
             type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
             name: "negx",
             displayName: "NEGX",
             description: "URL of the negative X face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
             name: "posy",
             displayName: "POSY",
             description: "URL of the positive Y face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
             name: "negy",
             displayName: "NEGY",
             description: "URL of the negative Y face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
             name: "posz",
             displayName: "POSZ",
             description: "URL of the positive Z face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
             name: "negz",
             displayName: "NEGZ",
             description: "URL of the negative Z face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1
                },
                defaultValue: null  
            }, {
                name: 'model',
                exposed: false,
                readOnly: true
            }, {
                name: 'assets',
                exposed: false,
                readOnly: true
            }
        ];

        this.exposeProperties();

        // Update the skybox to work in both game and Designer
        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onUpdate, this);

        this.on('remove', this.onRemove, this);
    }
    SkyboxComponentSystem = pc.inherits(SkyboxComponentSystem, pc.fw.ComponentSystem);

    pc.extend(SkyboxComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            SkyboxComponentSystem._super.initializeComponentData.call(this, component, data, CUBE_MAP_NAMES);
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;

                    if (componentData.model) {
                        // Create a transform that will scale the skybox to always sit
                        // in between the near and far clip planes
                        var currentCamera = this.context.systems.camera.current;
                        var midPoint = (currentCamera.camera.nearClip + currentCamera.camera.farClip) * 0.5;

                        var meshInstance = componentData.model.meshInstances[0];
                        meshInstance.node.setLocalScale(midPoint, midPoint, midPoint);
                        meshInstance.node.syncHierarchy();
                    }
                }
            }
        },

        onRemove: function (entity, data) {
            if (data.model) {
                this.context.scene.removeModel(data.model);
                entity.removeChild(data.model.getGraph());
                data.model = null;
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

    return {
        SkyboxComponentSystem: SkyboxComponentSystem
    }
}());

