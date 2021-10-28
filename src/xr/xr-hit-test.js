import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';

import { XRSPACE_VIEWER, XRTYPE_AR } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

/**
 * @class
 * @name XrHitTest
 * @augments EventHandler
 * @classdesc Hit Test provides ability to get position and rotation of ray intersecting point with representation of real world geometry by underlying AR system.
 * @description Hit Test provides ability to get position and rotation of ray intersecting point with representation of real world geometry by underlying AR system.
 * @hideconstructor
 * @param {XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if AR Hit Test is supported.
 * @property {XrHitTestSource[]} sources list of active {@link XrHitTestSource}.
 */
class XrHitTest extends EventHandler {
    constructor(manager) {
        super();

        this.manager = manager;
        this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);

        this._session = null;

        this.sources = [];

        if (this._supported) {
            this.manager.on('start', this._onSessionStart, this);
            this.manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * @event
     * @name XrHitTest#add
     * @description Fired when new {@link XrHitTestSource} is added to the list.
     * @param {XrHitTestSource} hitTestSource - Hit test source that has been added.
     * @example
     * app.xr.hitTest.on('add', function (hitTestSource) {
     *     // new hit test source is added
     * });
     */

    /**
     * @event
     * @name XrHitTest#remove
     * @description Fired when {@link XrHitTestSource} is removed to the list.
     * @param {XrHitTestSource} hitTestSource - Hit test source that has been removed.
     * @example
     * app.xr.hitTest.on('remove', function (hitTestSource) {
     *     // hit test source is removed
     * });
     */

    /**
     * @event
     * @name XrHitTest#result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {XrHitTestSource} hitTestSource - Hit test source that produced the hit result.
     * @param {Vec3} position - Position of hit test.
     * @param {Quat} rotation - Rotation of hit test.
     * @param {XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source.
     * @example
     * app.xr.hitTest.on('result', function (hitTestSource, position, rotation, inputSource) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    /**
     * @event
     * @name XrHitTest#error
     * @param {Error} error - Error object related to failure of creating hit test source.
     * @description Fired when failed create hit test source.
     */

    _onSessionStart() {
        if (this.manager.type !== XRTYPE_AR)
            return;

        this._session = this.manager.session;
    }

    _onSessionEnd() {
        if (!this._session)
            return;

        this._session = null;

        for (let i = 0; i < this.sources.length; i++) {
            this.sources[i].onStop();
        }
        this.sources = [];
    }

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
     * @function
     * @name XrHitTest#start
     * @description Attempts to start hit test with provided reference space.
     * @param {object} [options] - Optional object for passing arguments.
     * @param {string} [options.spaceType] - Reference space type. Defaults to {@link XRSPACE_VIEWER}. Can be one of the following:
     *
     * - {@link XRSPACE_VIEWER}: Viewer - hit test will be facing relative to viewers space.
     * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the viewer at the time of creation.
     * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin at the floor in a safe position for the user to stand. The y axis equals 0 at floor level. Floor level value might be estimated by the underlying platform.
     * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native origin at the floor, where the user is expected to move within a pre-established boundary.
     * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is expected to move freely around their environment, potentially long distances from their starting point.
     *
     * @param {string} [options.profile] - if hit test source meant to match input source instead of reference space, then name of profile of the {@link XrInputSource} should be provided.
     * @param {string[]} [options.entityTypes] - Optional list of underlying entity types against which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ]. Can be any combination of the following:
     *
     * - {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed based on the feature points detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed based on the planes detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {callbacks.XrHitTestStart} [options.callback] - Optional callback function called once hit test source is created or failed.
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
     * var ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
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
    start(options) {
        options = options || { };

        if (!this.isAvailable(options.callback, this))
            return;

        if (!options.profile && !options.spaceType)
            options.spaceType = XRSPACE_VIEWER;

        let xrRay;
        const offsetRay = options.offsetRay;
        if (offsetRay) xrRay = new XRRay(new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z), new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z));

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
                    this._onHitTestSource(xrHitTestSource, false, callback);
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
                this._onHitTestSource(xrHitTestSource, true, callback);
            }).catch((ex) => {
                if (callback) callback(ex);
                this.fire('error', ex);
            });
        }
    }

    _onHitTestSource(xrHitTestSource, transient, callback) {
        if (!this._session) {
            xrHitTestSource.cancel();
            const err = new Error('XR Session is not started (3)');
            if (callback) callback(err);
            this.fire('error', err);
            return;
        }

        const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient);
        this.sources.push(hitTestSource);

        if (callback) callback(null, hitTestSource);
        this.fire('add', hitTestSource);
    }

    update(frame) {
        for (let i = 0; i < this.sources.length; i++) {
            this.sources[i].update(frame);
        }
    }

    get supported() {
        return this._supported;
    }
}

export { XrHitTest };
