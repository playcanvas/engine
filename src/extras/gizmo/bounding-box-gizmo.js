import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Entity } from '../../framework/entity.js';
import { BLEND_NORMAL, PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { BoxGeometry } from '../../scene/geometry/box-geometry.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { Gizmo } from './gizmo.js';
import { unlitShader } from './shaders.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 */

/**
 * @typedef {object} BoundingBoxGizmoTheme
 * @property {Color} base - The color where the box is visible.
 * @property {Color} occluded - The color where the scene hides the box.
 */

// temporary variables
const tmpBox = new BoundingBox();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();

const AXES = /** @type {const} */ (['x', 'y', 'z']);

/**
 * Draws corner brackets around the world-space bounds of the attached nodes and their
 * descendants. Use a layer that keeps the scene depth so occluded parts draw in the theme's
 * `occluded` color; a {@link Gizmo.createLayer} layer clears depth.
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
class BoundingBoxGizmo extends Gizmo {
    /**
     * Internal theme.
     *
     * @type {BoundingBoxGizmoTheme}
     * @private
     */
    _theme = {
        base: Color.WHITE.clone(),
        occluded: new Color(1, 1, 1, 0.2)
    };

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
     * Gets the current theme for the gizmo.
     *
     * @type {BoundingBoxGizmoTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or partial theme for the gizmo.
     *
     * @param {Partial<BoundingBoxGizmoTheme>} partial - The partial theme to set.
     * @example
     * gizmo.setTheme({ occluded: new Color(1, 1, 1, 0.5) });
     */
    setTheme(partial) {
        if (partial?.base instanceof Color) {
            this._theme.base.copy(partial.base);
        }
        if (partial?.occluded instanceof Color) {
            this._theme.occluded.copy(partial.occluded);
        }
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
     * The box is world aligned.
     *
     * @override
     */
    _updateRotation() {
    }

    /**
     * The box is sized in world units.
     *
     * @override
     */
    _updateScale() {
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
     * Gathers the bounds of the attached nodes and places the arms around them.
     *
     * @override
     */
    prerender() {
        if (!this.enabled) {
            return;
        }

        this._empty = true;
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].forEach(this._addNode);
        }
        this._box.enabled = !this._empty;
        if (this._empty) {
            return;
        }

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
