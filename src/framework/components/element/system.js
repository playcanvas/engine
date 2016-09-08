pc.extend(pc, function () {
    /**
     * @name pc.ElementComponentSystem
     * @description Create a new ElementComponentSystem
     * @class Attach 2D text to an entity
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ElementComponentSystem = function ElementComponentSystem(app) {
        this.id = 'element';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ElementComponent;
        this.DataType = pc.ElementComponentData;

        this.schema = [ 'enabled' ];

        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:4, height:4, format:pc.PIXELFORMAT_R8_G8_B8});

        this.defaultImageMaterial = new pc.StandardMaterial();
        this.defaultImageMaterial.emissiveMap = this._defaultTexture;
        this.defaultImageMaterial.opacityMap = this._defaultTexture;
        this.defaultImageMaterial.opacityMapChannel = "a";
        this.defaultImageMaterial.opacityTint = true;
        this.defaultImageMaterial.opacity = 0.5; // use non-1 opacity to compile shader correctly
        this.defaultImageMaterial.useLighting = false;
        this.defaultImageMaterial.useGammaTonemap = false;
        this.defaultImageMaterial.useFog = false;
        this.defaultImageMaterial.useSkybox = false;
        this.defaultImageMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultImageMaterial.depthWrite = false;
        this.defaultImageMaterial.update();

        this.defaultScreenSpaceImageMaterial = new pc.StandardMaterial();
        this.defaultScreenSpaceImageMaterial.screenSpace = true;
        this.defaultScreenSpaceImageMaterial.emissiveMap = this._defaultTexture;
        this.defaultScreenSpaceImageMaterial.opacityMap = this._defaultTexture;
        this.defaultScreenSpaceImageMaterial.opacityMapChannel = "a";
        this.defaultScreenSpaceImageMaterial.opacityTint = true;
        this.defaultScreenSpaceImageMaterial.opacity = 0.5; // use non-1 opacity to compile shader correctly
        this.defaultScreenSpaceImageMaterial.useLighting = false;
        this.defaultScreenSpaceImageMaterial.useGammaTonemap = false;
        this.defaultScreenSpaceImageMaterial.useFog = false;
        this.defaultScreenSpaceImageMaterial.useSkybox = false;
        this.defaultScreenSpaceImageMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultScreenSpaceImageMaterial.depthTest = false;
        this.defaultScreenSpaceImageMaterial.depthWrite = false;
        this.defaultScreenSpaceImageMaterial.update();

        this.defaultTextMaterial = new pc.StandardMaterial();
        this.defaultTextMaterial.msdfMap = this._defaultTexture;
        this.defaultTextMaterial.useLighting = false;
        this.defaultTextMaterial.useGammaTonemap = false;
        this.defaultTextMaterial.useFog = false;
        this.defaultTextMaterial.useSkybox = false;
        this.defaultTextMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultTextMaterial.opacity = 0.5;
        this.defaultTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultTextMaterial.depthWrite = false;
        this.defaultTextMaterial.update();

        this.defaultScreenSpaceTextMaterial = new pc.StandardMaterial();
        this.defaultScreenSpaceTextMaterial.screenSpace = true;
        this.defaultScreenSpaceTextMaterial.msdfMap = this._defaultTexture;
        this.defaultScreenSpaceTextMaterial.useLighting = false;
        this.defaultScreenSpaceTextMaterial.useGammaTonemap = false;
        this.defaultScreenSpaceTextMaterial.useFog = false;
        this.defaultScreenSpaceTextMaterial.useSkybox = false;
        this.defaultScreenSpaceTextMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultScreenSpaceTextMaterial.opacity = 0.5;
        this.defaultScreenSpaceTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultScreenSpaceTextMaterial.depthWrite = false;
        this.defaultScreenSpaceTextMaterial.depthTest = false;
        this.defaultScreenSpaceTextMaterial.update();
    };
    ElementComponentSystem = pc.inherits(ElementComponentSystem, pc.ComponentSystem);

    pc.extend(ElementComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.width !== undefined) component.width = data.width;
            if (data.height !== undefined) component.height = data.height
            if (data.anchor !== undefined) {
                if (data.anchor instanceof pc.Vec4) {
                    component.anchor.copy(data.anchor);
                } else {
                    component.anchor.set(data.anchor[0], data.anchor[1], data.anchor[2], data.anchor[3]);
                }
            }
            if (data.pivot !== undefined) {
                if (data.pivot instanceof pc.Vec2) {
                    component.pivot.copy(data.pivot);
                } else {
                    component.pivot.set(data.pivot[0], data.pivot[1]);
                }
            }

            if (data.image) {
                component.type = pc.ELEMENTTYPE_IMAGE;
                if (data.image.rect !== undefined) component.image.rect = data.image.rect;
                if (data.image.materialAsset !== undefined) component.image.materialAsset = data.image.materialAsset;
                if (data.image.material !== undefined) component.image.material = data.image.material;
                if (data.image.opacity !== undefined) component.image.opacity = data.image.opacity;
                if (data.image.textureAsset !== undefined) component.image.textureAsset = data.image.textureAsset;
                if (data.image.texture !== undefined) component.image.texture = data.image.texture;
            }

            if (data.text) {
                component.type = pc.ELEMENTTYPE_TEXT;
                if (data.text.text !== undefined) component.text.text = data.text.text;
                if (data.text.color !== undefined) {
                    if (data.text.color instanceof pc.Color) {
                        component.text.color.copy(data.text.color);
                    } else {
                        component.text.color.r = data.text.color[0];
                        component.text.color.g = data.text.color[1];
                        component.text.color.b = data.text.color[2];
                        component.text.color.a = data.text.color[3];
                    }
                }
                if (data.text.spacing !== undefined) component.text.spacing = data.text.spacing;
                if (data.text.fontSize !== undefined) {
                    component.text.fontSize = data.text.fontSize;
                    if (!data.text.lineHeight) component.text.lineHeight = data.text.fontSize;
                }
                if (data.text.lineHeight !== undefined) component.text.lineHeight = data.text.lineHeight;
                if (data.text.fontAsset !== undefined) component.text.fontAsset = data.text.fontAsset;
                if (data.text.font !== undefined) component.text.font = data.text.font;
            }

            // find screen
            // do this here not in constructor so that component is added to the entity
            var screen = component._findScreen();
            if (screen) {
                component._updateScreen(screen);
            }

            ElementComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    }
}());
