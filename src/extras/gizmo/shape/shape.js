import { Color } from '../../../core/math/color.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Entity } from '../../../framework/entity.js';
import { CULLFACE_BACK } from '../../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../../scene/constants.js';

import { COLOR_GRAY } from '../color.js';
import { Geometry } from '../../../scene/geometry/geometry.js';
import { unlitShader } from '../shaders.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js';
 * @import { Mesh } from '../../../scene/mesh.js';
 * @import { TriData } from './tri-data.js';
 */

const tmpC1 = new Color();

const tmpG = new Geometry();
tmpG.positions = [];
tmpG.normals = [];

/**
 * @typedef {object} ShapeArgs
 * @property {string} [axis] - The axis of the shape (e.g., 'x', 'y', 'z').
 * @property {Vec3} [position] - The position of the shape.
 * @property {Vec3} [rotation] - The rotation of the shape.
 * @property {Vec3} [scale] - The scale of the shape.
 * @property {boolean} [disabled] - Whether the shape is disabled.
 * @property {boolean} [visible] - Whether the shape is visible.
 * @property {number[]} [layers] - The layers the shape belongs to.
 * @property {Color} [defaultColor] - The default color of the shape.
 * @property {Color} [hoverColor] - The hover color of the shape.
 * @property {Color} [disabledColor] - The disabled color of the shape.
 * @property {Color} [occludedColor] - The color where the scene hides the shape, drawn first
 * without depth test.
 * @property {number} [cull] - The culling mode of the shape.
 * @property {number} [depth] - The depth of the shape. -1 = interpolated depth.
 */

/**
 * @ignore
 */
class Shape {
    /**
     * The position.
     *
     * @protected
     */
    _position = new Vec3();

    /**
     * The rotation.
     *
     * @protected
     */
    _rotation = new Vec3();

    /**
     * The scale.
     *
     * @protected
     */
    _scale = new Vec3(1, 1, 1);

    /**
     * The render component layers.
     *
     * @type {number[]}
     * @protected
     */
    _layers = [];

    /**
     * The material state.
     *
     * @type {ShaderMaterial}
     * @protected
     */
    _material = new ShaderMaterial(unlitShader);

    /**
     * The disabled state.
     *
     * @protected
     */
    _disabled = false;

    /**
     * The visibility state.
     *
     * @protected
     */
    _visible = true;

    /**
     * The default color.
     *
     * @type {Color}
     * @protected
     */
    _defaultColor = Color.WHITE;

    /**
     * The hover color.
     *
     * @type {Color}
     * @protected
     */
    _hoverColor = Color.BLACK;

    /**
     * The disabled color.
     *
     * @type {Color}
     * @protected
     */
    _disabledColor = COLOR_GRAY;

    /**
     * The occluded color, or null for no occluded pass.
     *
     * @type {Color|null}
     * @protected
     */
    _occludedColor = null;

    /**
     * The material of the occluded pass.
     *
     * @type {ShaderMaterial|null}
     * @protected
     */
    _occludedMaterial = null;

    /**
     * The hover state.
     *
     * @protected
     */
    _hovered = false;

    /**
     * The fade, a factor of the alpha of its colors.
     *
     * @protected
     */
    _fade = 1;

    /**
     * Uniform storage for the color.
     *
     * @type {number[]}
     * @protected
     */
    _colorData = [0, 0, 0, 0];

    /**
     * Uniform storage for the occluded color.
     *
     * @type {number[]}
     * @protected
     */
    _occludedColorData = [0, 0, 0, 0];

    /**
     * The culling state.
     *
     * @type {number}
     * @protected
     */
    _cull = CULLFACE_BACK;

    /**
     * The depth state. -1 = interpolated depth.
     *
     * @protected
     */
    _depth = -1;

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The axis.
     *
     * @type {string}
     */
    axis;

    /**
     * The entity.
     *
     * @type {Entity}
     */
    entity;

    /**
     * The triangle data.
     *
     * @type {TriData[]}
     */
    triData = [];

    /**
     * The mesh instances.
     *
     * @type {MeshInstance[]}
     */
    meshInstances = [];

    /**
     * The mesh instances of the occluded pass, one per entry of {@link Shape#meshInstances}.
     *
     * @type {MeshInstance[]}
     */
    occludedMeshInstances = [];

    /**
     * Create a shape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} name - The name of the shape.
     * @param {ShapeArgs} args - The options for the shape.
     */
    constructor(device, name, args) {
        this.device = device;
        this.axis = args.axis ?? 'x';

        if (args.position instanceof Vec3) {
            this._position.copy(args.position);
        }
        if (args.rotation instanceof Vec3) {
            this._rotation.copy(args.rotation);
        }
        if (args.scale instanceof Vec3) {
            this._scale.copy(args.scale);
        }

        this._disabled = args.disabled ?? this._disabled;
        this._visible = args.visible ?? this._visible;

        this._layers = args.layers ?? this._layers;

        if (args.defaultColor instanceof Color) {
            this._defaultColor = args.defaultColor;
        }
        if (args.hoverColor instanceof Color) {
            this._hoverColor = args.hoverColor;
        }
        if (args.disabledColor instanceof Color) {
            this._disabledColor = args.disabledColor;
        }
        if (args.occludedColor instanceof Color) {
            this._occludedColor = args.occludedColor;
        }

        this._cull = args.cull ?? this._cull;
        this._depth = args.depth ?? this._depth;

        this.entity = new Entity(`${name}:${this.axis}`);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
    }

