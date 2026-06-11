import { readFileSync } from 'fs';

import { expect } from 'chai';

import { RingBuffer } from '../../../src/extras/runtime-tools/ring-buffer.js';
import { buildSnapshot } from '../../../src/extras/runtime-tools/snapshot.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('runtime-tools snapshot', function () {

    let app;
    let entry;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        entry = { app, id: 'test-app', started: false, destroyed: false, timeMs: 1500, errors: new RingBuffer(100) };
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('returns protocol v1 envelope with engine info', function () {
        const snap = buildSnapshot(entry);
        expect(snap.version).to.equal(1);
        expect(snap.engine.version).to.be.a('string');
        expect(snap.engine.revision).to.be.a('string');
        // tests run unprocessed source: both #if blocks execute, debug wins
        expect(snap.engine.buildVariant).to.equal('debug');
    });

    it('reports app identity and timing', function () {
        const snap = buildSnapshot(entry);
        expect(snap.app.id).to.equal('test-app');
        expect(snap.app.frame).to.equal(0);
        expect(snap.app.time).to.equal(1.5);
        expect(snap.app.running).to.be.false;
        expect(snap.app.device.type).to.equal('null');
        expect(snap.app.canvas.width).to.be.a('number');
    });

    it('reports scene structure from public API', function () {
        const snap = buildSnapshot(entry);
        expect(snap.scene.entities).to.be.at.least(1); // root
        expect(snap.scene.cameras).to.deep.equal([]);
        expect(snap.scene.lights).to.equal(0);
        expect(snap.scene.layers.length).to.be.greaterThan(0);
        expect(snap.scene.layers[0]).to.have.all.keys('id', 'name', 'enabled');
    });

    it('reports asset counts and failures from the entry buffer', function () {
        entry.errors.push({ kind: 'asset', message: 'Error: 404', assetId: 7, name: 'a.png', url: 'a.png', frame: 0 });
        const snap = buildSnapshot(entry);
        expect(snap.assets.counts.total).to.equal(0);
        expect(snap.assets.counts.failed).to.equal(1);
        expect(snap.assets.failures).to.have.length(1);
        expect(snap.assets.failures[0].url).to.equal('a.png');
    });

    it('reports render and perf stats with profiler fields populated', function () {
        const snap = buildSnapshot(entry);
        expect(snap.render.drawCalls).to.be.a('number');
        // source-run resolves as debug build, so profiler-gated fields are numbers
        expect(snap.render.triangles).to.be.a('number');
        expect(snap.perf.cpuMs).to.be.a('number');
        expect(snap.perf.fps).to.be.a('number');
        // NullGraphicsDevice has no gpuProfiler timings
        expect(snap.perf.gpuMs).to.equal(null);
    });

    it('is JSON-serializable and round-trips losslessly', function () {
        const snap = buildSnapshot(entry);
        expect(JSON.parse(JSON.stringify(snap))).to.deep.equal(snap);
    });

    it('matches the checked-in protocol v1 schema top-level shape', function () {
        const schemaUrl = new URL(
            '../../../src/extras/runtime-tools/protocol-v1.schema.json', import.meta.url);
        const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
        const snap = buildSnapshot(entry);
        expect(Object.keys(snap).sort()).to.deep.equal(Object.keys(schema.properties).sort());
        schema.required.forEach((key) => {
            expect(snap).to.have.property(key);
        });
    });
});
