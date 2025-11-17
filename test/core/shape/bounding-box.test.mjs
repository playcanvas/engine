import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';

describe('BoundingBox', function () {

    describe('#containsPoint', function () {

        it('returns true for point at center', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 0, 0);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point inside box', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(2, 2, 2));
            const point = new Vec3(0.5, 0.5, 0.5);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point at min corner', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(-1, -1, -1);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point at max corner', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(1, 1, 1);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on min X face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(-1, 0, 0);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on max X face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(1, 0, 0);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on min Y face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, -1, 0);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on max Y face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 1, 0);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on min Z face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 0, -1);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns true for point on max Z face', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 0, 1);
            expect(box.containsPoint(point)).to.equal(true);
        });

        it('returns false for point outside on negative X', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(-1.1, 0, 0);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('returns false for point outside on positive X', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(1.1, 0, 0);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('returns false for point outside on negative Y', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, -1.1, 0);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('returns false for point outside on positive Y', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 1.1, 0);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('returns false for point outside on negative Z', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 0, -1.1);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('returns false for point outside on positive Z', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
            const point = new Vec3(0, 0, 1.1);
            expect(box.containsPoint(point)).to.equal(false);
        });

        it('works with non-centered box', function () {
            const box = new BoundingBox(new Vec3(5, 10, 15), new Vec3(2, 3, 4));
            expect(box.containsPoint(new Vec3(5, 10, 15))).to.equal(true); // center
            expect(box.containsPoint(new Vec3(3, 7, 11))).to.equal(true); // min corner
            expect(box.containsPoint(new Vec3(7, 13, 19))).to.equal(true); // max corner
            expect(box.containsPoint(new Vec3(2.9, 10, 15))).to.equal(false); // outside
            expect(box.containsPoint(new Vec3(7.1, 10, 15))).to.equal(false); // outside
        });

        it('works with asymmetric box', function () {
            const box = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 5, 10));
            expect(box.containsPoint(new Vec3(0, 0, 0))).to.equal(true);
            expect(box.containsPoint(new Vec3(1, 5, 10))).to.equal(true);
            expect(box.containsPoint(new Vec3(-1, -5, -10))).to.equal(true);
            expect(box.containsPoint(new Vec3(1.1, 0, 0))).to.equal(false);
            expect(box.containsPoint(new Vec3(0, 5.1, 0))).to.equal(false);
            expect(box.containsPoint(new Vec3(0, 0, 10.1))).to.equal(false);
        });

    });

});

