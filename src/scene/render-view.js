import { EventHandler } from '../core/event-handler.js';
import { Vec4 } from '../core/math/vec4.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';

/**
 * Represents a single view of the scene - a region of the render target rendered from a single
 * viewpoint. A standard camera produces one view, while in XR each eye (or screen) is a separate
 * view. This is the base class for {@link XrView}.
 *
 * @category Graphics
 */
class RenderView extends EventHandler {
    /**
     * World space position of the view, used by shaders. Derived by {@link updateTransforms}.
     *
     * @type {Float32Array}
     * @private
     */
    _positionData = new Float32Array(3);

    /**
     * The viewport (x, y, width, height) this view renders into.
     *
     * @type {Vec4}
     * @private
     */
    _viewport = new Vec4();

    /**
     * Projection matrix, supplied by the producer.
     *
     * @type {Mat4}
     * @private
     */
    _projMat = new Mat4();

    /**
     * Combined projection * view matrix, with the camera's parent transform applied. Derived.
     *
     * @type {Mat4}
     * @private
     */
    _projViewOffMat = new Mat4();

    /**
     * View matrix (world-to-view), supplied by the producer.
     *
     * @type {Mat4}
     * @private
     */
    _viewMat = new Mat4();

    /**
     * View matrix with the camera's parent transform applied. Derived.
     *
     * @type {Mat4}
     * @private
     */
    _viewOffMat = new Mat4();

    /**
     * 3x3 rotational part of {@link _viewOffMat}. Derived.
     *
     * @type {Mat3}
     * @private
     */
    _viewMat3 = new Mat3();

    /**
     * Inverse view matrix (view-to-world), supplied by the producer.
     *
     * @type {Mat4}
     * @private
     */
    _viewInvMat = new Mat4();

    /**
     * Inverse view matrix with the camera's parent transform applied. Derived.
     *
     * @type {Mat4}
     * @private
     */
    _viewInvOffMat = new Mat4();

    /**
     * A Vec4 (x, y, width, height) that represents the view's viewport. For a monoscopic screen it
     * defines the fullscreen view; for stereoscopic views (left/right eye) it defines the part of
     * the screen the view occupies.
     *
     * @type {Vec4}
     */
    get viewport() {
        return this._viewport;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get projMat() {
        return this._projMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get projViewOffMat() {
        return this._projViewOffMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get viewOffMat() {
        return this._viewOffMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get viewInvOffMat() {
        return this._viewInvOffMat;
    }

    /**
     * @type {Mat3}
     * @ignore
     */
    get viewMat3() {
        return this._viewMat3;
    }

    /**
     * @type {Float32Array}
     * @ignore
     */
    get positionData() {
        return this._positionData;
    }

    /**
     * Sets the projection and pose matrices for this view. Each matrix is supplied as a 16-element
     * array (a `Float32Array` from WebXR, or the `data` of a {@link Mat4}). The inverse view matrix
     * (view-to-world) is the source of truth; the view matrix is optional and is derived by
     * inverting it when not supplied (WebXR provides both, so it is passed to avoid the inverse).
     *
     * @param {Float32Array|number[]} projMat - Projection matrix data (16 elements).
     * @param {Float32Array|number[]} viewInvMat - Inverse view (view-to-world) matrix data (16
     * elements).
     * @param {Float32Array|number[]} [viewMat] - View (world-to-view) matrix data (16 elements). If
     * omitted, it is computed by inverting `viewInvMat`.
     * @ignore
     */
    setView(projMat, viewInvMat, viewMat) {
        this._projMat.set(projMat);
        this._viewInvMat.set(viewInvMat);
        if (viewMat) {
            this._viewMat.set(viewMat);
        } else {
            this._viewMat.copy(this._viewInvMat).invert();
        }
    }

    /**
     * Sets the viewport this view renders into.
     *
     * @param {number} x - The x coordinate of the viewport.
     * @param {number} y - The y coordinate of the viewport.
     * @param {number} width - The width of the viewport.
     * @param {number} height - The height of the viewport.
     * @ignore
     */
    setViewport(x, y, width, height) {
        this._viewport.set(x, y, width, height);
    }

    /**
     * Updates the derived "off" matrices from the supplied view matrices and the camera's parent
     * world transform. Cheap and idempotent, so it can be called multiple times per frame (the
     * gsplat passes refresh these before {@link Renderer#setCameraUniforms} runs).
     *
     * @param {Mat4|null} parentWorldTransform - World transform of the camera's parent node, or
     * null when the camera has no parent.
     * @ignore
     */
    updateTransforms(parentWorldTransform) {
        if (parentWorldTransform) {
            this._viewInvOffMat.mul2(parentWorldTransform, this._viewInvMat);
            this._viewOffMat.copy(this._viewInvOffMat).invert();
        } else {
            this._viewInvOffMat.copy(this._viewInvMat);
            this._viewOffMat.copy(this._viewMat);
        }

        this._viewMat3.setFromMat4(this._viewOffMat);
        this._projViewOffMat.mul2(this._projMat, this._viewOffMat);

        this._positionData[0] = this._viewInvOffMat.data[12];
        this._positionData[1] = this._viewInvOffMat.data[13];
        this._positionData[2] = this._viewInvOffMat.data[14];
    }
}

export { RenderView };
