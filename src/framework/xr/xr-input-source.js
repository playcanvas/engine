import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Ray } from '../../core/shape/ray.js';

import { XrHand } from './xr-hand.js';

import { now } from '../../core/time.js';

const vec3A = new Vec3();
const quat = new Quat();
let ids = 0;

/**
 * Represents XR input source, which is any input mechanism which allows the user to perform
 * targeted actions in the same virtual space as the viewer. Example XR input sources include, but
 * are not limited to: handheld controllers, optically tracked hands, touch screen taps, and
 * gaze-based input methods that operate on the viewer's pose.
 *
 * @category XR
 */
class XrInputSource extends EventHandler {
    /**
     * Fired when {@link XrInputSource} is removed.
     *
     * @event
     * @example
     * inputSource.once('remove', () => {
     *     // input source is not available anymore
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Fired when input source has triggered primary action. This could be pressing a trigger
     * button, or touching a screen. The handler is passed an {@link XRInputSourceEvent} object
     * from the WebXR API.
     *
     * @event
     * @example
     * const ray = new pc.Ray();
     * inputSource.on('select', (evt) => {
     *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
     *     if (obj.intersectsRay(ray)) {
     *         // selected an object with input source
     *     }
     * });
     */
    static EVENT_SELECT = 'select';

    /**
     * Fired when input source has started to trigger primary action. The handler is passed an
     * {@link XRInputSourceEvent} object from the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('selectstart', (evt) => {
     *     console.log('Select started');
     * });
     */
    static EVENT_SELECTSTART = 'selectstart';

    /**
     * Fired when input source has ended triggering primary action. The handler is passed an
     * {@link XRInputSourceEvent} object from the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('selectend', (evt) => {
     *     console.log('Select ended');
     * });
     */
    static EVENT_SELECTEND = 'selectend';

    /**
     * Fired when input source has triggered squeeze action. This is associated with "grabbing"
     * action on the controllers. The handler is passed an {@link XRInputSourceEvent} object from
     * the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('squeeze', (evt) => {
     *     console.log('Squeeze');
     * });
     */
    static EVENT_SQUEEZE = 'squeeze';

    /**
     * Fired when input source has started to trigger squeeze action. The handler is passed an
     * {@link XRInputSourceEvent} object from the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('squeezestart', (evt) => {
     *     if (obj.containsPoint(inputSource.getPosition())) {
     *         // grabbed an object
     *     }
     * });
     */
    static EVENT_SQUEEZESTART = 'squeezestart';

    /**
     * Fired when input source has ended triggering squeeze action. The handler is passed an
     * {@link XRInputSourceEvent} object from the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('squeezeend', (evt) => {
     *     console.log('Squeeze ended');
     * });
     */
    static EVENT_SQUEEZEEND = 'squeezeend';

    /**
     * Fired when new {@link XrHitTestSource} is added to the input source. The handler is passed
     * the {@link XrHitTestSource} object that has been added.
     *
     * @event
     * @example
     * inputSource.on('hittest:add', (hitTestSource) => {
     *     // new hit test source is added
     * });
     */
    static EVENT_HITTESTADD = 'hittest:add';

    /**
     * Fired when {@link XrHitTestSource} is removed to the the input source. The handler is passed
     * the {@link XrHitTestSource} object that has been removed.
     *
     * @event
     * @example
     * inputSource.on('remove', (hitTestSource) => {
     *     // hit test source is removed
     * });
     */
    static EVENT_HITTESTREMOVE = 'hittest:remove';

    /**
     * Fired when hit test source receives new results. It provides transform information that
     * tries to match real world picked geometry. The handler is passed the {@link XrHitTestSource}
     * object that produced the hit result, the {@link Vec3} position, the {@link Quat}
     * rotation and the {@link XRHitTestResult} object that is created by the WebXR API.
     *
     * @event
     * @example
     * inputSource.on('hittest:result', (hitTestSource, position, rotation, hitTestResult) => {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */
    static EVENT_HITTESTRESULT = 'hittest:result';

