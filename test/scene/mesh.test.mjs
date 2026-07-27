import { expect } from 'chai';

import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Mesh } from '../../src/scene/mesh.js';

const POSITIONS = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
];
const INDICES = [0, 1, 2];

// runs the function with console.error suppressed, and returns the number of debug asserts it fired
const withAssertCount = (fn) => {
    const error = console.error;
    let count = 0;
    console.error = () => {
        count++;
    };
    try {
        fn();
    } finally {
        console.error = error;
    }
    return count;
};

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

        it('copies only the used part of a partially set stream into a typed array', function () {
            const mesh = new Mesh(device);

            // stage 4 vertices worth of positions, but use only the first 2
            mesh.setPositions(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 3, 2);

            const positions = new Float32Array(6);
            expect(mesh.getPositions(positions)).to.equal(2);
            expect(Array.from(positions)).to.deep.equal([1, 2, 3, 4, 5, 6]);
        });

        it('copies only the used part of a partially set stream', function () {
            const mesh = new Mesh(device);

            // stage 4 vertices worth of positions, but use only the first 2
            mesh.setPositions(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 3, 2);

            const beforeUpdate = [];
            expect(mesh.getPositions(beforeUpdate)).to.equal(2);
            expect(beforeUpdate).to.deep.equal([1, 2, 3, 4, 5, 6]);

            mesh.update();

            const afterUpdate = [];
            expect(mesh.getPositions(afterUpdate)).to.equal(2);
            expect(afterUpdate).to.deep.equal(beforeUpdate);
        });

        it('copies partial data into a typed array which is too small', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(POSITIONS);

            const positions = new Float32Array(4);
            expect(withAssertCount(() => mesh.getPositions(positions))).to.equal(1);
            expect(Array.from(positions)).to.deep.equal([0, 0, 0, 1]);
        });

        it('copies partial data into a typed array which is too small after the mesh is updated', function () {
            const mesh = new Mesh(device);
            mesh.setPositions(POSITIONS);
            mesh.setIndices(INDICES);
            mesh.update();

            const positions = new Float32Array(4);
            expect(withAssertCount(() => mesh.getPositions(positions))).to.equal(1);
            expect(Array.from(positions)).to.deep.equal([0, 0, 0, 1]);
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
