import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { LayerComposition } from '../../../src/scene/composition/layer-composition.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Components that subscribe to the LayerComposition 'add' / 'remove' events in their onEnable, and
 * re-subscribe to the new composition in their onLayersChanged handler. The re-subscription has to
 * be tracked, otherwise onDisable is left holding event handles for the previous composition and
 * can no longer unsubscribe.
 *
 * Note the particlesystem component follows the same pattern, but its onEnable early-outs on the
 * null graphics device (disableParticleSystem), so it cannot be covered here.
 */
const LAYER_SUBSCRIBERS = ['render', 'model', 'gsplat', 'sprite', 'element', 'camera', 'light'];

describe('Component layer composition changes', function () {
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

    LAYER_SUBSCRIBERS.forEach((type) => {
        describe(`${type} component`, function () {

            it('unsubscribes from the new composition when disabled', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);

                const oldComposition = app.scene.layers;
                const newComposition = new LayerComposition();
                app.scene.layers = newComposition;

                // the old composition is no longer of interest, the new one is
                expect(oldComposition.hasEvent('add')).to.equal(false);
                expect(oldComposition.hasEvent('remove')).to.equal(false);
                expect(newComposition.hasEvent('add')).to.equal(true);
                expect(newComposition.hasEvent('remove')).to.equal(true);

                e[type].enabled = false;

                expect(newComposition.hasEvent('add')).to.equal(false);
                expect(newComposition.hasEvent('remove')).to.equal(false);
            });

            it('unsubscribes from the new composition when the entity is destroyed', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);

                const newComposition = new LayerComposition();
                app.scene.layers = newComposition;

                e.destroy();

                expect(newComposition.hasEvent('add')).to.equal(false);
                expect(newComposition.hasEvent('remove')).to.equal(false);
            });

            it('unsubscribes from the latest composition after repeated reassignment', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);

                const compositions = [new LayerComposition(), new LayerComposition(), new LayerComposition()];
                compositions.forEach((composition) => {
                    app.scene.layers = composition;
                });

                e[type].enabled = false;

                compositions.forEach((composition) => {
                    expect(composition.hasEvent('add')).to.equal(false);
                    expect(composition.hasEvent('remove')).to.equal(false);
                });
            });

        });
    });
});
