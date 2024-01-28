import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';

import { XRSPACE_VIEWER, XRTYPE_AR } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

/**
 * Callback used by {@link XrHitTest#start} and {@link XrHitTest#startForInputSource}.
 *
 * @callback XrHitTestStartCallback
 * @param {Error|null} err - The Error object if failed to create hit test source or null.
 * @param {XrHitTestSource|null} hitTestSource - Object that provides access to hit results against
 * real world geometry.
 */

/**
 * Hit Test provides ability to get position and rotation of ray intersecting point with
 * representation of real world geometry by underlying AR system.
 *
 * @augments EventHandler
 * @category XR
 */
class XrHitTest extends EventHandler {
    /**
     * Fired when new {@link XrHitTestSource} is added to the list. The handler is passed the
     * {@link XrHitTestSource} object that has been added.
     *
     * @event
     * @example
     * app.xr.hitTest.on('add', (hitTestSource) => {
     *     // new hit test source is added
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired when {@link XrHitTestSource} is removed to the list. The handler is passed the
     * {@link XrHitTestSource} object that has been removed.
     *
     * @event
     * @example
     * app.xr.hitTest.on('remove', (hitTestSource) => {
     *     // hit test source is removed
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when hit test source receives new results. It provides transform information that
     * tries to match real world picked geometry. The handler is passed the {@link XrHitTestSource}
     * that produced the hit result, the {@link Vec3} position, the {@link Quat} rotation and the
     * {@link XrInputSource} (if it is a transient hit test source).
     *
     * @event
     * @example
     * app.xr.hitTest.on('result', (hitTestSource, position, rotation, inputSource) => {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */
    static EVENT_RESULT = 'result';

    /**
     * Fired when failed create hit test source. The handler is passed the Error object.
     *
     * @event
     * @example
     * app.xr.hitTest.on('error', (err) => {
     *     console.error(err.message);
     * });
     */
    static EVENT_ERROR = 'error';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    manager;

    /**
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);

    /**
     * @type {XRSession}
     * @private
     */
    _session = null;

    /**
     * List of active {@link XrHitTestSource}.
     *
     * @type {XrHitTestSource[]}
     */
    sources = [];

    /**
     * Create a new XrHitTest instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this.manager = manager;

        if (this._supported) {
            this.manager.on('start', this._onSessionStart, this);
            this.manager.on('end', this._onSessionEnd, this);
        }
    }

    /** @private */
    _onSessionStart() {
        if (this.manager.type !== XRTYPE_AR)
            return;

        this._session = this.manager.session;
    }

    /** @private */
    _onSessionEnd() {
        if (!this._session)
            return;

        this._session = null;

        for (let i = 0; i < this.sources.length; i++) {
            this.sources[i].onStop();
        }
        this.sources = [];
    }

    /**
     * Checks if hit testing is available.
     *
     * @param {Function} callback - Error callback.
     * @param {*} fireError - Event handler on while to fire error event.
     * @returns {boolean} True if hit test is available.
     * @private
     */
    isAvailable(callback, fireError) {
        let err;

        if (!this._supported)
            err = new Error('XR HitTest is not supported');

        if (!this._session)
            err = new Error('XR Session is not started (1)');

        if (this.manager.type !== XRTYPE_AR)
            err = new Error('XR HitTest is available only for AR');

        if (err) {
            if (callback) callback(err);
            if (fireError) fireError.fire('error', err);
            return false;
        }

        return true;
    }

