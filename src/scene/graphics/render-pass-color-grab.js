import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

// uniform name
const _colorUniformName = 'uSceneColorMap';

/**
 * A render pass implementing grab of a color buffer.
 *
 * @ignore
 */
class RenderPassColorGrab extends RenderPass {
    colorRenderTarget = null;

    /**
     * The source render target to grab the color from.
     *
     * @type {RenderTarget|null}
     */
    source = null;

    destroy() {
        super.destroy();
        this.releaseRenderTarget(this.colorRenderTarget);
    }

    shouldReallocate(targetRT, sourceTexture, sourceFormat) {

        // need to reallocate if format does not match
        const targetFormat = targetRT?.colorBuffer.format;
        if (targetFormat !== sourceFormat) {
            return true;
        }

        // need to reallocate if dimensions don't match
        const width = sourceTexture?.width || this.device.width;
        const height = sourceTexture?.height || this.device.height;
        return !targetRT || width !== targetRT.width || height !== targetRT.height;
    }

    allocateRenderTarget(renderTarget, sourceRenderTarget, device, format) {

        // allocate texture buffer
        const texture = new Texture(device, {
            name: _colorUniformName,
            format,
            width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
            height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        if (renderTarget) {

            // if reallocating RT size, release previous framebuffer
            renderTarget.destroyFrameBuffers();

            // assign new texture
            renderTarget._colorBuffer = texture;
            renderTarget._colorBuffers = [texture];

            // update cached dimensions
            renderTarget.evaluateDimensions();
        } else {

            // create new render target with the texture
            renderTarget = new RenderTarget({
                name: 'ColorGrabRT',
                colorBuffer: texture,
                depth: false,
                stencil: false,
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

    frameUpdate() {

        const device = this.device;

        // resize based on the source render target
        const sourceRt = this.source;
        const sourceFormat = sourceRt?.colorBuffer.format ?? this.device.backBufferFormat;

        // allocate / resize existing RT as needed
        if (this.shouldReallocate(this.colorRenderTarget, sourceRt?.colorBuffer, sourceFormat)) {
            this.releaseRenderTarget(this.colorRenderTarget);
            this.colorRenderTarget = this.allocateRenderTarget(this.colorRenderTarget, sourceRt, device, sourceFormat);
        }

        // assign uniform
        const colorBuffer = this.colorRenderTarget.colorBuffer;
        device.scope.resolve(_colorUniformName).setValue(colorBuffer);
    }

    execute() {

        // copy color from the current render target
        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

        const sourceRt = this.source;
        const colorBuffer = this.colorRenderTarget.colorBuffer;

        if (device.isWebGPU) {

            device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);

            // generate mipmaps
            device.mipmapRenderer.generate(this.colorRenderTarget.colorBuffer.impl);

        } else {

            device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);

            // generate mipmaps
            device.activeTexture(device.maxCombinedTextures - 1);
            device.bindTexture(colorBuffer);
            device.gl.generateMipmap(colorBuffer.impl._glTarget);
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassColorGrab };
