import { expect } from 'chai';
import { replace, restore } from 'sinon';

import { EventHandler } from '../../../src/core/event-handler.js';
import { platform } from '../../../src/core/platform.js';
import { XrHitTest } from '../../../src/framework/xr/xr-hit-test.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Creates a stand-in for an XRSession of a browser that supports hit testing, but does not list
 * the features enabled for the session.
 *
 * @returns {object} The session.
 */
const createSession = () => ({
    requestReferenceSpace: type => Promise.resolve({ type }),
    requestHitTestSource: () => Promise.resolve({ cancel: () => {} })
});

describe('XrHitTest', function () {

    beforeEach(function () {
        jsdomSetup();

        // hit testing is only supported in a browser that implements it
        replace(platform, 'browser', true);
        window.XRSession = class {
            requestHitTestSource() {}
        };
    });

    afterEach(function () {
        restore();
        jsdomTeardown();
    });

    describe('#available', function () {

        it('is checked in every session when the browser does not list the enabled features', async function () {
            const manager = new EventHandler();
            manager.active = true;
            const hitTest = new XrHitTest(manager);

            /**
             * Starts and ends a session, in which hit testing must become available.
             *
             * @returns {Promise<void>} Resolves once the session has ended.
             */
            const runSession = async () => {
                manager.session = createSession();
                manager.fire('start');

                // the check requests a hit test source
                await new Promise((resolve) => {
                    setTimeout(resolve);
                });
                expect(hitTest.available).to.be.true;

                manager.fire('end');
                expect(hitTest.available).to.be.false;
            };

            await runSession();
            await runSession();
        });

    });

});
