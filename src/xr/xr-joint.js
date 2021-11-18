import { platform } from '../core/platform.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

const tipJointIds = platform.browser && window.XRHand ? [
    'thumb-tip',
    'index-finger-tip',
    'middle-finger-tip',
    'ring-finger-tip',
    'pinky-finger-tip'
] : [];

const tipJointIdsIndex = {};

for (let i = 0; i < tipJointIds.length; i++) {
    tipJointIdsIndex[tipJointIds[i]] = true;
}

/**
 * @class
 * @name XrJoint
 * @classdesc Represents joint of a finger.
 * @description Represents joint of a finger.
 * @hideconstructor
 * @param {number} index - Index of a joint within a finger.
 * @param {string} id - Id of a joint based on WebXR Hand Input Specs.
 * @param {XrHand} hand - Hand that joint relates to.
 * @param {XrFinger} [finger] - Finger that joint is related to, can be null in case of wrist joint.
 * @property {number} index Index of a joint within a finger, starting from 0 (root of a finger) all the way to tip of the finger.
 * @property {XrHand} hand Hand that joint relates to.
 * @property {XrFinger|null} finger Finger that joint relates to.
 * @property {boolean} wrist True if joint is a wrist.
 * @property {boolean} tip True if joint is a tip of a finger
 * @property {number} radius The radius of a joint, which is a distance from joint to the edge of a skin
 */
class XrJoint {
    constructor(index, id, hand, finger = null) {
        this._index = index;
        this._id = id;

        this._hand = hand;
        this._finger = finger;
        this._wrist = id === 'wrist';
        this._tip = this._finger && !!tipJointIdsIndex[id];

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

        const manager = this._hand._manager;
        const parent = manager.camera.parent;

        if (parent) {
            this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
        } else {
            this._worldTransform.copy(this._localTransform);
        }
    }

    /**
     * @function
     * @name XrJoint#getPosition
     * @description Get the world space position of a joint.
     * @returns {Vec3} The world space position of a joint.
     */
    getPosition() {
        this._updateTransforms();
        this._worldTransform.getTranslation(this._position);
        return this._position;
    }

    /**
     * @function
     * @name XrJoint#getRotation
     * @description Get the world space rotation of a joint.
     * @returns {Quat} The world space rotation of a joint.
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
