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
    let stops = [];
    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        entry = { app, id: 'app-x', started: true, destroyed: false, errors: new RingBuffer(100) };
        MockWebSocket.instances = [];
        stops = [];
    });
    afterEach(function () {
        stops.forEach(s => s());
        stops = [];
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('opens a socket, sends hello then snapshot on open', function () {
        stops.push(startStream(app, entry, 'ws://localhost:5570', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0 }));
        const ws = MockWebSocket.instances[0];
        expect(ws.url).to.equal('ws://localhost:5570');
        ws.open();
        expect(ws.sent[0]).to.include({ t: 'hello', appId: 'app-x', protocol: 'playcanvas.runtime-tools', version: 1 });
        expect(ws.sent[1].t).to.equal('snapshot');
        expect(ws.sent[1].snapshot.version).to.equal(1);
    });

    it('pushes an asset-error event', function () {
        stops.push(startStream(app, entry, 'ws://x', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0 }));
        const ws = MockWebSocket.instances[0];
        ws.open();
        app.assets.fire('error', 'Error: 404', { id: 7, name: 'a.png', file: { url: 'a.png' } });
        const ev = ws.sent.find(m => m.t === 'event' && m.kind === 'asset-error');
        expect(ev.payload.url).to.equal('a.png');
    });

    it('emits a settled event once after N quiet frames', function () {
        stops.push(startStream(app, entry, 'ws://x', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0, settleFrames: 2 }));
        const ws = MockWebSocket.instances[0];
        ws.open();
        app.fire('frameend');
        app.fire('frameend');
        app.fire('frameend');
        const settled = ws.sent.filter(m => m.t === 'event' && m.kind === 'settled');
        expect(settled).to.have.length(1);
    });

    it('pushes device-lost from the canvas webglcontextlost event', function () {
        stops.push(startStream(app, entry, 'ws://x', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0 }));
        const ws = MockWebSocket.instances[0];
        ws.open();
        app.graphicsDevice.canvas.dispatchEvent(new window.Event('webglcontextlost'));
        expect(ws.sent.some(m => m.t === 'event' && m.kind === 'device-lost')).to.equal(true);
    });

    it('sends a summary on the summary interval', async function () {
        stops.push(startStream(app, entry, 'ws://x', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 10 }));
        const ws = MockWebSocket.instances[0];
        ws.open();
        await new Promise((r) => {
            setTimeout(r, 25);
        });
        const summary = ws.sent.find(m => m.t === 'summary');
        expect(summary).to.have.keys('t', 'fps', 'frameMs', 'drawCalls', 'ts');
    });

    it('logs connecting then connected, and reconnecting on a drop (vite-style)', function () {
        const lines = [];
        stops.push(startStream(app, entry, 'ws://x', { WebSocketImpl: MockWebSocket, frameMs: 0, summaryMs: 0, log: m => lines.push(m) }));
        expect(lines).to.include('connecting...');
        const ws = MockWebSocket.instances[0];
        ws.open();
        expect(lines).to.include('connected.');
        ws.close();
        expect(lines).to.include('connection lost, reconnecting...');
    });
});
