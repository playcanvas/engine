import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingSphere } from '../../../src/core/shape/bounding-sphere.js';
import { Ray } from '../../../src/core/shape/ray.js';

describe('BoundingSphere', function () {

    describe('#constructor', function () {

        it('copies the center instead of keeping a reference', function () {
            const center = new Vec3(1, 2, 3);
            const sphere = new BoundingSphere(center, 1);
            center.set(4, 5, 6);
            expect(sphere.center).to.not.equal(center);
            expect(sphere.center.equals(new Vec3(1, 2, 3))).to.equal(true);
        });

        it('defaults to the origin', function () {
            const sphere = new BoundingSphere();
            expect(sphere.center.equals(Vec3.ZERO)).to.equal(true);
            expect(sphere.radius).to.equal(0.5);
        });
    });

    describe('#intersectsRay', function () {

        it('returns the entry point for a ray starting outside the sphere', function () {
            const sphere = new BoundingSphere(new Vec3(0, 0, 0), 1);
            const ray = new Ray(new Vec3(-3, 0, 0), new Vec3(1, 0, 0));
            const point = new Vec3();
            expect(sphere.intersectsRay(ray)).to.equal(true);
            expect(sphere.intersectsRay(ray, point)).to.equal(true);
            expect(point.x).to.equal(-1);
            expect(point.y).to.equal(0);
            expect(point.z).to.equal(0);
        });

        it('returns the exit point for a ray starting inside the sphere', function () {
            const sphere = new BoundingSphere(new Vec3(0, 0, 0), 1);
            const ray = new Ray(new Vec3(0.5, 0, 0), new Vec3(1, 0, 0));
            const point = new Vec3();
            expect(sphere.intersectsRay(ray)).to.equal(true);
            expect(sphere.intersectsRay(ray, point)).to.equal(true);
            expect(point.x).to.equal(1);
            expect(point.y).to.equal(0);
            expect(point.z).to.equal(0);
        });

        it('returns false for a sphere behind the ray', function () {
            const sphere = new BoundingSphere(new Vec3(0, 0, 0), 1);
            const ray = new Ray(new Vec3(3, 0, 0), new Vec3(1, 0, 0));
            expect(sphere.intersectsRay(ray)).to.equal(false);
            expect(sphere.intersectsRay(ray, new Vec3())).to.equal(false);
        });

    });

});
