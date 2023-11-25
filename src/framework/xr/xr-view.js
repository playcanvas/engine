import { Texture } from '../../platform/graphics/texture.js';
import { Vec4 } from "../../core/math/vec4.js";
import { Mat3 } from "../../core/math/mat3.js";
import { Mat4 } from "../../core/math/mat4.js";

import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGB8 } from '../../platform/graphics/constants.js';

/**
 * Represents XR View which represents a screen (mobile phone context) or an eye (HMD context).
 *
 * @category XR
 */
class XrView {
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
     * Create a new XrView instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @param {XRView} xrView - [XRView](https://developer.mozilla.org/en-US/docs/Web/API/XRView)
     * object that is created by WebXR API.
     * @hideconstructor
     */
    constructor(manager, xrView) {
        this._manager = manager;
        this._xrView = xrView;

        if (this._manager.views.supportedColor) {
            this._xrCamera = this._xrView.camera;

            // color texture
            if (this._manager.views.availableColor && this._xrCamera) {
                this._textureColor = new Texture(this._manager.app.graphicsDevice, {
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

                this._manager.app.graphicsDevice?.on('devicelost', this._onDeviceLost, this);
            }
        }
    }

    /**
     * Texture associated with this view's camera color. Equals to null if camera color is
     * not available or not supported.
     *
     * @type {Texture|null}
     */
    get textureColor() {
        return this._textureColor;
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
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
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
            const attachmentBaseConstant = device.isWebGL2 ? gl.COLOR_ATTACHMENT0 : (device.extDrawBuffers?.COLOR_ATTACHMENT0_WEBGL ?? gl.COLOR_ATTACHMENT0);
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
    }

    /**
     * @ignore
     */
    destroy() {
        if (this._textureColor) {
            this._textureColor.destroy();
            this._textureColor = null;
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
