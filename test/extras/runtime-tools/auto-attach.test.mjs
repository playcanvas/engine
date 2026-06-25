import { expect } from 'chai';

import { AppBase, Application, NullGraphicsDevice } from '../../../src/index.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const debugAppCreated = AppBase._debugAppCreated;
AppBase._debugAppCreated = null;

describe('runtime-tools debug auto-attach', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        AppBase._debugAppCreated = null;
        expect(globalThis.__PLAYCANVAS_TOOLS__).to.be.undefined;
        expect(globalThis.playcanvasTools).to.be.undefined;
        jsdomTeardown();
    });

    it('attaches runtime tools from the debug entrypoint', function () {
        const canvas = document.createElement('canvas');
        const graphicsDevice = new NullGraphicsDevice(canvas);

        AppBase._debugAppCreated = debugAppCreated;
        app = new Application(canvas, { graphicsDevice });

        const tools = globalThis.__PLAYCANVAS_TOOLS__;
        expect(tools.protocol).to.equal('playcanvas.runtime-tools');
        expect(tools.apps()).to.have.length(1);
    });
});
