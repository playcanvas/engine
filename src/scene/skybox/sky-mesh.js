import { CULLFACE_FRONT } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';

import { GAMMA_NONE, GAMMA_SRGBHDR, LAYERID_SKYBOX, SHADER_FORWARDHDR, TONEMAP_LINEAR } from '../constants.js';
import { Material } from '../materials/material.js';
import { MeshInstance } from '../mesh-instance.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { skybox } from '../shader-lib/programs/skybox.js';
import { SkyGeometry } from './sky-geometry.js';

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
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @param {import('../scene.js').Scene} scene - The scene owning the sky.
     * @param {import('../../platform/graphics/texture.js').Texture} texture - The texture of the sky.
     * @param {string} type - The type of the sky. One of the SKYMESH_* constants.
     */
    constructor(device, scene, node, texture, type) {

        const material = new Material();

        material.getShaderVariant = function (dev, sc, defs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {

            const options = {
                pass: pass,
                encoding: texture.encoding,
                useIntensity: scene.skyboxIntensity !== 1 || scene.physicalUnits,
                gamma: (pass === SHADER_FORWARDHDR ? (scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE) : scene.gammaCorrection),
                toneMapping: (pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping),
                skymesh: type
            };

            if (texture.cubemap) {
                options.type = 'cubemap';
                options.mip = texture.fixCubemapSeams ? scene.skyboxMip : 0;
                options.fixSeams = texture.fixCubemapSeams;
            } else {
                options.type = 'envAtlas';
            }

            const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);

            const library = getProgramLibrary(device);
            library.register('skybox', skybox);
            return library.getProgram('skybox', options, processingOptions);
        };

        if (texture.cubemap) {
            material.setParameter('texture_cubeMap', texture);
        } else {
            material.setParameter('texture_envAtlas', texture);
            material.setParameter('mipLevel', scene._skyboxMip);
        }

        material.cull = CULLFACE_FRONT;
        material.depthWrite = false;

        const skyLayer = scene.layers.getLayerById(LAYERID_SKYBOX);
        if (skyLayer) {

            const mesh = SkyGeometry.create(device, type);
            const meshInstance = new MeshInstance(mesh, material, node);
            this.meshInstance = meshInstance;

            meshInstance.cull = false;
            meshInstance._noDepthDrawGl1 = true;

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
