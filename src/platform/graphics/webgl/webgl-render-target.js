import { Debug } from "../../../core/debug.js";
import { PIXELFORMAT_RGBA8 } from "../constants.js";
import { DebugGraphics } from "../debug-graphics.js";

/**
 * A private class representing a pair of framebuffers, when MSAA is used.
 *
 * @ignore
 */
class FramebufferPair {
    /** Multi-sampled rendering framebuffer */
    msaaFB;

    /** Single-sampled resolve framebuffer */
    resolveFB;

    constructor(msaaFB, resolveFB) {
        this.msaaFB = msaaFB;
        this.resolveFB = resolveFB;
    }

    destroy(gl) {
        if (this.msaaFB) {
            gl.deleteRenderbuffer(this.msaaFB);
            this.msaaFB = null;
        }

        if (this.resolveFB) {
            gl.deleteRenderbuffer(this.resolveFB);
            this.resolveFB = null;
        }
    }
}

/**
 * A WebGL implementation of the RenderTarget.
 *
 * @ignore
 */
class WebglRenderTarget {
    _glFrameBuffer = null;

    _glDepthBuffer = null;

    _glResolveFrameBuffer = null;

    /**
     * A list of framebuffers created When MSAA and MRT are used together, one for each color buffer.
     * This allows color buffers to be resolved separately.
     *
     * @type {FramebufferPair[]}
     */
    colorMrtFramebuffers = null;

    _glMsaaColorBuffers = [];

    _glMsaaDepthBuffer = null;

    /**
     * The supplied single-sampled framebuffer for rendering. Undefined represents no supplied
     * framebuffer. Null represents the default framebuffer. A value represents a user-supplied
     * framebuffer.
     */
    suppliedColorFramebuffer;

    _isInitialized = false;

    destroy(device) {
        const gl = device.gl;
        this._isInitialized = false;

        if (this._glFrameBuffer) {
            if (this._glFrameBuffer !== this.suppliedColorFramebuffer)
                gl.deleteFramebuffer(this._glFrameBuffer);
            this._glFrameBuffer = null;
        }

        if (this._glDepthBuffer) {
            gl.deleteRenderbuffer(this._glDepthBuffer);
            this._glDepthBuffer = null;
        }

        if (this._glResolveFrameBuffer) {
            if (this._glResolveFrameBuffer !== this.suppliedColorFramebuffer)
                gl.deleteFramebuffer(this._glResolveFrameBuffer);
            this._glResolveFrameBuffer = null;
        }

        this._glMsaaColorBuffers.forEach((buffer) => {
            gl.deleteRenderbuffer(buffer);
        });
        this._glMsaaColorBuffers.length = 0;

        this.colorMrtFramebuffers?.forEach((framebuffer) => {
            framebuffer.destroy(gl);
        });
        this.colorMrtFramebuffers = null;

        if (this._glMsaaDepthBuffer) {
            gl.deleteRenderbuffer(this._glMsaaDepthBuffer);
            this._glMsaaDepthBuffer = null;
        }
        this.suppliedColorFramebuffer = undefined;
    }

    get initialized() {
        return this._isInitialized;
    }

