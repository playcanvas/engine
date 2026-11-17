import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ScriptHandler', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const scriptUrl = new URL('../../../src/framework/script/script.js', import.meta.url);

    const loadModule = (source) => {
        // The trailing token makes the data URL end in '.mjs', selecting the ESM loader path.
        const moduleUrl = `data:text/javascript,${encodeURIComponent(`${source}\n// module.mjs`)}`;
        return new Promise((resolve, reject) => {
            app.loader.getHandler('script').load(moduleUrl, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    it('registers module scripts with the handler application', async function () {
        const otherApp = createApp();
        const scriptUrl = new URL('../../../src/framework/script/script.js', import.meta.url);
        // The trailing token makes the data URL end in '.mjs', selecting the ESM loader path.
        const source = `
            import { Script } from '${scriptUrl}';
            export class ModuleScript extends Script {
                static scriptName = 'moduleScript';
            }
            // module.mjs`;
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`;

        try {
            expect(AppBase.getApplication()).to.equal(otherApp);

            const scripts = await new Promise((resolve, reject) => {
                app.loader.getHandler('script').load(moduleUrl, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            expect(app.scripts.get('moduleScript')).to.equal(scripts.ModuleScript);
            expect(otherApp.scripts.has('moduleScript')).to.equal(false);
        } finally {
            otherApp.destroy();
        }
    });

    it('does not register an exported base class with a null scriptName', async function () {
        const warn = stub(Debug, 'warnOnce');

        const scripts = await loadModule(`
            import { Script } from '${scriptUrl}';
            export class BaseScript extends Script {
                static scriptName = null;
            }
            export class DerivedScript extends BaseScript {
                static scriptName = 'derivedScript';
            }`);

        expect(app.scripts.get('derivedScript')).to.equal(scripts.DerivedScript);
        expect(app.scripts.has('baseScript')).to.equal(false);
        expect(scripts).to.not.have.property('BaseScript');
        expect(warn.called).to.equal(false);
    });

    it('registers a subclass of a null-named base which declares no name, with a warning', async function () {
        const warn = stub(Debug, 'warnOnce');

        const scripts = await loadModule(`
            import { Script } from '${scriptUrl}';
            class BaseScript extends Script {
                static scriptName = null;
            }
            export class UnnamedScript extends BaseScript {}`);

        expect(app.scripts.get('unnamedScript')).to.equal(scripts.UnnamedScript);
        expect(warn.calledOnce).to.equal(true);
        expect(warn.firstCall.args[0]).to.contain('UnnamedScript');
    });

    // names assigned through the scriptName setter, which is also what static scriptName fields
    // compile to without define semantics for class fields (TypeScript useDefineForClassFields: false)
    describe('names assigned through the scriptName setter', function () {

        it('does not register a base class assigned a null scriptName', async function () {
            const warn = stub(Debug, 'warnOnce');

            const scripts = await loadModule(`
                import { Script } from '${scriptUrl}';
                export class BaseScript extends Script {}
                BaseScript.scriptName = null;
                export class DerivedScript extends BaseScript {}
                DerivedScript.scriptName = 'derivedScript';`);

            expect(app.scripts.get('derivedScript')).to.equal(scripts.DerivedScript);
            expect(app.scripts.has('baseScript')).to.equal(false);
            expect(scripts).to.not.have.property('BaseScript');
            expect(warn.called).to.equal(false);
        });

        it('registers a subclass of such a base which assigns no name, with a warning', async function () {
            const warn = stub(Debug, 'warnOnce');

            const scripts = await loadModule(`
                import { Script } from '${scriptUrl}';
                class BaseScript extends Script {}
                BaseScript.scriptName = null;
                export class UnnamedScript extends BaseScript {}`);

            expect(app.scripts.get('unnamedScript')).to.equal(scripts.UnnamedScript);
            expect(warn.calledOnce).to.equal(true);
            expect(warn.firstCall.args[0]).to.contain('UnnamedScript');
        });

        it('registers a script assigned a name without a warning', async function () {
            const warn = stub(Debug, 'warnOnce');

            const scripts = await loadModule(`
                import { Script } from '${scriptUrl}';
                export class NamedScript extends Script {}
                NamedScript.scriptName = 'customName';`);

            expect(app.scripts.get('customName')).to.equal(scripts.NamedScript);
            expect(warn.called).to.equal(false);
        });
    });

    describe('hot reloading module scripts', function () {

        let dir;

        beforeEach(function () {
            dir = mkdtempSync(join(tmpdir(), 'pc-esm-'));
        });

        afterEach(function () {
            rmSync(dir, { recursive: true, force: true });
        });

        // a module script exporting one script type, tagged with a version so a test can tell
        // which evaluation of the file it got
        const write = (name, version) => {
            const file = join(dir, name);
            writeFileSync(file, `
                import { Script } from '${scriptUrl}';
                export class Rotator extends Script {
                    static scriptName = 'rotator';
                    static version = ${version};
                    swap(old) {}
                }`);
            return pathToFileURL(file).href;
        };

        const loaded = asset => new Promise((resolve, reject) => {
            asset.once('load', resolve);
            asset.once('error', reject);
            app.assets.load(asset);
        });

        it('imports a module by its plain URL the first time it loads', async function () {
            const url = write('rotator.mjs', 1);
            const imports = [];
            const handler = app.loader.getHandler('script');
            const importModule = handler._loadModule;
            handler._loadModule = function (u, callback) {
                imports.push(u);
                return importModule.call(this, u, callback);
            };

            const asset = new Asset('rotator.mjs', 'script', { url: `${url}?id=1`, filename: 'rotator.mjs', hash: 'h1' });
            app.assets.add(asset);
            await loaded(asset);

            expect(imports).to.deep.equal([url]);
            expect(app.scripts.get('rotator').version).to.equal(1);
        });

        it('re-evaluates an edited module and swaps in its new script type', async function () {
            const url = write('rotator.mjs', 1);
            const asset = new Asset('rotator.mjs', 'script', { url: `${url}?id=1`, filename: 'rotator.mjs', hash: 'h1' });
            app.assets.add(asset);
            await loaded(asset);
            expect(app.scripts.get('rotator').version).to.equal(1);

            write('rotator.mjs', 2);
            const swapped = new Promise((resolve) => {
                app.scripts.once('swap:rotator', resolve);
            });
            asset.file = { url: `${url}?id=1`, filename: 'rotator.mjs', hash: 'h2' };
            const type = await swapped;

            expect(type.version).to.equal(2);
            expect(app.scripts.get('rotator')).to.equal(type);
        });
    });
});
