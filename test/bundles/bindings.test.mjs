import { expect } from 'chai';

import {
    ESM_TARGETS, UMD_TARGETS,
    createAppFrom, loadEsm, loadUmdCjs, loadUmdGlobal, setupDom, teardownDom
} from './helpers.mjs';

// guards the #8836 regression: `pc.app` must stay a live binding on the umd namespace, so that
// reading the global `pc.app` reflects the app created later. Object.assign in the umd footer
// froze it to its load-time null; Object.defineProperties (#8837) preserves the getter.
describe('build / live bindings (pc.app)', function () {
    this.timeout(30000);

    describe('umd global', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const { pc, dom } = loadUmdGlobal(t.path);
                expect(Object.getOwnPropertyDescriptor(pc, 'app').get, 'app is a live getter').to.be.a('function');
                expect(pc.app, 'app starts null').to.be.null;
                const app = createAppFrom(pc, dom.window.document);
                expect(pc.app, 'app updates after construct').to.equal(app);
                app.destroy();
                dom.window.close();
            });
        });
    });

    describe('umd commonjs', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const pc = loadUmdCjs(t.path);
                expect(Object.getOwnPropertyDescriptor(pc, 'app').get, 'app is a live getter').to.be.a('function');
                expect(pc.app, 'app starts null').to.be.null;
            });
        });
    });

    describe('esm', function () {
        afterEach(teardownDom);

        ESM_TARGETS.forEach((t) => {
            it(t.name, async function () {
                setupDom();
                const pc = await loadEsm(t.path);
                const app = createAppFrom(pc, global.document);
                expect(pc.app, 'app updates after construct').to.equal(app);
                app.destroy();
            });
        });
    });
});

// guards the #8839 follow-up: #8837 made every umd export getter-only, silently breaking
// consumers that reassign members of the global `pc` (e.g. the editor's classic-script worker
// overriding pc.createScript). exports must stay writable while keeping their live binding.
describe('build / overridable exports (#8839)', function () {
    this.timeout(30000);

    describe('umd global', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const { pc, dom } = loadUmdGlobal(t.path);
                expect(Object.getOwnPropertyDescriptor(pc, 'createScript').set, 'export has a setter').to.be.a('function');
                const stub = function stub() {};
                pc.createScript = stub;
                expect(pc.createScript, 'override takes effect').to.equal(stub);
                // overriding one member must not break another member's live binding
                const app = createAppFrom(pc, dom.window.document);
                expect(pc.app, 'live binding survives override').to.equal(app);
                app.destroy();
                dom.window.close();
            });
        });
    });

    describe('umd commonjs', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const pc = loadUmdCjs(t.path);
                expect(Object.getOwnPropertyDescriptor(pc, 'createScript').set, 'export has a setter').to.be.a('function');
                const stub = function stub() {};
                pc.createScript = stub;
                expect(pc.createScript, 'override takes effect').to.equal(stub);
            });
        });
    });
});

// the spot-checks above prove the two real-world break cases (#8836 `app`, #8839 `createScript`)
// end to end; this generalises the underlying invariant to the whole surface: every umd export
// must be a live (get) and overridable (set) accessor, so a regression hitting any export — not
// just those two — is caught.
describe('build / all umd exports are live + overridable', function () {
    this.timeout(30000);

    UMD_TARGETS.forEach((t) => {
        it(t.name, function () {
            const { pc, dom } = loadUmdGlobal(t.path);
            const broken = Object.keys(pc).filter((k) => {
                const d = Object.getOwnPropertyDescriptor(pc, k);
                return typeof d.get !== 'function' || typeof d.set !== 'function';
            });
            expect(broken, `exports not live+overridable: ${broken.slice(0, 5).join(', ')}`).to.be.empty;
            dom.window.close();
        });
    });
});
