import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';

import {
    BUFFER_STATIC,
    FUNC_EQUAL,
    PRIMITIVE_TRIFAN,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD0,
    STENCILOP_DECREMENT,
    TYPE_FLOAT32
} from '../../../graphics/constants.js';
import { VertexBuffer } from '../../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../../graphics/vertex-format.js';

import {
    LAYER_HUD, LAYER_WORLD,
    SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../../scene/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Mesh } from '../../../scene/mesh.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';

import { Asset } from '../../../asset/asset.js';

// #if _DEBUG
var _debugLogging = false;
// #endif

class ImageRenderable {
    constructor(entity, mesh, material) {
        this._entity = entity;
        this._element = entity.element;

        this.model = new Model();
        this.node = new GraphNode();
        this.model.graph = this.node;

        this.mesh = mesh;
        this.meshInstance = new MeshInstance(this.mesh, material, this.node);
        this.meshInstance.name = 'ImageElement: ' + entity.name;
        this.meshInstance.castShadow = false;
        this.meshInstance.receiveShadow = false;

        this._meshDirty = false;

        this.model.meshInstances.push(this.meshInstance);

        this._entity.addChild(this.model.graph);
        this.model._entity = this._entity;

        this.unmaskMeshInstance = null;
    }

    destroy() {
        this.setMaterial(null); // clear material references
        this._element.removeModelFromLayers(this.model);
        this.model.destroy();
        this.model = null;
        this.node = null;
        this.mesh = null;
        this.meshInstance = null;
        this._entity = null;
        this._element = null;
    }

    setMesh(mesh) {
        if (!this.meshInstance) return;

        this.mesh = mesh;

        this.meshInstance.mesh = mesh;
        this.meshInstance.visible = !!mesh;

        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.mesh = mesh;
        }
        this.forceUpdateAabb();
    }

    setMask(mask) {
        if (!this.meshInstance) return;

        if (mask) {
            this.unmaskMeshInstance = new MeshInstance(this.mesh, this.meshInstance.material, this.node);
            this.unmaskMeshInstance.name = 'Unmask: ' + this._entity.name;
            this.unmaskMeshInstance.castShadow = false;
            this.unmaskMeshInstance.receiveShadow = false;
            this.unmaskMeshInstance.pick = false;

            this.model.meshInstances.push(this.unmaskMeshInstance);

            // copy parameters
            for (var name in this.meshInstance.parameters) {
                this.unmaskMeshInstance.setParameter(name, this.meshInstance.parameters[name].data);
            }
        } else {
            // remove unmask mesh instance from model
            var idx = this.model.meshInstances.indexOf(this.unmaskMeshInstance);
            if (idx >= 0) {
                this.model.meshInstances.splice(idx, 1);
            }

            this.unmaskMeshInstance = null;
        }

        // remove model then re-add to update to current mesh instances
        if (this._entity.enabled && this._element.enabled) {
            this._element.removeModelFromLayers(this.model);
            this._element.addModelToLayers(this.model);
        }
    }

    setMaterial(material) {
        if (!this.meshInstance) return;

        this.meshInstance.material = material;
        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.material = material;
        }
    }

    setParameter(name, value) {
        if (!this.meshInstance) return;

        this.meshInstance.setParameter(name, value);
        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.setParameter(name, value);
        }
    }

    deleteParameter(name) {
        if (!this.meshInstance) return;

        this.meshInstance.deleteParameter(name);
        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.deleteParameter(name);
        }
    }

    setUnmaskDrawOrder() {
        if (!this.meshInstance) return;

        var getLastChild = function (e) {
            var last;
            var c = e.children;
            var l = c.length;
            if (l) {
                for (var i = 0; i < l; i++) {
                    if (c[i].element) {
                        last = c[i];
                    }
                }

                if (!last) return null;

                var child = getLastChild(last);
                if (child) {
                    return child;
                }
                return last;
            }
            return null;
        };

        // The unmask mesh instance renders into the stencil buffer
        // with the ref of the previous mask. This essentially "clears"
        // the mask value
        //
        // The unmask has a drawOrder set to be mid-way between the last child of the
        // masked hierarchy and the next child to be drawn.
        //
        // The offset is reduced by a small fraction each time so that if multiple masks
        // end on the same last child they are unmasked in the correct order.
        if (this.unmaskMeshInstance) {
            var lastChild = getLastChild(this._entity);
            if (lastChild && lastChild.element) {
                this.unmaskMeshInstance.drawOrder = lastChild.element.drawOrder + lastChild.element.getMaskOffset();
            } else {
                this.unmaskMeshInstance.drawOrder = this.meshInstance.drawOrder + this._element.getMaskOffset();
            }
            // #if _DEBUG
            if (_debugLogging) console.log('setDrawOrder: ', this.unmaskMeshInstance.name, this.unmaskMeshInstance.drawOrder);
            // #endif
        }
    }

    setDrawOrder(drawOrder) {
        if (!this.meshInstance) return;
        // #if _DEBUG
        if (_debugLogging) console.log('setDrawOrder: ', this.meshInstance.name, drawOrder);
        // #endif
        this.meshInstance.drawOrder = drawOrder;
    }

    setCull(cull) {
        if (!this.meshInstance) return;
        var element = this._element;

        var visibleFn = null;
        if (cull && element._isScreenCulled()) {
            visibleFn = function (camera) {
                return element.isVisibleForCamera(camera);
            };
        }

        this.meshInstance.cull = cull;
        this.meshInstance.isVisibleFunc = visibleFn;

        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.cull = cull;
            this.unmaskMeshInstance.isVisibleFunc = visibleFn;
        }
    }

    setScreenSpace(screenSpace) {
        if (!this.meshInstance) return;

        this.meshInstance.screenSpace = screenSpace;

        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.screenSpace = screenSpace;
        }
    }

    setLayer(layer) {
        if (!this.meshInstance) return;

        this.meshInstance.layer = layer;

        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance.layer = layer;
        }
    }

    forceUpdateAabb(mask) {
        if (!this.meshInstance) return;

        this.meshInstance._aabbVer = -1;
        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance._aabbVer = -1;
        }
    }

    setAabbFunc(fn) {
        if (!this.meshInstance) return;

        this.meshInstance._updateAabbFunc = fn;
        if (this.unmaskMeshInstance) {
            this.unmaskMeshInstance._updateAabbFunc = fn;
        }
    }
}

