pc.extend(pc.fw, function () {    
    /**
     * @private
     * @name pc.fw.StaticCubeMapComponentSystem
     * @constructor Create a new StaticCubeMapComponentSystem
     * @class Creates a static cubemap from assigned images
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.ComponentSystem
     */
    var StaticCubeMapComponentSystem = function StaticCubeMapComponentSystem (context) {
        this.id = "staticcubemap"
        context.systems.add(this.id, this);
    
        this.schema = [{
         name: "posx",
         displayName: "POSX",
         description: "URL of the positive X face of cubemap",
         type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
         name: "negx",
         displayName: "NEGX",
         description: "URL of the negative X face of cubemap",
            type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
         name: "posy",
         displayName: "POSY",
         description: "URL of the positive Y face of cubemap",
            type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
         name: "negy",
         displayName: "NEGY",
         description: "URL of the negative Y face of cubemap",
            type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
         name: "posz",
         displayName: "POSZ",
         description: "URL of the positive Z face of cubemap",
            type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
         name: "negz",
         displayName: "NEGZ",
         description: "URL of the negative Z face of cubemap",
            type: "asset",
            options: {
                max: 1,
                type: "texture"
            },
            defaultValue: null  
        }, {
            name: "assets",
            exposed: false
        }, {
            name: "cubemap",
            exposed: false
        }];

        this.exposeProperties();

        this.ComponentType = pc.fw.StaticCubeMapComponent;
        this.DataType = pc.fw.StaticCubeMapComponentData;
    };
    StaticCubeMapComponentSystem = pc.inherits(StaticCubeMapComponentSystem, pc.fw.ComponentSystem);
        
    pc.extend(StaticCubeMapComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            StaticCubeMapComponentSystem._super.initializeComponentData.call(this, component, data, CUBE_MAP_NAMES);
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
        StaticCubeMapComponentSystem: StaticCubeMapComponentSystem
    }
}());

