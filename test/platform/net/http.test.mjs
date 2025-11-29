import { expect } from 'chai';
import { restore, spy } from 'sinon';
import nise from 'nise';

import { http, Http } from '../../../src/platform/net/http.js';

describe('Http', function () {
    let retryDelay;

    beforeEach(function () {
        retryDelay = Http.retryDelay;
        Http.retryDelay = 1;
    });

    afterEach(function () {
        Http.retryDelay = retryDelay;
        restore();
    });

    describe('#get()', function () {

        it('returns resource', (done) => {
            http.get('http://localhost:3000/test/assets/test.json', (err, data) => {
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
            http.get('http://localhost:3000/someurl.json', (err, data) => {
                expect(err).to.equal(404);
                expect(http.request.callCount).to.equal(1);
                done();
            });
        });

        it('retries resource and returns 404 in the end if not found', (done) => {
            spy(http, 'request');
            http.get('http://localhost:3000/someurl.json', {
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
            http.get('http://localhost:3000/someurl.json', {
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

});
