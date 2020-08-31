import { EventHandler } from '../core/event-handler.js';

import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

import { Ray } from '../shape/ray.js';

import { XrHand } from './xr-hand.js';

var quat = new Quat();
var ids = 0;

/**
 * @class
 * @name pc.XrInputSource
 * @augments pc.EventHandler
 * @classdesc Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
 * @description Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @param {object} xrInputSource - [XRInputSource]{@link https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource} object that is created by WebXR API.
 * @property {number} id Unique number associated with instance of input source. Same physical devices when reconnected will not share this ID.
 * @property {object} inputSource XRInputSource object that is associated with this input source.
 * @property {string} targetRayMode Type of ray Input Device is based on. Can be one of the following:
 *
 * * {@link pc.XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. (This is commonly referred to as a "gaze input" device in the context of head-mounted displays.)
 * * {@link pc.XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
 * * {@link pc.XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
 *
 * @property {string} handedness Describes which hand input source is associated with. Can be one of the following:
 *
 * * {@link pc.XRHAND_NONE}: None - input source is not meant to be held in hands.
 * * {@link pc.XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
 * * {@link pc.XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right hand.
 *
 * @property {string[]} profiles List of input profile names indicating both the prefered visual representation and behavior of the input source.
 * @property {boolean} grip If input source can be held, then it will have node with its world transformation, that can be used to position and rotate virtual joystics based on it.
 * @property {pc.XrHand|null} hand If input source is a tracked hand, then it will point to {@link pc.XrHand} otherwise it is null.
 * @property {Gamepad|null} gamepad If input source has buttons, triggers, thumbstick or touchpad, then this object provides access to its states.
 * @property {boolean} selecting True if input source is in active primary action between selectstart and selectend events.
 * @property {boolean} elementInput Set to true to allow input source to interact with Element components. Defaults to true.
 * @property {pc.Entity} elementEntity If {@link pc.XrInputSource#elementInput} is true, this property will hold entity with Element component at which this input source is hovering, or null if not hovering over any element.
 * @property {pc.XrHitTestSource[]} hitTestSources list of active {@link pc.XrHitTestSource} created by this input source.
 */
function XrInputSource(manager, xrInputSource) {
    EventHandler.call(this);

    this._id = ++ids;

    this._manager = manager;
    this._xrInputSource = xrInputSource;

    this._ray = new Ray();
    this._rayLocal = new Ray();
    this._grip = false;
    this._hand = null;

    if (xrInputSource.hand)
        this._hand = new XrHand(this);

    this._localTransform = null;
    this._worldTransform = null;
    this._position = new Vec3();
    this._rotation = new Quat();
    this._localPosition = null;
    this._localRotation = null;
    this._dirtyLocal = true;

    this._selecting = false;

    this._elementInput = true;
    this._elementEntity = null;

    this._hitTestSources = [];
}
XrInputSource.prototype = Object.create(EventHandler.prototype);
XrInputSource.prototype.constructor = XrInputSource;

/**
 * @event
 * @name pc.XrInputSource#remove
 * @description Fired when {@link pc.XrInputSource} is removed.
 * @example
 * inputSource.once('remove', function () {
 *     // input source is not available anymore
 * });
 */

/**
 * @event
 * @name pc.XrInputSource#select
 * @description Fired when input source has triggered primary action. This could be pressing a trigger button, or touching a screen.
 * @param {object} evt - XRInputSourceEvent event data from WebXR API
 * @example
 * var ray = new pc.Ray();
 * inputSource.on('select', function (evt) {
 *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
 *     if (obj.intersectsRay(ray)) {
 *         // selected an object with input source
 *     }
 * });
 */

/**
 * @event
 * @name pc.XrInputSource#selectstart
 * @description Fired when input source has started to trigger primary action.
 * @param {object} evt - XRInputSourceEvent event data from WebXR API
 */

/**
 * @event
 * @name pc.XrInputSource#selectend
 * @description Fired when input source has ended triggerring primary action.
 * @param {object} evt - XRInputSourceEvent event data from WebXR API
 */

/**
 * @event
 * @name pc.XrInputSource#hittest:add
 * @description Fired when new {@link pc.XrHitTestSource} is added to the input source.
 * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been added
 * @example
 * inputSource.on('hittest:add', function (hitTestSource) {
 *     // new hit test source is added
 * });
 */

/**
 * @event
 * @name pc.XrInputSource#hittest:remove
 * @description Fired when {@link pc.XrHitTestSource} is removed to the the input source.
 * @param {pc.XrHitTestSource} hitTestSource - Hit test source that has been removed
 * @example
 * inputSource.on('remove', function (hitTestSource) {
 *     // hit test source is removed
 * });
 */

