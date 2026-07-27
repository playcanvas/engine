import { expect } from 'chai';

import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Mesh } from '../../src/scene/mesh.js';

const POSITIONS = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
];
const INDICES = [0, 1, 2];

describe('Mesh', function () {

    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'mock' });
    });

    afterEach(function () {
        device.destroy();
    });

    describe('#getPositions()', function () {

        it('populates an array from a stream which has not been applied yet', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(POSITIONS);

            const positions = [];
            expect(mesh.getPositions(positions)).to.equal(3);
            expect(positions).to.deep.equal(POSITIONS);
        });

        it('populates a typed array from a stream which has not been applied yet', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(new Float32Array(POSITIONS));

            const positions = new Float32Array(9);
            expect(mesh.getPositions(positions)).to.equal(3);
            expect(Array.from(positions)).to.deep.equal(POSITIONS);
        });

        it('returns the same data before and after the mesh is updated', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(POSITIONS);
            mesh.setIndices(INDICES);

            const beforeUpdate = [];
            mesh.getPositions(beforeUpdate);

            mesh.update();

            const afterUpdate = [];
            expect(mesh.getPositions(afterUpdate)).to.equal(3);
            expect(afterUpdate).to.deep.equal(beforeUpdate);
        });
    });

    describe('#getIndices()', function () {

        it('populates an array from indices which have not been applied yet', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(POSITIONS);
            mesh.setIndices(INDICES);

            const indices = [];
            expect(mesh.getIndices(indices)).to.equal(3);
            expect(indices).to.deep.equal(INDICES);
        });
    });
});
