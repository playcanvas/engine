describe('pc.Http', function () {
    var retryDelay;
    var xhr;
    beforeEach(function () {
        retryDelay = pc.Http.retryDelay;
        pc.Http.retryDelay = 1;
    });

    afterEach(function () {
        pc.Http.retryDelay = retryDelay;
        if (xhr) {
            xhr.restore();
            xhr = null;
        }
        sinon.restore();
    });

    it('get() retries resource and returns result if eventually found', function (done) {
        sinon.spy(pc.http, 'request');

        var requests = 0;
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) {
            setTimeout(function () {
                try {
                    if (++requests === 3) {
                        xhr.respond(200, { ContentType: 'application/json' }, JSON.stringify({ test: "value" }));
                    } else {
                        xhr.error();
                    }
                } catch (err) {
                    done(new Error(err.message + '\n' + err.stack));
                }
            });
        };

        pc.http.get('/someurl.json', {
            retry: true,
            maxRetries: 2
        }, function (err, data) {
            expect(err).to.equal(null);
            expect(pc.http.request.callCount).to.equal(3);
            expect(data).to.deep.equal({ test: "value" });
            done();
        });
    });

    it('status 0 returns "Network error"', function (done) {
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) {
            setTimeout(function () {
                try {
                    xhr.error();
                } catch (err) {
                    done(new Error(err.message + '\n' + err.stack));
                }
            });
        };

        pc.http.get('/someurl.json', function (err, data) {
            expect(err).to.equal('Network error');
            done();
        });
    });
});
