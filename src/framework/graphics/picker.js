import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Layer } from '../../scene/layer.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { Debug } from '../../core/debug.js';
import { RenderPassPicker } from './render-pass-picker.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { CameraComponent } from '../components/camera/component.js'
 * @import { GSplatComponent } from '../components/gsplat/component.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { Scene } from '../../scene/scene.js'
 */

const tempSet = new Set();
const _rect = new Vec4();
const _floatView = new Float32Array(1);
const _int32View = new Int32Array(_floatView.buffer);

/**
 * Picker object used to select mesh instances from screen coordinates. It can also optionally
 * capture depth information to determine world positions of picked points.
 *
 * The picker works by rendering mesh instances to an offscreen render target with unique IDs
 * encoded as colors. When queried, it reads back the pixel data to identify which mesh instance
 * was at the specified screen coordinates. If depth picking is enabled, it also captures depth
 * values to compute world positions.
 *
 * **Main API methods:**
 * - {@link prepare} - Renders the pick buffer (call once per frame before picking)
 * - {@link getSelectionAsync} - Get mesh instances in a screen area
 * - {@link getWorldPointAsync} - Get world position at screen coordinates (requires depth)
 *
 * **Performance considerations:**
 * The picker resolution can be set lower than the screen resolution for better performance,
 * though this reduces picking precision and may miss small objects.
 *
 * @example
 * // Create a picker with depth picking enabled at quarter resolution
 * const picker = new pc.Picker(app, canvas.width * 0.25, canvas.height * 0.25, true);
 *
 * // In your update loop, prepare the picker
 * picker.resize(canvas.width * 0.25, canvas.height * 0.25);
 * picker.prepare(camera, scene);
 *
 * // Pick mesh instances in an area
 * picker.getSelectionAsync(x, y, width, height).then((meshInstances) => {
 *     meshInstances.forEach((meshInstance) => {
 *         console.log('Picked:', meshInstance.node.name);
 *     });
 * });
 *
 * // Pick world position (requires depth enabled)
 * picker.getWorldPointAsync(x, y).then((worldPoint) => {
 *     if (worldPoint) {
 *         console.log(worldPoint);
 *     }
 * });
 *
 * @see {@link http://playcanvas.github.io/#/graphics/area-picker|Area Picker Example}
 * @see {@link https://playcanvas.github.io/#gaussian-splatting/picking|Gaussian Splatting Picking Example}
 *
 * @category Graphics
 */
class Picker {
    /**
     * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
     * @private
     */
    device;

    /**
     * @type {RenderPassPicker}
     * @private
     */
    renderPass;

    /**
     * @type {boolean}
     * @private
     */
    depth;

    /** @type {number} */
    width;

    /** @type {number} */
    height;

    /**
     * Internal render target.
     *
     * @type {RenderTarget|null}
     * @private
     */
    renderTarget = null;

    /**
     * Color buffer texture for pick IDs.
     *
     * @type {Texture|null}
     * @private
     */
    colorBuffer = null;

    /**
     * Optional depth buffer texture for depth picking.
     *
     * @type {Texture|null}
     * @private
     */
    depthBuffer = null;

    /**
     * Internal render target for reading the depth buffer.
     *
     * @type {RenderTarget|null}
     * @private
     */
    renderTargetDepth = null;

    /**
     * Mapping table from ids to MeshInstances or GSplatComponents.
     *
     * @type {Map<number, MeshInstance | GSplatComponent>}
     * @private
     */
    mapping = new Map();

    /**
     * When the device is destroyed, this allows us to ignore async results.
     *
     * @private
     */
    deviceValid = true;

