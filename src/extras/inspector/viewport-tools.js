import { Vec3 } from '../../core/math/vec3.js';
import { Entity } from '../../framework/entity.js';
import { Picker } from '../../framework/graphics/picker.js';
import {
    PROJECTION_ORTHOGRAPHIC, RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME, SHADERPASS_ALBEDO, SHADERPASS_AO, SHADERPASS_EMISSION,
    SHADERPASS_FORWARD, SHADERPASS_GLOSS, SHADERPASS_LIGHTING, SHADERPASS_METALNESS, SHADERPASS_OPACITY,
    SHADERPASS_SPECULARITY, SHADERPASS_UV0, SHADERPASS_WORLDNORMAL
} from '../../scene/constants.js';
import { FlyController } from '../input/controllers/fly-controller.js';
import { InputFrame } from '../input/input.js';
import { Pose } from '../input/pose.js';

import { collectMeshInstances } from './instance-survey.js';

/** @import { Quat } from '../../core/math/quat.js' */
/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { CameraComponent } from '../../framework/components/camera/component.js' */
/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { MeshInstance } from '../../scene/mesh-instance.js' */

/**
 * The shader passes a camera can render with, as the editor offers them: the lit scene, and the
 * debug views of the standard material's inputs.
 */
const RENDER_MODES = [
    [SHADERPASS_FORWARD, 'standard'], [SHADERPASS_ALBEDO, 'albedo'], [SHADERPASS_OPACITY, 'opacity'],
    [SHADERPASS_WORLDNORMAL, 'world normal'], [SHADERPASS_SPECULARITY, 'specularity'], [SHADERPASS_GLOSS, 'gloss'],
    [SHADERPASS_METALNESS, 'metalness'], [SHADERPASS_AO, 'ao'], [SHADERPASS_EMISSION, 'emission'],
    [SHADERPASS_LIGHTING, 'lighting'], [SHADERPASS_UV0, 'uv0']
];

// the input events the pick and fly modes take ahead of the app while they are on
const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu', 'touchstart', 'touchmove', 'touchend'];

/**
 * @param {Event} e - An event.
 * @returns {boolean} Whether it is aimed at a text field, which keeps its keys.
 */
function isTextTarget(e) {
    const target = /** @type {HTMLElement|undefined} */ (e.composedPath?.()[0]);
    return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
}

/**
 * @param {CameraComponent} camera - A camera.
 * @returns {boolean} Whether it draws to the screen, the ones a pointer can be over.
 */
function isScreenCamera(camera) {
    return camera.enabled && camera.entity.enabled && !camera.renderTarget;
}

/**
 * The screen camera whose viewport holds a point of the canvas, the last one drawn when several
 * overlap, which is the one on top.
 *
 * @param {AppBase} app - The app.
 * @param {number} x - The point, as a fraction of the canvas width from its left edge.
 * @param {number} y - The point, as a fraction of the canvas height from its top edge.
 * @returns {CameraComponent|null} The camera, or null when no camera draws there.
 */
function screenCameraAt(app, x, y) {
    const cameras = /** @type {CameraComponent[]} */ (app.systems.camera?.cameras ?? []);
    let found = null;
    for (const camera of cameras) {
        if (!isScreenCamera(camera)) continue;
        // a camera rect has its origin at the bottom left
        const rect = camera.rect;
        const up = 1 - y;
        if (x >= rect.x && x <= rect.x + rect.z && up >= rect.y && up <= rect.y + rect.w) found = camera;
    }
    return found;
}

/**
 * @param {GraphNode|null} node - A node.
 * @returns {Entity|null} The node, or the closest entity above it: the node of a mesh instance an
 * imported model creates can be a plain graph node.
 */
function entityOf(node) {
    let current = node;
    while (current && !(current instanceof Entity)) current = current.parent;
    return /** @type {Entity|null} */ (current);
}

/**
 * Takes the pointer events on the canvas ahead of the app's own handlers, for a mode of the
 * inspector that uses the pointer itself. The listeners sit in the capture phase on the window, so
 * they run before any listener of the app, and stop the events there.
 */
class CanvasCapture {
    /** @type {HTMLCanvasElement} */
    canvas;

    /** @type {(e: Event) => void} */
    _listener;

