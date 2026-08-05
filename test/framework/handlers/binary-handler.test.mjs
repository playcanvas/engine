import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { BinaryHandler } from '../../../src/framework/handlers/binary.js';
import { http } from '../../../src/platform/net/http.js';

describe('BinaryHandler', function () {

    afterEach(function () {
        restore();
    });

    it('loads the resource and returns the fetched ArrayBuffer', function () {
        const handler = new BinaryHandler({});
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, buffer);
        });

        let result;
        handler.load({ load: 'x.bin', original: 'x.bin' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.equal(buffer);
    });

    it('reports a load error including the url', function () {
        const handler = new BinaryHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback('500');
        });

        let err;
        handler.load({ load: 'file.bin', original: 'file.bin' }, (e) => {
            err = e;
        });
        expect(err).to.be.a('string');
        expect(err).to.include('Error loading binary resource');
        expect(err).to.include('file.bin');
    });

    it('openBinary returns the underlying ArrayBuffer of a DataView', function () {
        const handler = new BinaryHandler({});
        const bytes = new Uint8Array([4, 5, 6]);
        const view = new DataView(bytes.buffer);
        expect(handler.openBinary(view)).to.equal(bytes.buffer);
    });
});
