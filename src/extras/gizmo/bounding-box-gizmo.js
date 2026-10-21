import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Entity } from '../../framework/entity.js';
import { BLEND_NORMAL, PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { BoxGeometry } from '../../scene/geometry/box-geometry.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { COLOR_AMBER, COLOR_CYAN, COLOR_MAGENTA } from './color.js';
import { HelperGizmo } from './helper-gizmo.js';
import { unlitShader } from './shaders.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { HelperGizmoTheme, HelperHandle } from './helper-gizmo.js'
 */

/**
 * @typedef {HelperGizmoTheme} BoundingBoxGizmoTheme
 */

// temporary variables
const tmpBox = new BoundingBox();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();

const AXES = /** @type {const} */ (['x', 'y', 'z']);

const FACES = [Vec3.RIGHT, Vec3.LEFT, Vec3.UP, Vec3.DOWN, Vec3.BACK, Vec3.FORWARD];
const FACE_COLORS = [COLOR_AMBER, COLOR_CYAN, COLOR_MAGENTA];
const FACE_LABELS = ['W', 'H', 'D'];

const ORIGIN_DOT = 3;
const ORIGIN_RING = 7;
const MIN_FACTOR = 0.01;

/**
 * @param {number} value - The value.
 * @returns {string} The value with two decimals.
 */
const fmt = value => value.toFixed(2);

/**
 * Draws corner brackets around the world-space bounds of the attached nodes and their
 * descendants, joined by dashed edges over a faint volume, with a dot at the origin of each
 * attached node. Once the box is large enough on screen, a handle at the center of each face
 * drags to resize the attached nodes, keeping the opposite face in place, and labels show the
 * width, height or depth while hovered. A resize scales each node along its local axis nearest the dragged
 * axis, which is exact for nodes aligned with the world axes.
 *
 * ```javascript
 * const layer = new Layer({ name: 'Bounds', transparentSortMode: SORTMODE_NONE });
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
class BoundingBoxGizmo extends HelperGizmo {
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
     * Parent of the arms, disabled when there are no bounds.
     *
     * @type {Entity}
     * @private
     */
    _box = new Entity('box');

    /**
     * The arm entities, three per corner.
     *
     * @type {Entity[]}
     * @private
     */
    _arms = [];

    /**
     * Material of the occluded pass, drawn without depth test.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _occludedMaterial;

    /**
     * Material of the depth tested pass.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _material;

    /**
     * Uniform storage for the base color.
     *
     * @type {number[]}
     * @private
     */
    _colorData = [0, 0, 0, 0];

    /**
     * Uniform storage for the occluded color.
     *
     * @type {number[]}
     * @private
     */
    _occludedColorData = [0, 0, 0, 0];

    /**
     * The bounds at the start of a resize, without padding.
     *
     * @private
     */
    _startBounds = new BoundingBox();

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

        this._occludedMaterial = this._createMaterial(false);
        this._material = this._createMaterial(true);

        // occluded pass first, then the depth tested pass over it
        const mesh = Mesh.fromGeometry(this._device, new BoxGeometry());
        for (let i = 0; i < 24; i++) {
            const arm = new Entity(`arm:${i}`);
            const meshInstances = [
                new MeshInstance(mesh, this._occludedMaterial),
                new MeshInstance(mesh, this._material)
            ];
            for (let j = 0; j < meshInstances.length; j++) {
                meshInstances[j].cull = false;
            }
            arm.addComponent('render', {
                meshInstances,
                layers: [layer.id],
                castShadows: false
            });
            this._box.addChild(arm);
            this._arms.push(arm);
        }
        this.root.addChild(this._box);
    }

    /**
     * Creates an arm material.
     *
     * @param {boolean} depthTest - Whether the material is depth tested.
     * @returns {ShaderMaterial} The material.
     * @private
     */
    _createMaterial(depthTest) {
        const material = new ShaderMaterial(unlitShader);
        material.setDefine('DEPTH_WRITE', '0');
        material.setParameter('uDepth', 0);
        material.blendType = BLEND_NORMAL;
        material.depthTest = depthTest;
        material.depthWrite = false;
        material.update();
        return material;
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
        this._empty = true;
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].forEach(this._addNode);
        }
        this._box.enabled = !this._empty && !this.iconOnly;
        if (this._box.enabled) {
            this._drawBox();
        }
        if (this.icon) {
            const shapes = this._shapes;
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
     * Places the arms, edges, volume, handles and labels around the gathered bounds.
     *
     * @private
     */
    _drawBox() {
        const { center: c, halfExtents: h } = this._bounds;
        h.addScalar(this.padding);

        this._occludedMaterial.setParameter('uColor', this._theme.occluded.toArray(this._occludedColorData));
        this._material.setParameter('uColor', this._theme.base.toArray(this._colorData));

        // world size of a pixel, per unit depth in perspective
        const camera = this._camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const { width, height } = this._device.clientRect;
        const span = perspective ? 2 * Math.tan(0.5 * camera.fov * math.DEG_TO_RAD) : 2 * camera.orthoHeight;
        const pixel = span / Math.max(camera.horizontalFov ? width : height, 1);
        const cameraPos = camera.entity.getPosition();
        const forward = camera.entity.forward;
        const rootPos = this.root.getPosition();

        // three arms per corner, overhanging it by half a thickness so they meet
        let i = 0;
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    const corner = tmpV1.set(c.x + h.x * x, c.y + h.y * y, c.z + h.z * z);
                    const depth = perspective ? Math.max(tmpV2.sub2(corner, cameraPos).dot(forward), camera.nearClip) : 1;
                    const thickness = this.armThickness * pixel * depth;
                    for (let k = 0; k < 3; k++) {
                        const axis = AXES[k];
                        const sign = k === 0 ? x : k === 1 ? y : z;
                        const length = h[axis] * this.armLength;

                        const pos = tmpV2.copy(corner).sub(rootPos);
                        pos[axis] -= sign * 0.5 * (length - 0.5 * thickness);

                        const along = length + 0.5 * thickness;
                        const arm = this._arms[i++];
                        arm.setLocalPosition(pos);
                        arm.setLocalScale(k === 0 ? along : thickness, k === 1 ? along : thickness, k === 2 ? along : thickness);
                    }
                }
            }
        }

        const shapes = this._shapes;
        if (this._theme.fill.a > 0) {
            shapes.box(c, Quat.IDENTITY, tmpV1.copy(h).mulScalar(2));
        }
        if (this.edges) {
            // the four edges along each axis, at each sign of the other two
            for (let k = 0; k < 3; k++) {
                const axis = AXES[k];
                const u = AXES[(k + 1) % 3];
                const v = AXES[(k + 2) % 3];
                for (let i = 0; i < 4; i++) {
                    const a = tmpV3.copy(c);
                    a[u] += i & 1 ? h[u] : -h[u];
                    a[v] += i & 2 ? h[v] : -h[v];
                    const b = tmpV4.copy(a);
                    a[axis] -= h[axis];
                    b[axis] += h[axis];
                    shapes.dashed(a, b, 0.5, 0.45);
                }
            }
        }

        if (!this._detailed(c, Math.max(h.x, h.y, h.z))) {
            return;
        }
        const node = this.nodes[0];
        for (let i = 0; i < FACES.length; i++) {
            const face = FACES[i];
            const axis = i >> 1;
            const pos = tmpV1.set(c.x + face.x * h.x, c.y + face.y * h.y, c.z + face.z * h.z);
            if (this._handle(pos, FACE_COLORS[axis], node, 'size', i, c, face)) {
                this._readoutAt(pos, FACE_LABELS[axis], FACE_COLORS[axis], fmt(2 * (h[AXES[axis]] - this.padding)));
            }
        }
    }

    /**
     * Keeps the bounds and the transforms of the attached nodes at the start of a resize.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @protected
     * @override
     */
    _startHandle(handle) {
        this._startBounds.copy(this._bounds);
        this._startBounds.halfExtents.addScalar(-this.padding);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            (this._startPositions[i] ??= new Vec3()).copy(node.getPosition());
            (this._startScales[i] ??= new Vec3()).copy(node.getLocalScale());
        }
    }

    /**
     * Resizes the attached nodes along the axis of the dragged face, keeping the opposite face in
     * place.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the face is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const axis = AXES[handle.index >> 1];
        const sign = handle.index & 1 ? -1 : 1;
        const { center, halfExtents } = this._startBounds;
        const anchor = center[axis] - sign * halfExtents[axis];
        const face = point[axis] - sign * this.padding;
        const factor = Math.max((face - anchor) / (2 * sign * halfExtents[axis]), MIN_FACTOR);

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const start = this._startPositions[i];
            const pos = tmpV1.copy(start);
            pos[axis] = anchor + (start[axis] - anchor) * factor;
            node.setPosition(pos);

            // the local axis nearest the world axis takes the scale
            const right = Math.abs(node.right[axis]);
            const up = Math.abs(node.up[axis]);
            const forward = Math.abs(node.forward[axis]);
            const local = right >= up && right >= forward ? 'x' : up >= forward ? 'y' : 'z';
            const scale = tmpV2.copy(this._startScales[i]);
            scale[local] *= factor;
            node.setLocalScale(scale);
        }
    }

    /**
     * Destroys the gizmo and its materials.
     *
     * @override
     */
    destroy() {
        super.destroy();

        this._occludedMaterial.destroy();
        this._material.destroy();
    }
}

export { BoundingBoxGizmo };
