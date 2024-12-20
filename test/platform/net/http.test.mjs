import { http, Http } from '../../../src/platform/net/http.js';

import { expect } from 'chai';
import { restore, spy } from 'sinon';

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

    });

});
