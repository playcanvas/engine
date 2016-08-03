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

        this.resolution = [1,1,1]; // canvas resolution
        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:4, height:4, format:pc.PIXELFORMAT_R8_G8_B8});

        this.defaultMaterial = new pc.StandardMaterial();
        this.defaultMaterial.msdfMap = this._defaultTexture;
        this.defaultMaterial.useLighting = false;
        this.defaultMaterial.useFog = false;
        this.defaultMaterial.useGammaTonemap = false;
        this.defaultMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultMaterial.depthWrite = false;
        this.defaultMaterial.depthTest = false;
        // this.defaultMaterial.cull = pc.CULLFACE_NONE;

        this.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    TextComponentSystem = pc.inherits(TextComponentSystem, pc.ComponentSystem);

    pc.extend(TextComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.text !== undefined) component.text = data.text;
            if (data.fontAsset !== undefined) component.fontAsset = data.fontAsset;
            if (data.font !== undefined) component.font = data.font;
            if (data.color !== undefined) component.color = data.color;
            if (data.spacing !== undefined) component.spacing = data.spacing;
            if (data.lineHeight !== undefined) component.lineHeight = data.lineHeight;
            // if (data.maxWidth !== undefined) component.maxWidth = data.maxWidth;

            TextComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _onResize: function (width, height) {
            this.resolution[0] = width;
            this.resolution[1] = height;
        }
    });

    return {
        TextComponentSystem: TextComponentSystem
    }
}());
