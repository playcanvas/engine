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

        this.on('beforeremove', this.onRemoveComponent, this);
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

            component.type = data.type;
            if (component.type === pc.ELEMENTTYPE_IMAGE) {
                if (data.rect !== undefined) {
                    if (data.rect instanceof pc.Vec4) {
                        component.rect.copy(data.rect);
                    } else {
                        component.rect.set(data.rect[0], data.rect[1], data.rect[2], data.rect[3])
                    }
                }
                if (data.materialAsset !== undefined) component.materialAsset = data.materialAsset;
                if (data.material !== undefined) component.material = data.material;
                if (data.opacity !== undefined) component.opacity = data.opacity;
                if (data.textureAsset !== undefined) component.textureAsset = data.textureAsset;
                if (data.texture !== undefined) component.texture = data.texture;
            } else if(component.type === pc.ELEMENTTYPE_TEXT) {
                if (data.text !== undefined) component.text = data.text;
                if (data.color !== undefined) {
                    if (data.color instanceof pc.Color) {
                        component.color.copy(data.color);
                    } else {
                        component.color.r = data.color[0];
                        component.color.g = data.color[1];
                        component.color.b = data.color[2];
                        component.color.a = data.color[3];
                    }
                }
                if (data.spacing !== undefined) component.spacing = data.spacing;
                if (data.fontSize !== undefined) {
                    component.fontSize = data.fontSize;
                    if (!data.lineHeight) component.lineHeight = data.fontSize;
                }
                if (data.lineHeight !== undefined) component.lineHeight = data.lineHeight;
                if (data.fontAsset !== undefined) component.fontAsset = data.fontAsset;
                if (data.font !== undefined) component.font = data.font;
            } else {
                // group
            }

            // find screen
            // do this here not in constructor so that component is added to the entity
            var screen = component._findScreen();
            if (screen) {
                component._updateScreen(screen);
            }

            ElementComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    }
}());
