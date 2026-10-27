import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Entity } from '../../../framework/entity.js';
import { CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../../scene/constants.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Mesh } from '../../../scene/mesh.js';
import { unlitShader } from '../shaders.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

const tmpV1 = new Vec3();
const tmpQ1 = new Quat();

const UPDATE_EPSILON = 1e-6;

/**
 * @typedef {object} PlaneShapeArgs
 * @property {number} [size] - The size of the plane
 * @property {number} [gap] - The gap between the plane and the center
 * @property {number} [opacity] - The opacity of the fill, as a factor of the shape color alpha
 * @property {number} [outlineThickness] - The thickness of the outline, in the units of the gizmo
 */

/**
 * @ignore
 */
class PlaneShape extends Shape {
    /**
     * The culling mode for the plane.
     *
     * @type {number}
     * @protected
     */
    _cull = CULLFACE_NONE;

    /**
     * The size.
     *
     * @private
     */
    _size = 0.16;

    /**
     * The gap between the plane and the center.
     *
     * @private
     */
    _gap = 0;

    /**
     * The flipped state.
     *
     * @private
     */
    _flipped = new Vec3();

    /**
     * The opacity of the fill, as a factor of the shape color alpha.
     *
     * @private
     */
    _opacity = 0.35;

    /**
     * The thickness of the outline, in the units of the gizmo.
     *
     * @private
     */
    _outlineThickness = 0.01;

    /**
     * The material of the outline, which keeps the full shape color.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _outlineMaterial = new ShaderMaterial(unlitShader);

    /**
     * The outline edges on the two outer sides, clear of the axes.
     *
     * @type {Entity[]}
     * @private
     */
    _outlines = [];

    /**
     * The mesh instances of the outline.
     *
     * @type {MeshInstance[]}
     * @private
     */
    _outlineMeshInstances = [];

    /**
     * Uniform storage for the outline color.
     *
     * @type {number[]}
     * @private
     */
    _outlineColorData = [0, 0, 0, 0];

    /**
     * Create a new PlaneShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & PlaneShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'plane', args);

        this._size = args.size ?? this._size;
        this._gap = args.gap ?? this._gap;
        this._opacity = args.opacity ?? this._opacity;
        this._outlineThickness = args.outlineThickness ?? this._outlineThickness;

        // below the center shape, so a plane in front of it does not take its press
        this.triData = [
            new TriData(new PlaneGeometry(), 1)
        ];

        this._createRenderComponent(this.entity, [
            Mesh.fromGeometry(this.device, new PlaneGeometry())
        ]);

        this._outlineMaterial.setDefine('DEPTH_WRITE', this._depth > 0 ? '1' : '0');
        this._outlineMaterial.setParameter('uDepth', this._depth);
        this._outlineMaterial.cull = this._cull;
        this._outlineMaterial.blendType = BLEND_NORMAL;
        this._outlineMaterial.update();
        const mesh = Mesh.fromGeometry(this.device, new BoxGeometry());
        for (let i = 0; i < 2; i++) {
            const outline = new Entity(`outline:${this.axis}:${i}`);
            const meshInstance = new MeshInstance(mesh, this._outlineMaterial);
            meshInstance.cull = false;
            outline.addComponent('render', {
                meshInstances: [meshInstance],
                layers: this._layers,
                castShadows: false
            });
            this.entity.addChild(outline);
            this._outlines.push(outline);
            this._outlineMeshInstances.push(meshInstance);
        }

        this._update();
        this.hover(false);
    }

    /**
     * Set the visibility state.
     *
     * @type {boolean}
     */
    set visible(value) {
        super.visible = value;
        for (let i = 0; i < this._outlineMeshInstances.length; i++) {
            this._outlineMeshInstances[i].visible = value;
        }
    }

    /**
     * Get the visibility state.
     *
     * @type {boolean}
     */
    get visible() {
        return super.visible;
    }

    /**
     * Set the size.
     *
     * @type {number}
     */
    set size(value) {
        this._size = value ?? this._size;
        this._update();
    }

    /**
     * Get the size.
     *
     * @type {number}
     */
    get size() {
        return this._size;
    }

    /**
     * Set the gap between the plane and the center.
     *
     * @type {number}
     */
    set gap(value) {
        this._gap = value ?? this._gap;
        this._update();
    }

    /**
     * Get the gap between the plane and the center.
     *
     * @type {number}
     */
    get gap() {
        return this._gap;
    }

    /**
     * Set the opacity of the fill, as a factor of the shape color alpha.
     *
     * @type {number}
     */
    set opacity(value) {
        this._opacity = value ?? this._opacity;
        this.hover(this._hovered);
    }

    /**
     * Get the opacity of the fill.
     *
     * @type {number}
     */
    get opacity() {
        return this._opacity;
    }

    /**
     * Set the thickness of the outline, in the units of the gizmo. A thickness of 0 hides it.
     *
     * @type {number}
     */
    set outlineThickness(value) {
        this._outlineThickness = value ?? this._outlineThickness;
        this._update();
    }

    /**
     * Get the thickness of the outline.
     *
     * @type {number}
     */
    get outlineThickness() {
        return this._outlineThickness;
    }

    /**
     * Set the flipped state.
     *
     * @type {Vec3}
     */
    set flipped(value) {
        if (this._flipped.distance(value) < UPDATE_EPSILON) {
            return;
        }
        this._flipped.copy(value);
        this._update();
    }

    /**
     * Get the flipped state.
     *
     * @type {Vec3}
     */
    get flipped() {
        return this._flipped;
    }

    /**
     * Updates the transform.
     *
     * @protected
     * @override
     */
    _update() {
        const offset = this._size / 2 + this._gap;
        this._position.set(
            this._flipped.x ? -offset : offset,
            this._flipped.y ? -offset : offset,
            this._flipped.z ? -offset : offset
        );
        this._position[this.axis] = 0;
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);

        // the outer sides face away from the center
        const outer = tmpQ1.setFromEulerAngles(this._rotation).invert().transformVector(this._position, tmpV1);
        const sx = outer.x < 0 ? -1 : 1;
        const sz = outer.z < 0 ? -1 : 1;
        const t = this._outlineThickness / this._size;
        for (let i = 0; i < this._outlines.length; i++) {
            this._outlines[i].enabled = t > 0;
        }

        // overhang the corner by half a thickness so the edges meet
        this._outlines[0]?.setLocalPosition(sx * 0.25 * t, 0, sz * 0.5);
        this._outlines[0]?.setLocalScale(1 + 0.5 * t, t, t);
        this._outlines[1]?.setLocalPosition(sx * 0.5, 0, sz * 0.25 * t);
        this._outlines[1]?.setLocalScale(t, t, 1 + 0.5 * t);
    }

    /**
     * Sets the hover state.
     *
     * @param {boolean} state - Whether the shape is hovered.
     * @override
     */
    hover(state) {
        this._hovered = state;
        this._material.setParameter('uColor', this._stateColor(this._colorData, this._opacity));
        this._outlineMaterial.setParameter('uColor', this._stateColor(this._outlineColorData));
    }

    /**
     * Destroys the shape and its outline material.
     *
     * @override
     */
    destroy() {
        super.destroy();
        this._outlineMaterial.destroy();
    }
}

export { PlaneShape };
