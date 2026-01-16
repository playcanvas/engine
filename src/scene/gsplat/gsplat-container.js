import { math } from '../../core/math/math.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { GSplatFormat } from './gsplat-format.js'
 */

/**
 * A container for procedural Gaussian Splat data. This class allows you to create splat data
 * programmatically by providing a custom format and filling the textures with data.
 *
 * @example
 * // Create a format with a single RGBA8 texture stream
 * const format = new pc.GSplatFormat(device, [
 *     { name: 'data', format: pc.PIXELFORMAT_RGBA32F }
 * ], {
 *     // Shader code to read splat attributes from the texture
 *     readGLSL: `
 *         vec4 d = loadData();
 *         splatCenter = d.xyz;
 *         splatColor = vec4(1.0);
 *         splatScale = vec3(d.w);
 *         splatRotation = vec4(0, 0, 0, 1);
 *     `,
 *     readWGSL: `
 *         let d = loadData();
 *         splatCenter = d.xyz;
 *         splatColor = vec4f(1.0);
 *         splatScale = vec3f(d.w);
 *         splatRotation = vec4f(0, 0, 0, 1);
 *     `
 * });
 *
 * // Create container with max capacity and fill texture data
 * const container = new pc.GSplatContainer(device, 100, format);  // maxSplats = 100
 * const texture = container.getTexture('data');
 * const pixels = texture.lock();
 * // ... fill pixels with position and scale data ...
 * texture.unlock();
 *
 * // Set bounding box and centers (for culling/sorting)
 * container.aabb = new pc.BoundingBox();
 * container.centers.set([x0, y0, z0, x1, y1, z1, ...]);  // xyz per splat
 *
 * // Add to scene
 * entity.addComponent('gsplat', { resource: container, unified: true });
 *
 * @category Graphics
 */
class GSplatContainer extends GSplatResourceBase {
    /**
     * Maximum number of splats this container can hold.
     *
     * Internal note: We cannot (easily) implement resizing of the container, due textures needing
     * to be constant for the world state in GsplatInfo. This is non-issue for gpu based sorting
     * of course, but not for cpu based sorting. The workaround is to recreate container when the
     * size changes.
     *
     * @type {number}
     * @private
     */
    _maxSplats = 0;

    /**
     * Current number of splats to render.
     *
     * @type {number}
     * @private
     */
    _numSplats = 0;

    /**
     * Creates a new GSplatContainer instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} maxSplats - Maximum number of splats this container can hold.
     * @param {GSplatFormat} format - The format descriptor with streams and optional read code.
     */
    constructor(device, maxSplats, format) {
        // Pre-allocate data before super() since gsplatData callbacks need it
        const centers = new Float32Array(maxSplats * 3);
        const aabb = new BoundingBox();

        // Create minimal gsplatData interface for base class
        const gsplatData = {
            numSplats: maxSplats,
            getCenters: () => centers,
            calcAabb: box => box.copy(aabb)
        };
        super(device, gsplatData);

        this._format = format;
        this._maxSplats = maxSplats;
        this._numSplats = maxSplats;

        // Use streams to create textures from format
        this.streams.init(format, maxSplats);
    }

    /**
     * Destroys this container and releases all resources.
     */
    destroy() {
        super.destroy();
    }

    /**
     * Maximum number of splats this container can hold.
     *
     * @type {number}
     */
    get maxSplats() {
        return this._maxSplats;
    }

    /**
     * Sets the number of splats to render. Must be between 0 and {@link maxSplats}.
     *
     * Note: Changing this value triggers internal buffer reallocation in unified rendering mode.
     * Avoid calling this every frame. For per-frame visibility control, consider using
     * {@link GSplatFormat} read shader code that returns `splatScale = vec3(0.0)` for splats
     * you want to hide.
     *
     * @type {number}
     */
    set numSplats(value) {
        this._numSplats = math.clamp(value, 0, this._maxSplats);
    }

    /**
     * Gets the number of splats to render.
     *
     * @type {number}
     */
    get numSplats() {
        return this._numSplats;
    }

    /**
     * Configures material defines for this container.
     *
     * @param {Map<string, string>} defines - The defines map to configure.
     * @ignore
     */
    configureMaterialDefines(defines) {
        // Disable spherical harmonics for containers
        defines.set('SH_BANDS', '0');
    }

    /**
     * Configures a material to use this container's data.
     *
     * @param {ShaderMaterial} material - The material to configure.
     * @ignore
     */
    configureMaterial(material, workBufferModifier = null, formatDeclarations) {
        // Call base to set defines, bind textures, and set textureSize
        super.configureMaterial(material, workBufferModifier, formatDeclarations);

        // Inject format chunks under container-specific names (used by gsplatContainerDeclVS/ReadVS)
        const chunks = this.device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl;
        chunks.set('gsplatContainerDeclarationsVS', this.format.getDeclarations());
        chunks.set('gsplatContainerUserReadVS', this.format.getReadCode());

        // Main entry points include the container wrapper chunks
        chunks.set('gsplatDeclarationsVS', '#include "gsplatContainerDeclVS"');
        chunks.set('gsplatReadVS', '#include "gsplatContainerReadVS"');
    }
}

export { GSplatContainer };
