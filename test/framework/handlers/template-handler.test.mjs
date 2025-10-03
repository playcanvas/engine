import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Example template data in the database
function createFakeTemplateData(name) {
    const rootId = 'root-guid';
    return {
        entities: {
            [rootId]: {
                name,
                resource_id: rootId,
                parent: null,
                children: [],
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                components: {}
            }
        }
    };
}

describe('TemplateHandler', function () {
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


    it('should reparse the new template data', function (done) {
        // For this test case we pretend the data is already loaded
        const file = null;

        const data1 = createFakeTemplateData('root1');
        const data2 = createFakeTemplateData('root2');

        const templateAsset = new Asset('Template B', 'template', file, data1);

        app.assets.add(templateAsset);
        app.assets.load(templateAsset);

        templateAsset.ready(function (asset) {
            const first = asset.resource.instantiate();
            expect(first.name).to.equal('root1');

            // change asset data: should trigger handler.patch and resource invalidation
            asset.data = data2;

            expect(asset.resource.data).to.equal(asset.data);

            const second = asset.resource.instantiate();
            expect(second.name).to.equal('root2');
            done();
        });
    });
});
