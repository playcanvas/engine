import { Debug } from "../core/debug.js";
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8 } from "./constants.js";
import { DebugGraphics } from "./debug-graphics.js";
import { RenderTarget } from "./render-target.js";
import { Texture } from "./texture.js";

/**
 * A class used by the graphics device to handle the capture of the current framebuffer into a
 * texture to be used by following draw calls to implement refraction.
 *
 * @ignore
 */
class GrabPass {
    /**
     * Create a new GrabPass instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used to manage this grab pass.
     * @param {boolean} useAlpha - Whether the grab pass should have an alpha channel.
     */
    constructor(device, useAlpha) {
        this.device = device;
        this.useAlpha = useAlpha;

        // for now we only support mipmaps on webgl2 devices due to the support for mipmaps for textures of any dimension
        // (captured framebuffer is usually not power of 2). See TODO in generateMipmaps function.
        this.useMipmaps = device.webgl2;

        this.texture = null;
        this.renderTarget = null;
        this.textureId = null;
    }

    /**
     * Release the grab pass resources.
     */
    destroy() {
        this.textureId = null;

        if (this.renderTarget) {
            this.renderTarget.destroy();
            this.renderTarget = null;
        }

        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
    }

    /**
     * Create the texture and render target used by the grab pass.
     */
    create() {
        if (!this.texture) {

            const texture = new Texture(this.device, {
                name: 'texture_grabPass',
                format: this.useAlpha ? PIXELFORMAT_R8_G8_B8_A8 : PIXELFORMAT_R8_G8_B8,
                minFilter: this.useMipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                mipmaps: this.useMipmaps
            });

            this.texture = texture;

            this.renderTarget = new RenderTarget({
                colorBuffer: texture,
                depth: false
            });

            this.textureId = this.device.scope.resolve(texture.name);
            this.textureId.setValue(texture);
        }
    }

    /**
     * Resolve/copy the backbuffer into the grab pass render target.
     *
     * @returns {boolean} - Whether the grab pass was successfully resolved or not.
     */
    update() {
        const device = this.device;
        const gl = device.gl;

        // print error if we cannot grab framebuffer at this point
        if (!device.grabPassAvailable) {
            Debug.error("texture_grabPass cannot be used when rendering shadows and similar passes, exclude your object from rendering to them");
            return false;
        }

        // render target currently being rendered to (these are null if default framebuffer is active)
        const renderTarget = device.renderTarget;
        const resolveRenderTarget = renderTarget && renderTarget._glResolveFrameBuffer;

        const texture = this.texture;
        const width = device.width;
        const height = device.height;

        DebugGraphics.pushGpuMarker(device, "grabPass");

        if (device.webgl2 && !device._tempMacChromeBlitFramebufferWorkaround && width === texture._width && height === texture._height) {
            if (resolveRenderTarget) {
                renderTarget.resolve(true);
            }

            // these are null if rendering to default framebuffer
            const currentFrameBuffer = renderTarget ? renderTarget._glFrameBuffer : null;
            const resolvedFrameBuffer = renderTarget ? renderTarget._glResolveFrameBuffer || renderTarget._glFrameBuffer : null;

            // init grab pass framebuffer (only does it once)
            device.initRenderTarget(this.renderTarget);
            const grabPassFrameBuffer = this.renderTarget._glFrameBuffer;

            // blit from currently used render target (or default framebuffer if null)
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resolvedFrameBuffer);

            // blit to grab pass framebuffer
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, grabPassFrameBuffer);

            // Note: This fails on Chromium Mac when Antialasing is On and Alpha is off
            // blit color from current framebuffer's color attachment to grab pass color attachment
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, currentFrameBuffer);
        } else {
            if (resolveRenderTarget) {
                renderTarget.resolve(true);
                gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget._glResolveFrameBuffer);
            }

            // this allocates texture (texture was already bound to gl)
            const format = texture.impl._glFormat;
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, format, 0, 0, width, height, 0);
            texture._width = width;
            texture._height = height;

            if (resolveRenderTarget) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget._glFrameBuffer);
            }
        }

        DebugGraphics.popGpuMarker(device);

        return true;
    }

    /**
     * Generate mipmaps for the grab pass texture.
     */
    generateMipmaps() {
        // TODO: implement support for WebGL 1, which requires the texture to be a power of two, by
        // first downscaling the captured framebuffer texture to smaller power of 2 texture, and
        // then generate mipmaps and use it for rendering
        if (this.useMipmaps) {
            this.device.gl.generateMipmap(this.texture.impl._glTarget);
        }
    }

    /**
     * Grab a copy of the frame buffer to a texture and generate mipmaps for it.
     *
     * @returns {boolean} - Whether the grab pass was successfully updated or not.
     */
    prepareTexture() {
        // capture the framebuffer
        const updated = this.update();
        if (updated) {
            this.generateMipmaps();
        }

        return updated;
    }
}

export { GrabPass };
