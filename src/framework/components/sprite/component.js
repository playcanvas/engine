import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec4 } from '../../../math/vec4.js';

import {
    LAYERID_WORLD,
    SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED
} from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';

import { Component } from '../component.js';

import { SPRITETYPE_SIMPLE, SPRITETYPE_ANIMATED } from './constants.js';
import { SpriteAnimationClip } from './sprite-animation-clip.js';

const PARAM_EMISSIVE_MAP = 'texture_emissiveMap';
const PARAM_OPACITY_MAP = 'texture_opacityMap';
const PARAM_EMISSIVE = 'material_emissive';
const PARAM_OPACITY = 'material_opacity';
const PARAM_INNER_OFFSET = 'innerOffset';
const PARAM_OUTER_SCALE = 'outerScale';
const PARAM_ATLAS_RECT = 'atlasRect';

/**
 * @component
 * @class
 * @name SpriteComponent
 * @augments pc.Component
 * @classdesc Enables an Entity to render a simple static sprite or sprite animations.
 * @param {pc.SpriteComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the SpriteComponent. Can be:
 *
 * * {@link pc.SPRITETYPE_SIMPLE}: The component renders a single frame from a sprite asset.
 * * {@link pc.SPRITETYPE_ANIMATED}: The component can play sprite animation clips.
 *
 * @property {number} frame The frame counter of the sprite. Specifies which frame from the current sprite asset to render.
 * @property {number} spriteAsset The id of the sprite asset to render. Only works for {@link pc.SPRITETYPE_SIMPLE} types.
 * @property {pc.Sprite} sprite The current sprite.
 * @property {number} width The width of the sprite when rendering using 9-Slicing. The width and height are only used when the render mode of the sprite asset is Sliced or Tiled.
 * @property {number} height The height of the sprite when rendering using 9-Slicing. The width and height are only used when the render mode of the sprite asset is Sliced or Tiled.
 * @property {pc.Color} color The color tint of the sprite.
 * @property {number} opacity The opacity of the sprite.
 * @property {boolean} flipX Flip the X axis when rendering a sprite.
 * @property {boolean} flipY Flip the Y axis when rendering a sprite.
 * @property {object} clips A dictionary that contains {@link pc.SpriteAnimationClip}s.
 * @property {pc.SpriteAnimationClip} currentClip The current clip being played.
 * @property {number} speed A global speed modifier used when playing sprite animation clips.
 * @property {number} batchGroupId Assign sprite to a specific batch group (see {@link pc.BatchGroup}). Default value is -1 (no group).
 * @property {string} autoPlayClip The name of the clip to play automatically when the component is enabled and the clip exists.
 * @property {number[]} layers An array of layer IDs ({@link pc.Layer#id}) to which this sprite should belong.
 * @property {number} drawOrder The draw order of the component. A higher value means that the component will be rendered on top of other components in the same layer. This is not used unless the layer's sort order is set to {@link pc.SORTMODE_MANUAL}.
 */
class SpriteComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._type = SPRITETYPE_SIMPLE;
        this._material = system.defaultMaterial;
        this._color = new Color(1, 1, 1, 1);
        this._colorUniform = new Float32Array(3);
        this._speed = 1;
        this._flipX = false;
        this._flipY = false;
        this._width = 1;
        this._height = 1;

        this._drawOrder = 0;
        this._layers = [LAYERID_WORLD]; // assign to the default world layer

        // 9-slicing
        this._outerScale = new Vec2(1, 1);
        this._outerScaleUniform = new Float32Array(2);
        this._innerOffset = new Vec4();
        this._innerOffsetUniform = new Float32Array(4);
        this._atlasRect = new Vec4();
        this._atlasRectUniform = new Float32Array(4);

        // batch groups
        this._batchGroupId = -1;
        this._batchGroup = null;

        // node / meshinstance
        this._node = new GraphNode();
        this._model = new Model();
        this._model.graph = this._node;
        this._meshInstance = null;
        entity.addChild(this._model.graph);
        this._model._entity = entity;
        this._updateAabbFunc = this._updateAabb.bind(this);

        this._addedModel = false;

        // animated sprites
        this._autoPlayClip = null;

        this._clips = {};

        // create default clip for simple sprite type
        this._defaultClip = new SpriteAnimationClip(this, {
            name: this.entity.name,
            fps: 0,
            loop: false,
            spriteAsset: null
        });

        this._currentClip = this._defaultClip;
    }

    onEnable() {
        var app = this.system.app;
        var scene = app.scene;

        scene.on("set:layers", this._onLayersChanged, this);
        if (scene.layers) {
            scene.layers.on("add", this._onLayerAdded, this);
            scene.layers.on("remove", this._onLayerRemoved, this);
        }

        this._showModel();
        if (this._autoPlayClip)
            this._tryAutoPlay();

        if (this._batchGroupId >= 0) {
            app.batcher.insert(BatchGroup.SPRITE, this._batchGroupId, this.entity);
        }
    }

    onDisable() {
        var app = this.system.app;
        var scene = app.scene;

        scene.off("set:layers", this._onLayersChanged, this);
        if (scene.layers) {
            scene.layers.off("add", this._onLayerAdded, this);
            scene.layers.off("remove", this._onLayerRemoved, this);
        }

        this.stop();
        this._hideModel();


        if (this._batchGroupId >= 0) {
            app.batcher.remove(BatchGroup.SPRITE, this._batchGroupId, this.entity);
        }
    }

    onDestroy() {
        this._currentClip = null;

        if (this._defaultClip) {
            this._defaultClip._destroy();
            this._defaultClip = null;
        }
        for (var key in this._clips) {
            this._clips[key]._destroy();
        }
        this._clips = null;

        this._hideModel();
        this._model = null;

        if (this._node) {
            if (this._node.parent)
                this._node.parent.removeChild(this._node);
            this._node = null;
        }

        if (this._meshInstance) {
            // make sure we decrease the ref counts materials and meshes
            this._meshInstance.material = null;
            this._meshInstance.mesh = null;
            this._meshInstance = null;
        }
    }

    _showModel() {
        if (this._addedModel) return;
        if (!this._meshInstance) return;

        var i;
        var len;

        var meshInstances = [this._meshInstance];

        for (i = 0, len = this._layers.length; i < len; i++) {
            var layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(meshInstances);
            }
        }

        this._addedModel = true;
    }

    _hideModel() {
        if (!this._addedModel || !this._meshInstance) return;

        var i;
        var len;

        var meshInstances = [this._meshInstance];

        for (i = 0, len = this._layers.length; i < len; i++) {
            var layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.removeMeshInstances(meshInstances);
            }
        }

        this._addedModel = false;
    }

    // Set the desired mesh on the mesh instance
    _showFrame(frame) {
        if (!this.sprite) return;

        var mesh = this.sprite.meshes[frame];
        // if mesh is null then hide the mesh instance
        if (!mesh) {
            if (this._meshInstance) {
                this._meshInstance.mesh = null;
                this._meshInstance.visible = false;
            }

            return;
        }

        var material;
        if (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED) {
            material = this.system.default9SlicedMaterialSlicedMode;
        } else if (this.sprite.renderMode === SPRITE_RENDERMODE_TILED) {
            material = this.system.default9SlicedMaterialTiledMode;
        } else {
            material = this.system.defaultMaterial;
        }

        // create mesh instance if it doesn't exist yet
        if (!this._meshInstance) {
            this._meshInstance = new MeshInstance(mesh, this._material, this._node);
            this._meshInstance.castShadow = false;
            this._meshInstance.receiveShadow = false;
            this._meshInstance.drawOrder = this._drawOrder;
            this._model.meshInstances.push(this._meshInstance);

            // set overrides on mesh instance
            this._colorUniform[0] = this._color.r;
            this._colorUniform[1] = this._color.g;
            this._colorUniform[2] = this._color.b;
            this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
            this._meshInstance.setParameter(PARAM_OPACITY, this._color.a);

            // now that we created the mesh instance, add the model to the scene
            if (this.enabled && this.entity.enabled) {
                this._showModel();
            }
        }

        // update material
        if (this._meshInstance.material !== material) {
            this._meshInstance.material = material;
        }

        // update mesh
        if (this._meshInstance.mesh !== mesh) {
            this._meshInstance.mesh = mesh;
            this._meshInstance.visible = true;
            // reset aabb
            this._meshInstance._aabbVer = -1;
        }

        // set texture params
        if (this.sprite.atlas && this.sprite.atlas.texture) {
            this._meshInstance.setParameter(PARAM_EMISSIVE_MAP, this.sprite.atlas.texture);
            this._meshInstance.setParameter(PARAM_OPACITY_MAP, this.sprite.atlas.texture);
        } else {
            // no texture so reset texture params
            this._meshInstance.deleteParameter(PARAM_EMISSIVE_MAP);
            this._meshInstance.deleteParameter(PARAM_OPACITY_MAP);
        }

        // for 9-sliced
        if (this.sprite.atlas && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
            // set custom aabb function
            this._meshInstance._updateAabbFunc = this._updateAabbFunc;

            // calculate inner offset
            var frameData = this.sprite.atlas.frames[this.sprite.frameKeys[frame]];
            if (frameData) {
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
                                    frameData.rect.w / tex.height
                );

            } else {
                this._innerOffset.set(0, 0, 0, 0);
            }

            // set inner offset and atlas rect on mesh instance
            this._innerOffsetUniform[0] = this._innerOffset.x;
            this._innerOffsetUniform[1] = this._innerOffset.y;
            this._innerOffsetUniform[2] = this._innerOffset.z;
            this._innerOffsetUniform[3] = this._innerOffset.w;
            this._meshInstance.setParameter(PARAM_INNER_OFFSET, this._innerOffsetUniform);
            this._atlasRectUniform[0] = this._atlasRect.x;
            this._atlasRectUniform[1] = this._atlasRect.y;
            this._atlasRectUniform[2] = this._atlasRect.z;
            this._atlasRectUniform[3] = this._atlasRect.w;
            this._meshInstance.setParameter(PARAM_ATLAS_RECT, this._atlasRectUniform);
        } else {
            this._meshInstance._updateAabbFunc = null;
        }

        this._updateTransform();
    }

    _updateTransform() {
        // flip
        var scaleX = this.flipX ? -1 : 1;
        var scaleY = this.flipY ? -1 : 1;

        // pivot
        var posX = 0;
        var posY = 0;

        if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {

            var w = 1;
            var h = 1;

            if (this.sprite.atlas) {
                var frameData = this.sprite.atlas.frames[this.sprite.frameKeys[this.frame]];
                if (frameData) {
                    // get frame dimensions
                    w = frameData.rect.z;
                    h = frameData.rect.w;

                    // update pivot
                    posX = (0.5 - frameData.pivot.x) * this._width;
                    posY = (0.5 - frameData.pivot.y) * this._height;
                }
            }

            // scale: apply PPU
            var scaleMulX = w / this.sprite.pixelsPerUnit;
            var scaleMulY = h / this.sprite.pixelsPerUnit;

            // scale borders if necessary instead of overlapping
            this._outerScale.set(Math.max(this._width, this._innerOffset.x * scaleMulX), Math.max(this._height, this._innerOffset.y * scaleMulY));

            scaleX *= scaleMulX;
            scaleY *= scaleMulY;

            this._outerScale.x /= scaleMulX;
            this._outerScale.y /= scaleMulY;

            // scale: shrinking below 1
            scaleX *= math.clamp(this._width / (this._innerOffset.x * scaleMulX), 0.0001, 1);
            scaleY *= math.clamp(this._height / (this._innerOffset.y * scaleMulY), 0.0001, 1);

            // update outer scale
            if (this._meshInstance) {
                this._outerScaleUniform[0] = this._outerScale.x;
                this._outerScaleUniform[1] = this._outerScale.y;
                this._meshInstance.setParameter(PARAM_OUTER_SCALE, this._outerScaleUniform);
            }
        }

        // scale
        this._node.setLocalScale(scaleX, scaleY, 1);
        // pivot
        this._node.setLocalPosition(posX, posY, 0);
    }

    // updates AABB while 9-slicing
    _updateAabb(aabb) {
        // pivot
        aabb.center.set(0, 0, 0);
        // size
        aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
        // world transform
        aabb.setFromTransformedAabb(aabb, this._node.getWorldTransform());
        return aabb;
    }

    _tryAutoPlay() {
        if (!this._autoPlayClip) return;
        if (this.type !== SPRITETYPE_ANIMATED) return;

        var clip = this._clips[this._autoPlayClip];
        // if the clip exists and nothing else is playing play it
        if (clip && !clip.isPlaying && (!this._currentClip || !this._currentClip.isPlaying)) {
            if (this.enabled && this.entity.enabled) {
                this.play(clip.name);
            }
        }
    }

    _onLayersChanged(oldComp, newComp) {
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);

        if (this.enabled && this.entity.enabled) {
            this._showModel();
        }
    }

    _onLayerAdded(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;

        if (this._addedModel && this.enabled && this.entity.enabled && this._meshInstance) {
            layer.addMeshInstances([this._meshInstance]);
        }
    }

    _onLayerRemoved(layer) {
        if (!this._meshInstance) return;

        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances([this._meshInstance]);
    }

    removeModelFromLayers() {
        var layer;
        for (var i = 0; i < this.layers.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.removeMeshInstances([this._meshInstance]);
        }
    }

    /**
     * @function
     * @name SpriteComponent#addClip
     * @description Creates and adds a new {@link pc.SpriteAnimationClip} to the component's clips.
     * @param {object} data - Data for the new animation clip.
     * @param {string} [data.name] - The name of the new animation clip.
     * @param {number} [data.fps] - Frames per second for the animation clip.
     * @param {object} [data.loop] - Whether to loop the animation clip.
     * @param {number} [data.spriteAsset] - The id of the sprite asset that this clip will play.
     * @returns {pc.SpriteAnimationClip} The new clip that was added.
     */
    addClip(data) {
        var clip = new SpriteAnimationClip(this, {
            name: data.name,
            fps: data.fps,
            loop: data.loop,
            spriteAsset: data.spriteAsset
        });

        this._clips[data.name] = clip;

        if (clip.name && clip.name === this._autoPlayClip)
            this._tryAutoPlay();

        return clip;
    }

    /**
     * @function
     * @name SpriteComponent#removeClip
     * @description Removes a clip by name.
     * @param {string} name - The name of the animation clip to remove.
     */
    removeClip(name) {
        delete this._clips[name];
    }

    /**
     * @function
     * @name SpriteComponent#clip
     * @description Get an animation clip by name.
     * @param {string} name - The name of the clip.
     * @returns {pc.SpriteAnimationClip} The clip.
     */
    clip(name) {
        return this._clips[name];
    }

    /**
     * @function
     * @name SpriteComponent#play
     * @description Plays a sprite animation clip by name. If the animation clip is already playing then this will do nothing.
     * @param {string} name - The name of the clip to play.
     * @returns {pc.SpriteAnimationClip} The clip that started playing.
     */
    play(name) {
        var clip = this._clips[name];

        var current = this._currentClip;
        if (current && current !== clip) {
            current._playing = false;
        }

        this._currentClip = clip;

        if (this._currentClip) {
            this._currentClip = clip;
            this._currentClip.play();
        } else {
            // #ifdef DEBUG
            console.warn('Trying to play sprite animation ' + name + ' which does not exist.');
            // #endif
        }

        return clip;
    }

    /**
     * @function
     * @name SpriteComponent#pause
     * @description Pauses the current animation clip.
     */
    pause() {
        if (this._currentClip === this._defaultClip) return;

        if (this._currentClip.isPlaying) {
            this._currentClip.pause();
        }
    }

    /**
     * @function
     * @name SpriteComponent#resume
     * @description Resumes the current paused animation clip.
     */
    resume() {
        if (this._currentClip === this._defaultClip) return;

        if (this._currentClip.isPaused) {
            this._currentClip.resume();
        }
    }

    /**
     * @function
     * @name SpriteComponent#stop
     * @description Stops the current animation clip and resets it to the first frame.
     */
    stop() {
        if (this._currentClip === this._defaultClip) return;

        this._currentClip.stop();
    }

    get type() {
        return this._type;
    }

    set type(value) {
        if (this._type === value)
            return;

        this._type = value;
        if (this._type === SPRITETYPE_SIMPLE) {
            this.stop();
            this._currentClip = this._defaultClip;

            if (this.enabled && this.entity.enabled) {
                this._currentClip.frame = this.frame;

                if (this._currentClip.sprite) {
                    this._showModel();
                } else {
                    this._hideModel();
                }
            }

        } else if (this._type === SPRITETYPE_ANIMATED) {
            this.stop();

            if (this._autoPlayClip) {
                this._tryAutoPlay();
            }

            if (this._currentClip && this._currentClip.isPlaying && this.enabled && this.entity.enabled) {
                this._showModel();
            } else {
                this._hideModel();
            }
        }
    }

    get frame() {
        return this._currentClip.frame;
    }

    set frame(value) {
        this._currentClip.frame = value;
    }

    get spriteAsset() {
        return this._defaultClip._spriteAsset;
    }

    set spriteAsset(value) {
        this._defaultClip.spriteAsset = value;
    }

    get sprite() {
        return this._currentClip.sprite;
    }

    set sprite(value) {
        this._currentClip.sprite = value;
    }

    // (private) {pc.Material} material The material used to render a sprite.
    get material() {
        return this._material;
    }

    set material(value) {
        this._material = value;
        if (this._meshInstance) {
            this._meshInstance.material = value;
        }
    }

    get color() {
        return this._color;
    }

    set color(value) {
        this._color.r = value.r;
        this._color.g = value.g;
        this._color.b = value.b;

        if (this._meshInstance) {
            this._colorUniform[0] = this._color.r;
            this._colorUniform[1] = this._color.g;
            this._colorUniform[2] = this._color.b;
            this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
        }
    }

    get opacity() {
        return this._color.a;
    }

    set opacity(value) {
        this._color.a = value;
        if (this._meshInstance) {
            this._meshInstance.setParameter(PARAM_OPACITY, value);
        }
    }

    get clips() {
        return this._clips;
    }

    set clips(value) {
        var name, key;

        // if value is null remove all clips
        if (!value) {
            for (name in this._clips) {
                this.removeClip(name);
            }
            return;
        }

        // remove existing clips not in new value
        // and update clips in both objects
        for (name in this._clips) {
            var found = false;
            for (key in value) {
                if (value[key].name === name) {
                    found = true;
                    this._clips[name].fps = value[key].fps;
                    this._clips[name].loop = value[key].loop;

                    if (value[key].hasOwnProperty('sprite')) {
                        this._clips[name].sprite = value[key].sprite;
                    } else if (value[key].hasOwnProperty('spriteAsset')) {
                        this._clips[name].spriteAsset = value[key].spriteAsset;
                    }

                    break;
                }
            }

            if (!found) {
                this.removeClip(name);
            }
        }

        // add clips that do not exist
        for (key in value) {
            if (this._clips[value[key].name]) continue;

            this.addClip(value[key]);
        }

        // auto play clip
        if (this._autoPlayClip) {
            this._tryAutoPlay();
        }

        // if the current clip doesn't have a sprite then hide the model
        if (!this._currentClip || !this._currentClip.sprite) {
            this._hideModel();
        }
    }

    get currentClip() {
        return this._currentClip;
    }

    get speed() {
        return this._speed;
    }

    set speed(value) {
        this._speed = value;
    }

    get flipX() {
        return this._flipX;
    }

    set flipX(value) {
        if (this._flipX === value) return;

        this._flipX = value;
        this._updateTransform();
    }

    get flipY() {
        return this._flipY;
    }

    set flipY(value) {
        if (this._flipY === value) return;

        this._flipY = value;
        this._updateTransform();
    }

    get width() {
        return this._width;
    }

    set width(value) {
        if (value === this._width) return;

        this._width = value;
        this._outerScale.x = this._width;

        if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
            this._updateTransform();
        }
    }

    get height() {
        return this._height;
    }

    set height(value) {
        if (value === this._height) return;

        this._height = value;
        this._outerScale.y = this.height;

        if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
            this._updateTransform();
        }
    }

    get batchGroupId() {
        return this._batchGroupId;
    }

    set batchGroupId(value) {
        if (this._batchGroupId === value)
            return;

        var prev = this._batchGroupId;
        this._batchGroupId = value;

        if (this.entity.enabled && prev >= 0) {
            this.system.app.batcher.remove(BatchGroup.SPRITE, prev, this.entity);
        }
        if (this.entity.enabled && value >= 0) {
            this.system.app.batcher.insert(BatchGroup.SPRITE, value, this.entity);
        } else {
            // re-add model to scene in case it was removed by batching
            if (prev >= 0) {
                if (this._currentClip && this._currentClip.sprite && this.enabled && this.entity.enabled) {
                    this._showModel();
                }
            }
        }
    }

    get autoPlayClip() {
        return this._autoPlayClip;
    }

    set autoPlayClip(value) {
        this._autoPlayClip = value instanceof SpriteAnimationClip ? value.name : value;
        this._tryAutoPlay();
    }

    get drawOrder() {
        return this._drawOrder;
    }

    set drawOrder(value) {
        this._drawOrder = value;
        if (this._meshInstance) {
            this._meshInstance.drawOrder = value;
        }
    }

    get layers() {
        return this._layers;
    }

    set layers(value) {
        if (this._addedModel) {
            this._hideModel();
        }

        this._layers = value;

        // early out
        if (!this._meshInstance) {
            return;
        }

        if (this.enabled && this.entity.enabled) {
            this._showModel();
        }
    }

    get aabb() {
        if (this._meshInstance) {
            return this._meshInstance.aabb;
        }

        return null;
    }

    // Events Documentation

    /**
     * @event
     * @name SpriteComponent#play
     * @description Fired when an animation clip starts playing.
     * @param {pc.SpriteAnimationClip} clip - The clip that started playing.
     */

    /**
     * @event
     * @name SpriteComponent#pause
     * @description Fired when an animation clip is paused.
     * @param {pc.SpriteAnimationClip} clip - The clip that was paused.
     */

    /**
     * @event
     * @name SpriteComponent#resume
     * @description Fired when an animation clip is resumed.
     * @param {pc.SpriteAnimationClip} clip - The clip that was resumed.
     */

    /**
     * @event
     * @name SpriteComponent#stop
     * @description Fired when an animation clip is stopped.
     * @param {pc.SpriteAnimationClip} clip - The clip that was stopped.
     */

    /**
     * @event
     * @name SpriteComponent#end
     * @description Fired when an animation clip stops playing because it reached its ending.
     * @param {pc.SpriteAnimationClip} clip - The clip that ended.
     */

    /**
     * @event
     * @name SpriteComponent#loop
     * @description Fired when an animation clip reached the end of its current loop.
     * @param {pc.SpriteAnimationClip} clip - The clip.
     */
}

export { SpriteComponent };
