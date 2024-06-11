import { EventHandler } from '../../core/event-handler.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Vec4 } from "../../core/math/vec4.js";
import { Mat3 } from "../../core/math/mat3.js";
import { Mat4 } from "../../core/math/mat4.js";

import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RGB8 } from '../../platform/graphics/constants.js';

/**
 * Represents an XR View which represents a screen (monoscopic scenario such as a mobile phone) or an eye
 * (stereoscopic scenario such as an HMD context). It provides access to the view's color and depth information
 * based on the capabilities of underlying AR system.
 *
 * @category XR
 */
class XrView extends EventHandler {
    /**
     * Fired when the depth sensing texture been resized. The {@link XrView#depthUvMatrix} needs
     * to be updated for relevant shaders. The handler is passed the new width and height of the
     * depth texture in pixels.
     *
     * @event
     * @example
     * view.on('depth:resize', () => {
     *     material.setParameter('matrix_depth_uv', view.depthUvMatrix);
     * });
     */
    static EVENT_DEPTHRESIZE = 'depth:resize';

    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {XRView}
     * @private
     */
    _xrView;

    /**
     * @type {Float32Array}
     * @private
     */
    _positionData = new Float32Array(3);

    /**
     * @type {Vec4}
     * @private
     */
    _viewport = new Vec4();

    /**
     * @type {Mat4}
     * @private
     */
    _projMat = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _projViewOffMat = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _viewMat = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _viewOffMat = new Mat4();

    /**
     * @type {Mat3}
     * @private
     */
    _viewMat3 = new Mat3();

    /**
     * @type {Mat4}
     * @private
     */
    _viewInvMat = new Mat4();

    /**
     * @type {Mat4}
     * @private
     */
    _viewInvOffMat = new Mat4();

    /**
     * @type {XRCamera}
     * @private
     */
    _xrCamera = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _textureColor = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _textureDepth = null;

    /**
     * @type {XRDepthInformation|null}
     * @private
     */
    _depthInfo = null;

    /**
     * @type {Uint8Array}
     * @private
     */
    _emptyDepthBuffer = new Uint8Array(32);

    /**
     * @type {Mat4}
     * @private
     */
    _depthMatrix = new Mat4();

    /**
     * Create a new XrView instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @param {XRView} xrView - [XRView](https://developer.mozilla.org/en-US/docs/Web/API/XRView)
     * object that is created by WebXR API.
     * @param {number} viewsCount - Number of views available for the session.
     * @ignore
     */
    constructor(manager, xrView, viewsCount) {
        super();

        this._manager = manager;
        this._xrView = xrView;

        const device = this._manager.app.graphicsDevice;

        if (this._manager.views.supportedColor) {
            this._xrCamera = this._xrView.camera;

            // color texture
            if (this._manager.views.availableColor && this._xrCamera) {
                this._textureColor = new Texture(device, {
                    format: PIXELFORMAT_RGB8,
                    mipmaps: false,
                    addressU: ADDRESS_CLAMP_TO_EDGE,
                    addressV: ADDRESS_CLAMP_TO_EDGE,
                    minFilter: FILTER_LINEAR,
                    magFilter: FILTER_LINEAR,
                    width: this._xrCamera.width,
                    height: this._xrCamera.height,
                    name: `XrView-${this._xrView.eye}-Color`
                });
            }
        }

        if (this._manager.views.supportedDepth && this._manager.views.availableDepth) {
            const filtering = this._manager.views.depthGpuOptimized ? FILTER_NEAREST : FILTER_LINEAR;

            this._textureDepth = new Texture(device, {
                format: this._manager.views.depthPixelFormat,
                arrayLength: (viewsCount === 1) ? 0 : viewsCount,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                minFilter: filtering,
                magFilter: filtering,
                width: 4,
                height: 4,
                name: `XrView-${this._xrView.eye}-Depth`
            });

            for (let i = 0; i < this._textureDepth._levels.length; i++) {
                this._textureDepth._levels[i] = this._emptyDepthBuffer;
            }

            this._textureDepth.upload();
        }

        if (this._textureColor || this._textureDepth)
            device.on('devicelost', this._onDeviceLost, this);
    }

    /**
     * Texture associated with this view's camera color. Equals to null if camera color is
     * not available or is not supported.
     *
     * @type {Texture|null}
     */
    get textureColor() {
        return this._textureColor;
    }

