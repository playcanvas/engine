import { Plane } from '../../../src/core/shape/plane.js';
import { Vec3 } from '../../../src/core/math/vec3.js';

import { expect } from 'chai';

describe('Plane', function () {

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const p = new Plane();
            expect(p.normal.x).to.equal(Vec3.UP.x);
            expect(p.normal.y).to.equal(Vec3.UP.y);
            expect(p.normal.z).to.equal(Vec3.UP.z);
            expect(p.distance).to.equal(0);
        });

        it('supports arguments', function () {
            const p = new Plane(Vec3.UP, 5);
            expect(p.normal.x).to.equal(0);
            expect(p.normal.y).to.equal(1);
            expect(p.normal.z).to.equal(0);
            expect(p.distance).to.equal(5);
        });

    });

    describe('#setFromPointNormal', function () {

        const p = new Plane();
        p.setFromPointNormal(new Vec3(1, 2, 3), Vec3.UP);
        expect(p.normal.x).to.equal(0);
        expect(p.normal.y).to.equal(1);
        expect(p.normal.z).to.equal(0);
        expect(p.distance).to.equal(-2);

    });

    describe('#intersectsLine', function () {

        const p = new Plane();
        p.setFromPointNormal(new Vec3(0, 5, 0), Vec3.UP);
        const intersection = new Vec3();
        const intersects = p.intersectsLine(new Vec3(1, 0, 3), new Vec3(1, 6, 3), intersection);
        expect(intersects).to.equal(true);
        expect(intersection.x).to.equal(1);
        expect(intersection.y).to.equal(5);
        expect(intersection.z).to.equal(3);

    });

});
