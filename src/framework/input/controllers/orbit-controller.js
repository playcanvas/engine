import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_RIGHT } from '../../../platform/input/constants.js';
import { Mouse } from '../../../platform/input/mouse.js';
import { Pose } from '../pose.js';
import { InputController, damp, num } from './input-controller.js';

/**
 * @import { InputFrame, InputSnapshot } from '../../../platform/input/input-frame.js'
 * @import { InputDevices } from './input-controller.js'
 */

const dir = new Vec3();
const offset = new Vec3();
const angles = new Vec3();

const rotation = new Quat();

/**
 * The orbit controller. The pose orbits a focus point at a distance: `rotate` turns the view
 * around the focus within {@link yawRange} and {@link pitchRange}, `pan` moves the focus point in
 * the view plane, and `zoom` scales the distance within {@link zoomRange}. The display pose
 * follows with {@link rotateDamping}, {@link moveDamping} and {@link zoomDamping}.
 *
 * @category Input
 * @alpha
 */
class OrbitController extends InputController {
    /**
     * The frame fields: `rotate` is a pointer delta in pixels, `pan` a delta in normalized device
     * coordinates and `zoom` a wheel delta.
     *
     * @type {InputFrame['fields']}
     */
    static fields = {
        rotate: { type: 'vec2', kind: 'delta' },
        pan: { type: 'vec2', kind: 'delta' },
        zoom: { type: 'number', kind: 'delta' }
    };

    /**
     * @type {Pose}
     * @private
     */
    _targetRootPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _rootPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _targetChildPose = new Pose();

    /**
     * @type {Pose}
     * @private
     */
    _childPose = new Pose();

    /**
     * The rotation speed in degrees per pixel of `rotate`.
     */
    rotateSpeed = 0.2;

    /**
     * The zoom speed, as the fraction of the distance per unit of `zoom`.
     */
    zoomSpeed = 0.001;

    /**
     * The pinch sensitivity, in `zoom` units per pixel of pinch.
     */
    zoomPinchSens = 5;

    /**
     * Whether `pan` moves the focus point.
     */
    enablePan = true;

    /**
     * The camera projection used to convert `pan` to world units, copied from the camera.
     *
     * @type {{ fov: number, aspectRatio: number, horizontalFov: boolean, perspective: boolean, orthoHeight: number }}
     */
    camera = { fov: 90, aspectRatio: 1, horizontalFov: false, perspective: true, orthoHeight: 10 };

    /**
     * The rotation damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     */
    rotateDamping = 0.98;

    /**
     * The movement damping. In the range 0 to 1, where a value of 0 means no damping and 1 means
     * full damping. Default is 0.98.
     */
    moveDamping = 0.98;

    /**
     * The zoom damping. A higher value means more damping. A value of 0 means no damping.
     */
    zoomDamping = 0.98;

    constructor() {
        super();

        this._targetChildPose.zRange.set(0.01, Infinity);
    }

    set pitchRange(range) {
        this._targetRootPose.pitchRange.copy(range);
        this._rootPose.copy(this._targetRootPose.rotate(Vec3.ZERO));
    }

    get pitchRange() {
        return this._targetRootPose.pitchRange;
    }

    set yawRange(range) {
        this._targetRootPose.yawRange.copy(range);
        this._rootPose.copy(this._targetRootPose.rotate(Vec3.ZERO));
    }

    get yawRange() {
        return this._targetRootPose.yawRange;
    }

    set zoomRange(range) {
        this._targetChildPose.zRange.copy(range);
        this._childPose.copy(this._targetChildPose.move(Vec3.ZERO));
    }

    get zoomRange() {
        return this._targetChildPose.zRange;
    }

    /**
     * Sets the authoritative state.
     *
     * @type {{ focus: number[], angles: number[], distance: number }}
     */
    set state(value) {
        this._targetRootPose.position.fromArray(value.focus);
        this._targetRootPose.angles.fromArray(value.angles);
        this._targetChildPose.position.set(0, 0, value.distance);
    }

    /**
     * Gets a copy of the authoritative state.
     *
     * @type {{ focus: number[], angles: number[], distance: number }}
     */
    get state() {
        const { position: p, angles: a } = this._targetRootPose;
        return { focus: [p.x, p.y, p.z], angles: [a.x, a.y, a.z], distance: this._targetChildPose.position.z };
    }

