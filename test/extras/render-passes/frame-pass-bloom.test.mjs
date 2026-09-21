import { expect } from 'chai';

import { FramePassBloom } from '../../../src/extras/render-passes/frame-pass-bloom.js';
import { PIXELFORMAT_RGBA16F, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { setProgramLibrary } from '../../../src/scene/shader-lib/get-program-library.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ProgramLibrary } from '../../../src/scene/shader-lib/program-library.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';

describe('FramePassBloom', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    /** @type {FramePassBloom} */
    let pass;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 128, height: 128 });

        // the downsample and upsample passes compile shaders, which an app would have set the
        // device up for
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).add(shaderChunksGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).add(shaderChunksWGSL);
        setProgramLibrary(device, new ProgramLibrary(device));

        const sourceTexture = new Texture(device, {
            name: 'BloomSource',
            width: 64,
            height: 64,
            format: PIXELFORMAT_RGBA16F,
            mipmaps: false
        });
        pass = new FramePassBloom(device, sourceTexture, PIXELFORMAT_RGBA16F);
    });

    afterEach(function () {
        pass?.destroy();
        pass = null;
        device?.destroy();
        device = null;
    });

    it('compiles no high pass while the threshold is zero', function () {
        pass.frameUpdate();

        expect(pass.prefilterPass).to.equal(null);
        expect(pass.beforePasses[0].prefilter).to.equal(false);
    });

    it('applies the high pass to the first downsample only', function () {
        pass.threshold = 2;
        pass.frameUpdate();

        expect(pass.prefilterPass).to.equal(pass.beforePasses[0]);
        expect(pass.beforePasses.filter(p => p.prefilter).length).to.equal(1);
    });

    it('sets a knee of half the threshold', function () {
        pass.threshold = 2;
        pass.frameUpdate();

        expect(pass.prefilterPass.prefilterThreshold).to.equal(2);
        expect(pass.prefilterPass.prefilterKnee).to.equal(1);

        // and follows the threshold without rebuilding the passes
        const downsample = pass.prefilterPass;
        pass.threshold = 5;
        pass.frameUpdate();

        expect(pass.prefilterPass).to.equal(downsample);
        expect(downsample.prefilterThreshold).to.equal(5);
        expect(downsample.prefilterKnee).to.equal(2.5);
    });

    it('rebuilds the passes when the threshold is switched off', function () {
        pass.threshold = 2;
        pass.frameUpdate();
        expect(pass.prefilterPass).to.not.equal(null);

        pass.threshold = 0;
        pass.frameUpdate();

        expect(pass.prefilterPass).to.equal(null);
        expect(pass.beforePasses[0].prefilter).to.equal(false);
    });
});
