import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';

import { XRHAND_LEFT } from './constants.js';
import { XrFinger } from './xr-finger.js';
import { XrJoint } from './xr-joint.js';


/**
 * @type {string[][]}
 * @ignore
 */
let fingerJointIds = [];

const vecA = new Vec3();
const vecB = new Vec3();
const vecC = new Vec3();

if (platform.browser && window.XRHand) {
    fingerJointIds = [
        ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
        ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
        ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
        ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
        ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip']
    ];
}

/**
 * Represents a hand with fingers and joints.
 *
 * @category XR
 */
class XrHand extends EventHandler {
    /**
     * Fired when tracking becomes available.
     *
     * @event
     * @example
     * hand.on('tracking', () => {
     *     console.log('Hand tracking is available');
     * });
     */
    static EVENT_TRACKING = 'tracking';

    /**
     * Fired when tracking is lost.
     *
     * @event
     * @example
     * hand.on('trackinglost', () => {
     *     console.log('Hand tracking is lost');
     * });
     */
    static EVENT_TRACKINGLOST = 'trackinglost';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {import('./xr-input-source.js').XrInputSource}
     * @private
     */
    _inputSource;

    /**
     * @type {boolean}
     * @private
     */
    _tracking = false;

    /**
     * @type {XrFinger[]}
     * @private
     */
    _fingers = [];

    /**
     * @type {XrJoint[]}
     * @private
     */
    _joints = [];

    /**
     * @type {Object<string, XrJoint>}
     * @private
     */
    _jointsById = {};

    /**
     * @type {XrJoint[]}
     * @private
     */
    _tips = [];

    /**
     * @type {XrJoint|null}
     * @private
     */
    _wrist = null;

    /**
     * Represents a hand with fingers and joints.
     *
     * @param {import('./xr-input-source.js').XrInputSource} inputSource - Input Source that hand
     * is related to.
     * @ignore
     */
    constructor(inputSource) {
        super();

        const xrHand = inputSource._xrInputSource.hand;

        this._manager = inputSource._manager;
        this._inputSource = inputSource;

        if (xrHand.get('wrist')) {
            const joint = new XrJoint(0, 'wrist', this, null);
            this._wrist = joint;
            this._joints.push(joint);
            this._jointsById.wrist = joint;
        }

        for (let f = 0; f < fingerJointIds.length; f++) {
            const finger = new XrFinger(f, this);

            for (let j = 0; j < fingerJointIds[f].length; j++) {
                const jointId = fingerJointIds[f][j];
                if (!xrHand.get(jointId)) continue;

                const joint = new XrJoint(j, jointId, this, finger);

                this._joints.push(joint);
                this._jointsById[jointId] = joint;
                if (joint.tip) {
                    this._tips.push(joint);
                    finger._tip = joint;
                }

                finger._joints.push(joint);
            }
        }
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        const xrInputSource = this._inputSource._xrInputSource;

        // joints
        for (let j = 0; j < this._joints.length; j++) {
            const joint = this._joints[j];
            const jointSpace = xrInputSource.hand.get(joint._id);
            if (jointSpace) {
                let pose;

                if (frame.session.visibilityState !== 'hidden')
                    pose = frame.getJointPose(jointSpace, this._manager._referenceSpace);

                if (pose) {
                    joint.update(pose);

                    if (joint.wrist && !this._tracking) {
                        this._tracking = true;
                        this.fire('tracking');
                    }
                } else if (joint.wrist) {
                    // lost tracking

                    if (this._tracking) {
                        this._tracking = false;
                        this.fire('trackinglost');
                    }
                    break;
                }
            }
        }

        const j1 = this._jointsById['thumb-metacarpal'];
        const j4 = this._jointsById['thumb-tip'];
        const j6 = this._jointsById['index-finger-phalanx-proximal'];
        const j9 = this._jointsById['index-finger-tip'];
        const j16 = this._jointsById['ring-finger-phalanx-proximal'];
        const j21 = this._jointsById['pinky-finger-phalanx-proximal'];

        // ray
        if (j1 && j4 && j6 && j9 && j16 && j21) {
            this._inputSource._dirtyRay = true;

            // ray origin
            // get point between thumb tip and index tip
            this._inputSource._rayLocal.origin.lerp(j4._localPosition, j9._localPosition, 0.5);

            // ray direction
            let jointL = j1;
            let jointR = j21;

            if (this._inputSource.handedness === XRHAND_LEFT) {
                const t = jointL;
                jointL = jointR;
                jointR = t;
            }

            // (A) calculate normal vector between 3 joints: wrist, thumb metacarpal, little phalanx proximal
            vecA.sub2(jointL._localPosition, this._wrist._localPosition);
            vecB.sub2(jointR._localPosition, this._wrist._localPosition);
            vecC.cross(vecA, vecB).normalize();

            // get point between: index phalanx proximal and right phalanx proximal
            vecA.lerp(j6._localPosition, j16._localPosition, 0.5);
            // (B) get vector between that point and a wrist
            vecA.sub(this._wrist._localPosition).normalize();

            // mix normal vector (A) with hand directional vector (B)
            this._inputSource._rayLocal.direction.lerp(vecC, vecA, 0.5).normalize();
        }

        // emulate squeeze events by folding all 4 fingers
        const squeezing = this._fingerIsClosed(1) && this._fingerIsClosed(2) && this._fingerIsClosed(3) && this._fingerIsClosed(4);

        if (squeezing) {
            if (!this._inputSource._squeezing) {
                this._inputSource._squeezing = true;
                this._inputSource.fire('squeezestart');
                this._manager.input.fire('squeezestart', this._inputSource);
            }
        } else {
            if (this._inputSource._squeezing) {
                this._inputSource._squeezing = false;

                this._inputSource.fire('squeeze');
                this._manager.input.fire('squeeze', this._inputSource);

                this._inputSource.fire('squeezeend');
                this._manager.input.fire('squeezeend', this._inputSource);
            }
        }
    }

    /**
     * @param {number} index - Finger index.
     * @returns {boolean} True if finger is closed and false otherwise.
     * @private
     */
    _fingerIsClosed(index) {
        const finger = this._fingers[index];
        vecA.sub2(finger.joints[0]._localPosition, finger.joints[1]._localPosition).normalize();
        vecB.sub2(finger.joints[2]._localPosition, finger.joints[3]._localPosition).normalize();
        return vecA.dot(vecB) < -0.8;
    }

    /**
     * Returns joint by its XRHand id.
     *
     * @param {string} id - Id of a joint based on specs ID's in XRHand: https://immersive-web.github.io/webxr-hand-input/#skeleton-joints-section.
     * @returns {XrJoint|null} Joint or null if not available.
     */
    getJointById(id) {
        return this._jointsById[id] || null;
    }

    /**
     * List of fingers of a hand.
     *
     * @type {XrFinger[]}
     */
    get fingers() {
        return this._fingers;
    }

    /**
     * List of joints of hand.
     *
     * @type {XrJoint[]}
     */
    get joints() {
        return this._joints;
    }

    /**
     * List of joints that are fingertips.
     *
     * @type {XrJoint[]}
     */
    get tips() {
        return this._tips;
    }

    /**
     * Wrist of a hand, or null if it is not available by WebXR underlying system.
     *
     * @type {XrJoint|null}
     */
    get wrist() {
        return this._wrist;
    }

    /**
     * True if tracking is available, otherwise tracking might be lost.
     *
     * @type {boolean}
     */
    get tracking() {
        return this._tracking;
    }
}

export { XrHand };
