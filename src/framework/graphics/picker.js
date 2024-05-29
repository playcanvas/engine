import { Color } from '../../core/math/color.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

import { Layer } from '../../scene/layer.js';

import { Debug } from '../../core/debug.js';
import { RenderPassPicker } from './render-pass-picker.js';
import { math } from '../../core/math/math.js';
import { Vec4 } from '../../core/math/vec4.js';

const tempSet = new Set();
const _rect = new Vec4();

/**
 * Picker object used to select mesh instances from screen coordinates.
 *
 * @property {number} width Width of the pick buffer in pixels (read-only).
 * @property {number} height Height of the pick buffer in pixels (read-only).
 * @property {RenderTarget} renderTarget The render target used by the picker internally
 * (read-only).
 *
 * @category Graphics
 */
class Picker {
    // internal render target
    renderTarget = null;

    // mapping table from ids to meshInstances
    mapping = new Map();

    // when the device is destroyed, this allows us to ignore async results
    deviceValid = true;

    /**
     * Create a new Picker instance.
     *
     * @param {import('../app-base.js').AppBase} app - The application managing this picker
     * instance.
     * @param {number} width - The width of the pick buffer in pixels.
     * @param {number} height - The height of the pick buffer in pixels.
     */
    constructor(app, width, height) {
        Debug.assert(app);

        // Note: The only reason this class needs the app is to access the renderer. Ideally we remove this dependency and move
        // the Picker from framework to the scene level, or even the extras.
        this.renderer = app.renderer;
        this.device = app.graphicsDevice;

        this.renderPass = new RenderPassPicker(this.device, app.renderer);

        this.width = 0;
        this.height = 0;
        this.resize(width, height);

        // handle the device getting destroyed
        this.device.on('destroy', () => {
            this.deviceValid = false;
        });
    }

    /**
     * Return the list of mesh instances selected by the specified rectangle in the previously
     * prepared pick buffer. The rectangle using top-left coordinate system.
     *
     * Note: This function is not supported on WebGPU. Use {@link Picker#getSelectionAsync} instead.
     * Note: This function is blocks the main thread while reading pixels from GPU memory. It's
     * recommended to use {@link Picker#getSelectionAsync} instead.
     *
     * @param {number} x - The left edge of the rectangle.
     * @param {number} y - The top edge of the rectangle.
     * @param {number} [width] - The width of the rectangle. Defaults to 1.
     * @param {number} [height] - The height of the rectangle. Defaults to 1.
     * @returns {import('../../scene/mesh-instance.js').MeshInstance[]} An array of mesh instances
     * that are in the selection.
     * @example
     * // Get the selection at the point (10,20)
     * const selection = picker.getSelection(10, 20);
     * @example
     * // Get all models in rectangle with corners at (10,20) and (20,40)
     * const selection = picker.getSelection(10, 20, 10, 20);
     */
    getSelection(x, y, width = 1, height = 1) {
        const device = this.device;
        if (device.isWebGPU) {
            Debug.errorOnce('pc.Picker#getSelection is not supported on WebGPU, use pc.Picker#getSelectionAsync instead.');
            return [];
        }

        Debug.assert(typeof x !== 'object', `Picker.getSelection:param 'rect' is deprecated, use 'x, y, width, height' instead.`);

        y = this.renderTarget.height - (y + height);
        const rect = this.sanitizeRect(x, y, width, height);

        // read pixels from the render target
        device.setRenderTarget(this.renderTarget);
        device.updateBegin();

        const pixels = new Uint8Array(4 * rect.z * rect.w);
        device.readPixels(rect.x, rect.y, rect.z, rect.w, pixels);

        device.updateEnd();

        return this.decodePixels(pixels, this.mapping);
    }

    /**
     * Return the list of mesh instances selected by the specified rectangle in the previously
     * prepared pick buffer. The rectangle uses top-left coordinate system.
     *
     * This method is asynchronous and does not block the execution.
     *
     * @param {number} x - The left edge of the rectangle.
     * @param {number} y - The top edge of the rectangle.
     * @param {number} [width] - The width of the rectangle. Defaults to 1.
     * @param {number} [height] - The height of the rectangle. Defaults to 1.
     * @returns {Promise<import('../../scene/mesh-instance.js').MeshInstance[]>} - Promise that
     * resolves with an array of mesh instances that are in the selection.
     * @example
     * // Get the mesh instances at the rectangle with start at (10,20) and size of (5,5)
     * picker.getSelectionAsync(10, 20, 5, 5).then((meshInstances) => {
     *    console.log(meshInstances);
     * });
     */
    getSelectionAsync(x, y, width = 1, height = 1) {

        if (this.device?.isWebGL2) {
            y = this.renderTarget.height - (y + height);
        }
        const rect = this.sanitizeRect(x, y, width, height);

        return this.renderTarget.colorBuffer.read(rect.x, rect.y, rect.z, rect.w, {
            renderTarget: this.renderTarget,
            immediate: true
        }).then((pixels) => {
            return this.decodePixels(pixels, this.mapping);
        });
    }