    /**
     * @type {number}
     * @private
     */
    _id;

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {XRInputSource}
     * @private
     */
    _xrInputSource;

    /**
     * @type {Ray}
     * @private
     */
    _ray = new Ray();

    /**
     * @type {Ray}
     * @private
     */
    _rayLocal = new Ray();

    /**
     * @type {boolean}
     * @private
     */
    _grip = false;

    /**
     * @type {XrHand|null}
     * @private
     */
    _hand = null;

    /**
     * @type {boolean}
     * @private
     */
    _velocitiesAvailable = false;

    /**
     * @type {number}
     * @private
     */
    _velocitiesTimestamp = now();

    /**
     * @type {Mat4|null}
     * @private
     */
    _localTransform = null;

    /**
     * @type {Mat4|null}
     * @private
     */
    _worldTransform = null;

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
     * @type {Vec3|null}
     * @private
     */
    _localPosition = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    _localPositionLast = null;

    /**
     * @type {Quat|null}
     * @private
     */
    _localRotation = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    _linearVelocity = null;

    /**
     * @type {boolean}
     * @private
     */
    _dirtyLocal = true;

    /**
     * @type {boolean}
     * @private
     */
    _dirtyRay = false;

    /**
     * @type {boolean}
     * @private
     */
    _selecting = false;

    /**
     * @type {boolean}
     * @private
     */
    _squeezing = false;

    /**
     * @type {boolean}
     * @private
     */
    _elementInput = true;

    /**
     * @type {import('../entity.js').Entity|null}
     * @private
     */
    _elementEntity = null;

    /**
     * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
     * @private
     */
    _hitTestSources = [];

    /**
     * Create a new XrInputSource instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @param {XRInputSource} xrInputSource - A WebXR input source.
     * @ignore
     */
    constructor(manager, xrInputSource) {
        super();

        this._id = ++ids;

        this._manager = manager;
        this._xrInputSource = xrInputSource;

        if (xrInputSource.hand)
            this._hand = new XrHand(this);
    }

    /**
     * Unique number associated with instance of input source. Same physical devices when
     * reconnected will not share this ID.
     *
     * @type {number}
     */
    get id() {
        return this._id;
    }

    /**
     * XRInputSource object that is associated with this input source.
     *
     * @type {XRInputSource}
     */
    get inputSource() {
        return this._xrInputSource;
    }

    /**
     * Type of ray Input Device is based on. Can be one of the following:
     *
     * - {@link XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and
     * follow the direction it is facing. This is commonly referred to as a "gaze input" device in
     * the context of head-mounted displays.
     * - {@link XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction
     * with the canvas element associated with an inline session's output context, such as a mouse
     * click or touch event.
     * - {@link XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates
     * from either a handheld device or other hand-tracking mechanism and represents that the user
     * is using their hands or the held device for pointing.
     *
     * @type {string}
     */
    get targetRayMode() {
        return this._xrInputSource.targetRayMode;
    }

    /**
     * Describes which hand input source is associated with. Can be one of the following:
     *
     * - {@link XRHAND_NONE}: None - input source is not meant to be held in hands.
     * - {@link XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
     * - {@link XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right
     * hand.
     *
     * @type {string}
     */
    get handedness() {
        return this._xrInputSource.handedness;
    }

    /**
     * List of input profile names indicating both the preferred visual representation and behavior
     * of the input source.
     *
     * @type {string[]}
     */
    get profiles() {
        return this._xrInputSource.profiles;
    }

    /**
     * If input source can be held, then it will have node with its world transformation, that can
     * be used to position and rotate visual object based on it.
     *
     * @type {boolean}
     */
    get grip() {
        return this._grip;
    }

    /**
     * If input source is a tracked hand, then it will point to {@link XrHand} otherwise it is
     * null.
     *
     * @type {XrHand|null}
     */
    get hand() {
        return this._hand;
    }

    /**
     * If input source has buttons, triggers, thumbstick or touchpad, then this object provides
     * access to its states.
     *
     * @type {Gamepad|null}
     */
    get gamepad() {
        return this._xrInputSource.gamepad || null;
    }

