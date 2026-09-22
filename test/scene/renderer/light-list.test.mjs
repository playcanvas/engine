import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import {
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE,
    SHADER_FORWARD, SHADOW_PCF3_32F
} from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { LitMaterialOptionsBuilder } from '../../../src/scene/materials/lit-material-options-builder.js';
import { LitOptionsUtils } from '../../../src/scene/shader-lib/programs/lit-options-utils.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// A light slot is absolute: every light applied at runtime takes its slot whether or not the mask
// being drawn selects it, so light<N>_ denotes the same light for every mask in the pass. The
// shader generator, the shader variant hash and the light dispatch all read the slots from one
// LightList, so they cannot disagree - this covers what that list contains, and that each consumer
// reads it as intended.
describe('LightList', function () {

    describe('update', function () {

        const light = (mask, type = LIGHTTYPE_DIRECTIONAL, key = mask) => ({ enabled: true, mask, _type: type, key });

        it('gives a slot to every light applied at runtime, in a stable order', function () {
            const all = light(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_DIRECTIONAL, 3);
            const dynamic = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 1);
            const lightmapped = light(MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_DIRECTIONAL, 2);

            const list = new LightList();
            list.update([dynamic, lightmapped, all], true);

            // the light reaching everything first, then dynamic-only, then lightmapped-only
            expect(list.slots).to.eql([all, dynamic, lightmapped]);
        });

        it('orders by type first, so directional lights take the first slots', function () {
            const omni = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_OMNI, 10);
            const spot = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_SPOT, 11);
            const dir = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 12);

            const list = new LightList();
            list.update([spot, omni, dir], false);

            expect(list.slots).to.eql([dir, omni, spot]);
        });

        it('gives no slot to a light that only contributes to a lightmap, or a disabled one', function () {
            const bake = light(MASK_BAKE);
            const disabled = { ...light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 5), enabled: false };
            const used = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 6);

            const list = new LightList();
            list.update([bake, disabled, used], true);

            expect(list.slots).to.eql([used]);
        });

        it('gives local lights a slot only when clustered lighting is disabled', function () {
            const dir = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 1);
            const omni = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_OMNI, 2);

            const list = new LightList();
            list.update([dir, omni], true);
            expect(list.slots).to.eql([dir]);

            list.update([dir, omni], false);
            expect(list.slots).to.eql([dir, omni]);
        });

        it('lists the enabled directional lights whatever their mask', function () {
            const bake = light(MASK_BAKE, LIGHTTYPE_DIRECTIONAL, 1);
            const dir = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 2);
            const omni = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_OMNI, 3);
            const disabled = { ...light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 4), enabled: false };

            const list = new LightList();
            list.update([bake, dir, omni, disabled], false);

            // the shadow cull checks castShadows itself; a lightmap-only light stays listed as today
            expect(list.directional).to.have.members([bake, dir]);
        });

        it('keys the same set of lights identically regardless of their order', function () {
            const a = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 100);
            const b = light(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_DIRECTIONAL, 200);

            const first = new LightList();
            first.update([a, b], true);
            const second = new LightList();
            second.update([b, a], true);

            expect(first.key).to.equal(second.key);
            expect(first.hash).to.equal(second.hash);
            expect(first.hash).to.not.equal(0);
        });

        it('keys a different set of lights differently', function () {
            const a = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 100);
            const b = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 200);

            const list = new LightList();
            list.update([a], true);
            const keyA = list.key, hashA = list.hash;

            list.update([a, b], true);
            expect(list.key).to.not.equal(keyA);
            expect(list.hash).to.not.equal(hashA);
        });

        it('ignores a lightmap-only light in the key, as it takes no slot', function () {
            const dir = light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 100);
            const bake = light(MASK_BAKE, LIGHTTYPE_DIRECTIONAL, 200);

            const list = new LightList();
            list.update([dir], true);
            const key = list.key;

            list.update([dir, bake], true);
            expect(list.key).to.equal(key);
        });

        it('reuses its arrays on a rebuild', function () {
            const list = new LightList();
            const slots = list.slots;
            const directional = list.directional;

            list.update([light(MASK_AFFECT_DYNAMIC)], true);
            list.update([light(MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, 7)], true);

            expect(list.slots).to.equal(slots);
            expect(list.directional).to.equal(directional);
        });
    });

    describe('selectLights', function () {

        const light = (mask, key) => ({ enabled: true, mask, _type: LIGHTTYPE_DIRECTIONAL, key });

        it('places the lights a mask selects at their slots, leaving the others as holes', function () {
            const all = light(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED, 3);
            const dynamic = light(MASK_AFFECT_DYNAMIC, 1);
            const lightmapped = light(MASK_AFFECT_LIGHTMAPPED, 2);
            const list = new LightList();
            list.update([all, dynamic, lightmapped], true);
            expect(list.slots).to.eql([all, dynamic, lightmapped]);

            const forDynamic = LitMaterialOptionsBuilder.selectLights(list, MASK_AFFECT_DYNAMIC);
            expect(forDynamic[0]).to.equal(all);
            expect(forDynamic[1]).to.equal(dynamic);
            expect(forDynamic.length).to.equal(2);

            // the same lights seen by a lightmapped mesh instance: slot 0 is still the light that
            // reaches everything, and slot 1 is a hole, because it belongs to a light this mask
            // does not select
            const forLightmapped = LitMaterialOptionsBuilder.selectLights(list, MASK_AFFECT_LIGHTMAPPED);
            expect(forLightmapped[0]).to.equal(all);
            expect(1 in forLightmapped).to.equal(false);
            expect(forLightmapped[2]).to.equal(lightmapped);
        });

        it('selects nothing without a list', function () {
            expect(LitMaterialOptionsBuilder.selectLights(undefined, MASK_AFFECT_DYNAMIC)).to.eql([]);
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
            // the shader and has to be part of the key that caches it.
            const dense = [light(123), light(456)];

            const sparse = [];
            sparse[0] = light(123);
            sparse[2] = light(456);

            expect(keyOf(dense)).to.not.equal(keyOf(sparse));
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

        const world = () => app.scene.layers.getLayerByName('World');

        /**
         * Dispatches the given lights and reports which light slots the renderer wrote a color
         * into, by clearing the slots first and seeing which come back set.
         *
         * @param {LightList} lightList - The lights to dispatch.
         * @returns {Map<number, Float32Array>} The color written, keyed by light slot.
         */
        const dispatchedSlots = (lightList) => {
            const scope = app.graphicsDevice.scope;
            const slots = 6;
            for (let i = 0; i < slots; i++) {
                scope.resolve(`light${i}_color`).setValue(null);
            }

            app.renderer.dispatchLights(lightList, camera.camera);

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
            // creation order - the slot ordering is what makes the slots dense.
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
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        it('rebuilds the layer list lazily, when the lights change', function () {
            const list = world().getLightList(true);
            expect(list.slots).to.eql([affectAll, dynamicOnly, lightmappedOnly]);
            expect(list.directional).to.have.members([affectAll, dynamicOnly, lightmappedOnly, bakeOnly]);

            // unchanged lights: the same list comes back, untouched
            expect(world().getLightList(true)).to.equal(list);
            const hash = list.hash;

            // a key change re-sorts and re-keys it
            dynamicOnly.castShadows = true;
            expect(world().getLightList(true)).to.equal(list);
            expect(list.hash).to.not.equal(hash);
        });

        it('rebuilds the layer list when clustered lighting is toggled', function () {
            const omni = new Entity('omni');
            omni.addComponent('light', { type: 'omni' });
            app.root.addChild(omni);

            expect(world().getLightList(true).slots).to.not.include(omni.light.light);
            expect(world().getLightList(false).slots).to.include(omni.light.light);
        });

        it('dispatches every light once into its slot, whatever the masks being drawn select', function () {
            const written = dispatchedSlots(world().getLightList(true));

            expect([...written.keys()].sort()).to.eql([0, 1, 2]);
            expect(written.get(0)).to.equal(affectAll._colorLinear);
            expect(written.get(1)).to.equal(dynamicOnly._colorLinear);
            expect(written.get(2)).to.equal(lightmappedOnly._colorLinear);
            expect([...written.values()]).to.not.include(bakeOnly._colorLinear);
        });

        it('writes the slot every mask\'s shader reads, holding the light it expects', function () {
            const list = world().getLightList(true);
            const written = dispatchedSlots(list);

            for (const mask of [MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED]) {
                const expected = LitMaterialOptionsBuilder.selectLights(list, mask);
                expected.forEach((light, slot) => {
                    expect(written.get(slot), `slot ${slot} of mask ${mask}`).to.equal(light._colorLinear);
                });
            }
        });

        it('dispatches no light for a pass with nothing to draw', function () {
            // An enabled layer step with an empty visible list is the common case, not an edge one:
            // a layer's opaque and transparent sublayers are both enabled and neither is filtered
            // out when empty.
            const scope = app.graphicsDevice.scope;
            for (let i = 0; i < 4; i++) {
                scope.resolve(`light${i}_color`).setValue(null);
            }

            app.renderer.renderForwardLayer(camera.camera, null, null, false, SHADER_FORWARD, {
                meshInstances: [],
                lightList: world().getLightList(true)
            });

            for (let i = 0; i < 4; i++) {
                expect(scope.resolve(`light${i}_color`).value, `slot ${i}`).to.equal(null);
            }
        });
    });
});
