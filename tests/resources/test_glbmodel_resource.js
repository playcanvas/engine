describe("pc.Model", function () {
    beforeEach(function () {
        this.app = new pc.Application(document.createElement('canvas'));
    });

    afterEach(function () {
        this.app.destroy();
        this.app = null;
    });

    it("load basic GLB model", function (done) {
        var modelAsset = new pc.Asset("Test GLB Model", "model", {
            url: 'base/tests/test-assets/glb/box-animated.glb'
        });

        this.app.assets.add(modelAsset);
        this.app.assets.load(modelAsset);

        modelAsset.ready(function (asset) {

            strictEqual(asset.loaded, true);

            strictEqual(asset.resources.length, 4);

            expect(asset.resources[0] instanceof pc.Model).to.equal(true);
            expect(asset.resources[1] instanceof pc.StandardMaterial).to.equal(true);
            expect(asset.resources[2] instanceof pc.StandardMaterial).to.equal(true);
            expect(asset.resources[3] instanceof pc.Animation).to.equal(true);
            done();

        }, this);

        modelAsset.on('error', function (err) {
            assert.fail(err);
        }, this);
    });

    it("create entity with model and animation and auto play it", function (done) {
        var entity = new pc.Entity();

        var modelAsset = new pc.Asset("Test GLB Model", "model", {
            url: 'base/tests/test-assets/glb/box-animated.glb'
        });
        var animationAsset = new pc.Asset("Test GLB Animation", "animation", {
            url: 'base/tests/test-assets/glb/box-animated.glb'
        });

        this.app.assets.add(modelAsset);
        this.app.assets.add(animationAsset);

        this.app.assets.load(modelAsset);

        var app = this.app;

        modelAsset.ready(function (m) {
            entity.addComponent("model", {
                asset: m
            });

            this.app.assets.load(animationAsset);
            animationAsset.ready(function (a) {
                entity.addComponent("animation", {
                    assets: [a.id],
                    activate: true
                });

                app.root.addChild(entity);

                expect(entity.animation.currAnim).to.equal(a.name);

                done();
            }, this);

            animationAsset.on('error', function (err) {
                assert.fail(err);
            }, this);

        }, this);

        modelAsset.on('error', function (err) {
            assert.fail(err);
        }, this);
    });

    it("create compound animation resource and trigger change events", function (done) {
        var entity = new pc.Entity();

        var modelAsset = new pc.Asset("Test GLB Model", "model", {
            url: 'base/tests/test-assets/glb/box-animated.glb'
        });
        var animationAsset = new pc.Asset("Test GLB Animation", "animation", {
            url: 'base/tests/test-assets/glb/box-animated.glb'
        });

        this.app.assets.add(modelAsset);
        this.app.assets.add(animationAsset);

        this.app.assets.load(modelAsset);

        var app = this.app;

        modelAsset.ready(function (m) {
            entity.addComponent("model", {
                asset: m
            });

            this.app.assets.load(animationAsset);
            animationAsset.ready(function (a) {
                entity.addComponent("animation", {
                    assets: [a.id],
                    activate: true
                });

                app.root.addChild(entity);

                var original = a.resource;
                var clone = new pc.Animation();
                clone.name = 'clone-anim';
                clone.duration = a.resource.duration;
                clone._nodes = a.resource._nodes;
                clone._nodeDict = a.resource._nodeDict;

                // switch one animation to many, curr anim name changes to the resource name
                a.resources = [clone, original];
                expect(entity.animation.currAnim).to.equal(clone.name);

                // switch many animations to many, the animation name doesn't chnage
                a.resources = [original, clone];
                expect(entity.animation.currAnim).to.equal(clone.name);

                // switch many animations to one, the anim name switches back to the asset name
                a.resources = [original];
                expect(entity.animation.currAnim).to.equal(a.name);

                // change the resource (not resources) the anim name doesn't change
                a.resource = clone;
                expect(entity.animation.currAnim).to.equal(a.name);

                done();
            }, this);

            animationAsset.on('error', function (err) {
                assert.fail(err);
            }, this);

        }, this);

        modelAsset.on('error', function (err) {
            assert.fail(err);
        }, this);
    });
});
