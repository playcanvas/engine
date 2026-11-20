import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ScreenComponent', function () {
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

    describe('#syncDrawOrder', function () {

        it('orders a particle system among the elements of a screen with a non-zero priority', function () {
            const screen = new Entity('screen');
            screen.addComponent('screen', { priority: 5 });

            const panel = new Entity('panel');
            panel.addComponent('element');

            const particles = new Entity('particles');
            particles.addComponent('particlesystem');

            panel.addChild(particles);
            screen.addChild(panel);
            app.root.addChild(screen);

            // update forces draw order sync
            app.tick();

            // the particle system comes after the panel in the hierarchy, so it is drawn above it
            expect(particles.particlesystem.drawOrder).to.be.greaterThan(panel.element.drawOrder);

            // both carry the screen priority in the top 8 bits of their draw order
            expect(panel.element.drawOrder >>> 24).to.equal(5);
            expect(particles.particlesystem.drawOrder >>> 24).to.equal(5);
        });
    });
});
