import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { GSPLATDATA_COMPACT, GSPLATDATA_LARGE } from '../../../src/scene/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import { GSplatSogResource } from '../../../src/scene/gsplat/gsplat-sog-resource.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import glslHelpers from '../../../src/scene/shader-lib/glsl/chunks/gsplat/vert/gsplatHelpers.js';
import wgslHelpers from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/vert/gsplatHelpers.js';

describe('GSplatParams#compensation', function () {
    it('defaults to on and adds no work buffer streams', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        for (const dataFormat of [GSPLATDATA_COMPACT, GSPLATDATA_LARGE]) {
            const params = new GSplatParams(device);
            params.dataFormat = dataFormat;
            const streams = params.format.extraStreams.length;
            expect(params.compensation).to.equal(true);
            params.compensation = false;
            params.compensation = true;
            expect(params.format.extraStreams.length).to.equal(streams);
        }
        device.destroy();
    });
});

describe('gsplatHelpersVS plateau shape', function () {
    // the unsqueezed plateau mass I(D) and the squeeze e(D) (see gsplatHelpersVS)
    const mass = (D) => {
        const p = D - 1;
        return 0.5 * p * p + 1 / D + 0.5 * p * Math.sqrt(2 * Math.PI / D);
    };
    const extent = D => (D - 1) / Math.sqrt(8) + 1 / Math.sqrt(D);
    const coefficients = (source) => {
        const body = source.slice(source.indexOf('gsplatPlateauShape'));
        const m = body.match(/return 1\.0 \+ t \* \(([-\d.]+) \+ s \* \(([-\d.]+) \+ s \* \(([-\d.]+) \+ ([-\d.]+) \* s\)\)\)/);
        return m.slice(1).map(Number);
    };

    it('uses the same fit in GLSL and WGSL', function () {
        expect(coefficients(glslHelpers)).to.deep.equal(coefficients(wgslHelpers));
    });

    it('draws each opacity in (1, 1.5625] with its exact mass', function () {
        const [c0, c1, c2, c3] = coefficients(glslHelpers);
        for (let A = 1.001; A <= 1.5625; A += 0.001) {
            const t = A - 1;
            const s = Math.sqrt(t);
            const D = 1 + t * (c0 + s * (c1 + s * (c2 + c3 * s)));
            expect(mass(D) / extent(D) ** 2 / A).to.be.closeTo(1, 2e-4);
        }
    });
});

describe('GSplatSogResource#hasOverUnity', function () {
    const resource = meta => Object.assign(Object.create(GSplatSogResource.prototype), { gsplatData: { meta } });

    it('is true only for v3 data whose stored opacity exceeds 1', function () {
        expect(resource({ version: 3, opacity: { max: 1.5625 } }).hasOverUnity).to.equal(true);
        expect(resource({ version: 3, opacity: { max: 1 } }).hasOverUnity).to.equal(false);
        expect(resource({ version: 3 }).hasOverUnity).to.equal(false);
        expect(resource({ version: 2 }).hasOverUnity).to.equal(false);
    });
});

describe('GSplatResource opacity_excess', function () {
    // Two PLY-style gaussians: logit opacity 0 (= 0.5), with an optional opacity_excess column.
    const makeData = (excess) => {
        const props = { x: 0, y: 0, z: 0, rot_0: 1, rot_1: 0, rot_2: 0, rot_3: 0, scale_0: 0, scale_1: 0, scale_2: 0, f_dc_0: 0, f_dc_1: 0, f_dc_2: 0, opacity: 0 };
        const properties = Object.entries(props).map(([name, v]) => ({ type: 'float', name, storage: new Float32Array(2).fill(v), byteSize: 4 }));
        if (excess) {
            properties.push({ type: 'float', name: 'opacity_excess', storage: Float32Array.from(excess), byteSize: 4 });
        }
        return new GSplatData([{ name: 'vertex', count: 2, properties }]);
    };
    const alphas = (resource) => {
        const levels = resource.streams.getTexture('splatColor')._levels[0];
        return [levels[3], levels[7]];
    };

    it('adds opacity_excess to the uploaded opacity, clamped at 1.5625, and reports over-unity', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const resource = new GSplatResource(device, makeData([2.5, 0.75]));
        expect(resource.hasOverUnity).to.equal(true);
        expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(1.5625), FloatPacking.float2Half(1.25)]);
        resource.destroy();
        device.destroy();
    });

    it('is unchanged without excess', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        for (const data of [makeData(null), makeData([0, 0])]) {
            const resource = new GSplatResource(device, data);
            expect(resource.hasOverUnity).to.equal(false);
            expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(0.5), FloatPacking.float2Half(0.5)]);
            resource.destroy();
        }
        device.destroy();
    });

    it('exposes the extras carried by the data (as decompressed SOG data sets them)', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const data = makeData(null);
        const extras = { author: 'test' };
        data.extras = extras;
        const resource = new GSplatResource(device, data);
        expect(resource.extras).to.equal(extras);
        resource.destroy();
        device.destroy();
    });
});
