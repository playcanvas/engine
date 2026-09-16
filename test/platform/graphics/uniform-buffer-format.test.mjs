import { expect } from 'chai';

import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4 } from '../../../src/platform/graphics/constants.js';
import { ScopeSpace } from '../../../src/platform/graphics/scope-space.js';
import { UniformBufferFormat, UniformFormat } from '../../../src/platform/graphics/uniform-buffer-format.js';

describe('UniformBufferFormat', function () {

    const device = { scope: new ScopeSpace('test') };

    describe('#key', function () {

        it('is the same for formats with the same uniforms', function () {
            const a = new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            const b = new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            expect(a.key).to.be.a('string').that.is.not.empty;
            expect(a.key).to.equal(b.key);
        });

        it('differs when a uniform name, type, array size or order differs', function () {
            const base = new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            const renamed = new UniformBufferFormat(device, [new UniformFormat('tint', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            const retyped = new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC3), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            const arrayed = new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4, 2), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            const reordered = new UniformBufferFormat(device, [new UniformFormat('depth', UNIFORMTYPE_FLOAT), new UniformFormat('color', UNIFORMTYPE_VEC4)]);

            expect(renamed.key).to.not.equal(base.key);
            expect(retyped.key).to.not.equal(base.key);
            expect(arrayed.key).to.not.equal(base.key);
            expect(reordered.key).to.not.equal(base.key);
        });

        it('is empty for a format without uniforms', function () {
            const empty = new UniformBufferFormat(device, []);
            expect(empty.key).to.equal('');
            expect(empty.byteSize).to.equal(0);
        });

        it('does not affect the layout', function () {
            const format = new UniformBufferFormat(device, [new UniformFormat('matrix', UNIFORMTYPE_MAT4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]);
            expect(format.byteSize).to.equal(80);
            expect(format.get('depth').offset).to.equal(16);
        });

    });

    describe('#pack', function () {

        const names = format => format.uniforms.map(uniform => uniform.name);

        it('keeps the order of the array by default', function () {
            const format = new UniformBufferFormat(device, [new UniformFormat('depth', UNIFORMTYPE_FLOAT), new UniformFormat('color', UNIFORMTYPE_VEC4)]);
            expect(names(format)).to.deep.equal(['depth', 'color']);
            expect(format.byteSize).to.equal(32);
        });

        it('puts whole rows first and completes each vec3 with a scalar', function () {
            // in array order the two scalars sit between the vec3s and the layout takes 64 bytes
            const format = new UniformBufferFormat(device, [
                new UniformFormat('alpha', UNIFORMTYPE_FLOAT),
                new UniformFormat('beta', UNIFORMTYPE_VEC3),
                new UniformFormat('gamma', UNIFORMTYPE_FLOAT),
                new UniformFormat('delta', UNIFORMTYPE_VEC3),
                new UniformFormat('tint', UNIFORMTYPE_VEC4)
            ], { pack: true });
            expect(names(format)).to.deep.equal(['tint', 'beta', 'alpha', 'delta', 'gamma']);
            expect(format.get('beta').offset).to.equal(4);
            expect(format.get('alpha').offset).to.equal(7);
            expect(format.get('delta').offset).to.equal(8);
            expect(format.get('gamma').offset).to.equal(11);
            expect(format.byteSize).to.equal(48);
        });

        it('keeps matrices and arrays on their own rows and pairs the vec2s', function () {
            const format = new UniformBufferFormat(device, [
                new UniformFormat('scale', UNIFORMTYPE_FLOAT),
                new UniformFormat('offset', UNIFORMTYPE_VEC2),
                new UniformFormat('normal', UNIFORMTYPE_MAT3),
                new UniformFormat('weights', UNIFORMTYPE_FLOAT, 2),
                new UniformFormat('tiling', UNIFORMTYPE_VEC2)
            ], { pack: true });
            // array uniforms are named after their first element
            expect(names(format)).to.deep.equal(['normal', 'weights[0]', 'offset', 'tiling', 'scale']);
            expect(format.get('weights[0]').offset).to.equal(12);
            expect(format.get('offset').offset).to.equal(20);
            expect(format.get('tiling').offset).to.equal(22);
            expect(format.get('scale').offset).to.equal(24);
            expect(format.byteSize).to.equal(112);
        });

        it('describes the layout order in the key and leaves the lookup by name intact', function () {
            const uniforms = () => [new UniformFormat('depth', UNIFORMTYPE_FLOAT), new UniformFormat('color', UNIFORMTYPE_VEC3)];
            const packed = new UniformBufferFormat(device, uniforms(), { pack: true });
            const plain = new UniformBufferFormat(device, uniforms());
            expect(packed.key).to.equal(`color:${UNIFORMTYPE_VEC3}:0,depth:${UNIFORMTYPE_FLOAT}:0`);
            expect(packed.key).to.not.equal(plain.key);
            expect(packed.get('depth').offset).to.equal(3);
            expect(packed.byteSize).to.equal(16);
            expect(plain.byteSize).to.equal(32);
        });

    });

});