    // sanitize the rectangle to make sure it;s inside the texture and does not use fractions
    sanitizeRect(x, y, width, height) {
        const maxWidth = this.renderTarget.width;
        const maxHeight = this.renderTarget.height;
        x = math.clamp(Math.floor(x), 0, maxWidth - 1);
        y = math.clamp(Math.floor(y), 0, maxHeight - 1);
        width = Math.floor(Math.max(width, 1));
        width = Math.min(width, maxWidth - x);
        height = Math.floor(Math.max(height, 1));
        height = Math.min(height, maxHeight - y);
        return _rect.set(x, y, width, height);
    }

    decodePixels(pixels, mapping) {

        const selection = [];

        // when we decode results from async calls, ignore them if the device is no longer valid
        if (this.deviceValid) {

            const count = pixels.length;
            for (let i = 0; i < count; i += 4) {
                const r = pixels[i + 0];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3];
                const index = a << 24 | r << 16 | g << 8 | b;

                // White is 'no selection'
                if (index !== -1) {
                    tempSet.add(mapping.get(index));
                }
            }

            // return the content of the set as an array
            tempSet.forEach((meshInstance) => {
                if (meshInstance)
                    selection.push(meshInstance);
            });
            tempSet.clear();
        }

        return selection;
    }

    allocateRenderTarget() {

        // TODO: Ideally we'd use a UINT32 texture format and avoid RGBA8 conversion, but WebGL2 does not
        // support clearing render targets of this format, so we'd need a quad based clear solution.
        const colorBuffer = new Texture(this.device, {
            format: PIXELFORMAT_RGBA8,
            width: this.width,
            height: this.height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: 'pick'
        });

        this.renderTarget = new RenderTarget({
            colorBuffer: colorBuffer,
            depth: true
        });
    }

    releaseRenderTarget() {
        if (this.renderTarget) {
            this.renderTarget.destroyTextureBuffers();
            this.renderTarget.destroy();
            this.renderTarget = null;
        }
    }

    /**
     * Primes the pick buffer with a rendering of the specified models from the point of view of
     * the supplied camera. Once the pick buffer has been prepared, {@link Picker#getSelection} can
     * be called multiple times on the same picker object. Therefore, if the models or camera do
     * not change in any way, {@link Picker#prepare} does not need to be called again.
     *
     * @param {import('../components/camera/component.js').CameraComponent} camera - The camera
     * component used to render the scene.
     * @param {import('../../scene/scene.js').Scene} scene - The scene containing the pickable mesh
     * instances.
     * @param {Layer[]} [layers] - Layers from which objects will be picked. If not supplied, all layers of the specified camera will be used.
     */
    prepare(camera, scene, layers) {

        if (layers instanceof Layer) {
            layers = [layers];
        }

        // make the render target the right size
        if (!this.renderTarget || (this.width !== this.renderTarget.width || this.height !== this.renderTarget.height)) {
            this.releaseRenderTarget();
            this.allocateRenderTarget();
        }

        // clear registered meshes mapping
        this.mapping.clear();

        const renderPass = this.renderPass;
        renderPass.init(this.renderTarget);

        // set up clears
        renderPass.colorOps.clearValue = Color.WHITE;
        renderPass.colorOps.clear = true;
        renderPass.depthStencilOps.clearDepth = true;

        // render the pass to update the render target
        renderPass.update(camera, scene, layers, this.mapping);
        renderPass.render();
    }

    /**
     * Sets the resolution of the pick buffer. The pick buffer resolution does not need to match
     * the resolution of the corresponding frame buffer use for general rendering of the 3D scene.
     * However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by {@link Picker#getSelection}. On the other hand, smaller pick buffers
     * will yield greater performance, so there is a trade off.
     *
     * @param {number} width - The width of the pick buffer in pixels.
     * @param {number} height - The height of the pick buffer in pixels.
     */
    resize(width, height) {
        this.width = Math.floor(width);
        this.height = Math.floor(height);
    }
}

export { Picker };
