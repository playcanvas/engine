import { expect } from 'chai';
import nise from 'nise';
import { restore, spy } from 'sinon';

import { http, Http } from '../../../src/platform/net/http.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * A minimal XMLHttpRequest stand-in that lets a test drive the exact completion sequence a browser
 * uses. Sinon's fake XHR is not usable for that: it only dispatches events to addEventListener()
 * listeners, so it never invokes the `onerror` property the engine assigns, and it swallows
 * exceptions thrown out of `onreadystatechange`.
 */
class FakeXhr {
    static instances = [];

    readyState = 0;

    status = 0;

    responseType = '';

    responseText = '';

    response = null;

    responseURL = '';

    onreadystatechange = null;

    onerror = null;

    _contentType = null;

    constructor() {
        FakeXhr.instances.push(this);
    }

    open() {}

    setRequestHeader() {}

    send() {}

    getResponseHeader(name) {
        return name === 'Content-Type' ? this._contentType ?? null : null;
    }

    /**
     * Replay the browser's network-error sequence. Per the XHR spec the request error steps set
     * readyState to 4 (leaving status 0), fire `readystatechange` and *then* fire `error`, so both
     * of the engine's handlers run for a single failure.
     */
    failWithNetworkError() {
        this.readyState = 4;
        this.status = 0;
        this.onreadystatechange?.();
        this.onerror?.();
    }

    succeedWith(body, contentType = 'application/json') {
        this.readyState = 4;
        this.status = 200;
        this.responseText = body;
        this._contentType = contentType;

        if (this.responseType === 'json') {
            // a browser parses the body itself for this response type, and reports a parse failure
            // as a null response rather than by throwing
            try {
                this.response = JSON.parse(body);
            } catch (e) {
                this.response = null;
            }
        } else {
            this.response = body;
        }

        this.onreadystatechange?.();
    }
}