class ImageElement {
    constructor(element) {
        this._element = element;
        this._entity = element.entity;
        this._system = element.system;

        // public
        this._textureAsset = null;
        this._texture = null;
        this._materialAsset = null;
        this._material = null;
        this._spriteAsset = null;
        this._sprite = null;
        this._spriteFrame = 0;
        this._pixelsPerUnit = null;

        this._rect = new Vec4(0, 0, 1, 1); // x, y, w, h

        this._mask = false; // this image element is a mask
        this._maskRef = 0; // id used in stencil buffer to mask

        // 9-slicing
        this._outerScale = new Vec2();
        this._outerScaleUniform = new Float32Array(2);
        this._innerOffset = new Vec4();
        this._innerOffsetUniform = new Float32Array(4);
        this._atlasRect = new Vec4();
        this._atlasRectUniform = new Float32Array(4);

        this._defaultMesh = this._createMesh();
        this._renderable = new ImageRenderable(this._entity, this._defaultMesh, this._material);

        // set default colors
        this._color = new Color(1, 1, 1, 1);
        this._colorUniform = new Float32Array([1, 1, 1]);
        this._renderable.setParameter('material_emissive', this._colorUniform);
        this._renderable.setParameter('material_opacity', 1);

        this._updateAabbFunc = this._updateAabb.bind(this);

        // initialize based on screen
        this._onScreenChange(this._element.screen);

        // listen for events
        this._element.on('resize', this._onParentResizeOrPivotChange, this);
        this._element.on('set:pivot', this._onParentResizeOrPivotChange, this);
        this._element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
        this._element.on('set:screen', this._onScreenChange, this);
        this._element.on('set:draworder', this._onDrawOrderChange, this);
        this._element.on('screen:set:resolution', this._onResolutionChange, this);
    }

    destroy() {
        // reset all assets to unbind all asset events
        this.textureAsset = null;
        this.spriteAsset = null;
        this.materialAsset = null;

        this._renderable.setMesh(this._defaultMesh);
        this._renderable.destroy();
        this._defaultMesh = null;

        this._element.off('resize', this._onParentResizeOrPivotChange, this);
        this._element.off('set:pivot', this._onParentResizeOrPivotChange, this);
        this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
        this._element.off('set:screen', this._onScreenChange, this);
        this._element.off('set:draworder', this._onDrawOrderChange, this);
        this._element.off('screen:set:resolution', this._onResolutionChange, this);
    }

    _onResolutionChange(res) {
    }

    _onParentResizeOrPivotChange() {
        if (this._renderable.mesh) {
            this._updateMesh(this._renderable.mesh);
        }
    }

    _onScreenSpaceChange(value) {
        this._updateMaterial(value);
    }

    _onScreenChange(screen, previous) {
        if (screen) {
            this._updateMaterial(screen.screen.screenSpace);

        } else {
            this._updateMaterial(false);
        }
    }

