import { expect } from 'chai';

import { Mat3 } from '../../../src/core/math/mat3.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4 } from '../../../src/platform/graphics/constants.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

/**
 * A stand-in WebGL2 context: constants resolve to numbers, queries return plausible values, and
 * every other call is recorded by name.
 *
 * @param {Map<string, Array<Array<*>>>} calls - Receives the arguments of each call, by name.
 * @returns {object} The context.
 */
const createGl = (calls) => {
    let nextToken = 1;
    return new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (typeof key !== 'string' || key === 'then') return undefined;
            if (/^[A-Z0-9_]+$/.test(key)) {
                target[key] = nextToken++;
                return target[key];
            }
            switch (key) {
                case 'getSupportedExtensions': return () => [];
                case 'getParameter': return () => 16;
                case 'getShaderPrecisionFormat': return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
                case 'getContextAttributes': return () => ({ antialias: false, alpha: true, depth: true, stencil: true });
                case 'isContextLost': return () => false;
            }
            target[key] = (...args) => {
                if (!calls.has(key)) calls.set(key, []);
                calls.get(key).push(args);
                return {};
            };
            return target[key];
        }
    });
};

// The commit functions send a matrix uniform only when its value differs from the one the program
// was last given for it, as they already do for scalars and vectors.
describe('WebGL matrix uniform commit', function () {

    let calls;
    let device;

    beforeEach(function () {
        calls = new Map();
        const gl = createGl(calls);
        const canvas = {
            width: 4,
            height: 4,
            getContext: () => gl,
            addEventListener: () => {},
            removeEventListener: () => {},
            getBoundingClientRect: () => ({ width: 4, height: 4 })
        };
        device = new WebglGraphicsDevice(canvas, {});
    });

    afterEach(function () {
        device.destroy();
    });

    // a uniform of a program, as WebglShader creates them
    const uniform = () => ({ locationId: {}, matrixValue: null });
    const sent = name => calls.get(name) ?? [];

    it('sends a mat4 once while its value stays the same', function () {
        const u = uniform();
        const m = new Mat4().setTranslate(1, 2, 3);

        device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        device.commitFunction[UNIFORMTYPE_MAT4](u, new Mat4().copy(m).data);
        expect(sent('uniformMatrix4fv')).to.have.length(1);
        expect(sent('uniformMatrix4fv')[0][2]).to.equal(m.data);
    });

    it('sends a mat4 again when any element changes', function () {
        const u = uniform();
        const m = new Mat4();

        device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        for (let i = 0; i < 16; i++) {
            const changed = new Mat4().copy(m);
            changed.data[i] += 0.5;
            device.commitFunction[UNIFORMTYPE_MAT4](u, changed.data);
            device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        }
        expect(sent('uniformMatrix4fv')).to.have.length(33);
    });

    it('sends the first value even when it is all zeros', function () {
        const u = uniform();
        device.commitFunction[UNIFORMTYPE_MAT4](u, new Float32Array(16));
        expect(sent('uniformMatrix4fv')).to.have.length(1);
    });

    it('always sends a value containing NaN', function () {
        const u = uniform();
        const m = new Mat4();
        m.data[5] = NaN;
        device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        device.commitFunction[UNIFORMTYPE_MAT4](u, m.data);
        expect(sent('uniformMatrix4fv')).to.have.length(2);
    });

    it('keeps the values of different uniforms apart', function () {
        const a = uniform(), b = uniform();
        const m = new Mat4();

        device.commitFunction[UNIFORMTYPE_MAT4](a, m.data);
        device.commitFunction[UNIFORMTYPE_MAT4](b, m.data);
        device.commitFunction[UNIFORMTYPE_MAT4](a, m.data);
        expect(sent('uniformMatrix4fv').map(args => args[0])).to.deep.equal([a.locationId, b.locationId]);
    });

    it('sends a mat3 and a mat2 only when their values change', function () {
        const u3 = uniform(), u2 = uniform();
        const n = new Mat3();

        device.commitFunction[UNIFORMTYPE_MAT3](u3, n.data);
        device.commitFunction[UNIFORMTYPE_MAT3](u3, new Mat3().data);
        n.data[8] = 2;
        device.commitFunction[UNIFORMTYPE_MAT3](u3, n.data);
        expect(sent('uniformMatrix3fv')).to.have.length(2);

        const m2 = new Float32Array([1, 0, 0, 1]);
        device.commitFunction[UNIFORMTYPE_MAT2](u2, m2);
        device.commitFunction[UNIFORMTYPE_MAT2](u2, new Float32Array([1, 0, 0, 1]));
        device.commitFunction[UNIFORMTYPE_MAT2](u2, new Float32Array([1, 0, 0, 2]));
        expect(sent('uniformMatrix2fv')).to.have.length(2);
    });
});
