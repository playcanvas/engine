describe('pc.AssetListLoader', function () {
    var app;
    var assetList;

    beforeEach(function () {
        app = new pc.Application(document.createElement('canvas'));

        assetList = [
            new pc.Asset('statue.glb', 'container', {
                url: 'base/examples/assets/models/statue.glb'
            }),
            new pc.Asset('playcanvas-cube.glb', 'container', {
                url: 'base/examples/assets/models/playcanvas-cube.glb'
            }),
            new pc.Asset('clouds.jpg', 'texture', {
                url: 'base/examples/assets/textures/clouds.jpg'
            }),
            new pc.Asset('heart.png', 'texture', {
                url: 'base/examples/assets/textures/heart.png'
            }),
            new pc.Asset('snowflake.png', 'texture', {
                url: 'base/examples/assets/textures/snowflake.png'
            })
        ];

        assetList.forEach(function (a) {
            app.assets.add(a);
        });

        assetIds = assetList.map(function (a) {
            return a.id;
        });
    });

    afterEach(function () {
        assetList.forEach(function (a) {
            a.unload();
        });
        app.destroy();
    });

    it('fires load event after all assets are loaded', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err) {
            expect(err).to.not.exist;

            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            done();
        });
    });


    it('fires load event with correct scope', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var obj = {};

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err) {
            expect(this).to.equal(obj);

            expect(err).to.not.exist;

            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            done();
        }, obj);
    });

    it('fires load event using asset id list', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetIds, app.assets);

        loader.load(function (err) {
            expect(err).to.not.exist;

            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            done();
        });
    });

    it('calls ready after all assets are loaded', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load()

        setTimeout(function () {
            loader.ready(function () {
                assetList.forEach(function (a) {
                    expect(a.loaded).to.be.true;
                });

                done();
            });
        }, 50);
    });


    it('calls ready with correct scope', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load()

        var obj = {};
        setTimeout(function () {
            loader.ready(function () {
                expect(this).to.be.equal(obj);

                done();
            }, obj);
        }, 50);

    });

    it('calls ready after all assets are loaded even if they are all loaded', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function () {
            loader.ready(function () {
                assetList.forEach(function (a) {
                    expect(a.loaded).to.be.true;
                });

                done();
            });
        });
    });

    it('calls ready twice after all assets are loaded', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load()

        var count = 0;
        loader.ready(function () {
            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            count++;
            if (count === 2) {
                done();
            }
        });

        loader.ready(function () {
            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            count++;
            if (count === 2) {
                done();
            }
        });
    });

    it('calls ready after all using id list', function (done) {
        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetIds, app.assets);

        loader.load()

        setTimeout(function () {
            loader.ready(function () {
                assetList.forEach(function (a) {
                    expect(a.loaded).to.be.true;
                });

                done();
            });
        }, 50);

    });

    it('callback returns error if on asset fails', function (done) {
        var asset = new pc.Asset("Missing", "texture", {
            url: "example/missing/file.png"
        });
        assetList.push(asset);
        app.assets.add(asset);

        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err, failed) {
            expect(err).to.equal("Failed to load some assets");
            expect(failed.length).to.equal(1);
            done();
        });
    });

    it('load is called even if the same asset is included twice', function (done) {
        assetList.push(assetList[0]);

        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err, failed) {
            expect(err).to.not.exist;

            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            done();
        });
    });

    it('no events left bound to asset registry after loading', function (done) {
        var numLoadEvents = app.assets._callbacks['load'] ? app.assets._callbacks['load'].length : 0;
        var numAddEvents = app.assets._callbacks['add'] ? app.assets._callbacks['add'].length : 0;
        var numErrorEvents = app.assets._callbacks['error'] ? app.assets._callbacks['error'].length : 0;

        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err) {
            expect(err).to.not.exist;

            assetList.forEach(function (a) {
                expect(a.loaded).to.be.true;
            });

            expect(app.assets._callbacks['load'].length).to.equal(numLoadEvents);
            expect(app.assets._callbacks['add'].length).to.equal(numAddEvents);
            expect(app.assets._callbacks['error'].length).to.equal(numErrorEvents);

            done();
        });
    });


    it('load waits for asset to be added to registry', function (done) {
        // remove registered asset from list
        var removedAsset = assetList[0]
        app.assets.remove(removedAsset);


        var loader = new pc.AssetListLoader(assetIds, app.assets);

        loader.load(function (err, failed) {
            expect(err).to.not.exist;

            assetList.forEach(function (a, index) {
                expect(a.loaded).to.be.true;
            });

            done();
        });

        // add to registry after calling load
        app.assets.add(removedAsset);
    });



    it('ready for asset to be added to registry', function (done) {
        // remove registered asset from list
        var removedAsset = assetList[0]
        app.assets.remove(removedAsset);

        var loader = new pc.AssetListLoader(assetIds, app.assets);

        loader.ready(function (assets) {
            assetList.forEach(function (a, index) {
                expect(a.loaded).to.be.true;
            });

            done();
        });

        loader.load();

        // add to registry after calling load
        app.assets.add(removedAsset);
    });

    it('destroy after load removes all listeners', function (done) {
        var numLoadEvents = app.assets._callbacks['load'] ? app.assets._callbacks['load'].length : 0;
        var numAddEvents = app.assets._callbacks['add'] ? app.assets._callbacks['add'].length : 0;
        var numErrorEvents = app.assets._callbacks['error'] ? app.assets._callbacks['error'].length : 0;

        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.load(function (err, failed) {
            expect(false).to.be.true;
        });

        loader.destroy();

        expect(app.assets._callbacks['load'].length).to.equal(numLoadEvents);
        expect(app.assets._callbacks['add'].length).to.equal(numAddEvents);
        expect(app.assets._callbacks['error'].length).to.equal(numErrorEvents);

        expect(loader.hasEvent("progress")).to.be.false;
        expect(loader.hasEvent("load")).to.be.false;
        expect(app.assets.hasEvent("add:" + assetList[0].id)).to.be.false;

        done();
    });


    it('destroy after ready removes all listeners', function (done) {
        var numLoadEvents = app.assets._callbacks['load'] ? app.assets._callbacks['load'].length : 0;
        var numAddEvents = app.assets._callbacks['add'] ? app.assets._callbacks['add'].length : 0;
        var numErrorEvents = app.assets._callbacks['error'] ? app.assets._callbacks['error'].length : 0;

        assetList.forEach(function (a) {
            expect(a.loaded).to.be.false;
        });

        var loader = new pc.AssetListLoader(assetList, app.assets);

        loader.ready(function () {
            expect(false).to.be.true;
        });

        loader.destroy();

        expect(loader.hasEvent("progress")).to.be.false;
        expect(loader.hasEvent("load")).to.be.false;
        expect(app.assets.hasEvent("add:" + assetList[0].id)).to.be.false;

        done();
    });
});

