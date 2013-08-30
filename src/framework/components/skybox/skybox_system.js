pc.extend(pc.fw, function () {
    
    /**
     * @name pc.fw.SkyboxComponentSystem
     * @constructor Create a new SkyboxComponentSystem
     * @class Renders a cube skybox
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var SkyboxComponentSystem = function SkyboxComponentSystem (context) {
        this.id = 'skybox';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.SkyboxComponent;
        this.DataType = pc.fw.SkyboxComponentData;

        this.schema = [{
             name: "posx",
             displayName: "POSX",
             description: "URL of the positive X face of skybox cubemap",
             type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null  
            }, {
             name: "negx",
             displayName: "NEGX",
             description: "URL of the negative X face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null  
            }, {
             name: "posy",
             displayName: "POSY",
             description: "URL of the positive Y face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null  
            }, {
             name: "negy",
             displayName: "NEGY",
             description: "URL of the negative Y face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null  
            }, {
             name: "posz",
             displayName: "POSZ",
             description: "URL of the positive Z face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
                },
                defaultValue: null  
            }, {
             name: "negz",
             displayName: "NEGZ",
             description: "URL of the negative Z face of skybox cubemap",
                type: "asset",
                options: {
                    max: 1,
                    type: "texture"
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

        this.on('remove', this.onRemove, this);
    };
    SkyboxComponentSystem = pc.inherits(SkyboxComponentSystem, pc.fw.ComponentSystem);

    pc.extend(SkyboxComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            SkyboxComponentSystem._super.initializeComponentData.call(this, component, data, CUBE_MAP_NAMES);
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
    };
}());