    /**
     * Attempts to start hit test with provided reference space.
     *
     * @param {object} [options] - Optional object for passing arguments.
     * @param {string} [options.spaceType] - Reference space type. Defaults to
     * {@link XRSPACE_VIEWER}. Can be one of the following:
     *
     * - {@link XRSPACE_VIEWER}: Viewer - hit test will be facing relative to viewers space.
     * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
     * viewer at the time of creation.
     * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
     * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
     * Floor level value might be estimated by the underlying platform.
     * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
     * origin at the floor, where the user is expected to move within a pre-established boundary.
     * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
     * expected to move freely around their environment, potentially long distances from their
     * starting point.
     *
     * @param {string} [options.profile] - if hit test source meant to match input source instead
     * of reference space, then name of profile of the {@link XrInputSource} should be provided.
     * @param {string[]} [options.entityTypes] - Optional list of underlying entity types against
     * which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ]. Can be any
     * combination of the following:
     *
     * - {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed
     * based on the feature points detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed
     * based on the planes detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed
     * based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {import('../../core/shape/ray.js').Ray} [options.offsetRay] - Optional ray by which
     * hit test ray can be offset.
     * @param {XrHitTestStartCallback} [options.callback] - Optional callback function called once
     * hit test source is created or failed.
     * @example
     * app.xr.hitTest.start({
     *     spaceType: pc.XRSPACE_VIEWER,
     *     callback: function (err, hitTestSource) {
     *         if (err) return;
     *         hitTestSource.on('result', function (position, rotation) {
     *             // position and rotation of hit test result
     *             // based on Ray facing forward from the Viewer reference space
     *         });
     *     }
     * });
     * @example
     * const ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
     * app.xr.hitTest.start({
     *     spaceType: pc.XRSPACE_LOCAL,
     *     offsetRay: ray,
     *     callback: function (err, hitTestSource) {
     *         // hit test source that will sample real world geometry straight down
     *         // from the position where AR session started
     *     }
     * });
     * @example
     * app.xr.hitTest.start({
     *     profile: 'generic-touchscreen',
     *     callback: function (err, hitTestSource) {
     *         if (err) return;
     *         hitTestSource.on('result', function (position, rotation, inputSource) {
     *             // position and rotation of hit test result
     *             // that will be created from touch on mobile devices
     *         });
     *     }
     * });
     */
    start(options = {}) {
        if (!this.isAvailable(options.callback, this))
            return;

        if (!options.profile && !options.spaceType)
            options.spaceType = XRSPACE_VIEWER;

        let xrRay;
        const offsetRay = options.offsetRay;
        if (offsetRay) {
            const origin = new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z, 1.0);
            const direction = new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z, 0.0);
            xrRay = new XRRay(origin, direction);
        }

        const callback = options.callback;

        if (options.spaceType) {
            this._session.requestReferenceSpace(options.spaceType).then((referenceSpace) => {
                if (!this._session) {
                    const err = new Error('XR Session is not started (2)');
                    if (callback) callback(err);
                    this.fire('error', err);
                    return;
                }

                this._session.requestHitTestSource({
                    space: referenceSpace,
                    entityTypes: options.entityTypes || undefined,
                    offsetRay: xrRay
                }).then((xrHitTestSource) => {
                    this._onHitTestSource(xrHitTestSource, false, options.inputSource, callback);
                }).catch((ex) => {
                    if (callback) callback(ex);
                    this.fire('error', ex);
                });
            }).catch((ex) => {
                if (callback) callback(ex);
                this.fire('error', ex);
            });
        } else {
            this._session.requestHitTestSourceForTransientInput({
                profile: options.profile,
                entityTypes: options.entityTypes || undefined,
                offsetRay: xrRay
            }).then((xrHitTestSource) => {
                this._onHitTestSource(xrHitTestSource, true, options.inputSource, callback);
            }).catch((ex) => {
                if (callback) callback(ex);
                this.fire('error', ex);
            });
        }
    }

    /**
     * @param {XRHitTestSource} xrHitTestSource - Hit test source.
     * @param {boolean} transient - True if hit test source is created from transient input source.
     * @param {import('./xr-input-source.js').XrInputSource|null} inputSource - Input Source with which hit test source is associated with.
     * @param {Function} callback - Callback called once hit test source is created.
     * @private
     */
    _onHitTestSource(xrHitTestSource, transient, inputSource, callback) {
        if (!this._session) {
            xrHitTestSource.cancel();
            const err = new Error('XR Session is not started (3)');
            if (callback) callback(err);
            this.fire('error', err);
            return;
        }

        const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient, inputSource ?? null);
        this.sources.push(hitTestSource);

        if (callback) callback(null, hitTestSource);
        this.fire('add', hitTestSource);
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        for (let i = 0; i < this.sources.length; i++) {
            this.sources[i].update(frame);
        }
    }

    /**
     * True if AR Hit Test is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }
}

export { XrHitTest };
