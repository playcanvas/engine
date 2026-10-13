import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { SceneColorMapHandle } from '../../platform/graphics/scene-color-map-handle.js';
import { Texture } from '../../platform/graphics/texture.js';
import { GAMMA_SRGB } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Camera } from '../camera.js'
 */

/**
 * A render pass implementing grab of a color buffer.
 *
 * @ignore
 */
class FramePassColorGrab extends FramePass {
    colorRenderTarget = null;

    /**
     * The source render target to grab the color from.
     *
     * @type {RenderTarget|null}
     */
    source = null;

    /**
     * The camera the grabbed color is published for.
     *
     * @type {Camera}
     */
    camera;

    /**
     * The gamma correction the grabbed color was rendered with, when the passes rendering it
     * override the gamma correction of the camera. Undefined when they use the camera's own.
     *
     * @type {number|undefined}
     */
    gammaCorrection;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Camera} camera - The camera the grabbed color is published for.
     */
    constructor(device, camera) {
        super(device);
        this.camera = camera;
    }

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
            name: SceneColorMapHandle.uniformName,
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
    }

    before() {

        // Publish the grabbed color. This is done when the grab executes, not when the frame graph is
        // built, which happens for all cameras before any of them renders - so the global uniform
        // would hold the last camera's grab during all of them.
        const colorBuffer = this.colorRenderTarget.colorBuffer;
        const camera = this.camera;
        const gamma = this.gammaCorrection !== undefined ?
            this.gammaCorrection === GAMMA_SRGB :
            camera.shaderParams.shaderOutputGamma === GAMMA_SRGB;
        camera.publishSceneColorMap(colorBuffer, gamma);
    }

    execute() {

        // copy color from the current render target
        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

        const colorBuffer = this.colorRenderTarget.colorBuffer;
        device.copyRenderTarget(this.source, this.colorRenderTarget, true, false);

        // generate mipmaps, which the null device has no data for
        if (device.isWebGPU) {
            device.mipmapRenderer.generate(colorBuffer.impl);
        } else if (device.isWebGL2) {
            device.activeTexture(device.maxCombinedTextures - 1);
            device.bindTexture(colorBuffer);
            device.gl.generateMipmap(colorBuffer.impl._glTarget);
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { FramePassColorGrab };
