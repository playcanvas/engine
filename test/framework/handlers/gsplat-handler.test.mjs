import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { GSplatHandler } from '../../../src/framework/handlers/gsplat.js';
import { GSplatOctreeParser } from '../../../src/framework/parsers/gsplat-octree.js';
import { PlyParser } from '../../../src/framework/parsers/ply.js';
import { SogBundleParser } from '../../../src/framework/parsers/sog-bundle.js';
import { SogParser } from '../../../src/framework/parsers/sog.js';
import { http } from '../../../src/platform/net/http.js';

describe('GSplatHandler (parser selection)', function () {

    // the handler only stores the app and constructs the parsers with it; a stub is enough for selection
    const handler = new GSplatHandler({});
    const select = url => handler._selectParser(handler._makeContext({ load: url, original: url }));

    afterEach(function () {
        restore();
    });

    it('routes .ply to the PLY parser', function () {
        expect(select('scene.ply')).to.be.an.instanceof(PlyParser);
    });

    it('routes .sog to the SOG bundle parser', function () {
        expect(select('scene.sog')).to.be.an.instanceof(SogBundleParser);
    });

    it('routes .json (SOG meta) to the SOG parser', function () {
        expect(select('meta.json')).to.be.an.instanceof(SogParser);
    });

    it('routes lod-meta.json to the octree parser (wins over the .json SOG parser)', function () {
        expect(select('assets/splat/lod-meta.json')).to.be.an.instanceof(GSplatOctreeParser);
    });

    it('returns no parser for an unrecognized extension', function () {
        expect(select('scene.xyz')).to.equal(null);
    });

    it('selects the parser by filename (original), not the fetch url (load)', function () {
        const selectFor = (load, original) => handler._selectParser(handler._makeContext({ load, original }));

        // filename extension decides the parser, even when the fetch url has an unknown extension
        expect(selectFor('./hello.xx', 'hello.ply')).to.be.an.instanceof(PlyParser);

        // and the filename wins even when the fetch url has a different known extension
        expect(selectFor('scene.ply', 'scene.sog')).to.be.an.instanceof(SogBundleParser);
    });

    it('exposes the four built-in parsers', function () {
        expect(handler.parsers).to.have.lengthOf(4);
    });

    it('parsers read maxRetries from the handler (not a hardcoded value)', function () {
        const parser = new GSplatOctreeParser({});
        parser.handler = { maxRetries: 7 };
        const getStub = stub(http, 'get');
        parser.load({ load: 'x.json', original: 'lod-meta.json' }, () => {}, {});
        expect(getStub.calledOnce).to.be.true;
        expect(getStub.firstCall.args[1].maxRetries).to.equal(7);
    });
});
