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

    describe('BindGroupFormat key', function () {

        const createDevice = () => {
            let implKey = 0;
            return {
                scope: new ScopeSpace('test'),
                createBindGroupFormatImpl() {
                    return { key: implKey++, destroy() {} };
                }
            };
        };

        it('is the same for formats describing the same resources', function () {
            const device = createDevice();
            const a = new BindGroupFormat(device, [new BindTextureFormat('color', SHADERSTAGE_FRAGMENT), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false)]);
            const b = new BindGroupFormat(device, [new BindTextureFormat('color', SHADERSTAGE_FRAGMENT), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false)]);
            expect(a.key).to.be.a('string').that.is.not.empty;
            expect(a.key).to.equal(b.key);
            a.destroy();
            b.destroy();
        });

        it('differs when a texture name, sampler, sample type or order differs', function () {
            const device = createDevice();
            const base = new BindGroupFormat(device, [new BindTextureFormat('color', SHADERSTAGE_FRAGMENT), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT)]);
            const renamed = new BindGroupFormat(device, [new BindTextureFormat('albedo', SHADERSTAGE_FRAGMENT), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT)]);
            const noSampler = new BindGroupFormat(device, [new BindTextureFormat('color', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT)]);
            const unfilterable = new BindGroupFormat(device, [new BindTextureFormat('color', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT)]);
            const reordered = new BindGroupFormat(device, [new BindTextureFormat('depth', SHADERSTAGE_FRAGMENT), new BindTextureFormat('color', SHADERSTAGE_FRAGMENT)]);

            expect(renamed.key).to.not.equal(base.key);
            expect(noSampler.key).to.not.equal(base.key);
            expect(unfilterable.key).to.not.equal(base.key);
            expect(reordered.key).to.not.equal(base.key);
            [base, renamed, noSampler, unfilterable, reordered].forEach(f => f.destroy());
        });

        it('is empty for a format without resources', function () {
            const device = createDevice();
            const empty = new BindGroupFormat(device, []);
            expect(empty.key).to.equal('');
            empty.destroy();
        });
    });
});
