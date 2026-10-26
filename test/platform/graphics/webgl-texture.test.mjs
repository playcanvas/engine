import { expect } from 'chai';
import sinon from 'sinon';

import { PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebglTexture } from '../../../src/platform/graphics/webgl/webgl-texture.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('WebglTexture upload during context loss', function () {
    it('skips uploads after the device has been destroyed', function () {
        const device = {
            contextLost: false,
            _destroyed: true,
            gl: { isContextLost: () => false },
            isContextLost: WebglGraphicsDevice.prototype.isContextLost,
            setTexture: sinon.spy()
        };
        const texture = { _needsUpload: true, _needsMipmapsUpload: true };

        expect(device.isContextLost()).to.be.true;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;
        expect(texture._needsUpload).to.be.true;
        expect(texture._needsMipmapsUpload).to.be.true;

        device.gl = null;
        expect(device.isContextLost()).to.be.true;

        // A missing native context must also be safe independently of the base device state.
        device._destroyed = false;
        expect(device.isContextLost()).to.be.true;
    });

    it('keeps uploads pending until both native and engine recovery have completed', function () {
        const device = {
            contextLost: false,
            gl: { isContextLost: () => true },
            isContextLost: WebglGraphicsDevice.prototype.isContextLost,
            setTexture: sinon.spy()
        };
        const texture = { _needsUpload: true, _needsMipmapsUpload: true };

        // The native context may be lost before the engine receives its loss event.
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;
        expect(texture._needsUpload).to.be.true;
        expect(texture._needsMipmapsUpload).to.be.true;

        device.contextLost = true;
        device.gl.isContextLost = () => false;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;

        device.contextLost = false;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.calledOnceWithExactly(texture, 0)).to.be.true;
        expect(texture._needsUpload).to.be.false;
        expect(texture._needsMipmapsUpload).to.be.false;
    });
});

describe('WebglTexture upload of an HTML element', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    let hadHTMLElement;

    beforeEach(function () {
        jsdomSetup();
        // jsdom does not expose HTMLElement globally, provide a stand-in the engine detects
        hadHTMLElement = typeof globalThis.HTMLElement !== 'undefined';
        if (!hadHTMLElement) {
            globalThis.HTMLElement = class {};
        }
        // a null device on every backend, so the texture's own upload does not reach a real GPU
        // backend before the WebglTexture under test
        device = new NullGraphicsDevice(document.createElement('canvas'));
        device.supportsHtmlTextures = true;
    });

    afterEach(function () {
        device.destroy();
        device = null;
        if (!hadHTMLElement) {
            delete globalThis.HTMLElement;
        }
        jsdomTeardown();
    });

    // an HTML element whose layout size can be changed
    const createElement = (width, height) => {
        const element = Object.create(HTMLElement.prototype);
        element.size = { width, height };
        element.getBoundingClientRect = () => element.size;
        return element;
    };

    // a texture uploaded by a WebglTexture to a WebGL context recording its calls, which has the
    // texElementSubImage2D API
    const createTexture = () => {
        const gl = {
            TEXTURE_2D: 0x0DE1,
            RGBA: 0x1908,
            RGBA8: 0x8058,
            UNSIGNED_BYTE: 0x1401,
            texImage2D: sinon.spy(),
            texElementSubImage2D: sinon.spy()
        };
        const glDevice = Object.assign(Object.create(device), {
            gl,
            setUnpackFlipY() {},
            setUnpackPremultiplyAlpha() {}
        });

        const texture = new Texture(device, { format: PIXELFORMAT_RGBA8, mipmaps: false });
        const impl = Object.assign(new WebglTexture(texture), {
            _glTarget: gl.TEXTURE_2D,
            _glFormat: gl.RGBA,
            _glInternalFormat: gl.RGBA8,
            _glPixelType: gl.UNSIGNED_BYTE,
            _glCreated: false
        });

        return {
            texture,
            upload: () => impl.upload(glDevice, texture),
            allocations: () => gl.texImage2D.getCalls().map(call => [call.args[3], call.args[4]]),
            draws: () => gl.texElementSubImage2D.getCalls().map(call => [call.args[5].width, call.args[5].height])
        };
    };

    it('allocates the storage at the element size and draws the element at that size', function () {
        const { texture, upload, allocations, draws } = createTexture();
        texture.setSource(createElement(32, 32));
        upload();

        expect(allocations()).to.deep.equal([[32, 32]]);
        expect(draws()).to.deep.equal([[32, 32]]);
        texture.destroy();
    });

    it('keeps the storage when the element repaints at the same size', function () {
        const { texture, upload, allocations, draws } = createTexture();
        texture.setSource(createElement(32, 32));
        upload();
        texture.upload();
        upload();

        expect(allocations()).to.deep.equal([[32, 32]]);
        expect(draws()).to.deep.equal([[32, 32], [32, 32]]);
        texture.destroy();
    });

    it('allocates the storage again when the element resizes between paints', function () {
        const { texture, upload, allocations, draws } = createTexture();
        const element = createElement(32, 32);
        texture.setSource(element);
        upload();
        element.size = { width: 64, height: 16 };
        texture.upload();
        upload();

        expect(allocations()).to.deep.equal([[32, 32], [64, 16]]);
        expect(draws()).to.deep.equal([[32, 32], [64, 16]]);
        texture.destroy();
    });

    it('allocates the storage again when the resized element is set as the source again', function () {
        // setSource updates the texture size before the upload, and does not mark the level as
        // updated for the same element
        const { texture, upload, allocations, draws } = createTexture();
        const element = createElement(32, 32);
        texture.setSource(element);
        upload();
        element.size = { width: 64, height: 16 };
        texture.setSource(element);
        upload();

        expect(allocations()).to.deep.equal([[32, 32], [64, 16]]);
        expect(draws()).to.deep.equal([[32, 32], [64, 16]]);
        texture.destroy();
    });
});
