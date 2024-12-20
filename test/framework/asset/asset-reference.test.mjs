import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { AssetReference } from '../../../src/framework/asset/asset-reference.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';

import { expect } from 'chai';
import { fake, restore } from 'sinon';

describe('AssetReference', function () {
    let app;
    let parent;
    let load;
    let remove;
    let add;

    beforeEach(function () {
        const canvas = document.createElement('canvas');
        app = new Application(canvas, { graphicsDevice: new NullGraphicsDevice(canvas) });
        parent = fake();
        load = fake();
        remove = fake();
        add = fake();
    });

    afterEach(function () {
        app.destroy();
        restore();
    });

    it('should call load callback when asset is loaded', function (done) {
        const reg = new AssetReference('propName', parent, app.assets, {
            load: load
        });

        const asset = new Asset('Reference Test', 'texture', {
            url: 'test/test-assets/test.png'
        });

        reg.id = asset.id;

        asset.once('load', function () {
            expect(load.callCount).to.equal(1);
            expect(load.args[0][0]).to.equal('propName');
            expect(load.args[0][1]).to.equal(parent);
            expect(load.args[0][2].id).to.equal(asset.id);
            done();
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('should call add callback when asset is added', function (done) {
        const reg = new AssetReference('propName', parent, app.assets, {
            add: add
        });

        const asset = new Asset('Reference Test', 'texture', {
            url: 'test/test-assets/test.png'
        });

        reg.id = asset.id;

        app.assets.once('add', function () {
            setTimeout(function () {
                expect(add.callCount).to.equal(1);
                expect(add.args[0][0]).to.equal('propName');
                expect(add.args[0][1]).to.equal(parent);
                expect(add.args[0][2].id).to.equal(asset.id);
                done();
            }, 0);
        });

        app.assets.add(asset);
    });

    it('should call remove callback when asset is removed', function (done) {
        const reg = new AssetReference('propName', parent, app.assets, {
            remove: remove
        });

        const asset = new Asset('Reference Test', 'texture', {
            url: 'test/test-assets/test.png'
        });

        reg.id = asset.id;

        asset.once('remove', function () {
            setTimeout(function () {
                expect(remove.callCount).to.equal(1);
                expect(remove.args[0][0]).to.equal('propName');
                expect(remove.args[0][1]).to.equal(parent);
                expect(remove.args[0][2].id).to.equal(asset.id);
                done();
            }, 0);
        });

        app.assets.add(asset);
        app.assets.remove(asset);
    });

});
