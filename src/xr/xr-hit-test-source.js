import { EventHandler } from '../core/event-handler.js';

import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

var poolVec3 = [];
var poolQuat = [];

/**
 * @class
 * @name XrHitTestSource
 * @augments EventHandler
 * @classdesc Represents XR hit test source, which provides access to hit results of real world geometry from AR session.
 * @description Represents XR hit test source, which provides access to hit results of real world geometry from AR session.
 * @param {XrManager} manager - WebXR Manager.
 * @param {object} xrHitTestSource - XRHitTestSource object that is created by WebXR API.
 * @param {boolean} transient - True if XRHitTestSource created for input source profile.
 * @example
 * hitTestSource.on('result', function (position, rotation) {
 *     target.setPosition(position);
 * });
 */
class XrHitTestSource extends EventHandler {
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
     * @param {Vec3} position - Position of hit test
     * @param {Quat} rotation - Rotation of hit test
     * @param {XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source
     * @example
     * hitTestSource.on('result', function (position, rotation, inputSource) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    /**
     * @function
     * @name XrHitTestSource#remove
     * @description Stop and remove hit test source.
     */
    remove() {
        if (! this._xrHitTestSource)
            return;

        var sources = this.manager.hitTest.sources;
        var ind = sources.indexOf(this);
        if (ind !== -1) sources.splice(ind, 1);

        this.onStop();
    }

    onStop() {
        this._xrHitTestSource.cancel();
        this._xrHitTestSource = null;

        this.fire('remove');
        this.manager.hitTest.fire('remove', this);
    }

    update(frame) {
        if (this._transient) {
            var transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
            for (var i = 0; i < transientResults.length; i++) {
                var transientResult = transientResults[i];
                var inputSource;

                if (transientResult.inputSource)
                    inputSource = this.manager.input._getByInputSource(transientResult.inputSource);

                this.updateHitResults(transientResult.results, inputSource);
            }
        } else {
            this.updateHitResults(frame.getHitTestResults(this._xrHitTestSource));
        }
    }

    updateHitResults(results, inputSource) {
        for (var i = 0; i < results.length; i++) {
            var pose = results[i].getPose(this.manager._referenceSpace);

            var position = poolVec3.pop();
            if (! position) position = new Vec3();
            position.copy(pose.transform.position);

            var rotation = poolQuat.pop();
            if (! rotation) rotation = new Quat();
            rotation.copy(pose.transform.orientation);

            this.fire('result', position, rotation, inputSource);
            this.manager.hitTest.fire('result', this, position, rotation, inputSource);

            poolVec3.push(position);
            poolQuat.push(rotation);
        }
    }
}

export { XrHitTestSource };
