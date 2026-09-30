import { expect } from 'chai';

import { revision, version } from '../../src/core/core.js';
import { createApp } from '../app.mjs';
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

    it('announces an app to the hook as it is constructed, and withdraws it on destroy', function () {
        const calls = [];
        globalThis[HOOK] = {
            register: (app, info) => calls.push(['register', app, info]),
            unregister: app => calls.push(['unregister', app])
        };

        const app = createApp();
        expect(calls).to.have.lengthOf(1);
        expect(calls[0][0]).to.equal('register');
        expect(calls[0][1]).to.equal(app);
        expect(calls[0][2]).to.deep.equal({ version, revision, protocol: 1 });

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

    it('runs as usual without a hook, or with a hook that offers neither method', function () {
        expect(globalThis[HOOK]).to.equal(undefined);
        const app = createApp();
        app.destroy();

        globalThis[HOOK] = {};
        const other = createApp();
        other.destroy();
    });
});
