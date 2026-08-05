import { expect } from 'chai';

import { BasisParser } from '../../../src/framework/parsers/texture/basis.js';
import { DdsParser } from '../../../src/framework/parsers/texture/dds.js';
import { HdrParser } from '../../../src/framework/parsers/texture/hdr.js';
import { ImgParser } from '../../../src/framework/parsers/texture/img.js';
import { KtxParser } from '../../../src/framework/parsers/texture/ktx.js';
import { Ktx2Parser } from '../../../src/framework/parsers/texture/ktx2.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('TextureHandler (parser selection)', function () {

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

    // resolves the parser the texture handler would use for a url's extension
    const parserFor = (url) => {
        const handler = app.loader.getHandler('texture');
        return handler._selectParser(handler._makeContext({ load: url, original: url }));
    };

    it('routes .dds to the DDS parser', function () {
        expect(parserFor('tex.dds')).to.be.an.instanceof(DdsParser);
    });

    it('routes .ktx to the KTX parser', function () {
        expect(parserFor('tex.ktx')).to.be.an.instanceof(KtxParser);
    });

    it('routes .ktx2 to the KTX2 parser', function () {
        expect(parserFor('tex.ktx2')).to.be.an.instanceof(Ktx2Parser);
    });

    it('routes .basis to the Basis parser', function () {
        expect(parserFor('tex.basis')).to.be.an.instanceof(BasisParser);
    });

    it('routes .hdr to the HDR parser', function () {
        expect(parserFor('tex.hdr')).to.be.an.instanceof(HdrParser);
    });

    it('routes browser image formats (png) to the image parser', function () {
        expect(parserFor('tex.png')).to.be.an.instanceof(ImgParser);
    });

    it('falls back to the image parser for an unrecognized extension', function () {
        expect(parserFor('tex.xyz')).to.be.an.instanceof(ImgParser);
    });

    it('open returns undefined for a null url (the loader.open path)', function () {
        expect(app.loader.getHandler('texture').open(null, {})).to.be.undefined;
    });

    it('open returns undefined when no parser matches (img catch-all removed)', function () {
        const handler = app.loader.getHandler('texture');
        handler.removeParser(handler.imgParser);
        expect(handler.open('tex.xyz', {})).to.be.undefined;
    });
});