    /**
     * @param {InputDevices} devices - The devices to read.
     * @param {InputFrame} frame - The frame built from {@link OrbitController.fields}.
     */
    map({ element, keyboard, mouse, gestures }, frame) {
        const { input } = frame;
        const rotate = /** @type {number[]} */ (input.rotate);
        const pan = /** @type {number[]} */ (input.pan);
        const width = element?.clientWidth;
        const height = element?.clientHeight;

        if (mouse) {
            const middle = mouse.isPressed(MOUSEBUTTON_MIDDLE);

            // hover moves are ignored, as by a drag-to-orbit camera
            if (middle || mouse.isPressed(MOUSEBUTTON_LEFT) || mouse.isPressed(MOUSEBUTTON_RIGHT) || Mouse.isPointerLocked()) {
                const [dx, dy] = mouse.movement;
                if (middle || keyboard?.isPressed('ShiftLeft') || keyboard?.isPressed('ShiftRight')) {
                    if (width && height) {
                        pan[0] -= dx / width * 2;
                        pan[1] += dy / height * 2;
                    }
                } else {
                    rotate[0] += dx;
                    rotate[1] += dy;
                }
            }
            input.zoom += mouse.wheel;
        }

        if (gestures) {
            const [dx, dy] = gestures.pan;
            if (gestures.count > 1) {
                if (width && height) {
                    pan[0] -= dx / width * 2;
                    pan[1] += dy / height * 2;
                }

                // pinch is positive while spreading, which zooms in
                input.zoom -= gestures.pinch * this.zoomPinchSens;
            } else {
                rotate[0] += dx;
                rotate[1] += dy;
            }
        }
    }

    /**
     * @param {InputSnapshot} snapshot - The snapshot.
     */
    step(snapshot) {
        const { rotate, pan, zoom } = /** @type {InputSnapshot['input']} */ (snapshot.input ?? {});
        const dist = this._targetChildPose.position.z;

        // pan in the view plane, scaled by the half size of the view at the focus distance
        if (this.enablePan) {
            const { fov, aspectRatio, horizontalFov, perspective, orthoHeight } = this.camera;
            let hx, hy;
            if (perspective) {
                const half = dist * Math.tan(0.5 * fov * math.DEG_TO_RAD);
                hx = horizontalFov ? half : half * aspectRatio;
                hy = horizontalFov ? half / aspectRatio : half;
            } else {
                hx = orthoHeight * aspectRatio;
                hy = orthoHeight;
            }
            offset.set(num(pan?.[0]) * hx, num(pan?.[1]) * hy, 0);
            rotation.setFromEulerAngles(this._targetRootPose.angles).transformVector(offset, offset);
            this._targetRootPose.move(offset);
        }

        // zoom
        this._targetChildPose.move(offset.set(0, 0, dist * num(zoom) * this.zoomSpeed));

        // rotate
        this._targetRootPose.rotate(angles.set(
            -num(rotate?.[1]) * this.rotateSpeed,
            -num(rotate?.[0]) * this.rotateSpeed,
            0
        ));
    }

    /**
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
        this._targetRootPose.set(pose.getFocus(dir), pose.angles, 0);
        this._targetChildPose.position.set(0, 0, pose.distance);

        if (!smooth) {
            this._rootPose.copy(this._targetRootPose);
            this._childPose.copy(this._targetChildPose);
        }
    }

    detach() {
        this._targetRootPose.copy(this._rootPose);
        this._targetChildPose.copy(this._childPose);
    }

    /**
     * @param {number} dt - The delta time in seconds.
     * @returns {Pose} The display pose.
     */
    update(dt) {
        this._rootPose.lerp(
            this._rootPose,
            this._targetRootPose,
            damp(this.moveDamping, dt),
            damp(this.rotateDamping, dt),
            1
        );
        this._childPose.lerp(
            this._childPose,
            this._targetChildPose,
            damp(this.zoomDamping, dt),
            1,
            1
        );

        rotation.setFromEulerAngles(this._rootPose.angles)
        .transformVector(this._childPose.position, offset)
        .add(this._rootPose.position);
        return this._pose.set(offset, this._rootPose.angles, this._childPose.position.z);
    }
}

export { OrbitController };
