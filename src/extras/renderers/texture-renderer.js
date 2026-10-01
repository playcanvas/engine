import { Debug } from '../../core/debug.js';
import {
    CULLFACE_NONE, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL,
    PIXELFORMAT_R8, PIXELFORMAT_R16F, PIXELFORMAT_R32F, PIXELFORMAT_RG32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F,
    PRIMITIVE_TRISTRIP, isIntegerPixelFormat, isSrgbPixelFormat
} from '../../platform/graphics/constants.js';
import { BLEND_NORMAL, EVENT_POSTRENDER_LAYER, EVENT_PRERENDER_LAYER } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { createTextureShaderDesc } from './texture-renderer-shaders.js';

// the red channel replicated, for single-channel formats shown with the default selection
const SINGLE_CHANNEL_INDICES = new Int32Array([0, 0, 0]);

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 * @import { Camera } from '../../scene/camera.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { ShaderDesc } from '../../scene/materials/shader-material.js'
 */

/**
 * @typedef {object} TextureSlot
 * @property {MeshInstance} meshInstance - The persistent screen-space quad.
 * @property {ShaderMaterial} material - Material owned by this slot.
 * @property {string} mode - The last sampling mode.
 * @property {string} encoding - The last source encoding.
 * @property {Int32Array} channelIndices - Channels selected for this preview.
 * @property {Texture|null} texture - The texture shown this frame, or null.
 * @ignore
 */

/**
 * @typedef {object} TexturePool
 * @property {TextureSlot[]} slots - Slots in submission order.
 * @property {MeshInstance[]} meshInstances - Registered instances, used for cleanup.
 * @property {number} used - Number of submissions this frame.
 * @ignore
 */

/**
 * @param {RenderTarget} rt - A render target.
 * @param {Texture} texture - A texture.
 * @returns {boolean} Whether the texture is one of the target's attachments.
 */
function rendersInto(rt, texture) {
    if (rt.depthBuffer === texture || rt.depthResolveBuffer === texture) return true;
    for (let i = 0; i < rt.colorBufferCount; i++) {
        if (rt.getColorBuffer(i) === texture || rt.getResolveBuffer(i) === texture) return true;
    }
    return false;
}

/**
 * Displays textures for a single frame, for debugging. Call {@link draw} or {@link sceneDepth}
 * during update or prerender on every frame the preview should be visible. Positions specify
 * the top-left corner in normalized camera-viewport coordinates: (0, 0) is top-left and (1, 1)
 * is bottom-right. Width and height are fractions of the viewport; a rectangle of (0, 0, 1, 1)
 * fills it. Signed sizes can flip a preview, and rectangles can extend outside the viewport.
 *
 * Supports 2D color textures in normalized, floating-point and device-supported compressed
 * formats. Linear and sRGB color, and RGBM, RGBE and RGBP encoded HDR color, are detected
 * automatically with the default {@link channels} selection, and single-channel formats such as
 * {@link PIXELFORMAT_R8} display their channel as grayscale. Other selections display stored
 * channel values, including alpha, as opaque previews.
 *
 * Depth textures using {@link PIXELFORMAT_DEPTH}, {@link PIXELFORMAT_DEPTH16} or
 * {@link PIXELFORMAT_DEPTHSTENCIL} are displayed as raw grayscale values. Use {@link sceneDepth}
 * to display the rendering camera's scene depth, linearized and normalized by its far clip
 * distance. The camera must have scene depth capture enabled.
 *
 * Cube, volume, array, integer and multisampled textures are not supported. On WebGL2, raw depth
 * textures must have comparison sampling disabled, and both raw depth and non-filterable float
 * textures require nearest minification and magnification filters. WebGPU supports these textures
 * regardless of their filtering and comparison sampler settings.
 *
 * Resources are released automatically when the application is destroyed, or earlier by calling
 * {@link destroy}. Supplied textures are never destroyed by this helper.
 *
 * Previews produce fully opaque pixels but are drawn as alpha-blended instances, so they render in
 * layers that only draw their transparent sub-layer, such as the default UI layer, which is also
 * where they escape a camera frame's post-processing. They do not write or test depth and do not
 * cast shadows. Ordering against other transparent geometry follows the destination layer's
 * transparent sort mode.
 *
 * Every camera rendering the destination layer draws the previews, including cameras rendering
 * into a texture. Set {@link camera} to limit them to a single camera, typically the one rendering
 * to the screen. A render pass whose target has the previewed texture among its attachments never
 * draws that preview: sampling a texture while rendering into it is undefined on WebGL and an
 * error on WebGPU. Both rules are applied as each layer is rendered, against the target the pass
 * really renders into, so they hold for camera frames and custom render passes and do not depend
 * on frustum culling.
 *
 * @example
 * const textures = new TextureRenderer(app);
 * app.on('update', () => {
 *     textures.draw(texture, 0.7, 0.7, 0.25, 0.25);
 * });
 * @example
 * // camera is an entity with a camera component.
 * camera.camera.requestSceneDepthMap(true);
 * const textures = new TextureRenderer(app);
 * app.on('update', () => {
 *     textures.sceneDepth(0.7, 0.7, 0.25, 0.25);
 * });
 * @category Graphics
 */
