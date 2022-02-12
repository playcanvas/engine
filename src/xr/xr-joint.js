import { platform } from '../core/platform.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

/** @typedef {import('./xr-finger.js').XrFinger} XrFinger */
/** @typedef {import('./xr-hand.js').XrHand} XrHand */

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
 * Represents the joint of a finger.
 */
class XrJoint {
    /**
     * @type {number}
     * @private
     */
    _index;

    /**
     * @type {string}
     * @private
     */
    _id;

    /**
     * @type {XrHand}
     * @private
     */
    _hand;

    /**
     * @type {XrFinger}
     * @private
     */
    _finger;

    /**
     * @type {boolean}
     * @private
     */
    _wrist;

    /**
     * @type {boolean}
     * @private
     */
    _tip;

    /**
     * @type {number}
     * @private
     */
    _radius = null;

    /**
     * @type {Mat4}
     * @private
     */
    _localTransform = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _worldTransform = new Mat4();

    /**
     * @type {Vec3}
     * @private
     */
    _localPosition = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    _localRotation = new Quat();

    /**
     * @type {Vec3}
     * @private
     */
    _position = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    _rotation = new Quat();

    /**
     * @type {boolean}
     * @private
     */
    _dirtyLocal = true;

    /**
     * Create an XrJoint instance.
     *
     * @param {number} index - Index of a joint within a finger.
     * @param {string} id - Id of a joint based on WebXR Hand Input Specs.
     * @param {XrHand} hand - Hand that joint relates to.
     * @param {XrFinger} [finger] - Finger that joint is related to, can be null in case of wrist.
     * joint.
     * @hideconstructor
     */
    constructor(index, id, hand, finger = null) {
        this._index = index;
        this._id = id;
        this._hand = hand;
        this._finger = finger;
        this._wrist = id === 'wrist';
        this._tip = this._finger && !!tipJointIdsIndex[id];
    }

    /**
     * @param {*} pose - XRJointPose of this joint.
     * @ignore
     */
    update(pose) {
        this._dirtyLocal = true;
        this._radius = pose.radius;
        this._localPosition.copy(pose.transform.position);
        this._localRotation.copy(pose.transform.orientation);
    }

    /** @private */
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
     * Get the world space position of a joint.
     *
     * @returns {Vec3} The world space position of a joint.
     */
    getPosition() {
        this._updateTransforms();
        this._worldTransform.getTranslation(this._position);
        return this._position;
    }

    /**
     * Get the world space rotation of a joint.
     *
     * @returns {Quat} The world space rotation of a joint.
     */
    getRotation() {
        this._updateTransforms();
        this._rotation.setFromMat4(this._worldTransform);
        return this._rotation;
    }

    /**
     * Index of a joint within a finger, starting from 0 (root of a finger) all the way to tip of
     * the finger.
     *
     * @type {number}
     */
    get index() {
        return this._index;
    }

    /**
     * Hand that joint relates to.
     *
     * @type {XrHand}
     */
    get hand() {
        return this._hand;
    }

    /**
     * Finger that joint relates to.
     *
     * @type {XrFinger|null}
     */
    get finger() {
        return this._finger;
    }

    /**
     * True if joint is a wrist.
     *
     * @type {boolean}
     */
    get wrist() {
        return this._wrist;
    }

    /**
     * True if joint is a tip of a finger.
     *
     * @type {boolean}
     */
    get tip() {
        return this._tip;
    }

    /**
     * The radius of a joint, which is a distance from joint to the edge of a skin.
     *
     * @type {number}
     */
    get radius() {
        return this._radius || 0.005;
    }
}

export { XrJoint };
