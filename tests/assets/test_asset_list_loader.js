describe('pc.AssetListLoader', function () {
    var app;
    var assetList;

    beforeEach(function () {
        app = new pc.Application(document.createElement('canvas'));

        assetList = [
            new pc.Asset('Statue_1.json', 'model', {
                url: 'base/examples/assets/statue/Statue_1.json'
            }),
            new pc.Asset('Statue_Material', 'material', {
                url: 'base/examples/assets/statue/11268/phong9.json'
            }),
            new pc.Asset('Statue_Diffuse', 'texture', {
                url: 'base/examples/assets/statue/11270/Statue_1_C.jpg'
            }),
            new pc.Asset('Statue_Normal', 'texture', {
                url: 'base/examples/assets/statue/11273/Statue_1_N.jpg'
            }),
            new pc.Asset('Statue_Spec', 'texture', {
                url: 'base/examples/assets/statue/11274/Statue_1_S.jpg'
            })
        ];

        assetList.forEach(function (a) {
            app.assets.add(a);
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
});
