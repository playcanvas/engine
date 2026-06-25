import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
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
            expect(e.gsplat.lodBaseDistance).to.equal(5);
            expect(e.gsplat.lodMultiplier).to.equal(3);
            expect(e.gsplat.lodRangeMin).to.equal(0);
            expect(e.gsplat.lodRangeMax).to.equal(99);
        });

        it('initializes LOD properties from data', function () {
            const e = new Entity();
            e.addComponent('gsplat', {
                castShadows: true,
                lodBaseDistance: 8,
                lodMultiplier: 2,
                lodRangeMin: 2,
                lodRangeMax: 7
            });

            expect(e.gsplat.castShadows).to.equal(true);
            expect(e.gsplat.lodBaseDistance).to.equal(8);
            expect(e.gsplat.lodMultiplier).to.equal(2);
            expect(e.gsplat.lodRangeMin).to.equal(2);
            expect(e.gsplat.lodRangeMax).to.equal(7);
        });

    });

    describe('#properties', function () {

        it('clamps lodBaseDistance to a minimum of 0.1', function () {
            const e = new Entity();
            e.addComponent('gsplat');
            e.gsplat.lodBaseDistance = 0;
            expect(e.gsplat.lodBaseDistance).to.equal(0.1);
        });

        it('clamps lodMultiplier to a minimum of 1.2', function () {
            const e = new Entity();
            e.addComponent('gsplat');
            e.gsplat.lodMultiplier = 1;
            expect(e.gsplat.lodMultiplier).to.equal(1.2);
        });

    });

    describe('#cloneComponent', function () {

        it('copies LOD properties to the clone', function () {
            const e = new Entity();
            e.addComponent('gsplat', {
                castShadows: true,
                lodBaseDistance: 8,
                lodMultiplier: 2,
                lodRangeMin: 3,
                lodRangeMax: 6
            });

            const clone = e.clone();

            expect(clone.gsplat.castShadows).to.equal(true);
            expect(clone.gsplat.lodBaseDistance).to.equal(8);
            expect(clone.gsplat.lodMultiplier).to.equal(2);
            expect(clone.gsplat.lodRangeMin).to.equal(3);
            expect(clone.gsplat.lodRangeMax).to.equal(6);
        });

    });
});