    /**
     * True if input source is in active primary action between selectstart and selectend events.
     *
     * @type {boolean}
     */
    get selecting() {
        return this._selecting;
    }

    /**
     * True if input source is in active squeeze action between squeezestart and squeezeend events.
     *
     * @type {boolean}
     */
    get squeezing() {
        return this._squeezing;
    }

    /**
     * Sets whether the input source can interact with {@link ElementComponent}s. Defaults to true.
     *
     * @type {boolean}
     */
    set elementInput(value) {
        if (this._elementInput === value)
            return;

        this._elementInput = value;

        if (!this._elementInput)
            this._elementEntity = null;
    }

    /**
     * Gets whether the input source can interact with {@link ElementComponent}s.
     *
     * @type {boolean}
     */
    get elementInput() {
        return this._elementInput;
    }

    /**
     * If {@link XrInputSource#elementInput} is true, this property will hold entity with Element
     * component at which this input source is hovering, or null if not hovering over any element.
     *
     * @type {import('../entity.js').Entity|null}
     */
    get elementEntity() {
        return this._elementEntity;
    }

    /**
     * List of active {@link XrHitTestSource} instances associated with this input source.
     *
     * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
     */
    get hitTestSources() {
        return this._hitTestSources;
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        // hand
        if (this._hand) {
            this._hand.update(frame);
        } else {
            // grip
            const gripSpace = this._xrInputSource.gripSpace;
            if (gripSpace) {
                const gripPose = frame.getPose(gripSpace, this._manager._referenceSpace);
                if (gripPose) {
                    if (!this._grip) {
                        this._grip = true;

                        this._localTransform = new Mat4();
                        this._worldTransform = new Mat4();

                        this._localPositionLast = new Vec3();
                        this._localPosition = new Vec3();
                        this._localRotation = new Quat();

                        this._linearVelocity = new Vec3();
                    }

                    const timestamp = now();
                    const dt = (timestamp - this._velocitiesTimestamp) / 1000;
                    this._velocitiesTimestamp = timestamp;

                    this._dirtyLocal = true;

                    this._localPositionLast.copy(this._localPosition);
                    this._localPosition.copy(gripPose.transform.position);
                    this._localRotation.copy(gripPose.transform.orientation);

                    this._velocitiesAvailable = true;
                    if (this._manager.input.velocitiesSupported && gripPose.linearVelocity) {
                        this._linearVelocity.copy(gripPose.linearVelocity);
                    } else if (dt > 0) {
                        vec3A.sub2(this._localPosition, this._localPositionLast).divScalar(dt);
                        this._linearVelocity.lerp(this._linearVelocity, vec3A, 0.15);
                    }
                } else {
                    this._velocitiesAvailable = false;
                }
            }

            // ray
            const targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
            if (targetRayPose) {
                this._dirtyRay = true;
                this._rayLocal.origin.copy(targetRayPose.transform.position);
                this._rayLocal.direction.set(0, 0, -1);
                quat.copy(targetRayPose.transform.orientation);
                quat.transformVector(this._rayLocal.direction, this._rayLocal.direction);
            }
        }
    }

    /** @private */
    _updateTransforms() {
        if (this._dirtyLocal) {
            this._dirtyLocal = false;
            this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
        }

        const parent = this._manager.camera.parent;
        if (parent) {
            this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
        } else {
            this._worldTransform.copy(this._localTransform);
        }
    }

