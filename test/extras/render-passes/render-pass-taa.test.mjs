import { expect } from 'chai';

import { RenderPassTAA } from '../../../src/extras/render-passes/render-pass-taa.js';
import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { createGraphicsDevice, setupShaderLibrary } from '../../device.mjs';

describe('RenderPassTAA', function () {

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    /** @type {RenderPassTAA} */
    let pass;

    /** @type {Texture} */
    let sourceTexture;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 128, height: 128 });

        // the pass compiles a shader
        setupShaderLibrary(device);
    });

    afterEach(function () {
        pass?.destroy();
        pass = null;
        sourceTexture?.destroy();
        sourceTexture = null;
        device?.destroy();
        device = null;
    });

    it('accumulates its history at half float precision, whatever the format of the scene', function () {
        // the scene in a low precision format, which would round away the small steps the
        // history takes towards its converged value each frame
        sourceTexture = new Texture(device, {
            name: 'Scene',
            width: 4,
            height: 4,
            format: PIXELFORMAT_111110F,
            mipmaps: false
        });
        const cameraComponent = /** @type {any} */ ({ shaderParams: new CameraShaderParams() });
        pass = new RenderPassTAA(device, sourceTexture, cameraComponent);

        expect(pass.historyTextures).to.have.lengthOf(2);
        for (const texture of pass.historyTextures) {
            expect(texture.format).to.equal(PIXELFORMAT_RGBA16F);
        }
    });

    it('keeps its history at the resolution of the source, or of the render target when upscaling', function () {
        sourceTexture = new Texture(device, {
            name: 'Scene',
            width: 64,
            height: 32,
            format: PIXELFORMAT_RGBA16F,
            mipmaps: false
        });

        // a camera rendering to the back buffer
        const cameraComponent = /** @type {any} */ ({ shaderParams: new CameraShaderParams(), renderTarget: null });

        pass = new RenderPassTAA(device, sourceTexture, cameraComponent);
        pass.frameUpdate();
        expect(pass.upscale).to.equal(false);
        expect(pass.shader.name).to.not.include('Upscale');
        expect([pass.historyTextures[0].width, pass.historyTextures[0].height]).to.deep.equal([64, 32]);
        pass.destroy();

        pass = new RenderPassTAA(device, sourceTexture, cameraComponent, true);
        pass.frameUpdate();
        expect(pass.upscale).to.equal(true);
        expect(pass.shader.name).to.include('Upscale');
        const { backBuffer } = device;
        expect([pass.historyTextures[0].width, pass.historyTextures[0].height]).to.deep.equal([backBuffer.width, backBuffer.height]);
    });
});
