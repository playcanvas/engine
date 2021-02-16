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
 * @name XrInputSource
 * @augments EventHandler
 * @classdesc Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
 * @description Represents XR input source, which is any input mechanism which allows the user to perform targeted actions in the same virtual space as the viewer. Example XR input sources include, but are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods that operate on the viewer's pose.
 * @param {XrManager} manager - WebXR Manager.
 * @param {object} xrInputSource - [XRInputSource]{@link https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource} object that is created by WebXR API.
 * @property {number} id Unique number associated with instance of input source. Same physical devices when reconnected will not share this ID.
 * @property {object} inputSource XRInputSource object that is associated with this input source.
 * @property {string} targetRayMode Type of ray Input Device is based on. Can be one of the following:
 *
 * * {@link XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and follow the direction it is facing. (This is commonly referred to as a "gaze input" device in the context of head-mounted displays.)
 * * {@link XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction with the canvas element associated with an inline session’s output context, such as a mouse click or touch event.
 * * {@link XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates from either a handheld device or other hand-tracking mechanism and represents that the user is using their hands or the held device for pointing.
 *
 * @property {string} handedness Describes which hand input source is associated with. Can be one of the following:
 *
 * * {@link XRHAND_NONE}: None - input source is not meant to be held in hands.
 * * {@link XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
 * * {@link XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right hand.
 *
 * @property {string[]} profiles List of input profile names indicating both the prefered visual representation and behavior of the input source.
 * @property {boolean} grip If input source can be held, then it will have node with its world transformation, that can be used to position and rotate virtual joystics based on it.
 * @property {XrHand|null} hand If input source is a tracked hand, then it will point to {@link XrHand} otherwise it is null.
 * @property {Gamepad|null} gamepad If input source has buttons, triggers, thumbstick or touchpad, then this object provides access to its states.
 * @property {boolean} selecting True if input source is in active primary action between selectstart and selectend events.
 * @property {boolean} squeezing True if input source is in active squeeze action between squeezestart and squeezeend events.
 * @property {boolean} elementInput Set to true to allow input source to interact with Element components. Defaults to true.
 * @property {Entity} elementEntity If {@link XrInputSource#elementInput} is true, this property will hold entity with Element component at which this input source is hovering, or null if not hovering over any element.
 * @property {XrHitTestSource[]} hitTestSources list of active {@link XrHitTestSource} created by this input source.
 */
class XrInputSource extends EventHandler {
    constructor(manager, xrInputSource) {
        super();

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
        this._squeezing = false;

        this._elementInput = true;
        this._elementEntity = null;

        this._hitTestSources = [];
    }

    /**
     * @event
     * @name XrInputSource#remove
     * @description Fired when {@link XrInputSource} is removed.
     * @example
     * inputSource.once('remove', function () {
     *     // input source is not available anymore
     * });
     */

    /**
     * @event
     * @name XrInputSource#select
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
     * @name XrInputSource#selectstart
     * @description Fired when input source has started to trigger primary action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInputSource#selectend
     * @description Fired when input source has ended triggerring primary action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInputSource#squeeze
     * @description Fired when input source has triggered squeeze action. This is associated with "grabbing" action on the controllers.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInputSource#squeezestart
     * @description Fired when input source has started to trigger sqeeze action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     * @example
     * inputSource.on('squeezestart', function (evt) {
     *     if (obj.containsPoint(inputSource.getPosition())) {
     *         // grabbed an object
     *     }
     * });
     */

    /**
     * @event
     * @name XrInputSource#squeezeend
     * @description Fired when input source has ended triggerring sqeeze action.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInputSource#hittest:add
     * @description Fired when new {@link XrHitTestSource} is added to the input source.
     * @param {XrHitTestSource} hitTestSource - Hit test source that has been added
     * @example
     * inputSource.on('hittest:add', function (hitTestSource) {
     *     // new hit test source is added
     * });
     */

    /**
     * @event
     * @name XrInputSource#hittest:remove
     * @description Fired when {@link XrHitTestSource} is removed to the the input source.
     * @param {XrHitTestSource} hitTestSource - Hit test source that has been removed
     * @example
     * inputSource.on('remove', function (hitTestSource) {
     *     // hit test source is removed
     * });
     */

    /**
     * @event
     * @name XrInputSource#hittest:result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {XrHitTestSource} hitTestSource - Hit test source that produced the hit result
     * @param {Vec3} position - Position of hit test
     * @param {Quat} rotation - Rotation of hit test
     * @example
     * inputSource.on('hittest:result', function (hitTestSource, position, rotation) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    update(frame) {
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
    }

    _updateTransforms() {
        if (this._dirtyLocal) {
            this._dirtyLocal = false;
            this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
        }

        var parent = this._manager.camera.parent;
        if (parent) {
            this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
        } else {
            this._worldTransform.copy(this._localTransform);
        }
    }

    _updateRayTransforms = function () {
        var dirty = this._dirtyRay;
        this._dirtyRay = false;

        var parent = this._manager.camera.parent;
        if (parent) {
            var parentTransform = this._manager.camera.parent.getWorldTransform();

            parentTransform.getTranslation(this._position);
            this._rotation.setFromMat4(parentTransform);

            this._rotation.transformVector(this._rayLocal.origin, this._ray.origin);
            this._ray.origin.add(this._position);
            this._rotation.transformVector(this._rayLocal.direction, this._ray.direction);
        } else if (dirty) {
            this._ray.origin.copy(this._rayLocal.origin);
            this._ray.direction.copy(this._rayLocal.direction);
        }
    }

    /**
     * @function
     * @name XrInputSource#getPosition
     * @description Get the world space position of input source if it is handheld ({@link XrInputSource#grip} is true). Otherwise it will return null.
     * @returns {Vec3|null} The world space position of handheld input source.
     */
    getPosition() {
        if (! this._position) return null;

        this._updateTransforms();
        this._worldTransform.getTranslation(this._position);

        return this._position;
    }

    /**
     * @function
     * @name XrInputSource#getLocalPosition
     * @description Get the local space position of input source if it is handheld ({@link XrInputSource#grip} is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
     * @returns {Vec3|null} The world space position of handheld input source.
     */
    getLocalPosition() {
        return this._localPosition;
    }

    /**
     * @function
     * @name XrInputSource#getRotation
     * @description Get the world space rotation of input source if it is handheld ({@link XrInputSource#grip} is true). Otherwise it will return null.
     * @returns {Vec3|null} The world space rotation of handheld input source.
     */
    getRotation() {
        if (! this._rotation) return null;

        this._updateTransforms();
        this._rotation.setFromMat4(this._worldTransform);

        return this._rotation;
    }

    /**
     * @function
     * @name XrInputSource#getLocalRotation
     * @description Get the local space rotation of input source if it is handheld ({@link XrInputSource#grip} is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
     * @returns {Vec3|null} The world space rotation of handheld input source.
     */
    getLocalRotation = function () {
        return this._localRotation;
    }

    /**
     * @function
     * @name XrInputSource#getOrigin
     * @description Get the world space origin of input source ray.
     * @returns {Vec3} The world space origin of input source ray.
     */
    getOrigin = function () {
        this._updateRayTransforms();
        return this._ray.origin;
    }

    /**
     * @function
     * @name XrInputSource#getDirection
     * @description Get the world space direction of input source ray.
     * @returns {Vec3} The world space direction of input source ray.
     */
    getDirection() {
        this._updateRayTransforms();
        return this._ray.direction;
    }

    /**
     * @function
     * @name XrInputSource#hitTestStart
     * @description Attempts to start hit test source based on this input source.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {string[]} [options.entityTypes] - Optional list of underlying entity types
     * against which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ].
     * Can be any combination of the following:
     *
     * * {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be
     * computed based on the feature points detected by the underlying Augmented Reality system.
     * * {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be
     * computed based on the planes detected by the underlying Augmented Reality system.
     * * {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be
     * computed based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {callbacks.XrHitTestStart} [options.callback] - Optional callback function
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
    hitTestStart(options = {}) {
        var self = this;

        options.profile = this._xrInputSource.profiles[0];

        var callback = options.callback;
        options.callback = function (err, hitTestSource) {
            if (hitTestSource) self.onHitTestSourceAdd(hitTestSource);
            if (callback) callback(err, hitTestSource);
        };

        this._manager.hitTest.start(options);
    }

    onHitTestSourceAdd(hitTestSource) {
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
    }

    onHitTestSourceRemove(hitTestSource) {
        var ind = this._hitTestSources.indexOf(hitTestSource);
        if (ind !== -1) this._hitTestSources.splice(ind, 1);
    }

    get id() {
        return this._id;
    }

    get inputSource() {
        return this._xrInputSource;
    }

    get targetRayMode() {
        return this._xrInputSource.targetRayMode;
    }

    get handedness() {
        return this._xrInputSource.handedness;
    }

    get profiles() {
        return this._xrInputSource.profiles;
    }

    get grip() {
        return this._grip;
    }

    get hand() {
        return this._hand;
    }

    get gamepad() {
        return this._xrInputSource.gamepad || null;
    }

    get selecting() {
        return this._selecting;
    }

    get squeezing() {
        return this._squeezing;
    }

    get elementInput() {
        return this._elementInput;
    }

    set elementInput(value) {
        if (this._elementInput === value)
            return;

        this._elementInput = value;

        if (! this._elementInput)
            this._elementEntity = null;
    }

    get elementEntity() {
        return this._elementEntity;
    }

    get hitTestSources() {
        return this._hitTestSources;
    }
}

export { XrInputSource };
