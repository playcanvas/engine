import {
    math,
    DualGestureSource,
    FlyController,
    FocusController,
    GamepadSource,
    InputFrame,
    KeyboardMouseSource,
    MultiTouchSource,
    OrbitController,
    Pose,
    PROJECTION_PERSPECTIVE,
    Quat,
    Script,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, InputController } from 'playcanvas' */

/**
 * @typedef {object} CameraControlsState
 * @property {Vec3} axis - The axis.
 * @property {number} shift - The shift.
 * @property {number} ctrl - The ctrl.
 * @property {number[]} mouse - The mouse.
 * @property {number} touches - The touches.
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpNear = new Vec3();
const tmpFar = new Vec3();
const tmpBefore = new Vec3();
const tmpAfter = new Vec3();
const tmpFocus = new Vec3();
const tmpPan = new Vec3();
const tmpRight = new Vec3();
const tmpForward = new Vec3();
const tmpYaw = new Quat();

const pose = new Pose();

const frame = new InputFrame({
    move: [0, 0, 0],
    rotate: [0, 0, 0]
});

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 * @ignore
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * @param {number[]} stick - The stick
 * @param {number} low - The low dead zone
 * @param {number} high - The high dead zone
 */
const applyDeadZone = (stick, low, high) => {
    const mag = Math.sqrt(stick[0] * stick[0] + stick[1] * stick[1]);
    if (mag < low) {
        stick.fill(0);
        return;
    }
    const scale = (mag - low) / (high - low);
    stick[0] *= scale / mag;
    stick[1] *= scale / mag;
};

/**
 * Converts screen space mouse deltas to world space pan vector.
 *
 * @param {CameraComponent} camera - The camera component.
 * @param {number} dx - The mouse delta x value.
 * @param {number} dy - The mouse delta y value.
 * @param {number} dz - The world space zoom delta value.
 * @param {Vec3} [out] - The output vector to store the pan result.
 * @returns {Vec3} - The pan vector in world space.
 * @private
 */
const screenToWorld = (camera, dx, dy, dz, out = new Vec3()) => {
    const { system, fov, aspectRatio, horizontalFov, projection, orthoHeight } = camera;
    const { width, height } = system.app.graphicsDevice.clientRect;

    // normalize deltas to device coord space
    out.set(
        -(dx / width) * 2,
        (dy / height) * 2,
        0
    );

    // calculate half size of the view frustum at the current distance
    const halfSize = tmpV2.set(0, 0, 0);
    if (projection === PROJECTION_PERSPECTIVE) {
        const halfSlice = dz * Math.tan(0.5 * fov * math.DEG_TO_RAD);
        if (horizontalFov) {
            halfSize.set(
                halfSlice,
                halfSlice / aspectRatio,
                0
            );
        } else {
            halfSize.set(
                halfSlice * aspectRatio,
                halfSlice,
                0
            );
        }
    } else {
        halfSize.set(
            orthoHeight * aspectRatio,
            orthoHeight,
            0
        );
    }

    // scale by device coord space
    out.mul(halfSize);

    return out;
};

/**
 * Finds the point on a horizontal plane under a screen position.
 *
 * @param {CameraComponent} camera - The camera component.
 * @param {number} x - The x screen position in CSS pixels.
 * @param {number} y - The y screen position in CSS pixels.
 * @param {number} height - The height of the plane.
 * @param {Vec3} out - The vector to receive the point.
 * @returns {Vec3 | null} The point, or null when the plane is not in view at the position.
 * @private
 */
const screenToPlane = (camera, x, y, height, out) => {
    const near = camera.screenToWorld(x, y, camera.nearClip, tmpNear);
    const far = camera.screenToWorld(x, y, camera.farClip, tmpFar);
    const t = (height - near.y) / (far.y - near.y);
    return t >= 0 && t <= 1 ? out.lerp(near, far, t) : null;
};

/**
 * Converts a mouse movement to the pan which keeps the point of a horizontal plane under the
 * cursor following it, as the distances to move to the right and forward, level with the plane.
 *
 * @param {CameraComponent} camera - The camera component.
 * @param {number} x - The x screen position of the cursor after the movement, in CSS pixels.
 * @param {number} y - The y screen position of the cursor after the movement, in CSS pixels.
 * @param {number} dx - The mouse delta x value.
 * @param {number} dy - The mouse delta y value.
 * @param {number} height - The height of the plane.
 * @param {number} yaw - The yaw of the view, in degrees.
 * @param {Vec3} out - The vector to receive the pan.
 * @returns {Vec3} The pan, which is zero when the plane is not in view under the cursor.
 * @private
 */
