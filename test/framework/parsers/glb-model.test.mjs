import { expect } from 'chai';
import sinon from 'sinon';

import { Asset } from '../../../src/framework/asset/asset.js';
import { GlbModelParser } from '../../../src/framework/parsers/glb-model.js';
import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GlbModelParser', function () {

    let app;
    let parser;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        const handler = app.loader.getHandler('model');
        parser = new GlbModelParser(handler);
        parser.handler = handler;
    });

    afterEach(function () {
        sinon.restore();
        parser = null;
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // the url base GlbParser is given for the glb loaded from the supplied url. The glb data is
    // handed over as asset contents, so nothing is fetched
    const parsedUrlBase = (url) => {
        return new Promise((resolve) => {
            sinon.stub(GlbParser, 'parse').callsFake((filename, urlBase) => resolve(urlBase));
            const asset = new Asset('box', 'model', {
                url: typeof url === 'string' ? url : url.load,
                contents: new ArrayBuffer(8)
            });
            parser.load(url, () => {}, asset);
        });
    };

    it('resolves glb resources against the directory of the glb', async function () {
        expect(await parsedUrlBase({ load: '/assets/models/box.glb', original: '/assets/models/box.glb' }))
        .to.equal('/assets/models');
    });

    it('accepts a url passed as a string', async function () {
        expect(await parsedUrlBase('assets/models/box.glb')).to.equal('./assets/models');
    });

    it('has no directory to resolve against for a glb at the root', async function () {
        expect(await parsedUrlBase('box.glb')).to.equal('');
    });
});
