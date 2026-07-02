import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Asset } from '../../../src/framework/asset/asset.js';
import { TemplateHandler } from '../../../src/framework/handlers/template.js';
import { Template } from '../../../src/framework/template.js';
import { http } from '../../../src/platform/net/http.js';
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

// loading behavior, asserted through the public interface (load + open + openBinary) with a
// stubbed http layer - a characterization safety net for the handler's parser-registry plumbing
describe('TemplateHandler (loading)', function () {

    afterEach(function () {
        restore();
    });

    it('loads the resource and returns the fetched response', function () {
        const handler = new TemplateHandler({});
        const templateData = { entities: {} };
        stub(http, 'get').callsFake((url, options, callback) => {
            callback(null, templateData);
        });

        let result;
        handler.load({ load: 'x.json', original: 'x.json' }, (err, res) => {
            expect(err).to.equal(null);
            result = res;
        });
        expect(result).to.equal(templateData);
    });

    it('reports a load error with the exact legacy message (no error detail)', function () {
        const handler = new TemplateHandler({});
        stub(http, 'get').callsFake((url, options, callback) => {
            callback('404');
        });

        let err;
        handler.load({ load: 'file.json', original: 'file.json' }, (e) => {
            err = e;
        });
        expect(err).to.equal('Error requesting template: file.json');
    });

    it('open wraps the data in a Template', function () {
        const handler = new TemplateHandler({});
        const template = handler.open('x.json', { entities: {} });
        expect(template).to.be.an.instanceof(Template);
    });

    it('openBinary decodes a DataView into a Template', function () {
        const handler = new TemplateHandler({});
        const bytes = new TextEncoder().encode('{"entities":{}}');
        const view = new DataView(bytes.buffer);
        expect(handler.openBinary(view)).to.be.an.instanceof(Template);
    });
});
