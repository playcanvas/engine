import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { JsonHandler } from '../../../src/framework/handlers/json.js';
import { http } from '../../../src/platform/net/http.js';

describe('JsonHandler', function () {

    afterEach(function () {
        restore();
    });

    it('registers a single parser', function () {
        const handler = new JsonHandler({});
        expect(handler.parsers).to.have.lengthOf(1);
    });

    it('loads and returns the parsed JSON via its parser', function () {
        const handler = new JsonHandler({});
        const parsed = { hello: 'world' };
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, parsed);
        });

        let result = null;
        handler.load({ load: 'x.json', original: 'x.json' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.equal(parsed);
    });

    it('reports an error when the request fails', function () {
        const handler = new JsonHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback('404');
        });

        let err = null;
        handler.load({ load: 'x.json', original: 'x.json' }, (e) => {
            err = e;
        });
        expect(err).to.be.a('string');
    });

    it('openBinary decodes and parses a DataView (bundle fast-path)', function () {
        const handler = new JsonHandler({});
        const bytes = new TextEncoder().encode('{"a":1,"b":"two"}');
        const view = new DataView(bytes.buffer);
        expect(handler.openBinary(view)).to.deep.equal({ a: 1, b: 'two' });
    });
});