const screenToGroundPan = (camera, x, y, dx, dy, height, yaw, out) => {
    const before = screenToPlane(camera, x - dx, y - dy, height, tmpBefore);
    const after = screenToPlane(camera, x, y, height, tmpAfter);
    if (!before || !after) {
        return out.set(0, 0, 0);
    }

    // the view moves against the cursor, measured along the right and forward directions turned
    // by the yaw alone - the directions the orbit controller moves the focus point along. The
    // directions of the camera itself would flip once it looks past straight down
    before.sub(after);
    tmpYaw.setFromEulerAngles(0, yaw, 0);
    const right = tmpYaw.transformVector(Vec3.RIGHT, tmpRight);
    const forward = tmpYaw.transformVector(Vec3.FORWARD, tmpForward);
    return out.set(before.dot(right), before.dot(forward), 0);
};

/**
 * @enum {string}
 */
// eslint-disable-next-line no-unused-vars
const MobileInputLayout = {
    JOYSTICK_JOYSTICK: 'joystick-joystick',
    JOYSTICK_TOUCH: 'joystick-touch',
    TOUCH_JOYSTICK: 'touch-joystick',
    TOUCH_TOUCH: 'touch-touch'
};

/**
 * @enum {string}
 */
const MouseAction = {
    ORBIT: 'orbit',
    PAN: 'pan',
    LOOK: 'look',
    NONE: 'none'
};

const mouseActions = Object.values(MouseAction);

/**
 * Provides orbit, fly and pan camera controls, driven by mouse, touch and gamepad input. Movement
 * and rotation are smoothed with configurable damping, and pitch, yaw and zoom distance can be
 * constrained to ranges. Orbit and fly modes can be toggled individually with
 * {@link CameraControls#enableOrbit} and {@link CameraControls#enableFly}. Use
 * {@link CameraControls#focus}, {@link CameraControls#look} and {@link CameraControls#reset} to
 * frame a point of interest programmatically.
 *
 * Attach the script to an entity with a {@link CameraComponent}.
 *
 * @example
 * cameraEntity.addComponent('script');
 * cameraEntity.script.create(CameraControls, {
 *     properties: {
 *         focusPoint: new Vec3(0, 1, 0),
 *         enableFly: false
 *     }
 * });
 * @category Controllers
 */
class CameraControls extends Script {
    static scriptName = 'cameraControls';

    /**
     * @type {CameraComponent}
     * @private
     */
    // @ts-ignore
    _camera;

    /**
     * @type {boolean}
     * @private
     */
    _enableOrbit = true;

    /**
     * @type {boolean}
     * @private
     */
    _enableFly = true;

    /**
     * @type {number}
     * @private
     */
    _startZoomDist = 0;

    /**
     * @type {Vec2}
     * @private
     */
    _pitchRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _yawRange = new Vec2(-360, 360);

    /**
     * @type {Vec2}
     * @private
     */
    _zoomRange = new Vec2(0.01, 0);

    /**
     * @type {KeyboardMouseSource}
     * @private
     */
    _desktopInput = new KeyboardMouseSource();

    /**
     * @type {MultiTouchSource}
     * @private
     */
    _orbitMobileInput = new MultiTouchSource();

    /**
     * @type {DualGestureSource}
     * @private
     */
    _flyMobileInput = new DualGestureSource();

    /**
     * @type {GamepadSource}
     * @private
     */
    _gamepadInput = new GamepadSource();

    /**
     * @type {FlyController}
     * @private
     */
    _flyController = new FlyController();

    /**
     * @type {OrbitController}
     * @private
     */
    _orbitController = new OrbitController();

    /**
     * @type {FocusController}
     * @private
     */
    _focusController = new FocusController();

    /**
     * @type {InputController}
     * @private
     */
    // @ts-ignore
    _controller;

    /**
     * @type {Pose}
     * @private
     */
    _pose = new Pose();

    /**
     * @type {'orbit' | 'fly' | 'focus'}
     * @private
     */
    // @ts-ignore
    _mode;

