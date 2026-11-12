import {
    BoundingBox, Frustum, Mat4, Script,
    OFFSCREENUPDATE_FULL, OFFSCREENUPDATE_NONE, OFFSCREENUPDATE_STATE
} from 'playcanvas';

/**
 * @import { AnimComponent, Entity, RenderComponent } from 'playcanvas'
 */

/** @enum {string} */
const OffscreenUpdate = {
    FULL: 'full',       // OFFSCREENUPDATE_FULL
    STATE: 'state',     // OFFSCREENUPDATE_STATE
    NONE: 'none'        // OFFSCREENUPDATE_NONE
};

const offscreenUpdateMap = new Map([
    [OffscreenUpdate.FULL, OFFSCREENUPDATE_FULL],
    [OffscreenUpdate.STATE, OFFSCREENUPDATE_STATE],
    [OffscreenUpdate.NONE, OFFSCREENUPDATE_NONE]
]);

// the frustum of each camera, built once per frame and shared by all the scripts using the camera
/** @type {WeakMap<Entity, { frame: number, frustum: Frustum }>} */
const cameraFrustums = new WeakMap();
const viewProjection = new Mat4();
const view = new Mat4();
const worldAabb = new BoundingBox();

// the warning about a missing custom AABB is logged only once, for all the scripts
let warnedNoCustomAabb = false;

/**
 * Returns the frustum of the camera in the given frame, building it on the first request.
 *
 * @param {Entity} cameraEntity - The entity with the camera component.
 * @param {number} frame - The frame number.
 * @returns {Frustum} The frustum.
 */
const getFrustum = (cameraEntity, frame) => {
    let entry = cameraFrustums.get(cameraEntity);
    if (!entry) {
        entry = { frame: -1, frustum: new Frustum() };
        cameraFrustums.set(cameraEntity, entry);
    }
    if (entry.frame !== frame) {
        entry.frame = frame;
        view.copy(cameraEntity.getWorldTransform()).invert();
        viewProjection.mul2(cameraEntity.camera.projectionMatrix, view);
        entry.frustum.setFromMat4(viewProjection);
    }
    return entry.frustum;
};

/**
 * Lowers the CPU cost of an animated character by controlling the update of its anim component,
 * using the {@link AnimComponent#offscreenUpdate} and {@link AnimComponent#evaluationInterval}
 * options. Add it to the entity with the anim component.
 *
 * - **Visibility prediction**: the anim component decides its visibility from the previous frame,
 * so a character coming into view would render as it was last animated for one frame. This script
 * tests the bounds of the character against the frustum of a camera before the animation update,
 * and when the character is likely visible, it sets {@link OFFSCREENUPDATE_FULL} on the anim
 * component, so that it is up to date as it comes into view. Otherwise it sets
 * {@link offscreenUpdate}.
 * - **Distance level of detail**: the further the character is from the camera, the less often its
 * animation is evaluated, controlled by {@link lodDistance} and {@link maxEvaluationInterval}.
 *
 * The bounds are the custom AABB of the render components of the character, which is also what
 * the engine culls them with. Without a custom AABB, the bounds of the mesh instances are used,
 * which for skinned meshes are expensive to compute every frame.
 *
 * The work is done in `update`, and not in `postUpdate`, as the anim component options need to be
 * set before the animation update, which runs between the two. For the prediction to use the
 * camera transform of the current frame, the scripts which move the camera need to update before
 * this script, for example by creating the camera before the characters. Otherwise the camera
 * transform of the previous frame is used, which the {@link margin} covers for small movements.
 *
 * The frustum of each camera is built once per frame and shared by all the characters using it.
 *
 * @example
 * character.addComponent('script');
 * character.script.create(AnimUpdateOptimizer, {
 *     properties: {
 *         camera: cameraEntity,
 *         lodDistance: 12
 *     }
 * });
 * @category Animation
 */
class AnimUpdateOptimizer extends Script {
    static scriptName = 'animUpdateOptimizer';

    /**
     * The entity with the camera component whose view the character is optimized for.
     *
     * @attribute
     * @type {Entity|null}
     */
    camera = null;