    /* eslint-disable jsdoc/check-examples */
    /**
     * Texture that contains packed depth information which is reconstructed using the underlying
     * AR system. This texture can be used (not limited to) for reconstructing real world
     * geometry, virtual object placement, occlusion of virtual object by the real world geometry,
     * and more.
     * The format of this texture is {@link PIXELFORMAT_LA8} or {@link PIXELFORMAT_R32F}
     * based on {@link XrViews#depthFormat}. It is UV transformed based on the underlying AR
     * system which can be normalized using {@link XrView#depthUvMatrix}. Equals to null if camera
     * depth is not supported.
     *
     * @type {Texture|null}
     * @example
     * // GPU path, attaching texture to material
     * material.setParameter('texture_depthSensingMap', view.textureDepth);
     * material.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
     * material.setParameter('depth_to_meters', view.depthValueToMeters);
     * @example
     * // GLSL shader to unpack depth texture
     * varying vec2 vUv0;
     *
     * uniform sampler2D texture_depthSensingMap;
     * uniform mat4 matrix_depth_uv;
     * uniform float depth_to_meters;
     *
     * void main(void) {
     *     // transform UVs using depth matrix
     *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
     *
     *     // get luminance alpha components from depth texture
     *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
     *
     *     // unpack into single value in millimeters
     *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_to_meters; // m
     *
     *     // normalize: 0m to 8m distance
     *     depth = min(depth / 8.0, 1.0); // 0..1 = 0m..8m
     *
     *     // paint scene from black to white based on distance
     *     gl_FragColor = vec4(depth, depth, depth, 1.0);
     * }
     */
    get textureDepth() {
        return this._textureDepth;
    }
    /* eslint-enable jsdoc/check-examples */

    /**
     * 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader.
     * It is updated when the depth texture is resized. Refer to {@link XrView#depthResize}.
     *
     * @type {Mat4}
     * @example
     * material.setParameter('matrix_depth_uv', view.depthUvMatrix.data);
     */
    get depthUvMatrix() {
        return this._depthMatrix;
    }

    /**
     * Multiply this coefficient number by raw depth value to get depth in meters.
     *
     * @type {number}
     * @example
     * material.setParameter('depth_to_meters', view.depthValueToMeters);
     */
    get depthValueToMeters() {
        return this._depthInfo?.rawValueToMeters || 0;
    }

    /**
     * An eye with which this view is associated. Can be any of:
     *
     * - {@link XREYE_NONE}: None - inidcates a monoscopic view (likely mobile phone screen).
     * - {@link XREYE_LEFT}: Left - indicates left eye view.
     * - {@link XREYE_RIGHT}: Right - indicates a right eye view.
     *
     * @type {string}
     */
    get eye() {
        return this._xrView.eye;
    }

