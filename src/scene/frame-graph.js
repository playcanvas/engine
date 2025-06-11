import { Debug } from '../core/debug.js';

/**
 * @import { RenderPass } from '../platform/graphics/render-pass.js'
 * @import { RenderTarget } from '../platform/graphics/render-target.js'
 * @import { Texture } from '../platform/graphics/texture.js'
 */

/**
 * A frame graph represents a single rendering frame as a sequence of render passes.
 *
 * @ignore
 */
class FrameGraph {
    /** @type {RenderPass[]} */
    renderPasses = [];

    /**
     * Map used during frame graph compilation. It maps a render target to its previous occurrence.
     *
     *  @type {Map<RenderTarget, RenderPass>}
     */
    renderTargetMap = new Map();

    /**
     * Add a render pass to the frame.
     *
     * @param {RenderPass} renderPass - The render pass to add.
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

        // merge passes if possible
        for (let i = 0; i < renderPasses.length - 1; i++) {
            const firstPass = renderPasses[i];
            const firstRT = firstPass.renderTarget;
            const secondPass = renderPasses[i + 1];
            const secondRT = secondPass.renderTarget;

            // if the render targets are different, we can't merge the passes
            // also only merge passes that have a render target
            if (firstRT !== secondRT || firstRT === undefined) {
                continue;
            }

            // do not merge if the second pass clears any of the attachments
            if (secondPass.depthStencilOps.clearDepth ||
                secondPass.depthStencilOps.clearStencil ||
                secondPass.colorArrayOps.some(colorOps => colorOps.clear)) {
                continue;
            }

            // first pass cannot contain after passes
            if (firstPass.afterPasses.length > 0) {
                continue;
            }

            // second pass cannot contain before passes
            if (secondPass.beforePasses.length > 0) {
                continue;
            }

            // merge the passes
            firstPass._skipEnd = true;
            secondPass._skipStart = true;
        }

        // Walk over render passes to find passes rendering to the same cubemap texture.
        // If those passes are separated only by passes not requiring cubemap (shadows ..),
        // we skip the mipmap generation till the last rendering to the cubemap, to avoid
        // mipmaps being generated after each face.
        /** @type {Texture} */
        let lastCubeTexture = null;
        /** @type {RenderPass} */
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