    /**
     * Whether to predict the visibility. When false, the anim component uses
     * {@link offscreenUpdate}, and decides its visibility alone.
     *
     * @attribute
     */
    predict = true;

    /**
     * Distance added to the bounds, so that a character just outside the view, which a moving
     * camera can bring into view, is predicted as visible too.
     *
     * @attribute
     * @range [0, 10]
     * @precision 2
     */
    margin = 1;

    /**
     * How the anim component updates when the character is not predicted to be visible. See
     * {@link AnimComponent#offscreenUpdate}.
     *
     * @attribute
     * @type {OffscreenUpdate}
     */
    offscreenUpdate = OffscreenUpdate.STATE;

    /**
     * The distance from the camera per step of the evaluation interval: a character closer than
     * this is evaluated every frame, up to twice as far every other frame, and so on, up to
     * {@link maxEvaluationInterval}. Zero disables it, and the character is evaluated every frame.
     *
     * @attribute
     * @range [0, 100]
     * @precision 1
     */
    lodDistance = 0;

    /**
     * The largest evaluation interval, used when the character is furthest from the camera.
     *
     * @attribute
     * @range [1, 8]
     * @precision 0
     * @step 1
     */
    maxEvaluationInterval = 4;

    /**
     * True if the character was predicted to be visible in the last update.
     *
     * @type {boolean}
     */
    visible = false;

    /**
     * The render components of the character, found once to avoid searching the hierarchy every
     * frame.
     *
     * @type {RenderComponent[]|null}
     * @private
     */
    _renders = null;

    initialize() {
        // restore the defaults of the anim component when the script stops controlling it
        const restore = () => {
            const anim = this.entity.anim;
            if (anim) {
                anim.offscreenUpdate = OFFSCREENUPDATE_FULL;
                anim.evaluationInterval = 1;
            }
            this.visible = false;
        };
        this.on('disable', restore);
        this.on('destroy', restore);
    }

    update() {
        const anim = this.entity.anim;
        if (!anim) return;

        const cameraEntity = this.camera?.camera ? this.camera : null;

        let visible = false;
        if (this.predict && cameraEntity) {
            visible = this._isVisible(getFrustum(cameraEntity, this.app.frame));
        }
        this.visible = visible;

        // unknown values are passed through, to accept the engine constants too
        const offscreenUpdate = offscreenUpdateMap.get(this.offscreenUpdate) ?? this.offscreenUpdate;
        anim.offscreenUpdate = visible ? OFFSCREENUPDATE_FULL : offscreenUpdate;

        let interval = 1;
        if (cameraEntity && this.lodDistance > 0) {
            const distance = this.entity.getPosition().distance(cameraEntity.getPosition());
            interval = Math.min(this.maxEvaluationInterval, 1 + Math.floor(distance / this.lodDistance));
        }
        anim.evaluationInterval = interval;
    }

    /**
     * Returns true if the bounds of any mesh instance of the character, enlarged by the margin,
     * intersect the frustum.
     *
     * @param {Frustum} frustum - The camera frustum.
     * @returns {boolean} True if the character is likely visible.
     * @private
     */
    _isVisible(frustum) {
        if (!this._renders) {
            this._renders = this.entity.findComponents('render');
        }

        const renders = this._renders;
        for (let r = 0; r < renders.length; r++) {
            const render = renders[r];
            const meshInstances = render.meshInstances;
            for (let m = 0; m < meshInstances.length; m++) {
                const meshInstance = meshInstances[m];
                if (render.customAabb) {
                    worldAabb.setFromTransformedAabb(render.customAabb, meshInstance.node.getWorldTransform());
                } else {
                    if (!warnedNoCustomAabb) {
                        warnedNoCustomAabb = true;
                        console.warn(`AnimUpdateOptimizer: the render component of ${render.entity.name} has no custom AABB, the bounds of its mesh instances are used instead, which is slower for skinned meshes.`);
                    }
                    worldAabb.copy(meshInstance.aabb);
                }
                worldAabb.halfExtents.addScalar(this.margin);
                if (frustum.containsAabb(worldAabb)) {
                    return true;
                }
            }
        }
        return false;
    }
}

export { AnimUpdateOptimizer, OffscreenUpdate };
