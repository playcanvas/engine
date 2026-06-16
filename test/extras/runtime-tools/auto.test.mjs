import { expect } from 'chai';

import '../../../src/extras/runtime-tools/auto.js'; // installs the dev auto-wiring (prototype hooks)
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0;
    }

    send() {}

    close() {
        this.readyState = 3;
        this.onclose?.({});
    }
}

describe('runtime-tools auto-wiring', function () {
    let app;
    beforeEach(function () {
        jsdomSetup();
        globalThis.WebSocket = MockWebSocket;
        globalThis.requestAnimationFrame = () => 0; // jsdom has none; no-op so start() doesn't tick
        globalThis.cancelAnimationFrame = () => {};
        delete globalThis.__PLAYCANVAS_TOOLS__;
        delete globalThis.__PLAYCANVAS_RUNTIME_TOOLS__;
    });
    afterEach(function () {
        app?.destroy();
        app = null;
        delete globalThis.__PLAYCANVAS_TOOLS__;
        delete globalThis.__PLAYCANVAS_RUNTIME_TOOLS__;
        delete globalThis.WebSocket;
        delete globalThis.requestAnimationFrame;
        delete globalThis.cancelAnimationFrame;
        jsdomTeardown();
    });

    it('auto-attaches on app.start() when the dev config global is set', function () {
        globalThis.__PLAYCANVAS_RUNTIME_TOOLS__ = { stream: 'ws://localhost:5570' };
        app = createApp();
        app.start();
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.exist;
        expect(globalThis.__PLAYCANVAS_TOOLS__.apps()).to.have.length(1);
    });

    it('does nothing on app.start() without the dev config global', function () {
        app = createApp();
        app.start();
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.equal(undefined);
    });
});
