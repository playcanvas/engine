import { Color } from '../core/color.js';
import { EventHandler } from '../core/event-handler.js';

import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

import { XRTYPE_AR } from './constants.js';

var vec3A = new Vec3();
var vec3B = new Vec3();
var mat4A = new Mat4();
var mat4B = new Mat4();

/**
 * @class
 * @name pc.XrLightEstimation
 * @augments pc.EventHandler
 * @classdesc Light Estimation provides illimunation data from the real world, which is estimated by the underlying AR system.
 * It provides a reflection Cube Map, that represents the reflection estimation from the viewer position.
 * A more simplified approximation of light is provided by L2 Spherical Harmonics data.
 * And the most simple level of light estimation is the most prominent directional light, its rotation, intensity and color.
 * @description Creates a new XrLightEstimation. Note that this is created internally by the {@link pc.XrManager}.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Light Estimation is supported. This information is available only during an active AR session.
 * @property {number|null} intensity Intensity of what is estimated to be the most prominent directional light. Or null if data is not available.
 * @property {pc.Color|null} color Color of what is estimated to be the most prominent directional light. Or null if data is not available.
 * @property {pc.Quat|null} rotation Rotation of what is estimated to be the most prominent directional light. Or null if data is not available.
 */
class XrLightEstimation extends EventHandler {
    constructor(manager) {
        super();

        this._manager = manager;

        this._supported = false;
        this._available = false;

        this._lightProbeRequested = false;
        this._lightProbe = null;

        this._intensity = 0;
        this._rotation = new Quat();
        this._color = new Color();

        this._sphericalHarmonics = new Float32Array(27);

        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    }

    /**
     * @event
     * @name pc.XrLightEstimation#available
     * @description Fired when light estimation data becomes available.
     */

    /**
     * @event
     * @name pc.XrLightEstimation#error
     * @param {Error} error - Error object related to failure of light estimation start.
     * @description Fired when light estimation has failed to start.
     * @example
     * app.xr.lightEstimation.on('error', function (ex) {
     *     // has failed to start
     * });
     */

    _onSessionStart() {
        var supported = !! this._manager.session.requestLightProbe;
        if (! supported) return;
        this._supported = true;
    }

    _onSessionEnd() {
        this._supported = false;
        this._available = false;

        this._lightProbeRequested = false;
        this._lightProbe = null;
    }

    /**
     * @function
     * @name pc.XrLightEstimation#start
     * @description Start estimation of illimunation data.
     * Availability of such data will come later and an `available` event will be fired.
     * If it failed to start estimation, an `error` event will be fired.
     * @example
     * app.xr.on('start', function () {
     *     if (app.xr.lightEstimation.supported) {
     *         app.xr.lightEstimation.start();
     *     }
     * });
     */
    start() {
        var err;

        if (! this._manager.session)
            err = new Error('XR session is not running');

        if (! err && this._manager.type !== XRTYPE_AR)
            err = new Error('XR session type is not AR');

        if (! err && ! this._supported)
            err = new Error('light-estimation is not supported');

        if (! err && this._lightProbe || this._lightProbeRequested)
            err = new Error('light estimation is already requested');

        if (err) {
            this.fire('error', err);
            return;
        }

        var self = this;
        this._lightProbeRequested = true;

        this._manager.session.requestLightProbe(
        ).then(function (lightProbe) {
            var wasRequested = self._lightProbeRequested;
            self._lightProbeRequested = false;

            if (self._manager.active) {
                if (wasRequested) {
                    self._lightProbe = lightProbe;
                }
            } else {
                self.fire('error', new Error('XR session is not active'));
            }
        }).catch(function (ex) {
            self._lightProbeRequested = false;
            self.fire('error', ex);
        });
    }

    /**
     * @function
     * @name pc.XrLightEstimation#end
     * @description End estimation of illumination data.
     */
    end() {
        this._lightProbeRequested = false;
        this._lightProbe = null;
        this._available = false;
    }

    update(frame) {
        if (! this._lightProbe) return;

        var lightEstimate = frame.getLightEstimate(this._lightProbe);
        if (! lightEstimate) return;

        if (! this._available) {
            this._available = true;
            this.fire('available');
        }

        // intensity
        var pli = lightEstimate.primaryLightIntensity;
        this._intensity = Math.max(1.0, Math.max(pli.x, Math.max(pli.y, pli.z)));

        // color
        vec3A.copy(pli).scale(1 / this._intensity);
        this._color.set(vec3A.x, vec3A.y, vec3A.z);

        // rotation
        vec3A.set(0, 0, 0);
        vec3B.copy(lightEstimate.primaryLightDirection);
        mat4A.setLookAt(vec3B, vec3A, Vec3.UP);
        mat4B.setFromAxisAngle(Vec3.RIGHT, 90); // direcitonal light is looking down
        mat4A.mul(mat4B);
        this._rotation.setFromMat4(mat4A);

        // spherical harmonics
        this._sphericalHarmonics.set(lightEstimate.sphericalHarmonicsCoefficients);
    }

    get supported() {
        return this._supported;
    }

    /**
     * @name pc.XrLightEstimation#available
     * @type {boolean}
     * @description True if estimated light information is available.
     * @example
     * if (app.xr.lightEstimation.available) {
     *     entity.light.intensity = app.xr.lightEstimation.intensity;
     * }
     */
    get available() {
        return this._available;
    }

    get intensity() {
        return this._available ? this._intensity : null;
    }

    get color() {
        return this._available ? this._color : null;
    }

    get rotation() {
        return this._available ? this._rotation : null;
    }

    get sphericalHarmonics() {
        return this._available ? this._sphericalHarmonics : null;
    }
}

export { XrLightEstimation };
