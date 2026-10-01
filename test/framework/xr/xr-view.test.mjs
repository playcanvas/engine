import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { XrView } from '../../../src/framework/xr/xr-view.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('XrView', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#destroy', function () {

        it('stops listening for the loss of the graphics device', function () {
            const onDeviceLost = spy(XrView.prototype, '_onDeviceLost');

            // a view with a camera image texture listens for the loss of the graphics device
            const manager = {
                app,
                views: {
                    supportedColor: true,
                    availableColor: true,
                    supportedDepth: false
                }
            };
            const view = new XrView(manager, { eye: 'none', camera: { width: 4, height: 4 } }, 1);

            app.graphicsDevice.fire('devicelost');
            expect(onDeviceLost.callCount).to.equal(1);

            view.destroy();
            app.graphicsDevice.fire('devicelost');
            expect(onDeviceLost.callCount).to.equal(1);
        });

    });

});