class TextureRenderer {
    /**
     * The layer used by subsequent draw calls, or null to use the application's default debug
     * drawing layer (normally Immediate). Defaults to null.
     *
     * @type {Layer|null}
     */
    layer = null;

    /**
     * The only camera that draws the previews, or null to let every camera rendering the
     * destination layer draw them. Defaults to null.
     *
     * @type {CameraComponent|null}
     */
    camera = null;

    /** @private */
    _channels = 'rgb';

    /** @private */
    _channelIndices = new Int32Array([0, 1, 2]);

    /**
     * Channels displayed by subsequent {@link draw} calls. Must be exactly three characters from
     * 'r', 'g', 'b' and 'a'. Defaults to 'rgb', which displays automatically decoded color, or the
     * stored channel as grayscale for single-channel formats. Other selections display stored
     * channel values without color decoding: for example, 'rrr' displays
     * red as grayscale, 'aaa' displays alpha, and 'bgr' swaps red and blue. Values from 0 to 1 map
     * directly from black to white. Output is always opaque. Ignored for depth textures and
     * {@link sceneDepth}. Invalid values leave the previous selection unchanged.
     *
     * @type {string}
     * @example
     * textures.channels = 'aaa';
     * textures.draw(texture, 0, 0, 0.25, 0.25);
     */
    set channels(value) {
        if (value === this._channels) return;
        if (typeof value !== 'string' || !/^[rgba]{3}$/.test(value)) {
            Debug.warnOnce('TextureRenderer.channels must contain exactly three characters from r, g, b and a.');
            return;
        }
        this._channels = value;
        for (let i = 0; i < 3; i++) {
            this._channelIndices[i] = 'rgba'.indexOf(value[i]);
        }
    }

    get channels() {
        return this._channels;
    }

    /**
     * @type {Map<Layer, TexturePool>}
     * @private
     */
    _pools = new Map();

    /**
     * @type {Map<string, ShaderDesc>}
     * @private
     */
    _shaderDescs = new Map();

    /**
     * @type {Mesh|null}
     * @private
     */
    _mesh = null;

    /**
     * Creates a debug texture renderer.
     *
     * @param {AppBase} app - The application to render into and bind resource lifetime to.
     */
    constructor(app) {
        /** @private */
        this._app = app;
        // postrender also covers explicit app.render(); frameend discards submissions on ticks
        // where autoRender is disabled, preventing the slot pool from growing while paused.
        app.on('postrender', this._endFrame, this);
        app.on('frameend', this._endFrame, this);
        app.on('destroy', this.destroy, this);
        app.scene.on(EVENT_PRERENDER_LAYER, this._onPreRenderLayer, this);
        app.scene.on(EVENT_POSTRENDER_LAYER, this._onPostRenderLayer, this);
    }