    /**
     * Create a new Picker instance.
     *
     * @param {AppBase} app - The application managing this picker instance.
     * @param {number} width - The width of the pick buffer in pixels.
     * @param {number} height - The height of the pick buffer in pixels.
     * @param {boolean} [depth] - Whether to enable depth picking. When enabled, depth
     * information is captured alongside mesh IDs using MRT. Defaults to false.
     */
    constructor(app, width, height, depth = false) {
        // Note: The only reason this class needs the app is to access the renderer. Ideally we remove this dependency and move
        // the Picker from framework to the scene level, or even the extras.
        Debug.assert(app);
        this.device = app.graphicsDevice;

        this.renderPass = new RenderPassPicker(this.device, app.renderer);

        this.depth = depth;
        this.width = 0;
        this.height = 0;
        this.resize(width, height);
        this.allocateRenderTarget();

        // handle the device getting destroyed
        this.device.on('destroy', () => {
            this.deviceValid = false;
        });
    }

    /**
     * Frees resources associated with this picker.
     */
    destroy() {
        this.releaseRenderTarget();
        this.renderPass?.destroy();
    }

    /**
     * Return the list of mesh instances selected by the specified rectangle in the previously
     * prepared pick buffer. The rectangle using top-left coordinate system.
     *
     * Note: This function is not supported on WebGPU. Use {@link getSelectionAsync} instead.
     * Note: This function is blocks the main thread while reading pixels from GPU memory. It's
     * recommended to use {@link getSelectionAsync} instead.
     *
     * @param {number} x - The left edge of the rectangle.
     * @param {number} y - The top edge of the rectangle.
     * @param {number} [width] - The width of the rectangle. Defaults to 1.
     * @param {number} [height] - The height of the rectangle. Defaults to 1.
     * @returns {(MeshInstance | GSplatComponent)[]} An array of mesh instances or gsplat components
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

        Debug.assert(typeof x !== 'object', 'Picker.getSelection:param \'rect\' is deprecated, use \'x, y, width, height\' instead.');

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
     * @returns {Promise<(MeshInstance | GSplatComponent)[]>} - Promise that resolves with an
     * array of mesh instances or gsplat components that are in the selection.
     * @example
     * // Get the mesh instances at the rectangle with start at (10,20) and size of (5,5)
     * picker.getSelectionAsync(10, 20, 5, 5).then((meshInstances) => {
     *    console.log(meshInstances);
     * });
     */
    getSelectionAsync(x, y, width = 1, height = 1) {
        if (!this.renderTarget || !this.renderTarget.colorBuffer) {
            return Promise.resolve([]);
        }
        return this._readTexture(this.renderTarget.colorBuffer, x, y, width, height, this.renderTarget).then((pixels) => {
            return this.decodePixels(pixels, this.mapping);
        });
    }

    /**
     * Helper method to read pixels from a texture asynchronously.
     *
     * @param {Texture} texture - The texture to read from.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} width - The width of the rectangle.
     * @param {number} height - The height of the rectangle.
     * @param {RenderTarget} renderTarget - The render target to use for reading.
     * @returns {Promise<Uint8Array>} Promise resolving to the pixel data.
     * @private
     */
    _readTexture(texture, x, y, width, height, renderTarget) {
        if (this.device?.isWebGL2) {
            y = renderTarget.height - (y + height);
        }
        const rect = this.sanitizeRect(x, y, width, height);

        // @ts-ignore
        return texture.read(rect.x, rect.y, rect.z, rect.w, {
            immediate: true,
            renderTarget: renderTarget
        });
    }

    /**
     * Return the world position of the mesh instance picked at the specified screen coordinates.
     *
     * @param {number} x - The x coordinate of the pixel to pick.
     * @param {number} y - The y coordinate of the pixel to pick.
     * @returns {Promise<Vec3|null>} Promise that resolves with the world position of the picked point,
     * or null if no depth is available or nothing was picked.
     * @example
     * // Get the world position at screen coordinates (100, 50)
     * picker.getWorldPointAsync(100, 50).then((worldPoint) => {
     *     if (worldPoint) {
     *         console.log('World position:', worldPoint);
     *         // Use the world position
     *     } else {
     *         console.log('No object at this position');
     *     }
     * });
     */
    async getWorldPointAsync(x, y) {
        const state = this._captureCameraState();
        if (!state) {
            return null;
        }

        const linearDepth = await this.getPointDepthAsync(x, y);
        if (linearDepth === null) {
            return null;
        }

        return this._unprojectDepth(x, y, linearDepth, state);
    }

