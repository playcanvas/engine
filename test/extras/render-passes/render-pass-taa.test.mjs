import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { RenderPassTAA } from '../../../src/extras/effects/taa/passes/render-pass-taa.js';
import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { createGraphicsDevice, setupShaderLibrary } from '../../device.mjs';

describe('RenderPassTAA', function () {

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    /** @type {RenderPassTAA} */
    let pass;

    /** @type {Texture[]} */
    let textures;

    // a scene texture of the given size and format
    const createTexture = (width, height, format = PIXELFORMAT_RGBA16F) => {
        const texture = new Texture(device, { name: 'Scene', width, height, format, mipmaps: false });
        textures.push(texture);
        return texture;
    };

    // a camera rendering to the back buffer
    const createCamera = () => /** @type {any} */ ({ shaderParams: new CameraShaderParams(), renderTarget: null });

    beforeEach(function () {
        device = createGraphicsDevice({ width: 128, height: 128 });
        textures = [];

        // the pass compiles a shader
        setupShaderLibrary(device);
    });

    afterEach(function () {
        pass?.destroy();
        pass = null;
        textures.forEach(texture => texture.destroy());
        device?.destroy();
        device = null;
        restore();
    });

    it('accumulates its history at half float precision, whatever the format of the scene', function () {
        // the scene in a low precision format, which would round away the small steps the
        // history takes towards its converged value each frame
        pass = new RenderPassTAA(device, createCamera(), { format: PIXELFORMAT_111110F });

        expect(pass.historyTextures).to.have.lengthOf(2);
        for (const texture of pass.historyTextures) {
            expect(texture.format).to.equal(PIXELFORMAT_RGBA16F);
        }
    });

    it('accumulates its history in the format of the scene on a device which cannot render to half float', function () {
        stub(device, 'getRenderableHdrFormat').returns(undefined);
        pass = new RenderPassTAA(device, createCamera(), { format: PIXELFORMAT_111110F });

        for (const texture of pass.historyTextures) {
            expect(texture.format).to.equal(PIXELFORMAT_111110F);
        }
    });

    it('keeps its history at the resolution of the source, or of the render target when upscaling', function () {
        const cameraComponent = createCamera();
        const sourceTexture = createTexture(64, 32);

        pass = new RenderPassTAA(device, cameraComponent);
        pass.setSourceTexture(sourceTexture);
        pass.frameUpdate();
        expect(pass.upscale).to.equal(false);
        expect(pass.shader.name).to.not.include('Upscale');
        expect([pass.historyTextures[0].width, pass.historyTextures[0].height]).to.deep.equal([64, 32]);
        pass.destroy();

        pass = new RenderPassTAA(device, cameraComponent, { upscale: true });
        pass.setSourceTexture(sourceTexture);
        pass.frameUpdate();
        expect(pass.upscale).to.equal(true);
        expect(pass.shader.name).to.include('Upscale');
        const { backBuffer } = device;
        expect([pass.historyTextures[0].width, pass.historyTextures[0].height]).to.deep.equal([backBuffer.width, backBuffer.height]);
    });

    it('resizes its history to the source texture it is given', function () {
        pass = new RenderPassTAA(device, createCamera());
        pass.setSourceTexture(createTexture(64, 32));
        pass.frameUpdate();

        const other = createTexture(16, 8);
        pass.setSourceTexture(other);
        pass.frameUpdate();
        expect(pass.sourceTexture).to.equal(other);
        expect([pass.renderTarget.width, pass.renderTarget.height]).to.deep.equal([16, 8]);
    });

    it('releases both of its history buffers when destroyed', function () {
        pass = new RenderPassTAA(device, createCamera());

        // render to the second buffer, so that the first is the one read, and both are in use
        pass.update();
        const destroyed = pass.historyTextures.map(texture => spy(texture, 'destroy'));
        const renderTargets = pass.historyRenderTargets.map(renderTarget => spy(renderTarget, 'destroy'));

        pass.destroy();
        destroyed.forEach(destroy => expect(destroy.calledOnce).to.equal(true));
        renderTargets.forEach(destroy => expect(destroy.calledOnce).to.equal(true));
        expect(pass.historyTextures).to.have.lengthOf(0);
        expect(pass.historyRenderTargets).to.have.lengthOf(0);
    });
});