    /**
     * Displays a 2D color or depth texture for this frame. Color encoding and supported filtering
     * are detected automatically when {@link channels} is 'rgb'. Other selections display stored
     * channel values. Raw depth is shown as grayscale without
     * projection-dependent linearization; use {@link sceneDepth} for camera depth. Texture row 0
     * is displayed at the top. For rendered textures, use {@link RENDERTARGET_ORIGIN_TOP} on their
     * render target for consistent orientation across backends.
     *
     * Cube, volume, array, integer and multisampled textures are not supported. On WebGL2,
     * depth textures must have comparison sampling disabled. Raw depth and non-filterable float
     * textures must use nearest minification and magnification filters on WebGL2. WebGPU samples
     * these textures independently of their filtering and comparison sampler settings.
     *
     * @param {Texture} texture - The caller-owned texture to display.
     * @param {number} x - Left edge as a fraction of the camera viewport width.
     * @param {number} y - Top edge as a fraction of the camera viewport height.
     * @param {number} width - Width as a fraction of the camera viewport width.
     * @param {number} height - Height as a fraction of the camera viewport height.
     */
    draw(texture, x, y, width, height) {
        if (!this._app) return;
        const device = this._app.graphicsDevice;
        if (!texture || texture.device !== device || texture.cubemap || texture.volume ||
            texture.arrayLength || texture.samples > 1 || isIntegerPixelFormat(texture.format)) {
            Debug.warnOnce('TextureRenderer.draw requires a non-multisampled 2D color or depth texture from the same graphics device.');
            return;
        }

        const format = texture.format;
        const depth = format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16 || format === PIXELFORMAT_DEPTHSTENCIL;
        if (depth && device.isWebGL2 && texture.compareOnRead) {
            Debug.warnOnce('TextureRenderer cannot display comparison depth textures on WebGL2.');
            return;
        }
        const unfilterable = !device.textureFloatFilterable &&
            (format === PIXELFORMAT_R32F || format === PIXELFORMAT_RG32F || format === PIXELFORMAT_RGB32F || format === PIXELFORMAT_RGBA32F);
        // WebGL still checks sampler completeness for texelFetch, even though no filtering occurs.
        // Do not change caller-owned sampler state just to make a debug preview render.
        if (device.isWebGL2 && (depth || unfilterable)) {
            const minFilter = texture.minFilter;
            const nearestMin = minFilter === FILTER_NEAREST || minFilter === FILTER_NEAREST_MIPMAP_NEAREST ||
                (!texture.mipmaps && minFilter === FILTER_NEAREST_MIPMAP_LINEAR);
            if (!nearestMin || texture.magFilter !== FILTER_NEAREST) {
                Debug.warnOnce('TextureRenderer requires nearest filtering for raw depth and non-filterable float textures on WebGL2.');
                return;
            }
        }
        // a single stored channel reads as grayscale rather than as red with black behind it
        const singleChannel = format === PIXELFORMAT_R8 || format === PIXELFORMAT_R16F || format === PIXELFORMAT_R32F;
        const decoded = this._channels === 'rgb' && !singleChannel;
        const channelIndices = this._channels === 'rgb' ? SINGLE_CHANNEL_INDICES : this._channelIndices;
        const encoding = depth ? 'linear' : decoded ? texture.encoding :
            isSrgbPixelFormat(format) ? 'raw-srgb' : 'raw';
        this._draw(texture, depth ? 'depth' : unfilterable ? 'unfilterable' : 'filtered',
            encoding, x, y, width, height, channelIndices);
    }

    /**
     * Displays the rendering camera's scene depth for this frame, linearized and normalized by
     * its far clip distance. The camera must already supply a scene depth map, for example using
     * {@link CameraComponent#requestSceneDepthMap}, and this layer must render after depth capture.
     *
     * @param {number} x - Left edge as a fraction of the camera viewport width.
     * @param {number} y - Top edge as a fraction of the camera viewport height.
     * @param {number} width - Width as a fraction of the camera viewport width.
     * @param {number} height - Height as a fraction of the camera viewport height.
     */
    sceneDepth(x, y, width, height) {
        this._draw(null, 'scene-depth', 'linear', x, y, width, height, SINGLE_CHANNEL_INDICES);
    }

    /**
     * @param {Texture|null} texture - Source texture, or null for scene depth.
     * @param {string} mode - Sampling mode.
     * @param {string} encoding - Source encoding.
     * @param {number} x - Normalized left edge.
     * @param {number} y - Normalized top edge.
     * @param {number} width - Normalized width.
     * @param {number} height - Normalized height.
     * @param {Int32Array} channelIndices - The channels shown by a raw encoding.
     * @private
     */
    _draw(texture, mode, encoding, x, y, width, height, channelIndices) {
        if (!this._app || !Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) return;

        const layer = this.layer ?? this._app.scene.defaultDrawLayer;
        if (!layer) return;
        let pool = this._pools.get(layer);
        if (!pool) {
            pool = { slots: [], meshInstances: [], used: 0 };
            this._pools.set(layer, pool);
        }

        let slot = pool.slots[pool.used++];
        if (!slot) {
            if (!this._mesh) {
                this._mesh = new Mesh(this._app.graphicsDevice);
                this._mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
                this._mesh.update(PRIMITIVE_TRISTRIP);
            }
            const material = new ShaderMaterial();
            material.name = 'Debug texture';
            material.cull = CULLFACE_NONE;
            material.depthTest = false;
            material.depthWrite = false;
            // blended so the quad counts as transparent: layers such as UI only render that sub-layer
            material.blendType = BLEND_NORMAL;
            const meshInstance = new MeshInstance(this._mesh, material, new GraphNode(`Debug texture ${pool.slots.length}`));
            meshInstance.castShadow = false;
            meshInstance.pick = false;
            meshInstance.cull = false;
            meshInstance.shaderPassMask = 0;
            slot = { meshInstance, material, mode: '', encoding: '', channelIndices: new Int32Array(3), texture: null };
            pool.slots.push(slot);
            pool.meshInstances.push(meshInstance);
            layer.addMeshInstances([meshInstance], true);
        }

        if (slot.mode !== mode || slot.encoding !== encoding) {
            const key = `${mode}-${encoding}`;
            let desc = this._shaderDescs.get(key);
            if (!desc) {
                desc = createTextureShaderDesc(mode, encoding);
                this._shaderDescs.set(key, desc);
            }
            slot.material.shaderDesc = desc;
            slot.material.update();
            slot.mode = mode;
            slot.encoding = encoding;
        }
        if (encoding === 'raw' || encoding === 'raw-srgb') {
            slot.channelIndices.set(channelIndices);
            slot.material.setParameter('textureChannels', slot.channelIndices);
        }
        slot.material.setParameter('colorMap', texture);
        slot.texture = texture;
        const meshInstance = slot.meshInstance;
        meshInstance.node.setLocalPosition(2 * x + width - 1, 1 - 2 * y - height, 0);
        meshInstance.node.setLocalScale(2 * width, -2 * height, 1);
        meshInstance.shaderPassMask = 0;
        meshInstance.visible = true;
    }

