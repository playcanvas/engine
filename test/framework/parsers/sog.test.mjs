import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Asset } from '../../../src/framework/asset/asset.js';
import { SogParser } from '../../../src/framework/parsers/sog.js';
import { http } from '../../../src/platform/net/http.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const BASE_URL = 'http://localhost:3000/static/';
const META_URL = 'assets/splats/meta.json';
const META = {
    version: 2,
    count: 1,
    means: {
        files: ['means_l.webp', 'means_u.webp']
    },
    quats: {
        files: ['quats.webp']
    },
    scales: {
        files: ['scales.webp']
    },
    sh0: {
        files: ['sh0.webp']
    }
};

describe('SogParser', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();

        const base = document.createElement('base');
        base.href = BASE_URL;
        document.head.appendChild(base);

        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;

        jsdomTeardown();
        restore();
    });

    it('resolves texture urls from the document base uri', function (done) {
        const parser = new SogParser(app, 0);
        const sog = new Asset('sog', 'gsplat', {
            url: META_URL
        });
        const urls = [];
        let removed = false;

        app.assets.add(sog);

        stub(http, 'get').callsFake((url, options, callback) => {
            expect(url).to.equal(META_URL);
            callback(null, META);
        });

        stub(app.assets, 'load').callsFake((texture) => {
            urls.push(texture.file.url);

            if (!removed) {
                removed = true;
                app.assets.remove(sog);
            }

            texture.fire('load', texture);
        });

        parser.load(META_URL, (err, resource) => {
            expect(err).to.equal(null);
            expect(resource).to.equal(null);
            expect(urls).to.deep.equal([
                'http://localhost:3000/static/assets/splats/means_l.webp',
                'http://localhost:3000/static/assets/splats/means_u.webp',
                'http://localhost:3000/static/assets/splats/quats.webp',
                'http://localhost:3000/static/assets/splats/scales.webp',
                'http://localhost:3000/static/assets/splats/sh0.webp'
            ]);
            done();
        }, sog);
    });
});
