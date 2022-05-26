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

    /**
     * Creates an instance of the RenderPass.
     *
     * @param {RenderTarget} renderTarget - The render target to render into (output).
     * @param {Function} execute - Custom function that is called when the pass needs to be
     * rendered.
     */
    constructor(renderTarget, execute) {
        /** @type {RenderTarget} */
        this.renderTarget = renderTarget;

        /** @type {Function} */
        this.execute = execute;
    }
}

export { RenderPass };