    /**
     * Whether a pass draws a preview: only the selected camera if one is set, and never a pass
     * rendering into the texture the preview samples.
     *
     * @param {TextureSlot} slot - The preview.
     * @param {Camera} camera - The camera rendering the layer.
     * @param {RenderTarget|null} renderTarget - The target the pass renders into.
     * @returns {boolean} True to draw the preview in this pass.
     * @private
     */
    _isDrawnBy(slot, camera, renderTarget) {
        if (this.camera && camera !== this.camera.camera) return false;
        return !slot.texture || !renderTarget || !rendersInto(renderTarget, slot.texture);
    }

    /**
     * Applies camera and attachment restrictions after culling, using the actual pass target.
     * The pass mask skips shader preparation and resource binding as well as the draw itself.
     *
     * @param {CameraComponent} cameraComponent - The camera rendering the layer.
     * @param {Layer} layer - The layer about to be rendered.
     * @private
     */
    _onPreRenderLayer(cameraComponent, layer) {
        const pool = this._pools.get(layer);
        if (!pool) return;
        const camera = cameraComponent.camera;
        const renderTarget = this._app.graphicsDevice.renderTarget;
        for (let i = 0; i < pool.used; i++) {
            const slot = pool.slots[i];
            slot.meshInstance.shaderPassMask = this._isDrawnBy(slot, camera, renderTarget) ? 0xFFFFFFFF : 0;
        }
    }

    /**
     * Keeps previews out of other passes until their destination layer explicitly enables them.
     *
     * @param {CameraComponent} cameraComponent - The camera that rendered the layer.
     * @param {Layer} layer - The layer that was rendered.
     * @private
     */
    _onPostRenderLayer(cameraComponent, layer) {
        const pool = this._pools.get(layer);
        if (!pool) return;
        for (let i = 0; i < pool.used; i++) {
            pool.slots[i].meshInstance.shaderPassMask = 0;
        }
    }

    /** @private */
    _endFrame() {
        for (const pool of this._pools.values()) {
            for (let i = 0; i < pool.used; i++) {
                const slot = pool.slots[i];
                slot.meshInstance.visible = false;
                slot.meshInstance.shaderPassMask = 0;
                // A dormant debug renderer must not keep caller-owned textures alive.
                slot.material.setParameter('colorMap', null);
                slot.texture = null;
            }
            pool.used = 0;
        }
    }

    /**
     * Removes all previews and releases the renderer's resources. Does not destroy supplied
     * textures. Safe to call repeatedly; subsequent draw calls are ignored.
     */
    destroy() {
        if (!this._app) return;
        this._app.off('postrender', this._endFrame, this);
        this._app.off('frameend', this._endFrame, this);
        this._app.off('destroy', this.destroy, this);
        this._app.scene.off(EVENT_PRERENDER_LAYER, this._onPreRenderLayer, this);
        this._app.scene.off(EVENT_POSTRENDER_LAYER, this._onPostRenderLayer, this);
        for (const [layer, pool] of this._pools) {
            layer.removeMeshInstances(pool.meshInstances, true);
            for (const slot of pool.slots) {
                slot.meshInstance.destroy();
                slot.material.destroy();
            }
        }
        this._pools.clear();
        this._shaderDescs.clear();
        // MeshInstance.destroy releases the shared mesh when its last instance is destroyed.
        this._mesh = null;
        this._app = null;
    }
}

export { TextureRenderer };
