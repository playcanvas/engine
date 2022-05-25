import { Debug, TRACEID_RENDER_PASS } from '../core/debug.js';

/** @typedef {import('./render-pass.js').RenderPass} RenderPass */

/**
 * A frame graph represents a single rendering frame as a sequence of render passes.
 *
 * @ignore
 */
class FrameGraph {
    /** @type {RenderPass[]} */
    renderPasses = [];

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
            renderPasses[i].execute();
        }
    }
}

export { FrameGraph };
