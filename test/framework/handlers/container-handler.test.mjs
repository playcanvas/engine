import { expect } from 'chai';

import { GlbContainerParser } from '../../../src/framework/parsers/glb-container-parser.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ContainerHandler (parser selection)', function () {

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

    const select = (handler, url) => handler._selectParser(handler._makeContext({ load: url, original: url }));

    it('registers the GLB container parser', function () {
        const handler = app.loader.getHandler('container');
        expect(handler.parsers).to.have.lengthOf(1);
        expect(handler.parsers[0]).to.be.an.instanceof(GlbContainerParser);
    });

    it('routes any extension to the GLB container parser (catch-all)', function () {
        const handler = app.loader.getHandler('container');
        expect(select(handler, 'model.glb')).to.be.an.instanceof(GlbContainerParser);
        expect(select(handler, 'model.gltf')).to.be.an.instanceof(GlbContainerParser);
        expect(select(handler, 'model.anything')).to.be.an.instanceof(GlbContainerParser);
    });
});
