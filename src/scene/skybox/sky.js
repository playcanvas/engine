import { Vec3 } from "../../core/math/vec3.js";
import { SKYTYPE_INFINITE } from "../constants.js";
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
    _type = SKYTYPE_INFINITE;

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
     * A graph node with a transform used to render the sky mesh. Adjust the position, rotation and
     * scale of this node to orient the sky mesh. Ignored for {@link SKYTYPE_INFINITE}.
     *
     * @type {GraphNode}
     * @readonly
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
        this.center = new Vec3(0, 1, 0);

        this.centerArray = new Float32Array(3);
        this.projectedSkydomeCenterId = this.device.scope.resolve('projectedSkydomeCenter');
    }


    applySettings(render) {
        this.type = render.skyType ?? SKYTYPE_INFINITE;
        this.node.setLocalPosition(new Vec3(render.skyMeshPosition ?? [0, 0, 0]));
        this.node.setLocalEulerAngles(new Vec3(render.skyMeshRotation ?? [0, 0, 0]));
        this.node.setLocalScale(new Vec3(render.skyMeshScale ?? [1, 1, 1]));
        if (render.skyCenter) {
            this._center = new Vec3(render.skyCenter);
        }
    }

    /**
     * The type of the sky. One of the SKYMESH_* constants. Defaults to {@link SKYTYPE_INFINITE}.
     * Can be:
     *
     * {@link SKYTYPE_INFINITE}
     * {@link SKYTYPE_BOX}
     * {@link SKYTYPE_DOME}
     *
     * @type {string}
     */
    set type(value) {
        if (this._type !== value) {
            this._type = value;
            this.scene.updateShaders = true;
            this.updateSkyMesh();
        }
    }

    get type() {
        return this._type;
    }

    /**
     * The center of the sky. Ignored for {@link SKYTYPE_INFINITE}. Typically only the y-coordinate
     * is used, representing the tripod height. Defaults to (0, 1, 0).
     *
     * @type {Vec3}
     */
    set center(value) {
        this._center.copy(value);
    }

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
        if (this.type !== SKYTYPE_INFINITE) {
            const { center, centerArray } = this;

            // tripod position is relative to the node, transform it to the world space
            const temp = new Vec3();
            this.node.getWorldTransform().transformPoint(center, temp);

            centerArray[0] = temp.x;
            centerArray[1] = temp.y;
            centerArray[2] = temp.z;
            this.projectedSkydomeCenterId.setValue(centerArray);
        }
    }
}

export { Sky };