    /**
     * Set the disabled state.
     *
     * @type {boolean}
     */
    set disabled(value) {
        this._disabled = value ?? false;
        this.hover(false);
    }

    /**
     * Get the disabled state.
     *
     * @type {boolean}
     */
    get disabled() {
        return this._disabled;
    }

    /**
     * Set the visibility state.
     *
     * @type {boolean}
     */
    set visible(value) {
        if (value === this._visible) {
            return;
        }
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].visible = value;
        }
        for (let i = 0; i < this.occludedMeshInstances.length; i++) {
            this.occludedMeshInstances[i].visible = value;
        }
        this._visible = value;
    }

    /**
     * Get the visibility state.
     *
     * @type {boolean}
     */
    get visible() {
        return this._visible;
    }

    /**
     * Set the fade, a factor of the alpha of its colors.
     *
     * @type {number}
     */
    set fade(value) {
        if (value === this._fade) {
            return;
        }
        this._fade = value;
        this.hover(this._hovered);
    }

    /**
     * Get the fade.
     *
     * @type {number}
     */
    get fade() {
        return this._fade;
    }

    /**
     * Gets the color for the current state, its alpha scaled by the fade and factor.
     *
     * @param {number[]} out - The array to receive the color.
     * @param {number} [factor] - A further factor of the alpha.
     * @returns {number[]} The color array.
     * @protected
     */
    _stateColor(out, factor = 1) {
        const color = this._disabled ?
            this._disabledColor : this._hovered ? this._hoverColor : this._defaultColor;
        tmpC1.copy(color).a *= this._fade * factor;
        return tmpC1.toArray(out);
    }

    /**
     * Set the depth bias, so the shape does not fight a surface it lies on. Positive values push
     * it away from the camera.
     *
     * @type {number}
     */
    set depthBias(value) {
        this._material.depthBias = value;
        this._material.slopeDepthBias = value;
    }

    /**
     * Get the depth bias.
     *
     * @type {number}
     */
    get depthBias() {
        return this._material.depthBias;
    }

    /**
     * Set whether the shape writes the depth buffer where it is visible.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        this._material.depthWrite = value;
    }

    /**
     * Get whether the shape writes the depth buffer where it is visible.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._material.depthWrite;
    }

    /**
     * Create a render component for an entity.
     *
     * @param {Entity} entity - The entity to create the render component for.
     * @param {Mesh[]} meshes - The meshes to create the render component with.
     * @protected
     */
    _createRenderComponent(entity, meshes) {
        const color = this._disabled ? this._disabledColor : this._defaultColor;
        this._material.setDefine('DEPTH_WRITE', this._depth > 0 ? '1' : '0');
        this._material.setParameter('uDepth', this._depth);
        this._material.setParameter('uColor', color.toArray());
        this._material.cull = this._cull;
        this._material.blendType = BLEND_NORMAL;
        this._material.update();

        if (this._occludedColor && !this._occludedMaterial) {
            const material = new ShaderMaterial(unlitShader);
            material.setDefine('DEPTH_WRITE', '0');
            material.setParameter('uDepth', this._depth);
            material.setParameter('uColor', this._occludedColor.toArray());
            material.cull = this._cull;
            material.blendType = BLEND_NORMAL;
            material.depthTest = false;
            material.depthWrite = false;
            material.update();
            this._occludedMaterial = material;
        }

        // each occluded instance draws before its visible instance
        const meshInstances = [];
        for (let i = 0; i < meshes.length; i++) {
            if (this._occludedMaterial) {
                const occluded = new MeshInstance(meshes[i], this._occludedMaterial);
                occluded.cull = false;
                meshInstances.push(occluded);
                this.occludedMeshInstances.push(occluded);
            }
            const mi = new MeshInstance(meshes[i], this._material);
            mi.cull = false;
            meshInstances.push(mi);
            this.meshInstances.push(mi);
        }
        entity.addComponent('render', {
            meshInstances: meshInstances,
            layers: this._layers,
            castShadows: false
        });
    }

    /**
     * Updates the transform.
     *
     * @protected
     */
    _update() {
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
    }

    /**
     * Sets the hover state.
     *
     * @param {boolean} state - Whether the shape is hovered.
     * @returns {void}
     */
    hover(state) {
        this._hovered = state;
        this._material.setParameter('uColor', this._stateColor(this._colorData));
        if (this._occludedColor) {
            tmpC1.copy(this._occludedColor).a *= this._fade;
            this._occludedMaterial?.setParameter('uColor', tmpC1.toArray(this._occludedColorData));
        }
    }

    /**
     * Destroys the shape and its entity.
     *
     * @returns {void}
     */
    destroy() {
        this.entity.destroy();
        this._occludedMaterial?.destroy();
    }
}

export { Shape };
