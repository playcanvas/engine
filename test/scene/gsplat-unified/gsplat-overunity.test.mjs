import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import glslHelpers from '../../../src/scene/shader-lib/glsl/chunks/gsplat/vert/gsplatHelpers.js';
import wgslHelpers from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/vert/gsplatHelpers.js';

describe('gsplatHelpersVS plateau core', function () {
    const constants = (source) => {
        const body = source.slice(source.indexOf('gsplatPlateauCore'));
        const m = body.match(/return sqrt\(([\d.]+) \+ ([\d.]+) \* t\) - ([\d.]+)/);
        return m.slice(1).map(Number);
    };
    const core = ([p, q, r], A) => Math.sqrt(p + q * Math.min(Math.max(A - 1, 0), 0.5625)) - r;

    // The drawn mass of a unit-peak splat over its quad, as gsplatPS evaluates it: the radius r = |uv|
    // remapped past the core, then normExp. uv runs over the unit disc.
    const EXP4 = Math.exp(-4);
    const drawnMass = (u0) => {
        const steps = 20000;
        let mass = 0;
        for (let i = 0; i < steps; i++) {
            const r = (i + 0.5) / steps;
            const c = Math.max(0, r - u0) / (1 - u0);
            mass += ((Math.exp(-4 * c * c) - EXP4) / (1 - EXP4)) * 2 * Math.PI * r / steps;
        }
        return mass;
    };

    it('uses the same constants in GLSL and WGSL', function () {
        expect(constants(glslHelpers)).to.deep.equal(constants(wgslHelpers));
    });

    it('is the plain gaussian at opacity 1', function () {
        expect(core(constants(glslHelpers), 1)).to.be.closeTo(0, 1e-7);
    });

    it('draws each opacity in (1, 1.5625] with its mass, relative to a plain gaussian of opacity 1', function () {
        const c = constants(glslHelpers);
        const plain = drawnMass(0);
        for (let A = 1.025; A <= 1.5625; A += 0.025) {
            expect(drawnMass(core(c, A)) / plain / A).to.be.closeTo(1, 1e-6);
        }
    });
});

describe('GSplatResource opacity_linear', function () {
    // Two PLY-style gaussians: logit opacity 0 (= 0.5), with an optional opacity_linear column.
    const makeData = (linear) => {
        const props = { x: 0, y: 0, z: 0, rot_0: 1, rot_1: 0, rot_2: 0, rot_3: 0, scale_0: 0, scale_1: 0, scale_2: 0, f_dc_0: 0, f_dc_1: 0, f_dc_2: 0, opacity: 0 };
        const properties = Object.entries(props).map(([name, v]) => ({ type: 'float', name, storage: new Float32Array(2).fill(v), byteSize: 4 }));
        if (linear) {
            properties.push({ type: 'float', name: 'opacity_linear', storage: Float32Array.from(linear), byteSize: 4 });
        }
        return new GSplatData([{ name: 'vertex', count: 2, properties }]);
    };
    const alphas = (resource) => {
        const levels = resource.streams.getTexture('splatColor')._levels[0];
        return [levels[3], levels[7]];
    };

    it('uploads opacity_linear as the opacity, clamped at 1.5625', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const resource = new GSplatResource(device, makeData([3, 1.25]));
        expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(1.5625), FloatPacking.float2Half(1.25)]);
        resource.destroy();
        device.destroy();
    });

    it('always wins over the opacity logit', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const resource = new GSplatResource(device, makeData([0, 0.25]));
        expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(0), FloatPacking.float2Half(0.25)]);
        resource.destroy();
        device.destroy();
    });

    it('uses the opacity logit without the column', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const resource = new GSplatResource(device, makeData(null));
        expect(alphas(resource)).to.deep.equal([FloatPacking.float2Half(0.5), FloatPacking.float2Half(0.5)]);
        resource.destroy();
        device.destroy();
    });

    it('reports opacity_linear as the alpha of the CPU iterator, and the logit without it', function () {
        const alpha = (data) => {
            const c = new Vec4();
            data.createIter(null, null, null, c).read(1);
            return c.w;
        };
        expect(alpha(makeData([0, 0.25]))).to.equal(0.25);
        expect(alpha(makeData([3, 3]))).to.equal(3);
        expect(alpha(makeData(null))).to.equal(0.5);
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