    /**
     * Return the world position and a derived surface normal at the specified screen coordinates.
     * The normal is computed from depth-buffer neighbors via a cross product of two screen-aligned
     * world-space tangent vectors — it is a faceted (per-pixel) normal, not an interpolated vertex
     * normal. Internally a single 2x2 depth readback is used and {@link Picker#prepare} auto-pads
     * any supplied scissor rect by 1 pixel so the neighbor samples are inside the rasterized
     * region, so callers do not need to widen the scissor themselves.
     *
     * @param {number} x - The x coordinate of the pixel to pick.
     * @param {number} y - The y coordinate of the pixel to pick.
     * @returns {Promise<{point: Vec3, normal: Vec3}|null>} Promise resolving to the world point
     * and a unit normal facing the camera, or null if depth picking is not enabled or any of the
     * required neighbor pixels did not hit an object.
     * @example
     * picker.prepare(camera, scene, layers, { x: px, y: py, width: 1, height: 1 });
     * picker.getWorldPointAndNormalAsync(px, py).then((hit) => {
     *     if (hit) {
     *         console.log('point', hit.point.toString(), 'normal', hit.normal.toString());
     *     }
     * });
     */
    async getWorldPointAndNormalAsync(x, y) {
        if (!this.depthBuffer) {
            return null;
        }
        const state = this._captureCameraState();
        if (!state) {
            return null;
        }

        // one 2x2 readback covering (x,y), (x+1,y), (x,y+1), (x+1,y+1)
        const pixels = await this._readTexture(this.depthBuffer, x, y, 2, 2, /** @type {RenderTarget} */ (this.renderTargetDepth));

        // decode 4 RGBA8 pixels → 4 linear depths (null if cleared)
        /** @type {(number|null)[]} */
        const depths = [null, null, null, null];
        for (let i = 0; i < 4; i++) {
            const o = i * 4;
            const intBits = ((pixels[o] << 24) | (pixels[o + 1] << 16) | (pixels[o + 2] << 8) | pixels[o + 3]) >>> 0;
            if (intBits !== 0xFFFFFFFF) {
                _int32View[0] = intBits;
                depths[i] = _floatView[0];
            }
        }

        // map array indices to screen positions. WebGPU returns rows top-down; WebGL2 returns
        // them bottom-up of the (already Y-flipped) read region — which means row 0 corresponds
        // to the BOTTOM screen row of the original (top-left origin) request.
        let dCenter, dRight, dDown;
        if (this.device.isWebGPU) {
            // pixels[0]=(x,y), [1]=(x+1,y), [2]=(x,y+1), [3]=(x+1,y+1)
            dCenter = depths[0];
            dRight = depths[1];
            dDown = depths[2];
        } else {
            // pixels[0]=(x,y+1), [1]=(x+1,y+1), [2]=(x,y), [3]=(x+1,y)
            dDown = depths[0];
            dCenter = depths[2];
            dRight = depths[3];
        }
        if (dCenter === null || dRight === null || dDown === null) {
            return null;
        }

        const pCenter = this._unprojectDepth(x, y, dCenter, state);
        const pRight = this._unprojectDepth(x + 1, y, dRight, state);
        const pDown = this._unprojectDepth(x, y + 1, dDown, state);

        // tangent vectors along screen +x and screen +y, then face normal via cross product
        const vRight = new Vec3().sub2(pRight, pCenter);
        const vDown = new Vec3().sub2(pDown, pCenter);
        const normal = new Vec3().cross(vRight, vDown).normalize();

        // ensure the normal points back toward the camera
        const camPos = state.cameraPos;
        const toCam = new Vec3().sub2(camPos, pCenter);
        if (normal.dot(toCam) < 0) {
            normal.mulScalar(-1);
        }

        return { point: pCenter, normal: normal };
    }

