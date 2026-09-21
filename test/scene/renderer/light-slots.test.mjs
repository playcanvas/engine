import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import {
    LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE,
    SHADER_FORWARD, SHADOW_PCF3_32F
} from '../../../src/scene/constants.js';
import { LitMaterialOptionsBuilder } from '../../../src/scene/materials/lit-material-options-builder.js';
import { LitOptionsUtils } from '../../../src/scene/shader-lib/programs/lit-options-utils.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// A light slot is absolute: every light applied at runtime takes its slot whether or not the mask
// being drawn selects it, so light<N>_ denotes the same light for every mask in the pass. The
// shader side (LitMaterialOptionsBuilder#collectLights) and the renderer
// (ForwardRenderer#dispatchDirectLights) each derive slots independently and must agree - a shader
// built against one numbering and drawn with another samples the wrong light, or one that was
// never set.
describe('light slots', function () {

    describe('collectLights', function () {

        const light = mask => ({ enabled: true, mask: mask });

        it('assigns a slot to every light applied at runtime, selected or not', function () {
            const lights = [
                light(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED),
                light(MASK_AFFECT_DYNAMIC),
                light(MASK_AFFECT_LIGHTMAPPED)
            ];

            const dynamic = [];
            expect(LitMaterialOptionsBuilder.collectLights(lights, dynamic, MASK_AFFECT_DYNAMIC, 0)).to.equal(3);
            expect(dynamic[0]).to.equal(lights[0]);
            expect(dynamic[1]).to.equal(lights[1]);
            expect(dynamic.length).to.equal(2);

            // the same lights seen by a lightmapped mesh instance: slot 0 is still the light that
            // reaches everything, and slot 1 is a hole, because the slot belongs to a light this
            // mask does not select
            const lightmapped = [];
            expect(LitMaterialOptionsBuilder.collectLights(lights, lightmapped, MASK_AFFECT_LIGHTMAPPED, 0)).to.equal(3);
            expect(lightmapped[0]).to.equal(lights[0]);
            expect(lightmapped[1]).to.equal(undefined);
            expect(lightmapped[2]).to.equal(lights[2]);
            expect(1 in lightmapped).to.equal(false);
        });

        it('gives no slot to a light that only contributes to a lightmap', function () {
            const lights = [light(MASK_BAKE), light(MASK_AFFECT_DYNAMIC)];

            const collected = [];
            expect(LitMaterialOptionsBuilder.collectLights(lights, collected, MASK_AFFECT_DYNAMIC, 0)).to.equal(1);
            expect(collected[0]).to.equal(lights[1]);
            expect(collected.length).to.equal(1);
        });

        it('gives no slot to a disabled light', function () {
            const disabled = { enabled: false, mask: MASK_AFFECT_DYNAMIC };
            const lights = [disabled, light(MASK_AFFECT_DYNAMIC)];

            const collected = [];
            expect(LitMaterialOptionsBuilder.collectLights(lights, collected, MASK_AFFECT_DYNAMIC, 0)).to.equal(1);
            expect(collected[0]).to.equal(lights[1]);
        });

        it('continues numbering from the slot base, so each light type follows the last', function () {
            const directional = [light(MASK_AFFECT_DYNAMIC)];
            const omni = [light(MASK_AFFECT_LIGHTMAPPED), light(MASK_AFFECT_DYNAMIC)];

            const collected = [];
            const afterDirectional = LitMaterialOptionsBuilder.collectLights(directional, collected, MASK_AFFECT_DYNAMIC, 0);
            const afterOmni = LitMaterialOptionsBuilder.collectLights(omni, collected, MASK_AFFECT_DYNAMIC, afterDirectional);

            expect(afterDirectional).to.equal(1);
            expect(afterOmni).to.equal(3);
            expect(collected[0]).to.equal(directional[0]);
            expect(collected[1]).to.equal(undefined);   // the omni this mask does not select
            expect(collected[2]).to.equal(omni[1]);
        });
    });

    describe('generateLightsKey', function () {

        const light = key => ({ key: key, _type: LIGHTTYPE_DIRECTIONAL });
        const keyOf = lights => LitOptionsUtils.generateLightsKey({
            lights: lights,
            clusteredLightingEnabled: true
        });

        it('keys the same lights differently when they sit in different slots', function () {
            // The shader emits light<N>_ names per slot, so the slot a light occupies is part of
            // the shader and has to be part of the key that caches it. These two layouts select
            // the same lights - one layer just has an intervening light that this mask does not -
            // and a key that missed the difference would serve one layout the other's shader.
            const dense = [light(123), light(456)];

            const sparse = [];
            sparse[0] = light(123);
            sparse[2] = light(456);

            expect(keyOf(dense)).to.not.equal(keyOf(sparse));
        });

        it('keys a light by the slot it sits in', function () {
            const first = [];
            first[0] = light(123);

            const second = [];
            second[1] = light(123);

            expect(keyOf(first)).to.not.equal(keyOf(second));
        });

        it('keys the same slots identically', function () {
            const lights = [];
            lights[0] = light(123);
            lights[2] = light(456);

            const same = [];
            same[0] = light(123);
            same[2] = light(456);

            expect(keyOf(lights)).to.equal(keyOf(same));
        });
    });

    describe('with a scene of masked lights', function () {
        let app;
        let camera;
        let affectAll, dynamicOnly, lightmappedOnly, bakeOnly;

        const addLight = (name, options) => {
            const entity = new Entity(name);
            entity.addComponent('light', { type: 'directional', ...options });
            entity.setEulerAngles(45, 0, 0);
            app.root.addChild(entity);
            return entity.light.light;
        };

        const dirLights = () => app.scene.layers.getLayerByName('World').splitLights[LIGHTTYPE_DIRECTIONAL];

        /**
         * Dispatches the lights for one mask and reports which light slots the renderer wrote a
         * color into, by clearing the slots first and seeing which come back set.
         *
         * @param {object[]} [lights] - The lights to dispatch, the layer's directional lights by
         * default.
         * @returns {Map<number, Float32Array>} The color written, keyed by light slot.
         */
        const dispatchedSlots = (lights = dirLights()) => {
            const scope = app.graphicsDevice.scope;
            const slots = 6;
            for (let i = 0; i < slots; i++) {
                scope.resolve(`light${i}_color`).setValue(null);
            }

            app.renderer.dispatchDirectLights(lights, camera.camera);

            const written = new Map();
            for (let i = 0; i < slots; i++) {
                const value = scope.resolve(`light${i}_color`).value;
                if (value) written.set(i, value);
            }
            return written;
        };

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            const cameraEntity = new Entity('Camera');
            cameraEntity.addComponent('camera');
            app.root.addChild(cameraEntity);
            camera = cameraEntity.camera;

            // Deliberately created so that neither runtime mask selects a gap-free run of the
            // creation order - the ordering in splitLights is what makes the slots dense.
            dynamicOnly = addLight('dynamic only', {
                affectDynamic: true, affectLightmapped: false, bake: false
            });
            lightmappedOnly = addLight('lightmapped only', {
                affectDynamic: false, affectLightmapped: true, bake: false
            });
            affectAll = addLight('affect all', {
                affectDynamic: true,
                affectLightmapped: true,
                bake: false,
                castShadows: true,
                shadowType: SHADOW_PCF3_32F,
                shadowResolution: 128
            });
            bakeOnly = addLight('bake only', {
                affectDynamic: false, affectLightmapped: false, bake: true
            });

            expect(affectAll.mask).to.equal(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED);
            expect(dynamicOnly.mask).to.equal(MASK_AFFECT_DYNAMIC);
            expect(lightmappedOnly.mask).to.equal(MASK_AFFECT_LIGHTMAPPED);
            expect(bakeOnly.mask).to.equal(MASK_BAKE);
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        it('orders the lights that reach everything first, and the lightmap-only light last', function () {
            expect(dirLights().map(light => light.mask)).to.eql([
                MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED,
                MASK_AFFECT_DYNAMIC,
                MASK_AFFECT_LIGHTMAPPED,
                MASK_BAKE
            ]);
        });

        it('keeps the order a pure function of the set, so slots survive a light changing', function () {
            const before = dirLights().map(light => light.mask);

            // any key change re-sorts the layer's lights
            lightmappedOnly.shadowResolution = 256;

            expect(dirLights().map(light => light.mask)).to.eql(before);
        });

        it('dispatches every light once, whatever the masks being drawn select', function () {
            // The light uniforms are constant for the pass, so the renderer writes every slot and
            // does not care which mask is drawn. Each mask's shader then reads its own subset.
            const written = dispatchedSlots();

            expect([...written.keys()].sort()).to.eql([0, 1, 2]);
            expect(written.get(0)).to.equal(affectAll._colorLinear);
            expect(written.get(1)).to.equal(dynamicOnly._colorLinear);
            expect(written.get(2)).to.equal(lightmappedOnly._colorLinear);
        });

        it('writes the slot every mask\'s shader reads, holding the light it expects', function () {
            const written = dispatchedSlots();

            for (const mask of [MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED]) {
                // what the shader side numbered this mask's lights as
                const expected = [];
                LitMaterialOptionsBuilder.collectLights(dirLights(), expected, mask, 0);

                expected.forEach((light, slot) => {
                    expect(written.get(slot), `slot ${slot} of mask ${mask}`).to.equal(light._colorLinear);
                });
            }
        });

        it('gives the same slot to a light under either mask', function () {
            // the light reaching both kinds of geometry is slot 0 for both, which is the point of
            // an absolute slot - before it, each mask packed its own lights from zero
            const slotOf = (mask) => {
                const collected = [];
                LitMaterialOptionsBuilder.collectLights(dirLights(), collected, mask, 0);
                return collected.indexOf(affectAll);
            };

            expect(slotOf(MASK_AFFECT_DYNAMIC)).to.equal(0);
            expect(slotOf(MASK_AFFECT_LIGHTMAPPED)).to.equal(0);
        });

        it('skips a lightmap-only light without consuming its slot', function () {
            // the layer sorts lightmap-only lights last, but callers that build their own light
            // array do not - the lightmapper and the picker both pass one - so a lightmap-only
            // light can sit ahead of a light that is applied. It must still take no slot.
            const lights = [bakeOnly, affectAll, dynamicOnly];

            const collected = [];
            LitMaterialOptionsBuilder.collectLights(lights, collected, MASK_AFFECT_DYNAMIC, 0);
            expect(collected[0]).to.equal(affectAll);
            expect(collected[1]).to.equal(dynamicOnly);
            expect(collected.length).to.equal(2);

            const written = dispatchedSlots(lights);
            expect([...written.keys()].sort()).to.eql([0, 1]);
            expect(written.get(0)).to.equal(affectAll._colorLinear);
            expect(written.get(1)).to.equal(dynamicOnly._colorLinear);
        });

        it('dispatches no light for a pass with nothing to draw', function () {
            // An enabled layer step with an empty visible list is the common case, not an edge one:
            // a layer's opaque and transparent sublayers are both enabled and neither is filtered
            // out when empty. Dispatching the lights of a pass that draws nothing would repeat
            // every light's transform and shadow lookups for no shader that reads them.
            const scope = app.graphicsDevice.scope;
            for (let i = 0; i < 4; i++) {
                scope.resolve(`light${i}_color`).setValue(null);
            }

            app.renderer.renderForwardInternal(
                camera.camera, { drawCalls: [], isNewMaterial: [], shaderInstances: [] },
                app.scene.layers.getLayerByName('World').splitLights, SHADER_FORWARD, undefined, false
            );

            for (let i = 0; i < 4; i++) {
                expect(scope.resolve(`light${i}_color`).value, `slot ${i}`).to.equal(null);
            }
        });

        it('never dispatches the lightmap-only light', function () {
            const written = dispatchedSlots();

            expect([...written.values()]).to.not.include(bakeOnly._colorLinear);
            expect(written.has(3)).to.equal(false);
        });
    });
});
