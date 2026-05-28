import { expect } from 'chai';

import { Color } from '../../../../src/core/math/color.js';
import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Entity } from '../../../../src/framework/entity.js';
import {
    BLUR_BOX,
    LAYERID_UI,
    LAYERID_WORLD,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    LIGHTTYPE_DIRECTIONAL,
    LIGHTTYPE_OMNI,
    LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC,
    MASK_AFFECT_LIGHTMAPPED,
    MASK_BAKE,
    SHADOW_PCF5_32F,
    SHADOWUPDATE_THISFRAME
} from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('LightComponent', function () {
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
            e.addComponent('light');

            expect(e.light).to.exist;
            expect(e.light.enabled).to.equal(true);
            expect(e.light.type).to.equal('directional');
            expect(e.light.intensity).to.equal(1);
            expect(e.light.color.r).to.equal(1);
            expect(e.light.color.g).to.equal(1);
            expect(e.light.color.b).to.equal(1);
            expect(e.light.layers).to.deep.equal([LAYERID_WORLD]);
            expect(e.light.affectDynamic).to.equal(true);
            expect(e.light.affectLightmapped).to.equal(false);
            expect(e.light.bake).to.equal(false);
        });

        it('round-trips every property passed via the data argument', function () {
            const e = new Entity();
            e.addComponent('light', {
                type: 'spot',
                color: new Color(0.1, 0.2, 0.3),
                intensity: 2,
                luminance: 100,
                shape: LIGHTSHAPE_RECT,
                affectSpecularity: false,
                castShadows: true,
                shadowDistance: 50,
                shadowIntensity: 0.5,
                shadowResolution: 512,
                shadowBias: 0.1,
                numCascades: 3,
                cascadeBlend: 0.25,
                bakeNumSamples: 4,
                bakeArea: 90,
                cascadeDistribution: 0.7,
                normalOffsetBias: 0.2,
                range: 25,
                innerConeAngle: 20,
                outerConeAngle: 30,
                falloffMode: LIGHTFALLOFF_INVERSESQUARED,
                shadowType: SHADOW_PCF5_32F,
                vsmBlurSize: 13,
                vsmBlurMode: BLUR_BOX,
                vsmBias: 0.1,
                cookieIntensity: 0.5,
                cookieFalloff: false,
                cookieChannel: 'rrr',
                cookieAngle: 45,
                cookieScale: new Vec2(2, 3),
                cookieOffset: new Vec2(0.1, 0.2),
                shadowUpdateMode: SHADOWUPDATE_THISFRAME,
                // mask is intentionally omitted - the affectDynamic/affectLightmapped/bake setters
                // mutate the mask after a direct write, so it cannot round-trip alongside them.
                // Mask interactions are covered separately in the 'mask flags' suite below.
                affectDynamic: false,
                affectLightmapped: false,
                bake: true,
                bakeDir: false,
                isStatic: true,
                layers: [LAYERID_UI],
                penumbraSize: 2,
                penumbraFalloff: 1.5,
                shadowSamples: 8,
                shadowBlockerSamples: 4
            });

            const l = e.light;
            expect(l.type).to.equal('spot');
            expect(l.color.r).to.be.closeTo(0.1, 1e-6);
            expect(l.color.g).to.be.closeTo(0.2, 1e-6);
            expect(l.color.b).to.be.closeTo(0.3, 1e-6);
            expect(l.intensity).to.equal(2);
            expect(l.luminance).to.equal(100);
            expect(l.shape).to.equal(LIGHTSHAPE_RECT);
            expect(l.affectSpecularity).to.equal(false);
            expect(l.castShadows).to.equal(true);
            expect(l.shadowDistance).to.equal(50);
            expect(l.shadowIntensity).to.equal(0.5);
            expect(l.shadowResolution).to.equal(512);
            expect(l.shadowBias).to.equal(0.1);
            expect(l.numCascades).to.equal(3);
            expect(l.cascadeBlend).to.equal(0.25);
            expect(l.bakeNumSamples).to.equal(4);
            expect(l.bakeArea).to.equal(90);
            expect(l.cascadeDistribution).to.equal(0.7);
            expect(l.normalOffsetBias).to.equal(0.2);
            expect(l.range).to.equal(25);
            expect(l.innerConeAngle).to.equal(20);
            expect(l.outerConeAngle).to.equal(30);
            expect(l.falloffMode).to.equal(LIGHTFALLOFF_INVERSESQUARED);
            expect(l.shadowType).to.equal(SHADOW_PCF5_32F);
            expect(l.vsmBlurSize).to.equal(13);
            expect(l.vsmBlurMode).to.equal(BLUR_BOX);
            expect(l.vsmBias).to.equal(0.1);
            expect(l.cookieIntensity).to.equal(0.5);
            expect(l.cookieFalloff).to.equal(false);
            expect(l.cookieChannel).to.equal('rrr');
            expect(l.cookieAngle).to.equal(45);
            expect(l.cookieScale.x).to.equal(2);
            expect(l.cookieScale.y).to.equal(3);
            expect(l.cookieOffset.x).to.be.closeTo(0.1, 1e-6);
            expect(l.cookieOffset.y).to.be.closeTo(0.2, 1e-6);
            expect(l.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
            expect(l.affectDynamic).to.equal(false);
            expect(l.affectLightmapped).to.equal(false);
            expect(l.bake).to.equal(true);
            expect(l.bakeDir).to.equal(false);
            expect(l.isStatic).to.equal(true);
            expect(l.layers).to.deep.equal([LAYERID_UI]);
            expect(l.penumbraSize).to.equal(2);
            expect(l.penumbraFalloff).to.equal(1.5);
            expect(l.shadowSamples).to.equal(8);
            expect(l.shadowBlockerSamples).to.equal(4);
        });

        it('accepts color and cookieOffset/cookieScale as plain arrays', function () {
            const e = new Entity();
            e.addComponent('light', {
                color: [0.5, 0.25, 0.125],
                cookieOffset: [0.5, 0.75],
                cookieScale: [2, 4]
            });

            expect(e.light.color.r).to.be.closeTo(0.5, 1e-6);
            expect(e.light.color.g).to.be.closeTo(0.25, 1e-6);
            expect(e.light.color.b).to.be.closeTo(0.125, 1e-6);
            expect(e.light.cookieOffset).to.be.instanceof(Vec2);
            expect(e.light.cookieOffset.x).to.equal(0.5);
            expect(e.light.cookieOffset.y).to.equal(0.75);
            expect(e.light.cookieScale).to.be.instanceof(Vec2);
            expect(e.light.cookieScale.x).to.equal(2);
            expect(e.light.cookieScale.y).to.equal(4);
        });

    });

    describe('#type', function () {

        it('preserves the "point" alias on read-back while mapping to LIGHTTYPE_OMNI internally', function () {
            const e = new Entity();
            e.addComponent('light', { type: 'point' });

            expect(e.light.type).to.equal('point');
            expect(e.light.light.type).to.equal(LIGHTTYPE_OMNI);
        });

        it('maps directional / omni / spot to the matching Light int', function () {
            const e = new Entity();
            e.addComponent('light', { type: 'omni' });
            expect(e.light.type).to.equal('omni');
            expect(e.light.light.type).to.equal(LIGHTTYPE_OMNI);

            e.light.type = 'spot';
            expect(e.light.type).to.equal('spot');
            expect(e.light.light.type).to.equal(LIGHTTYPE_SPOT);

            e.light.type = 'directional';
            expect(e.light.type).to.equal('directional');
            expect(e.light.light.type).to.equal(LIGHTTYPE_DIRECTIONAL);
        });

        it('keeps a layer\'s clustered-light set in sync when switching from spot to directional', function () {
            const e = new Entity();
            e.addComponent('light', { type: 'spot' });
            app.root.addChild(e);

            const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
            expect(worldLayer.clusteredLightsSet.has(e.light.light)).to.equal(true);

            e.light.type = 'directional';

            // the spot light entry must have been removed from the clustered set, since
            // directional lights are not clustered
            expect(worldLayer.clusteredLightsSet.has(e.light.light)).to.equal(false);
        });

    });

    describe('#color', function () {

        it('returns the same Color reference as Light#getColor()', function () {
            const e = new Entity();
            e.addComponent('light');

            expect(e.light.color).to.equal(e.light.light.getColor());
        });

    });

    describe('#affectSpecularity', function () {

        it('round-trips the user-supplied value regardless of light type', function () {
            const e = new Entity();
            // Light#affectSpecularity ignores writes for non-directional types, but the
            // component preserves the user's intent.
            e.addComponent('light', { type: 'spot', affectSpecularity: false });

            expect(e.light.affectSpecularity).to.equal(false);
            expect(e.light.light.affectSpecularity).to.equal(true);
        });

        it('applies to the underlying Light when the type later becomes directional', function () {
            const e = new Entity();
            e.addComponent('light', { type: 'spot', affectSpecularity: false });
            expect(e.light.light.affectSpecularity).to.equal(true);

            e.light.type = 'directional';

            expect(e.light.affectSpecularity).to.equal(false);
            expect(e.light.light.affectSpecularity).to.equal(false);
        });

    });

    describe('#castShadows', function () {

        it('preserves the user-supplied value even when the mask would suppress shadows', function () {
            const e = new Entity();
            e.addComponent('light', { castShadows: true, mask: MASK_BAKE });

            // Light#castShadows is mask-aware (returns false for MASK_BAKE-only lights), but the
            // component returns the value the user actually set so that round-trips and clones
            // preserve intent.
            expect(e.light.castShadows).to.equal(true);
            expect(e.light.light.castShadows).to.equal(false);
        });

    });

    describe('#shadowBias', function () {

        it('returns the user-facing value but applies a negative-scaled value to the underlying Light', function () {
            const e = new Entity();
            e.addComponent('light', { shadowBias: 0.5 });

            expect(e.light.shadowBias).to.equal(0.5);
            expect(e.light.light.shadowBias).to.be.closeTo(-0.005, 1e-9);
        });

    });

    describe('#cookieAngle / #cookieScale', function () {

        it('builds the cookieTransform matrix when either is non-default', function () {
            const e = new Entity();
            e.addComponent('light', {
                type: 'spot',
                cookieAngle: 90,
                cookieScale: new Vec2(2, 4)
            });

            expect(e.light.cookieAngle).to.equal(90);
            expect(e.light.cookieScale.x).to.equal(2);
            expect(e.light.cookieScale.y).to.equal(4);
            expect(e.light.light.cookieTransform).to.not.equal(null);
        });

        it('clears the cookieTransform when both angle and scale are reset', function () {
            const e = new Entity();
            e.addComponent('light', {
                type: 'spot',
                cookieAngle: 45,
                cookieScale: new Vec2(2, 2)
            });
            expect(e.light.light.cookieTransform).to.not.equal(null);

            e.light.cookieScale = null;
            e.light.cookieAngle = 0;

            expect(e.light.light.cookieTransform).to.equal(null);
        });

    });

    describe('mask flags', function () {

        it('toggles MASK_AFFECT_DYNAMIC when affectDynamic changes', function () {
            const e = new Entity();
            e.addComponent('light');

            expect(e.light.light.mask & MASK_AFFECT_DYNAMIC).to.not.equal(0);

            e.light.affectDynamic = false;
            expect(e.light.light.mask & MASK_AFFECT_DYNAMIC).to.equal(0);

            e.light.affectDynamic = true;
            expect(e.light.light.mask & MASK_AFFECT_DYNAMIC).to.not.equal(0);
        });

        it('makes bake and affectLightmapped mutually exclusive on the mask', function () {
            const e = new Entity();
            e.addComponent('light');

            e.light.affectLightmapped = true;
            expect(e.light.light.mask & MASK_AFFECT_LIGHTMAPPED).to.not.equal(0);
            expect(e.light.light.mask & MASK_BAKE).to.equal(0);

            e.light.bake = true;
            expect(e.light.light.mask & MASK_BAKE).to.not.equal(0);
            expect(e.light.light.mask & MASK_AFFECT_LIGHTMAPPED).to.equal(0);

            e.light.bake = false;
            expect(e.light.light.mask & MASK_BAKE).to.equal(0);
            expect(e.light.light.mask & MASK_AFFECT_LIGHTMAPPED).to.not.equal(0);
        });

    });

    describe('#layers', function () {

        it('adds the light to the configured layers when the entity is enabled', function () {
            const e = new Entity();
            e.addComponent('light');
            app.root.addChild(e);

            const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
            const uiLayer = app.scene.layers.getLayerById(LAYERID_UI);

            expect(worldLayer.hasLight(e.light.light)).to.equal(true);
            expect(uiLayer.hasLight(e.light.light)).to.equal(false);

            e.light.layers = [LAYERID_UI];

            expect(worldLayer.hasLight(e.light.light)).to.equal(false);
            expect(uiLayer.hasLight(e.light.light)).to.equal(true);
        });

        it('removes the light from its layers when the component is disabled', function () {
            const e = new Entity();
            e.addComponent('light');
            app.root.addChild(e);

            const worldLayer = app.scene.layers.getLayerById(LAYERID_WORLD);
            expect(worldLayer.hasLight(e.light.light)).to.equal(true);

            e.light.enabled = false;
            expect(worldLayer.hasLight(e.light.light)).to.equal(false);

            e.light.enabled = true;
            expect(worldLayer.hasLight(e.light.light)).to.equal(true);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every property, deep-cloning Color/Vec2 values', function () {
            const e = new Entity();
            e.addComponent('light', {
                type: 'spot',
                color: new Color(1, 0, 0),
                intensity: 2,
                luminance: 100,
                shape: LIGHTSHAPE_RECT,
                affectSpecularity: false,
                castShadows: true,
                shadowDistance: 50,
                shadowIntensity: 0.5,
                shadowResolution: 512,
                shadowBias: 0.1,
                numCascades: 3,
                cascadeBlend: 0.25,
                bakeNumSamples: 4,
                bakeArea: 90,
                cascadeDistribution: 0.7,
                normalOffsetBias: 0.2,
                range: 25,
                innerConeAngle: 20,
                outerConeAngle: 30,
                falloffMode: LIGHTFALLOFF_INVERSESQUARED,
                shadowType: SHADOW_PCF5_32F,
                vsmBlurSize: 13,
                vsmBlurMode: BLUR_BOX,
                vsmBias: 0.1,
                cookieIntensity: 0.5,
                cookieFalloff: false,
                cookieChannel: 'rrr',
                cookieAngle: 45,
                cookieScale: new Vec2(2, 3),
                cookieOffset: new Vec2(0.1, 0.2),
                shadowUpdateMode: SHADOWUPDATE_THISFRAME,
                affectDynamic: false,
                affectLightmapped: false,
                bake: true,
                bakeDir: false,
                isStatic: true,
                layers: [LAYERID_UI],
                penumbraSize: 2,
                penumbraFalloff: 1.5,
                shadowSamples: 8,
                shadowBlockerSamples: 4
            });

            const clone = e.clone();
            const c = clone.light;
            const orig = e.light;

            expect(c.type).to.equal('spot');
            expect(c.color.r).to.equal(1);
            expect(c.color.g).to.equal(0);
            expect(c.color.b).to.equal(0);
            expect(c.intensity).to.equal(2);
            expect(c.luminance).to.equal(100);
            expect(c.shape).to.equal(LIGHTSHAPE_RECT);
            expect(c.affectSpecularity).to.equal(false);
            expect(c.castShadows).to.equal(true);
            expect(c.shadowDistance).to.equal(50);
            expect(c.shadowIntensity).to.equal(0.5);
            expect(c.shadowResolution).to.equal(512);
            expect(c.shadowBias).to.equal(0.1);
            expect(c.numCascades).to.equal(3);
            expect(c.cascadeBlend).to.equal(0.25);
            expect(c.bakeNumSamples).to.equal(4);
            expect(c.bakeArea).to.equal(90);
            expect(c.cascadeDistribution).to.equal(0.7);
            expect(c.normalOffsetBias).to.equal(0.2);
            expect(c.range).to.equal(25);
            expect(c.innerConeAngle).to.equal(20);
            expect(c.outerConeAngle).to.equal(30);
            expect(c.falloffMode).to.equal(LIGHTFALLOFF_INVERSESQUARED);
            expect(c.shadowType).to.equal(SHADOW_PCF5_32F);
            expect(c.vsmBlurSize).to.equal(13);
            expect(c.vsmBlurMode).to.equal(BLUR_BOX);
            expect(c.vsmBias).to.equal(0.1);
            expect(c.cookieIntensity).to.equal(0.5);
            expect(c.cookieFalloff).to.equal(false);
            expect(c.cookieChannel).to.equal('rrr');
            expect(c.cookieAngle).to.equal(45);
            expect(c.cookieScale.x).to.equal(2);
            expect(c.cookieScale.y).to.equal(3);
            expect(c.cookieOffset.x).to.be.closeTo(0.1, 1e-6);
            expect(c.cookieOffset.y).to.be.closeTo(0.2, 1e-6);
            expect(c.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
            expect(c.affectDynamic).to.equal(false);
            expect(c.affectLightmapped).to.equal(false);
            expect(c.bake).to.equal(true);
            expect(c.bakeDir).to.equal(false);
            expect(c.isStatic).to.equal(true);
            expect(c.layers).to.deep.equal([LAYERID_UI]);
            expect(c.penumbraSize).to.equal(2);
            expect(c.penumbraFalloff).to.equal(1.5);
            expect(c.shadowSamples).to.equal(8);
            expect(c.shadowBlockerSamples).to.equal(4);

            // verify reference values were deep-cloned
            expect(c.color).to.not.equal(orig.color);
            expect(c.cookieScale).to.not.equal(orig.cookieScale);
            expect(c.cookieOffset).to.not.equal(orig.cookieOffset);
            expect(c.layers).to.not.equal(orig.layers);
        });

        it('preserves the "point" alias when cloning', function () {
            const e = new Entity();
            e.addComponent('light', { type: 'point' });

            const clone = e.clone();

            expect(clone.light.type).to.equal('point');
            expect(clone.light.light.type).to.equal(LIGHTTYPE_OMNI);
        });

    });

});
