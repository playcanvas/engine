import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F } from "../../platform/graphics/constants.js";
import { DebugGraphics } from "../../platform/graphics/debug-graphics.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { RenderTarget } from "../../platform/graphics/render-target.js";
import { Texture } from "../../platform/graphics/texture.js";

// uniform names (first is current name, second one is deprecated name for compatibility)
const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];

/**
 * A render pass implementing grab of a depth buffer, used on WebGL 2 and WebGPU devices.
 *
 * @ignore
 */
class RenderPassDepthGrab extends RenderPass {
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

    shouldReallocate(targetRT, sourceTexture) {

        // need to reallocate if dimensions don't match
        const width = sourceTexture?.width || this.device.width;
        const height = sourceTexture?.height || this.device.height;
        return !targetRT || width !== targetRT.width || height !== targetRT.height;
    }

    allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth) {

        // allocate texture buffer
        const texture = new Texture(device, {
            name: _depthUniformNames[0],
            format,
            width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
            height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

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
        let format = destinationRt.stencil ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH;
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

        // allocate / resize existing RT as needed
        if (this.shouldReallocate(this.depthRenderTarget, sourceTexture)) {
            this.releaseRenderTarget(this.depthRenderTarget);
            this.depthRenderTarget = this.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, format, useDepthBuffer);
        }

        // assign uniform
        const colorBuffer = useDepthBuffer ? this.depthRenderTarget.depthBuffer : this.depthRenderTarget.colorBuffer;
        _depthUniformNames.forEach(name => device.scope.resolve(name).setValue(colorBuffer));
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

export { RenderPassDepthGrab };
