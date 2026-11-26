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
            expect(e.gsplat.lodBaseDistance).to.equal(5);
            expect(e.gsplat.lodMultiplier).to.equal(3);
        });

        it('initializes LOD properties from data', function () {
            const e = new Entity();
            e.addComponent('gsplat', {
                castShadows: true,
                lodRangeMin: 2,
                lodRangeMax: 7,
                lodBaseDistance: 12,
                lodMultiplier: 2
            });

            expect(e.gsplat.castShadows).to.equal(true);
            expect(e.gsplat.lodRangeMin).to.equal(2);
            expect(e.gsplat.lodRangeMax).to.equal(7);
            expect(e.gsplat.lodBaseDistance).to.equal(12);
            expect(e.gsplat.lodMultiplier).to.equal(2);
        });

        it('clamps the LOD distances to their supported range', function () {
            // a multiplier of 1 or below would collapse every band onto one distance
            const e = new Entity();
            e.addComponent('gsplat');

            e.gsplat.lodBaseDistance = 0;
            expect(e.gsplat.lodBaseDistance).to.equal(0.1);

            e.gsplat.lodMultiplier = 1;
            expect(e.gsplat.lodMultiplier).to.equal(1.2);
        });

        it('forwards the LOD distances to the placement', function () {
            const e = new Entity();
            e.addComponent('gsplat');

            const placement = new GSplatPlacement(null, e);
            e.gsplat._placement = placement;

            e.gsplat.lodBaseDistance = 8;
            e.gsplat.lodMultiplier = 2.5;
            expect(placement.lodBaseDistance).to.equal(8);
            expect(placement.lodMultiplier).to.equal(2.5);
        });

    });

    describe('#hide', function () {

        const createPlacedComponent = () => {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('gsplat');
            e.gsplat._placement = new GSplatPlacement(null, e);
            e.gsplat.addToLayers();
            const layer = app.scene.layers.getLayerById(e.gsplat.layers[0]);
            return { e, layer, placement: e.gsplat._placement };
        };

        it('removes the placement from its layers until shown', function () {
            const { e, layer, placement } = createPlacedComponent();
            e.gsplat.castShadows = true;

            e.gsplat.hide();
            expect(layer.gsplatPlacements).to.not.include(placement);
            expect(layer.gsplatShadowCasters).to.not.include(placement);

            e.gsplat.show();
            expect(layer.gsplatPlacements).to.include(placement);
            expect(layer.gsplatShadowCasters).to.include(placement);
        });

        it('stays hidden when the entity is disabled and enabled again', function () {
            const { e, layer, placement } = createPlacedComponent();

            e.gsplat.hide();
            e.enabled = false;
            e.enabled = true;
            expect(layer.gsplatPlacements).to.not.include(placement);

            e.gsplat.show();
            expect(layer.gsplatPlacements).to.include(placement);
        });

        it('does not cast shadows when castShadows is enabled while hidden', function () {
            const { e, layer, placement } = createPlacedComponent();

            e.gsplat.hide();
            e.gsplat.castShadows = true;
            expect(layer.gsplatShadowCasters).to.not.include(placement);

            e.gsplat.castShadows = false;
            e.gsplat.castShadows = true;
            expect(layer.gsplatShadowCasters).to.not.include(placement);

            e.gsplat.show();
            expect(layer.gsplatPlacements).to.include(placement);
            expect(layer.gsplatShadowCasters).to.include(placement);
        });

        it('does not restore shadows on show when castShadows was disabled while hidden', function () {
            const { e, layer, placement } = createPlacedComponent();
            e.gsplat.castShadows = true;

            e.gsplat.hide();
            e.gsplat.castShadows = false;
            e.gsplat.show();
            expect(layer.gsplatPlacements).to.include(placement);
            expect(layer.gsplatShadowCasters).to.not.include(placement);
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
                lodBaseDistance: 20,
                lodMultiplier: 4
            });

            const clone = e.clone();

            expect(clone.gsplat.castShadows).to.equal(true);
            expect(clone.gsplat.lodRangeMin).to.equal(3);
            expect(clone.gsplat.lodRangeMax).to.equal(6);
            expect(clone.gsplat.lodBaseDistance).to.equal(20);
            expect(clone.gsplat.lodMultiplier).to.equal(4);
        });

    });
});
