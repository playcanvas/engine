import { FramePass } from '../../platform/graphics/frame-pass.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * A frame pass that wraps an ordered list of child frame passes and runs them once per XR view.
 * Currently used by the WebGPU XR path: per eye, the wrapper sets the active view index on the
 * graphics device, swaps the backbuffer color view to the matching XR sub-image view descriptor,
 * and invokes each child's `render()`.
 *
 * The children are not added to {@link FrameGraph#renderPasses} - they are owned by the wrapper
 * and invoked from {@link FramePassMultiView#render}. This guarantees the frame graph's
 * pass-merging cannot accidentally merge eye-N's last pass with eye-(N+1)'s first pass.
 *
 * ## Future extension paths
 *
 * ### GPU-native multiview (single-pass stereo)
 * Both WebGL (`OVR_multiview2`) and a future WebGPU multiview extension allow the GPU to render
 * all views in **one draw call**, writing to each array layer simultaneously via
 * `gl_ViewID_OVR` (WebGL) or `@builtin(view_index)` (WGSL). When those APIs become available
 * this class is the right place to switch strategy: instead of looping N times, `render()` would
 * configure a single multiview render pass targeting an array render target, upload all N view
 * matrices as an array UBO, and issue children once. The serial-iteration path would remain as a
 * fallback when the extension is absent.
 *
 * ### WebGL stereo
 * WebGL XR currently uses a single framebuffer with per-eye viewports (no wrapper needed).
 * If `OVR_multiview2` support is added, `ForwardRenderer._isMultiview` could be extended to
 * return `true` for WebGL when the extension is present, allowing this wrapper to orchestrate
 * the multiview setup on both backends with a shared code path.
 *
 * @ignore
 */
class FramePassMultiView extends FramePass {
    /**
     * Ordered list of child passes executed once per XR view.
     *
     * @type {FramePass[]}
     */
    children = [];

    /**
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     */
    constructor(graphicsDevice) {
        super(graphicsDevice);
        this.name = 'FramePassMultiView';
    }

    /**
     * Append a child pass to be replayed per view.
     *
     * @param {FramePass} pass - The pass to add.
     */
    addChild(pass) {
        this.children.push(pass);
    }

    render() {
        if (!this.enabled) return;

        const device = this.device;
        const subs = device.xrSubImages;
        const numViews = subs?.length ?? 0;
        const children = this.children;
        const childCount = children.length;

        // fall back to running children once if no per-view sub-images are available; this lets the
        // wrapper degrade gracefully (rendering into whatever the device already has bound) instead
        // of dropping the frame entirely
        if (numViews === 0) {
            for (let c = 0; c < childCount; c++) {
                children[c].render();
            }
            return;
        }

        const backBufferImpl = device.backBuffer?.impl;

        // snapshot device-level XR state and the backbuffer's color texture before the per-eye
        // loop so we can restore everything once we're done:
        //
        // - xrColorTexture: if not restored, frameStart on the *next* frame picks up the last
        //   eye's sub-image texture as the output color buffer instead of the canvas swapchain.
        //   In real WebGPU XR the bridge sets and clears this itself; saving/restoring here is
        //   a no-op in that case because saved == per-eye == XR projection texture.
        //
        // - backbuffer assignedColorTexture: lets passes after the wrapper (composite camera,
        //   HUD, …) keep targeting the original backbuffer instead of the last eye's sub-image.
        const savedXrColorTexture = device.xrColorTexture;
        const savedColorTexture = backBufferImpl?.assignedColorTexture ?? null;
        const savedViewFormat = backBufferImpl?.colorAttachments?.[0]?.format ?? null;

        for (let v = 0; v < numViews; v++) {
            const sub = subs[v];

            device.xrCurrentViewIndex = v;
            device.xrColorTexture = sub.colorTexture;
            device.xrColorTextureViewDescriptor = sub.viewDescriptor;

            // refresh the backbuffer's color attachment view to point to the active eye's sub-image
            backBufferImpl?.assignColorTexture?.(sub.colorTexture, sub.viewFormat);

            for (let c = 0; c < childCount; c++) {
                children[c].render();
            }
        }

        // Clear only wrapper-owned XR device fields. Do not call _clearXrState() here: that also
        // clears xrSubImages / xrColorTextureViewFormat for the frame, which would break a second
        // FramePassMultiView in the same frame (numViews would read as 0). The XR bridge clears
        // full state at endFrame.
        device.xrCurrentViewIndex = -1;
        device.xrColorTextureViewDescriptor = null;
        device.xrColorTexture = savedXrColorTexture ?? null;

        // restore the backbuffer to whatever it was bound to before the per-eye loop, but only if
        // it actually changed - skips the cost of a redundant view re-creation in the common XR
        // case where every sub-image targets the same projection-layer texture
        if (
            backBufferImpl && savedColorTexture && savedViewFormat &&
            backBufferImpl.assignedColorTexture !== savedColorTexture
        ) {
            backBufferImpl.assignColorTexture(savedColorTexture, savedViewFormat);
        }
    }
}

export { FramePassMultiView };
