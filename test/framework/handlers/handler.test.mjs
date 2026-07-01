import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { ResourceHandler } from '../../../src/framework/handlers/handler.js';
import { GlbModelParser } from '../../../src/framework/parsers/glb-model.js';
import { JsonModelParser } from '../../../src/framework/parsers/json-model.js';
import { http, Http } from '../../../src/platform/net/http.js';

// the base ResourceHandler only stores the app and exposes it via context.app, so a stub is enough
const fakeApp = {};

// build a mock parser; `load`/`open` default to a sinon stub so calls can be asserted
function mockParser(canParse, extra = {}) {
    return { canParse, load: stub(), ...extra };
}

describe('ResourceHandler (parser registry)', function () {

    afterEach(function () {
        restore();
    });

    describe('addParser / removeParser / parsers', function () {

        it('registers parsers and exposes a read-only copy', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const a = mockParser(() => true);
            const b = mockParser(() => true);
            handler.addParser(a);
            handler.addParser(b);

            expect(handler.parsers).to.deep.equal([a, b]);

            // mutating the returned array must not affect the handler
            const list = handler.parsers;
            list.length = 0;
            expect(handler.parsers).to.have.lengthOf(2);
        });

        it('removeParser removes a registered parser', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const a = mockParser(() => true);
            const b = mockParser(() => true);
            handler.addParser(a);
            handler.addParser(b);
            handler.removeParser(a);
            expect(handler.parsers).to.deep.equal([b]);
        });

        it('asserts when a parser does not implement canParse', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const errorSpy = stub(console, 'error');
            handler.addParser({});
            expect(errorSpy.called).to.be.true;
        });

        it('warns (removed) when the legacy decider argument is passed', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            // Debug.removed dedupes globally - clear so this assertion is order-independent
            Debug._loggedMessages.clear();
            const errorSpy = stub(console, 'error');
            handler.addParser(mockParser(() => true), () => true);
            expect(errorSpy.called).to.be.true;
        });
    });

    describe('parser selection', function () {

        it('selects the newest parser whose canParse returns true (override by order)', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const first = mockParser(() => true);
            const second = mockParser(() => true);
            handler.addParser(first);
            handler.addParser(second);

            handler.load({ load: 'a.foo', original: 'a.foo' }, () => {});
            expect(second.load.calledOnce).to.be.true;
            expect(first.load.notCalled).to.be.true;
        });

        it('selects the parser whose canParse matches the context', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const foo = mockParser(context => context.ext === 'foo');
            const bar = mockParser(context => context.ext === 'bar');
            handler.addParser(foo);
            handler.addParser(bar);

            handler.load({ load: 'x.bar', original: 'x.bar' }, () => {});
            expect(bar.load.calledOnce).to.be.true;
            expect(foo.load.notCalled).to.be.true;
        });

        it('calls back with an error when no parser matches', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            handler.addParser(mockParser(() => false));
            let err = null;
            handler.load({ load: 'x.foo', original: 'x.foo' }, (e) => {
                err = e;
            });
            expect(err).to.be.a('string');
        });
    });

    describe('fetch', function () {

        it('forwards responseType and retry options to http.get', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            handler.maxRetries = 3;
            const getStub = stub(http, 'get').callsFake((url, options, cb) => cb(null, 'data'));

            let result;
            handler.fetch({ load: 'x.txt', original: 'x.txt' }, Http.ResponseType.TEXT, (err, res) => {
                result = res;
            });

            expect(getStub.calledOnce).to.be.true;
            const [reqUrl, options] = getStub.firstCall.args;
            expect(reqUrl).to.equal('x.txt');
            expect(options.responseType).to.equal(Http.ResponseType.TEXT);
            expect(options.retry).to.be.true;
            expect(options.maxRetries).to.equal(3);
            expect(result).to.equal('data');
        });

        it('normalizes a string url', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const getStub = stub(http, 'get').callsFake((url, options, cb) => cb(null, 'data'));
            handler.fetch('x.txt', Http.ResponseType.TEXT, () => {});
            expect(getStub.firstCall.args[0]).to.equal('x.txt');
        });

        it('reuses asset.file.contents for ARRAY_BUFFER without hitting the network', function (done) {
            const handler = new ResourceHandler(fakeApp, 'test');
            const buffer = new Uint8Array([1, 2, 3]).buffer;
            const getStub = stub(http, 'get');
            const asset = { file: { contents: buffer } };

            handler.fetch({ load: 'x.bin', original: 'x.bin' }, Http.ResponseType.ARRAY_BUFFER, (err, res) => {
                expect(err).to.equal(null);
                expect(res).to.equal(buffer);
                expect(getStub.notCalled).to.be.true;
                done();
            }, asset);
        });
    });

    describe('legacy behavior when no parsers are registered', function () {

        it('load does nothing (callback not invoked)', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const cb = stub();
            handler.load({ load: 'x.foo', original: 'x.foo' }, cb);
            expect(cb.notCalled).to.be.true;
        });

        it('open returns the data unchanged', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const data = { any: 'thing' };
            expect(handler.open('x.foo', data)).to.equal(data);
        });
    });

    describe('open', function () {

        it('delegates to the selected parser open when present', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const resource = {};
            handler.addParser(mockParser(() => true, { open: () => resource }));
            expect(handler.open('x.foo', { raw: true })).to.equal(resource);
        });

        it('returns the data when the selected parser has no open', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const data = { raw: true };
            handler.addParser(mockParser(() => true));
            expect(handler.open('x.foo', data)).to.equal(data);
        });
    });

    describe('_makeContext', function () {

        it('parses a string url (extension, basename, query stripped, lower-cased)', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const context = handler._makeContext('path/To/Model.GLB?v=2');
            expect(context.url).to.equal('path/To/Model.GLB?v=2');
            expect(context.ext).to.equal('glb');
            expect(context.basename).to.equal('model.glb');
            expect(context.app).to.equal(fakeApp);
        });

        it('parses a {load, original} url using original', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const context = handler._makeContext({ load: 'blob:xyz', original: 'thing.json' });
            expect(context.ext).to.equal('json');
            expect(context.basename).to.equal('thing.json');
        });

        it('handles a null url', function () {
            const handler = new ResourceHandler(fakeApp, 'test');
            const context = handler._makeContext(null);
            expect(context.url).to.equal(null);
            expect(context.ext).to.equal('');
            expect(context.basename).to.equal('');
        });
    });

    describe('model parser canParse', function () {

        it('JsonModelParser matches .json only', function () {
            const parser = new JsonModelParser({});
            expect(parser.canParse({ ext: 'json' })).to.be.true;
            expect(parser.canParse({ ext: 'glb' })).to.be.false;
        });

        it('GlbModelParser matches .glb only', function () {
            const parser = new GlbModelParser({});
            expect(parser.canParse({ ext: 'glb' })).to.be.true;
            expect(parser.canParse({ ext: 'json' })).to.be.false;
        });
    });
});
