import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { GSplatPlacement } from '../../../../src/scene/gsplat-unified/gsplat-placement.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('GSplatComponent', function () {
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

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('gsplat');

            expect(e.gsplat).to.exist;
            expect(e.gsplat.enabled).to.equal(true);
            expect(e.gsplat.castShadows).to.equal(false);
            expect(e.gsplat.lodRangeMin).to.equal(0);
            expect(e.gsplat.lodRangeMax).to.equal(99);
            expect(e.gsplat.lodFalloff).to.equal(1);
        });

        it('initializes LOD properties from data', function () {
            const e = new Entity();
            e.addComponent('gsplat', {
                castShadows: true,
                lodRangeMin: 2,
                lodRangeMax: 7,
                lodFalloff: 1.5
            });

            expect(e.gsplat.castShadows).to.equal(true);
            expect(e.gsplat.lodRangeMin).to.equal(2);
            expect(e.gsplat.lodRangeMax).to.equal(7);
            expect(e.gsplat.lodFalloff).to.equal(1.5);
        });

        it('clamps lodFalloff to its supported range', function () {
            // a negative falloff would rank far nodes above near ones, and past the cap the
            // bucketing window saturates, so the component pins the value rather than letting the
            // balancer see it
            const e = new Entity();
            e.addComponent('gsplat');

            e.gsplat.lodFalloff = -1;
            expect(e.gsplat.lodFalloff).to.equal(0);

            e.gsplat.lodFalloff = 20;
            expect(e.gsplat.lodFalloff).to.equal(8);
        });

        it('forwards lodFalloff to the placement', function () {
            const e = new Entity();
            e.addComponent('gsplat');

            const placement = new GSplatPlacement(null, e);
            e.gsplat._placement = placement;

            e.gsplat.lodFalloff = 0.5;
            expect(placement.lodFalloff).to.equal(0.5);
        });

    });

    describe('#parameters', function () {

        it('marks the placement dirty on setParameter and deleteParameter', function () {
            const e = new Entity();
            e.addComponent('gsplat');

            const placement = new GSplatPlacement(null, e);
            e.gsplat._placement = placement;

            const v0 = placement.dirtyVersion;
            e.gsplat.setParameter('uTest', 1);
            expect(e.gsplat.getParameter('uTest')).to.equal(1);
            expect(placement.dirtyVersion).to.be.above(v0);

            const v1 = placement.dirtyVersion;
            e.gsplat.deleteParameter('uTest');
            expect(e.gsplat.getParameter('uTest')).to.be.undefined;
            expect(placement.dirtyVersion).to.be.above(v1);
        });

    });

    describe('#cloneComponent', function () {

        it('copies LOD properties to the clone', function () {
            const e = new Entity();
            e.addComponent('gsplat', {
                castShadows: true,
                lodRangeMin: 3,
                lodRangeMax: 6,
                lodFalloff: 0.5
            });

            const clone = e.clone();

            expect(clone.gsplat.castShadows).to.equal(true);
            expect(clone.gsplat.lodRangeMin).to.equal(3);
            expect(clone.gsplat.lodRangeMax).to.equal(6);
            expect(clone.gsplat.lodFalloff).to.equal(0.5);
        });

    });
});
