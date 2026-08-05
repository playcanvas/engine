import { Vec3 } from '../../core/math/vec3.js';
import { SKYTYPE_INFINITE } from '../constants.js';
import { FisheyeProjection } from '../graphics/fisheye-projection.js';
import { GraphNode } from '../graph-node.js';
import { SkyMesh } from './sky-mesh.js';

/**
 * @import { Scene } from '../scene.js'
 */

/**
 * Implementation of the sky.
 *
 * @category Graphics
 */
class Sky {
    /**
     * The type of the sky. One of the SKYTYPE_* constants.
     *
     * @type {string}
     * @private
     */
    _type = SKYTYPE_INFINITE;

    /**
     * The center of the sky.
     *
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

    /** @private */
    _depthWrite = false;

    /** @private */
    _fisheye = 0;

    /**
     * Lazily created on first non-zero fisheye set.
     *
     * @type {FisheyeProjection|null}
     * @private
     */
    _fisheyeProj = null;

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
     * @param {Scene} scene - The scene owning the sky.
     * @ignore
     */
    constructor(scene) {
        this.device = scene.device;
        this.scene = scene;

        // defaults
        this.center = new Vec3(0, 1, 0);

        this.centerArray = new Float32Array(3);
        this.projectedSkydomeCenterId = this.device.scope.resolve('projectedSkydomeCenter');

        this._preRenderEvt = scene.on('prerender', this._onPreRender, this);
    }

    destroy() {
        this._preRenderEvt.off();
        this.resetSkyMesh();
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
     * Sets the type of the sky. Can be:
     *
     * - {@link SKYTYPE_INFINITE}
     * - {@link SKYTYPE_BOX}
     * - {@link SKYTYPE_DOME}
     *
     * Defaults to {@link SKYTYPE_INFINITE}.
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

    /**
     * Gets the type of the sky.
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the center of the sky. Ignored for {@link SKYTYPE_INFINITE}. Typically only the
     * y-coordinate is used, representing the tripod height. Defaults to (0, 1, 0).
     *
     * @type {Vec3}
     */
    set center(value) {
        this._center.copy(value);
    }

    /**
     * Gets the center of the sky.
     *
     * @type {Vec3}
     */
    get center() {
        return this._center;
    }

    /**
     * Sets whether depth writing is enabled for the sky. Defaults to false.
     *
     * Writing a depth value for the skydome is supported when its type is not
     * {@link SKYTYPE_INFINITE}. When enabled, the depth is written during a prepass render pass and
     * can be utilized by subsequent passes to apply depth-based effects, such as Depth of Field.
     *
     * Note: For the skydome to be rendered during the prepass, the Sky Layer must be ordered before
     * the Depth layer, which is the final layer used in the prepass.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        if (this._depthWrite !== value) {
            this._depthWrite = value;
            if (this.skyMesh) {
                this.skyMesh.depthWrite = value;
            }
        }
    }

    /**
     * Gets whether depth writing is enabled for the sky.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthWrite;
    }

    /**
     * Sets the fisheye projection strength for the sky. The value is in the range [0, 1]:
     *
     * - 0: Standard rectilinear (perspective) projection.
     * - (0, 1]: Increasing barrel distortion, producing a wider field of view.
     *
     * Only supported with {@link SKYTYPE_INFINITE}. Has no effect on dome or box sky types,
     * and has no effect with orthographic cameras. Defaults to 0.
     *
     * @type {number}
     */
    set fisheye(value) {
        if (this._fisheye !== value) {
            const wasEnabled = this._fisheye > 0;
            this._fisheye = value;

            const isEnabled = value > 0;
            if (wasEnabled !== isEnabled) {
                this._fisheyeProj ??= new FisheyeProjection();
                if (this._type === SKYTYPE_INFINITE) {
                    this._setFisheyeDefine(isEnabled);
                }
            }
        }
    }

    /**
     * Gets the fisheye projection strength for the sky.
     *
     * @type {number}
     */
    get fisheye() {
        return this._fisheye;
    }

    updateSkyMesh() {
        const texture = this.scene._getSkyboxTex();
        if (texture) {
            this.resetSkyMesh();
            this.skyMesh = new SkyMesh(this.device, this.scene, this.node, texture, this.type);
            this.skyMesh.depthWrite = this._depthWrite;

            if (this._fisheye > 0 && this.type === SKYTYPE_INFINITE) {
                this._setFisheyeDefine(true);
            }

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

    /**
     * @param {boolean} enabled - Whether to enable the SKY_FISHEYE define.
     * @private
     */
    _setFisheyeDefine(enabled) {
        if (this.skyMesh?.meshInstance) {
            const material = this.skyMesh.meshInstance.material;
            material.setDefine('SKY_FISHEYE', enabled);
            material.update();
        }
    }

    /**
     * Per-camera prerender callback that updates fisheye uniforms for the active camera.
     *
     * @param {import('../../framework/components/camera/component.js').CameraComponent} cameraComponent - The camera about to render.
     * @private
     */
    _onPreRender(cameraComponent) {
        if (this._fisheye > 0 && this._fisheyeProj && this.skyMesh?.meshInstance) {
            const camera = cameraComponent.camera;
            const proj = this._fisheyeProj;
            proj.update(this._fisheye, camera.fov, camera.projectionMatrix);

            const material = this.skyMesh.meshInstance.material;
            material.setParameter('fisheye_k', proj.k);
            material.setParameter('fisheye_invK', proj.invK);
            material.setParameter('fisheye_projMat00', proj.projMat00);
            material.setParameter('fisheye_projMat11', proj.projMat11);
        }
    }
}

export { Sky };
