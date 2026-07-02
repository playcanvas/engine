import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { CssHandler } from '../../../src/framework/handlers/css.js';
import { HtmlHandler } from '../../../src/framework/handlers/html.js';
import { ShaderHandler } from '../../../src/framework/handlers/shader.js';
import { TextHandler } from '../../../src/framework/handlers/text.js';
import { http } from '../../../src/platform/net/http.js';

// Behavior-level tests for the text-decoding resource handlers, which are structurally identical:
// they share the TextParser (fetch text, pass it through) and differ only in their resource type.
// They assert only through the public interface (load + openBinary), acting as a characterization
// safety net for the handlers' parser-registry plumbing.
const textHandlers = [
    { name: 'CssHandler', Handler: CssHandler, type: 'css' },
    { name: 'HtmlHandler', Handler: HtmlHandler, type: 'html' },
    { name: 'TextHandler', Handler: TextHandler, type: 'text' },
    { name: 'ShaderHandler', Handler: ShaderHandler, type: 'shader' }
];

describe('text resource handlers', function () {

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
});
