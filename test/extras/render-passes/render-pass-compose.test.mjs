import { expect } from 'chai';

import { RenderPassCompose } from '../../../src/extras/render-passes/render-pass-compose.js';
import { GAMMA_SRGB } from '../../../src/scene/constants.js';

describe('RenderPassCompose', function () {

    // a compose pass with no graphics device behind it. The shader state is pre-set to what the
    // stub render target implies, so the shader rebuild is skipped and the test is left with the
    // render target sizing alone
    const createPass = (options) => {
        let resized = null;
        const pass = Object.create(RenderPassCompose.prototype);
        pass.device = {
            isWebGPU: false,
            backBuffer: { width: 64, height: 32 },
            on: () => {},
            off: () => {}
        };
        pass.renderTarget = {
            width: 4,
            height: 4,
            isColorBufferSrgb: () => false,
            resize: (width, height) => {
                resized = { width, height };
            }
        };
        pass._gammaCorrection = GAMMA_SRGB;
        pass._shaderDirty = false;
        pass._customComposeChunks = new Map();
        pass.options = options;
        return { pass, getResized: () => resized };
    };

    it('resizes its render target from the source supplied to init', function () {
        const { pass, getResized } = createPass({ resizeSource: { width: 100, height: 50 }, scaleX: 1, scaleY: 1 });

        pass.frameUpdate();

        expect(getResized()).to.deep.equal({ width: 100, height: 50 });
    });

    it('leaves its render target alone when init supplied no options', function () {
        const { pass, getResized } = createPass(undefined);

        pass.frameUpdate();

        expect(getResized()).to.equal(null);
    });
});
