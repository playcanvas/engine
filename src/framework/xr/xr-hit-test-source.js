import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

/**
 * @type {Vec3[]}
 * @ignore
 */
const poolVec3 = [];

/**
 * @type {Quat[]}
 * @ignore
 */
const poolQuat = [];

/**
 * Represents XR hit test source, which provides access to hit results of real world geometry from
 * AR session.
 *
 * ```javascript
 * // start a hit test from a viewer origin forward
 * app.xr.hitTest.start({
 *     spaceType: pc.XRSPACE_VIEWER,
 *     callback: function (err, hitTestSource) {
 *         if (err) return;
 *         // subscribe to hit test results
 *         hitTestSource.on('result', function (position, rotation, inputSource, hitTestResult) {
 *             // position and rotation of hit test result
 *         });
 *     }
 * });
 * ```
 *
 * @category XR
 */
class XrHitTestSource extends EventHandler {
    /**
     * Fired when {@link XrHitTestSource} is removed.
     *
     * @event
     * @example
     * hitTestSource.once('remove', () => {
     *     // hit test source has been removed
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when the hit test source receives new results. It provides transform information that
     * tries to match real world geometry. Callback provides the {@link Vec3} position, the
     * {@link Quat} rotation, the {@link XrInputSource} (if it is a transient hit test source)
     * and the {@link XRHitTestResult} object that is created by WebXR API.
     *
     * @event
     * @example
     * hitTestSource.on('result', (position, rotation, inputSource, hitTestReult) => {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */
    static EVENT_RESULT = 'result';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    manager;

    /**
     * @type {XRHitTestSource}
     * @private
     */
    _xrHitTestSource;

    /**
     * @type {boolean}
     * @private
     */
    _transient;

    /**
     * @type {null|import('./xr-input-source.js').XrInputSource}
     * @private
     */
    _inputSource;

    /**
     * Create a new XrHitTestSource instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @param {XRHitTestSource} xrHitTestSource - XRHitTestSource object that is created by WebXR API.
     * @param {boolean} transient - True if XRHitTestSource created for input source profile.
     * @param {null|import('./xr-input-source.js').XrInputSource} inputSource - Input Source for which hit test is created for, or null.
     * @ignore
     */
    constructor(manager, xrHitTestSource, transient, inputSource = null) {
        super();

        this.manager = manager;
        this._xrHitTestSource = xrHitTestSource;
        this._transient = transient;
        this._inputSource = inputSource;
    }

    /**
     * Stop and remove hit test source.
     */
    remove() {
        if (!this._xrHitTestSource)
            return;

        const sources = this.manager.hitTest.sources;
        const ind = sources.indexOf(this);
        if (ind !== -1) sources.splice(ind, 1);

        this.onStop();
    }

    /** @ignore */
    onStop() {
        this._xrHitTestSource.cancel();
        this._xrHitTestSource = null;

        this.fire('remove');
        this.manager.hitTest.fire('remove', this);
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (this._transient) {
            const transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
            for (let i = 0; i < transientResults.length; i++) {
                const transientResult = transientResults[i];

                if (!transientResult.results.length)
                    continue;

                let inputSource;

                if (transientResult.inputSource)
                    inputSource = this.manager.input._getByInputSource(transientResult.inputSource);

                this.updateHitResults(transientResult.results, inputSource);
            }
        } else {
            const results = frame.getHitTestResults(this._xrHitTestSource);
            if (!results.length)
                return;

            this.updateHitResults(results);
        }
    }

    /**
     * @param {XRTransientInputHitTestResult[]} results - Hit test results.
     * @param {null|import('./xr-input-source.js').XrInputSource} inputSource - Input source.
     * @private
     */
    updateHitResults(results, inputSource) {
        if (this._inputSource && this._inputSource !== inputSource)
            return;

        const origin = poolVec3.pop() ?? new Vec3();

        if (inputSource) {
            origin.copy(inputSource.getOrigin());
        } else {
            origin.copy(this.manager.camera.getPosition());
        }

        let candidateDistance = Infinity;
        let candidateHitTestResult = null;

        const position = poolVec3.pop() ?? new Vec3();
        const rotation = poolQuat.pop() ?? new Quat();

        for (let i = 0; i < results.length; i++) {
            const pose = results[i].getPose(this.manager._referenceSpace);

            const distance = origin.distance(pose.transform.position);
            if (distance >= candidateDistance)
                continue;

            candidateDistance = distance;
            candidateHitTestResult = results[i];
            position.copy(pose.transform.position);
            rotation.copy(pose.transform.orientation);
        }

        this.fire('result', position, rotation, inputSource || this._inputSource, candidateHitTestResult);
        this.manager.hitTest.fire('result', this, position, rotation, inputSource || this._inputSource, candidateHitTestResult);

        poolVec3.push(origin);
        poolVec3.push(position);
        poolQuat.push(rotation);
    }
}

export { XrHitTestSource };
