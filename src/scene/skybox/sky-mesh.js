import { CULLFACE_FRONT } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { LAYERID_SKYBOX } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { skybox } from '../shader-lib/programs/skybox.js';
import { getMaterialShaderDefines } from '../shader-lib/utils.js';
import { SkyGeometry } from './sky-geometry.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Scene } from '../scene.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * A visual representation of the sky.
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

        const material = new ShaderMaterial();
        material.name = 'SkyMaterial';

        material.getShaderVariant = function (params) {

            const { scene, cameraShaderParams } = params;
            const options = {
                defines: getMaterialShaderDefines(this, cameraShaderParams),
                pass: params.pass,
                encoding: texture.encoding,
                gamma: cameraShaderParams.shaderOutputGamma,
                toneMapping: cameraShaderParams.toneMapping,
                skymesh: type
            };

            if (texture.cubemap) {
                options.type = 'cubemap';
                options.mip = scene.skyboxMip;
            } else {
                options.type = 'envAtlas';
            }

            const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat);

            const library = getProgramLibrary(device);
            library.register('skybox', skybox);
            return library.getProgram('skybox', options, processingOptions);
        };

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