    _onDrawOrderChange(order) {
        this._renderable.setDrawOrder(order);

        if (this.mask && this._element.screen) {
            this._element.screen.screen.once('syncdraworder', function () {
                this._renderable.setUnmaskDrawOrder();
            }, this);
        }
    }

    // Returns true if we are using a material
    // other than the default materials
    _hasUserMaterial() {
        return !!this._materialAsset ||
               (!!this._material &&
                this._system.defaultImageMaterials.indexOf(this._material) === -1);
    }

    _use9Slicing() {
        return this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED);
    }

    _updateMaterial(screenSpace) {
        var mask = !!this._mask;
        var nineSliced = !!(this.sprite && this.sprite.renderMode === SPRITE_RENDERMODE_SLICED);
        var nineTiled = !!(this.sprite && this.sprite.renderMode === SPRITE_RENDERMODE_TILED);

        if (!this._hasUserMaterial()) {
            this._material = this._system.getImageElementMaterial(screenSpace, mask, nineSliced, nineTiled);
        }

        if (this._renderable) {
            this._renderable.setCull(true); // culling is now always true (screenspace culled by isCulled, worldspace by frustum)
            this._renderable.setMaterial(this._material);
            this._renderable.setScreenSpace(screenSpace);
            this._renderable.setLayer(screenSpace ? LAYER_HUD : LAYER_WORLD);
        }
    }

    // build a quad for the image
    _createMesh() {
        var element = this._element;
        var w = element.calculatedWidth;
        var h = element.calculatedHeight;

        var r = this._rect;

        // Note that when creating a typed array, it's initialized to zeros.
        // Allocate memory for 4 vertices, 8 floats per vertex, 4 bytes per float.
        var vertexData = new ArrayBuffer(4 * 8 * 4);
        var vertexDataF32 = new Float32Array(vertexData);

        // Vertex layout is: PX, PY, PZ, NX, NY, NZ, U, V
        // Since the memory is zeroed, we will only set non-zero elements

        // POS: 0, 0, 0
        vertexDataF32[5] = 1;          // NZ
        vertexDataF32[6] = r.x;        // U
        vertexDataF32[7] = 1.0 - r.y;  // V

        // POS: w, 0, 0
        vertexDataF32[8] = w;          // PX
        vertexDataF32[13] = 1;         // NZ
        vertexDataF32[14] = r.x + r.z; // U
        vertexDataF32[15] = 1.0 - r.y; // V

        // POS: w, h, 0
        vertexDataF32[16] = w;         // PX
        vertexDataF32[17] = h;         // PY
        vertexDataF32[21] = 1;         // NZ
        vertexDataF32[22] = r.x + r.z; // U
        vertexDataF32[23] = 1.0 - (r.y + r.w); // V

        // POS: 0, h, 0
        vertexDataF32[25] = h;         // PY
        vertexDataF32[29] = 1;         // NZ
        vertexDataF32[30] = r.x;       // U
        vertexDataF32[31] = 1.0 - (r.y + r.w); // V

        var vertexDesc = [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_TEXCOORD0, components: 2, type: TYPE_FLOAT32 }
        ];

        var device = this._system.app.graphicsDevice;
        var vertexFormat = new VertexFormat(device, vertexDesc);
        var vertexBuffer = new VertexBuffer(device, vertexFormat, 4, BUFFER_STATIC, vertexData);

        var mesh = new Mesh(device);
        mesh.vertexBuffer = vertexBuffer;
        mesh.primitive[0].type = PRIMITIVE_TRIFAN;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = 4;
        mesh.primitive[0].indexed = false;
        mesh.aabb.setMinMax(Vec3.ZERO, new Vec3(w, h, 0));

        this._updateMesh(mesh);

        return mesh;
    }

    _updateMesh(mesh) {
        var element = this._element;
        var w = element.calculatedWidth;
        var h = element.calculatedHeight;

        // update material
        var screenSpace = element._isScreenSpace();
        this._updateMaterial(screenSpace);

        // force update meshInstance aabb
        if (this._renderable) this._renderable.forceUpdateAabb();

        if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {

            // calculate inner offset from the frame's border
            var frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
            var borderWidthScale = 2 / frameData.rect.z;
            var borderHeightScale = 2 / frameData.rect.w;

            this._innerOffset.set(
                frameData.border.x * borderWidthScale,
                frameData.border.y * borderHeightScale,
                frameData.border.z * borderWidthScale,
                frameData.border.w * borderHeightScale
            );

            var tex = this.sprite.atlas.texture;
            this._atlasRect.set(frameData.rect.x / tex.width,
                                frameData.rect.y / tex.height,
                                frameData.rect.z / tex.width,
                                frameData.rect.w / tex.height);

            // scale: apply PPU
            var ppu = this._pixelsPerUnit !== null ? this._pixelsPerUnit : this.sprite.pixelsPerUnit;
            var scaleMulX = frameData.rect.z / ppu;
            var scaleMulY = frameData.rect.w / ppu;

            // scale borders if necessary instead of overlapping
            this._outerScale.set(Math.max(w, this._innerOffset.x * scaleMulX), Math.max(h, this._innerOffset.y * scaleMulY));

            var scaleX = scaleMulX;
            var scaleY = scaleMulY;

            this._outerScale.x /= scaleMulX;
            this._outerScale.y /= scaleMulY;

            // scale: shrinking below 1
            scaleX *= math.clamp(w / (this._innerOffset.x * scaleMulX), 0.0001, 1);
            scaleY *= math.clamp(h / (this._innerOffset.y * scaleMulY), 0.0001, 1);

            // set scale
            if (this._renderable) {
                this._innerOffsetUniform[0] = this._innerOffset.x;
                this._innerOffsetUniform[1] = this._innerOffset.y;
                this._innerOffsetUniform[2] = this._innerOffset.z;
                this._innerOffsetUniform[3] = this._innerOffset.w;
                this._renderable.setParameter('innerOffset', this._innerOffsetUniform);
                this._atlasRectUniform[0] = this._atlasRect.x;
                this._atlasRectUniform[1] = this._atlasRect.y;
                this._atlasRectUniform[2] = this._atlasRect.z;
                this._atlasRectUniform[3] = this._atlasRect.w;
                this._renderable.setParameter('atlasRect', this._atlasRectUniform);
                this._outerScaleUniform[0] = this._outerScale.x;
                this._outerScaleUniform[1] = this._outerScale.y;
                this._renderable.setParameter('outerScale', this._outerScaleUniform);
                this._renderable.setAabbFunc(this._updateAabbFunc);

                this._renderable.node.setLocalScale(scaleX, scaleY, 1);
                this._renderable.node.setLocalPosition((0.5 - element.pivot.x) * w, (0.5 - element.pivot.y) * h, 0);
            }
        } else {
            var vb = mesh.vertexBuffer;
            var vertexDataF32 = new Float32Array(vb.lock());

            // offset for pivot
            var hp = element.pivot.x;
            var vp = element.pivot.y;

            // Update vertex positions, accounting for the pivot offset
            vertexDataF32[0] = 0 - hp * w;
            vertexDataF32[1] = 0 - vp * h;
            vertexDataF32[8] = w - hp * w;
            vertexDataF32[9] = 0 - vp * h;
            vertexDataF32[16] = w - hp * w;
            vertexDataF32[17] = h - vp * h;
            vertexDataF32[24] = 0 - hp * w;
            vertexDataF32[25] = h - vp * h;


            var atlasTextureWidth = 1;
            var atlasTextureHeight = 1;
            var rect = this._rect;

            if (this._sprite && this._sprite.frameKeys[this._spriteFrame] && this._sprite.atlas) {
                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
                if (frame) {
                    rect = frame.rect;
                    atlasTextureWidth = this._sprite.atlas.texture.width;
                    atlasTextureHeight = this._sprite.atlas.texture.height;
                }
            }

            // Update vertex texture coordinates
            vertexDataF32[6] = rect.x / atlasTextureWidth;
            vertexDataF32[7] = 1.0 - rect.y / atlasTextureHeight;
            vertexDataF32[14] = (rect.x + rect.z) / atlasTextureWidth;
            vertexDataF32[15] = 1.0 - rect.y / atlasTextureHeight;
            vertexDataF32[22] = (rect.x + rect.z) / atlasTextureWidth;
            vertexDataF32[23] = 1.0 - (rect.y + rect.w) / atlasTextureHeight;
            vertexDataF32[30] = rect.x / atlasTextureWidth;
            vertexDataF32[31] = 1.0 - (rect.y + rect.w) / atlasTextureHeight;

            vb.unlock();

            var min = new Vec3(0 - hp * w, 0 - vp * h, 0);
            var max = new Vec3(w - hp * w, h - vp * h, 0);
            mesh.aabb.setMinMax(min, max);

            if (this._renderable) {
                this._renderable.node.setLocalScale(1, 1, 1);
                this._renderable.node.setLocalPosition(0, 0, 0);

                this._renderable.setAabbFunc(null);
            }
        }

        this._meshDirty = false;
    }

    // Gets the mesh from the sprite asset
    // if the sprite is 9-sliced or the default mesh from the
    // image element and calls _updateMesh or sets meshDirty to true
    // if the component is currently being initialized. We need to call
    // _updateSprite every time something related to the sprite asset changes
    _updateSprite() {
        var nineSlice = false;
        var mesh = null;

        // take mesh from sprite
        if (this._sprite && this._sprite.atlas) {
            mesh = this._sprite.meshes[this.spriteFrame];
            nineSlice = this._sprite.renderMode === SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === SPRITE_RENDERMODE_TILED;
        }

        // if we use 9 slicing then use that mesh otherwise keep using the default mesh
        this.mesh = nineSlice ? mesh : this._defaultMesh;

        if (this.mesh) {
            if (! this._element._beingInitialized) {
                this._updateMesh(this.mesh);
            } else {
                this._meshDirty = true;
            }
        }
    }

    // updates AABB while 9-slicing
    _updateAabb(aabb) {
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
        aabb.setFromTransformedAabb(aabb, this._renderable.node.getWorldTransform());
        return aabb;
    }

    _toggleMask() {
        this._element._dirtifyMask();

        var screenSpace = this._element._isScreenSpace();
        this._updateMaterial(screenSpace);

        this._renderable.setMask(!!this._mask);
    }

    _onMaterialLoad(asset) {
        this.material = asset.resource;
    }

    _onMaterialAdded(asset) {
        this._system.app.assets.off('add:' + asset.id, this._onMaterialAdded, this);
        if (this._materialAsset === asset.id) {
            this._bindMaterialAsset(asset);
        }
    }

    _bindMaterialAsset(asset) {
        if (!this._entity.enabled) return; // don't bind until element is enabled

        asset.on("load", this._onMaterialLoad, this);
        asset.on("change", this._onMaterialChange, this);
        asset.on("remove", this._onMaterialRemove, this);

        if (asset.resource) {
            this._onMaterialLoad(asset);
        } else {
            this._system.app.assets.load(asset);
        }
    }

    _unbindMaterialAsset(asset) {
        asset.off("load", this._onMaterialLoad, this);
        asset.off("change", this._onMaterialChange, this);
        asset.off("remove", this._onMaterialRemove, this);
    }

    _onMaterialChange() {

    }

    _onMaterialRemove() {

    }

    _onTextureAdded(asset) {
        this._system.app.assets.off('add:' + asset.id, this._onTextureAdded, this);
        if (this._textureAsset === asset.id) {
            this._bindTextureAsset(asset);
        }
    }

    _bindTextureAsset(asset) {
        if (!this._entity.enabled) return; // don't bind until element is enabled

        asset.on("load", this._onTextureLoad, this);
        asset.on("change", this._onTextureChange, this);
        asset.on("remove", this._onTextureRemove, this);

        if (asset.resource) {
            this._onTextureLoad(asset);
        } else {
            this._system.app.assets.load(asset);
        }
    }

    _unbindTextureAsset(asset) {
        asset.off("load", this._onTextureLoad, this);
        asset.off("change", this._onTextureChange, this);
        asset.off("remove", this._onTextureRemove, this);
    }

    _onTextureLoad(asset) {
        this.texture = asset.resource;
    }

    _onTextureChange(asset) {

    }

    _onTextureRemove(asset) {

    }

    // When sprite asset is added bind it
    _onSpriteAssetAdded(asset) {
        this._system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
        if (this._spriteAsset === asset.id) {
            this._bindSpriteAsset(asset);
        }
    }

    // Hook up event handlers on sprite asset
    _bindSpriteAsset(asset) {
        if (!this._entity.enabled) return; // don't bind until element is enabled

        asset.on("load", this._onSpriteAssetLoad, this);
        asset.on("change", this._onSpriteAssetChange, this);
        asset.on("remove", this._onSpriteAssetRemove, this);

        if (asset.resource) {
            this._onSpriteAssetLoad(asset);
        } else {
            this._system.app.assets.load(asset);
        }
    }

    _unbindSpriteAsset(asset) {
        asset.off("load", this._onSpriteAssetLoad, this);
        asset.off("change", this._onSpriteAssetChange, this);
        asset.off("remove", this._onSpriteAssetRemove, this);

        if (asset.data.textureAtlasAsset) {
            this._system.app.assets.off("load:" + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
        }
    }

    // When sprite asset is loaded make sure the texture atlas asset is loaded too
    // If so then set the sprite, otherwise wait for the atlas to be loaded first
    _onSpriteAssetLoad(asset) {
        if (!asset || !asset.resource) {
            this.sprite = null;
        } else {
            if (!asset.resource.atlas) {
                var atlasAssetId = asset.data.textureAtlasAsset;
                if (atlasAssetId) {
                    var assets = this._system.app.assets;
                    assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                    assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                }
            } else {
                this.sprite = asset.resource;
            }
        }
    }

    // When the sprite asset changes reset it
    _onSpriteAssetChange(asset) {
        this._onSpriteAssetLoad(asset);
    }

    _onSpriteAssetRemove(asset) {
    }

    // Hook up event handlers on sprite asset
    _bindSprite(sprite) {
        sprite.on('set:meshes', this._onSpriteMeshesChange, this);
        sprite.on('set:pixelsPerUnit', this._onSpritePpuChange, this);
        sprite.on('set:atlas', this._onAtlasTextureChange, this);
        if (sprite.atlas) {
            sprite.atlas.on('set:texture', this._onAtlasTextureChange, this);
        }
    }

    _unbindSprite(sprite) {
        sprite.off('set:meshes', this._onSpriteMeshesChange, this);
        sprite.off('set:pixelsPerUnit', this._onSpritePpuChange, this);
        sprite.off('set:atlas', this._onAtlasTextureChange, this);
        if (sprite.atlas) {
            sprite.atlas.off('set:texture', this._onAtlasTextureChange, this);
        }
    }

    _onSpriteMeshesChange() {
        // clamp frame
        if (this._sprite) {
            this._spriteFrame = math.clamp(this._spriteFrame, 0, this._sprite.frameKeys.length - 1);
        }

        // force update
        this._updateSprite();
    }

    _onSpritePpuChange() {
        // force update when the sprite is 9-sliced. If it's not
        // then its mesh will change when the ppu changes which will
        // be handled by onSpriteMeshesChange
        if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE && this._pixelsPerUnit === null) {
            // force update
            this._updateSprite();
        }
    }

    _onAtlasTextureChange() {
        if (this.sprite && this.sprite.atlas && this.sprite.atlas.texture) {
            this._renderable.setParameter('texture_emissiveMap', this._sprite.atlas.texture);
            this._renderable.setParameter('texture_opacityMap', this._sprite.atlas.texture);
        } else {
            this._renderable.deleteParameter('texture_emissiveMap');
            this._renderable.deleteParameter('texture_opacityMap');
        }
    }

    // When atlas is loaded try to reset the sprite asset
    _onTextureAtlasLoad(atlasAsset) {
        var spriteAsset = this._spriteAsset;
        if (spriteAsset instanceof Asset) {
            // TODO: _spriteAsset should never be an asset instance?
            this._onSpriteAssetLoad(spriteAsset);
        } else {
            this._onSpriteAssetLoad(this._system.app.assets.get(spriteAsset));
        }
    }

    onEnable() {
        var asset;
        if (this._materialAsset) {
            asset = this._system.app.assets.get(this._materialAsset);
            if (asset && asset.resource !== this._material) {
                this._bindMaterialAsset(asset);
            }
        }
        if (this._textureAsset) {
            asset = this._system.app.assets.get(this._textureAsset);
            if (asset && asset.resource !== this._texture) {
                this._bindTextureAsset(asset);
            }
        }
        if (this._spriteAsset) {
            asset = this._system.app.assets.get(this._spriteAsset);
            if (asset && asset.resource !== this._sprite) {
                this._bindSpriteAsset(asset);
            }
        }

        this._element.addModelToLayers(this._renderable.model);
    }

    onDisable() {
        this._element.removeModelFromLayers(this._renderable.model);
    }

    _setStencil(stencilParams) {
        this._renderable.meshInstance.stencilFront = stencilParams;
        this._renderable.meshInstance.stencilBack = stencilParams;

        var ref = 0;
        if (this._element.maskedBy) {
            ref = this._element.maskedBy.element._image._maskRef;
        }
        if (this._renderable.unmaskMeshInstance) {
            var sp = new StencilParameters({
                ref: ref + 1,
                func: FUNC_EQUAL,
                zpass: STENCILOP_DECREMENT
            });

            this._renderable.unmaskMeshInstance.stencilFront = sp;
            this._renderable.unmaskMeshInstance.stencilBack = sp;
        }
    }

    get color() {
        return this._color;
    }

    set color(value) {
        var r = value.r;
        var g = value.g;
        var b = value.b;

        // #if _DEBUG
        if (this._color === value) {
            console.warn("Setting element.color to itself will have no effect");
        }
        // #endif

        if (this._color.r === r && this._color.g === g && this._color.b === b) {
            return;
        }

        this._color.r = r;
        this._color.g = g;
        this._color.b = b;

        this._colorUniform[0] = r;
        this._colorUniform[1] = g;
        this._colorUniform[2] = b;
        this._renderable.setParameter('material_emissive', this._colorUniform);

        if (this._element) {
            this._element.fire('set:color', this._color);
        }
    }

    get opacity() {
        return this._color.a;
    }

    set opacity(value) {
        if (value === this._color.a) return;

        this._color.a = value;

        this._renderable.setParameter('material_opacity', value);

        if (this._element) {
            this._element.fire('set:opacity', value);
        }
    }

    get rect() {
        return this._rect;
    }

    set rect(value) {
        // #if _DEBUG
        if (this._rect === value) {
            console.warn('Setting element.rect to itself will have no effect');
        }
        // #endif

        var x, y, z, w;
        if (value instanceof Vec4) {
            x = value.x;
            y = value.y;
            z = value.z;
            w = value.w;
        } else {
            x = value[0];
            y = value[1];
            z = value[2];
            w = value[3];
        }

        if (x === this._rect.x &&
            y === this._rect.y &&
            z === this._rect.z &&
            w === this._rect.w
        ) {
            return;
        }

        this._rect.set(x, y, z, w);

        if (this._renderable.mesh) {
            if (! this._element._beingInitialized) {
                this._updateMesh(this._renderable.mesh);
            } else {
                this._meshDirty = true;
            }
        }
    }

    get material() {
        return this._material;
    }

    set material(value) {
        if (this._material === value) return;

        if (!value) {
            var screenSpace = this._element._isScreenSpace();
            if (this.mask) {
                value = screenSpace ? this._system.defaultScreenSpaceImageMaskMaterial : this._system.defaultImageMaskMaterial;
            } else {
                value = screenSpace ? this._system.defaultScreenSpaceImageMaterial : this._system.defaultImageMaterial;
            }
        }

        this._material = value;
        if (value) {
            this._renderable.setMaterial(value);

            // if this is not the default material then clear color and opacity overrides
            if (this._hasUserMaterial()) {
                this._renderable.deleteParameter('material_opacity');
                this._renderable.deleteParameter('material_emissive');
            } else {
                // otherwise if we are back to the defaults reset the color and opacity
                this._colorUniform[0] = this._color.r;
                this._colorUniform[1] = this._color.g;
                this._colorUniform[2] = this._color.b;
                this._renderable.setParameter('material_emissive', this._colorUniform);
                this._renderable.setParameter('material_opacity', this._color.a);
            }
        }
    }

    get materialAsset() {
        return this._materialAsset;
    }

    set materialAsset(value) {
        var assets = this._system.app.assets;
        var _id = value;

        if (value instanceof Asset) {
            _id = value.id;
        }

        if (this._materialAsset !== _id) {
            if (this._materialAsset) {
                assets.off('add:' + this._materialAsset, this._onMaterialAdded, this);
                var _prev = assets.get(this._materialAsset);
                if (_prev) {
                    _prev.off("load", this._onMaterialLoad, this);
                    _prev.off("change", this._onMaterialChange, this);
                    _prev.off("remove", this._onMaterialRemove, this);
                }
            }

            this._materialAsset = _id;
            if (this._materialAsset) {
                var asset = assets.get(this._materialAsset);
                if (!asset) {
                    this.material = null;
                    assets.on('add:' + this._materialAsset, this._onMaterialAdded, this);
                } else {
                    this._bindMaterialAsset(asset);
                }
            } else {
                this.material = null;
            }
        }
    }

    get texture() {
        return this._texture;
    }

    set texture(value) {
        if (this._texture === value) return;

        if (this._textureAsset) {
            var textureAsset = this._system.app.assets.get(this._textureAsset);
            if (textureAsset && textureAsset.resource !== value) {
                this.textureAsset = null;
            }
        }

        this._texture = value;

        if (value) {

            // clear sprite asset if texture is set
            if (this._spriteAsset) {
                this.spriteAsset = null;
            }

            // default texture just uses emissive and opacity maps
            this._renderable.setParameter("texture_emissiveMap", this._texture);
            this._renderable.setParameter("texture_opacityMap", this._texture);
            this._colorUniform[0] = this._color.r;
            this._colorUniform[1] = this._color.g;
            this._colorUniform[2] = this._color.b;
            this._renderable.setParameter("material_emissive", this._colorUniform);
            this._renderable.setParameter("material_opacity", this._color.a);
        } else {
            // clear texture params
            this._renderable.deleteParameter("texture_emissiveMap");
            this._renderable.deleteParameter("texture_opacityMap");
        }
    }

    get textureAsset() {
        return this._textureAsset;
    }

    set textureAsset(value) {
        var assets = this._system.app.assets;
        var _id = value;

        if (value instanceof Asset) {
            _id = value.id;
        }

        if (this._textureAsset !== _id) {
            if (this._textureAsset) {
                assets.off('add:' + this._textureAsset, this._onTextureAdded, this);
                var _prev = assets.get(this._textureAsset);
                if (_prev) {
                    _prev.off("load", this._onTextureLoad, this);
                    _prev.off("change", this._onTextureChange, this);
                    _prev.off("remove", this._onTextureRemove, this);
                }
            }

            this._textureAsset = _id;
            if (this._textureAsset) {
                var asset = assets.get(this._textureAsset);
                if (!asset) {
                    this.texture = null;
                    assets.on('add:' + this._textureAsset, this._onTextureAdded, this);
                } else {
                    this._bindTextureAsset(asset);
                }
            } else {
                this.texture = null;
            }
        }
    }

    get spriteAsset() {
        return this._spriteAsset;
    }

    set spriteAsset(value) {
        var assets = this._system.app.assets;
        var _id = value;

        if (value instanceof Asset) {
            _id = value.id;
        }

        if (this._spriteAsset !== _id) {
            if (this._spriteAsset) {
                assets.off('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
                var _prev = assets.get(this._spriteAsset);
                if (_prev) {
                    this._unbindSpriteAsset(_prev);
                }
            }

            this._spriteAsset = _id;
            if (this._spriteAsset) {
                var asset = assets.get(this._spriteAsset);
                if (!asset) {
                    this.sprite = null;
                    assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
                } else {
                    this._bindSpriteAsset(asset);
                }
            } else {
                this.sprite = null;
            }

            if (this._element) {
                this._element.fire('set:spriteAsset', _id);
            }
        }
    }

    get sprite() {
        return this._sprite;
    }

    set sprite(value) {
        if (this._sprite === value) return;

        if (this._sprite) {
            this._unbindSprite(this._sprite);
        }

        if (this._spriteAsset) {
            var spriteAsset = this._system.app.assets.get(this._spriteAsset);
            if (spriteAsset && spriteAsset.resource !== value) {
                this.spriteAsset = null;
            }
        }

        this._sprite = value;

        if (this._sprite) {
            this._bindSprite(this._sprite);

            // clear texture if sprite is being set
            if (this._textureAsset) {
                this.textureAsset = null;
            }
        }

        if (this._sprite && this._sprite.atlas && this._sprite.atlas.texture) {
            // default texture just uses emissive and opacity maps
            this._renderable.setParameter("texture_emissiveMap", this._sprite.atlas.texture);
            this._renderable.setParameter("texture_opacityMap", this._sprite.atlas.texture);
        } else {
            // clear texture params
            this._renderable.deleteParameter("texture_emissiveMap");
            this._renderable.deleteParameter("texture_opacityMap");
        }

        // clamp frame
        if (this._sprite) {
            this._spriteFrame = math.clamp(this._spriteFrame, 0, this._sprite.frameKeys.length - 1);
        }

        this._updateSprite();
    }

    get spriteFrame() {
        return this._spriteFrame;
    }

    set spriteFrame(value) {
        var oldValue = this._spriteFrame;

        if (this._sprite) {
            // clamp frame
            this._spriteFrame = math.clamp(value, 0, this._sprite.frameKeys.length - 1);
        } else {
            this._spriteFrame = value;
        }

        if (this._spriteFrame === oldValue) return;

        this._updateSprite();

        if (this._element) {
            this._element.fire('set:spriteFrame', value);
        }
    }

    get mesh() {
        return this._renderable.mesh;
    }

    set mesh(value) {
        this._renderable.setMesh(value);
        if (this._defaultMesh === value) {
            this._renderable.setAabbFunc(null);
        } else {
            this._renderable.setAabbFunc(this._updateAabbFunc);
        }
    }

    get mask() {
        return this._mask;
    }

    set mask(value) {
        if (this._mask !== value) {
            this._mask = value;
            this._toggleMask();
        }
    }

    get pixelsPerUnit() {
        return this._pixelsPerUnit;
    }

    set pixelsPerUnit(value) {
        if (this._pixelsPerUnit === value) return;

        this._pixelsPerUnit = value;
        if (this._sprite && (this._sprite.renderMode === SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
            this._updateSprite();
        }

    }

    // private
    get aabb() {
        if (this._renderable.meshInstance) {
            return this._renderable.meshInstance.aabb;
        }
        return null;
    }
}

export { ImageElement };