describe('Http', function () {
    let retryDelay;

    beforeEach(function () {
        // Set up a JSDOM document so global.XMLHttpRequest exists and root-relative
        // request URLs resolve against the fixture server's origin, independent of
        // whether any other test file ran jsdomSetup() first.
        jsdomSetup();

        retryDelay = Http.retryDelay;
        Http.retryDelay = 1;
    });

    afterEach(function () {
        Http.retryDelay = retryDelay;
        restore();
        jsdomTeardown();
    });

    describe('#get()', function () {

        it('returns resource', (done) => {
            http.get('/test/assets/test.json', (err, data) => {
                expect(err).to.equal(null);
                expect(data).to.deep.equal({
                    a: 1,
                    b: true,
                    c: 'hello world'
                });
                done();
            });
        });

        it('does not retry if retry is false', (done) => {
            spy(http, 'request');
            http.get('/someurl.json', (err, data) => {
                expect(err).to.equal(404);
                expect(http.request.callCount).to.equal(1);
                done();
            });
        });

        it('retries resource and returns 404 in the end if not found', (done) => {
            spy(http, 'request');
            http.get('/someurl.json', {
                retry: true,
                maxRetries: 2
            }, (err) => {
                expect(err).to.equal(404);
                expect(http.request.callCount).to.equal(3);
                done();
            });
        });

        it('retries resource 5 times by default', (done) => {
            spy(http, 'request');
            http.get('/someurl.json', {
                retry: true
            }, (err) => {
                expect(http.request.callCount).to.equal(6);
                done();
            });
        });

        it('retries resource and returns result if eventually found', function (done) {
            spy(http, 'request');

            let requests = 0;
            const xhr = nise.fakeXhr.useFakeXMLHttpRequest();

            // Store original XMLHttpRequest
            const originalXHR = global.XMLHttpRequest;

            // Replace JSDOM's XMLHttpRequest with Sinon's fake
            global.XMLHttpRequest = xhr;

            xhr.onCreate = function (xhr) {
                setTimeout(function () {
                    try {
                        if (++requests === 3) {
                            xhr.respond(200, { ContentType: 'application/json' }, JSON.stringify({ test: 'value' }));
                        } else {
                            xhr.error();
                        }
                    } catch (err) {
                        done(new Error(`${err.message}\n${err.stack}`));
                    }
                });
            };

            http.get('/someurl.json', {
                retry: true,
                maxRetries: 2
            }, function (err, data) {
                expect(err).to.equal(null);
                expect(http.request.callCount).to.equal(3);
                expect(data).to.deep.equal({ test: 'value' });

                // Restore original XMLHttpRequest
                global.XMLHttpRequest = originalXHR;

                done();
            });
        });

        it('status 0 returns "Network error"', function (done) {
            const xhr = nise.fakeXhr.useFakeXMLHttpRequest();
            let isDone = false;

            // Store original XMLHttpRequest
            const originalXHR = global.XMLHttpRequest;

            // Replace JSDOM's XMLHttpRequest with Sinon's fake
            global.XMLHttpRequest = xhr;

            xhr.onCreate = function (xhr) {
                setTimeout(function () {
                    try {
                        xhr.error();
                    } catch (err) {
                        if (!isDone) {
                            isDone = true;
                            done(new Error(`${err.message}\n${err.stack}`));
                        }
                    }
                });
            };

            http.get('/someurl.json', function (err, data) {
                if (!isDone) {
                    isDone = true;
                    expect(err).to.equal('Network error');

                    // Restore original XMLHttpRequest
                    global.XMLHttpRequest = originalXHR;

                    done();
                }
            });
        });

    });

    describe('JSON responses', function () {
        let originalXHR;
        let created;

        const JSON_HEADERS = { 'Content-Type': 'application/json' };

        // a truncated body: valid JSON up to the point it stops
        const MALFORMED = '{ "a": 1, ';

        beforeEach(function () {
            created = [];
            originalXHR = global.XMLHttpRequest;
            const fakeXhr = nise.fakeXhr.useFakeXMLHttpRequest();
            global.XMLHttpRequest = fakeXhr;
            // collect every created XHR so each test can drive the response itself
            fakeXhr.onCreate = (xhr) => {
                created.push(xhr);
            };
        });

        afterEach(function () {
            global.XMLHttpRequest = originalXHR;
        });

        // issue a request and record every callback invocation, so tests can assert on the
        // delivered (err, data) as well as on how many times it was delivered
        const capture = (url, options) => {
            const calls = [];
            http.get(url, options ?? {}, (err, data) => {
                calls.push({ err, data });
            });
            return calls;
        };

        it('parses a valid body on a .json url', function () {
            const calls = capture('/data.json');
            created[0].respond(200, JSON_HEADERS, '{"a":1,"b":true}');

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.deep.equal({ a: 1, b: true });
        });

        it('reports a malformed body on a .json url as an error', function () {
            const calls = capture('/data.json');
            created[0].respond(200, JSON_HEADERS, MALFORMED);

            // must not be delivered as a successful load with a null resource
            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.be.an.instanceof(SyntaxError);
            expect(calls[0].data).to.equal(undefined);
        });

        it('parses a body of literal null as a successful load', function () {
            const calls = capture('/data.json');
            created[0].respond(200, JSON_HEADERS, 'null');

            // `null` is a valid JSON document and must stay distinguishable from a parse failure
            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.equal(null);
        });

        it('parses a body of literal null served with a binary content type', function () {
            const calls = capture('/data.json');
            created[0].respond(200, { 'Content-Type': 'application/octet-stream' }, 'null');

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.equal(null);
        });

        it('reports an empty body on a .json url as an error', function () {
            const calls = capture('/data.json');
            created[0].respond(200, JSON_HEADERS, '');

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.be.an.instanceof(SyntaxError);
            expect(calls[0].data).to.equal(undefined);
        });

        it('reports a malformed body on a .json url with a query string as an error', function () {
            const calls = capture('/data.json?v=2');
            created[0].respond(200, JSON_HEADERS, MALFORMED);

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.be.an.instanceof(SyntaxError);
        });

        it('reports a malformed body as an error for an explicit json responseType', function () {
            const calls = capture('/api/config', { responseType: Http.ResponseType.JSON });
            created[0].respond(200, JSON_HEADERS, MALFORMED);

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.be.an.instanceof(SyntaxError);
            expect(calls[0].data).to.equal(undefined);
        });

        it('reports a malformed body as an error regardless of the url extension', function () {
            // the same body served with the same content type must fail the same way whether or
            // not the url happens to end in .json
            const withExt = capture('/data.json');
            const withoutExt = capture('/api/config');
            created[0].respond(200, JSON_HEADERS, MALFORMED);
            created[1].respond(200, JSON_HEADERS, MALFORMED);

            expect(withExt[0].err).to.be.an.instanceof(SyntaxError);
            expect(withoutExt[0].err).to.be.an.instanceof(SyntaxError);
        });

        it('parses a .json url served with a binary content type', function () {
            // some hosts serve .json as application/octet-stream (issue #5264): the requested JSON
            // response type must win over the content type sniff
            const calls = capture('/data.json');
            created[0].respond(200, { 'Content-Type': 'application/octet-stream' }, '{"a":1}');

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.deep.equal({ a: 1 });
        });

        it('reports a malformed body served with a binary content type as an error', function () {
            const calls = capture('/data.json');
            created[0].respond(200, { 'Content-Type': 'application/octet-stream' }, MALFORMED);

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.be.an.instanceof(SyntaxError);
            expect(calls[0].data).to.equal(undefined);
        });

        it('parses an explicit json responseType served as text/plain', function () {
            const calls = capture('/api/config', { responseType: Http.ResponseType.JSON });
            created[0].respond(200, { 'Content-Type': 'text/plain' }, '{"a":1}');

            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.deep.equal({ a: 1 });
        });

        it('does not parse a .json url requested as an arraybuffer', function () {
            const calls = capture('/data.json', { responseType: Http.ResponseType.ARRAY_BUFFER });
            created[0].respond(200, JSON_HEADERS, MALFORMED);

            // an explicitly binary response type wins over the .json extension, and the raw bytes
            // are handed back unparsed
            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data.byteLength).to.equal(MALFORMED.length);
        });
    });

    describe('error delivery', function () {
        let originalXHR;

        beforeEach(function () {
            FakeXhr.instances = [];
            originalXHR = global.XMLHttpRequest;
            global.XMLHttpRequest = FakeXhr;
        });

        afterEach(function () {
            global.XMLHttpRequest = originalXHR;
        });

        it('delivers a network error exactly once', function () {
            const calls = [];
            http.get('/data.json', (err, data) => {
                calls.push({ err, data });
            });

            FakeXhr.instances[0].failWithNetworkError();

            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal('Network error');
            expect(calls[0].data).to.equal(null);
        });

        it('schedules exactly one retry for a single network failure', function (done) {
            spy(http, 'request');

            http.get('/data.json', { retry: true, maxRetries: 1 }, () => {});
            FakeXhr.instances[0].failWithNetworkError();

            // the retry runs on a timer, so it has to be waited for: suppressing the duplicate
            // handler call must not also suppress the retry, nor let it run twice
            setTimeout(() => {
                expect(http.request.callCount).to.equal(2);
                expect(FakeXhr.instances.length).to.equal(2);

                // drain the retry so it does not leave a slot held on the shared http instance
                FakeXhr.instances[1].failWithNetworkError();
                done();
            }, 50);
        });

        it('reports a text response type on the returned request for a JSON request', function () {
            // a declared behaviour change: a JSON response type is fetched as text and parsed by
            // the engine, so the returned request - which is public API - reports `text`
            const xhr = http.get('/data.json', () => {});

            expect(xhr.responseType).to.equal('text');
        });

        it('does not swallow an exception thrown while handling a success', function () {
            const calls = [];
            http.get('/data.json', (err, data) => {
                calls.push({ err, data });
                if (calls.length === 1) {
                    // application code failing to handle a *successful* response
                    throw new TypeError('thrown by the application');
                }
            });

            // the caller's exception belongs to the caller: it propagates with its own stack
            // intact rather than being caught and re-reported as a load error
            expect(() => FakeXhr.instances[0].succeedWith('{"a":1}'))
            .to.throw(TypeError, 'thrown by the application');

            // and it must not come back as a second, spurious failure callback
            expect(calls.length).to.equal(1);
            expect(calls[0].err).to.equal(null);
            expect(calls[0].data).to.deep.equal({ a: 1 });
        });
    });

    describe('#maxConcurrentRequests', function () {
        let originalXHR;
        let created;

        beforeEach(function () {
            created = [];
            originalXHR = global.XMLHttpRequest;
            const fakeXhr = nise.fakeXhr.useFakeXMLHttpRequest();
            global.XMLHttpRequest = fakeXhr;
            // collect every created XHR but don't auto-respond, so requests stay in flight
            fakeXhr.onCreate = (xhr) => {
                created.push(xhr);
            };

            // start each test from a known, clean throttle state on the shared singleton
            http.maxConcurrentRequests = 128;
            http._activeRequests = 0;
            http._sendQueue.length = 0;
        });

        afterEach(function () {
            global.XMLHttpRequest = originalXHR;
            // restore defaults so state doesn't leak into other test files
            http.maxConcurrentRequests = 128;
            http._activeRequests = 0;
            http._sendQueue.length = 0;
        });

        const respond = (xhr) => {
            xhr.respond(200, { 'Content-Type': 'application/json' }, '{}');
        };

        it('limits in-flight requests and queues the rest', function () {
            http.maxConcurrentRequests = 2;

            let completed = 0;
            const onDone = () => {
                completed++;
            };
            for (let i = 0; i < 4; i++) {
                http.get(`/url${i}.json`, onDone);
            }

            // all 4 XHRs are created (cheap), but only 2 are sent; the other 2 are queued
            expect(created.length).to.equal(4);
            expect(http._activeRequests).to.equal(2);
            expect(http._sendQueue.length).to.equal(2);

            // completing the 2 in-flight requests dispatches the 2 queued ones
            respond(created[0]);
            respond(created[1]);
            expect(http._activeRequests).to.equal(2);
            expect(http._sendQueue.length).to.equal(0);
            expect(completed).to.equal(2);

            // completing those drains everything
            respond(created[2]);
            respond(created[3]);
            expect(http._activeRequests).to.equal(0);
            expect(completed).to.equal(4);
        });

        it('does not throttle when set to 0', function () {
            http.maxConcurrentRequests = 0;

            const noop = () => {};
            for (let i = 0; i < 5; i++) {
                http.get(`/url${i}.json`, noop);
            }

            // everything is sent immediately and nothing is queued or slot-accounted
            expect(created.length).to.equal(5);
            expect(http._sendQueue.length).to.equal(0);
            expect(http._activeRequests).to.equal(0);
        });

        it('dispatches queued requests when the limit is raised', function () {
            http.maxConcurrentRequests = 1;

            const noop = () => {};
            for (let i = 0; i < 3; i++) {
                http.get(`/url${i}.json`, noop);
            }
            expect(http._activeRequests).to.equal(1);
            expect(http._sendQueue.length).to.equal(2);

            // raising the limit immediately pumps the queued requests
            http.maxConcurrentRequests = 3;
            expect(http._activeRequests).to.equal(3);
            expect(http._sendQueue.length).to.equal(0);
        });

        it('tracks slots per request, not per shared options object', function () {
            http.maxConcurrentRequests = 2;

            // a single options object reused across concurrent requests must not corrupt slot
            // accounting (state is keyed on the xhr, not on the caller's options object)
            const shared = {};
            const onDone = () => {};
            for (let i = 0; i < 4; i++) {
                http.get(`/url${i}.json`, shared, onDone);
            }

            expect(http._activeRequests).to.equal(2);
            expect(http._sendQueue.length).to.equal(2);

            // completing all four returns the active count cleanly to 0 (no leak)
            created.forEach(respond);
            expect(http._activeRequests).to.equal(0);
            expect(http._sendQueue.length).to.equal(0);
        });

    });

});
