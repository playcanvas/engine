describe('pc.AssetReference', function () {
    var app;
    var parent;
    var load
    var remove
    var add;

    beforeEach(function () {
        this.parent = sinon.fake();

        this.app = new pc.Application(document.createElement('canvas'));

        this.load = sinon.fake();
        this.remove = sinon.fake();
        this.add = sinon.fake();
    });

    afterEach(function () {
        this.app.destroy();
        sinon.restore();
    });

    it('pc.AssetReference, load callback', function (done) {
        var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
            load: this.load
        });

        var asset = new pc.Asset("Reference Test", "texture", {
            url: 'base/tests/test-assets/sprite/red-atlas.png'
        });

        reg.id = asset.id;

        asset.once('load', function () {
            expect(this.load.callCount).to.equal(1);
            expect(this.load.args[0][0]).to.equal('propName');
            expect(this.load.args[0][1]).to.equal(this.parent);
            expect(this.load.args[0][2].id).to.equal(asset.id);

            done();
        }, this);

        this.app.assets.add(asset);
        this.app.assets.load(asset);
    });

    it('pc.AssetReference, add callback', function (done) {
        var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
            add: this.add
        });

        var asset = new pc.Asset("Reference Test", "texture", {
            url: 'base/tests/test-assets/sprite/red-atlas.png'
        });

        reg.id = asset.id;

        this.app.assets.once('add', function () {
            setTimeout(function () {
                expect(this.add.callCount).to.equal(1);
                expect(this.add.args[0][0]).to.equal('propName');
                expect(this.add.args[0][1]).to.equal(this.parent);
                expect(this.add.args[0][2].id).to.equal(asset.id);

                done();
            }.bind(this), 0);
        }, this);

        this.app.assets.add(asset);
    });

    it('pc.AssetReference, remove callback', function (done) {
        var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
            remove: this.remove
        });

        var asset = new pc.Asset("Reference Test", "texture", {
            url: 'base/tests/test-assets/sprite/red-atlas.png'
        });

        reg.id = asset.id;

        asset.once('remove', function () {
            setTimeout(function () {
                expect(this.remove.callCount).to.equal(1);
                expect(this.remove.args[0][0]).to.equal('propName');
                expect(this.remove.args[0][1]).to.equal(this.parent);
                expect(this.remove.args[0][2].id).to.equal(asset.id);

                done();
            }.bind(this), 0);
        }, this);

        this.app.assets.add(asset);
        this.app.assets.remove(asset);
    });
});