/**
 * @event
 * @name pc.XrInputSource#hittest:result
 * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
 * @param {pc.XrHitTestSource} hitTestSource - Hit test source that produced the hit result
 * @param {pc.Vec3} position - Position of hit test
 * @param {pc.Quat} rotation - Rotation of hit test
 * @example
 * inputSource.on('hittest:result', function (hitTestSource, position, rotation) {
 *     target.setPosition(position);
 *     target.setRotation(rotation);
 * });
 */

XrInputSource.prototype.update = function (frame) {
    // hand
    if (this._hand) {
        this._hand.update(frame);
    } else {
        // grip
        if (this._xrInputSource.gripSpace) {
            var gripPose = frame.getPose(this._xrInputSource.gripSpace, this._manager._referenceSpace);
            if (gripPose) {
                if (! this._grip) {
                    this._grip = true;

                    this._localTransform = new Mat4();
                    this._worldTransform = new Mat4();

                    this._localPosition = new Vec3();
                    this._localRotation = new Quat();
                }
                this._dirtyLocal = true;
                this._localPosition.copy(gripPose.transform.position);
                this._localRotation.copy(gripPose.transform.orientation);
            }
        }

        // ray
        var targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
        if (targetRayPose) {
            this._dirtyRay = true;
            this._rayLocal.origin.copy(targetRayPose.transform.position);
            this._rayLocal.direction.set(0, 0, -1);
            quat.copy(targetRayPose.transform.orientation);
            quat.transformVector(this._rayLocal.direction, this._rayLocal.direction);
        }
    }
};

XrInputSource.prototype._updateTransforms = function () {
    var dirty;

    if (this._dirtyLocal) {
        dirty = true;
        this._dirtyLocal = false;
        this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }

    var parent = this._manager.camera.parent;
    if (parent) {
        dirty = dirty || parent._dirtyLocal || parent._dirtyWorld;
        if (dirty) this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
        this._worldTransform.copy(this._localTransform);
    }
};

XrInputSource.prototype._updateRayTransforms = function () {
    var dirty = this._dirtyRay;
    this._dirtyRay = false;

    var parent = this._manager.camera.parent;
    if (parent) {
        dirty = dirty || parent._dirtyLocal || parent._dirtyWorld;

        if (dirty) {
            var parentTransform = this._manager.camera.parent.getWorldTransform();

            parentTransform.getTranslation(this._position);
            this._rotation.setFromMat4(parentTransform);

            this._rotation.transformVector(this._rayLocal.origin, this._ray.origin);
            this._ray.origin.add(this._position);
            this._rotation.transformVector(this._rayLocal.direction, this._ray.direction);
        }
    } else if (dirty) {
        this._ray.origin.copy(this._rayLocal.origin);
        this._ray.direction.copy(this._rayLocal.direction);
    }
};

/**
 * @function
 * @name pc.XrInputSource#getPosition
 * @description Get the world space position of input source if it is handheld ({@link pc.XrInputSource#grip} is true). Otherwise it will return null.
 * @returns {pc.Vec3|null} The world space position of handheld input source.
 */
XrInputSource.prototype.getPosition = function () {
    if (! this._position) return null;

    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);

    return this._position;
};

/**
 * @function
 * @name pc.XrInputSource#getLocalPosition
 * @description Get the local space position of input source if it is handheld ({@link pc.XrInputSource#grip} is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
 * @returns {pc.Vec3|null} The world space position of handheld input source.
 */
XrInputSource.prototype.getLocalPosition = function () {
    return this._localPosition;
};

/**
 * @function
 * @name pc.XrInputSource#getRotation
 * @description Get the world space rotation of input source if it is handheld ({@link pc.XrInputSource#grip} is true). Otherwise it will return null.
 * @returns {pc.Vec3|null} The world space rotation of handheld input source.
 */
XrInputSource.prototype.getRotation = function () {
    if (! this._rotation) return null;

    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);

    return this._rotation;
};

/**
 * @function
 * @name pc.XrInputSource#getLocalRotation
 * @description Get the local space rotation of input source if it is handheld ({@link pc.XrInputSource#grip} is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
 * @returns {pc.Vec3|null} The world space rotation of handheld input source.
 */
XrInputSource.prototype.getLocalRotation = function () {
    return this._localRotation;
};

/**
 * @function
 * @name pc.XrInputSource#getOrigin
 * @description Get the world space origin of input source ray.
 * @returns {pc.Vec3} The world space origin of input source ray.
 */
XrInputSource.prototype.getOrigin = function () {
    this._updateRayTransforms();
    return this._ray.origin;
};

