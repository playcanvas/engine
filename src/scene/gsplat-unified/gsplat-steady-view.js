import { SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { PROJECTION_PERSPECTIVE } from '../constants.js';

/**
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 */

// Projection and output modifiers preserve the Gaussian coverage used by the resampling PDF.
const supportedChunks = new Set([
    'gsplatModifyVS', 'gsplatOutputVS', 'decodePS', 'gammaPS', 'fogPS', 'fogMathPS', 'tonemappingPS'
]);

/**
 * Shared view admission for the WebGPU and WebGL2 reconstruction paths. Unsupported coverage
 * must retain native sorting because its acceptance probability is absent from the Gaussian PDF.
 *
 * @ignore
 */
class GSplatSteadyView {
    /** @type {string|undefined} */
    _coverageChunksKey;

    _coverageSupported = true;

    /**
     * @param {string} shaderLanguage - Backend shader language.
     * @param {ForwardRenderer} forwardRenderer - Forward renderer providing the current scene.
     * @param {MeshInstance[]} meshInstances - This renderer's meshes, excluded from depth checks.
     */
    constructor(shaderLanguage, forwardRenderer, meshInstances) {
        this.shaderLanguage = shaderLanguage;
        this.forwardRenderer = forwardRenderer;
        this.meshInstances = meshInstances;
    }

    /**
     * @param {GSplatRenderViewParams} params - Current view settings.
     * @returns {boolean} Whether this view supports importance resampling.
     */
    supports(params) {
        const camera = params.cameraNode.camera.camera;
        const rect = camera.rect;
        const material = params.material;
        const chunks = material.hasShaderChunks ? material.getShaderChunks(this.shaderLanguage) : null;
        const chunksKey = chunks?.key;
        if (chunksKey !== this._coverageChunksKey) {
            this._coverageChunksKey = chunksKey;
            this._coverageSupported = true;
            if (chunks) {
                for (const name of chunks.keys()) {
                    if (!supportedChunks.has(name)) {
                        this._coverageSupported = false;
                        break;
                    }
                }
            }
        }
        if (!this._coverageSupported ||
            (this.shaderLanguage === SHADERLANGUAGE_WGSL && material.hasShaderChunks && !material.shaderChunks.useWGSL) ||
            camera.xrActive || camera.projection !== PROJECTION_PERSPECTIVE || params.fisheye ||
            rect.x !== 0 || rect.y !== 0 || rect.z !== 1 || rect.w !== 1 ||
            params.varyings.words || params.overdraw || camera.clippingPlanes?.length) return false;

        // Both backends recover device depth from linear depth. An oblique
        // projection whose z or w also depends on x/y cannot use that reconstruction.
        const projection = camera.projectionMatrix.data;
        if (projection[2] !== 0 || projection[6] !== 0 || projection[3] !== 0 || projection[7] !== 0) return false;

        // Other cameras' splat meshes share layers, but their visibility callbacks exclude them.
        const composition = this.forwardRenderer.scene.layers;
        for (let i = 0; i < camera.layers.length; i++) {
            const layer = composition.getLayerById(camera.layers[i]);
            if (layer?.enabled) {
                const meshes = layer.meshInstances;
                for (let j = 0; j < meshes.length; j++) {
                    const mesh = meshes[j];
                    if (!this.meshInstances.includes(mesh) && mesh.visible && mesh.material.depthWrite &&
                        (!mesh.isVisibleFunc || mesh.isVisibleFunc(camera))) return false;
                }
            }
        }
        return true;
    }
}

export { GSplatSteadyView };