    /**
     * @param {HTMLCanvasElement} canvas - The canvas.
     * @param {(e: Event) => void} onEvent - Called with every pointer event on the canvas.
     */
    constructor(canvas, onEvent) {
        this.canvas = canvas;
        this._listener = (e) => {
            // a drag started on the canvas keeps its moves and release when the pointer leaves it
            if (e.target !== canvas && !(this._dragging && (e.type.endsWith('move') || e.type.endsWith('up')))) return;
            if (e.type === 'pointerdown' || e.type === 'mousedown') this._dragging = true;
            if (e.type === 'pointerup' || e.type === 'mouseup') this._dragging = false;
            e.stopImmediatePropagation();
            if (e.cancelable) e.preventDefault();
            onEvent(e);
        };
        this._dragging = false;
        for (const type of POINTER_EVENTS) window.addEventListener(type, this._listener, { capture: true, passive: false });
    }

    destroy() {
        for (const type of POINTER_EVENTS) window.removeEventListener(type, this._listener, { capture: true });
    }
}

/**
 * Picks the entity under the pointer, through the screen camera whose viewport holds it, the way
 * the editor picks: an id buffer the size of the canvas is rendered for that camera, which draws
 * into its own viewport of it, and read back under the pointer.
 */
class ViewportPicker {
    /** @type {AppBase} */
    app;

    /** @type {Picker|null} */
    _picker = null;

    /**
     * The picks in flight, one after the other, as each reads back the id buffer the next renders.
     *
     * @type {Promise<*>}
     */
    _queue = Promise.resolve();

    /**
     * @param {AppBase} app - The app.
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * @param {number} clientX - The pointer, in client pixels.
     * @param {number} clientY - The pointer, in client pixels.
     * @returns {Promise<{ entity: Entity, instance: MeshInstance, camera: CameraComponent }|null>} What
     * is under the pointer, or null for nothing. Picks run one after the other.
     */
    pick(clientX, clientY) {
        const result = this._queue.then(() => this._pickNow(clientX, clientY));
        this._queue = result.catch(() => null);
        return result;
    }

    /**
     * @param {number} clientX - The pointer, in client pixels.
     * @param {number} clientY - The pointer, in client pixels.
     * @returns {Promise<{ entity: Entity, instance: MeshInstance, camera: CameraComponent }|null>} What
     * is under the pointer.
     * @private
     */
    async _pickNow(clientX, clientY) {
        if (!this._picker && this._destroyed) return null;
        const device = this.app.graphicsDevice;
        const canvas = /** @type {HTMLCanvasElement} */ (device.canvas);
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        const fx = (clientX - bounds.left) / bounds.width;
        const fy = (clientY - bounds.top) / bounds.height;
        const camera = screenCameraAt(this.app, fx, fy);
        if (!camera) return null;

        this._picker ??= new Picker(this.app, device.width, device.height);
        if (this._picker.width !== device.width || this._picker.height !== device.height) {
            this._picker.resize(device.width, device.height);
        }
        this._picker.prepare(camera, this.app.scene);

        const [hit] = await this._picker.getSelectionAsync(Math.floor(fx * device.width), Math.floor(fy * device.height));
        const node = /** @type {any} */ (hit)?.node ?? /** @type {any} */ (hit)?.entity ?? null;
        const entity = entityOf(node);
        return entity ? { entity, instance: /** @type {MeshInstance} */ (hit), camera } : null;
    }

    destroy() {
        this._destroyed = true;
        this._picker?.destroy();
        this._picker = null;
    }
}

const _position = new Vec3();
const _target = new Vec3();

// fly speeds: units a second, and degrees of turn per pixel dragged
const FLY_SPEED = 5;
const FLY_FAST = 4;
const LOOK_SPEED = 0.2;

// an orthographic view pans by this share of its height a second, and zooms by this rate
const ORTHO_PAN = 0.5;
const ORTHO_ZOOM = 1;

// the keys that fly, as offsets along right, up and forward
const FLY_KEYS = {
    KeyW: [0, 0, 1],
    ArrowUp: [0, 0, 1],
    KeyS: [0, 0, -1],
    ArrowDown: [0, 0, -1],
    KeyA: [-1, 0, 0],
    ArrowLeft: [-1, 0, 0],
    KeyD: [1, 0, 0],
    ArrowRight: [1, 0, 0],
    KeyE: [0, 1, 0],
    PageUp: [0, 1, 0],
    KeyQ: [0, -1, 0],
    PageDown: [0, -1, 0]
};

