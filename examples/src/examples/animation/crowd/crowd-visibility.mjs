import { BoundingBox, Frustum, Mat4, OFFSCREENUPDATE_FULL, OFFSCREENUPDATE_STATE, Script } from 'playcanvas';

/**
 * @import { Entity, RenderComponent } from 'playcanvas'
 */

const frustum = new Frustum();
const viewProjection = new Mat4();
const view = new Mat4();
const worldAabb = new BoundingBox();

/**
 * Predicts which animated characters are visible to a camera, and sets them to update fully.
 *
 * The anim component decides its visibility from the previous frame, so a character coming into
 * view would render its old pose for one frame. This script tests the bounds of each character
 * against the frustum of the camera, and sets {@link OFFSCREENUPDATE_FULL} on the characters likely
 * to be visible, and {@link offscreenUpdate} on the others.
 *
 * The bounds are the custom AABB of the render components of the character, which is also what
 * the engine culls them with. Without a custom AABB, the bounds of the mesh instances are used,
 * which for skinned meshes are expensive to compute every frame.
 *
 * The work is done in `update`, and not in `postUpdate`, as the off-screen update mode needs to be
 * set before the animation update, which runs between the two. Add this script after any script
 * which moves the camera in its `update`, for example to the camera entity after its camera
 * controls, so the prediction uses the camera transform of the current frame.
 */
class CrowdVisibility extends Script {
    static scriptName = 'crowdVisibility';

    /**
     * The entity with the camera component whose view is predicted.
     *
     * @attribute
     * @type {Entity|null}
     */
    camera = null;

    /**
     * The entities with an anim component to predict the visibility of. The array can change
     * between frames.
     *
     * @type {Entity[]}
     */
    characters = [];

    /**
     * Distance added to the bounds, so that characters just outside the view, which a moving
     * camera can bring into view, are predicted as visible too.
     *
     * @attribute
     * @type {number}
     */
    margin = 1;

    /**
     * Whether to predict the visibility. When false, all characters use {@link offscreenUpdate},
     * and the anim component alone decides their visibility.
     *
     * @attribute
     * @type {boolean}
     */
    predict = true;

    /**
     * The off-screen update mode of the characters which are not predicted to be visible.
     *
     * @attribute
     * @type {string}
     */
    offscreenUpdate = OFFSCREENUPDATE_STATE;

    /**
     * The number of characters predicted to be visible in the last update.
     *
     * @type {number}
     */
    visibleCount = 0;

    /**
     * The render components of each character, found once to avoid searching the hierarchy every
     * frame.
     *
     * @type {WeakMap<Entity, RenderComponent[]>}
     * @private
     */
    _renders = new WeakMap();

    /**
     * Whether the warning about a character without a custom AABB was logged.
     *
     * @type {boolean}
     * @private
     */
    _warnedNoCustomAabb = false;

    update() {
        const cameraEntity = this.camera;
        const predict = this.predict && !!cameraEntity?.camera;

        if (predict) {
            view.copy(cameraEntity.getWorldTransform()).invert();
            viewProjection.mul2(cameraEntity.camera.projectionMatrix, view);
            frustum.setFromMat4(viewProjection);
        }

        let visibleCount = 0;
        const characters = this.characters;
        for (let i = 0; i < characters.length; i++) {
            const entity = characters[i];
            const visible = predict && this._isVisible(entity);
            entity.anim.offscreenUpdate = visible ? OFFSCREENUPDATE_FULL : this.offscreenUpdate;
            if (visible) visibleCount++;
        }
        this.visibleCount = visibleCount;
    }

    /**
     * Returns true if the bounds of any mesh instance of the character, enlarged by the margin,
     * intersect the camera frustum.
     *
     * @param {Entity} entity - The character.
     * @returns {boolean} True if the character is likely visible.
     * @private
     */
    _isVisible(entity) {
        let renders = this._renders.get(entity);
        if (!renders) {
            renders = entity.findComponents('render');
            this._renders.set(entity, renders);
        }

        for (let r = 0; r < renders.length; r++) {
            const render = renders[r];
            const meshInstances = render.meshInstances;
            for (let m = 0; m < meshInstances.length; m++) {
                const meshInstance = meshInstances[m];
                if (render.customAabb) {
                    worldAabb.setFromTransformedAabb(render.customAabb, meshInstance.node.getWorldTransform());
                } else {
                    if (!this._warnedNoCustomAabb) {
                        this._warnedNoCustomAabb = true;
                        console.warn(
                            `CrowdVisibility: the render component of ${render.entity.name} has no custom AABB, the bounds of its mesh instances are used instead, which is slower for skinned meshes.`
                        );
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

export { CrowdVisibility };