    /**
     * Capture camera state needed to unproject pick-buffer depths into world space. Returns null
     * if no camera was supplied to the last prepare() call.
     *
     * @returns {{invViewProj: Mat4, near: number, far: number, isOrtho: boolean, cameraPos: Vec3}|null}
     * Captured camera state, or null if no camera is bound.
     * @private
     */
    _captureCameraState() {
        const camera = this.renderPass.camera;
        if (!camera) {
            return null;
        }
        const viewProjMat = new Mat4().mul2(camera.camera.projectionMatrix, camera.camera.viewMatrix);
        return {
            invViewProj: viewProjMat.invert(),
            near: camera.nearClip,
            far: camera.farClip,
            isOrtho: camera.projection === PROJECTION_ORTHOGRAPHIC,
            cameraPos: camera.entity.getPosition().clone()
        };
    }

    /**
     * Unproject a pick-buffer pixel + linear depth back into world space.
     *
     * @param {number} x - Pick-buffer x in pixel coords, top-left origin.
     * @param {number} y - Pick-buffer y in pixel coords, top-left origin.
     * @param {number} linearDepth - Linear normalized depth [0,1].
     * @param {{invViewProj: Mat4, near: number, far: number, isOrtho: boolean}} state - Camera state
     * captured by {@link Picker#_captureCameraState}.
     * @returns {Vec3} World position.
     * @private
     */
    _unprojectDepth(x, y, linearDepth, state) {
        const { invViewProj, near, far, isOrtho } = state;
        const ndcDepth = isOrtho ? linearDepth : (far * linearDepth / (linearDepth * (far - near) + near));
        const dc = new Vec4(
            (x / this.width) * 2 - 1,
            (1 - y / this.height) * 2 - 1,
            ndcDepth * 2 - 1,
            1.0
        );
        invViewProj.transformVec4(dc, dc);
        dc.mulScalar(1.0 / dc.w);
        return new Vec3(dc.x, dc.y, dc.z);
    }

    /**
     * Return the depth value of the mesh instance picked at the specified screen coordinates.
     *
     * @param {number} x - The x coordinate of the pixel to pick.
     * @param {number} y - The y coordinate of the pixel to pick.
     * @returns {Promise<number|null>} Promise that resolves with the linear normalized depth value
     * of the picked point (0 = near plane, 1 = far plane), or null if depth picking is not enabled
     * or no object was picked.
     * @ignore
     */
    async getPointDepthAsync(x, y) {
        if (!this.depthBuffer) {
            return null;
        }

        const pixels = await this._readTexture(this.depthBuffer, x, y, 1, 1, this.renderTargetDepth);

        // reconstruct uint bits from RGBA8
        const intBits = ((pixels[0] << 24) | (pixels[1] << 16) | (pixels[2] << 8) | pixels[3]) >>> 0;

        // check for white (cleared) depth
        if (intBits === 0xFFFFFFFF) {
            return null;
        }

        // reinterpret bits as float
        _int32View[0] = intBits;
        return _floatView[0];
    }

    // sanitize the rectangle to make sure it's inside the texture and does not use fractions
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
                const index = (a << 24 | r << 16 | g << 8 | b) >>> 0;

