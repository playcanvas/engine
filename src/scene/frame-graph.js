import { Debug } from '../core/debug.js';

/**
 * A frame graph represents a single rendering frame as a sequence of render passes.
 *
 * @ignore
 */
class FrameGraph {
    /** @type {import('../platform/graphics/render-pass.js').RenderPass[]} */
    renderPasses = [];

    /**
     * Map used during frame graph compilation. It maps a render target to its previous occurrence.
     *
     *  @type {Map<import('../platform/graphics/render-target.js').RenderTarget, import('../platform/graphics/render-pass.js').RenderPass>}
     */
    renderTargetMap = new Map();

    /**
     * Add a render pass to the frame.
     *
     * @param {import('../platform/graphics/render-pass.js').RenderPass} renderPass - The render
     * pass to add.
     */
    addRenderPass(renderPass) {
        Debug.assert(renderPass);
        renderPass.frameUpdate();

        const beforePasses = renderPass.beforePasses;
        for (let i = 0; i < beforePasses.length; i++) {
            const pass = beforePasses[i];
            if (pass.enabled) {
                this.addRenderPass(pass);
            }
        }

        if (renderPass.enabled) {
            this.renderPasses.push(renderPass);
        }

        const afterPasses = renderPass.afterPasses;
        for (let i = 0; i < afterPasses.length; i++) {
            const pass = afterPasses[i];
            if (pass.enabled) {
                this.addRenderPass(pass);
            }
        }
    }

    reset() {
        this.renderPasses.length = 0;
    }

    compile() {

        const renderTargetMap = this.renderTargetMap;
        const renderPasses = this.renderPasses;
        for (let i = 0; i < renderPasses.length; i++) {
            const renderPass = renderPasses[i];
            const renderTarget = renderPass.renderTarget;

            // if using a target, or null which represents the default back-buffer
            if (renderTarget !== undefined) {

                // previous pass using the same render target
                const prevPass = renderTargetMap.get(renderTarget);
                if (prevPass) {

                    // if we use the RT without clearing, make sure the previous pass stores data
                    const count = renderPass.colorArrayOps.length;
                    for (let j = 0; j < count; j++) {
                        const colorOps = renderPass.colorArrayOps[j];
                        if (!colorOps.clear) {
                            prevPass.colorArrayOps[j].store = true;
                        }
                    }
                    if (!renderPass.depthStencilOps.clearDepth) {
                        prevPass.depthStencilOps.storeDepth = true;
                    }
                    if (!renderPass.depthStencilOps.clearStencil) {
                        prevPass.depthStencilOps.storeStencil = true;
                    }
                }

                // add the pass to the map
                renderTargetMap.set(renderTarget, renderPass);
            }
        }

        // Walk over render passes to find passes rendering to the same cubemap texture.
        // If those passes are separated only by passes not requiring cubemap (shadows ..),
        // we skip the mipmap generation till the last rendering to the cubemap, to avoid
        // mipmaps being generated after each face.
        /** @type {import('../platform/graphics/texture.js').Texture} */
        let lastCubeTexture = null;
        /** @type {import('../platform/graphics/render-pass.js').RenderPass} */
        let lastCubeRenderPass = null;
        for (let i = 0; i < renderPasses.length; i++) {
            const renderPass = renderPasses[i];
            const renderTarget = renderPass.renderTarget;
            const thisTexture = renderTarget?.colorBuffer;

            if (thisTexture?.cubemap) {

                // if previous pass used the same cubemap texture, it does not need mipmaps generated
                if (lastCubeTexture === thisTexture) {
                    const count = lastCubeRenderPass.colorArrayOps.length;
                    for (let j = 0; j < count; j++) {
                        lastCubeRenderPass.colorArrayOps[j].mipmaps = false;
                    }
                }

                lastCubeTexture = renderTarget.colorBuffer;
                lastCubeRenderPass = renderPass;

            } else if (renderPass.requiresCubemaps) {

                // if the cubemap is required, break the cubemap rendering chain
                lastCubeTexture = null;
                lastCubeRenderPass = null;
            }
        }

        renderTargetMap.clear();
    }

    render(device) {

        this.compile();

        const renderPasses = this.renderPasses;
        for (let i = 0; i < renderPasses.length; i++) {
            renderPasses[i].render();
        }
    }
}

export { FrameGraph };
