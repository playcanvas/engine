import { Debug } from '../core/debug.js';
import { FramePassMultiView } from './renderer/frame-pass-multi-view.js';

/**
 * @import { FramePass } from '../platform/graphics/frame-pass.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { RenderPass } from '../platform/graphics/render-pass.js'
 * @import { RenderTarget } from '../platform/graphics/render-target.js'
 */

/**
 * A frame graph represents a single rendering frame as a sequence of frame passes.
 *
 * @ignore
 */
class FrameGraph {
    /** @type {FramePass[]} */
    passes = [];

    /**
     * Map used during frame graph compilation. It maps a render target to its previous occurrence.
     *
     * @type {Map<RenderTarget, RenderPass>}
     */
    renderTargetMap = new Map();

    /**
     * Active multi-view capture wrapper. When non-null, passes scheduled via
     * {@link FrameGraph#addPass} are appended as children of this wrapper instead of being
     * pushed directly into {@link FrameGraph#passes}. Set/cleared via
     * {@link FrameGraph#beginMultiView} / {@link FrameGraph#endMultiView}.
     *
     * @type {FramePassMultiView|null}
     */
    multiview = null;

    /**
     * Open a multi-view capture scope. Subsequent passes added through
     * {@link FrameGraph#addPass} are captured as children of a single
     * {@link FramePassMultiView} until {@link FrameGraph#endMultiView} is called.
     *
     * @param {GraphicsDevice} device - The graphics device used to construct the wrapper.
     */
    beginMultiView(device) {
        Debug.assert(!this.multiview, 'FrameGraph.beginMultiView called while a scope is already open');
        this.multiview = new FramePassMultiView(device);
    }

    /**
     * Close the multi-view capture scope. Pushes the wrapper into the frame graph passes
     * unless it captured no children (in which case it is dropped).
     *
     * A captured pass which does not render per view (see {@link FramePass#perView}), such as the
     * shadow pass of a directional light, or a compute pass executing before the views, is moved
     * out of the wrapper ahead of it, so it renders once before all the views. This is not done when another such pass of the scope renders to
     * the same target, such as the shadow passes of a light shared by several cameras rendered in
     * the scope. Each of those renders the target for the passes following it, and so keeps its
     * place between them, rendering per view.
     */
    endMultiView() {
        const wrap = this.multiview;
        this.multiview = null;
        if (!wrap) {
            return;
        }

        // move the passes which render once for all the views out of the wrapper, compacting the
        // passes staying in it in place. The moved passes are added to the frame before the
        // wrapper, which is added last, so they render before all the views.
        const children = wrap.children;
        let kept = 0;
        for (let i = 0; i < children.length; i++) {
            const pass = children[i];
            if (!pass.perView && !this._sharesTarget(children, pass)) {
                this.passes.push(pass);
            } else {
                children[kept++] = pass;
            }
        }
        children.length = kept;

        // drop the wrapper when no pass renders per view
        if (kept) {
            this.passes.push(wrap);
        }
    }

    /**
     * Returns true when another pass which does not render per view renders to the same target
     * as the pass. A pass without a target, such as a compute pass executing before the views,
     * shares none.
     *
     * @param {FramePass[]} passes - The passes of a multi-view capture scope.
     * @param {FramePass} pass - The pass to test.
     * @returns {boolean} True when the target is shared.
     * @private
     */
    _sharesTarget(passes, pass) {
        // an undefined target would compare equal to the undefined target of another such pass
        if (pass.renderTarget === undefined) {
            return false;
        }
        for (let i = 0; i < passes.length; i++) {
            const other = passes[i];
            if (other !== pass && !other.perView && other.renderTarget === pass.renderTarget) {
                return true;
            }
        }
        return false;
    }

