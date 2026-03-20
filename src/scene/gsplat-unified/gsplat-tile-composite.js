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
 * Manages the tile-based composite for the local compute gsplat renderer. Instead of blitting a
 * full-screen quad, only tiles that contain splats are drawn using indirect rendering. The vertex
 * shader procedurally generates tile quads from the built-in vertex index and a storage buffer
 * of non-empty tile indices populated by the classify pass.
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

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node for the mesh instance.
     * @param {Function} isVisibleFunc - Visibility callback: `(camera) => boolean`.
     */
    constructor(device, node, isVisibleFunc) {
        this.device = device;

        this._material = new ShaderMaterial({
            uniqueName: 'GSplatTileComposite',
            vertexWGSL: '#include "gsplatTileCompositeVS"',
            fragmentWGSL: '#include "outputTex2DPS"'
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
    }

    destroy() {
        this._material.destroy();
        this._mesh.destroy();
        this._meshInstance.destroy();
    }

    get material() {
        return this._material;
    }

    get meshInstance() {
        return this._meshInstance;
    }

    /**
     * Per-frame update: binds the indirect draw slot and updates material parameters.
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
}

export { GSplatTileComposite };