    /**
     * The action of each mouse button, by button index: left, middle and right.
     *
     * @type {MouseAction[]}
     * @private
     */
    _buttonActions = ['orbit', 'pan', 'look'];

    /**
     * The index of the mouse button the mouse movement follows, which is the last one pressed
     * until the frame after its release, or -1.
     *
     * @type {number}
     * @private
     */
    _activeButton = -1;

    /**
     * The index of the mouse button pressed since the last update, or -1. It is taken from the
     * press itself, as the button deltas of a press and a release between two updates cancel out,
     * while the movement of the drag in between is still to be applied.
     *
     * @type {number}
     * @private
     */
    _pressedButton = -1;

    /**
     * @type {boolean}
     * @private
     */
    _groundPan = false;

    /**
     * The position of the cursor on the canvas, in CSS pixels.
     *
     * @type {Vec2}
     * @private
     */
    _pointer = new Vec2();

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onPointer = (event) => {
        this._pointer.set(event.offsetX, event.offsetY);
        if (event.type === 'pointerdown' && event.pointerType === 'mouse' &&
            event.button >= 0 && event.button < this._buttonActions.length) {

            // the movement since the last update belongs to the drag before this press. An update
            // applies one action, so the movement is dropped when that drag had another action,
            // rather than applied by the action of this button
            const owner = this._pressedButton >= 0 ? this._pressedButton : this._activeButton;
            if (owner >= 0 && this._buttonActions[owner] !== this._buttonActions[event.button]) {
                this._desktopInput.deltas.mouse.read();
            }
            this._pressedButton = event.button;
        }
    };

    /**
     * @type {CameraControlsState}
     * @private
     */
    _state = {
        axis: new Vec3(),
        shift: 0,
        ctrl: 0,
        mouse: [0, 0, 0],
        touches: 0
    };

    /**
     * Enable fly camera controls.
     *
     * @attribute
     * @title Enable Fly
     * @type {boolean}
     * @default true
     */
    set enableFly(enable) {
        this._enableFly = enable;

        if (!this._enableFly && this._mode === 'fly') {
            this._setMode('orbit');
        }
    }

    get enableFly() {
        return this._enableFly;
    }

    /**
     * Enable orbit camera controls.
     *
     * @attribute
     * @title Enable Orbit
     * @type {boolean}
     * @default true
     */
    set enableOrbit(enable) {
        this._enableOrbit = enable;

        if (!this._enableOrbit && this._mode === 'orbit') {
            this._setMode('fly');
        }
    }

    get enableOrbit() {
        return this._enableOrbit;
    }

    /**
     * Enable panning.
     *
     * @attribute
     * @title Enable Panning
     * @type {boolean}
     */
    enablePan = true;

    /**
     * The focus damping. A higher value means more damping. A value of 0 means no damping.
     * The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Focus Damping
     * @type {number}
     * @default 0.98
     */
    set focusDamping(damping) {
        this._focusController.focusDamping = damping;
    }

    get focusDamping() {
        return this._focusController.focusDamping;
    }

    /**
     * The focus point.
     *
     * @attribute
     * @title Focus Point
     * @type {Vec3}
     * @default [0, 0, 0]
     */
    set focusPoint(point) {
        const position = this._camera.entity.getPosition();
        this._startZoomDist = position.distance(point);
        this._controller.attach(this._pose.look(position, point), false);
    }

    get focusPoint() {
        return this._pose.getFocus(tmpV1);
    }

    /**
     * The move damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the fly mode and the orbit mode when panning.
     *
     * @attribute
     * @title Move Damping
     * @type {number}
     * @default 0.98
     */
    set moveDamping(damping) {
        this._flyController.moveDamping = damping;
    }

    get moveDamping() {
        return this._flyController.moveDamping;
    }

    /**
     * The fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Speed
     * @type {number}
     */
    moveSpeed = 10;

    /**
     * The fast fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Fast Speed
     * @type {number}
     */
    moveFastSpeed = 20;

    /**
     * The slow fly move speed relative to the scene size.
     *
     * @attribute
     * @title Move Slow Speed
     * @type {number}
     */
    moveSlowSpeed = 5;

    /**
     * The rotate damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to both the fly and orbit modes.
     *
     * @attribute
     * @title Rotate Damping
     * @type {number}
     * @default 0.98
     */
    set rotateDamping(damping) {
        this._flyController.rotateDamping = damping;
        this._orbitController.rotateDamping = damping;
    }

