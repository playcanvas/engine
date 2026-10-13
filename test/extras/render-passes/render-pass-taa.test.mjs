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
});
