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
        this.defaultMaterial.useGammaTonemap = false;
        this.defaultMaterial.useFog = false;
        this.defaultMaterial.useSkybox = false;
        this.defaultMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultMaterial.opacity = 0.5;
        this.defaultMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultMaterial.depthWrite = false;
        this.defaultMaterial.update();

        this.defaultScreenSpaceMaterial = new pc.StandardMaterial();
        this.defaultScreenSpaceMaterial.screenSpace = true;
        this.defaultScreenSpaceMaterial.msdfMap = this._defaultTexture;
        this.defaultScreenSpaceMaterial.useLighting = false;
        this.defaultScreenSpaceMaterial.useGammaTonemap = false;
        this.defaultScreenSpaceMaterial.useFog = false;
        this.defaultScreenSpaceMaterial.useSkybox = false;
        this.defaultScreenSpaceMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultScreenSpaceMaterial.opacity = 0.5;
        this.defaultScreenSpaceMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultScreenSpaceMaterial.depthWrite = false;
        this.defaultScreenSpaceMaterial.depthTest = false;
        this.defaultScreenSpaceMaterial.update();

        // listen for adding and removing element components and pass this on to image components
        var elementSystem = app.systems.element;
        if (elementSystem) {
            elementSystem.on('add', this._onAddElement, this);
            elementSystem.on('remove', this._onRemoveElement, this);
        }
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

        _onAddElement: function (entity, component) {
            if (entity.text) entity.text._onAddElement(component);
        },

        _onRemoveElement: function (entity) {
            if (entity.text) entity.text._onRemoveElement();
        }
    });

    return {
        TextComponentSystem: TextComponentSystem
    }
}());