    get rotateDamping() {
        return this._orbitController.rotateDamping;
    }

    /**
     * The rotation speed.
     *
     * @attribute
     * @title Rotate Speed
     * @type {number}
     */
    rotateSpeed = 0.2;

    /**
     * The rotation joystick sensitivity.
     *
     * @attribute
     * @title Rotate Joystick Sensitivity
     * @type {number}
     */
    rotateJoystickSens = 2;

    /**
     * The zoom damping. In the range 0 to 1, where a value of 0 means no damping and 1 means full
     * damping. The damping is applied to the orbit mode.
     *
     * @attribute
     * @title Zoom Damping
     * @type {number}
     * @default 0.98
     */
    set zoomDamping(damping) {
        this._orbitController.zoomDamping = damping;
    }

    get zoomDamping() {
        return this._orbitController.zoomDamping;
    }

    /**
     * The touch zoom pinch sensitivity.
     *
     * @attribute
     * @title Zoom
     * @type {number}
     */
    zoomPinchSens = 5;

    /**
     * The zoom range.
     *
     * @attribute
     * @title Zoom Range
     * @type {Vec2}
     * @default [0.01, 0]
     */
    set zoomRange(range) {
        this._zoomRange.x = range.x;
        this._zoomRange.y = range.y <= range.x ? Infinity : range.y;
        this._orbitController.zoomRange = this._zoomRange;
    }

    get zoomRange() {
        return this._zoomRange;
    }

    /**
     * The zoom speed relative to the scene size.
     *
     * @attribute
     * @title Zoom Speed
     * @type {number}
     */
    zoomSpeed = 0.001;

    /**
     * The pitch range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Pitch Range
     * @type {Vec2}
     * @default [-360, 360]
     */
    set pitchRange(range) {
        this._pitchRange.x = math.clamp(range.x, -360, 360);
        this._pitchRange.y = math.clamp(range.y, -360, 360);
        this._flyController.pitchRange = this._pitchRange;
        this._orbitController.pitchRange = this._pitchRange;
    }

    get pitchRange() {
        return this._pitchRange;
    }

    /**
     * The yaw range. In the range -360 to 360 degrees. The pitch range is applied to the fly mode
     * and the orbit mode.
     *
     * @attribute
     * @title Yaw Range
     * @type {Vec2}
     * @default [-360, 360]
     */
    set yawRange(range) {
        this._yawRange.x = math.clamp(range.x, -360, 360);
        this._yawRange.y = math.clamp(range.y, -360, 360);
        this._flyController.yawRange = this._yawRange;
        this._orbitController.yawRange = this._yawRange;
    }

    get yawRange() {
        return this._yawRange;
    }

    /**
     * The joystick event name for the UI position for the base and stick elements.
     * The event name is appended with the side: 'left' or 'right'.
     *
     * @attribute
     * @title Joystick Base Event Name
     * @type {string}
     */
    joystickEventName = 'joystick';

    /**
     * The layout of the mobile input. The layout can be one of the following:
     *
     * - `joystick-joystick`: Two virtual joysticks.
     * - `joystick-touch`: One virtual joystick and one touch.
     * - `touch-joystick`: One touch and one virtual joystick.
     * - `touch-touch`: Two touches.
     *
     * Default is `joystick-touch`.
     *
     * @attribute
     * @title Use Virtual Gamepad
     * @type {MobileInputLayout}
     * @default joystick-touch
     */
    set mobileInputLayout(layout) {
        if (!/(?:joystick|touch)-(?:joystick|touch)/.test(layout)) {
            console.warn(`CameraControls: invalid mobile input layout: ${layout}`);
            return;
        }
        this._flyMobileInput.layout = layout;
    }

    get mobileInputLayout() {
        return this._flyMobileInput.layout;
    }

    /**
     * The action of the left mouse button. The action can be one of the following:
     *
     * - `orbit`: Turns the view around the focus point, or pans it while shift is held.
     * - `pan`: Pans the view, see {@link CameraControls#groundPan}.
     * - `look`: Turns the view in place, as when flying with the keys.
     * - `none`: Ignores the button, leaving it to the application.
     *
     * Default is `orbit`.
     *
     * @attribute
     * @title Left Button
     * @type {MouseAction}
     * @default orbit
     */
    set leftButton(action) {
        this._setButtonAction(0, action);
    }

