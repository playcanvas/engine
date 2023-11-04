import { EventHandler } from "../../core/event-handler.js";
import { Texture } from '../../platform/graphics/texture.js';
import { Vec4 } from "../../core/math/vec4.js";
import { Mat3 } from "../../core/math/mat3.js";
import { Mat4 } from "../../core/math/mat4.js";

import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGB8, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';

class XrView extends EventHandler {
    _manager;
    _xrView;

    _positionData = new Float32Array(3);
    _viewport = new Vec4();

    _projMat = new Mat4();
    _projViewOffMat = new Mat4();
    _viewMat = new Mat4();
    _viewOffMat = new Mat4();
    _viewMat3 = new Mat3();
    _viewInvMat = new Mat4();
    _viewInvOffMat = new Mat4();

    _xrCamera = null;
    _textureColor = null;

    constructor(manager, xrView) {
        super();

        this._manager = manager;
        this._xrView = xrView;

        if (this._manager.views.supportedColor)
            this._xrCamera = this._xrView.camera;

        this._updateTextureColor();
    }

    _updateTextureColor() {
        if (!this._manager.views.availableColor || !this._xrCamera)
            return;

        const binding = this._manager.webglBinding;
        if (!binding)
            return;

        const texture = binding.getCameraImage(this._xrCamera);
        if (!texture)
            return;

        if (!this._textureColor) {
            this._textureColor = new Texture(this._manager.app.graphicsDevice, {
                format: PIXELFORMAT_RGBA8,
                mipmaps: false,
                flipY: true,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                width: this._xrCamera.width,
                height: this._xrCamera.height,
                name: `XrView-${this._xrView.eye}-Color`
            });
            this._textureColor.upload();
        }

        // force texture initialization
        if (!this._textureColor.impl._glTexture) {
            this._textureColor.impl.initialize(this._manager.app.graphicsDevice, this._textureColor);
            this._textureColor.impl.upload = () => { };
            this._textureColor._needsUpload = false;
        }

        this._textureColor.impl._glCreated = true;
        this._textureColor.impl._glTexture = texture;
    }

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

    update(frame, xrView) {
        this._xrView = xrView;
        if (this._manager.views.supportedColor)
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

    destroy() {
        if (this._textureColor) {
            // TODO
            // ensure there is no use of this texture after session ended
            this._textureColor.impl._glTexture = null;
            this._textureColor.destroy();
            this._textureColor = null;
        }
    }

    get textureColor() {
        return this._textureColor;
    }

    get eye() {
        return this._xrView.eye;
    }

    get viewport() {
        return this._viewport;
    }

    get projMat() {
        return this._projMat;
    }

    get projViewOffMat() {
        return this._projViewOffMat;
    }

    get viewOffMat() {
        return this._viewOffMat;
    }

    get viewInvOffMat() {
        return this._viewInvOffMat;
    }

    get viewMat3() {
        return this._viewMat3;
    }

    get positionData() {
        return this._positionData;
    }
}

export { XrView };
