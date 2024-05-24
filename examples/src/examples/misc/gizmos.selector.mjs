import * as pc from 'playcanvas';

class Selector extends pc.EventHandler {
    /**
     * @type {pc.CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {pc.Scene}
     * @private
     */
    _scene;

    /**
     * @type {pc.Picker}
     * @private
     */
    _picker;

    /**
     * @type {pc.Layer[]}
     * @private
     */
    _layers;

    /**
     * @type {pc.Vec2}
     * @private
     */
    _start = new pc.Vec2();

    /**
     * @param {pc.AppBase} app - The app.
     * @param {pc.CameraComponent} camera - The camera to pick from.
     * @param {pc.Layer[]} [layers] - The layers to pick from.
     */
    constructor(app, camera, layers = []) {
        super();
        this._camera = camera;
        this._scene = app.scene;
        const device = app.graphicsDevice;
        this._picker = new pc.Picker(app, device.canvas.width, device.canvas.height);
        this._layers = layers;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointerup', this._onPointerUp);
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
    _onPointerUp(e) {
        if (e.clientX !== this._start.x || e.clientY !== this._start.y) {
            return;
        }

        if (this._picker) {
            const device = this._picker.device;
            this._picker.resize(device.canvas.width, device.canvas.height);
            this._picker.prepare(this._camera, this._scene, this._layers);
        }

        const selection = this._picker.getSelection(e.clientX, e.clientY, 2, 2);

        if (!selection[0]) {
            this.fire('deselect');
            return;
        }

        this.fire('select', selection[0].node, !e.ctrlKey && !e.metaKey);
    }

    destroy() {
        window.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointerup', this._onPointerUp);
    }
}

export { Selector };
