import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { LayerComposition } from '../../../src/scene/composition/layer-composition.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Components that subscribe to Scene / LayerComposition events in their onEnable. Removing a
 * component does not disable it first (ComponentSystem#removeComponent only fires 'beforeremove'),
 * so each of these has to unsubscribe in onBeforeRemove as well - otherwise the app-lifetime Scene
 * and LayerComposition keep the removed component, and through it the entity, alive forever.
 *
 * Note the particlesystem component follows the same pattern, but its onEnable early-outs on the
 * null graphics device (disableParticleSystem), so it cannot be covered here.
 */
const LAYER_SUBSCRIBERS = ['render', 'model', 'gsplat', 'sprite', 'element', 'camera', 'light'];

describe('Component teardown', function () {
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

    /**
     * @returns {boolean} True if anything is subscribed to the scene / layer composition events
     * that these components bind in onEnable.
     */
    const hasLayerSubscriptions = () => {
        return app.scene.hasEvent('set:layers') ||
            app.scene.layers.hasEvent('add') ||
            app.scene.layers.hasEvent('remove');
    };

    LAYER_SUBSCRIBERS.forEach((type) => {
        describe(`${type} component`, function () {

            it('unsubscribes from scene and layer events when removed while enabled', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);

                // sanity check - the component did subscribe, so the test below is meaningful
                expect(hasLayerSubscriptions()).to.equal(true);

                e.removeComponent(type);

                expect(hasLayerSubscriptions()).to.equal(false);
            });

            it('unsubscribes from scene and layer events when removed while disabled', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);
                e[type].enabled = false;

                expect(hasLayerSubscriptions()).to.equal(false);

                // must be a no-op rather than a second teardown
                expect(() => e.removeComponent(type)).to.not.throw();

                expect(hasLayerSubscriptions()).to.equal(false);
            });

            it('unsubscribes from scene and layer events when the entity is destroyed', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);

                e.destroy();

                expect(hasLayerSubscriptions()).to.equal(false);
            });

            it('does not re-subscribe to a new layer composition after removal', function () {
                const e = new Entity();
                app.root.addChild(e);
                e.addComponent(type);
                e.removeComponent(type);

                // a leaked 'set:layers' handler would run onLayersChanged on the removed
                // component, subscribing it to every composition assigned from then on
                const composition = new LayerComposition();
                app.scene.layers = composition;

                expect(composition.hasEvent('add')).to.equal(false);
                expect(composition.hasEvent('remove')).to.equal(false);
            });

        });
    });
});
