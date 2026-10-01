import { expect } from 'chai';

import { revision, version } from '../../src/core/core.js';
import { AppOptions } from '../../src/framework/app-options.js';
import { Application } from '../../src/framework/application.js';
import { createApp } from '../app.mjs';
import { createGraphicsDevice } from '../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

const HOOK = Symbol.for('playcanvas.inspector');

describe('AppBase devtools hook', function () {

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        delete globalThis[HOOK];
        jsdomTeardown();
    });

    it('announces an app to the hook once it is initialized, and withdraws it on destroy', function () {
        const calls = [];
        // what the hook can rely on when it is called
        let ready = null;
        globalThis[HOOK] = {
            register: (app, info) => {
                calls.push(['register', app, info]);
                ready = { device: !!app.graphicsDevice, scene: !!app.scene, root: !!app.root, systems: !!app.systems?.render };
            },
            unregister: app => calls.push(['unregister', app])
        };

        const app = createApp();
        expect(calls).to.have.lengthOf(1);
        expect(calls[0][0]).to.equal('register');
        expect(calls[0][1]).to.equal(app);
        expect(calls[0][2]).to.deep.equal({ version, revision, protocol: 1 });
        expect(ready).to.deep.equal({ device: true, scene: true, root: true, systems: true });

        app.destroy();
        expect(calls.map(call => call[0])).to.deep.equal(['register', 'unregister']);
        expect(calls[1][1]).to.equal(app);
    });

    it('withdraws an app destroyed during its own frame only once it is destroyed', function () {
        const registered = new Set();
        globalThis[HOOK] = {
            register: app => registered.add(app),
            unregister: app => registered.delete(app)
        };

        const app = createApp();
        app.on('update', () => app.destroy());
        app.tick(0);
        // destroyed at the end of the frame, not while it was still running
        expect(registered.has(app)).to.be.false;
        expect(app.root).to.equal(null);
    });

    it('initializes and destroys the app as usual when the hook throws', function () {
        globalThis[HOOK] = {
            register: () => {
                throw new Error('broken extension');
            },
            unregister: () => {
                throw new Error('broken extension');
            }
        };

        const app = createApp();
        expect(app.root).to.not.equal(null);
        expect(app.graphicsDevice).to.exist;

        app.destroy();
        // destroy ran to the end, releasing the root and the device
        expect(app.root).to.equal(null);
        expect(app.graphicsDevice).to.equal(null);
    });

    it('does not announce an app created with devtools off', function () {
        const calls = [];
        globalThis[HOOK] = {
            register: () => calls.push('register'),
            unregister: () => calls.push('unregister')
        };

        const canvas = document.createElement('canvas');
        const app = new Application(canvas, { graphicsDevice: createGraphicsDevice(canvas), devtools: false });
        app.destroy();
        expect(calls).to.deep.equal([]);
        expect(new AppOptions().devtools).to.be.true;
    });

    it('does not withdraw an app the hook never saw', function () {
        const app = createApp();

        // the hook is defined only after the app was created, so it never registered it
        const calls = [];
        globalThis[HOOK] = {
            register: () => calls.push('register'),
            unregister: () => calls.push('unregister')
        };
        app.destroy();
        expect(calls).to.deep.equal([]);
    });

    it('runs as usual without a hook, or with a hook that offers neither method', function () {
        expect(globalThis[HOOK]).to.equal(undefined);
        const app = createApp();
        app.destroy();

        globalThis[HOOK] = {};
        const other = createApp();
        other.destroy();
    });
});
