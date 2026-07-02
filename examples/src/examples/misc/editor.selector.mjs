import { EventHandler, Picker, Vec2 } from 'playcanvas';

/**
 * @import { AppBase, CameraComponent, Layer, Scene } from 'playcanvas'
 */

const EPSILON = 1;
class Selector extends EventHandler {
    /**
     * @type {CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {Scene}
     * @private
     */
    _scene;

    /**
     * @type {Picker}
     * @private
     */
    _picker;

    /**
     * @type {Layer[]}
     * @private
     */
    _layers;

    /**
     * @type {Vec2}
     * @private
     */
    _start = new Vec2();

    /**
     * @param {AppBase} app - The app.
     * @param {CameraComponent} camera - The camera to pick from.
     * @param {Layer[]} [layers] - The layers to pick from.
     */
    constructor(app, camera, layers = []) {
        super();
        this._camera = camera;
        this._scene = app.scene;
        const device = app.graphicsDevice;
        this._picker = new Picker(app, device.canvas.width, device.canvas.height);
        this._layers = layers;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this.bind();
    }

    /**
     * @param {MouseEvent} e - The event.
     * @private
     */
    _onPointerDown(e) {
        this._start.set(e.clientX, e.clientY);
    }

    /**
     * @param {MouseEvent} e - The event.
     * @private
     */
    async _onPointerUp(e) {
        if (Math.abs(e.clientX - this._start.x) > EPSILON || Math.abs(e.clientY - this._start.y) > EPSILON) {
            return;
        }

        const device = this._picker.device;
        this._picker.resize(device.canvas.clientWidth, device.canvas.clientHeight);
        this._picker.prepare(this._camera, this._scene, this._layers);

        const selection = await this._picker.getSelectionAsync(e.clientX - 1, e.clientY - 1, 2, 2);

        if (!selection[0]) {
            this.fire('deselect');
            return;
        }

        this.fire('select', selection[0].node, !e.ctrlKey && !e.metaKey);
    }

    bind() {
        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    unbind() {
        window.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointerup', this._onPointerUp);
    }

    destroy() {
        this.unbind();
    }
}

export { Selector };
