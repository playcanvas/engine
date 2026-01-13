import { Vec2 } from '../../core/math/vec2.js';
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
 * @category Graphics
 */
class GSplatContainer extends GSplatResourceBase {
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
        this.textureSize = size.x;
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
    configureMaterial(material) {
        // Call base to set defines, bind textures, and set textureSize
        super.configureMaterial(material);

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
