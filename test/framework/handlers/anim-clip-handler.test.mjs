import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { AnimTrack } from '../../../src/framework/anim/evaluator/anim-track.js';
import { AnimClipHandler } from '../../../src/framework/handlers/anim-clip.js';
import { http, Http } from '../../../src/platform/net/http.js';

// a minimal animation clip data block, as fetched from a clip json resource
const clipData = {
    name: 'test-clip',
    duration: 2,
    inputs: [[0, 1]],
    outputs: [{ components: 3, data: [0, 0, 0, 1, 1, 1] }],
    curves: [{
        path: { entityPath: ['RootNode'], component: 'graph', propertyPath: ['localPosition'] },
        inputIndex: 0,
        outputIndex: 0,
        interpolation: 1
    }]
};

describe('AnimClipHandler', function () {

    afterEach(function () {
        restore();
    });

    it('loads the resource and returns the fetched response', function () {
        const handler = new AnimClipHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, clipData);
        });

        let result;
        handler.load({ load: 'x.json', original: 'x.json' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.equal(clipData);
    });

    it('requests JSON for blob urls', function () {
        const handler = new AnimClipHandler({});
        let requestOptions;
        stub(http, 'get').callsFake((url, options, callback) => {
            requestOptions = options;
            callback(null, clipData);
        });

        handler.load({ load: 'blob:1234', original: 'x.json' }, () => { });
        expect(requestOptions.responseType).to.equal(Http.ResponseType.JSON);
    });

    it('reports a load error including the url', function () {
        const handler = new AnimClipHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback('404');
        });

        let err;
        handler.load({ load: 'file.json', original: 'file.json' }, (e) => {
            err = e;
        });
        expect(err).to.include('Error loading animation clip resource');
        expect(err).to.include('file.json');
        expect(err).to.include('404');
    });

    it('open builds an AnimTrack from the clip data', function () {
        const handler = new AnimClipHandler({});
        const track = handler.open('x.json', clipData);
        expect(track).to.be.an.instanceof(AnimTrack);
        expect(track.name).to.equal('test-clip');
        expect(track.duration).to.equal(2);
        expect(track.curves).to.have.lengthOf(1);
    });
});
