import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from 'chai';

import { AppBase } from '../../src/framework/app-base.js';
import { AppOptions } from '../../src/framework/app-options.js';
import { ScriptComponentSystem } from '../../src/framework/components/script/system.js';
import { Entity } from '../../src/framework/entity.js';
import { ScriptHandler } from '../../src/framework/handlers/script.js';
import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';

// Runs the engine as a Node.js server would: no jsdom, no canvas and no requestAnimationFrame
describe('Headless Node.js', function () {

    let app;

    const createApp = () => {
        const device = new NullGraphicsDevice();
        const options = new AppOptions();
        options.graphicsDevice = device;
        options.componentSystems = [ScriptComponentSystem];
        options.resourceHandlers = [ScriptHandler];
        app = new AppBase(device.canvas);
        app.init(options);
        return app;
    };

    afterEach(function () {
        app?.destroy();
        app = null;
    });

    it('creates and updates an application without a canvas', function () {
        createApp();
        app.start();
        app.update(1 / 60);
        expect(app.frame).to.equal(1);
    });

    describe('#start', function () {

        let savedRaf;
        let savedCaf;

        beforeEach(function () {
            savedRaf = globalThis.requestAnimationFrame;
            savedCaf = globalThis.cancelAnimationFrame;
            delete globalThis.requestAnimationFrame;
            delete globalThis.cancelAnimationFrame;
        });

        afterEach(function () {
            // destroy before restoring, as destroy cancels any pending frame request
            app?.destroy();
            app = null;
            globalThis.requestAnimationFrame = savedRaf;
            globalThis.cancelAnimationFrame = savedCaf;
            if (savedRaf === undefined) delete globalThis.requestAnimationFrame;
            if (savedCaf === undefined) delete globalThis.cancelAnimationFrame;
        });

        it('schedules no frame without requestAnimationFrame', function () {
            createApp();
            expect(() => app.start()).to.not.throw();
            expect(app.frameRequestId).to.equal(null);
        });

        it('schedules no frame when cancelAnimationFrame is missing', function () {
            const requested = [];
            globalThis.requestAnimationFrame = (callback) => {
                requested.push(callback);
                return requested.length;
            };

            createApp();
            app.start();
            expect(requested).to.deep.equal([]);
            expect(() => app.tick()).to.not.throw();
        });

        it('schedules frames through a global requestAnimationFrame', function () {
            const requested = [];
            globalThis.requestAnimationFrame = (callback) => {
                requested.push(callback);
                return requested.length;
            };
            globalThis.cancelAnimationFrame = () => {};

            createApp();
            app.start();

            expect(requested).to.deep.equal([app.tick]);
        });
    });

    describe('ScriptHandler', function () {

        let cwd;
        let dir;

        beforeEach(function () {
            cwd = process.cwd();
            dir = mkdtempSync(join(tmpdir(), 'pc-headless-'));
        });

        afterEach(function () {
            process.chdir(cwd);
            rmSync(dir, { recursive: true, force: true });
        });

        it('resolves a relative module URL against the working directory', async function () {
            const scriptUrl = new URL('../../src/framework/script/script.js', import.meta.url);
            writeFileSync(join(dir, 'spin.mjs'), `
                import { Script } from '${scriptUrl}';
                export class Spin extends Script {
                    static scriptName = 'spin';
                    update(dt) {
                        this.entity.rotateLocal(0, 90 * dt, 0);
                    }
                }
            `);
            process.chdir(dir);

            createApp();
            await new Promise((resolve, reject) => {
                app.loader.getHandler('script').load('spin.mjs', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const entity = new Entity();
            app.root.addChild(entity);
            entity.addComponent('script');
            entity.script.create('spin');
            app.start();
            app.update(1);

            expect(entity.getLocalEulerAngles().y).to.be.closeTo(90, 1e-4);
        });
    });
});
