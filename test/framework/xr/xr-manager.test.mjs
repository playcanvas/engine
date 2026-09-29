import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { XRSPACE_LOCALFLOOR, XRTYPE_VR } from '../../../src/framework/xr/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Stand-in for an XRSession, implementing what XrManager uses to start and end a session.
 */
class FakeXRSession extends EventTarget {
    enabledFeatures = [];

    inputSources = [];

    renderState = {};

    visibilityState = 'visible';

    ended = false;

    /**
     * Resolves once the end event has been fired.
     *
     * @type {Promise<void>|null}
     */
    endEventFired = null;

    /**
     * @param {Function} onShutdown - Called when the session shuts down.
     */
    constructor(onShutdown) {
        super();
        this._onShutdown = onShutdown;
    }

    requestReferenceSpace(type) {
        return Promise.resolve({ type });
    }

    requestAnimationFrame() {
        return 1;
    }

    cancelAnimationFrame() {
    }

    updateRenderState(state) {
        Object.assign(this.renderState, state);
    }

    end() {
        if (this.ended) {
            return Promise.reject(new DOMException('The session has already ended.', 'InvalidStateError'));
        }

        // like the browser, shut the session down at once and fire the end event later
        this.ended = true;
        this._onShutdown(this);
        this.endEventFired = new Promise((resolve) => {
            setTimeout(() => {
                this.dispatchEvent(new Event('end'));
                resolve();
            });
        });
        return this.endEventFired;
    }
}

/**
 * Stand-in for navigator.xr. Like the browser, it grants sessions asynchronously and rejects a
 * request for an immersive session while another one is pending or active.
 */
class FakeXRSystem extends EventTarget {
    /**
     * The number of sessions requested.
     *
     * @type {number}
     */
    requestCount = 0;

    /**
     * The sessions granted, in order.
     *
     * @type {FakeXRSession[]}
     */
    sessions = [];

    /**
     * When set, the next session request is rejected with this error.
     *
     * @type {Error|null}
     */
    nextRequestError = null;

    _pending = false;

    _active = null;

    isSessionSupported() {
        return Promise.resolve(true);
    }

    requestSession() {
        this.requestCount++;

        if (this._pending || this._active) {
            return Promise.reject(new DOMException('An immersive session is already pending or active.', 'InvalidStateError'));
        }

        this._pending = true;

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this._pending = false;

                const error = this.nextRequestError;
                if (error) {
                    this.nextRequestError = null;
                    reject(error);
                    return;
                }

                const session = new FakeXRSession((ended) => {
                    if (this._active === ended) {
                        this._active = null;
                    }
                });
                this._active = session;
                this.sessions.push(session);
                resolve(session);
            });
        });
    }
}

