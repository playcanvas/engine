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

// temporary variables
const tmpBox = new BoundingBox();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();

const AXES = /** @type {const} */ (['x', 'y', 'z']);

const ORIGIN_DOT = 3;
const ORIGIN_RING = 7;
const MIN_FACTOR = 0.01;

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
 * Draws corner brackets around the world-space bounds of the attached nodes and their
 * descendants, joined by dashed edges over a faint volume, with a dot at the origin of each
 * attached node. Like a {@link BoxGizmo}, once the box is large enough on screen, its face and
 * corner handles resize it, which resizes the attached nodes, showing the width, height or
 * depth while hovered. A resize scales each node along its local axes nearest the world axes,
 * which is exact for nodes aligned with them.
 *
 * ```javascript
 * const layer = new Layer({ name: 'Bounds', transparentSortMode: SORTMODE_MANUAL });
 * app.scene.layers.push(layer);
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
     * Whether a resize keeps the center of the bounds in place, moving the opposite face or corner
     * too, rather than keeping the opposite face or corner in place. Defaults to false.
     *
     * @type {boolean}
     */
    centered = false;

    /**
     * Whether a corner handle scales the bounds evenly, along the diagonal through the corner,
     * rather than resizing each axis. Defaults to false.
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
     * The arm length as a fraction of the half edge; 1 draws full edges. Defaults to 0.3.
     *
     * @type {number}
     */
    armLength = 0.3;

    /**
     * The world-space padding on each side. Defaults to 0.01.
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
     * The center of the box drawn this frame, or resized by a drag.
     *
     * @private
     */
    _center = new Vec3();

    /**
     * The half extents of the box drawn this frame, padding included.
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
     * Gathers the bounds of the attached nodes and places the box around them.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        const shapes = this._shapes;
        this._empty = true;
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].forEach(this._addNode);
        }
        if (!this._empty) {

            // the box follows the bounds, which a resize changes through the nodes
            const c = this._center.copy(this._bounds.center);
            const h = this._halfExtents.copy(this._bounds.halfExtents).addScalar(this.padding);
            const corners = this._boxCorners(c, Quat.IDENTITY, h);
            this._drawBrackets(corners);
            if (this._theme.fill.a > 0) {
                shapes.box(c, Quat.IDENTITY, tmpV1.copy(h).mulScalar(2));
            }
            this._boxHandles(c, h, this, this.padding);
        }
        if (this.icon) {
            const camera = this._camera.entity;
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                if (node.enabled) {
                    const pos = node.getPosition();
                    shapes.dot(pos, ORIGIN_DOT);
                    shapes.circle(pos, camera.forward, shapes.pixels(pos, ORIGIN_RING), 0.6);
                }
            }
        }
    }

    /**
     * Places the corner brackets and the dashed edges joining them.
     *
     * @param {Vec3[]} corners - The world corners, the bits of each index giving its x, y and z
     * sides.
     * @private
     */
    _drawBrackets(corners) {
        const shapes = this._shapes;
        const { _center: c, _halfExtents: h } = this;

        // three arms per corner
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    const corner = tmpV1.set(c.x + h.x * x, c.y + h.y * y, c.z + h.z * z);
                    for (let k = 0; k < 3; k++) {
                        const axis = AXES[k];
                        const sign = k === 0 ? x : k === 1 ? y : z;
                        shapes.arm(corner, axis, sign, h[axis] * this.armLength, this.armThickness);
                    }
                }
            }
        }

        if (this.edges) {
            for (let i = 0; i < corners.length; i++) {
                for (let bit = 1; bit < corners.length; bit <<= 1) {
                    if (!(i & bit)) {
                        shapes.dashed(corners[i], corners[i | bit], 0.5, 0.45);
                    }
                }
            }
        }
    }

    /**
     * Keeps the bounds and the transforms of the attached nodes at the start of a resize.
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
     * Resizes the box, then the attached nodes to fit it. Each node keeps its place within the
     * box and scales along its local axes nearest the world axes.
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
            Math.max((half.x - pad) / Math.max(start.x - pad, 1e-6), MIN_FACTOR),
            Math.max((half.y - pad) / Math.max(start.y - pad, 1e-6), MIN_FACTOR),
            Math.max((half.z - pad) / Math.max(start.z - pad, 1e-6), MIN_FACTOR)
        );

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const pos = tmpV1.sub2(this._startPositions[i], this._startCenter).mul(factor).add(this._center);
            node.setPosition(pos);

            // each local axis takes the factor of the world axis it is nearest
            const scale = tmpV2.copy(this._startScales[i]);
            scale.x *= factor[nearest(node.right)];
            scale.y *= factor[nearest(node.up)];
            scale.z *= factor[nearest(node.forward)];
            node.setLocalScale(scale);
        }
    }
}

export { BoundingBoxGizmo };
