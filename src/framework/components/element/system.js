Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @constructor
     * @name pc.ElementComponentSystem
     * @classdesc Manages creation of {@link pc.ElementComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ElementComponentSystem = function ElementComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'element';
        this.app = app;

        this.ComponentType = pc.ElementComponent;
        this.DataType = pc.ElementComponentData;

        this.schema = _schema;
        this._unicodeConverter = null;
        this._rtlReorder = null;

        // default texture - make white so we can tint it with emissive color
        this._defaultTexture = new pc.Texture(app.graphicsDevice, { width: 1, height: 1, format: pc.PIXELFORMAT_R8_G8_B8_A8 });
        this._defaultTexture.name = 'element-system';
        var pixels = this._defaultTexture.lock();
        var pixelData = new Uint8Array(4);
        pixelData[0] = 255.0;
        pixelData[1] = 255.0;
        pixelData[2] = 255.0;
        pixelData[3] = 255.0;
        pixels.set(pixelData);
        this._defaultTexture.unlock();

        // image element materials created on demand by getImageElementMaterial()
        this.defaultImageMaterial = null;
        this.defaultImage9SlicedMaterial = null;
        this.defaultImage9TiledMaterial = null;
        this.defaultImageMaskMaterial = null;
        this.defaultImage9SlicedMaskMaterial = null;
        this.defaultImage9TiledMaskMaterial = null;
        this.defaultScreenSpaceImageMaterial = null;
        this.defaultScreenSpaceImage9SlicedMaterial = null;
        this.defaultScreenSpaceImage9TiledMaterial = null;
        this.defaultScreenSpaceImageMask9SlicedMaterial = null;
        this.defaultScreenSpaceImageMask9TiledMaterial = null;
        this.defaultScreenSpaceImageMaskMaterial = null;

        // text element materials created on demand by getTextElementMaterial()
        this.defaultTextMaterial = null;
        this.defaultBitmapTextMaterial = null;
        this.defaultScreenSpaceTextMaterial = null;
        this.defaultScreenSpaceBitmapTextMaterial = null;

        this.defaultImageMaterials = [];

        this.on('beforeremove', this.onRemoveComponent, this);
    };
    ElementComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ElementComponentSystem.prototype.constructor = ElementComponentSystem;

    pc.Component._buildAccessors(pc.ElementComponent.prototype, _schema);

    Object.assign(ElementComponentSystem.prototype, {
        destroy: function () {
            this._defaultTexture.destroy();
        },

        initializeComponentData: function (component, data, properties) {
            component._beingInitialized = true;

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
            var color;

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

            var shouldForceSetAnchor = false;

            if (data.width !== undefined && !splitHorAnchors) {
                // force update
                component.width = data.width;
            } else if (splitHorAnchors) {
                shouldForceSetAnchor = true;
            }
            if (data.height !== undefined && !splitVerAnchors) {
                // force update
                component.height = data.height;
            } else if (splitVerAnchors) {
                shouldForceSetAnchor = true;
            }

            if (shouldForceSetAnchor) {
                /* eslint-disable no-self-assign */
                // force update
                component.anchor = component.anchor;
                /* eslint-enable no-self-assign */
            }

            if (data.enabled !== undefined) {
                component.enabled = data.enabled;
            }

            if (data.useInput !== undefined) {
                component.useInput = data.useInput;
            }

            component.batchGroupId = data.batchGroupId === undefined || data.batchGroupId === null ? -1 : data.batchGroupId;

            if (data.layers && pc.type(data.layers) === 'array') {
                component.layers = data.layers.slice(0);
            }

            component.type = data.type;
            if (component.type === pc.ELEMENTTYPE_IMAGE) {
                if (data.rect !== undefined) {
                    component.rect = data.rect;
                }
                if (data.color !== undefined) {
                    color = data.color;
                    if (! (color instanceof pc.Color)) {
                        color = new pc.Color(data.color[0], data.color[1], data.color[2]);
                    }
                    component.color = color;
                }

                if (data.opacity !== undefined) component.opacity = data.opacity;
                if (data.textureAsset !== undefined) component.textureAsset = data.textureAsset;
                if (data.texture) component.texture = data.texture;
                if (data.spriteAsset !== undefined) component.spriteAsset = data.spriteAsset;
                if (data.sprite) component.sprite = data.sprite;
                if (data.spriteFrame !== undefined) component.spriteFrame = data.spriteFrame;
                if (data.pixelsPerUnit !== undefined && data.pixelsPerUnit !== null) component.pixelsPerUnit = data.pixelsPerUnit;
                if (data.materialAsset !== undefined) component.materialAsset = data.materialAsset;
                if (data.material) component.material = data.material;

                if (data.mask !== undefined) {
                    component.mask = data.mask;
                }
            } else if (component.type === pc.ELEMENTTYPE_TEXT) {
                if (data.autoWidth !== undefined) component.autoWidth = data.autoWidth;
                if (data.autoHeight !== undefined) component.autoHeight = data.autoHeight;
                if (data.rtlReorder !== undefined) component.rtlReorder = data.rtlReorder;
                if (data.unicodeConverter !== undefined) component.unicodeConverter = data.unicodeConverter;
                if (data.text !== null && data.text !== undefined) {
                    component.text = data.text;
                } else if (data.key !== null && data.key !== undefined) {
                    component.key = data.key;
                }
                if (data.color !== undefined) {
                    color = data.color;
                    if (! (color instanceof pc.Color)) {
                        color = new pc.Color(color[0], color[1], color[2]);
                    }
                    component.color = color;
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
                if (data.maxLines !== undefined) component.maxLines = data.maxLines;
                if (data.wrapLines !== undefined) component.wrapLines = data.wrapLines;
                if (data.minFontSize !== undefined) component.minFontSize = data.minFontSize;
                if (data.maxFontSize !== undefined) component.maxFontSize = data.maxFontSize;
                if (data.autoFitWidth) component.autoFitWidth = data.autoFitWidth;
                if (data.autoFitHeight) component.autoFitHeight = data.autoFitHeight;
                if (data.fontAsset !== undefined) component.fontAsset = data.fontAsset;
                if (data.font !== undefined) component.font = data.font;
                if (data.alignment !== undefined) component.alignment = data.alignment;
                if (data.outlineColor !== undefined) component.outlineColor = data.outlineColor;
                if (data.outlineThickness !== undefined) component.outlineThickness = data.outlineThickness;
                if (data.shadowColor !== undefined) component.shadowColor = data.shadowColor;
                if (data.shadowOffset !== undefined) component.shadowOffset = data.shadowOffset;
                if (data.enableMarkup !== undefined) component.enableMarkup = data.enableMarkup;
            } else {
                // group
            }


            // find screen
            // do this here not in constructor so that component is added to the entity
            var result = component._parseUpToScreen();
            if (result.screen) {
                component._updateScreen(result.screen);
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);

            component._beingInitialized = false;

            if (component.type === pc.ELEMENTTYPE_IMAGE && component._image._meshDirty) {
                component._image._updateMesh(component._image.mesh);
            }
        },

        onRemoveComponent: function (entity, component) {
            component.onRemove();
        },

        cloneComponent: function (entity, clone) {
            var source = entity.element;

            var data = {
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
                rtlReorder: source.rtlReorder,
                unicodeConverter: source.unicodeConverter,
                materialAsset: source.materialAsset,
                material: source.material,
                color: source.color && source.color.clone() || source.color,
                opacity: source.opacity,
                textureAsset: source.textureAsset,
                texture: source.texture,
                spriteAsset: source.spriteAsset,
                sprite: source.sprite,
                spriteFrame: source.spriteFrame,
                pixelsPerUnit: source.pixelsPerUnit,
                spacing: source.spacing,
                lineHeight: source.lineHeight,
                wrapLines: source.wrapLines,
                layers: source.layers,
                fontSize: source.fontSize,
                minFontSize: source.minFontSize,
                maxFontSize: source.maxFontSize,
                autoFitWidth: source.autoFitWidth,
                autoFitHeight: source.autoFitHeight,
                maxLines: source.maxLines,
                fontAsset: source.fontAsset,
                font: source.font,
                useInput: source.useInput,
                batchGroupId: source.batchGroupId,
                mask: source.mask,
                outlineColor: source.outlineColor && source.outlineColor.clone() || source.outlineColor,
                outlineThickness: source.outlineThickness,
                shadowColor: source.shadowColor && source.shadowColor.clone() || source.shadowColor,
                shadowOffset: source.shadowOffset && source.shadowOffset.clone() || source.shadowOffset,
                enableMarkup: source.enableMarkup
            };

            if (source.key !== undefined && source.key !== null) {
                data.key = source.key;
            } else {
                data.text = source.text;
            }

            return this.addComponent(clone, data);
        },

        getTextElementMaterial: function (screenSpace, msdf) {
            if (screenSpace) {
                if (msdf) {
                    if (!this.defaultScreenSpaceTextMaterial) {
                        this.defaultScreenSpaceTextMaterial = new pc.StandardMaterial();
                        this.defaultScreenSpaceTextMaterial.name = "defaultScreenSpaceTextMaterial";
                        this.defaultScreenSpaceTextMaterial.msdfMap = this._defaultTexture;
                        this.defaultScreenSpaceTextMaterial.useLighting = false;
                        this.defaultScreenSpaceTextMaterial.useGammaTonemap = false;
                        this.defaultScreenSpaceTextMaterial.useFog = false;
                        this.defaultScreenSpaceTextMaterial.useSkybox = false;
                        this.defaultScreenSpaceTextMaterial.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
                        this.defaultScreenSpaceTextMaterial.emissive.set(1, 1, 1);
                        this.defaultScreenSpaceTextMaterial.opacity = 0.5;
                        this.defaultScreenSpaceTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
                        this.defaultScreenSpaceTextMaterial.depthWrite = false;
                        this.defaultScreenSpaceTextMaterial.depthTest = false;
                        this.defaultScreenSpaceTextMaterial.emissiveVertexColor = true;
                        this.defaultScreenSpaceTextMaterial.update();
                    }
                    return this.defaultScreenSpaceTextMaterial;
                }
                if (!this.defaultScreenSpaceBitmapTextMaterial) {
                    this.defaultScreenSpaceBitmapTextMaterial = new pc.StandardMaterial();
                    this.defaultScreenSpaceBitmapTextMaterial.name = "defaultScreenSpaceBitmapTextMaterial";
                    this.defaultScreenSpaceBitmapTextMaterial.emissive.set(0.5, 0.5, 0.5); // set to non-(1,1,1) so that tint is actually applied
                    this.defaultScreenSpaceBitmapTextMaterial.emissiveMap = this._defaultTexture;
                    this.defaultScreenSpaceBitmapTextMaterial.emissiveTint = true;
                    this.defaultScreenSpaceBitmapTextMaterial.opacity = 0.5;
                    this.defaultScreenSpaceBitmapTextMaterial.opacityMap = this._defaultTexture;
                    this.defaultScreenSpaceBitmapTextMaterial.opacityMapChannel = 'a';
                    this.defaultScreenSpaceBitmapTextMaterial.useLighting = false;
                    this.defaultScreenSpaceBitmapTextMaterial.useGammaTonemap = false;
                    this.defaultScreenSpaceBitmapTextMaterial.useFog = false;
                    this.defaultScreenSpaceBitmapTextMaterial.useSkybox = false;
                    this.defaultScreenSpaceBitmapTextMaterial.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
                    this.defaultScreenSpaceBitmapTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
                    this.defaultScreenSpaceBitmapTextMaterial.depthWrite = false;
                    this.defaultScreenSpaceBitmapTextMaterial.depthTest = false;
                    this.defaultScreenSpaceBitmapTextMaterial.emissiveVertexColor = true;
                    this.defaultScreenSpaceBitmapTextMaterial.update();
                }
                return this.defaultScreenSpaceBitmapTextMaterial;

            }
            if (msdf) {
                if (!this.defaultTextMaterial) {
                    this.defaultTextMaterial = new pc.StandardMaterial();
                    this.defaultTextMaterial.name = "defaultTextMaterial";
                    this.defaultTextMaterial.msdfMap = this._defaultTexture;
                    this.defaultTextMaterial.useLighting = false;
                    this.defaultTextMaterial.useGammaTonemap = false;
                    this.defaultTextMaterial.useFog = false;
                    this.defaultTextMaterial.useSkybox = false;
                    this.defaultTextMaterial.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
                    this.defaultTextMaterial.emissive.set(1, 1, 1);
                    this.defaultTextMaterial.opacity = 0.5;
                    this.defaultTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
                    this.defaultTextMaterial.depthWrite = false;
                    this.defaultTextMaterial.emissiveVertexColor = true;
                    this.defaultTextMaterial.update();
                }
                return this.defaultTextMaterial;
            }
            if (!this.defaultBitmapTextMaterial) {
                this.defaultBitmapTextMaterial = new pc.StandardMaterial();
                this.defaultBitmapTextMaterial.name = "defaultBitmapTextMaterial";
                this.defaultBitmapTextMaterial.emissive.set(0.5, 0.5, 0.5);  // set to non-(1,1,1) so that tint is actually applied
                this.defaultBitmapTextMaterial.emissiveTint = true;
                this.defaultBitmapTextMaterial.emissiveMap = this._defaultTexture;
                this.defaultBitmapTextMaterial.opacity = 0.5;
                this.defaultBitmapTextMaterial.opacityMap = this._defaultTexture;
                this.defaultBitmapTextMaterial.opacityMapChannel = 'a';
                this.defaultBitmapTextMaterial.useLighting = false;
                this.defaultBitmapTextMaterial.useGammaTonemap = false;
                this.defaultBitmapTextMaterial.useFog = false;
                this.defaultBitmapTextMaterial.useSkybox = false;
                this.defaultBitmapTextMaterial.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
                this.defaultBitmapTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
                this.defaultBitmapTextMaterial.depthWrite = false;
                this.defaultBitmapTextMaterial.emissiveVertexColor = true;
                this.defaultBitmapTextMaterial.update();
            }
            return this.defaultBitmapTextMaterial;


        },

        _createBaseImageMaterial: function () {
            var material = new pc.StandardMaterial();

            material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
            material.emissive.set(0.5, 0.5, 0.5); // use non-white to compile shader correctly
            material.emissiveMap = this._defaultTexture;
            material.emissiveTint = true;
            material.opacityMap = this._defaultTexture;
            material.opacityMapChannel = "a";
            material.opacityTint = true;
            material.opacity = 0; // use non-1 opacity to compile shader correctly
            material.useLighting = false;
            material.useGammaTonemap = false;
            material.useFog = false;
            material.useSkybox = false;
            material.blendType = pc.BLEND_PREMULTIPLIED;
            material.depthWrite = false;

            return material;
        },

        getImageElementMaterial: function (screenSpace, mask, nineSliced, nineSliceTiled) {
            /* eslint-disable no-else-return */
            if (screenSpace) {
                if (mask) {
                    if (nineSliced) {
                        if (!this.defaultScreenSpaceImageMask9SlicedMaterial) {
                            this.defaultScreenSpaceImageMask9SlicedMaterial = this._createBaseImageMaterial();
                            this.defaultScreenSpaceImageMask9SlicedMaterial.name = "defaultScreenSpaceImageMask9SlicedMaterial";
                            this.defaultScreenSpaceImageMask9SlicedMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_SLICED;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.depthTest = false;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.alphaTest = 1;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.redWrite = false;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.greenWrite = false;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.blueWrite = false;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.alphaWrite = false;
                            this.defaultScreenSpaceImageMask9SlicedMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMask9SlicedMaterial);
                        }
                        return this.defaultScreenSpaceImageMask9SlicedMaterial;
                    } else if (nineSliceTiled) {
                        if (!this.defaultScreenSpaceImageMask9TiledMaterial) {
                            this.defaultScreenSpaceImageMask9TiledMaterial = this.defaultScreenSpaceImage9TiledMaterial.clone();
                            this.defaultScreenSpaceImageMask9TiledMaterial.name = "defaultScreenSpaceImageMask9TiledMaterial";
                            this.defaultScreenSpaceImageMask9TiledMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_TILED;
                            this.defaultScreenSpaceImageMask9TiledMaterial.depthTest = false;
                            this.defaultScreenSpaceImageMask9TiledMaterial.alphaTest = 1;
                            this.defaultScreenSpaceImageMask9TiledMaterial.redWrite = false;
                            this.defaultScreenSpaceImageMask9TiledMaterial.greenWrite = false;
                            this.defaultScreenSpaceImageMask9TiledMaterial.blueWrite = false;
                            this.defaultScreenSpaceImageMask9TiledMaterial.alphaWrite = false;
                            this.defaultScreenSpaceImageMask9TiledMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMask9TiledMaterial);
                        }
                        return this.defaultScreenSpaceImageMask9TiledMaterial;
                    } else {
                        if (!this.defaultScreenSpaceImageMaskMaterial) {
                            this.defaultScreenSpaceImageMaskMaterial = this._createBaseImageMaterial();
                            this.defaultScreenSpaceImageMaskMaterial.name = "defaultScreenSpaceImageMaskMaterial";
                            this.defaultScreenSpaceImageMaskMaterial.depthTest = false;
                            this.defaultScreenSpaceImageMaskMaterial.alphaTest = 1;
                            this.defaultScreenSpaceImageMaskMaterial.redWrite = false;
                            this.defaultScreenSpaceImageMaskMaterial.greenWrite = false;
                            this.defaultScreenSpaceImageMaskMaterial.blueWrite = false;
                            this.defaultScreenSpaceImageMaskMaterial.alphaWrite = false;
                            this.defaultScreenSpaceImageMaskMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMaskMaterial);
                        }
                        return this.defaultScreenSpaceImageMaskMaterial;
                    }
                } else {
                    if (nineSliced) {
                        if (!this.defaultScreenSpaceImage9SlicedMaterial) {
                            this.defaultScreenSpaceImage9SlicedMaterial = this._createBaseImageMaterial();
                            this.defaultScreenSpaceImage9SlicedMaterial.name = "defaultScreenSpaceImage9SlicedMaterial";
                            this.defaultScreenSpaceImage9SlicedMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_SLICED;
                            this.defaultScreenSpaceImage9SlicedMaterial.depthTest = false;
                            this.defaultScreenSpaceImage9SlicedMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImage9SlicedMaterial);
                        }
                        return this.defaultScreenSpaceImage9SlicedMaterial;
                    } else if (nineSliceTiled) {
                        if (!this.defaultScreenSpaceImage9TiledMaterial) {
                            this.defaultScreenSpaceImage9TiledMaterial = this._createBaseImageMaterial();
                            this.defaultScreenSpaceImage9TiledMaterial.name = "defaultScreenSpaceImage9TiledMaterial";
                            this.defaultScreenSpaceImage9TiledMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_TILED;
                            this.defaultScreenSpaceImage9TiledMaterial.depthTest = false;
                            this.defaultScreenSpaceImage9TiledMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImage9TiledMaterial);
                        }

                        return this.defaultScreenSpaceImage9TiledMaterial;
                    } else {
                        if (!this.defaultScreenSpaceImageMaterial) {
                            this.defaultScreenSpaceImageMaterial = this._createBaseImageMaterial();
                            this.defaultScreenSpaceImageMaterial.name = "defaultScreenSpaceImageMaterial";
                            this.defaultScreenSpaceImageMaterial.depthTest = false;
                            this.defaultScreenSpaceImageMaterial.update();

                            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMaterial);
                        }
                        return this.defaultScreenSpaceImageMaterial;
                    }
                }
            } else {
                if (mask) {
                    if (nineSliced) {
                        if (!this.defaultImage9SlicedMaskMaterial) {
                            this.defaultImage9SlicedMaskMaterial = this._createBaseImageMaterial();
                            this.defaultImage9SlicedMaskMaterial.name = "defaultImage9SlicedMaskMaterial";
                            this.defaultImage9SlicedMaskMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_SLICED;
                            this.defaultImage9SlicedMaskMaterial.alphaTest = 1;
                            this.defaultImage9SlicedMaskMaterial.redWrite = false;
                            this.defaultImage9SlicedMaskMaterial.greenWrite = false;
                            this.defaultImage9SlicedMaskMaterial.blueWrite = false;
                            this.defaultImage9SlicedMaskMaterial.alphaWrite = false;
                            this.defaultImage9SlicedMaskMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImage9SlicedMaskMaterial);
                        }
                        return this.defaultImage9SlicedMaskMaterial;
                    } else if (nineSliceTiled) {
                        if (!this.defaultImage9TiledMaskMaterial) {
                            this.defaultImage9TiledMaskMaterial = this._createBaseImageMaterial();
                            this.defaultImage9TiledMaskMaterial.name = "defaultImage9TiledMaskMaterial";
                            this.defaultImage9TiledMaskMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_TILED;
                            this.defaultImage9TiledMaskMaterial.alphaTest = 1;
                            this.defaultImage9TiledMaskMaterial.redWrite = false;
                            this.defaultImage9TiledMaskMaterial.greenWrite = false;
                            this.defaultImage9TiledMaskMaterial.blueWrite = false;
                            this.defaultImage9TiledMaskMaterial.alphaWrite = false;
                            this.defaultImage9TiledMaskMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImage9TiledMaskMaterial);
                        }
                        return this.defaultImage9TiledMaskMaterial;
                    } else {
                        if (!this.defaultImageMaskMaterial) {
                            this.defaultImageMaskMaterial = this._createBaseImageMaterial();
                            this.defaultImageMaskMaterial.name = "defaultImageMaskMaterial";
                            this.defaultImageMaskMaterial.alphaTest = 1;
                            this.defaultImageMaskMaterial.redWrite = false;
                            this.defaultImageMaskMaterial.greenWrite = false;
                            this.defaultImageMaskMaterial.blueWrite = false;
                            this.defaultImageMaskMaterial.alphaWrite = false;
                            this.defaultImageMaskMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImageMaskMaterial);
                        }
                        return this.defaultImageMaskMaterial;
                    }
                } else {
                    if (nineSliced) {
                        if (!this.defaultImage9SlicedMaterial) {
                            this.defaultImage9SlicedMaterial = this._createBaseImageMaterial();
                            this.defaultImage9SlicedMaterial.name = "defaultImage9SlicedMaterial";
                            this.defaultImage9SlicedMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_SLICED;
                            this.defaultImage9SlicedMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImage9SlicedMaterial);
                        }
                        return this.defaultImage9SlicedMaterial;
                    } else if (nineSliceTiled) {
                        if (!this.defaultImage9TiledMaterial) {
                            this.defaultImage9TiledMaterial = this._createBaseImageMaterial();
                            this.defaultImage9TiledMaterial.name = "defaultImage9TiledMaterial";
                            this.defaultImage9TiledMaterial.nineSlicedMode = pc.SPRITE_RENDERMODE_TILED;
                            this.defaultImage9TiledMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImage9TiledMaterial);
                        }
                        return this.defaultImage9TiledMaterial;
                    } else {
                        if (!this.defaultImageMaterial) {
                            this.defaultImageMaterial = this._createBaseImageMaterial();
                            this.defaultImageMaterial.name = "defaultImageMaterial";
                            this.defaultImageMaterial.update();

                            this.defaultImageMaterials.push(this.defaultImageMaterial);
                        }
                        return this.defaultImageMaterial;
                    }
                }
            }
            /* eslint-enable no-else-return */
        },

        registerUnicodeConverter: function (func) {
            this._unicodeConverter = func;
        },

        registerRtlReorder: function (func) {
            this._rtlReorder = func;
        },

        getUnicodeConverter: function () {
            return this._unicodeConverter;
        },

        getRtlReorder: function () {
            return this._rtlReorder;
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    };
}());
