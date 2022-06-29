import { TRACEID_RENDER_PASS, TRACEID_RENDER_PASS_DETAIL } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { Tracing } from '../core/tracing.js';

/** @typedef {import('../graphics/render-pass.js').RenderPass} RenderPass */
/** @typedef {import('../graphics/render-target.js').RenderTarget} RenderTarget */
/** @typedef {import('../graphics/texture.js').Texture} Texture */

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
        this.renderPasses.push(renderPass);
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

            // if using a target, or null which represents the default framebuffer
            if (renderTarget !== undefined) {

                // previous pass using the same render target
                const prevPass = renderTargetMap.get(renderTarget);
                if (prevPass) {

                    // if we use the RT without clearing, make sure the previous pass stores data
                    if (!renderPass.colorOps.clear) {
                        prevPass.colorOps.store = true;
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
        /** @type {Texture} */
        let lastCubeTexture = null;
        /** @type {RenderPass} */
        let lastCubeRenderPass = null;
        for (let i = 0; i < renderPasses.length; i++) {
            const renderPass = renderPasses[i];
            const renderTarget = renderPass.renderTarget;
            const thisTexture = renderTarget?.colorBuffer;

            if (thisTexture?.cubemap) {

                // if previous pass used the same cubemap texture, it does not need mimaps generated
                if (lastCubeTexture === thisTexture) {
                    lastCubeRenderPass.colorOps.mipmaps = false;
                }

                lastCubeTexture = renderTarget.colorBuffer;
                lastCubeRenderPass = renderPass;

            } else if (renderPass.requiresCubemaps) {

                // if the cubemap is required, break the cubemap rendering chain
                lastCubeTexture = null;
                lastCubeRenderPass = null;
            }
        }

        // handle what's left in the map - last passes rendering to each render target
        renderTargetMap.forEach((renderPass, renderTarget) => {

            // default framebuffer
            if (renderTarget === null) {

                // store the multisampled buffer
                renderPass.colorOps.store = true;

                // no resolve, no mipmaps
                renderPass.colorOps.resolve = false;
                renderPass.colorOps.mipmaps = false;
            }
        });

        renderTargetMap.clear();

        this.log();
    }

    render() {

        this.compile();

        const renderPasses = this.renderPasses;
        for (let i = 0; i < renderPasses.length; i++) {
            renderPasses[i].render();
        }
    }

    log() {
        // #if _DEBUG
        if (Tracing.get(TRACEID_RENDER_PASS) || Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {

            this.renderPasses.forEach((renderPass, index) => {

                const rt = renderPass.renderTarget === undefined ? '' : ` RT: ${(renderPass.renderTarget ? renderPass.renderTarget.name : 'NULL')} ` +
                    `${renderPass.renderTarget?.colorBuffer ? '[Color]' : ''}` +
                    `${renderPass.renderTarget?.depth ? '[Depth]' : ''}` +
                    `${renderPass.renderTarget?.stencil ? '[Stencil]' : ''}` +
                    `${(renderPass.samples > 0 ? ' samples: ' + renderPass.samples : '')}`;

                Debug.trace(TRACEID_RENDER_PASS,
                            `${index.toString().padEnd(2, ' ')}: ${renderPass.name.padEnd(20, ' ')}` +
                            rt.padEnd(30));

                if (renderPass.colorOps) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    colorOps: ` +
                                `${renderPass.colorOps.clear ? 'clear' : 'load'}->` +
                                `${renderPass.colorOps.store ? 'store' : 'discard'} ` +
                                `${renderPass.colorOps.resolve ? 'resolve ' : ''}` +
                                `${renderPass.colorOps.mipmaps ? 'mipmaps ' : ''}`);
                }

                if (renderPass.depthStencilOps) {
                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    depthOps: ` +
                                `${renderPass.depthStencilOps.clearDepth ? 'clear' : 'load'}->` +
                                `${renderPass.depthStencilOps.storeDepth ? 'store' : 'discard'}`);

                    Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    stencOps: ` +
                                `${renderPass.depthStencilOps.clearStencil ? 'clear' : 'load'}->` +
                                `${renderPass.depthStencilOps.storeStencil ? 'store' : 'discard'}`);
                }
            });
        }
        // #endif
    }
}

export { FrameGraph };
