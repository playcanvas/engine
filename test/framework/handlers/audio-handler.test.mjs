import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { AudioHandler } from '../../../src/framework/handlers/audio.js';
import { http, Http } from '../../../src/platform/net/http.js';
import { Sound } from '../../../src/platform/sound/sound.js';

// a fake sound manager whose audio context "decodes" any fetched data into this buffer
const fakeAudioBuffer = { duration: 1 };

function createHandler() {
    const manager = {
        context: {
            decodeAudioData: (data, success) => success(fakeAudioBuffer)
        }
    };
    return new AudioHandler({ soundManager: manager });
}

describe('AudioHandler', function () {

    afterEach(function () {
        restore();
    });

    it('loads a supported format and wraps the decoded buffer in a Sound', function () {
        const handler = createHandler();
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, new ArrayBuffer(8));
        });

        let result;
        handler.load({ load: 'x.mp3', original: 'x.mp3' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.be.an.instanceof(Sound);
        expect(result.buffer).to.equal(fakeAudioBuffer);
    });

    it('loads a url without a file extension (the format is decided by the decoder, not the url)', function () {
        const handler = createHandler();
        let requestOptions;
        stub(http, 'get').callsFake((url, options, callback) => {
            requestOptions = options;
            callback(null, new ArrayBuffer(8));
        });

        let result;
        handler.load({ load: 'sounds/mysound', original: 'sounds/mysound' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(requestOptions.responseType).to.equal(Http.ResponseType.ARRAY_BUFFER);
        expect(result).to.be.an.instanceof(Sound);
        expect(result.buffer).to.equal(fakeAudioBuffer);
    });

    it('loads a format the browser can decode even if its extension is not a well-known one', function () {
        const handler = createHandler();
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, new ArrayBuffer(8));
        });

        let result;
        handler.load({ load: 'x.webm', original: 'x.webm' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.be.an.instanceof(Sound);
    });

    it('requests an ArrayBuffer for blob urls', function () {
        const handler = createHandler();
        let requestOptions;
        stub(http, 'get').callsFake((url, options, callback) => {
            requestOptions = options;
            callback(null, new ArrayBuffer(8));
        });

        handler.load({ load: 'blob:1234', original: 'x.mp3' }, () => { });
        expect(requestOptions.responseType).to.equal(Http.ResponseType.ARRAY_BUFFER);
    });

    it('reports an error when the sound manager has no audio context', function () {
        const manager = {};
        const handler = new AudioHandler({ soundManager: manager });
        stub(console, 'warn');

        let err;
        handler.load({ load: 'x.mp3', original: 'x.mp3' }, (e) => {
            err = e;
        });
        expect(err).to.equal('Error loading audio url: x.mp3: Audio manager has no audio context');
    });

    it('reports an error instead of throwing when there is no sound manager', function () {
        stub(console, 'error'); // the debug-build assert in the handler constructor
        stub(console, 'warn');
        const handler = new AudioHandler({});

        let err;
        handler.load({ load: 'x.mp3', original: 'x.mp3' }, (e) => {
            err = e;
        });
        expect(err).to.equal('Error loading audio url: x.mp3: Audio manager has no audio context');
    });

    it('reports decode failures including the url', function () {
        const manager = {
            context: {
                decodeAudioData: (data, success, error) => error(new Error('decode boom'))
            }
        };
        const handler = new AudioHandler({ soundManager: manager });
        stub(console, 'warn');
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, new ArrayBuffer(8));
        });

        let err;
        handler.load({ load: 'x.mp3', original: 'x.mp3' }, (e) => {
            err = e;
        });
        expect(err).to.include('Error loading audio url: x.mp3');
        expect(err).to.include('decode boom');
    });
});
