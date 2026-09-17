import { expect } from 'chai';

import { BindGroupFormat, BindTextureFormat } from '../../../src/platform/graphics/bind-group-format.js';
import {
    SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D
} from '../../../src/platform/graphics/constants.js';
import { ScopeSpace } from '../../../src/platform/graphics/scope-space.js';

describe('BindTextureFormat', function () {

    describe('#constructor', function () {

        it('defaults hasSampler to true and generates a sampler name', function () {
            const format = new BindTextureFormat('diffuse', SHADERSTAGE_FRAGMENT);
            expect(format.hasSampler).to.equal(true);
            expect(format.samplerName).to.equal('diffuse_sampler');
            expect(format.multisampled).to.equal(false);
            expect(format.textureDimension).to.equal(TEXTUREDIMENSION_2D);
            expect(format.sampleType).to.equal(SAMPLETYPE_FLOAT);
        });

        it('honors hasSampler false and an explicit sampler name', function () {
            const format = new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false, 'customSampler');
            expect(format.hasSampler).to.equal(false);
            expect(format.samplerName).to.equal('customSampler');
            expect(format.multisampled).to.equal(false);
        });

        it('forces hasSampler false and samplerName null when multisampled', function () {
            const format = new BindTextureFormat(
                'msColor',
                SHADERSTAGE_FRAGMENT,
                TEXTUREDIMENSION_2D,
                SAMPLETYPE_UNFILTERABLE_FLOAT,
                false,
                'msColor_sampler',
                true
            );
            expect(format.multisampled).to.equal(true);
            expect(format.hasSampler).to.equal(false);
            expect(format.samplerName).to.equal(null);
        });

        it('coerces SAMPLETYPE_FLOAT to UNFILTERABLE_FLOAT when multisampled', function () {
            const format = new BindTextureFormat(
                'msColor',
                SHADERSTAGE_FRAGMENT,
                TEXTUREDIMENSION_2D,
                SAMPLETYPE_FLOAT,
                false,
                null,
                true
            );
            expect(format.sampleType).to.equal(SAMPLETYPE_UNFILTERABLE_FLOAT);
            expect(format.hasSampler).to.equal(false);
            expect(format.samplerName).to.equal(null);
        });
    });

    describe('BindGroupFormat slots', function () {

        it('assigns one slot to a multisampled texture and two to a sampled texture', function () {
            let implKey = 0;
            const device = {
                scope: new ScopeSpace('test'),
                createBindGroupFormatImpl() {
                    return { key: implKey++, destroy() {} };
                }
            };
            const ms = new BindTextureFormat('msColor', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false, null, true);
            const sampled = new BindTextureFormat('color', SHADERSTAGE_FRAGMENT);
            const format = new BindGroupFormat(device, [ms, sampled]);

            expect(ms.hasSampler).to.equal(false);
            expect(ms.slot).to.equal(0);
            expect(sampled.slot).to.equal(1);
            format.destroy();
        });
    });
});
