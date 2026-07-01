import { expect } from 'chai';

import { attachRuntimeTools } from '../../../src/extras/runtime-tools/runtime-tools.js';
import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('attachRuntimeTools', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        // destroy detaches and removes the global when no apps remain
        app?.destroy();
        app = null;
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.be.undefined;
        expect(globalThis.playcanvasTools).to.be.undefined;
        jsdomTeardown();
    });

    it('creates the global with protocol identity and capabilities', function () {
        attachRuntimeTools(app);
        const tools = globalThis.__PLAYCANVAS_TOOLS__;
        expect(tools.protocol).to.equal('playcanvas.runtime-tools');
        expect(tools.version).to.equal(1);
        expect(tools.capabilities).to.deep.equal(
            ['help', 'apps', 'query', 'diagnostics', 'waitForFrame', 'waitForSettled', 'input']);
        expect(tools.engine).to.have.keys('version', 'revision', 'buildVariant');
    });

    it('exposes a discoverable alias and help examples', function () {
        attachRuntimeTools(app);
        const tools = globalThis.__PLAYCANVAS_TOOLS__;
        const help = tools.help();
        expect(globalThis.playcanvasTools).to.equal(tools);
        expect(help.global).to.equal('window.playcanvasTools');
        expect(help.protocolGlobal).to.equal('window.__PLAYCANVAS_TOOLS__');
        expect(help.examples).to.include('window.playcanvasTools.query(app => app.stats.drawCalls.total)');
    });

    it('lists attached apps with a generated id when canvas has no id', function () {
        attachRuntimeTools(app);
        const apps = globalThis.__PLAYCANVAS_TOOLS__.apps();
        expect(apps).to.have.length(1);
        expect(apps[0].id).to.match(/^pc-app-\d+$/);
        expect(apps[0].frame).to.equal(0);
        expect(apps[0].running).to.be.false;
    });

    it('uses canvas.id as appId when present', function () {
        const canvas = document.createElement('canvas');
        canvas.id = 'my-canvas';
        const second = new Application(canvas, { graphicsDevice: new NullGraphicsDevice(canvas) });
        const detach = attachRuntimeTools(second);
        expect(globalThis.__PLAYCANVAS_TOOLS__.apps()[0].id).to.equal('my-canvas');
        detach();
        second.destroy();
    });

    it('is idempotent when attaching the same app twice', function () {
        const d1 = attachRuntimeTools(app);
        const d2 = attachRuntimeTools(app);
        expect(globalThis.__PLAYCANVAS_TOOLS__.apps()).to.have.length(1);
        d2();
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.be.undefined;
        d1();
    });

    it('query() runs a fn against the single attached app and serializes the result', function () {
        attachRuntimeTools(app);
        const tools = globalThis.__PLAYCANVAS_TOOLS__;
        expect(tools.query(a => a.root.name)).to.equal(app.root.name);
        // a live entity comes back as a bounded summary (name/path/forward/children), not a live ref
        const rootSummary = tools.query(a => a.root);
        expect(rootSummary).to.include.keys('name', 'path', 'children');
        // a throwing fn is contained as { error }, not propagated
        expect(tools.query(() => {
            throw new Error('boom');
        })).to.deep.equal({ error: 'boom' });
    });

    it('query() throws an actionable error when not given a function', function () {
        attachRuntimeTools(app);
        expect(() => globalThis.__PLAYCANVAS_TOOLS__.query('nope')).to.throw(/needs a function/);
    });

    it('records recent real and injected input in diagnostics', function () {
        attachRuntimeTools(app);
        app.graphicsDevice.canvas.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
        globalThis.__PLAYCANVAS_TOOLS__.input({ kind: 'key', action: 'keydown', code: 'KeyD' });
        const recent = globalThis.__PLAYCANVAS_TOOLS__.diagnostics().recentInput;
        expect(recent.map(e => e.source)).to.deep.equal(['real', 'injected']);
        expect(recent.map(e => e.code)).to.deep.equal(['KeyA', 'KeyD']);
    });

    it('throws an actionable error for unknown appId', function () {
        attachRuntimeTools(app);
        expect(() => {
            globalThis.__PLAYCANVAS_TOOLS__.query(a => a, 'nope');
        }).to.throw(/unknown appId 'nope'/);
    });

    it('captures asset registry errors into diagnostics', function () {
        attachRuntimeTools(app);
        const asset = new Asset('missing.png', 'texture', { url: 'missing.png' });
        app.assets.add(asset);
        app.assets.fire('error', 'Error: 404', asset);
        const diag = globalThis.__PLAYCANVAS_TOOLS__.diagnostics();
        expect(diag.errors).to.have.length(1);
        expect(diag.errors[0].kind).to.equal('asset');
        expect(diag.errors[0].message).to.equal('Error: 404');
        expect(diag.missingAssets).to.deep.equal(['missing.png']);
    });

    it('captures asset errors fired without an error argument', function () {
        attachRuntimeTools(app);
        const asset = new Asset('cube.png', 'cubemap', { url: 'cube.png' });
        app.assets.add(asset);
        app.assets.fire('error', asset);
        const diag = globalThis.__PLAYCANVAS_TOOLS__.diagnostics();
        expect(diag.errors).to.have.length(1);
        expect(diag.errors[0].assetId).to.equal(asset.id);
        expect(diag.errors[0].url).to.equal('cube.png');
    });

    it('detach removes the app and deletes the global when none remain', function () {
        const detach = attachRuntimeTools(app);
        detach();
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.be.undefined;
        expect(globalThis.playcanvasTools).to.be.undefined;
    });

    it('dispatches the ready event when a DOM is present', function () {
        // node has no globalThis.dispatchEvent; forward to the jsdom window
        global.CustomEvent = window.CustomEvent;
        global.dispatchEvent = e => window.dispatchEvent(e);
        let detail = null;
        window.addEventListener('playcanvas:tools-ready', (e) => {
            detail = e.detail;
        });
        attachRuntimeTools(app);
        delete global.dispatchEvent;
        delete global.CustomEvent;
        expect(detail).to.deep.equal({ protocol: 'playcanvas.runtime-tools', version: 1 });
    });

    describe('readiness', function () {

        it('waitForFrame resolves on the next frameend', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForFrame();
            app.fire('frameend');
            const result = await p;
            expect(result.frame).to.equal(0);
        });

        it('detach rejects pending waits', async function () {
            const detach = attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForFrame();
            detach();
            await p.then(
                () => expect.fail('expected rejection'),
                err => expect(err.message).to.match(/detached/)
            );
        });

        it('waitForSettled resolves after N settled frames once started', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForSettled(undefined, { frames: 3, timeout: 1000 });
            app.fire('start');
            app.fire('frameend');
            app.fire('frameend');
            app.fire('frameend');
            const result = await p;
            expect(result.settledFrames).to.equal(3);
        });

        it('waitForSettled counts frames as started when attached after app.start', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForSettled(undefined, { frames: 2, timeout: 1000 });
            app.fire('frameupdate', 16);
            app.fire('frameend');
            app.fire('frameend');
            const result = await p;
            expect(result.settledFrames).to.equal(2);
        });

        it('waitForSettled resets the count while assets are loading', async function () {
            attachRuntimeTools(app);
            const asset = new Asset('slow.png', 'texture', { url: 'slow.png' });
            asset.loading = true;
            app.assets.add(asset);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForSettled(undefined, { frames: 2, timeout: 1000 });
            app.fire('start');
            app.fire('frameend'); // loading -> resets
            asset.loading = false;
            app.fire('frameend');
            app.fire('frameend');
            const result = await p;
            expect(result.settledFrames).to.equal(2);
        });

        it('waitForSettled rejects with a diagnosis on timeout', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForSettled(undefined, { frames: 3, timeout: 30 });
            await p.then(
                () => expect.fail('expected rejection'),
                err => expect(err.message).to.match(/timed out after 30ms.*started=false/)
            );
        });

        it('waitForFrame rejects when the app is destroyed', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForFrame();
            app.destroy();
            app = null;
            await p.then(
                () => expect.fail('expected rejection'),
                err => expect(err.message).to.match(/destroyed/)
            );
        });

        it('waitForSettled rejects when the app is destroyed', async function () {
            attachRuntimeTools(app);
            const p = globalThis.__PLAYCANVAS_TOOLS__.waitForSettled(undefined, { frames: 3, timeout: 5000 });
            app.destroy();
            app = null;
            await p.then(
                () => expect.fail('expected rejection'),
                err => expect(err.message).to.match(/destroyed/)
            );
        });
    });
});
