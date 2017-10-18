pc.extend(pc, function () {
    var _schema = [ 'enabled' ];

    /**
     * @name pc.ElementComponentSystem
     * @class Manages creation of {@link pc.ElementComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ElementComponentSystem = function ElementComponentSystem(app) {
        this.id = 'element';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ElementComponent;
        this.DataType = pc.ElementComponentData;

        this.schema = _schema;

        // default texture - make white so we can tint it with emissive color
        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:1, height:1, format:pc.PIXELFORMAT_R8_G8_B8_A8});
        var pixels = this._defaultTexture.lock();
        var pixelData = new Uint8Array(4);
        pixelData[0] = 255.0;
        pixelData[1] = 255.0;
        pixelData[2] = 255.0;
        pixelData[3] = 255.0;
        pixels.set(pixelData);
        this._defaultTexture.unlock();

        this.defaultImageMaterial = new pc.StandardMaterial();
        this.defaultImageMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
        this.defaultImageMaterial.emissive = new pc.Color(0.5,0.5,0.5,1); // use non-white to compile shader correctly
        this.defaultImageMaterial.emissiveMap = this._defaultTexture;
        this.defaultImageMaterial.emissiveMapTint = true;
        this.defaultImageMaterial.opacityMap = this._defaultTexture;
        this.defaultImageMaterial.opacityMapChannel = "a";
        this.defaultImageMaterial.opacityTint = true;
        this.defaultImageMaterial.opacity = 0; // use non-1 opacity to compile shader correctly
        this.defaultImageMaterial.useLighting = false;
        this.defaultImageMaterial.useGammaTonemap = false;
        this.defaultImageMaterial.useFog = false;
        this.defaultImageMaterial.useSkybox = false;
        this.defaultImageMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultImageMaterial.depthWrite = false;
        this.defaultImageMaterial.update();

        this.defaultScreenSpaceImageMaterial = new pc.StandardMaterial();
        this.defaultScreenSpaceImageMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
        this.defaultScreenSpaceImageMaterial.emissive = new pc.Color(0.5,0.5,0.5,1); // use non-white to compile shader correctly
        this.defaultScreenSpaceImageMaterial.emissiveMap = this._defaultTexture;
        this.defaultScreenSpaceImageMaterial.emissiveMapTint = true;
        this.defaultScreenSpaceImageMaterial.opacityMap = this._defaultTexture;
        this.defaultScreenSpaceImageMaterial.opacityMapChannel = "a";
        this.defaultScreenSpaceImageMaterial.opacityTint = true;
        this.defaultScreenSpaceImageMaterial.opacity = 0; // use non-1 opacity to compile shader correctly
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
        this.defaultTextMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
        this.defaultTextMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultTextMaterial.opacity = 0.5;
        this.defaultTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultTextMaterial.depthWrite = false;
        this.defaultTextMaterial.update();

        this.defaultScreenSpaceTextMaterial = new pc.StandardMaterial();
        this.defaultScreenSpaceTextMaterial.msdfMap = this._defaultTexture;
        this.defaultScreenSpaceTextMaterial.useLighting = false;
        this.defaultScreenSpaceTextMaterial.useGammaTonemap = false;
        this.defaultScreenSpaceTextMaterial.useFog = false;
        this.defaultScreenSpaceTextMaterial.useSkybox = false;
        this.defaultScreenSpaceTextMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
        this.defaultScreenSpaceTextMaterial.emissive = new pc.Color(1,1,1,1);
        this.defaultScreenSpaceTextMaterial.opacity = 0.5;
        this.defaultScreenSpaceTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultScreenSpaceTextMaterial.depthWrite = false;
        this.defaultScreenSpaceTextMaterial.depthTest = false;
        this.defaultScreenSpaceTextMaterial.update();

        this.on('beforeremove', this.onRemoveComponent, this);
    };
    ElementComponentSystem = pc.inherits(ElementComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ElementComponent.prototype, _schema);

    pc.extend(ElementComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
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

            var splitHorAnchors = Math.abs(component.anchor.x - component.anchor.z) > 0.001;
            var splitVerAnchors = Math.abs(component.anchor.y - component.anchor.w) > 0.001;
            var _marginChange = false;

            if (data.margin !== undefined) {
                if (data.margin instanceof pc.Vec4) {
                    component.margin.copy(data.margin);
                } else {
                    component._margin.set(data.margin[0], data.margin[1], data.margin[2], data.margin[3]);
                }

                _marginChange = true;
            }

            if (data.left !== undefined) {
                component._margin.x = data.left;
                _marginChange = true;
            }
            if (data.bottom !== undefined) {
                component._margin.y = data.bottom;
                _marginChange = true;
            }
            if (data.right !== undefined) {
                component._margin.z = data.right;
                _marginChange = true;
            }
            if (data.top !== undefined) {
                component._margin.w = data.top;
                _marginChange = true;
            }
            if (_marginChange) {
                // force update
                component.margin = component._margin;
            }

            if (data.width !== undefined && ! splitHorAnchors) {
                // force update
                component.width = data.width;
            }
            if (data.height !== undefined && ! splitVerAnchors) {
                // force update
                component.height = data.height;
            }

            if (data.enabled !== undefined) {
                component.enabled = data.enabled;
            }

            if (data.useInput !== undefined) {
                component.useInput = data.useInput;
            }

            component.type = data.type;
            if (component.type === pc.ELEMENTTYPE_IMAGE) {
                if (data.rect !== undefined) {
                    if (data.rect instanceof pc.Vec4) {
                        component.rect.copy(data.rect);
                    } else {
                        component.rect.set(data.rect[0], data.rect[1], data.rect[2], data.rect[3]);
                    }
                }
                if (data.color !== undefined) {
                    if (data.color instanceof pc.Color) {
                        component.color.set(data.color.data[0], data.color.data[1], data.color.data[2], data.opacity !== undefined ? data.opacity : 1);
                    } else {
                        component.color.set(data.color[0], data.color[1], data.color[2], data.opacity !== undefined ? data.opacity : 1);
                    }
                    // force update
                    component.color = component.color;
                }
                if (data.opacity !== undefined) {
                    component.opacity = data.opacity;
                }
                if (data.textureAsset !== undefined) component.textureAsset = data.textureAsset;
                if (data.texture) component.texture = data.texture;
                if (data.materialAsset !== undefined) component.materialAsset = data.materialAsset;
                if (data.material) component.material = data.material;
            } else if(component.type === pc.ELEMENTTYPE_TEXT) {
                if (data.text !== undefined) component.text = data.text;
                if (data.color !== undefined) {
                    if (data.color instanceof pc.Color) {
                        component.color.set(data.color.data[0], data.color.data[1], data.color.data[2], data.opacity !== undefined ? data.opacity : 1);
                    } else {
                        component.color.set(data.color[0], data.color[1], data.color[2], data.opacity !== undefined ? data.opacity : 1);
                    }
                    // force update
                    component.color = component.color;
                }
                if (data.opacity !== undefined) {
                    component.opacity = data.opacity;
                }
                if (data.spacing !== undefined) component.spacing = data.spacing;
                if (data.fontSize !== undefined) {
                    component.fontSize = data.fontSize;
                    if (!data.lineHeight) component.lineHeight = data.fontSize;
                }
                if (data.lineHeight !== undefined) component.lineHeight = data.lineHeight;
                if (data.fontAsset !== undefined) component.fontAsset = data.fontAsset;
                if (data.font !== undefined) component.font = data.font;
                if (data.alignment !== undefined) component.alignment = data.alignment;
                if (data.autoWidth !== undefined) component.autoWidth = data.autoWidth;
                if (data.autoHeight !== undefined) component.autoHeight = data.autoHeight;
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
        },

        cloneComponent: function (entity, clone) {
            var source = entity.element;

            return this.addComponent(clone, {
                enabled: source.enabled,
                width: source.width,
                height: source.height,
                anchor: source.anchor.clone(),
                pivot: source.pivot.clone(),
                margin: source.margin.clone(),
                alignment: source.alignment && source.alignment.clone() || source.alignment,
                autoWidth: source.autoWidth,
                autoHeight: source.autoHeight,
                type: source.type,
                rect: source.rect && source.rect.clone() || source.rect,
                materialAsset: source.materialAsset,
                material: source.material,
                color: source.color && source.color.clone() || source.color,
                opacity: source.opacity,
                textureAsset: source.textureAsset,
                texture: source.texture,
                text: source.text,
                spacing: source.spacing,
                lineHeight: source.lineHeight,
                fontSize: source.fontSize,
                fontAsset: source.fontAsset,
                font: source.font,
                useInput: source.useInput
            });
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    };
}());
