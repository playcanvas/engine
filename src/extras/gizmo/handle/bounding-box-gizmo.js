import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { HandleGizmo } from './handle-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Entity } from '../../../framework/entity.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { HandleGizmoTheme, GizmoHandle } from './handle-gizmo.js'
 */

/**
 * @typedef {HandleGizmoTheme} BoundingBoxGizmoTheme
 */

const tmpBox = new BoundingBox();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();

const AXES = /** @type {const} */ (['x', 'y', 'z']);

const ORIGIN_DOT = 3;
const ORIGIN_RING = 7;
const MIN_FACTOR = 0.01;
const MIN_EXTENT = 1e-6;

/**
 * @param {Vec3} dir - A unit direction.
 * @returns {'x' | 'y' | 'z'} The world axis nearest the direction.
 */
const nearest = (dir) => {
    const x = Math.abs(dir.x);
    const y = Math.abs(dir.y);
    const z = Math.abs(dir.z);
    return x >= y && x >= z ? 'x' : y >= z ? 'y' : 'z';
};

/**
 * @param {number} half - The half extent, padding included.
 * @param {number} start - The half extent at the start of the resize, padding included.
 * @param {number} pad - The padding.
 * @returns {number} The factor the extent scaled by, 1 for a flat extent, which cannot scale.
 */
const fitFactor = (half, start, pad) => (start - pad > MIN_EXTENT ?
    Math.max((half - pad) / (start - pad), MIN_FACTOR) : 1);