    /**
     * A Vec4 (x, y, width, height) that represents a view's viewport. For monoscopic screen
     * it will define fullscreen view, but for stereoscopic views (left/right eye) it will define
     * a part of a whole screen that view is occupying.
     *
     * @type {Vec4}
     */
    get viewport() {
        return this._viewport;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get projMat() {
        return this._projMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get projViewOffMat() {
        return this._projViewOffMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get viewOffMat() {
        return this._viewOffMat;
    }

    /**
     * @type {Mat4}
     * @ignore
     */
    get viewInvOffMat() {
        return this._viewInvOffMat;
    }

    /**
     * @type {Mat3}
     * @ignore
     */
    get viewMat3() {
        return this._viewMat3;
    }

    /**
     * @type {Float32Array}
     * @ignore
     */
    get positionData() {
        return this._positionData;
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @param {XRView} xrView - XRView from WebXR API.
     * @ignore
     */
    update(frame, xrView) {
        this._xrView = xrView;
        if (this._manager.views.availableColor)
            this._xrCamera = this._xrView.camera;

        const layer = frame.session.renderState.baseLayer;

        // viewport
        const viewport = layer.getViewport(this._xrView);
        this._viewport.x = viewport.x;
        this._viewport.y = viewport.y;
        this._viewport.z = viewport.width;
        this._viewport.w = viewport.height;

        // matrices
        this._projMat.set(this._xrView.projectionMatrix);
        this._viewMat.set(this._xrView.transform.inverse.matrix);
        this._viewInvMat.set(this._xrView.transform.matrix);

        this._updateTextureColor();
        this._updateDepth(frame);
    }

    /**
     * @private
     */
    _updateTextureColor() {
        if (!this._manager.views.availableColor || !this._xrCamera || !this._textureColor)
            return;

        const binding = this._manager.webglBinding;
        if (!binding)
            return;

        const texture = binding.getCameraImage(this._xrCamera);
        if (!texture)
            return;

        const device = this._manager.app.graphicsDevice;
        const gl = device.gl;

        if (!this._frameBufferSource) {
            // create frame buffer to read from
            this._frameBufferSource = gl.createFramebuffer();

            // create frame buffer to write to
            this._frameBuffer = gl.createFramebuffer();
        } else {
            const attachmentBaseConstant = gl.COLOR_ATTACHMENT0;
            const width = this._xrCamera.width;
            const height = this._xrCamera.height;

            // set frame buffer to read from
            device.setFramebuffer(this._frameBufferSource);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                attachmentBaseConstant,
                gl.TEXTURE_2D,
                texture,
                0
            );

            // set frame buffer to write to
            device.setFramebuffer(this._frameBuffer);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                attachmentBaseConstant,
                gl.TEXTURE_2D,
                this._textureColor.impl._glTexture,
                0
            );

            // bind buffers
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._frameBufferSource);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._frameBuffer);

            // copy buffers with flip Y
            gl.blitFramebuffer(0, height, width, 0, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        }
    }

    /**
     * @param {XRFrame} frame - XRFrame from requestAnimationFrame callback.
     * @private
     */
    _updateDepth(frame) {
        if (!this._manager.views.availableDepth || !this._textureDepth)
            return;

        const gpu = this._manager.views.depthGpuOptimized;

        const infoSource = gpu ? this._manager.webglBinding : frame;
        if (!infoSource) {
            this._depthInfo = null;
            return;
        }

        const depthInfo = infoSource.getDepthInformation(this._xrView);
        if (!depthInfo) {
            this._depthInfo = null;
            return;
        }

        let matrixDirty = !this._depthInfo !== !depthInfo;
        this._depthInfo = depthInfo;

        const width = this._depthInfo?.width || 4;
        const height = this._depthInfo?.height || 4;

        let resized = false;

        // resizing
        if (this._textureDepth.width !== width || this._textureDepth.height !== height) {
            this._textureDepth._width = width;
            this._textureDepth._height = height;
            matrixDirty = true;
            resized = true;
        }

        // update depth matrix
        if (matrixDirty) {
            if (this._depthInfo) {
                this._depthMatrix.data.set(this._depthInfo.normDepthBufferFromNormView.matrix);
            } else {
                this._depthMatrix.setIdentity();
            }
        }

        // update texture
        if (this._depthInfo) {
            if (gpu) {
                // gpu
                if (this._depthInfo.texture) {
                    const gl = this._manager.app.graphicsDevice.gl;
                    this._textureDepth.impl._glTexture = this._depthInfo.texture;
                    this._textureDepth.impl._glTarget = gl.TEXTURE_2D_ARRAY;
                    this._textureDepth.impl._glFormat = gl.RED;
                    this._textureDepth.impl._glInternalFormat = gl.R32F;
                    this._textureDepth.impl._glPixelType = gl.FLOAT;
                    this._textureDepth.impl._glCreated = true;
                }
            } else {
                // cpu
                this._textureDepth._levels[0] = new Uint8Array(this._depthInfo.data);
                this._textureDepth.upload();
            }
        } else {
            // clear
            this._textureDepth._levels[0] = this._emptyDepthBuffer;
            this._textureDepth.upload();
        }

        if (resized) this.fire('depth:resize', width, height);
    }

    /**
     * @param {Mat4|null} transform - World Transform of a parents GraphNode.
     * @ignore
     */
    updateTransforms(transform) {
        if (transform) {
            this._viewInvOffMat.mul2(transform, this._viewInvMat);
            this.viewOffMat.copy(this._viewInvOffMat).invert();
        } else {
            this._viewInvOffMat.copy(this._viewInvMat);
            this.viewOffMat.copy(this._viewMat);
        }

        this._viewMat3.setFromMat4(this._viewOffMat);
        this._projViewOffMat.mul2(this._projMat, this._viewOffMat);

        this._positionData[0] = this._viewInvOffMat.data[12];
        this._positionData[1] = this._viewInvOffMat.data[13];
        this._positionData[2] = this._viewInvOffMat.data[14];
    }

    _onDeviceLost() {
        this._frameBufferSource = null;
        this._frameBuffer = null;
        this._depthInfo = null;
    }

    /**
     * Get depth value from depth information in meters. UV is in range of 0..1, with origin in
     * top-left corner of a texture.
     *
     * @param {number} u - U coordinate of pixel in depth texture, which is in range from 0.0 to
     * 1.0 (left to right).
     * @param {number} v - V coordinate of pixel in depth texture, which is in range from 0.0 to
     * 1.0 (top to bottom).
     * @returns {number|null} Depth in meters or null if depth information is currently not
     * available.
     * @example
     * const depth = view.getDepth(u, v);
     * if (depth !== null) {
     *     // depth in meters
     * }
     */
    getDepth(u, v) {
        if (this._manager.views.depthGpuOptimized)
            return null;

        return this._depthInfo?.getDepthInMeters(u, v) ?? null;
    }

    /** @ignore */
    destroy() {
        this._depthInfo = null;

        if (this._textureColor) {
            this._textureColor.destroy();
            this._textureColor = null;
        }

        if (this._textureDepth) {
            this._textureDepth.destroy();
            this._textureDepth = null;
        }

        if (this._frameBufferSource) {
            const gl = this._manager.app.graphicsDevice.gl;

            gl.deleteFramebuffer(this._frameBufferSource);
            this._frameBufferSource = null;

            gl.deleteFramebuffer(this._frameBuffer);
            this._frameBuffer = null;
        }
    }
}

export { XrView };
