import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { BinaryHandler } from '../../../src/framework/handlers/binary.js';
import { CssHandler } from '../../../src/framework/handlers/css.js';
import { HtmlHandler } from '../../../src/framework/handlers/html.js';
import { ShaderHandler } from '../../../src/framework/handlers/shader.js';
import { TextHandler } from '../../../src/framework/handlers/text.js';
import { http } from '../../../src/platform/net/http.js';

// Behavior-level tests for the single-parser resource handlers that have no example coverage. They assert
// only through the public interface (load + openBinary), which is identical whether the handler loads via
// its own load() override (current) or via the ResourceHandler parser registry (after conversion) - so
// these act as a safety net for that future conversion.

// the text-decoding handlers are structurally identical: fetch bytes and decode to a string
const textHandlers = [
    { name: 'CssHandler', Handler: CssHandler, type: 'css' },
    { name: 'HtmlHandler', Handler: HtmlHandler, type: 'html' },
    { name: 'TextHandler', Handler: TextHandler, type: 'text' },
    { name: 'ShaderHandler', Handler: ShaderHandler, type: 'shader' }
];

describe('single-parser resource handlers', function () {

    afterEach(function () {
        restore();
    });

    textHandlers.forEach(({ name, Handler, type }) => {

        describe(name, function () {

            it('loads the resource and returns the fetched response', function () {
                const handler = new Handler({});
                stub(http, 'get').callsFake((url, options, callback) => {
                    callback(null, 'the-contents');
                });

                let result;
                handler.load({ load: `x.${type}`, original: `x.${type}` }, (err, res) => {
                    expect(err).to.equal(null);
                    result = res;
                });
                expect(result).to.equal('the-contents');
            });

            it('reports a load error including the resource type and url', function () {
                const handler = new Handler({});
                stub(http, 'get').callsFake((url, options, callback) => {
                    callback('404');
                });

                let err;
                handler.load({ load: `file.${type}`, original: `file.${type}` }, (e) => {
                    err = e;
                });
                expect(err).to.be.a('string');
                expect(err).to.include(`Error loading ${type} resource`);
                expect(err).to.include(`file.${type}`);
            });

            it('openBinary decodes a DataView to a string', function () {
                const handler = new Handler({});
                const bytes = new TextEncoder().encode('body { color: red; }');
                const view = new DataView(bytes.buffer);
                expect(handler.openBinary(view)).to.equal('body { color: red; }');
            });
        });
    });

    describe('BinaryHandler', function () {

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
});
