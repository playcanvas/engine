import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AppBase } from '../../../src/framework/app-base.js';
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
});
