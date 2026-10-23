import {
    math,
    FlyController,
    FocusController,
    GamePads,
    Gestures,
    InputFrame,
    Keyboard,
    Mouse,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_MIDDLE,
    MOUSEBUTTON_RIGHT,
    OrbitController,
    Pose,
    PROJECTION_PERSPECTIVE,
    Script,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent, InputController } from 'playcanvas' */

const tmpV1 = new Vec3();

const pose = new Pose();

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
     * @type {Keyboard}
     * @private
     */
    // @ts-ignore
    _keyboard;

    /**
     * @type {Mouse}
     * @private
     */
    // @ts-ignore
    _mouse;

    /**
     * @type {Gestures}
     * @private
     */
    _gestures = new Gestures(undefined, { layout: 'joystick-touch' });

    /**
     * The gamepads owned by the script, when the app has none.
     *
     * @type {GamePads|null}
     * @private
     */
    _gamepads = null;

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
     * @type {InputFrame}
     * @private
     */
    _orbitFrame = new InputFrame(OrbitController.fields);

    /**
     * @type {InputFrame}
     * @private
     */
    _flyFrame = new InputFrame(FlyController.fields);

    /**
     * The devices read by the active controller.
     *
     * @type {object}
     * @private
     */
    _devices = {};

    /**
     * The devices that interrupt a focus.
     *
     * @type {object}
     * @private
     */
    _focusDevices = {};

    /**
     * The devices that switch to fly mode.
     *
     * @type {object}
     * @private
     */
    _keyDevices = {};

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
        this._gestures.layout = layout;
    }

    get mobileInputLayout() {
        return this._gestures.layout;
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

        // devices
        const canvas = this.app.graphicsDevice.canvas;
        const keyboard = this._keyboard = new Keyboard(window);
        const mouse = this._mouse = new Mouse(canvas, { capture: true });
        const gestures = this._gestures;
        gestures.attach(canvas);
        if (!this.app.gamepads) {
            this._gamepads = new GamePads();
        }
        this._devices = { element: canvas, keyboard, mouse, gestures, gamepads: this.app.gamepads ?? this._gamepads };
        this._focusDevices = { element: canvas, keyboard, mouse };
        this._keyDevices = { keyboard };

        // expose ui events
        gestures.on('joystick:position:left', ([bx, by, sx, sy]) => {
            if (this._mode !== 'fly') {
                return;
            }
            this.app.fire(`${this.joystickEventName}:left`, bx, by, sx, sy);
        });
        gestures.on('joystick:position:right', ([bx, by, sx, sy]) => {
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
        this.on('state', this._discard, this);

        // destroy
        this.on('destroy', this._destroy, this);
    }

    /**
     * @private
     */
    _destroy() {
        this._keyboard.detach();
        this._mouse.detach();
        this._gestures.destroy();
        this._gamepads?.destroy();

        this._flyController.destroy();
        this._orbitController.destroy();
    }

    /**
     * Discards the input since the last update.
     *
     * @private
     */
    _discard() {
        this._orbitFrame.reset();
        this._flyFrame.reset();
        this._updateDevices();
    }

    /**
     * Clears the per-update device totals.
     *
     * @private
     */
    _updateDevices() {
        this._keyboard.update();
        this._mouse.update();
        this._gestures.update();
        this._gamepads?.update();
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

        const { _mouse: mouse, _orbitFrame: orbitFrame, _flyFrame: flyFrame } = this;
        const orbit = this._orbitController;
        const fly = this._flyController;

        // forward settings
        fly.moveSpeed = this.moveSpeed;
        fly.moveFastSpeed = this.moveFastSpeed;
        fly.moveSlowSpeed = this.moveSlowSpeed;
        fly.rotateSpeed = this.rotateSpeed;
        fly.rotateJoystickSens = this.rotateJoystickSens;
        fly.gamepadDeadZone[0] = this.gamepadDeadZone.x;
        fly.gamepadDeadZone[1] = this.gamepadDeadZone.y;
        orbit.rotateSpeed = this.rotateSpeed;
        orbit.zoomSpeed = this.zoomSpeed;
        orbit.zoomPinchSens = this.zoomPinchSens;
        orbit.enablePan = this.enablePan;

        // copy the projection used to scale panning
        const { camera } = orbit;
        camera.fov = this._camera.fov;
        camera.aspectRatio = this._camera.aspectRatio;
        camera.horizontalFov = this._camera.horizontalFov;
        camera.perspective = this._camera.projection === PROJECTION_PERSPECTIVE;
        camera.orthoHeight = this._camera.orthoHeight;

        // only movement keys switch to fly, so map the keyboard alone first
        fly.map(this._keyDevices, flyFrame);
        const [kx, ky, kz] = /** @type {number[]} */ (flyFrame.input.move);

        if (mouse.wasPressed(MOUSEBUTTON_LEFT) || mouse.wasPressed(MOUSEBUTTON_MIDDLE) || mouse.wheel !== 0) {
            // left mouse button, middle mouse button, mouse wheel
            this._setMode('orbit');
        } else if (mouse.wasPressed(MOUSEBUTTON_RIGHT) || kx || ky || kz) {
            // right mouse button or any movement
            this._setMode('fly');
        }

        // check if XR is active for frame discard
        if (this.app.xr?.active) {
            this._discard();
            return;
        }

        // check focus end, only mouse input interrupting it
        if (this._mode === 'focus') {
            orbit.map(this._focusDevices, orbitFrame);
            const { rotate, pan, zoom } = /** @type {{ rotate: number[], pan: number[], zoom: number }} */ (orbitFrame.input);
            const focusInterrupt = rotate[0] || rotate[1] || pan[0] || pan[1] || zoom;
            orbitFrame.reset();
            if (focusInterrupt || this._focusController.complete()) {
                this._setMode('orbit');
            }
        }

        // device totals are kept until the end, so mapping again reads the same input
        if (this._mode === 'orbit') {
            orbit.map(this._devices, orbitFrame);
            orbit.step(orbitFrame.capture(dt));
        } else if (this._mode === 'fly') {
            fly.map(this._devices, flyFrame);
            fly.step(flyFrame.capture(dt));
        }

        this._pose.copy(this._controller.update(dt));
        this._camera.entity.setPosition(this._pose.position);
        this._camera.entity.setEulerAngles(this._pose.angles);

        this._updateDevices();
    }
}

export { CameraControls };
