/** @typedef {import('../graphics/render-target.js').RenderTarget} RenderTarget */

/**
 * A render pass represents a node in the frame graph, and encapsulates a system which
 * renders to a render target using an execution callback.
 *
 * @ignore
 */
class RenderPass {
    /** @type {string} */
    name;

    constructor(renderTarget, execute) {
        /** @type {RenderTarget} */
        this.renderTarget = renderTarget;

        this.execute = execute;
    }
}

export { RenderPass };
