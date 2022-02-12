import { EventHandler } from '../core/event-handler.js';

import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

/** @typedef {import('./xr-manager.js').XrManager} XrManager */

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
 * @augments EventHandler
 */
class XrHitTestSource extends EventHandler {
    /**
     * @type {XrManager}
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
     * Create a new XrHitTestSource instance.
     *
     * @param {XrManager} manager - WebXR Manager.
     * @param {*} xrHitTestSource - XRHitTestSource object that is created by WebXR API.
     * @param {boolean} transient - True if XRHitTestSource created for input source profile.
     * @hideconstructor
     */
    constructor(manager, xrHitTestSource, transient) {
        super();

        this.manager = manager;
        this._xrHitTestSource = xrHitTestSource;
        this._transient = transient;
    }

    /**
     * @event
     * @name XrHitTestSource#remove
     * @description Fired when {@link XrHitTestSource} is removed.
     * @example
     * hitTestSource.once('remove', function () {
     *     // hit test source has been removed
     * });
     */

    /**
     * @event
     * @name XrHitTestSource#result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {Vec3} position - Position of hit test.
     * @param {Quat} rotation - Rotation of hit test.
     * @param {XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source.
     * @example
     * hitTestSource.on('result', function (position, rotation, inputSource) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

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
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (this._transient) {
            const transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
            for (let i = 0; i < transientResults.length; i++) {
                const transientResult = transientResults[i];
                let inputSource;

                if (transientResult.inputSource)
                    inputSource = this.manager.input._getByInputSource(transientResult.inputSource);

                this.updateHitResults(transientResult.results, inputSource);
            }
        } else {
            this.updateHitResults(frame.getHitTestResults(this._xrHitTestSource));
        }
    }

    /**
     * @param {XRTransientInputHitTestResult[]} results - Hit test results.
     * @param {XRHitTestSource} inputSource - Input source.
     * @private
     */
    updateHitResults(results, inputSource) {
        for (let i = 0; i < results.length; i++) {
            const pose = results[i].getPose(this.manager._referenceSpace);

            let position = poolVec3.pop();
            if (!position) position = new Vec3();
            position.copy(pose.transform.position);

            let rotation = poolQuat.pop();
            if (!rotation) rotation = new Quat();
            rotation.copy(pose.transform.orientation);

            this.fire('result', position, rotation, inputSource);
            this.manager.hitTest.fire('result', this, position, rotation, inputSource);

            poolVec3.push(position);
            poolQuat.push(rotation);
        }
    }
}

export { XrHitTestSource };