/**
 * Flies a camera the app keeps drawing with. The app may move the camera itself, from a script
 * or from code of its own, so the camera is not taken over: its transform is swapped for the flown
 * one on the app's prerender event, after every update has run, and put back on postrender, so
 * the frame is drawn from the flown pose while the app keeps seeing and moving its own. Its
 * projection is held the same way, at the field of view or orthographic height it had when the
 * flight started, as an app may animate those too. Leaving fly mode needs no restoring. An
 * orthographic view shows no movement along its direction, so there forward and back zoom instead,
 * and panning scales with the height of the view. The keyboard and the pointer on the canvas are taken ahead of the
 * app while flying, and the flight runs on the wall clock, so a paused app can be flown through.
 */
class CameraFly {
    /** @type {AppBase} */
    app;

    /** @type {CameraComponent} */
    camera;

    /** Units a second, changed with the wheel. */
    speed = FLY_SPEED;

    /** @type {FlyController} */
    _controller = new FlyController();

    /** @type {InputFrame<{ move: number[], rotate: number[] }>} */
    _frame = new InputFrame({ move: [0, 0, 0], rotate: [0, 0] });

    /** @type {Pose} */
    _pose = new Pose();

    /** @type {Set<string>} */
    _keys = new Set();

    _fast = false;

    _looking = false;

    _lastX = 0;

    _lastY = 0;

    _lastTime = 0;

    /** @type {{ position: Vec3, rotation: Quat, fov: number, orthoHeight: number }|null} */
    _saved = null;

    /** Whether the camera is orthographic, which zooms rather than moving forward. */
    _ortho = false;

    /** The field of view the flown view keeps. */
    _fov = 0;

    /** The orthographic height the flown view keeps, changed by zooming. */
    _orthoHeight = 0;

    /** @type {CanvasCapture} */
    _capture;

    /**
     * @param {AppBase} app - The app.
     * @param {CameraComponent} camera - The camera to fly.
     * @param {() => void} onEnd - Called when the flight ends from the keyboard.
     */
    constructor(app, camera, onEnd) {
        this.app = app;
        this.camera = camera;
        this._onEnd = onEnd;

        // start where the camera is, looking where it looks
        const entity = camera.entity;
        _position.copy(entity.getPosition());
        _target.copy(entity.forward).add(_position);
        this._pose.look(_position, _target);
        this._controller.attach(this._pose, false);
        this._ortho = camera.projection === PROJECTION_ORTHOGRAPHIC;
        this._fov = camera.fov;
        this._orthoHeight = camera.orthoHeight;
        this._controller.moveDamping = 0.9;
        this._controller.rotateDamping = 0.8;

        this._capture = new CanvasCapture(/** @type {HTMLCanvasElement} */ (app.graphicsDevice.canvas), this._onPointer);
        window.addEventListener('keydown', this._onKeyDown, true);
        window.addEventListener('keyup', this._onKeyUp, true);
        window.addEventListener('blur', this._onBlur);
        app.on('prerender', this._onPrerender, this);
        app.on('postrender', this._onPostrender, this);
        this._lastTime = performance.now();
    }

    destroy() {
        this.app.off('prerender', this._onPrerender, this);
        this.app.off('postrender', this._onPostrender, this);
        window.removeEventListener('keydown', this._onKeyDown, true);
        window.removeEventListener('keyup', this._onKeyUp, true);
        window.removeEventListener('blur', this._onBlur);
        this._capture.destroy();
        this._onPostrender();
    }

    /** @param {Event} e - A pointer event on the canvas. */
    _onPointer = (e) => {
        const pointer = /** @type {PointerEvent} */ (e);
        if (e.type === 'pointerdown') {
            this._looking = true;
            this._lastX = pointer.clientX;
            this._lastY = pointer.clientY;
        } else if (e.type === 'pointerup') {
            this._looking = false;
        } else if (e.type === 'pointermove' && this._looking) {
            this._frame.deltas.rotate.append([(pointer.clientX - this._lastX) * LOOK_SPEED, (pointer.clientY - this._lastY) * LOOK_SPEED]);
            this._lastX = pointer.clientX;
            this._lastY = pointer.clientY;
        } else if (e.type === 'wheel') {
            const wheel = /** @type {WheelEvent} */ (e);
            this.speed = Math.min(1000, Math.max(0.05, this.speed * (wheel.deltaY < 0 ? 1.2 : 1 / 1.2)));
        }
    };

