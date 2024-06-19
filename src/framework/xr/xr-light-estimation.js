import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

import { XRTYPE_AR } from './constants.js';

const vec3A = new Vec3();
const vec3B = new Vec3();
const mat4A = new Mat4();
const mat4B = new Mat4();

/**
 * Light Estimation provides illumination data from the real world, which is estimated by the
 * underlying AR system. It provides a reflection Cube Map, that represents the reflection
 * estimation from the viewer position. A more simplified approximation of light is provided by L2
 * Spherical Harmonics data. And the most simple level of light estimation is the most prominent
 * directional light, its rotation, intensity and color.
 *
 * @category XR
 */
class XrLightEstimation extends EventHandler {
    /**
     * Fired when light estimation data becomes available.
     *
     * @event
     * @example
     * app.xr.lightEstimation.on('available', () => {
     *     console.log('Light estimation is available');
     * });
     */
    static EVENT_AVAILABLE = 'available';

    /**
     * Fired when light estimation has failed to start. The handler is passed the Error object
     * related to failure of light estimation start.
     *
     * @event
     * @example
     * app.xr.lightEstimation.on('error', (error) => {
     *     console.error(error.message);
     * });
     */
    static EVENT_ERROR = 'error';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {boolean}
     * @private
     */
    _supported = false;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * @type {boolean}
     * @private
     */
    _lightProbeRequested = false;

    /**
     * @type {XRLightProbe|null}
     * @private
     */
    _lightProbe = null;

    /**
     * @type {number}
     * @private
     */
    _intensity = 0;

    /**
     * @type {Quat}
     * @private
     */
    _rotation = new Quat();

    /**
     * @type {Color}
     * @private
     */
    _color = new Color();

    /**
     * @type {Float32Array}
     * @private
     */
    _sphericalHarmonics = new Float32Array(27);

    /**
     * Create a new XrLightEstimation instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @ignore
     */
    constructor(manager) {
        super();

        this._manager = manager;

        this._manager.on('start', this._onSessionStart, this);
        this._manager.on('end', this._onSessionEnd, this);
    }

    /** @private */
    _onSessionStart() {
        const supported = !!this._manager.session.requestLightProbe;
        if (!supported) return;
        this._supported = true;
    }

    /** @private */
    _onSessionEnd() {
        this._supported = false;
        this._available = false;

        this._lightProbeRequested = false;
        this._lightProbe = null;
    }

    /**
     * Start estimation of illumination data. Availability of such data will come later and an
     * `available` event will be fired. If it failed to start estimation, an `error` event will be
     * fired.
     *
     * @example
     * app.xr.on('start', function () {
     *     if (app.xr.lightEstimation.supported) {
     *         app.xr.lightEstimation.start();
     *     }
     * });
     */
    start() {
        let err;

        if (!this._manager.session)
            err = new Error('XR session is not running');

        if (!err && this._manager.type !== XRTYPE_AR)
            err = new Error('XR session type is not AR');

        if (!err && !this._supported)
            err = new Error('light-estimation is not supported');

        if (!err && this._lightProbe || this._lightProbeRequested)
            err = new Error('light estimation is already requested');

        if (err) {
            this.fire('error', err);
            return;
        }

        this._lightProbeRequested = true;

        this._manager.session.requestLightProbe(
        ).then((lightProbe) => {
            const wasRequested = this._lightProbeRequested;
            this._lightProbeRequested = false;

            if (this._manager.active) {
                if (wasRequested) {
                    this._lightProbe = lightProbe;
                }
            } else {
                this.fire('error', new Error('XR session is not active'));
            }
        }).catch((ex) => {
            this._lightProbeRequested = false;
            this.fire('error', ex);
        });
    }

    /**
     * End estimation of illumination data.
     */
    end() {
        this._lightProbeRequested = false;
        this._lightProbe = null;
        this._available = false;
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        if (!this._lightProbe) return;

        const lightEstimate = frame.getLightEstimate(this._lightProbe);
        if (!lightEstimate) return;

        if (!this._available) {
            this._available = true;
            this.fire('available');
        }

        // intensity
        const pli = lightEstimate.primaryLightIntensity;
        this._intensity = Math.max(1.0, Math.max(pli.x, Math.max(pli.y, pli.z)));

        // color
        vec3A.copy(pli).mulScalar(1 / this._intensity);
        this._color.set(vec3A.x, vec3A.y, vec3A.z);

        // rotation
        vec3A.set(0, 0, 0);
        vec3B.copy(lightEstimate.primaryLightDirection);
        mat4A.setLookAt(vec3B, vec3A, Vec3.UP);
        mat4B.setFromAxisAngle(Vec3.RIGHT, 90); // directional light is looking down
        mat4A.mul(mat4B);
        this._rotation.setFromMat4(mat4A);

        // spherical harmonics
        this._sphericalHarmonics.set(lightEstimate.sphericalHarmonicsCoefficients);
    }

    /**
     * True if Light Estimation is supported. This information is available only during an active AR
     * session.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if estimated light information is available.
     *
     * @type {boolean}
     * @example
     * if (app.xr.lightEstimation.available) {
     *     entity.light.intensity = app.xr.lightEstimation.intensity;
     * }
     */
    get available() {
        return this._available;
    }

    /**
     * Intensity of what is estimated to be the most prominent directional light. Or null if data
     * is not available.
     *
     * @type {number|null}
     */
    get intensity() {
        return this._available ? this._intensity : null;
    }

    /**
     * Color of what is estimated to be the most prominent directional light. Or null if data is
     * not available.
     *
     * @type {Color|null}
     */
    get color() {
        return this._available ? this._color : null;
    }

    /**
     * Rotation of what is estimated to be the most prominent directional light. Or null if data is
     * not available.
     *
     * @type {Quat|null}
     */
    get rotation() {
        return this._available ? this._rotation : null;
    }

    /**
     * Spherical harmonic coefficients of estimated ambient light. Or null if data is not available.
     *
     * @type {Float32Array|null}
     */
    get sphericalHarmonics() {
        return this._available ? this._sphericalHarmonics : null;
    }
}

export { XrLightEstimation };