describe('XrManager', function () {

    let app;
    let camera;
    let xr;
    let attachPresentation;

    /**
     * Starts an immersive VR session on the test camera.
     *
     * @returns {Promise<Error|null>} Resolves with the error passed to the start callback.
     */
    const startVr = () => new Promise((resolve) => {
        app.xr.start(camera.camera, XRTYPE_VR, XRSPACE_LOCALFLOOR, {
            callback: resolve
        });
    });

    /**
     * Records the start, end and error events fired by the XR manager.
     *
     * @returns {{ start: number, end: number, errors: Error[] }} The recorded events.
     */
    const recordEvents = () => {
        const events = { start: 0, end: 0, errors: [] };
        app.xr.on('start', () => events.start++);
        app.xr.on('end', () => events.end++);
        app.xr.on('error', err => events.errors.push(err));
        return events;
    };

    beforeEach(function () {
        jsdomSetup();

        xr = new FakeXRSystem();
        Object.defineProperty(navigator, 'xr', { value: xr, configurable: true });

        app = createApp();

        // availability is only probed in a browser
        app.xr._available[XRTYPE_VR] = true;

        // the null graphics device has no XR presentation backend, so provide one that presents
        // nothing
        attachPresentation = () => {};
        app.graphicsDevice.createXrBridgeImpl = () => ({
            attachPresentation: (session, options) => attachPresentation(session, options),
            releasePresentation: () => {},
            endFrame: () => {},
            destroy: () => {}
        });

        camera = new Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);
    });

    afterEach(async function () {
        // end any session a test left running, so its end event fires before teardown
        if (app.xr.active) {
            app.xr.end();
        }
        await Promise.all(xr.sessions.map(session => session.endEventFired));

        app.destroy();
        app = null;
        delete navigator.xr;
        jsdomTeardown();
    });

    describe('#start', function () {

        it('starts and ends a session', async function () {
            const events = recordEvents();

            expect(await startVr()).to.be.null;
            expect(events.start).to.equal(1);
            expect(app.xr.active).to.be.true;
            expect(app.xr.type).to.equal(XRTYPE_VR);
            expect(app.xr.camera).to.equal(camera);
            expect(camera.camera.camera.xrViews).to.equal(app.xr.views.list);

            await new Promise((resolve) => {
                app.xr.end(resolve);
            });
            expect(events.end).to.equal(1);
            expect(events.errors).to.be.empty;
            expect(app.xr.active).to.be.false;
            expect(app.xr.type).to.be.null;
            expect(app.xr.camera).to.be.null;
            expect(camera.camera.camera.xrViews).to.be.null;
        });

        it('rejects a second start while the first is pending, and still starts the first', async function () {
            const events = recordEvents();

            // for example, a double-click on an Enter VR button
            const [firstError, secondError] = await Promise.all([startVr(), startVr()]);

            expect(firstError).to.be.null;
            expect(secondError).to.be.an('error');
            expect(secondError.message).to.equal('XR session is already starting');
            expect(xr.requestCount).to.equal(1);
            expect(events.start).to.equal(1);
            expect(events.errors).to.be.empty;
            expect(app.xr.active).to.be.true;
            expect(app.xr.type).to.equal(XRTYPE_VR);
            expect(app.xr.camera).to.equal(camera);
            expect(camera.camera.camera.xrViews).to.equal(app.xr.views.list);
        });

        it('rejects a start while a session is active', async function () {
            expect(await startVr()).to.be.null;

            const err = await startVr();
            expect(err).to.be.an('error');
            expect(err.message).to.equal('XR session is already started');
            expect(xr.requestCount).to.equal(1);
            expect(app.xr.active).to.be.true;
        });

        it('can start again after the session request is rejected', async function () {
            const events = recordEvents();
            const requestError = new DOMException('The session mode is not supported.', 'NotSupportedError');
            xr.nextRequestError = requestError;

            expect(await startVr()).to.equal(requestError);
            expect(events.errors).to.deep.equal([requestError]);
            expect(app.xr.active).to.be.false;
            expect(app.xr.type).to.be.null;
            expect(app.xr.camera).to.be.null;

            expect(await startVr()).to.be.null;
            expect(app.xr.active).to.be.true;
        });

        it('can start again after preparing the tracked images fails', async function () {
            // image tracking is only supported in browsers that implement it
            app.xr.imageTracking._supported = true;
            const trackedImage = app.xr.imageTracking.add({}, 0.2);

            const events = recordEvents();
            const prepareError = new Error('The image could not be decoded.');
            trackedImage.prepare = () => Promise.reject(prepareError);

            expect(await startVr()).to.equal(prepareError);
            expect(events.errors).to.deep.equal([prepareError]);
            expect(xr.requestCount).to.equal(0);
            expect(app.xr.type).to.be.null;
            expect(app.xr.camera).to.be.null;

            trackedImage.prepare = () => Promise.resolve({ image: {}, widthInMeters: 0.2 });

            expect(await startVr()).to.be.null;
            expect(app.xr.active).to.be.true;
        });

        it('ends the session and restores the camera when presentation setup fails', async function () {
            const events = recordEvents();
            const setupError = new Error('The XR layer could not be created.');
            attachPresentation = () => {
                throw setupError;
            };

            expect(await startVr()).to.equal(setupError);
            expect(events.errors).to.deep.equal([setupError]);

            // the session is ended rather than left running without a layer to present to
            const session = xr.sessions[0];
            expect(session.ended).to.be.true;
            expect(app.xr.active).to.be.false;
            expect(app.xr.type).to.be.null;
            expect(app.xr.camera).to.be.null;
            expect(camera.camera.camera.xrViews).to.be.null;

            // the session never started, so its end is not reported
            await session.endEventFired;
            expect(events.start).to.equal(0);
            expect(events.end).to.equal(0);

            attachPresentation = () => {};
            expect(await startVr()).to.be.null;
            expect(app.xr.active).to.be.true;
        });

    });

});
