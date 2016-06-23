pc.extend(pc, function () {
    /**
     * @name pc.TextComponentSystem
     * @description Create a new TextComponentSystem
     * @class Attach 2D text to an entity
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var TextComponentSystem = function TextComponentSystem(app) {
        this.id = 'text';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.TextComponent;
        this.DataType = pc.TextComponentData;

        this.schema = [ 'enabled' ];

        this.material = null;
        this._shader = null;
        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:4, height:4, format:pc.PIXELFORMAT_R8_G8_B8});
    };
    TextComponentSystem = pc.inherits(TextComponentSystem, pc.ComponentSystem);

    pc.extend(TextComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            this._createMaterial();

            if (data.text !== undefined) component.text = data.text;
            if (data.asset !== undefined) component.asset = data.asset;
            // if (data.textureAsset !== undefined) component.textureAsset = data.textureAsset;
            // if (data.jsonAsset !== undefined) component.jsonAsset = data.jsonAsset;
            if (data.color !== undefined) component.color = data.color;

            TextComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _createMaterial: function () {
            if (!this.material || !this._shader) {
                // create shared shader and material

                var precision = "precision " + this.app.graphicsDevice.precision + " float;";

                // A shader definition used to create a new shader.
                var shaderDefinition = {
                    attributes: {
                        aPosition: pc.gfx.SEMANTIC_POSITION,
                        aUv0: pc.gfx.SEMANTIC_TEXCOORD0
                    },
                    vshader: pc.shaderChunks.msdfVS,
                    fshader: pc.shaderChunks.msdfPS.replace("[PRECISION]", precision)
                };

                // Create the shader from the definition
                this._shader = new pc.gfx.Shader(this.app.graphicsDevice, shaderDefinition);

                this.material = new pc.Material();
                this.material.setShader(this._shader);

                this.material.setParameter("texture_atlas", this._defaultTexture);
                this.material.setParameter("material_background", [0,0,0,0]);
                this.material.setParameter("material_foreground", [0.9,0.8,0,1]);
                this.material.blendType = pc.BLEND_PREMULTIPLIED;
            }
        }
    });

    return {
        TextComponentSystem: TextComponentSystem
    }
}());