    init(device, target) {
        const gl = device.gl;

        this._isInitialized = true;
        const buffers = [];

        if (this.suppliedColorFramebuffer !== undefined) {

            this._glFrameBuffer = this.suppliedColorFramebuffer;

        } else {

            // ##### Create main FBO #####
            this._glFrameBuffer = gl.createFramebuffer();
            device.setFramebuffer(this._glFrameBuffer);

            // --- Init the provided color buffer (optional) ---
            const colorBufferCount = target._colorBuffers?.length ?? 0;
            const attachmentBaseConstant = gl.COLOR_ATTACHMENT0;
            for (let i = 0; i < colorBufferCount; ++i) {
                const colorBuffer = target.getColorBuffer(i);
                if (colorBuffer) {
                    if (!colorBuffer.impl._glTexture) {
                        // Clamp the render buffer size to the maximum supported by the device
                        colorBuffer._width = Math.min(colorBuffer.width, device.maxRenderBufferSize);
                        colorBuffer._height = Math.min(colorBuffer.height, device.maxRenderBufferSize);
                        device.setTexture(colorBuffer, 0);
                        colorBuffer.upload(true);
                    }
                    // Attach the color buffer
                    gl.framebufferTexture2D(
                        gl.FRAMEBUFFER,
                        attachmentBaseConstant + i,
                        colorBuffer.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                        colorBuffer.impl._glTexture,
                        0
                    );

                    buffers.push(attachmentBaseConstant + i);
                }
            }

            gl.drawBuffers(buffers);

            const depthBuffer = target._depthBuffer;
            if (depthBuffer) {
                // --- Init the provided depth/stencil buffer (optional, WebGL2 only) ---
                if (!depthBuffer.impl._glTexture) {
                    // Clamp the render buffer size to the maximum supported by the device
                    depthBuffer._width = Math.min(depthBuffer.width, device.maxRenderBufferSize);
                    depthBuffer._height = Math.min(depthBuffer.height, device.maxRenderBufferSize);
                    device.setTexture(depthBuffer, 0);
                    depthBuffer.upload(true);
                }
                // Attach
                if (target._stencil) {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT,
                                            depthBuffer.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                            target._depthBuffer.impl._glTexture, 0);
                } else {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
                                            depthBuffer.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                            target._depthBuffer.impl._glTexture, 0);
                }
            } else if (target._depth) {
                // --- Init a new depth/stencil buffer (optional) ---
                // if device is a MSAA RT, and no buffer to resolve to, skip creating non-MSAA depth
                const willRenderMsaa = target._samples > 1 && device.isWebGL2;
                if (!willRenderMsaa) {
                    if (!this._glDepthBuffer) {
                        this._glDepthBuffer = gl.createRenderbuffer();
                    }
                    gl.bindRenderbuffer(gl.RENDERBUFFER, this._glDepthBuffer);
                    if (target._stencil) {
                        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, target.width, target.height);
                        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
                    } else {
                        const depthFormat = device.isWebGL2 ? gl.DEPTH_COMPONENT32F : gl.DEPTH_COMPONENT16;
                        gl.renderbufferStorage(gl.RENDERBUFFER, depthFormat, target.width, target.height);
                        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
                    }
                    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                }
            }

            Debug.call(() => this._checkFbo(device, target));
        }

        // ##### Create MSAA FBO (WebGL2 only) #####
        if (device.isWebGL2 && target._samples > 1) {

            Debug.call(() => {
                if (target.width <= 0 || target.height <= 0) {
                    Debug.warnOnce(`Invalid render target size: ${target.width} x ${target.height}`, target);
                }
            });

            // Use previous FBO for resolves
            this._glResolveFrameBuffer = this._glFrameBuffer;

            // Actual FBO will be MSAA
            this._glFrameBuffer = gl.createFramebuffer();
            device.setFramebuffer(this._glFrameBuffer);

            // Create an optional MSAA color buffers
            const colorBufferCount = target._colorBuffers?.length ?? 0;

            if (this.suppliedColorFramebuffer !== undefined) {

                const buffer = gl.createRenderbuffer();
                this._glMsaaColorBuffers.push(buffer);

                const internalFormat = device.backBufferFormat === PIXELFORMAT_RGBA8 ? gl.RGBA8 : gl.RGB8;

                gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, internalFormat, target.width, target.height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);

            } else {

                for (let i = 0; i < colorBufferCount; ++i) {
                    const colorBuffer = target.getColorBuffer(i);
                    if (colorBuffer) {
                        const buffer = gl.createRenderbuffer();
                        this._glMsaaColorBuffers.push(buffer);

                        gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
                        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
                        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, buffer);
                    }
                }
            }

            // Optionally add a MSAA depth/stencil buffer
            if (target._depth) {
                if (!this._glMsaaDepthBuffer) {
                    this._glMsaaDepthBuffer = gl.createRenderbuffer();
                }
                gl.bindRenderbuffer(gl.RENDERBUFFER, this._glMsaaDepthBuffer);
                if (target._stencil) {
                    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH24_STENCIL8, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
                } else {
                    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH_COMPONENT32F, target.width, target.height);
                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
                }
            }

            Debug.call(() => this._checkFbo(device, target, 'MSAA'));

            if (colorBufferCount > 1) {
                // create framebuffers allowing us to individually resolve each color buffer
                this._createMsaaMrtFramebuffers(device, target, colorBufferCount);

                // restore rendering back to the main framebuffer
                device.setFramebuffer(this._glFrameBuffer);
                gl.drawBuffers(buffers);
            }
        }
    }

    _createMsaaMrtFramebuffers(device, target, colorBufferCount) {

        const gl = device.gl;
        this.colorMrtFramebuffers = [];

        for (let i = 0; i < colorBufferCount; ++i) {
            const colorBuffer = target.getColorBuffer(i);

            // src
            const srcFramebuffer = gl.createFramebuffer();
            device.setFramebuffer(srcFramebuffer);
            const buffer = this._glMsaaColorBuffers[i];

            gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);

            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

            Debug.call(() => this._checkFbo(device, target, `MSAA-MRT-src${i}`));

            // dst
            const dstFramebuffer = gl.createFramebuffer();
            device.setFramebuffer(dstFramebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                    colorBuffer.cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D,
                                    colorBuffer.impl._glTexture,
                                    0
            );

            this.colorMrtFramebuffers[i] = new FramebufferPair(srcFramebuffer, dstFramebuffer);

            Debug.call(() => this._checkFbo(device, target, `MSAA-MRT-dst${i}`));
        }
    }

    /**
     * Checks the completeness status of the currently bound WebGLFramebuffer object.
     *
     * @private
     */
    _checkFbo(device, target, type = '') {
        const gl = device.gl;
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        let errorCode;
        switch (status) {
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                errorCode = 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                errorCode = 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                errorCode = 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                errorCode = 'FRAMEBUFFER_UNSUPPORTED';
                break;
        }

        Debug.assert(!errorCode, `Framebuffer creation failed with error code ${errorCode}, render target: ${target.name} ${type}`, target);
    }

    loseContext() {
        this._glFrameBuffer = null;
        this._glDepthBuffer = null;
        this._glResolveFrameBuffer = null;
        this._glMsaaColorBuffers.length = 0;
        this._glMsaaDepthBuffer = null;
        this.colorMrtFramebuffers = null;
        this.suppliedColorFramebuffer = undefined;
        this._isInitialized = false;
    }

    internalResolve(device, src, dst, target, mask) {

        Debug.assert(src !== dst, 'Source and destination framebuffers must be different when blitting.');

        // blit is affected by scissor test, so make it full size
        device.setScissor(0, 0, target.width, target.height);

        const gl = device.gl;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
        gl.blitFramebuffer(0, 0, target.width, target.height,
                           0, 0, target.width, target.height,
                           mask,
                           gl.NEAREST);
    }

    resolve(device, target, color, depth) {
        if (device.isWebGL2) {

            const gl = device.gl;

            // if MRT is used, we need to resolve each buffer individually
            if (this.colorMrtFramebuffers) {

                // color
                if (color) {
                    for (let i = 0; i < this.colorMrtFramebuffers.length; i++) {
                        const fbPair = this.colorMrtFramebuffers[i];

                        DebugGraphics.pushGpuMarker(device, `RESOLVE-MRT${i}`);
                        this.internalResolve(device, fbPair.msaaFB, fbPair.resolveFB, target, gl.COLOR_BUFFER_BIT);
                        DebugGraphics.popGpuMarker(device);
                    }
                }

                // depth
                if (depth) {
                    DebugGraphics.pushGpuMarker(device, `RESOLVE-MRT-DEPTH`);
                    this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target, gl.DEPTH_BUFFER_BIT);
                    DebugGraphics.popGpuMarker(device);
                }

            } else {
                DebugGraphics.pushGpuMarker(device, `RESOLVE`);
                this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target,
                                     (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0));
                DebugGraphics.popGpuMarker(device);
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
        }
    }
}

export { WebglRenderTarget };
