import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

var tipJointIds = typeof window !== 'undefined' && window.XRHand ? [
    XRHand.THUMB_PHALANX_TIP,
    XRHand.INDEX_PHALANX_TIP,
    XRHand.MIDDLE_PHALANX_TIP,
    XRHand.RING_PHALANX_TIP,
    XRHand.LITTLE_PHALANX_TIP
] : [];

var tipJointIdsIndex = {};

for (var i = 0; i < tipJointIds.length; i++) {
    tipJointIdsIndex[tipJointIds[i]] = true;
}

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
 * @property {number} radius The radius of a joint, which is a distance from joint to the edge of a skin
 */
class XrJoint {
    constructor(index, id, hand, finger = null) {
        this._index = index;
        this._id = id;

        this._hand = hand;
        this._hand._joints.push(this);
        this._hand._jointsById[id] = this;

        this._finger = finger;
        if (this._finger) this._finger._joints.push(this);

        this._wrist = id === XRHand.WRIST;
        if (this._wrist) this._hand._wrist = this;

        this._tip = this._finger && !! tipJointIdsIndex[id];
        if (this._tip) {
            this._hand._tips.push(this);
            if (this._finger) this._finger._tip = this;
        }

        this._radius = null;

        this._localTransform = new Mat4();
        this._worldTransform = new Mat4();

        this._localPosition = new Vec3();
        this._localRotation = new Quat();

        this._position = new Vec3();
        this._rotation = new Quat();

        this._dirtyLocal = true;
    }

    update(pose) {
        this._dirtyLocal = true;
        this._radius = pose.radius;
        this._localPosition.copy(pose.transform.position);
        this._localRotation.copy(pose.transform.orientation);
    }

    _updateTransforms() {
        if (this._dirtyLocal) {
            this._dirtyLocal = false;
            this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
        }

        var manager = this._hand._manager;
        var parent = manager.camera.parent;

        if (parent) {
            this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
        } else {
            this._worldTransform.copy(this._localTransform);
        }
    }

    /**
     * @function
     * @name pc.XrJoint#getPosition
     * @description Get the world space position of a joint
     * @returns {pc.Vec3} The world space position of a joint
     */
    getPosition() {
        this._updateTransforms();
        this._worldTransform.getTranslation(this._position);
        return this._position;
    }

    /**
     * @function
     * @name pc.XrJoint#getRotation
     * @description Get the world space rotation of a joint
     * @returns {pc.Quat} The world space rotation of a joint
     */
    getRotation() {
        this._updateTransforms();
        this._rotation.setFromMat4(this._worldTransform);
        return this._rotation;
    }

    get index() {
        return this._index;
    }

    get hand() {
        return this._hand;
    }

    get finger() {
        return this._finger;
    }

    get wrist() {
        return this._wrist;
    }

    get tip() {
        return this._tip;
    }

    get radius() {
        return this._radius || 0.005;
    }
}

export { XrJoint };