    get leftButton() {
        return this._buttonActions[0];
    }

    /**
     * The action of the middle mouse button, one of the actions listed for
     * {@link CameraControls#leftButton}. Default is `pan`.
     *
     * @attribute
     * @title Middle Button
     * @type {MouseAction}
     * @default pan
     */
    set middleButton(action) {
        this._setButtonAction(1, action);
    }

    get middleButton() {
        return this._buttonActions[1];
    }

    /**
     * The action of the right mouse button, one of the actions listed for
     * {@link CameraControls#leftButton}. Default is `look`.
     *
     * @attribute
     * @title Right Button
     * @type {MouseAction}
     * @default look
     */
    set rightButton(action) {
        this._setButtonAction(2, action);
    }

    get rightButton() {
        return this._buttonActions[2];
    }

    /**
     * Whether panning moves across the ground instead of the plane of the view. A mouse drag then
     * holds the point of the ground under the cursor, as when dragging a map, and the view keeps
     * its height. The ground is the horizontal plane at the height of the focus point. Panning
     * with two touches moves across the ground too. Default is false.
     *
     * @attribute
     * @title Ground Pan
     * @type {boolean}
     * @default false
     */
    set groundPan(enable) {
        this._groundPan = enable;
        this._orbitController.horizontalPan = enable;
    }

    get groundPan() {
        return this._groundPan;
    }

    /**
     * The gamepad dead zone.
     *
     * @attribute
     * @title Gamepad Dead Zone
     * @type {Vec2}
     */
    gamepadDeadZone = new Vec2(0.3, 0.6);

