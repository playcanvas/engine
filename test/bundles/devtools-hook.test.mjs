import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { expect } from 'chai';
import { JSDOM } from 'jsdom';

import {
    ESM_TARGETS, UMD_TARGETS,
    createAppFrom, loadEsm, setupDom, teardownDom
} from './helpers.mjs';

const HOOK = Symbol.for('playcanvas.inspector');

// a devtools hook recording what the engine announces, as an extension defines it before the page
const createHook = () => {
    const calls = [];
    return {
        calls,
        register: (app, info) => calls.push(['register', app, info]),
        unregister: app => calls.push(['unregister', app])
    };
};

// every build announces its apps to the hook, not only the debug build that the unit tests mirror
describe('build / devtools hook', function () {
    this.timeout(30000);

    const assertAnnounced = (pc, app, hook) => {
        expect(hook.calls.map(call => call[0])).to.deep.equal(['register']);
        expect(hook.calls[0][1]).to.equal(app);
        expect(hook.calls[0][2]).to.deep.equal({ version: pc.version, revision: pc.revision, protocol: 1 });
        app.destroy();
        expect(hook.calls.map(call => call[0])).to.deep.equal(['register', 'unregister']);
    };

    describe('umd global', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const dom = new JSDOM('<!doctype html><body></body>', {
                    url: 'http://localhost:3210',
                    runScripts: 'outside-only',
                    pretendToBeVisual: true
                });
                const hook = createHook();
                dom.window[HOOK] = hook;
                vm.runInContext(readFileSync(t.path, 'utf8'), dom.getInternalVMContext(), { filename: t.path });
                const pc = dom.window.pc;
                assertAnnounced(pc, createAppFrom(pc, dom.window.document), hook);
                dom.window.close();
            });
        });
    });

    describe('esm', function () {
        afterEach(function () {
            delete globalThis[HOOK];
            teardownDom();
        });

        ESM_TARGETS.forEach((t) => {
            it(t.name, async function () {
                setupDom();
                const hook = createHook();
                globalThis[HOOK] = hook;
                const pc = await loadEsm(t.path);
                assertAnnounced(pc, createAppFrom(pc, global.document), hook);
            });
        });
    });
});
