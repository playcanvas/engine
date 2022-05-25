/** @typedef {import('../graphics/render-target.js').RenderTarget} RenderTarget */

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
