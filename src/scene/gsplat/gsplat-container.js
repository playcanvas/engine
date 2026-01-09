import { Vec2 } from '../../core/math/vec2.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { GSplatFormat } from './gsplat-format.js'
 */

/**
 * A container for procedural Gaussian Splat data. This class allows you to create splat data
 * programmatically by providing a custom format and filling the textures with data.
 *
 * @category Graphics
 */
class GSplatContainer extends GSplatResourceBase {
    /**
     * The format descriptor for this container.
     *
     * @type {GSplatFormat}
     */
    format;

    /**
     * Map of texture names to Texture instances.
     *
     * @type {Map<string, Texture>}
     * @ignore
     */
    textures = new Map();

    /**
     * Number of splats in this container.
     *
     * @type {number}
     * @private
     */
    _numSplats = 0;

    /**
     * Creates a new GSplatContainer instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} numSplats - Number of splats in this container.
     * @param {GSplatFormat} format - The format descriptor with streams and optional read code.
     */
    constructor(device, numSplats, format) {
        // Pre-allocate data before super() since gsplatData callbacks need it
        const centers = new Float32Array(numSplats * 3);
        const aabb = new BoundingBox();

        // Create minimal gsplatData interface for base class
        const gsplatData = {
            numSplats: numSplats,
            getCenters: () => centers,
            calcAabb: box => box.copy(aabb)
        };
        super(device, gsplatData);

        this.format = format;
        this._numSplats = numSplats;

        // Allocate textures based on format streams
        const size = this.evalTextureSize(numSplats);
        for (const stream of format.streams) {
            const texture = this.createTexture(stream.name, stream.format, size);
            this.textures.set(stream.name, texture);
        }
    }

    /**
     * Destroys this container and releases all resources.
     */
    destroy() {
        for (const texture of this.textures.values()) {
            texture.destroy();
        }
        this.textures.clear();
        super.destroy();
    }

    /**
     * Number of splats in this container.
     *
     * @type {number}
     */
    get numSplats() {
        return this._numSplats;
    }

    /**
     * Evaluates the texture size needed to store a given number of elements.
     *
     * @param {number} count - The number of elements to store.
     * @returns {Vec2} The width and height of the texture.
     * @ignore
     */
    evalTextureSize(count) {
        const width = Math.ceil(Math.sqrt(count));
        return new Vec2(width, Math.ceil(count / width));
    }

    /**
     * Gets a texture by stream name.
     *
     * @param {string} name - The name of the stream.
     * @returns {Texture|undefined} The texture, or undefined if not found.
     */
    getTexture(name) {
        return this.textures.get(name);
    }

    /**
     * Configures material defines for this container.
     *
     * @param {Map<string, string>} defines - The defines map to configure.
     * @ignore
     */
    configureMaterialDefines(defines) {
        // Flag that this is a container - shader will use container read path
        defines.set('GSPLAT_CONTAINER', '');
        // Disable spherical harmonics for containers
        defines.set('SH_BANDS', '0');
    }

    /**
     * Configures a material to use this container's data.
     *
     * @param {ShaderMaterial} material - The material to configure.
     * @ignore
     */
    configureMaterial(material) {
        // Set defines
        this.configureMaterialDefines(material.defines);

        // Register format's shader chunks as includes
        const chunks = this.device.isWebGPU ? material.shaderChunks.wgsl : material.shaderChunks.glsl;
        chunks.set('gsplatContainerDeclarationsVS', this.format.getDeclarations());
        chunks.set('gsplatContainerReadVS', this.format.getReadCode());

        // Bind all textures from format streams
        for (const [name, texture] of this.textures) {
            material.setParameter(name, texture);
        }

        // Set texture size for load functions
        const size = this.evalTextureSize(this._numSplats);
        material.setParameter('splatTextureSize', size.x);
    }
}

export { GSplatContainer };
