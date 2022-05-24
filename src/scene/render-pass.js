/** @typedef {import('../graphics/render-target.js').RenderTarget} RenderTarget */

class RenderPass {
    constructor(name, renderTarget, execute) {
        /** @type {RenderTarget} */
        this.renderTarget = renderTarget;

        /** @type {string} */
        this.name = name;

        this.execute = execute;
    }
}

export { RenderPass };
