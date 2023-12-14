import { Vec3 } from "../../core/math/vec3.js";
import { SKYMESH_INFINITE } from "../constants.js";
import { GraphNode } from "../graph-node.js";
import { SkyMesh } from "./sky-mesh.js";

/**
 * Implementation of the sky.
 *
 * @category Graphics
 */
class Sky {
    /**
     * The type of the sky. One of the SKYMESH_* constants.
     *
     * @type {string}
     * @private
     */
    _type = SKYMESH_INFINITE;

    /**
     * The center of the sky.
     *
     * @type {Vec3}
     * @private
     */
    _center = new Vec3(0, 1, 0);

    /**
     * The sky mesh of the scene.
     *
     * @type {SkyMesh|null}
     * @ignore
     */
    skyMesh = null;

    /**
     * A graph node with a transform used to render the sky mesh.
     *
     * @type {GraphNode}
     * @private
     */
    node = new GraphNode('SkyMeshNode');

    /**
     * Constructs a new sky.
     *
     * @param {import('../scene.js').Scene} scene - The scene owning the sky.
     * @hideconstructor
     */
    constructor(scene) {
        this.device = scene.device;
        this.scene = scene;

        // defaults
        this.scale = new Vec3(100, 100, 100);
        this.center = new Vec3(0, 1, 0);

        this.centerArray = new Float32Array(3);
        this.projectedSkydomeCenterId = this.device.scope.resolve('projectedSkydomeCenter');
    }

    set type(value) {
        if (this._type !== value) {
            this._type = value;
            this.scene.updateShaders = true;
            this.updateSkyMesh();
        }
    }

    /**
     * The type of the sky. One of the SKYMESH_* constants. Defaults to {@link SKYMESH_INFINITE}.
     * Can be:
     *
     * {@link SKYMESH_INFINITE}
     * {@link SKYMESH_BOX}
     * {@link SKYMESH_DOME}
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    set scale(value) {
        this.node.setLocalScale(value);
        this.node.setLocalPosition(new Vec3(0, value.y * 0.5, 0));
    }

    /**
     * The scale of the sky. Ignored for {@link SKYMESH_INFINITE}. Defaults to (100, 100, 100).
     *
     * @type {Vec3}
     */
    get scale() {
        return this.node.getLocalScale();
    }

    set center(value) {
        this._center.copy(value);
    }

    /**
     * The center of the sky. Ignored for {@link SKYMESH_INFINITE}. Typically only the y-coordinate
     * is used, representing the tripod height. Defaults to (0, 1, 0).
     *
     * @type {Vec3}
     */
    get center() {
        return this._center;
    }

    updateSkyMesh() {
        const texture = this.scene._getSkyboxTex();
        if (texture) {
            this.resetSkyMesh();
            this.skyMesh = new SkyMesh(this.device, this.scene, this.node, texture, this.type);
            this.scene.fire('set:skybox', texture);
        }
    }

    resetSkyMesh() {
        this.skyMesh?.destroy();
        this.skyMesh = null;
    }

    update() {

        // uniforms
        if (this.type !== SKYMESH_INFINITE) {
            const { center, centerArray } = this;
            centerArray[0] = center.x;
            centerArray[1] = center.y;
            centerArray[2] = center.z;
            this.projectedSkydomeCenterId.setValue(centerArray);
        }
    }
}

export { Sky };
