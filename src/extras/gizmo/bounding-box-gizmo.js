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
 * @property {Color} base - The color of the parts of the box that are in view.
 * @property {Color} occluded - The color of the box drawn with no depth test, which shows where
 * the scene hides it.
 */

// temporary variables
const tmpBox = new BoundingBox();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();

// axes of the three arms at each corner
const AXES = /** @type {const} */ (['x', 'y', 'z']);

/**
 * A gizmo that outlines the world-space bounding box of the attached {@link GraphNode}s with
 * brackets at its corners, as an editor marks a selection. The box encloses the visible mesh
 * instances of the render and model components and the bounds of the gsplat components of the
 * attached nodes and their descendants, and refits every frame as they move, animate or change.
 * Nothing is drawn while none of them has anything to bound.
 *
 * The arms of the brackets are {@link armLength} long and {@link armThickness} pixels thick. They
 * are drawn twice: in the theme's `occluded` color with no depth test, then in its `base` color
 * depth tested against what was rendered before the gizmo's layer, so the parts hidden behind the
 * scene show faintly. That needs a layer which keeps the scene's depth, unlike
 * the one made by {@link Gizmo.createLayer}, which clears it so transform handles are never
 * hidden; in such a layer the whole box shows in the `base` color. The colors are set with
 * {@link setTheme}.
 *
 * ```javascript
 * // Create a layer drawn after the scene, keeping its depth
 * const layer = new Layer({ name: 'Bounds', transparentSortMode: SORTMODE_NONE });
 * app.scene.layers.push(layer);
 *
 * // Create the gizmo and outline an entity with it
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
     * The length of each corner bracket arm, as a fraction of half the edge it runs along, so 1
     * draws the complete edges. Defaults to 0.3.
     *
     * @type {number}
     */
    armLength = 0.3;

    /**
     * The world-space distance the box is grown by on each side, which also keeps flat nodes
     * outlined. Defaults to 0.01.
     *
     * @type {number}
     */
    padding = 0.01;

    /**
     * The thickness of the arms in CSS pixels. Defaults to 2.
     *
     * @type {number}
     */
    armThickness = 2;

    /**
     * The bounds gathered this frame.
     *
     * @private
     */
    _bounds = new BoundingBox();

    /**
     * Whether nothing has been added to the bounds this frame.
     *
     * @private
     */
    _empty = true;

    /**
     * The parent of the arms, disabled while there are no bounds.
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
     * The material of the arms drawn with no depth test.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _occludedMaterial;

    /**
     * The material of the depth tested arms.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _material;

    /**
     * Storage for the color uniforms.
     *
     * @private
     */
    _colorData = [0, 0, 0, 0];

    /**
     * Storage for the occluded color uniforms.
     *
     * @private
     */
    _occludedColorData = [0, 0, 0, 0];

    /**
     * Creates a new BoundingBoxGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer. Use one which keeps the scene's depth to see the
     * brackets fade behind the scene.
     * @example
     * const gizmo = new BoundingBoxGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:bounding-box');

        this._addNode = this._addNode.bind(this);

        this._occludedMaterial = this._createMaterial(false);
        this._material = this._createMaterial(true);

        // each arm draws faintly everywhere, then brightly where the scene does not hide it
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
     * The box is world aligned, so the root is never rotated.
     *
     * @override
     */
    _updateRotation() {
    }

    /**
     * The box is sized in world units, so the root is never scaled.
     *
     * @override
     */
    _updateScale() {
    }

    /**
     * @param {BoundingBox} aabb - The box to add.
     * @private
     */
    _add(aabb) {
        if (this._empty) {
            this._bounds.copy(aabb);
            this._empty = false;
        } else {
            this._bounds.add(aabb);
        }
    }

    /**
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

    /** @override */
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

        // world size of a pixel, per unit of view depth when in perspective
        const camera = this._camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const { width, height } = this._device.clientRect;
        const span = perspective ? 2 * Math.tan(0.5 * camera.fov * math.DEG_TO_RAD) : 2 * camera.orthoHeight;
        const pixel = span / Math.max(camera.horizontalFov ? width : height, 1);
        const cameraPos = camera.entity.getPosition();
        const forward = camera.entity.forward;
        const rootPos = this.root.getPosition();

        // three arms from each corner, running back along its edges, each overhanging the corner
        // by half its thickness so the arms meet
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

    /** @override */
    destroy() {
        super.destroy();

        this._occludedMaterial.destroy();
        this._material.destroy();
    }
}

export { BoundingBoxGizmo };
