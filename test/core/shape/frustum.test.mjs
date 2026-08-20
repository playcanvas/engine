import { expect } from 'chai';

import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingSphere } from '../../../src/core/shape/bounding-sphere.js';
import { Frustum } from '../../../src/core/shape/frustum.js';
import { Plane } from '../../../src/core/shape/plane.js';

/**
 * A frustum at the given position looking down the negative z axis.
 *
 * @param {number} [x] - The x position of the viewer.
 * @returns {Frustum} The frustum.
 */
const createFrustum = (x = 0) => {
    const frustum = new Frustum();
    frustum.setFromMat4(new Mat4().mul2(
        new Mat4().setPerspective(90, 1, 1, 100),
        new Mat4().setTRS(new Vec3(x, 0, 0), { x: 0, y: 0, z: 0, w: 1 }, Vec3.ONE).invert()
    ));
    return frustum;
};

describe('Frustum', function () {

    describe('#getPlane', function () {

        it('writes into the supplied plane and returns it', function () {
            const frustum = createFrustum();
            const result = new Plane();
            expect(frustum.getPlane(0, result)).to.equal(result);
        });

        it('returns unit length normals for all six planes', function () {
            const frustum = createFrustum();
            const plane = new Plane();
            for (let i = 0; i < 6; i++) {
                frustum.getPlane(i, plane);
                expect(plane.normal.length(), `plane ${i}`).to.be.closeTo(1, 1e-6);
            }
        });

        it('returns the planes in right, left, bottom, top, far, near order with inward normals', function () {
            const frustum = createFrustum();
            const plane = new Plane();

            // a 90 degree square frustum at the origin looking down -z: the near plane faces into
            // the scene and the far plane faces back towards the viewer
            frustum.getPlane(5, plane);
            expect(plane.normal.x).to.be.closeTo(0, 1e-6);
            expect(plane.normal.y).to.be.closeTo(0, 1e-6);
            expect(plane.normal.z).to.be.closeTo(-1, 1e-6);

            frustum.getPlane(4, plane);
            expect(plane.normal.z).to.be.closeTo(1, 1e-6);

            // the side planes are at 45 degrees and pass through the viewer, so their distance is 0
            for (const [index, sign] of [[0, -1], [1, 1]]) {
                frustum.getPlane(index, plane);
                expect(plane.distance, `plane ${index} distance`).to.be.closeTo(0, 1e-6);
                expect(Math.sign(plane.normal.x), `plane ${index} normal x`).to.equal(sign);
            }
        });
    });

    describe('#setPlane', function () {

        it('round trips through getPlane', function () {
            const frustum = new Frustum();
            const source = new Plane(new Vec3(0, 1, 0), -5);
            const result = new Plane();

            frustum.setPlane(2, source);
            frustum.getPlane(2, result);

            expect(result.normal.x).to.be.closeTo(0, 1e-6);
            expect(result.normal.y).to.be.closeTo(1, 1e-6);
            expect(result.normal.z).to.be.closeTo(0, 1e-6);
            expect(result.distance).to.be.closeTo(-5, 1e-6);
        });

        it('normalizes the plane it stores', function () {
            const frustum = new Frustum();
            const result = new Plane();

            // the same plane, with a normal three times too long
            frustum.setPlane(0, new Plane(new Vec3(0, 3, 0), -15));
            frustum.getPlane(0, result);

            expect(result.normal.length()).to.be.closeTo(1, 1e-6);
            expect(result.distance).to.be.closeTo(-5, 1e-6);
        });

        it('returns the frustum for chaining', function () {
            const frustum = new Frustum();
            expect(frustum.setPlane(0, new Plane())).to.equal(frustum);
        });

        it('leaves the other planes untouched', function () {
            const frustum = createFrustum();
            const before = new Plane();
            const after = new Plane();
            frustum.getPlane(3, before);

            frustum.setPlane(0, new Plane(new Vec3(1, 0, 0), 7));
            frustum.getPlane(3, after);

            expect(after.normal.x).to.be.closeTo(before.normal.x, 1e-6);
            expect(after.normal.y).to.be.closeTo(before.normal.y, 1e-6);
            expect(after.normal.z).to.be.closeTo(before.normal.z, 1e-6);
            expect(after.distance).to.be.closeTo(before.distance, 1e-6);
        });
    });

    describe('#copy', function () {

        it('copies every plane', function () {
            const src = createFrustum();
            const dst = new Frustum();
            dst.copy(src);

            const a = new Plane();
            const b = new Plane();
            for (let i = 0; i < 6; i++) {
                src.getPlane(i, a);
                dst.getPlane(i, b);
                expect(b.normal.equals(a.normal), `plane ${i} normal`).to.equal(true);
                expect(b.distance, `plane ${i} distance`).to.equal(a.distance);
            }
        });

        it('does not alias the source', function () {
            const src = createFrustum();
            const dst = new Frustum().copy(src);
            dst.setPlane(0, new Plane(new Vec3(1, 0, 0), 42));

            const plane = new Plane();
            src.getPlane(0, plane);
            expect(plane.distance).to.not.equal(42);
        });
    });

    describe('#clone', function () {

        it('produces an independent frustum with the same planes', function () {
            const src = createFrustum();
            const clone = src.clone();
            expect(clone).to.not.equal(src);

            const a = new Plane();
            const b = new Plane();
            for (let i = 0; i < 6; i++) {
                src.getPlane(i, a);
                clone.getPlane(i, b);
                expect(b.distance, `plane ${i}`).to.equal(a.distance);
            }
        });
    });

    describe('#containsPoint', function () {

        it('accepts a point in the middle and rejects points outside', function () {
            const frustum = createFrustum();
            expect(frustum.containsPoint(new Vec3(0, 0, -50))).to.equal(true);
            expect(frustum.containsPoint(new Vec3(0, 0, 50))).to.equal(false);
            expect(frustum.containsPoint(new Vec3(0, 0, -200))).to.equal(false);
            expect(frustum.containsPoint(new Vec3(200, 0, -50))).to.equal(false);
        });
    });

    describe('#containsSphere', function () {

        it('reports outside, intersecting and contained', function () {
            const frustum = createFrustum();
            expect(frustum.containsSphere(new BoundingSphere(new Vec3(0, 0, 50), 1))).to.equal(0);
            expect(frustum.containsSphere(new BoundingSphere(new Vec3(0, 0, -50), 5))).to.equal(2);

            // straddling the left plane, which passes through the origin at 45 degrees
            expect(frustum.containsSphere(new BoundingSphere(new Vec3(-50, 0, -50), 5))).to.equal(1);
        });
    });

    describe('#add', function () {

        it('contains points that were only inside the other frustum', function () {
            const base = createFrustum(0);
            const other = createFrustum(60);

            // a point inside the other frustum but not the base one
            const point = new Vec3(60, 0, -5);
            expect(base.containsPoint(point)).to.equal(false);
            expect(other.containsPoint(point)).to.equal(true);

            base.add(other);
            expect(base.containsPoint(point)).to.equal(true);
        });

        it('keeps everything that was inside either frustum', function () {
            const base = createFrustum(0);
            const other = createFrustum(60);
            const combined = base.clone().add(other);

            let seed = 4321;
            const random = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x7fffffff;
            };

            let tested = 0;
            for (let i = 0; i < 20000; i++) {
                const p = new Vec3((random() * 2 - 1) * 150, (random() * 2 - 1) * 120, -random() * 150);
                if (base.containsPoint(p) || other.containsPoint(p)) {
                    tested++;
                    expect(combined.containsPoint(p), `point ${p.x},${p.y},${p.z}`).to.equal(true);
                }
            }
            expect(tested).to.be.greaterThan(500);
        });

        it('returns the frustum for chaining', function () {
            const frustum = createFrustum();
            expect(frustum.add(createFrustum(10))).to.equal(frustum);
        });
    });
});
