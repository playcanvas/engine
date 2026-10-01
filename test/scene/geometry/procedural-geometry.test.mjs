import { expect } from 'chai';

import { CapsuleGeometry } from '../../../src/scene/geometry/capsule-geometry.js';
import { ConeGeometry } from '../../../src/scene/geometry/cone-geometry.js';
import { SphereGeometry } from '../../../src/scene/geometry/sphere-geometry.js';

const triangleArea = (positions, a, b, c) => {
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
};

// counts triangles that have (close to) zero area and so are never rasterized
const countZeroAreaTriangles = (geometry) => {
    const { positions, indices } = geometry;
    let count = 0;
    for (let i = 0; i < indices.length; i += 3) {
        if (triangleArea(positions, indices[i], indices[i + 1], indices[i + 2]) < 1e-12) {
            count++;
        }
    }
    return count;
};

const countOutOfRangeIndices = (geometry) => {
    const vertexCount = geometry.positions.length / 3;
    return geometry.indices.filter(index => index >= vertexCount).length;
};

// for each triangle using one of the given vertices, expects that vertex's u to sit half way
// between the u of the triangle's other two vertices
const expectCenteredU = (geometry, isCenteredVertex) => {
    const { uvs, indices } = geometry;
    let checked = 0;
    for (let i = 0; i < indices.length; i += 3) {
        const triangle = [indices[i], indices[i + 1], indices[i + 2]];
        for (const vertex of triangle) {
            if (isCenteredVertex(vertex)) {
                const [a, b] = triangle.filter(v => v !== vertex);
                expect(uvs[vertex * 2]).to.be.closeTo((uvs[a * 2] + uvs[b * 2]) / 2, 1e-9);
                checked++;
            }
        }
    }
    expect(checked).to.be.greaterThan(0);
};

describe('SphereGeometry', function () {

    it('generates no zero-area triangles at the poles', function () {
        const geometry = new SphereGeometry({ latitudeBands: 5, longitudeBands: 7 });

        expect(countZeroAreaTriangles(geometry)).to.equal(0);

        // two triangles per quad, except a single triangle per segment in each pole row
        expect(geometry.indices.length / 3).to.equal(2 * 5 * 7 - 2 * 7);
    });

    it('centers the u of each pole vertex on its triangle', function () {
        const radius = 0.5;
        const geometry = new SphereGeometry({ radius });
        const positions = geometry.positions;

        expectCenteredU(geometry, vertex => Math.abs(positions[vertex * 3 + 1]) === radius);
    });
});

describe('CapsuleGeometry', function () {

    it('generates no zero-area triangles at the poles', function () {
        expect(countZeroAreaTriangles(new CapsuleGeometry())).to.equal(0);
    });

    it('only indexes existing vertices when the height is twice the radius', function () {
        const geometry = new CapsuleGeometry({ radius: 0.5, height: 1 });

        expect(geometry.indices.length).to.be.greaterThan(0);
        expect(countOutOfRangeIndices(geometry)).to.equal(0);
        expect(countZeroAreaTriangles(geometry)).to.equal(0);
    });
});

describe('ConeGeometry', function () {

    it('generates no zero-area triangles at the tip', function () {
        expect(countZeroAreaTriangles(new ConeGeometry())).to.equal(0);
        expect(countZeroAreaTriangles(new ConeGeometry({ baseRadius: 0, peakRadius: 0.5 }))).to.equal(0);
    });

    it('centers the u of each tip vertex on its triangle', function () {
        const geometry = new ConeGeometry({ height: 1 });
        const positions = geometry.positions;

        expectCenteredU(geometry, vertex => positions[vertex * 3 + 1] === 0.5);
    });

    it('only indexes existing vertices when the base radius is zero', function () {
        const geometry = new ConeGeometry({ baseRadius: 0, peakRadius: 0.5 });

        expect(countOutOfRangeIndices(geometry)).to.equal(0);
    });
});