/**
 * Draws corner brackets around the world bounds of the attached nodes, with a dot at each node's
 * origin. Face and corner handles resize the bounds, scaling each node along its local axes
 * nearest the world axes.
 *
 * ```javascript
 * const layer = Gizmo.createLayer(app, 'Bounds', undefined, true);
 * const gizmo = new BoundingBoxGizmo(cameraComponent, layer);
 * gizmo.attach([entity]);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Bounding Box Gizmo](https://playcanvas.github.io/#/gizmos/bounding-box)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class BoundingBoxGizmo extends HandleGizmo {
    /**
     * Whether to show handles at the center of each face. Defaults to true.
     *
     * @type {boolean}
     */
    faceHandles = true;

    /**
     * Whether to show handles at the corners. Defaults to true.
     *
     * @type {boolean}
     */
    cornerHandles = true;

    /**
     * Whether a resize keeps the center in place. Defaults to false.
     *
     * @type {boolean}
     */
    centered = false;

    /**
     * Whether corner handles scale evenly. Defaults to false.
     *
     * @type {boolean}
     */
    uniform = false;

    /**
     * Whether to join the brackets with dashed edges. Defaults to true.
     *
     * @type {boolean}
     */
    edges = true;

    /**
     * The arm length as a fraction of the half edge. Defaults to 0.3.
     *
     * @type {number}
     */
    armLength = 0.3;

    /**
     * The padding on each side, in world units. Defaults to 0.01.
     *
     * @type {number}
     */
    padding = 0.01;

    /**
     * The arm thickness in CSS pixels. Defaults to 2.
     *
     * @type {number}
     */
    armThickness = 2;

    /**
     * The bounds gathered this frame.
     *
     * @type {BoundingBox}
     * @private
     */
    _bounds = new BoundingBox();

    /**
     * Whether no bounds were gathered this frame.
     *
     * @type {boolean}
     * @private
     */
    _empty = true;

    /**
     * The box center.
     *
     * @private
     */
    _center = new Vec3();

    /**
     * The box half extents, padding included.
     *
     * @private
     */
    _halfExtents = new Vec3();

    /**
     * The center at the start of a resize.
     *
     * @private
     */
    _startCenter = new Vec3();

    /**
     * The half extents at the start of a resize, padding included.
     *
     * @private
     */
    _startHalfExtents = new Vec3();

    /**
     * The positions of the attached nodes at the start of a resize.
     *
     * @type {Vec3[]}
     * @private
     */
    _startPositions = [];

    /**
     * The local scales of the attached nodes at the start of a resize.
     *
     * @type {Vec3[]}
     * @private
     */
    _startScales = [];

    /**
     * Creates a new BoundingBoxGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new BoundingBoxGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:bounding-box');

        this._addNode = this._addNode.bind(this);
    }

    /**
     * Adds a box to the bounds.
     *
     * @param {BoundingBox} aabb - The box to add.
     * @private
     */
    _add(aabb) {
        if (!this._empty) {
            this._bounds.add(aabb);
            return;
        }
        this._bounds.copy(aabb);
        this._empty = false;
    }

    /**
     * Adds the bounds of the visible mesh instances.
     *
     * @param {readonly MeshInstance[]} meshInstances - The mesh instances to add.
     * @private
     */
    _addMeshInstances(meshInstances) {
        for (let i = 0; i < meshInstances.length; i++) {
            const meshInstance = meshInstances[i];
            if (meshInstance.visible) {
                this._add(meshInstance.aabb);
            }
        }
    }

    /**
     * Adds the bounds of an enabled node's render, model and gsplat components.
     *
     * @param {GraphNode} node - The node to add the bounds of.
     * @private
     */
    _addNode(node) {
        if (!node.enabled) {
            return;
        }
        const { render, model, gsplat } = /** @type {Entity} */ (node);
        if (render?.enabled) {
            this._addMeshInstances(render.meshInstances);
        }
        if (model?.enabled && model.meshInstances) {
            this._addMeshInstances(model.meshInstances);
        }
        const aabb = gsplat?.enabled && gsplat.customAabb;
        if (aabb) {
            tmpBox.setFromTransformedAabb(aabb, node.getWorldTransform());
            this._add(tmpBox);
        }
    }

    /**
     * Draws the box around the attached nodes.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const renderer = this._renderer;
        this._empty = true;
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].forEach(this._addNode);
        }
        if (!this._empty) {
            // a resize changes the nodes, so the box follows their bounds
            const c = this._center.copy(this._bounds.center);
            const h = this._halfExtents.copy(this._bounds.halfExtents).addScalar(this.padding);
            const corners = this._boxCorners(c, Quat.IDENTITY, h);
            this._drawBrackets(corners);
            if (this._theme.fill.a > 0) {
                renderer.box(c, Quat.IDENTITY, tmpV1.copy(h).mulScalar(2));
            }
            this._boxHandles(c, h, this, this.padding);
        }
        if (this.icon) {
            const camera = this._camera.entity;
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                if (node.enabled) {
                    const pos = node.getPosition();
                    renderer.dot(pos, ORIGIN_DOT);
                    renderer.circle(pos, camera.forward, renderer.pixels(pos, ORIGIN_RING), 0.6);
                }
            }
        }
    }

    /**
     * Draws the corner brackets and dashed edges.
     *
     * @param {Vec3[]} corners - The world corners, indexed by their x, y and z bits.
     * @private
     */
    _drawBrackets(corners) {
        const renderer = this._renderer;
        const { _center: c, _halfExtents: h } = this;

        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    const corner = tmpV1.set(c.x + h.x * x, c.y + h.y * y, c.z + h.z * z);
                    for (let k = 0; k < 3; k++) {
                        const axis = AXES[k];
                        const sign = k === 0 ? x : k === 1 ? y : z;
                        renderer.arm(corner, axis, sign, h[axis] * this.armLength, this.armThickness);
                    }
                }
            }
        }

        if (this.edges) {
            for (let i = 0; i < corners.length; i++) {
                for (let bit = 1; bit < corners.length; bit <<= 1) {
                    if (!(i & bit)) {
                        renderer.dashed(corners[i], corners[i | bit], 0.5, 0.45);
                    }
                }
            }
        }
    }

    /**
     * Stores the box and node transforms at the start of a resize.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @protected
     * @override
     */
    _startHandle(handle) {
        this._startCenter.copy(this._center);
        this._startHalfExtents.copy(this._halfExtents);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            (this._startPositions[i] ??= new Vec3()).copy(node.getPosition());
            (this._startScales[i] ??= new Vec3()).copy(node.getLocalScale());
        }
    }

    /**
     * Resizes the box and fits the attached nodes to it.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const half = this._halfExtents;
        this._resizeBox(handle, point, Quat.IDENTITY, this._startCenter, this._startHalfExtents, this, this.padding, this._center, half);

        const pad = this.padding;
        const start = this._startHalfExtents;
        const factor = tmpV3.set(
            fitFactor(half.x, start.x, pad),
            fitFactor(half.y, start.y, pad),
            fitFactor(half.z, start.z, pad)
        );

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const pos = tmpV1.sub2(this._startPositions[i], this._startCenter).mul(factor).add(this._center);
            node.setPosition(pos);

            // scale each local axis by the factor of its nearest world axis
            const scale = tmpV2.copy(this._startScales[i]);
            scale.x *= factor[nearest(node.right)];
            scale.y *= factor[nearest(node.up)];
            scale.z *= factor[nearest(node.forward)];
            node.setLocalScale(scale);
        }
    }
}

export { BoundingBoxGizmo };
