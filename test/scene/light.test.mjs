import { expect } from 'chai';

import { Vec3 } from '../../src/core/math/vec3.js';
import { BoundingBox } from '../../src/core/shape/bounding-box.js';
import { Entity } from '../../src/framework/entity.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

/**
 * @import { Application } from '../../src/framework/application.js'
 */

describe('Light', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#getBoundingBox', function () {

        const range = 10;
        const angle = 30;

        const createSpot = (parentScale, eulers, scale) => {
            const parent = new Entity();
            parent.setLocalPosition(1, 2, 3);
            parent.setLocalScale(parentScale);
            app.root.addChild(parent);

            const entity = new Entity();
            entity.setLocalEulerAngles(eulers);
            entity.setLocalScale(scale);
            entity.addComponent('light', {
                type: 'spot',
                range: range,
                innerConeAngle: angle,
                outerConeAngle: angle
            });
            parent.addChild(entity);
            return entity;
        };

        // points on the cone the spot lights: apex at the light position, axis along the
        // normalized -Y axis of the world transform, range and angle not scaled
        const conePoints = (entity) => {
            const wtm = entity.getWorldTransform();
            const apex = wtm.getTranslation(new Vec3());
            const dir = wtm.getY(new Vec3()).mulScalar(-1).normalize();
            const helper = Math.abs(dir.x) < 0.9 ? Vec3.RIGHT : Vec3.UP;
            const u = new Vec3().cross(dir, helper).normalize();
            const v = new Vec3().cross(dir, u);

            const points = [apex];
            const sin = Math.sin(angle * Math.PI / 180);
            const cos = Math.cos(angle * Math.PI / 180);
            for (let i = 0; i < 16; i++) {
                const phi = 2 * Math.PI * i / 16;
                points.push(new Vec3()
                .add(new Vec3().copy(dir).mulScalar(cos))
                .add(new Vec3().copy(u).mulScalar(sin * Math.cos(phi)))
                .add(new Vec3().copy(v).mulScalar(sin * Math.sin(phi)))
                .mulScalar(range)
                .add(apex));
            }
            points.push(new Vec3().copy(dir).mulScalar(range).add(apex));
            return points;
        };

        const expectBoxContainsCone = (entity) => {
            const box = new BoundingBox();
            entity.light.light.getBoundingBox(box);
            const min = box.getMin();
            const max = box.getMax();
            const eps = 1e-4;
            for (const p of conePoints(entity)) {
                expect(p.x).to.be.within(min.x - eps, max.x + eps);
                expect(p.y).to.be.within(min.y - eps, max.y + eps);
                expect(p.z).to.be.within(min.z - eps, max.z + eps);
            }
            return box;
        };

        it('contains the cone of a rotated spot light', function () {
            expectBoxContainsCone(createSpot(Vec3.ONE, new Vec3(0, 0, 45), Vec3.ONE));
        });

        it('contains the cone of a rotated spot light with a non-uniform scale', function () {
            expectBoxContainsCone(createSpot(Vec3.ONE, new Vec3(0, 0, 45), new Vec3(4, 1, 1)));
        });

        it('contains the cone of a rotated spot light under a non-uniformly scaled parent', function () {
            expectBoxContainsCone(createSpot(new Vec3(1, 1, 0.25), new Vec3(60, 0, 0), Vec3.ONE));
        });

        it('contains the cone of a rotated spot light with a zero X scale', function () {
            expectBoxContainsCone(createSpot(Vec3.ONE, new Vec3(30, 40, 50), new Vec3(0, 1, 1)));
        });

        it('stays finite for a spot light with a zero Y scale', function () {
            const entity = createSpot(Vec3.ONE, new Vec3(30, 40, 50), new Vec3(1, 0, 1));
            const box = new BoundingBox();
            entity.light.light.getBoundingBox(box);
            for (const v of [box.center, box.halfExtents]) {
                expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).to.equal(true);
            }
        });

        it('is not changed by a uniform scale or by the scale of the light itself', function () {
            const reference = expectBoxContainsCone(createSpot(Vec3.ONE, new Vec3(0, 0, 45), Vec3.ONE));
            const uniform = expectBoxContainsCone(createSpot(new Vec3(3, 3, 3), new Vec3(0, 0, 45), Vec3.ONE));
            const own = expectBoxContainsCone(createSpot(Vec3.ONE, new Vec3(0, 0, 45), new Vec3(4, 1, 1)));
            for (const box of [uniform, own]) {
                expect(box.center.distance(reference.center)).to.be.closeTo(0, 1e-5);
                expect(box.halfExtents.distance(reference.halfExtents)).to.be.closeTo(0, 1e-5);
            }
        });

    });

});
