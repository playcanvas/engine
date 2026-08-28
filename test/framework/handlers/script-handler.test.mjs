import { expect } from 'chai';

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
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('registers module scripts with the handler application', async function () {
        const otherApp = createApp();
        const scriptUrl = new URL('../../../src/framework/script/script.js', import.meta.url);
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
});
