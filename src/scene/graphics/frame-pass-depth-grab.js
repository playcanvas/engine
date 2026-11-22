import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { SceneDepthMapHandle } from '../../platform/graphics/scene-depth-map-handle.js';
import { Texture } from '../../platform/graphics/texture.js';

/**
 * A render pass implementing grab of a depth buffer, used on WebGL 2 and WebGPU devices.
 *
 * @ignore
 */
class FramePassDepthGrab extends FramePass {
    depthRenderTarget = null;

    camera = null;

    constructor(device, camera) {
        super(device);
        this.camera = camera;
    }

    destroy() {
        super.destroy();
        this.releaseRenderTarget(this.depthRenderTarget);
    }

    /**
     * Format of the texture the grab copies into. A supplied depth texture keeps its format, so a
     * later blit stays inside one internal format. An automatic depth buffer is 32-bit float, or
     * 24-bit depth with stencil when the target has a stencil.
     *
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} destinationRt - The
     * camera target the depth is copied from.
     * @returns {number} The pixel format of the grab texture.
     */
    depthFormat(destinationRt) {
        const format = destinationRt.depthBuffer?.format;
        if (format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16 || format === PIXELFORMAT_DEPTHSTENCIL) {
            return format;
        }
        return destinationRt.stencil ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH;
    }

    shouldReallocate(targetRT, sourceTexture, format, isDepth) {

        // need to reallocate if dimensions don't match, or the grab texture is a different format
        // (a 32-bit grab cannot be reused for a 16-bit or depth-stencil source)
        const width = sourceTexture?.width || this.device.width;
        const height = sourceTexture?.height || this.device.height;
        if (!targetRT || width !== targetRT.width || height !== targetRT.height) {
            return true;
        }
        const texture = isDepth ? targetRT.depthBuffer : targetRT.colorBuffer;
        return texture?.format !== format;
    }

    allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth) {

        // allocate texture buffer
        const texture = Texture.createDataTexture2D(
            device,
            SceneDepthMapHandle.uniformName,
            sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
            sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
            format
        );

        if (renderTarget) {

            // if reallocating RT size, release previous framebuffer
            renderTarget.destroyFrameBuffers();

            // assign new texture
            if (isDepth) {
                renderTarget._depthBuffer = texture;
            } else {
                renderTarget._colorBuffer = texture;
                renderTarget._colorBuffers = [texture];
            }

            // update cached dimensions
            renderTarget.evaluateDimensions();

        } else {

            // create new render target with the texture
            renderTarget = new RenderTarget({
                name: 'DepthGrabRT',
                colorBuffer: isDepth ? null : texture,
                depthBuffer: isDepth ? texture : null,
                depth: !isDepth,
                stencil: device.supportsStencil,
                autoResolve: false
            });
        }

        return renderTarget;
    }

    releaseRenderTarget(rt) {

        if (rt) {
            rt.destroyTextureBuffers();
            rt.destroy();
        }
    }

    before() {

        const camera = this.camera;
        const device = this.device;
        const destinationRt = camera?.renderTarget ?? device.backBuffer;

        let useDepthBuffer = true;
        let format = this.depthFormat(destinationRt);
        if (device.isWebGPU) {
            const numSamples = destinationRt.samples;

            // when depth buffer is multi-sampled, instead of copying it out, we use custom shader to resolve it
            // to a R32F texture, used as a color attachment of the render target
            if (numSamples > 1) {
                format = PIXELFORMAT_R32F;
                useDepthBuffer = false;
            }
        }

        const sourceTexture = camera.renderTarget?.depthBuffer ?? camera.renderTarget?.colorBuffer;

        // allocate / resize existing RT as needed. Reconstruct it: the depth-buffer format also
        // decides the stencil flag, and a reused target would keep the previous one.
        if (this.shouldReallocate(this.depthRenderTarget, sourceTexture, format, useDepthBuffer)) {
            this.releaseRenderTarget(this.depthRenderTarget);
            this.depthRenderTarget = null;
            this.depthRenderTarget = this.allocateRenderTarget(null, camera.renderTarget, device, format, useDepthBuffer);
        }

        // publish the depth texture - the grab copies (or resolves) the depth buffer values as they
        // are, which are not linear
        const colorBuffer = useDepthBuffer ? this.depthRenderTarget.depthBuffer : this.depthRenderTarget.colorBuffer;
        camera.publishSceneDepthMap(colorBuffer, device.renderVersion, false, false, false, destinationRt.flipY);
    }

    precompile() {

        // the copy needs no shaders, but the passes after it read the texture it publishes
        this.before();
    }

    execute() {

        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'GRAB-DEPTH');

        // WebGL2 multisampling depth handling: we resolve multi-sampled depth buffer to a single-sampled destination buffer.
        // We could use existing API and resolve depth first and then blit it to destination, but this avoids the extra copy.
        if (device.isWebGL2 && device.renderTarget.samples > 1) {

            // multi-sampled buffer
            const src = device.renderTarget.impl._glFrameBuffer;

            // single sampled destination buffer
            const dest = this.depthRenderTarget;
            device.renderTarget = dest;
            device.updateBegin();

            this.depthRenderTarget.impl.internalResolve(device, src, dest.impl._glFrameBuffer, this.depthRenderTarget, device.gl.DEPTH_BUFFER_BIT);

        } else {

            // copy depth
            device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { FramePassDepthGrab };
