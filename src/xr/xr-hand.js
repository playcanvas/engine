import { EventHandler } from '../core/event-handler.js';

import { XRHAND_LEFT } from './constants.js';

import { XrFinger } from './xr-finger.js';
import { XrJoint } from './xr-joint.js';

import { Vec3 } from '../math/vec3.js';

var fingerJointIds = [];

var vecA = new Vec3();
var vecB = new Vec3();
var vecC = new Vec3();

if (window.XRHand) {
    fingerJointIds = [
        [XRHand.THUMB_METACARPAL, XRHand.THUMB_PHALANX_PROXIMAL, XRHand.THUMB_PHALANX_DISTAL, XRHand.THUMB_PHALANX_TIP],
        [XRHand.INDEX_METACARPAL, XRHand.INDEX_PHALANX_PROXIMAL, XRHand.INDEX_PHALANX_INTERMEDIATE, XRHand.INDEX_PHALANX_DISTAL, XRHand.INDEX_PHALANX_TIP],
        [XRHand.MIDDLE_METACARPAL, XRHand.MIDDLE_PHALANX_PROXIMAL, XRHand.MIDDLE_PHALANX_INTERMEDIATE, XRHand.MIDDLE_PHALANX_DISTAL, XRHand.MIDDLE_PHALANX_TIP],
        [XRHand.RING_METACARPAL, XRHand.RING_PHALANX_PROXIMAL, XRHand.RING_PHALANX_INTERMEDIATE, XRHand.RING_PHALANX_DISTAL, XRHand.RING_PHALANX_TIP],
        [XRHand.LITTLE_METACARPAL, XRHand.LITTLE_PHALANX_PROXIMAL, XRHand.LITTLE_PHALANX_INTERMEDIATE, XRHand.LITTLE_PHALANX_DISTAL, XRHand.LITTLE_PHALANX_TIP]
    ];
}

/**
 * @class
 * @name pc.XrHand
 * @classdesc Represents a hand with fingers and joints
 * @description Represents a hand with fingers and joints
 * @param {pc.XrInputSource} inputSource - Input Source that hand is related to
 * @property {pc.XrFinger[]} fingers List of fingers of a hand
 * @property {pc.XrJoint[]} joints List of joints of hand
 * @property {pc.XrJoint[]} tips List of joints that are tips of a fingers
 * @property {pc.XrJoint|null} wrist Wrist of a hand, or null if it is not available by WebXR underlying system
 * @property {boolean} tracking True if tracking is available, otherwise tracking might be lost
 */
function XrHand(inputSource) {
    EventHandler.call(this);

    var xrHand = inputSource._xrInputSource.hand;

    this._manager = inputSource._manager;
    this._inputSource = inputSource;

    this._tracking = false;

    this._fingers = [];
    this._joints = [];
    this._jointsById = {};
    this._tips = [];

    this._wrist = null;

    if (xrHand[XRHand.WRIST])
        this._wrist = new XrJoint(0, XRHand.WRIST, this, null);

    for (var f = 0; f < fingerJointIds.length; f++) {
        var finger = new XrFinger(f, this);

        for (var j = 0; j < fingerJointIds[f].length; j++) {
            var jointId = fingerJointIds[f][j];
            if (! xrHand[jointId]) continue;
            new XrJoint(j, jointId, this, finger);
        }
    }
}
XrHand.prototype = Object.create(EventHandler.prototype);
XrHand.prototype.constructor = XrHand;

/**
 * @event
 * @name pc.XrHand#tracking
 * @description Fired when tracking becomes available.
 */

 /**
  * @event
  * @name pc.XrHand#trackinglost
  * @description Fired when tracking is lost.
  */

XrHand.prototype.update = function (frame) {
    var xrInputSource = this._inputSource._xrInputSource;

    // joints
    for (var j = 0; j < this._joints.length; j++) {
        var joint = this._joints[j];
        var jointSpace = xrInputSource.hand[joint._id];
        if (jointSpace) {
            var pose = frame.getJointPose(jointSpace, this._manager._referenceSpace);
            if (pose) {
                joint.update(pose);

                if (joint.wrist && ! this._tracking) {
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

    var j1 = this._jointsById[XRHand.THUMB_METACARPAL];
    var j4 = this._jointsById[XRHand.THUMB_PHALANX_TIP];
    var j6 = this._jointsById[XRHand.INDEX_PHALANX_PROXIMAL];
    var j9 = this._jointsById[XRHand.INDEX_PHALANX_TIP];
    var j16 = this._jointsById[XRHand.RING_PHALANX_PROXIMAL];
    var j21 = this._jointsById[XRHand.LITTLE_PHALANX_PROXIMAL];

    // ray
    if (j1 && j4 && j6 && j9 && j16 && j21) {
        this._inputSource._dirtyRay = true;

        // ray origin
        // get point between thumb tip and index tip
        this._inputSource._rayLocal.origin.lerp(j4._localPosition, j9._localPosition, 0.5);

        // ray direction
        var jointL = j1;
        var jointR = j21;

        if (this._inputSource.handedness === XRHAND_LEFT) {
            var t = jointL;
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

    // emulate select events by touching thumb tip and index tips
    if (j4 && j9) {
        vecA.copy(j4._localPosition);
        var d = vecA.distance(j9._localPosition);

        if (d < 0.015) { // 15 mm
            if (! this._inputSource._selecting) {
                this._inputSource._selecting = true;
                this._inputSource.fire('selectstart');
                this._manager.input.fire('selectstart', this._inputSource);
            }
        } else {
            if (this._inputSource._selecting) {
                this._inputSource._selecting = false;

                this._inputSource.fire('select');
                this._manager.input.fire('select', this._inputSource);

                this._inputSource.fire('selectend');
                this._manager.input.fire('selectend', this._inputSource);
            }
        }
    }
};

/**
 * @function
 * @name pc.XrHand#getJointById
 * @description Returns joint by XRHand id from list in specs: https://immersive-web.github.io/webxr-hand-input/
 * @param {number} id - id of a joint based on specs ID's in XRHand: https://immersive-web.github.io/webxr-hand-input/
 * @returns {pc.XrJoint|null} Joint or null if not available
 */
XrHand.prototype.getJointById = function (id) {
    return this._jointsById[id] || null;
};

Object.defineProperty(XrHand.prototype, 'fingers', {
    get: function () {
        return this._fingers;
    }
});

Object.defineProperty(XrHand.prototype, 'joints', {
    get: function () {
        return this._joints;
    }
});

Object.defineProperty(XrHand.prototype, 'tips', {
    get: function () {
        return this._tips;
    }
});

Object.defineProperty(XrHand.prototype, 'wrist', {
    get: function () {
        return this._wrist;
    }
});

Object.defineProperty(XrHand.prototype, 'tracking', {
    get: function () {
        return this._tracking;
    }
});

export { XrHand };
