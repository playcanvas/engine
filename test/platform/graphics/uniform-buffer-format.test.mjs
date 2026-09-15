import { expect } from 'chai';

import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_MAT4, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4 } from '../../../src/platform/graphics/constants.js';
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

});
