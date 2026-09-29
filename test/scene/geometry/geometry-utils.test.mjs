import { expect } from 'chai';

import { calculateNormals, calculateTangents } from '../../../src/scene/geometry/geometry-utils.js';

// a single triangle in the XY plane, facing +Z
const POSITIONS = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
];
const UVS = [
    0, 0,
    1, 0,
    0, 1
];
const INDICES = [0, 1, 2];

describe('calculateNormals', function () {

    it('generates normals from arrays', function () {
        const normals = calculateNormals(POSITIONS, INDICES);

        expect(Array.isArray(normals)).to.be.true;
        expect(normals).to.deep.equal([
            0, 0, 1,
            0, 0, 1,
            0, 0, 1
        ]);
    });

    it('generates the same normals from typed arrays', function () {
        const normals = calculateNormals(new Float32Array(POSITIONS), new Uint16Array(INDICES));

        expect(normals).to.deep.equal(calculateNormals(POSITIONS, INDICES));
    });

    it('generates a zero normal for a vertex not used by any triangle', function () {
        const normals = calculateNormals([...POSITIONS, 5, 5, 5], INDICES);

        expect(normals).to.deep.equal([
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 0
        ]);
    });

    it('generates a zero normal for a vertex used only by degenerate triangles', function () {
        // vertex 3 sits on vertex 0, and the only triangle using it has zero area
        const normals = calculateNormals([...POSITIONS, 0, 0, 0], [...INDICES, 3, 1, 0]);

        expect(normals.slice(9)).to.deep.equal([0, 0, 0]);
        expect(normals.slice(0, 9)).to.deep.equal([
            0, 0, 1,
            0, 0, 1,
            0, 0, 1
        ]);
    });
});

describe('calculateTangents', function () {

    it('generates tangents from arrays', function () {
        const normals = calculateNormals(POSITIONS, INDICES);
        const tangents = calculateTangents(POSITIONS, normals, UVS, INDICES);

        expect(Array.isArray(tangents)).to.be.true;
        expect(tangents).to.deep.equal([
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 0, 0, 1
        ]);
    });

    it('generates the same tangents from typed arrays', function () {
        const normals = calculateNormals(POSITIONS, INDICES);
        const tangents = calculateTangents(
            new Float32Array(POSITIONS),
            new Float32Array(normals),
            new Float32Array(UVS),
            new Uint16Array(INDICES)
        );

        expect(tangents).to.deep.equal(calculateTangents(POSITIONS, normals, UVS, INDICES));
    });
});
