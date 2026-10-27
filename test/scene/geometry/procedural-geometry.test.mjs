import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoxGeometry } from '../../../src/scene/geometry/box-geometry.js';
import { CapsuleGeometry } from '../../../src/scene/geometry/capsule-geometry.js';
import { ConeGeometry } from '../../../src/scene/geometry/cone-geometry.js';
import { RoundedBoxGeometry } from '../../../src/scene/geometry/rounded-box-geometry.js';
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

describe('RoundedBoxGeometry', function () {

    // distance of a vertex from the box the rounding is centered on
    const distanceToInnerBox = (positions, vertex, inner) => {
        let lengthSq = 0;
        for (let k = 0; k < 3; k++) {
            const x = positions[vertex * 3 + k];
            const d = x - Math.max(-inner[k], Math.min(inner[k], x));
            lengthSq += d * d;
        }
        return Math.sqrt(lengthSq);
    };

    it('generates no zero-area triangles', function () {
        expect(countZeroAreaTriangles(new RoundedBoxGeometry())).to.equal(0);

        // fully rounded in all axes, and in one axis only
        expect(countZeroAreaTriangles(new RoundedBoxGeometry({ radius: 0.5 }))).to.equal(0);
        expect(countZeroAreaTriangles(new RoundedBoxGeometry({
            halfExtents: new Vec3(1, 0.25, 1),
            radius: 0.25,
            widthSegments: 2,
            heightSegments: 3
        }))).to.equal(0);
    });

    it('places every vertex at the radius from the inner box', function () {
        const geometry = new RoundedBoxGeometry({
            halfExtents: new Vec3(1, 0.5, 0.25),
            radius: 0.1,
            radiusSegments: 6,
            widthSegments: 3,
            heightSegments: 2
        });
        const inner = [0.9, 0.4, 0.15];

        for (let i = 0; i < geometry.positions.length / 3; i++) {
            expect(distanceToInnerBox(geometry.positions, i, inner)).to.be.closeTo(0.1, 1e-9);
        }
    });

    it('winds every triangle to face along its vertex normals', function () {
        const { positions, normals, indices } = new RoundedBoxGeometry({ radius: 0.2 });

        for (let i = 0; i < indices.length; i += 3) {
            const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
            const u = [0, 1, 2].map(k => positions[b * 3 + k] - positions[a * 3 + k]);
            const v = [0, 1, 2].map(k => positions[c * 3 + k] - positions[a * 3 + k]);
            const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
            const dot = cross[0] * normals[a * 3] + cross[1] * normals[a * 3 + 1] + cross[2] * normals[a * 3 + 2];
            expect(dot).to.be.greaterThan(0);
        }
    });

    it('shares positions and normals where faces meet', function () {
        const { positions, normals } = new RoundedBoxGeometry({ radius: 0.2, radiusSegments: 4 });

        const normalByPosition = new Map();
        let shared = 0;
        for (let i = 0; i < positions.length / 3; i++) {
            const key = [0, 1, 2].map(k => positions[i * 3 + k]).join(',');
            const normal = [0, 1, 2].map(k => normals[i * 3 + k]);
            const other = normalByPosition.get(key);
            if (other) {
                expect(normal).to.deep.equal(other);
                shared++;
            } else {
                normalByPosition.set(key, normal);
            }
        }

        // each of the 12 edges has 6 seam vertices shared by 2 faces, 4 of them away from the
        // corners, and each of the 8 corners is shared by 3 faces
        expect(shared).to.equal(12 * 4 + 8 * 2);
    });

    it('generates the same box as BoxGeometry when the radius is zero', function () {
        const opts = {
            halfExtents: new Vec3(1, 0.5, 2),
            widthSegments: 3,
            heightSegments: 2,
            lengthSegments: 4,
            yOffset: 0.5
        };
        const rounded = new RoundedBoxGeometry({ ...opts, radius: 0 });
        const box = new BoxGeometry(opts);

        for (const attribute of ['positions', 'normals', 'uvs', 'uvs1', 'indices']) {
            expect(rounded[attribute].length).to.equal(box[attribute].length);
            rounded[attribute].forEach((value, i) => {
                expect(value).to.be.closeTo(box[attribute][i], 1e-12);
            });
        }
    });

    it('clamps the radius to the smallest half extent', function () {
        const { positions } = new RoundedBoxGeometry({ radius: 2 });

        for (let i = 0; i < positions.length; i += 3) {
            expect(Math.hypot(positions[i], positions[i + 1], positions[i + 2])).to.be.closeTo(0.5, 1e-9);
        }
    });

    it('rounds an odd number of radius segments up', function () {
        const odd = new RoundedBoxGeometry({ radiusSegments: 3 });
        const even = new RoundedBoxGeometry({ radiusSegments: 4 });

        expect(odd.positions).to.deep.equal(even.positions);
    });
});
