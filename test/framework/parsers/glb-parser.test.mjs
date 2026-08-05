import { expect } from 'chai';

import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GlbParser', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const parseMaterial = (occlusionTexture) => {
        const gltf = {
            asset: { version: '2.0' },
            scenes: [],
            nodes: [],
            materials: [{ occlusionTexture }]
        };
        const data = new TextEncoder().encode(JSON.stringify(gltf));

        return new Promise((resolve, reject) => {
            GlbParser.parse('material.gltf', '', data, app.graphicsDevice, app.assets, {}, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.materials[0]);
                }
            });
        });
    };

    it('imports occlusion texture strength', async function () {
        const material = await parseMaterial({ index: 0, strength: 0.5 });

        expect(material.aoIntensity).to.equal(0.5);
    });

    it('imports zero occlusion texture strength', async function () {
        const material = await parseMaterial({ index: 0, strength: 0 });

        expect(material.aoIntensity).to.equal(0);
    });

    it('uses the default occlusion texture strength when omitted', async function () {
        const material = await parseMaterial({ index: 0 });

        expect(material.aoIntensity).to.equal(1);
    });
});
