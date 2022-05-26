import { Debug, TRACEID_RENDER_PASS } from '../core/debug.js';
import { DebugGraphics } from '../graphics/debug-graphics.js';

/** @typedef {import('./render-pass.js').RenderPass} RenderPass */
/** @typedef {import('../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * A frame graph represents a single rendering frame as a sequence of render passes.
 *
 * @ignore
 */
class FrameGraph {
    /** @type {RenderPass[]} */
    renderPasses = [];

    /**
     * Create a new FrameGraph instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this texture.
     */
    constructor(graphicsDevice) {
        this.device = graphicsDevice;
    }

    /**
     * Add a render pass to the frame.
     *
     * @param {RenderPass} renderPass - The render pass to add.
     */
    add(renderPass) {
        Debug.trace(TRACEID_RENDER_PASS,
                    `RenderPass ${this.renderPasses.length}: ` +
                    `RT: ${(renderPass.renderTarget ? renderPass.renderTarget.name : '').padEnd(30, ' ')} ` +
                    `Name: ${renderPass.name}`);

        this.renderPasses.push(renderPass);
    }

    reset() {
        this.renderPasses.length = 0;
    }

    render() {
        const renderPasses = this.renderPasses;
        for (let i = 0; i < renderPasses.length; i++) {
            const renderPass = renderPasses[i];

            DebugGraphics.pushGpuMarker(this.device, `Pass:${renderPass.name}`);

            renderPass.execute();

            DebugGraphics.popGpuMarker(this.device);
        }
    }
}

export { FrameGraph };