/**
 * @function
 * @name pc.XrInputSource#getDirection
 * @description Get the world space direction of input source ray.
 * @returns {pc.Vec3} The world space direction of input source ray.
 */
XrInputSource.prototype.getDirection = function () {
    this._updateRayTransforms();
    return this._ray.direction;
};

/**
 * @function
 * @name pc.XrInputSource#hitTestStart
 * @description Attempts to start hit test source based on this input source.
 * @param {object} [options] - Object for passing optional arguments.
 * @param {string[]} [options.entityTypes] - Optional list of underlying entity types
 * against which hit tests will be performed. Defaults to [ {pc.XRTRACKABLE_PLANE} ].
 * Can be any combination of the following:
 *
 * * {@link pc.XRTRACKABLE_POINT}: Point - indicates that the hit test results will be
 * computed based on the feature points detected by the underlying Augmented Reality system.
 * * {@link pc.XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be
 * computed based on the planes detected by the underlying Augmented Reality system.
 * * {@link pc.XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be
 * computed based on the meshes detected by the underlying Augmented Reality system.
 *
 * @param {pc.Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
 * @param {pc.callbacks.XrHitTestStart} [options.callback] - Optional callback function
 * called once hit test source is created or failed.
 * @example
 * app.xr.input.on('add', function (inputSource) {
 *     inputSource.hitTestStart({
 *         callback: function (err, hitTestSource) {
 *             if (err) return;
 *             hitTestSource.on('result', function (position, rotation) {
 *                 // position and rotation of hit test result
 *                 // that will be created from touch on mobile devices
 *             });
 *         }
 *     });
 * });
 */
XrInputSource.prototype.hitTestStart = function (options) {
    var self = this;

    options = options || { };
    options.profile = this._xrInputSource.profiles[0];

    var callback = options.callback;
    options.callback = function (err, hitTestSource) {
        if (hitTestSource) self.onHitTestSourceAdd(hitTestSource);
        if (callback) callback(err, hitTestSource);
    };

    this._manager.hitTest.start(options);
};

XrInputSource.prototype.onHitTestSourceAdd = function (hitTestSource) {
    this._hitTestSources.push(hitTestSource);

    this.fire('hittest:add', hitTestSource);

    hitTestSource.on('result', function (position, rotation, inputSource) {
        if (inputSource !== this)
            return;

        this.fire('hittest:result', hitTestSource, position, rotation);
    }, this);
    hitTestSource.once('remove', function () {
        this.onHitTestSourceRemove(hitTestSource);
        this.fire('hittest:remove', hitTestSource);
    }, this);
};

XrInputSource.prototype.onHitTestSourceRemove = function (hitTestSource) {
    var ind = this._hitTestSources.indexOf(hitTestSource);
    if (ind !== -1) this._hitTestSources.splice(ind, 1);
};

Object.defineProperty(XrInputSource.prototype, 'id', {
    get: function () {
        return this._id;
    }
});

Object.defineProperty(XrInputSource.prototype, 'inputSource', {
    get: function () {
        return this._xrInputSource;
    }
});

Object.defineProperty(XrInputSource.prototype, 'targetRayMode', {
    get: function () {
        return this._xrInputSource.targetRayMode;
    }
});

Object.defineProperty(XrInputSource.prototype, 'handedness', {
    get: function () {
        return this._xrInputSource.handedness;
    }
});

Object.defineProperty(XrInputSource.prototype, 'profiles', {
    get: function () {
        return this._xrInputSource.profiles;
    }
});

Object.defineProperty(XrInputSource.prototype, 'grip', {
    get: function () {
        return this._grip;
    }
});

Object.defineProperty(XrInputSource.prototype, 'hand', {
    get: function () {
        return this._hand;
    }
});

Object.defineProperty(XrInputSource.prototype, 'gamepad', {
    get: function () {
        return this._xrInputSource.gamepad || null;
    }
});

Object.defineProperty(XrInputSource.prototype, 'selecting', {
    get: function () {
        return this._selecting;
    }
});

Object.defineProperty(XrInputSource.prototype, 'elementInput', {
    get: function () {
        return this._elementInput;
    },
    set: function (value) {
        if (this._elementInput === value)
            return;

        this._elementInput = value;

        if (! this._elementInput)
            this._elementEntity = null;
    }
});

Object.defineProperty(XrInputSource.prototype, 'elementEntity', {
    get: function () {
        return this._elementEntity;
    }
});

Object.defineProperty(XrInputSource.prototype, 'hitTestSources', {
    get: function () {
        return this._hitTestSources;
    }
});

export { XrInputSource };
