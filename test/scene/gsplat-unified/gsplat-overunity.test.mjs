import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSPLATDATA_COMPACT, GSPLATDATA_LARGE } from '../../../src/scene/constants.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import glslHelpers from '../../../src/scene/shader-lib/glsl/chunks/gsplat/vert/gsplatHelpers.js';
import wgslHelpers from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/vert/gsplatHelpers.js';

describe('GSplatParams#compensation', function () {
    it('defaults to on, adds no work buffer streams, and sets the opacity drawn above 1', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        for (const dataFormat of [GSPLATDATA_COMPACT, GSPLATDATA_LARGE]) {
            const params = new GSplatParams(device);
            params.dataFormat = dataFormat;
            const streams = params.format.extraStreams.length;
            const excessMax = () => params.material.getParameter('opacityExcessMax').data;
            expect(params.compensation).to.equal(true);
            expect(excessMax()).to.equal(0.5625);
            params.compensation = false;
            expect(params.compensation).to.equal(false);
            expect(excessMax()).to.equal(0);
            params.compensation = true;
            expect(excessMax()).to.equal(0.5625);
            expect(params.format.extraStreams.length).to.equal(streams);
        }
        device.destroy();
    });
});

describe('gsplatHelpersVS plateau shape', function () {
    const coefficients = (source) => {
        const body = source.slice(source.indexOf('gsplatPlateauShape'));
        const m = body.match(/return 1\.0 \+ t \* \(([-\d.]+) \+ s \* \(([-\d.]+) \+ s \* \(([-\d.]+) \+ ([-\d.]+) \* s\)\)\)/);
        return m.slice(1).map(Number);
    };
    const shape = ([c0, c1, c2, c3], A) => {
        const t = Math.min(Math.max(A - 1, 0), 0.5625);
        const s = Math.sqrt(t);
        return 1 + t * (c0 + s * (c1 + s * (c2 + c3 * s)));
    };

    // The drawn mass of a unit-peak splat over its quad, as gsplatPS evaluates it: the profile mapped to
    // the plain gaussian's A = |uv|^2, then normExp, discarded past A = 1. uv runs over the unit disc.
    const EXP4 = Math.exp(-4);
    const drawnMass = (D) => {
        const e = (D - 1) * 0.35355339 + 1 / Math.sqrt(D);
        const steps = 20000;
        let mass = 0;
        for (let i = 0; i < steps; i++) {
            const u = (i + 0.5) / steps;
            const s = Math.max(0, 2.8284271 * u * e - (D - 1));
            const A = D * s * s * 0.125;
            if (A <= 1) {
                mass += ((Math.exp(-4 * A) - EXP4) / (1 - EXP4)) * 2 * Math.PI * u / steps;
            }
        }
        return mass;
    };

    it('uses the same fit in GLSL and WGSL', function () {
        expect(coefficients(glslHelpers)).to.deep.equal(coefficients(wgslHelpers));
    });

    it('draws each opacity in (1, 1.5625] with its mass, relative to a plain gaussian of opacity 1', function () {
        const c = coefficients(glslHelpers);
        const plain = drawnMass(1);
        for (let A = 1.025; A <= 1.5625; A += 0.025) {
            expect(drawnMass(shape(c, A)) / plain / A).to.be.closeTo(1, 5e-4);
        }
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

    it('adds opacity_excess to the uploaded opacity, clamped at 1.5625', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const resource = new GSplatResource(device, makeData([2.5, 0.75]));
        expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(1.5625), FloatPacking.float2Half(1.25)]);
        resource.destroy();
        device.destroy();
    });

    it('is unchanged without excess', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        for (const data of [makeData(null), makeData([0, 0])]) {
            const resource = new GSplatResource(device, data);
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
