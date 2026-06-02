import * as pc from 'playcanvas';

const EPSILON = 1;
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
        // depth enabled so we can also recover the world point + surface normal at the click
        this._picker = new pc.Picker(app, device.canvas.width, device.canvas.height, true, true);
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

        // scissor the render to a 2x2 rect around the click so only those fragments rasterize
        const px = e.clientX - 1;
        const py = e.clientY - 1;
        this._picker.prepare(this._camera, this._scene, this._layers, {
            x: px, y: py, width: 2, height: 2
        });

        // run selection and normal queries in parallel — both read the same prepared pick buffer
        const [selection, hit] = await Promise.all([
            this._picker.getSelectionAsync(px, py, 2, 2),
            this._picker.getWorldPointAndNormalAsync(px, py)
        ]);

        if (!selection[0]) {
            this.fire('deselect');
            return;
        }

        const clear = !e.ctrlKey && !e.metaKey;
        this.fire('select', selection[0].node, clear);
        if (hit) {
            this.fire('pick', hit.point, hit.normal, selection[0].node, clear);
        }
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
