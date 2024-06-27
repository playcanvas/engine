import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';

import {
    PIXELFORMAT_RGBA8
} from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';

import { BLEND_PREMULTIPLIED, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from '../../../scene/constants.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';

import { ComponentSystem } from '../system.js';

import { ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT } from './constants.js';
import { ElementComponent } from './component.js';
import { ElementComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link ElementComponent}s.
 *
 * @category User Interface
 */
class ElementComponentSystem extends ComponentSystem {
    /**
     * Create a new ElementComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'element';

        this.ComponentType = ElementComponent;
        this.DataType = ElementComponentData;

        this.schema = _schema;
        this._unicodeConverter = null;
        this._rtlReorder = null;

        // default texture - make white so we can tint it with emissive color
        this._defaultTexture = new Texture(app.graphicsDevice, {
            width: 1,
            height: 1,
            format: PIXELFORMAT_RGBA8,
            name: 'element-system'
        });
        const pixels = this._defaultTexture.lock();
        const pixelData = new Uint8Array(4);
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
        this._defaultTextMaterials = {};

        this.defaultImageMaterials = [];

        this.on('beforeremove', this.onRemoveComponent, this);
    }

    destroy() {
        super.destroy();

        this._defaultTexture.destroy();
    }

    initializeComponentData(component, data, properties) {
        component._beingInitialized = true;

        if (data.anchor !== undefined) {
            if (data.anchor instanceof Vec4) {
                component.anchor.copy(data.anchor);
            } else {
                component.anchor.set(data.anchor[0], data.anchor[1], data.anchor[2], data.anchor[3]);
            }
        }

        if (data.pivot !== undefined) {
            if (data.pivot instanceof Vec2) {
                component.pivot.copy(data.pivot);
            } else {
                component.pivot.set(data.pivot[0], data.pivot[1]);
            }
        }

        const splitHorAnchors = Math.abs(component.anchor.x - component.anchor.z) > 0.001;
        const splitVerAnchors = Math.abs(component.anchor.y - component.anchor.w) > 0.001;
        let _marginChange = false;
        let color;

        if (data.margin !== undefined) {
            if (data.margin instanceof Vec4) {
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

        let shouldForceSetAnchor = false;

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

        if (data.fitMode !== undefined) {
            component.fitMode = data.fitMode;
        }

        component.batchGroupId = data.batchGroupId === undefined || data.batchGroupId === null ? -1 : data.batchGroupId;

        if (data.layers && Array.isArray(data.layers)) {
            component.layers = data.layers.slice(0);
        }

        if (data.type !== undefined) {
            component.type = data.type;
        }

        if (component.type === ELEMENTTYPE_IMAGE) {
            if (data.rect !== undefined) {
                component.rect = data.rect;
            }
            if (data.color !== undefined) {
                color = data.color;
                if (!(color instanceof Color)) {
                    color = new Color(data.color[0], data.color[1], data.color[2]);
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
        } else if (component.type === ELEMENTTYPE_TEXT) {
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
                if (!(color instanceof Color)) {
                    color = new Color(color[0], color[1], color[2]);
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
        }
        // OTHERWISE: group

        // find screen
        // do this here not in constructor so that component is added to the entity
        const result = component._parseUpToScreen();
        if (result.screen) {
            component._updateScreen(result.screen);
        }

        super.initializeComponentData(component, data, properties);

        component._beingInitialized = false;

        if (component.type === ELEMENTTYPE_IMAGE && component._image._meshDirty) {
            component._image._updateMesh(component._image.mesh);
        }
    }

    onRemoveComponent(entity, component) {
        component.onRemove();
    }

    cloneComponent(entity, clone) {
        const source = entity.element;

        const data = {
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
            fitMode: source.fitMode,
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
    }

    getTextElementMaterial(screenSpace, msdf, textAttibutes) {
        const hash = (screenSpace && (1 << 0)) |
                          (msdf && (1 << 1)) |
                 (textAttibutes && (1 << 2));

        let material = this._defaultTextMaterials[hash];

        if (material) {
            return material;
        }

        let name = "TextMaterial";

        material = new StandardMaterial();

        if (msdf) {
            material.msdfMap = this._defaultTexture;
            material.msdfTextAttribute = textAttibutes;
            material.emissive.set(1, 1, 1);
        } else {
            name = "Bitmap" + name;
            material.emissive.set(0.5, 0.5, 0.5); // set to non-(1,1,1) so that tint is actually applied
            material.emissiveMap = this._defaultTexture;
            material.emissiveTint = true;
            material.opacityMap = this._defaultTexture;
            material.opacityMapChannel = 'a';
        }

        if (screenSpace) {
            name = 'ScreenSpace' + name;
            material.depthTest = false;
        }

        // The material name can be:
        //  defaultTextMaterial
        //  defaultBitmapTextMaterial
        //  defaultScreenSpaceTextMaterial
        //  defaultScreenSpaceBitmapTextMaterial
        material.name = 'default' + name;
        material.useLighting = false;
        material.useTonemap = false;
        material.useFog = false;
        material.useSkybox = false;
        material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
        material.opacity = 0.5;
        material.blendType = BLEND_PREMULTIPLIED;
        material.depthWrite = false;
        material.emissiveVertexColor = true;
        material.update();

        this._defaultTextMaterials[hash] = material;

        return material;
    }

    _createBaseImageMaterial() {
        const material = new StandardMaterial();

        material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
        material.emissive.set(0.5, 0.5, 0.5); // use non-white to compile shader correctly
        material.emissiveMap = this._defaultTexture;
        material.emissiveTint = true;
        material.opacityMap = this._defaultTexture;
        material.opacityMapChannel = 'a';
        material.opacityTint = true;
        material.opacity = 0; // use non-1 opacity to compile shader correctly
        material.useLighting = false;
        material.useTonemap = false;
        material.useFog = false;
        material.useSkybox = false;
        material.blendType = BLEND_PREMULTIPLIED;
        material.depthWrite = false;

        return material;
    }

    getImageElementMaterial(screenSpace, mask, nineSliced, nineSliceTiled) {
        /* eslint-disable no-else-return */
        if (screenSpace) {
            if (mask) {
                if (nineSliced) {
                    if (!this.defaultScreenSpaceImageMask9SlicedMaterial) {
                        this.defaultScreenSpaceImageMask9SlicedMaterial = this._createBaseImageMaterial();
                        this.defaultScreenSpaceImageMask9SlicedMaterial.name = 'defaultScreenSpaceImageMask9SlicedMaterial';
                        this.defaultScreenSpaceImageMask9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
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
                        this.defaultScreenSpaceImageMask9TiledMaterial.name = 'defaultScreenSpaceImageMask9TiledMaterial';
                        this.defaultScreenSpaceImageMask9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
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
                        this.defaultScreenSpaceImageMaskMaterial.name = 'defaultScreenSpaceImageMaskMaterial';
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
                        this.defaultScreenSpaceImage9SlicedMaterial.name = 'defaultScreenSpaceImage9SlicedMaterial';
                        this.defaultScreenSpaceImage9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
                        this.defaultScreenSpaceImage9SlicedMaterial.depthTest = false;
                        this.defaultScreenSpaceImage9SlicedMaterial.update();

                        this.defaultImageMaterials.push(this.defaultScreenSpaceImage9SlicedMaterial);
                    }
                    return this.defaultScreenSpaceImage9SlicedMaterial;
                } else if (nineSliceTiled) {
                    if (!this.defaultScreenSpaceImage9TiledMaterial) {
                        this.defaultScreenSpaceImage9TiledMaterial = this._createBaseImageMaterial();
                        this.defaultScreenSpaceImage9TiledMaterial.name = 'defaultScreenSpaceImage9TiledMaterial';
                        this.defaultScreenSpaceImage9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
                        this.defaultScreenSpaceImage9TiledMaterial.depthTest = false;
                        this.defaultScreenSpaceImage9TiledMaterial.update();

                        this.defaultImageMaterials.push(this.defaultScreenSpaceImage9TiledMaterial);
                    }

                    return this.defaultScreenSpaceImage9TiledMaterial;
                } else {
                    if (!this.defaultScreenSpaceImageMaterial) {
                        this.defaultScreenSpaceImageMaterial = this._createBaseImageMaterial();
                        this.defaultScreenSpaceImageMaterial.name = 'defaultScreenSpaceImageMaterial';
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
                        this.defaultImage9SlicedMaskMaterial.name = 'defaultImage9SlicedMaskMaterial';
                        this.defaultImage9SlicedMaskMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
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
                        this.defaultImage9TiledMaskMaterial.name = 'defaultImage9TiledMaskMaterial';
                        this.defaultImage9TiledMaskMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
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
                        this.defaultImageMaskMaterial.name = 'defaultImageMaskMaterial';
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
                        this.defaultImage9SlicedMaterial.name = 'defaultImage9SlicedMaterial';
                        this.defaultImage9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
                        this.defaultImage9SlicedMaterial.update();

                        this.defaultImageMaterials.push(this.defaultImage9SlicedMaterial);
                    }
                    return this.defaultImage9SlicedMaterial;
                } else if (nineSliceTiled) {
                    if (!this.defaultImage9TiledMaterial) {
                        this.defaultImage9TiledMaterial = this._createBaseImageMaterial();
                        this.defaultImage9TiledMaterial.name = 'defaultImage9TiledMaterial';
                        this.defaultImage9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
                        this.defaultImage9TiledMaterial.update();

                        this.defaultImageMaterials.push(this.defaultImage9TiledMaterial);
                    }
                    return this.defaultImage9TiledMaterial;
                } else {
                    if (!this.defaultImageMaterial) {
                        this.defaultImageMaterial = this._createBaseImageMaterial();
                        this.defaultImageMaterial.name = 'defaultImageMaterial';
                        this.defaultImageMaterial.update();

                        this.defaultImageMaterials.push(this.defaultImageMaterial);
                    }
                    return this.defaultImageMaterial;
                }
            }
        }
        /* eslint-enable no-else-return */
    }

    registerUnicodeConverter(func) {
        this._unicodeConverter = func;
    }

    registerRtlReorder(func) {
        this._rtlReorder = func;
    }

    getUnicodeConverter() {
        return this._unicodeConverter;
    }

    getRtlReorder() {
        return this._rtlReorder;
    }
}

export { ElementComponentSystem };
