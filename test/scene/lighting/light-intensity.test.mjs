import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI } from '../../../src/scene/constants.js';
import { Light } from '../../../src/scene/light.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('Light intensity', function () {

    /**
     * @param {number} type - The type of the light.
     * @returns {Light} The light, with a grey color.
     */
    const createLight = (type) => {
        const device = createGraphicsDevice({ width: 1, height: 1 });
        const light = new Light(device, false);
        light.type = type;
        light.setColor(0.5, 0.5, 0.5);
        return light;
    };

    const linearGrey = new Color().linear(new Color(0.5, 0.5, 0.5)).r;

    it('scales the linear color for intensities below and above 1', function () {
        const light = createLight(LIGHTTYPE_DIRECTIONAL);
        for (const intensity of [0, 0.25, 0.5, 1, 2, 10]) {
            light.intensity = intensity;
            expect(light._colorLinear[0]).to.be.closeTo(linearGrey * intensity, 1e-6);
            expect(light._colorLinear[1]).to.be.closeTo(linearGrey * intensity, 1e-6);
            expect(light._colorLinear[2]).to.be.closeTo(linearGrey * intensity, 1e-6);
        }
    });

    it('halving the intensity halves the light', function () {
        const light = createLight(LIGHTTYPE_DIRECTIONAL);
        light.intensity = 1;
        const full = light._colorLinear[0];
        light.intensity = 0.5;
        expect(light._colorLinear[0]).to.be.closeTo(full / 2, 1e-6);
    });

    it('scales the linear color by the luminance with physical units', function () {
        const light = createLight(LIGHTTYPE_OMNI);
        light.luminance = 10;
        light.usePhysicalUnits = true;
        const scale = 10 / Light.getLightUnitConversion(LIGHTTYPE_OMNI);
        expect(scale).to.be.lessThan(1);
        expect(light._colorLinear[0]).to.be.closeTo(linearGrey * scale, 1e-6);
    });
});
