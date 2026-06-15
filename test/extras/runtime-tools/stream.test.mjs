import { expect } from 'chai';

import { RingBuffer } from '../../../src/extras/runtime-tools/ring-buffer.js';
import { startStream } from '../../../src/extras/runtime-tools/stream.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

class MockWebSocket {
    static instances = [];

    constructor(url) {
        this.url = url;
        this.sent = [];
        this.readyState = 0;
        MockWebSocket.instances.push(this);
    }

    send(data) {
        this.sent.push(JSON.parse(data));
    }

    close() {
        this.readyState = 3;
        this.onclose?.({});
    }

    open() {
        this.readyState = 1;
        this.onopen?.();
    }
}

describe('runtime-tools stream', function () {
    let app, entry;
    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        entry = { app, id: 'app-x', started: true, destroyed: false, errors: new RingBuffer(100) };
        MockWebSocket.instances = [];
    });
    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('opens a socket, sends hello then snapshot on open', function () {
        startStream(app, entry, 'ws://localhost:5570', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0 });
        const ws = MockWebSocket.instances[0];
        expect(ws.url).to.equal('ws://localhost:5570');
        ws.open();
        expect(ws.sent[0]).to.include({ t: 'hello', appId: 'app-x', protocol: 'playcanvas.runtime-tools', version: 1 });
        expect(ws.sent[1].t).to.equal('snapshot');
        expect(ws.sent[1].snapshot.version).to.equal(1);
    });
});
