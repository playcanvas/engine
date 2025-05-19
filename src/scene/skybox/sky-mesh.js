import { CULLFACE_FRONT, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { LAYERID_SKYBOX, SKYTYPE_INFINITE } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { SkyGeometry } from './sky-geometry.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Scene } from '../scene.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * A visual representation of the sky.
 *
 * @ignore
 */
class SkyMesh {
    /**
     * Mesh instance representing the visuals of the sky.
     *
     * @type {MeshInstance|null}
     */
    meshInstance = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Scene} scene - The scene owning the sky.
     * @param {GraphNode} node - The graph node of the sky mesh instance.
     * @param {Texture} texture - The texture of the sky.
     * @param {string} type - The type of the sky. One of the SKYMESH_* constants.
     */
    constructor(device, scene, node, texture, type) {

        const material = new ShaderMaterial({
            uniqueName: 'SkyMaterial',
            vertexGLSL: ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('skyboxVS'),
            fragmentGLSL: ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('skyboxPS'),
            vertexWGSL: ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('skyboxVS'),
            fragmentWGSL: ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('skyboxPS'),
            attributes: {
                aPosition: SEMANTIC_POSITION
            }
        });

        // defines
        material.setDefine('{SKYBOX_DECODE_FNC}', ChunkUtils.decodeFunc(texture.encoding));
        if (type !== SKYTYPE_INFINITE) material.setDefine('SKYMESH', '');
        if (texture.cubemap) material.setDefine('SKY_CUBEMAP', '');

        material.setParameter('skyboxHighlightMultiplier', scene.skyboxHighlightMultiplier);

        if (texture.cubemap) {
            material.setParameter('texture_cubeMap', texture);
        } else {
            material.setParameter('texture_envAtlas', texture);
            material.setParameter('mipLevel', scene.skyboxMip);
        }

        material.cull = CULLFACE_FRONT;
        material.depthWrite = false;

        const skyLayer = scene.layers.getLayerById(LAYERID_SKYBOX);
        if (skyLayer) {

            const mesh = SkyGeometry.create(device, type);
            const meshInstance = new MeshInstance(mesh, material, node);
            this.meshInstance = meshInstance;

            meshInstance.cull = false;

            // disable picker, the material has custom update shader and does not handle picker variant
            meshInstance.pick = false;

            skyLayer.addMeshInstances([meshInstance]);

            this.skyLayer = skyLayer;
        }
    }

    destroy() {
        if (this.meshInstance) {
            if (this.skyLayer) {
                this.skyLayer.removeMeshInstances([this.meshInstance]);
            }
            this.meshInstance.destroy();
            this.meshInstance = null;
        }
    }
}

export { SkyMesh };