    /** @param {KeyboardEvent} e - The event. */
    _onKeyDown = (e) => {
        if (isTextTarget(e)) return;
        if (e.key === 'Escape') {
            e.stopImmediatePropagation();
            this._onEnd();
            return;
        }
        this._fast = e.shiftKey;
        if (FLY_KEYS[e.code] && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.stopImmediatePropagation();
            e.preventDefault();
            this._keys.add(e.code);
        }
    };

    /** @param {KeyboardEvent} e - The event. */
    _onKeyUp = (e) => {
        this._fast = e.shiftKey;
        if (this._keys.delete(e.code)) e.stopImmediatePropagation();
    };

    _onBlur = () => {
        this._keys.clear();
        this._looking = false;
    };

    _onPrerender() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this._lastTime) / 1000);
        this._lastTime = now;

        const move = [0, 0, 0];
        for (const code of this._keys) {
            const offset = FLY_KEYS[code];
            for (let i = 0; i < 3; i++) move[i] += offset[i];
        }
        const boost = this._fast ? FLY_FAST : 1;
        let step = this.speed * boost * dt;
        if (this._ortho) {
            // forward and back zoom, and the view pans in proportion to what it shows
            const rate = (this.speed / FLY_SPEED) * boost * ORTHO_ZOOM * dt;
            this._orthoHeight = Math.max(1e-3, this._orthoHeight * Math.exp(-move[2] * rate));
            move[2] = 0;
            step = this._orthoHeight * ORTHO_PAN * (this.speed / FLY_SPEED) * boost * dt;
        }
        this._frame.deltas.move.append(move.map(value => value * step));
        const pose = this._controller.update(this._frame, dt);

        // draw from the flown pose and projection, keeping the app's own to put back after the frame
        const camera = this.camera;
        const entity = camera.entity;
        if (!this._saved) {
            this._saved = {
                position: entity.getLocalPosition().clone(),
                rotation: entity.getLocalRotation().clone(),
                fov: camera.fov,
                orthoHeight: camera.orthoHeight
            };
        }
        entity.setPosition(pose.position);
        entity.setEulerAngles(pose.angles);
        if (this._ortho) {
            if (camera.orthoHeight !== this._orthoHeight) camera.orthoHeight = this._orthoHeight;
        } else if (camera.fov !== this._fov) {
            camera.fov = this._fov;
        }
    }

    _onPostrender() {
        const saved = this._saved;
        if (!saved) return;
        this._saved = null;
        const camera = this.camera;
        const entity = camera.entity;
        entity.setLocalPosition(saved.position);
        entity.setLocalRotation(saved.rotation);
        if (camera.fov !== saved.fov) camera.fov = saved.fov;
        if (camera.orthoHeight !== saved.orthoHeight) camera.orthoHeight = saved.orthoHeight;
    }

    /**
     * @returns {boolean} Whether forward and back zoom the view rather than moving it, as they do
     * for an orthographic camera.
     */
    get zooms() {
        return this._ortho;
    }
}

/**
 * Draws every mesh instance of the app in wireframe while on, keeping the render style each had to
 * put back. Mesh instances the app adds while it is on take it on at the next apply.
 */
class WireframeMode {
    /** @type {Map<MeshInstance, number>} */
    _styles = new Map();

    /**
     * @param {AppBase} app - The app, whose mesh instances to draw in wireframe.
     */
    apply(app) {
        for (const { instance } of collectMeshInstances(app)) {
            if (this._styles.has(instance)) continue;
            this._styles.set(instance, instance.renderStyle);
            if (instance.renderStyle !== RENDERSTYLE_WIREFRAME) instance.renderStyle = RENDERSTYLE_WIREFRAME;
        }
    }

    /** Puts back the render style of every mesh instance drawn in wireframe. */
    restore() {
        for (const [instance, style] of this._styles) {
            if (instance.mesh && instance.renderStyle !== style) instance.renderStyle = style ?? RENDERSTYLE_SOLID;
        }
        this._styles.clear();
    }
}

export { CameraFly, CanvasCapture, RENDER_MODES, ViewportPicker, WireframeMode, isScreenCamera, screenCameraAt };
