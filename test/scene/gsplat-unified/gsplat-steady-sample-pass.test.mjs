import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GAMMA_NONE, GAMMA_SRGB, SHADER_FORWARD, TONEMAP_ACES, TONEMAP_NONE } from '../../../src/scene/constants.js';
import { GSplatSteadySamplePass } from '../../../src/scene/gsplat-unified/gsplat-steady-sample-pass.js';

describe('GSplat SteadySplats sample pass color overrides', function () {
    let device;
    let component;
    let forward;
    let pass;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 8, height: 8 });
        component = { camera: {}, gammaCorrection: GAMMA_SRGB, toneMapping: TONEMAP_ACES };
        forward = { renderForwardLayer: sinon.stub() };
        pass = new GSplatSteadySamplePass(device, { camera: component }, forward, {});
    });

    afterEach(function () {
        pass.destroy();
        device.destroy();
    });

    const cases = [
        { name: 'both color settings', gamma: GAMMA_NONE, tone: TONEMAP_NONE },
        { name: 'only gamma correction', gamma: GAMMA_NONE, tone: undefined },
        { name: 'inherited camera settings', gamma: undefined, tone: undefined }
    ];

    cases.forEach((settings) => {
        [false, true].forEach((fails) => {
            it(`restores ${settings.name} after ${fails ? 'a failed' : 'a successful'} draw`, function () {
                const failure = new Error('Sampling draw failed');
                pass.setColorOptions(settings.gamma, settings.tone);
                forward.renderForwardLayer.callsFake((camera, target, layer, transparent, shaderPass, options) => {
                    expect(camera).to.equal(component.camera);
                    expect(shaderPass).to.equal(SHADER_FORWARD);
                    expect(options).to.equal(pass.drawOptions);
                    expect(component.gammaCorrection).to.equal(settings.gamma ?? GAMMA_SRGB);
                    expect(component.toneMapping).to.equal(settings.tone ?? TONEMAP_ACES);
                    if (fails) throw failure;
                });
                if (fails) {
                    expect(() => pass.execute()).to.throw(failure);
                } else {
                    pass.execute();
                }
                expect(forward.renderForwardLayer.calledOnce).to.equal(true);
                expect(component.gammaCorrection).to.equal(GAMMA_SRGB);
                expect(component.toneMapping).to.equal(TONEMAP_ACES);
            });
        });
    });
});