    /**
     * Add a frame pass to the frame, together with its before and after passes. A disabled pass
     * is skipped with all of them, and its {@link FramePass#frameUpdate} is not called.
     *
     * @param {FramePass} pass - The frame pass to add.
     */
    addPass(pass) {
        Debug.assert(pass);

        if (!pass.enabled) {
            return;
        }

        // a destroyed pass is not used again, see FramePass#destroy
        Debug.assertDestroyed(pass);

        // can add or remove before and after passes, and enable or disable them, but not disable the
        // pass itself
        pass.frameUpdate();

        // the passes the engine added for the frame execute first, as the passes set up by the user
        // can depend on them
        const internalBeforePasses = pass.internalBeforePasses;
        for (let i = 0; i < internalBeforePasses.length; i++) {
            this.addPass(internalBeforePasses[i]);
        }

        const beforePasses = pass.beforePasses;
        for (let i = 0; i < beforePasses.length; i++) {
            this.addPass(beforePasses[i]);
        }

        // a pass disabled while it is scheduled, by its frameUpdate or by its before-passes, is not
        // supported, as it has already set itself up for the frame, for example as the first or the
        // last pass rendering a camera. It stays out of the compile step
        Debug.assert(pass.enabled, `The frame pass '${pass.name}' was disabled while it was added to the frame, by its frameUpdate or by its before-passes, which is not supported. Disable it before the frame is built, or set its executeEnabled to false instead.`, pass);
        if (pass.enabled) {
            if (this.multiview) {
                this.multiview.addChild(pass);
            } else {
                this.passes.push(pass);
            }
        }

        const afterPasses = pass.afterPasses;
        for (let i = 0; i < afterPasses.length; i++) {
            this.addPass(afterPasses[i]);
        }
    }

    reset() {
        this.passes.length = 0;
    }

    compile() {
        this._compilePasses(this.passes);

        // apply the same pass-merging optimizations to each multi-view wrapper's children so
        // within-eye sequences benefit from the same optimizations as top-level passes
        for (let i = 0; i < this.passes.length; i++) {
            const pass = this.passes[i];
            if (pass instanceof FramePassMultiView) {
                this._compilePasses(pass.children);
            }
        }
    }

    /**
     * Run the frame-graph compile optimizations (store-on-no-clear, pass merging) over a flat list
     * of passes.
     *
     * @param {FramePass[]} passes - Passes to optimize.
     * @private
     */
    _compilePasses(passes) {

        const renderTargetMap = this.renderTargetMap;

        for (let i = 0; i < passes.length; i++) {
            const pass = passes[i];
            pass._skipStart = false;
            pass._skipEnd = false;

            const renderTarget = pass.renderTarget;

            // if using a target, or null which represents the default back-buffer. A pass which does
            // not execute does not touch its target, so the store request of the next pass using it
            // goes to the last pass which writes it
            if (renderTarget !== undefined && pass.executeEnabled) {

                // previous pass using the same render target
                const prevPass = renderTargetMap.get(renderTarget);
                if (prevPass) {

                    // if we use the RT without clearing, make sure the previous pass stores data
                    const count = pass.colorArrayOps.length;
                    for (let j = 0; j < count; j++) {
                        const colorOps = pass.colorArrayOps[j];
                        if (!colorOps.clear) {
                            prevPass.colorArrayOps[j].store = true;
                        }
                    }
                    if (!pass.depthStencilOps.clearDepth) {
                        prevPass.depthStencilOps.storeDepth = true;
                    }
                    if (!pass.depthStencilOps.clearStencil) {
                        prevPass.depthStencilOps.storeStencil = true;
                    }
                }

                // add the pass to the map
                renderTargetMap.set(renderTarget, pass);
            }
        }

        // merge passes if possible
        for (let i = 0; i < passes.length - 1; i++) {
            const firstPass = passes[i];
            const firstRT = firstPass.renderTarget;
            const secondPass = passes[i + 1];
            const secondRT = secondPass.renderTarget;

            // if the render targets are different, we can't merge the passes
            // also only merge passes that have a render target
            if (firstRT !== secondRT || firstRT === undefined) {
                continue;
            }

            // a pass which does not execute does not start or end its GPU render pass either, which
            // the other merged pass would depend on
            if (!firstPass.executeEnabled || !secondPass.executeEnabled) {
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
            if (secondPass.beforePasses.length > 0 || secondPass.internalBeforePasses.length > 0) {
                continue;
            }

            // the callbacks running between the passes run outside of a GPU render pass, for example
            // to read back what the first pass rendered
            if (firstPass.onAfter || secondPass.onBefore) {
                continue;
            }

            // merge the passes
            firstPass._skipEnd = true;
            secondPass._skipStart = true;
        }

        renderTargetMap.clear();
    }

    render(device) {

        this.compile();

        const passes = this.passes;
        for (let i = 0; i < passes.length; i++) {
            passes[i].render();
        }
    }
}

export { FrameGraph };
