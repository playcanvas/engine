import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_FORWARD } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 */

/**
 * Rasterizes stochastic splat samples using the engine's normal forward drawing.
 *
 * @ignore
 */
class GSplatSteadySamplePass extends RenderPass {
    /** @type {number|undefined} */
    gammaCorrection;

    /** @type {number|undefined} */
    toneMapping;

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GraphNode} cameraNode - View camera node.
     * @param {ForwardRenderer} forwardRenderer - Engine forward renderer.
     * @param {MeshInstance} meshInstance - Stochastic sample mesh.
     */
    constructor(device, cameraNode, forwardRenderer, meshInstance) {
        super(device);
        this.cameraNode = cameraNode;
        this.forwardRenderer = forwardRenderer;
        this.drawOptions = { meshInstances: [meshInstance] };
        this.name = 'GSplatSteadySample';
    }

    /**
     * @param {number|undefined} gammaCorrection - Effective forward-pass gamma correction.
     * @param {number|undefined} toneMapping - Effective forward-pass tone mapping.
     * @returns {boolean} Whether the sampling color domain changed.
     */
    setColorOptions(gammaCorrection, toneMapping) {
        const changed = this.gammaCorrection !== gammaCorrection || this.toneMapping !== toneMapping;
        this.gammaCorrection = gammaCorrection;
        this.toneMapping = toneMapping;
        return changed;
    }

    execute() {
        const component = this.cameraNode.camera;
        const originalGammaCorrection = component.gammaCorrection;
        const originalToneMapping = component.toneMapping;
        // Match RenderPassForward's per-draw color overrides, including restoration on failure.
        try {
            if (this.gammaCorrection !== undefined) component.gammaCorrection = this.gammaCorrection;
            if (this.toneMapping !== undefined) component.toneMapping = this.toneMapping;
            this.forwardRenderer.renderForwardLayer(component.camera,
                this.renderTarget, null, false, SHADER_FORWARD, this.drawOptions);
        } finally {
            if (this.gammaCorrection !== undefined) component.gammaCorrection = originalGammaCorrection;
            if (this.toneMapping !== undefined) component.toneMapping = originalToneMapping;
        }
    }
}

export { GSplatSteadySamplePass };
