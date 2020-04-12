describe('Test Bundle Loader', function () {
    beforeEach(function () {
        this._workers = pc.platform.workers;

        // create app
        this.app = new pc.Application(document.createElement('canvas'));

        // create assets in the bundle
        // (To add more files just untar bundles.tar.gz, add your file and then tar it again using
        // "tar czf bundle.tar.gz files")
        this.assets = [
            new pc.Asset('css', 'css', {
                filename: 'css.css',
                url: 'files/css/css.css'
            }),
            new pc.Asset('html', 'html', {
                filename: 'html.html',
                url: 'files/html/html.html'
            }),
            new pc.Asset('json', 'json', {
                filename: 'json.json',
                url: 'files/json/json.json'
            }),
            new pc.Asset('shader', 'shader', {
                filename: 'shader.glsl',
                url: 'files/shader/shader.glsl'
            }),
            new pc.Asset('text', 'text', {
                filename: 'text.txt',
                url: 'files/text/text.txt'
            }),
            new pc.Asset('cubemap', 'cubemap', {
                filename: 'cubemap.dds',
                url: 'files/cubemap/cubemap.dds'
            }),
            new pc.Asset('model', 'model', {
                filename: 'model.json',
                url: 'files/model/model.json'
            }),
            new pc.Asset('texture', 'texture', {
                filename: 'texture.jpg',
                url: 'files/texture/texture.jpg'
            }),
            new pc.Asset('atlas', 'textureatlas', {
                filename: 'atlas.jpg',
                url: 'files/textureatlas/atlas.jpg'
            }),
            new pc.Asset('animation', 'animation', {
                filename: 'animation.json',
                url: 'files/animation/animation.json'
            }),
            new pc.Asset('font', 'font', {
                filename: 'font.png',
                url: 'files/font/font.png'
            }, {
                info: {
                    maps: [{
                        width: 128,
                        height: 128
                    }, {
                        width: 128,
                        height: 128
                    }]
                }
            }),
            new pc.Asset('audio', 'audio', {
                filename: 'audio.mp3',
                url: 'files/audio/audio.mp3'
            })
        ];

        // expected types of asset types
        this.expectedTypes = {
            css: {
                typeof: 'string'
            },
            html: {
                typeof: 'string'
            },
            json: {
                typeof: 'object'
            },
            shader: {
                typeof: 'string'
            },
            text: {
                typeof: 'string'
            },
            cubemap: {
                instanceof: pc.Texture
            },
            texture: {
                instanceof: pc.Texture
            },
            textureatlas: {
                instanceof: pc.TextureAtlas
            },
            model: {
                instanceof: pc.Model
            },
            animation: {
                instanceof: pc.Animation
            },
            font: {
                instanceof: pc.Font
            },
            audio: {
                instanceof: pc.Audio
            }
        };

        // the bundle asset
        this.bundleAsset = new pc.Asset('bundle asset', 'bundle', {
            url: 'base/tests/test-assets/bundles/bundle.tar.gz'
        }, {
            assets: this.assets.map(function (asset) {
                return asset.id;
            })
        });
    });

    afterEach(function () {
        pc.platform.workers = this._workers;
        this.app.destroy();
    });

    it('should load bundle asset', function (done) {
        expect(pc.platform.workers).to.equal(true);

        var self = this;
        self.app.assets.add(this.bundleAsset);
        self.assets.forEach(function (asset) {
            self.app.assets.add(asset);
        });

        self.app.assets.load(this.bundleAsset);

        self.app.assets.on('load:' + self.bundleAsset.id, function () {
            expect(self.bundleAsset.resource instanceof pc.Bundle).to.equal(true);
            self.assets.forEach(function (asset) {
                expect(self.bundleAsset.resource.hasBlobUrl(asset.file.url)).to.equal(true);
            });
            done();
        });
    });

    it('should load bundle asset without using web workers', function (done) {
        pc.platform.workers = false;

        var self = this;
        self.app.assets.add(this.bundleAsset);
        self.assets.forEach(function (asset) {
            self.app.assets.add(asset);
        });

        self.app.assets.load(this.bundleAsset);

        self.app.assets.on('load:' + self.bundleAsset.id, function () {
            expect(self.bundleAsset.resource instanceof pc.Bundle).to.equal(true);
            self.assets.forEach(function (asset) {
                expect(self.bundleAsset.resource.hasBlobUrl(asset.file.url)).to.equal(true);
            });
            done();
        });
    });

    it('should load assets from bundle', function (done) {
        expect(pc.platform.workers).to.equal(true);

        var self = this;
        var todo = 0;

        self.app.assets.add(this.bundleAsset);
        self.app.assets.load(this.bundleAsset);
        todo++;

        self.assets.forEach(function (asset) {
            self.app.assets.add(asset);
            self.app.assets.load(asset);
            todo++;
        });

        self.app.assets.on('load', function () {
            todo--;
            if (todo === 0) {
                self.assets.forEach(function (asset, index) {
                    expect(asset.resource).to.not.equal(null);
                    var expected = self.expectedTypes[asset.type];

                    if (expected.typeof) {
                        expect(typeof asset.resource).to.equal(expected.typeof);
                    }

                    if (expected.instanceof) {
                        expect(asset.resource instanceof expected.instanceof).to.equal(true);
                    }

                    if (asset.type === 'font') {
                        expect(asset.resource.textures.length).to.equal(2);
                    }
                });
                done();
            }
        });
    });

    it('should load assets from bundle without using web workers', function (done) {
        pc.platform.workers = false;

        var self = this;
        var todo = 0;

        self.app.assets.add(this.bundleAsset);
        self.app.assets.load(this.bundleAsset);
        todo++;

        self.assets.forEach(function (asset) {
            self.app.assets.add(asset);
            self.app.assets.load(asset);
            todo++;
        });

        self.app.assets.on('load', function () {
            todo--;
            if (todo === 0) {
                self.assets.forEach(function (asset, index) {
                    expect(asset.resource).to.not.equal(null);
                    var expected = self.expectedTypes[asset.type];

                    if (expected.typeof) {
                        expect(typeof asset.resource).to.equal(expected.typeof);
                    }

                    if (expected.instanceof) {
                        expect(asset.resource instanceof expected.instanceof).to.equal(true);
                    }

                    if (asset.type === 'font') {
                        expect(asset.resource.textures.length).to.equal(2);
                    }
                });
                done();
            }
        });
    });

    it('should fail loading assets if the bundle has not started loading', function (done) {
        this.app.assets.add(this.bundleAsset);

        this.app.assets.on('error:' + this.assets[0].id, function (err) {
            done();
        });
        this.app.assets.add(this.assets[0]);
        this.app.assets.load(this.assets[0]);
    });
});
