import { expect } from 'chai';

import {
    ESM_TARGETS, UMD_TARGETS,
    createAppFrom, loadEsm, loadUmdGlobal, setupDom, teardownDom
} from './helpers.mjs';

// the built bundle can actually boot an application with the null graphics device
describe('build / smoke', function () {
    this.timeout(30000);

    const assertApp = (pc, app) => {
        expect(app.root, 'root entity').to.be.instanceOf(pc.Entity);
        expect(app.scene, 'scene').to.be.instanceOf(pc.Scene);
        expect(app.assets, 'asset registry').to.be.instanceOf(pc.AssetRegistry);
    };

    describe('umd global', function () {
        UMD_TARGETS.forEach((t) => {
            it(t.name, function () {
                const { pc, dom } = loadUmdGlobal(t.path);
                const app = createAppFrom(pc, dom.window.document);
                assertApp(pc, app);
                app.destroy();
                dom.window.close();
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
                assertApp(pc, app);
                app.destroy();
            });
        });
    });
});
