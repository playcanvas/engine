import { EventHandler } from '../core/event-handler.js';

import { XRHAND_LEFT, XRHAND_RIGHT } from './constants.js';

import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

var fingerJointIds = [];
var tipJointIds = [];
var tipJointIdsIndex = {};

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
    tipJointIds = [XRHand.THUMB_PHALANX_TIP, XRHand.INDEX_PHALANX_TIP, XRHand.MIDDLE_PHALANX_TIP, XRHand.RING_PHALANX_TIP, XRHand.LITTLE_PHALANX_TIP];
}

for (var i = 0; i < tipJointIds.length; i++) {
    tipJointIdsIndex[tipJointIds[i]] = true;
}

/**
 * @class
 * @name pc.XrFinger
 * @classdesc Represents finger with related joints and index
 * @description Represents finger with related joints and index
 * @param {number} index - Index of a finger
 * @param {pc.XrHand} hand - Hand that finger relates to
 * @property {number} index Index of a finger, numeration is: thumb, index, middle, ring, little
 * @property {pc.XrHand} hand Hand that finger relates to
 * @property {pc.XrJoint[]} joints List of joints that relates to this finger, starting from joint closest to wrist all the way to the tip of a finger
 * @property {pc.XrJoint|null} tip Tip of a finger, or null if not available
 */
function XrFinger(index, hand) {
    this._index = index;
    this._hand = hand;
    this._hand._fingers.push(this);
    this._joints = [];
    this._tip = null;
}

Object.defineProperty(XrFinger.prototype, 'index', {
    get: function () {
        return this._index;
    }
});

Object.defineProperty(XrFinger.prototype, 'hand', {
    get: function () {
        return this._hand;
    }
});

Object.defineProperty(XrFinger.prototype, 'joints', {
    get: function () {
        return this._joints;
    }
});

Object.defineProperty(XrFinger.prototype, 'tip', {
    get: function () {
        return this._tip;
    }
});


/**
 * @class
 * @name pc.XrJoint
 * @classdesc Represents joint of a finger
 * @description Represents joint of a finger
 * @param {number} index - Index of a joint within a finger
 * @param {number} id - Id of a joint based on XRHand specs
 * @param {pc.XrHand} hand - Hand that joint relates to
 * @param {pc.XrFinger} [finger] - Finger that joint is related to, can be null in case of wrist joint
 * @property {number} index Index of a joint within a finger, starting from 0 (root of a finger) all the way to tip of the finger
 * @property {pc.XrHand} hand Hand that joint relates to
 * @property {pc.XrFinger|null} finger Finger that joint relates to
 * @property {boolean} wrist True if joint is a wrist
 * @property {boolean} tip True if joint is a tip of a finger
 */
function XrJoint(index, id, hand, finger) {
    this._index = index;
    this._id = id;

    this._hand = hand;
    this._hand._joints.push(this);
    this._hand._jointsById[id] = this;

    this._finger = finger || null;
    if (this._finger) this._finger._joints.push(this);

    this._wrist = id == XRHand.WRIST;
    if (this._wrist) this._hand._wrist = this;

    this._tip = this._finger && !! tipJointIdsIndex[id];
    if (this._tip) {
        this._hand._tips.push(this);
        if (this._finger) this._finger._tip = this;
    }

    this._radius = null;

    this._localTransform = new Mat4();
    this._localTransform.setIdentity();

    this._worldTransform = new Mat4();
    this._worldTransform.setIdentity();

    this._localPosition = new Vec3();
    this._localRotation = new Quat();

    this._position = new Vec3();
    this._rotation = new Quat();

    this._dirtyLocal = true;
}

XrJoint.prototype.update = function (pose) {
    this._dirtyLocal = true;
    this._radius = pose.radius;
    this._localPosition.copy(pose.transform.position);
    this._localRotation.copy(pose.transform.orientation);
};

XrJoint.prototype._updateTransforms = function () {
    var dirty;

    if (this._dirtyLocal) {
        dirty = true;
        this._dirtyLocal = false;
        this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }

    var manager = this._hand._manager;
    var parent = manager.camera.parent;

    if (parent) {
        dirty = dirty || parent._dirtyLocal || parent._dirtyWorld;
        if (dirty) this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
        this._worldTransform.copy(this._localTransform);
    }
};

/**
 * @function
 * @name pc.XrJoint#getPosition
 * @description Get the world space position of a joint
 * @returns {pc.Vec3} The world space position of a joint
 */
XrJoint.prototype.getPosition = function () {
    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);
    return this._position;
};

/**
 * @function
 * @name pc.XrJoint#getRotation
 * @description Get the world space rotation of a joint
 * @returns {pc.Quat} The world space rotation of a joint
 */
XrJoint.prototype.getRotation = function () {
    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);
    return this._rotation;
};

/**
 * @function
 * @name pc.XrJoint#getRadius
 * @description Get the radius of a joint, which is a distance from joint to the edge of a skin
 * @returns {number} Radius of a joint
 */
XrJoint.prototype.getRadius = function () {
    return this._radius || 0.005;
};

Object.defineProperty(XrJoint.prototype, 'index', {
    get: function () {
        return this._index;
    }
});

Object.defineProperty(XrJoint.prototype, 'hand', {
    get: function () {
        return this._hand;
    }
});

Object.defineProperty(XrJoint.prototype, 'finger', {
    get: function () {
        return this._finger;
    }
});

Object.defineProperty(XrJoint.prototype, 'wrist', {
    get: function () {
        return this._wrist;
    }
});

Object.defineProperty(XrJoint.prototype, 'tip', {
    get: function () {
        return this._tip;
    }
});


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
    var j21 = this._jointsById[XRHand.LITTLE_PHALANX_PROXIMAL];;

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
