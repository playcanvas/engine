import {
    CULLFACE_NONE,
    PRIMITIVE_TRIANGLES
} from '../../platform/graphics/constants.js';
import { BLEND_PREMULTIPLIED } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Manages tile-based composites for the local compute gsplat renderer. Instead of blitting a
 * full-screen quad, only tiles that contain splats are drawn using indirect rendering. The vertex
 * shader procedurally generates tile quads from the built-in vertex index and a storage buffer
 * of non-empty tile indices populated by the classify pass.
 *
 * Owns two separate MeshInstance objects: a color instance (permanently in the layer, pick=false)
 * and a pick instance (never in any layer, returned on demand by prepareForPicking).
 *
 * @ignore
 */
class GSplatTileComposite {
    /** @type {GraphicsDevice} */
    device;

    /** @type {ShaderMaterial} */
    _material;

    /** @type {Mesh} */
    _mesh;

    /** @type {MeshInstance} */
    _meshInstance;

    /** @type {ShaderMaterial|null} */
    _pickMaterial = null;

    /** @type {MeshInstance|null} */
    _pickMeshInstance = null;

    /** @type {GraphNode} */
    _node;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node for the mesh instance.
     * @param {Function} isVisibleFunc - Visibility callback: `(camera) => boolean`.
     */
    constructor(device, node, isVisibleFunc) {
        this.device = device;
        this._node = node;

        this._material = new ShaderMaterial({
            uniqueName: 'GSplatTileComposite',
            vertexWGSL: '#include "gsplatTileCompositeVS"',
            fragmentWGSL: '#include "gsplatTileCompositePS"'
        });

        this._material.blendType = BLEND_PREMULTIPLIED;
        this._material.cull = CULLFACE_NONE;
        this._material.depthWrite = false;
        this._material.update();

        this._mesh = new Mesh(device);
        this._mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
        this._mesh.primitive[0].base = 0;
        this._mesh.primitive[0].count = 0;
        this._mesh.primitive[0].indexed = false;

        this._meshInstance = new MeshInstance(this._mesh, this._material);
        this._meshInstance.node = node;
        this._meshInstance.instancingCount = 1;
        this._meshInstance.isVisibleFunc = isVisibleFunc;
        this._meshInstance.pick = false;
    }

    destroy() {
        this._material.destroy();
        this._mesh.destroy();
        this._meshInstance.destroy();

        this._pickMaterial?.destroy();
        this._pickMeshInstance?.destroy();
    }

    get material() {
        return this._material;
    }

    get meshInstance() {
        return this._meshInstance;
    }

    /**
     * Per-frame update for color rendering: binds the indirect draw slot and updates material
     * parameters on the color mesh instance.
     *
     * @param {number} drawSlot - The indirect draw slot reserved for this frame.
     * @param {Texture} outputTexture - The compute-rasterized splat texture.
     * @param {StorageBuffer} rasterizeTileList - Buffer of non-empty tile indices.
     * @param {number} numTilesX - Number of tiles horizontally.
     * @param {number} screenWidth - Viewport width in pixels.
     * @param {number} screenHeight - Viewport height in pixels.
     */
    update(drawSlot, outputTexture, rasterizeTileList, numTilesX, screenWidth, screenHeight) {
        this._meshInstance.setIndirect(null, drawSlot, 1);

        this._material.setParameter('source', outputTexture);
        this._material.setParameter('rasterizeTileList', rasterizeTileList);
        this._material.setParameter('numTilesX', numTilesX);
        this._material.setParameter('screenWidth', screenWidth);
        this._material.setParameter('screenHeight', screenHeight);
    }

    /**
     * Lazily creates the pick material and mesh instance, configures them with pick textures
     * and tile parameters, and returns the pick mesh instance for the picker to render.
     *
     * @param {number} drawSlot - The indirect draw slot.
     * @param {Texture} pickIdTexture - Compute-generated pick ID texture (r32uint).
     * @param {Texture} pickDepthTexture - Compute-generated pick depth texture (rgba16float).
     * @param {StorageBuffer} rasterizeTileList - Buffer of non-empty tile indices.
     * @param {number} numTilesX - Number of tiles horizontally.
     * @param {number} screenWidth - Viewport width in pixels.
     * @param {number} screenHeight - Viewport height in pixels.
     * @returns {MeshInstance} The configured pick mesh instance.
     */
    prepareForPicking(drawSlot, pickIdTexture, pickDepthTexture, rasterizeTileList, numTilesX, screenWidth, screenHeight) {
        if (!this._pickMaterial) {
            this._pickMaterial = new ShaderMaterial({
                uniqueName: 'GSplatTileCompositePick',
                vertexWGSL: '#include "gsplatTileCompositeVS"',
                fragmentWGSL: '#include "gsplatTileCompositePS"'
            });

            this._pickMaterial.setDefine('PICK_MODE', true);
            this._pickMaterial.cull = CULLFACE_NONE;
            this._pickMaterial.depthWrite = false;
            this._pickMaterial.update();

            this._pickMeshInstance = new MeshInstance(this._mesh, this._pickMaterial);
            this._pickMeshInstance.node = this._node;
            this._pickMeshInstance.instancingCount = 1;
        }

        const pickMI = /** @type {MeshInstance} */ (this._pickMeshInstance);
        const pickMat = /** @type {ShaderMaterial} */ (this._pickMaterial);

        pickMI.setIndirect(null, drawSlot, 1);

        pickMat.setParameter('pickIdTexture', pickIdTexture);
        pickMat.setParameter('pickDepthTexture', pickDepthTexture);
        pickMat.setParameter('rasterizeTileList', rasterizeTileList);
        pickMat.setParameter('numTilesX', numTilesX);
        pickMat.setParameter('screenWidth', screenWidth);
        pickMat.setParameter('screenHeight', screenHeight);

        return pickMI;
    }
}

export { GSplatTileComposite };