                // White is 'no selection
                if (index !== 0xFFFFFFFF) {
                    tempSet.add(mapping.get(index));
                }
            }

            // return the content of the set as an array
            tempSet.forEach((meshInstance) => {
                if (meshInstance) {
                    selection.push(meshInstance);
                }
            });
            tempSet.clear();
        }

        return selection;
    }

    createTexture(name) {
        return Texture.createDataTexture2D(this.device, name, this.width, this.height, PIXELFORMAT_RGBA8);
    }

    allocateRenderTarget() {

        // TODO: Ideally we'd use a UINT32 texture format and avoid RGBA8 conversion, but WebGL2 does not
        // support clearing render targets of this format, so we'd need a quad based clear solution.
        this.colorBuffer = this.createTexture('pick');
        const colorBuffers = [this.colorBuffer];

        if (this.depth) {
            // create depth buffer for MRT
            this.depthBuffer = this.createTexture('pick-depth');
            colorBuffers.push(this.depthBuffer);

            // create a render target for reading the depth buffer
            this.renderTargetDepth = new RenderTarget({
                colorBuffer: this.depthBuffer,
                depth: false
            });
        }

        this.renderTarget = new RenderTarget({
            colorBuffers: colorBuffers,
            depth: true
        });
    }

    releaseRenderTarget() {
        this.renderTarget?.destroyTextureBuffers();
        this.renderTarget?.destroy();
        this.renderTarget = null;

        this.renderTargetDepth?.destroy();
        this.renderTargetDepth = null;

        this.colorBuffer = null;
        this.depthBuffer = null;
    }

    /**
     * Primes the pick buffer with a rendering of the specified models from the point of view of
     * the supplied camera. Once the pick buffer has been prepared, {@link getSelection} can
     * be called multiple times on the same picker object. Therefore, if the models or camera do
     * not change in any way, {@link prepare} does not need to be called again.
     *
     * @param {CameraComponent} camera - The camera component used to render the scene.
     * @param {Scene} scene - The scene containing the pickable mesh instances.
     * @param {Layer[]} [layers] - Layers from which objects will be picked. If not supplied, all
     * layers of the specified camera will be used.
     * @param {object} [options] - Optional rendering controls.
     * @param {number} [options.x] - Scissor rect left edge in pick-buffer pixels, top-left origin.
     * @param {number} [options.y] - Scissor rect top edge in pick-buffer pixels, top-left origin.
     * @param {number} [options.width] - Scissor rect width in pick-buffer pixels.
     * @param {number} [options.height] - Scissor rect height in pick-buffer pixels.
     */
    prepare(camera, scene, layers, options) {

        if (layers instanceof Layer) {
            layers = [layers];
        }

        // make the render target the right size
        this.renderTarget?.resize(this.width, this.height);
        this.renderTargetDepth?.resize(this.width, this.height);

        // clear registered meshes mapping
        this.mapping.clear();

        const renderPass = this.renderPass;
        renderPass.init(this.renderTarget);

        // set up clears - setClearColor handles MRT and clears all color buffers
        renderPass.setClearColor(Color.WHITE);
        renderPass.depthStencilOps.clearDepth = true;

        // optional scissor rect — sanitize and flip top-left → bottom-left for device.setScissor.
        // Pad width/height by 1 so neighbor pixels needed by getWorldPointAndNormalAsync
        // (which reads a 2x2 depth block) stay inside the rasterized region.
        let scissorRect = null;
        if (options && this.renderTarget) {
            const w = options.width ?? 0;
            const h = options.height ?? 0;
            if (w > 0 && h > 0) {
                const r = this.sanitizeRect(options.x ?? 0, options.y ?? 0, w + 1, h + 1);
                const flippedY = this.renderTarget.height - (r.y + r.w);
                scissorRect = new Vec4(r.x, flippedY, r.z, r.w);
            }
        }

        // render the pass to update the render target
        renderPass.update(camera, scene, layers, this.mapping, this.depth, scissorRect);
        renderPass.render();
    }

    /**
     * Sets the resolution of the pick buffer. The pick buffer resolution does not need to match
     * the resolution of the corresponding frame buffer use for general rendering of the 3D scene.
     * However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by {@link getSelection}. On the other hand, smaller pick buffers
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