    /** @private */
    _updateRayTransforms() {
        const dirty = this._dirtyRay;
        this._dirtyRay = false;

        const parent = this._manager.camera.parent;
        if (parent) {
            const parentTransform = this._manager.camera.parent.getWorldTransform();

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
     * Get the world space position of input source if it is handheld ({@link XrInputSource#grip}
     * is true). Otherwise it will return null.
     *
     * @returns {Vec3|null} The world space position of handheld input source.
     */
    getPosition() {
        if (!this._position) return null;

        this._updateTransforms();
        this._worldTransform.getTranslation(this._position);

        return this._position;
    }

    /**
     * Get the local space position of input source if it is handheld ({@link XrInputSource#grip}
     * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
     *
     * @returns {Vec3|null} The world space position of handheld input source.
     */
    getLocalPosition() {
        return this._localPosition;
    }

    /**
     * Get the world space rotation of input source if it is handheld ({@link XrInputSource#grip}
     * is true). Otherwise it will return null.
     *
     * @returns {Quat|null} The world space rotation of handheld input source.
     */
    getRotation() {
        if (!this._rotation) return null;

        this._updateTransforms();
        this._rotation.setFromMat4(this._worldTransform);

        return this._rotation;
    }

    /**
     * Get the local space rotation of input source if it is handheld ({@link XrInputSource#grip}
     * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
     *
     * @returns {Quat|null} The world space rotation of handheld input source.
     */
    getLocalRotation() {
        return this._localRotation;
    }

    /**
     * Get the linear velocity (units per second) of the input source if it is handheld
     * ({@link XrInputSource#grip} is true). Otherwise it will return null.
     *
     * @returns {Vec3|null} The world space linear velocity of the handheld input source.
     */
    getLinearVelocity() {
        if (!this._velocitiesAvailable)
            return null;

        return this._linearVelocity;
    }

    /**
     * Get the world space origin of input source ray.
     *
     * @returns {Vec3} The world space origin of input source ray.
     */
    getOrigin() {
        this._updateRayTransforms();
        return this._ray.origin;
    }

    /**
     * Get the world space direction of input source ray.
     *
     * @returns {Vec3} The world space direction of input source ray.
     */
    getDirection() {
        this._updateRayTransforms();
        return this._ray.direction;
    }

    /**
     * Attempts to start hit test source based on this input source.
     *
     * @param {object} [options] - Object for passing optional arguments.
     * @param {string[]} [options.entityTypes] - Optional list of underlying entity types against
     * which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ]. Can be any
     * combination of the following:
     *
     * - {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed
     * based on the feature points detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed
     * based on the planes detected by the underlying Augmented Reality system.
     * - {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed
     * based on the meshes detected by the underlying Augmented Reality system.
     *
     * @param {Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
     * @param {import('./xr-hit-test.js').XrHitTestStartCallback} [options.callback] - Optional
     * callback function called once hit test source is created or failed.
     * @example
     * app.xr.input.on('add', function (inputSource) {
     *     inputSource.hitTestStart({
     *         callback: function (err, hitTestSource) {
     *             if (err) return;
     *             hitTestSource.on('result', function (position, rotation, inputSource, hitTestResult) {
     *                 // position and rotation of hit test result
     *                 // that will be created from touch on mobile devices
     *             });
     *         }
     *     });
     * });
     */
    hitTestStart(options = {}) {
        options.inputSource = this;
        options.profile = this._xrInputSource.profiles[0];

        const callback = options.callback;
        options.callback = (err, hitTestSource) => {
            if (hitTestSource) this.onHitTestSourceAdd(hitTestSource);
            if (callback) callback(err, hitTestSource);
        };

        this._manager.hitTest.start(options);
    }

    /**
     * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
     * to be added.
     * @private
     */
    onHitTestSourceAdd(hitTestSource) {
        this._hitTestSources.push(hitTestSource);

        this.fire('hittest:add', hitTestSource);

        hitTestSource.on('result', (position, rotation, inputSource, hitTestResult) => {
            if (inputSource !== this) return;
            this.fire('hittest:result', hitTestSource, position, rotation, hitTestResult);
        });
        hitTestSource.once('remove', () => {
            this.onHitTestSourceRemove(hitTestSource);
            this.fire('hittest:remove', hitTestSource);
        });
    }

    /**
     * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
     * to be removed.
     * @private
     */
    onHitTestSourceRemove(hitTestSource) {
        const ind = this._hitTestSources.indexOf(hitTestSource);
        if (ind !== -1) this._hitTestSources.splice(ind, 1);
    }
}

export { XrInputSource };