    constructor({ app, entity, ...args }) {
        super({ app, entity, ...args });
        if (!this.entity.camera) {
            console.error('CameraControls: camera component not found');
            return;
        }
        this._camera = this.entity.camera;

        // set orbit controller defaults
        this._orbitController.zoomRange = new Vec2(0.01, Infinity);

        // attach input. The position of the cursor is tracked for the ground pan, which holds the
        // ground under it
        const canvas = this.app.graphicsDevice.canvas;
        canvas.addEventListener('pointerdown', this._onPointer);
        canvas.addEventListener('pointermove', this._onPointer);
        this._desktopInput.attach(this.app.graphicsDevice.canvas);
        this._orbitMobileInput.attach(this.app.graphicsDevice.canvas);
        this._flyMobileInput.attach(this.app.graphicsDevice.canvas);
        this._gamepadInput.attach(this.app.graphicsDevice.canvas);

        // expose ui events
        this._flyMobileInput.on('joystick:position:left', ([bx, by, sx, sy]) => {
            if (this._mode !== 'fly') {
                return;
            }
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        this._flyMobileInput.on('joystick:position:right', ([bx, by, sx, sy]) => {
            if (this._mode !== 'fly') {
                return;
            }
            this.app.fire(`${this.joystickEventName}:right`, bx, by, sx, sy);
        });

        // pose
        this._pose.look(this._camera.entity.getPosition(), Vec3.ZERO);

        // mode
        this._setMode('orbit');

        // state
        this.on('state', () => {
            // discard inputs
            this._activeButton = -1;
            this._pressedButton = -1;
            this._desktopInput.read();
            this._orbitMobileInput.read();
            this._flyMobileInput.read();
            this._gamepadInput.read();
        });

        // destroy
        this.on('destroy', this._destroy, this);
    }

    /**
     * @private
     */
    _destroy() {
        const canvas = this.app.graphicsDevice.canvas;
        canvas.removeEventListener('pointerdown', this._onPointer);
        canvas.removeEventListener('pointermove', this._onPointer);

        this._desktopInput.destroy();
        this._orbitMobileInput.destroy();
        this._flyMobileInput.destroy();
        this._gamepadInput.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();
    }

    /**
     * @param {number} button - The index of the mouse button.
     * @param {MouseAction} action - The action to set.
     * @private
     */
    _setButtonAction(button, action) {
        if (!mouseActions.includes(action)) {
            console.warn(`CameraControls: invalid mouse button action: ${action}`);
            return;
        }
        this._buttonActions[button] = action;
    }

    /**
     * Appends the pan and the rotation of a mouse movement, by the action of the button which
     * made it.
     *
     * @param {MouseAction} action - The action of the button.
     * @param {Vec2} pointer - The position of the cursor at the end of the movement, in CSS pixels.
     * @param {number} dx - The mouse delta x value.
     * @param {number} dy - The mouse delta y value.
     * @param {number} orbit - 1 in the orbit mode, otherwise 0.
     * @private
     */
    _appendMouseMove(action, pointer, dx, dy, orbit) {
        // a button ignored by the camera leaves its mouse movement to the application. Panning
        // follows the pan action, or shift with any other
        const follow = +(action !== 'none');
        const pan = +(action === 'pan' || (this._state.shift && follow));

        const panMove = this._groundPan ?
            screenToGroundPan(this._camera, pointer.x, pointer.y, dx, dy,
                this._pose.getFocus(tmpFocus).y, this._pose.angles.y, tmpPan) :
            screenToWorld(this._camera, dx, dy, this._pose.distance, tmpPan);
        panMove.mulScalar(orbit * pan * +this.enablePan);
        frame.deltas.move.append([panMove.x, panMove.y, panMove.z]);

        const rotate = follow * (1 - orbit * pan) * this.rotateSpeed;
        frame.deltas.rotate.append([dx * rotate, dy * rotate, 0]);
    }

    /**
     * @param {'orbit' | 'fly' | 'focus'} mode - The mode to set.
     * @private
     */
    _setMode(mode) {
        // override mode depending on enabled features
        switch (true) {
            case this.enableFly && !this.enableOrbit: {
                mode = 'fly';
                break;
            }
            case !this.enableFly && this.enableOrbit: {
                mode = 'orbit';
                break;
            }
            case !this.enableFly && !this.enableOrbit: {
                console.warn('CameraControls: both fly and orbit modes are disabled');
                return;
            }
        }

        // check if mode is the same
        if (this._mode === mode) {
            return;
        }
        this._mode = mode;

        // detach old controller
        if (this._controller) {
            this._controller.detach();
        }

        // attach new controller
        switch (this._mode) {
            case 'orbit': {
                this._controller = this._orbitController;
                break;
            }
            case 'fly': {
                this._controller = this._flyController;
                break;
            }
            case 'focus': {
                this._controller = this._focusController;
                break;
            }
        }
        this._controller.attach(this._pose, false);
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    focus(focus, resetZoom = false) {
        this._setMode('focus');
        const zoomDist = resetZoom ?
            this._startZoomDist : this._camera.entity.getPosition().distance(focus);
        const position = tmpV1.copy(this._camera.entity.forward)
        .mulScalar(-zoomDist)
        .add(focus);
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {boolean} [resetZoom] - Whether to reset the zoom.
     */
    look(focus, resetZoom = false) {
        this._setMode('focus');
        const position = resetZoom ?
            tmpV1.copy(this._camera.entity.getPosition())
            .sub(focus)
            .normalize()
            .mulScalar(this._startZoomDist)
            .add(focus) : this._camera.entity.getPosition();
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * @param {Vec3} focus - The focus point.
     * @param {Vec3} position - The start point.
     */
    reset(focus, position) {
        this._setMode('focus');
        this._controller.attach(pose.look(position, focus));
    }

    /**
     * @param {number} dt - The time delta.
     */
    update(dt) {
        dt = Math.min(dt, 0.1);
        const { keyCode } = KeyboardMouseSource;

        const { key, button, mouse, wheel } = this._desktopInput.read();
        const { touch, pinch, count } = this._orbitMobileInput.read();
        const { leftInput, rightInput } = this._flyMobileInput.read();
        const { leftStick, rightStick } = this._gamepadInput.read();

        // apply dead zone to gamepad sticks
        applyDeadZone(leftStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);
        applyDeadZone(rightStick, this.gamepadDeadZone.x, this.gamepadDeadZone.y);

        // update state
        this._state.axis.add(tmpV1.set(
            (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]),
            (key[keyCode.E] - key[keyCode.Q]),
            (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN])
        ));
        for (let i = 0; i < this._state.mouse.length; i++) {
            this._state.mouse[i] += button[i];
        }
        this._state.shift += key[keyCode.SHIFT];
        this._state.ctrl += key[keyCode.CTRL];
        this._state.touches += count[0];

        // a pressed button starts the mode of its action, and the mouse movement follows the
        // action of the last button pressed
        const pressedButton = this._pressedButton;
        this._pressedButton = -1;
        if (pressedButton >= 0) {
            this._activeButton = pressedButton;
        }
        const pressed = pressedButton >= 0 ? this._buttonActions[pressedButton] : 'none';
        const action = this._activeButton >= 0 ? this._buttonActions[this._activeButton] : 'none';

        if (wheel[0] !== 0 || pressed === 'orbit' || pressed === 'pan') {
            // mouse wheel, or a button which orbits or pans
            this._setMode('orbit');
        } else if (pressed === 'look' || this._state.axis.length() > 0) {
            // a button which looks, or any movement
            this._setMode('fly');
        }

        const orbit = +(this._mode === 'orbit');
        const fly = +(this._mode === 'fly');
        const double = +(this._state.touches > 1);
        const mobileJoystick = +(this._flyMobileInput.layout.endsWith('joystick'));

        // rate-based multipliers (keyboard, gamepad, virtual joystick)
        const moveMult = (this._state.shift ? this.moveFastSpeed : this._state.ctrl ?
            this.moveSlowSpeed : this.moveSpeed) * dt;
        const rotateJoystickMult = this.rotateSpeed * this.rotateJoystickSens * 60 * dt;

        // delta-based multipliers (mouse, touch, wheel)
        const rotateDeltaMult = this.rotateSpeed;
        const zoomDeltaMult = this.zoomSpeed;
        const zoomTouchDeltaMult = this.zoomSpeed * this.zoomPinchSens;

        const { deltas } = frame;

        // desktop move
        const v = tmpV1.set(0, 0, 0);
        const keyMove = this._state.axis.clone().normalize();
        v.add(keyMove.mulScalar(fly * moveMult));
        const wheelMove = tmpV2.set(0, 0, wheel[0]);
        v.add(wheelMove.mulScalar(orbit * zoomDeltaMult));
        deltas.move.append([v.x, v.y, v.z]);

        // desktop mouse
        this._appendMouseMove(action, this._pointer, mouse[0], mouse[1], orbit);

        // the movement of the button has been applied, until it is released
        if (this._activeButton >= 0 && this._state.mouse[this._activeButton] <= 0) {
            this._activeButton = -1;
        }

        // mobile move
        v.set(0, 0, 0);
        const flyMove = tmpV2.set(leftInput[0], 0, -leftInput[1]);
        v.add(flyMove.mulScalar(fly * moveMult));
        const orbitMove = screenToWorld(this._camera, touch[0], touch[1], this._pose.distance);
        v.add(orbitMove.mulScalar(orbit * double * +this.enablePan));
        const pinchMove = tmpV2.set(0, 0, pinch[0]);
        v.add(pinchMove.mulScalar(orbit * double * zoomTouchDeltaMult));
        deltas.move.append([v.x, v.y, v.z]);

        // mobile rotate
        v.set(0, 0, 0);
        const orbitRotate = tmpV2.set(touch[0], touch[1], 0);
        v.add(orbitRotate.mulScalar(orbit * (1 - double) * rotateDeltaMult));
        const flyRotate = tmpV2.set(rightInput[0], rightInput[1], 0);
        v.add(flyRotate.mulScalar(fly * (mobileJoystick ? rotateJoystickMult : rotateDeltaMult)));
        deltas.rotate.append([v.x, v.y, v.z]);

        // gamepad move
        v.set(0, 0, 0);
        const stickMove = tmpV2.set(leftStick[0], 0, -leftStick[1]);
        v.add(stickMove.mulScalar(fly * moveMult));
        deltas.move.append([v.x, v.y, v.z]);

        // gamepad rotate
        v.set(0, 0, 0);
        const stickRotate = tmpV2.set(rightStick[0], rightStick[1], 0);
        v.add(stickRotate.mulScalar(fly * rotateJoystickMult));
        deltas.rotate.append([v.x, v.y, v.z]);

        // check if XR is active for frame discard
        if (this.app.xr?.active) {
            frame.read();
            return;
        }

        // check focus end
        if (this._mode === 'focus') {
            const focusInterrupt = deltas.move.length() + deltas.rotate.length() > 0;
            const focusComplete = this._focusController.complete();
            if (focusInterrupt || focusComplete) {
                this._setMode('orbit');
            }
        }

        // update controller by consuming frame
        this._pose.copy(this._controller.update(frame, dt));
        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);
    }
}

export { CameraControls };
