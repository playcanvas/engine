import { expect } from 'chai';
import { fake, restore } from 'sinon';

import { AssetReference } from '../../../src/framework/asset/asset-reference.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AssetReference', function () {
    let app;
    let parent;
    let load;
    let remove;
    let add;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        parent = fake();
        load = fake();
        remove = fake();
        add = fake();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();

        restore();
    });

    it('should call load callback when asset is loaded', function (done) {
        const reg = new AssetReference('propName', parent, app.assets, {
            load: load
        });

        const asset = new Asset('Reference Test', 'texture', {
            url: 'test/assets/test.png'
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
            url: 'test/assets/test.png'
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
            url: 'test/assets/test.png'
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
