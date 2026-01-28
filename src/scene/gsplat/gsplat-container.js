import { Debug } from '../../core/debug.js';
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
 * programmatically using either a built-in format or a custom format with your own texture
 * streams and read code.
 *
 * A default format is provided via {@link GSplatFormat.createDefaultFormat} which uses float
 * textures for easy CPU population.
 *
 * @example
 * // Example 1: Using the default format (easy CPU population)
 * const format = pc.GSplatFormat.createDefaultFormat(device);
 * const container = new pc.GSplatContainer(device, 100, format);
 *
 * // Float format textures are straightforward to fill
 * const centerTex = container.getTexture('dataCenter');
 * const pixels = centerTex.lock();
 * // pixels is Float32Array, fill with [x, y, z, 0, x, y, z, 0, ...]
 * centerTex.unlock();
 *
 * // Set bounding box and centers (required for culling/sorting)
 * container.aabb = new pc.BoundingBox();
 * container.centers.set([x0, y0, z0, x1, y1, z1, ...]);  // xyz per splat
 *
 * // Add to scene
 * entity.addComponent('gsplat', { resource: container, unified: true });
 *
 * @example
 * // Example 2: Using a custom format
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
 * const container = new pc.GSplatContainer(device, 100, format);
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
     * @param {GSplatFormat} format - The format descriptor with streams and read code. Use
     * {@link GSplatFormat.createDefaultFormat} for the built-in format, or create a custom
     * {@link GSplatFormat}.
     */
    constructor(device, maxSplats, format) {
        Debug.assert(format);

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
        this.streams.init(this._format, maxSplats);
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
     * Gets the number of splats to render.
     *
     * @type {number}
     */
    get numSplats() {
        return this._numSplats;
    }

    /**
     * Updates the container after modifying texture data and centers. Call this after filling
     * data to signal that the container contents have changed.
     *
     * @param {number} [numSplats] - Number of splats to render. Defaults to current value.
     * Must be between 0 and {@link maxSplats}.
     * @param {boolean} [centersUpdated=true] - Whether the centers array was modified. Set to
     * false when only numSplats changes but center positions remain the same, to avoid the cost
     * of re-cloning centers in the sorter (can be significant for large containers).
     */
    update(numSplats = this._numSplats, centersUpdated = true) {
        this._numSplats = math.clamp(numSplats, 0, this._maxSplats);
        if (centersUpdated) {
            this.centersVersion++;
        }
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
        // Call base to set defines, bind textures, and set textureDimensions
        super.configureMaterial(material, workBufferModifier, formatDeclarations);

        // Inject format chunks
        const chunks = this.device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl;

        // Set declarations (load functions for streams)
        chunks.set('gsplatContainerDeclarationsVS', this.format.getInputDeclarations());

        // Main entry points - containerDecl includes load functions + module-scope vars
        chunks.set('gsplatDeclarationsVS', '#include "gsplatContainerDeclVS"');

        // Read code provides complete getCenter/getColor/getRotation/getScale functions
        chunks.set('gsplatReadVS', this.format.getReadCode());
    }
}

export { GSplatContainer };
