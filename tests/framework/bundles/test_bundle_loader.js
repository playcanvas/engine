describe('Test Bundle Loader', function () {
    beforeEach(function () {
        // create app
        this.app = new pc.Application(document.createElement('canvas'));

        // create assets in the bundle
        // (To add more files just untar bundles.tar.gz, add your file and then tar it again using
        // "tar czf bundle.tar.gz files")
        this.assets = [
            new pc.Asset('css', 'css', {
                filename: 'css.css',
                url: 'base/tests/test-assets/bundles/css.css'
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
            // new pc.Asset('cubemap', 'cubemap', {
            //     filename: 'cubemap.dds',
            //     url: 'files/cubemap/cubemap.dds'
            // }),
            new pc.Asset('container', 'container', {
                filename: 'container.glb',
                url: 'files/container/container.glb'
            }),
            new pc.Asset('texture', 'texture', {
                filename: 'texture.jpg',
                url: 'files/texture/texture.jpg'
            }),
            new pc.Asset('atlas', 'textureatlas', {
                filename: 'texture.jpg',
                url: 'files/textureatlas/texture.jpg'
            }),
            new pc.Asset('animation', 'animation', {
                filename: 'animation.json',
                url: 'files/animation/animation.json'
            }),
            new pc.Asset('template', 'template', {
                filename: 'template.json',
                url: 'files/template/template.json'
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
            template: {
                instanceof: pc.Template
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
            render: {
                instanceof: pc.Render
            },
            container: {
                instanceof: pc.Container
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
            url: 'base/tests/test-assets/bundles/bundle.tar',
            size: 133632
        }, {
            assets: this.assets.map(function (asset) {
                return asset.id;
            })
        });
    });

    afterEach(function () {
        this.app.destroy();
    });

    it('should load bundle asset and its assets', function (done) {
        this.app.assets.add(this.bundleAsset);
        this.assets.forEach((asset) => {
            this.app.assets.add(asset);
        });

        this.app.assets.load(this.bundleAsset);

        this.app.assets.on('load:' + this.bundleAsset.id, () => {
            expect(this.bundleAsset.resource instanceof pc.Bundle).to.equal(true);
            this.assets.forEach((asset) => {
                const url = (this.app.assets.prefix || '') + asset.file.url;
                expect(this.bundleAsset.resource.has(url)).to.equal(true);
            });
            done();
        });
    });

    it('should load assets from bundle', function (done) {
        const self = this;
        let loaded = 0;

        this.app.assets.add(this.bundleAsset);
        this.assets.forEach((asset) => {
            this.app.assets.add(asset);
        });

        this.app.assets.load(this.bundleAsset);

        const onLoad = function() {
            loaded++;
            var resource = this.type === 'cubemap' ? this.resources[1] : this.resource;
            expect(resource).to.not.equal(null);
            var expected = self.expectedTypes[this.type];

            if (expected.typeof) {
                expect(typeof resource).to.equal(expected.typeof);
            }

            if (expected.instanceof) {
                expect(resource instanceof expected.instanceof).to.equal(true);
            }

            if (this.type === 'font') {
                expect(resource.textures.length).to.equal(2);
            }

            if ((self.assets.length + 1) === loaded) {
                done();
            }
        };

        this.assets.forEach((asset, index) => {
            asset.on('load', onLoad);
        });
        this.bundleAsset.on('load', onLoad);
    });

    it('asset should load if bundle with that asset has loaded', function(done) {
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        expect(this.assets[0].loading).to.equal(false);
        this.app.assets.load(this.bundleAsset);
        expect(this.assets[0].loading).to.equal(true);

        this.assets[0].ready(() => {
            done();
        });
    });

    it('bundle should load if asset from it has loaded', function(done) {
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        expect(this.bundleAsset.loading).to.equal(false);
        this.app.assets.load(this.assets[0]);
        expect(this.bundleAsset.loading).to.equal(true);

        this.bundleAsset.ready(() => {
            done();
        });
    });

    it('bundle should load if asset from it has loaded', function(done) {
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        expect(this.bundleAsset.loading).to.equal(false);
        this.app.assets.load(this.assets[0]);
        expect(this.bundleAsset.loading).to.equal(true);

        this.bundleAsset.ready(() => {
            done();
        });
    });

    it('asset loading with bundlesIgnore option should not load bundle', function(done) {
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        let filterCalled = false;

        expect(this.bundleAsset.loading).to.equal(false);
        this.app.assets.load(this.assets[0], {
            bundlesIgnore: true,
            bundlesFilter: (bundles) => {
                filterCalled = true;
            }
        });
        expect(filterCalled).to.equal(false);
        expect(this.bundleAsset.loading).to.equal(false);

        this.assets[0].ready(() => {
            done();
        });
    });

    it('asset loading should prefer smallest bundle', function(done) {
        const bundleAsset2 = new pc.Asset('bundle asset 2', 'bundle', {
            url: 'base/tests/test-assets/bundles/bundle.tar',
            size: 133632 + 1
        }, {
            assets: this.assets.map(function (asset) {
                return asset.id;
            })
        });

        this.app.assets.add(bundleAsset2);
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        expect(this.bundleAsset.loading).to.equal(false);
        this.app.assets.load(this.assets[0]);
        expect(this.bundleAsset.loading).to.equal(true);
        expect(bundleAsset2.loading).to.equal(false);

        this.assets[0].ready(() => {
            done();
        });
    });

    it('asset loading with bundlesFilter', function(done) {
        const bundleAsset2 = new pc.Asset('bundle asset 2', 'bundle', {
            url: 'base/tests/test-assets/bundles/bundle.tar',
            size: 133632 + 1
        }, {
            assets: this.assets.map(function (asset) {
                return asset.id;
            })
        });

        this.app.assets.add(bundleAsset2);
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);

        let filterCalled = false;

        expect(bundleAsset2.loading).to.equal(false);

        this.app.assets.load(this.assets[0], {
            bundlesFilter: (bundles) => {
                filterCalled = true;
                expect(bundles.length).to.equal(2);

                if (bundles[0].name === 'bundle asset 2') {
                    return bundles[0];
                } else {
                    return bundles[1];
                }
            }
        });
        expect(filterCalled).to.equal(true);
        expect(bundleAsset2.loading).to.equal(true);
        expect(this.bundleAsset.loading).to.equal(false);

        this.assets[0].ready(() => {
            done();
        });
    });

    it('loadUrl() calls callback if bundle loaded', function (done) {
        this.app.assets.add(this.bundleAsset);
        this.app.assets.add(this.assets[0]);
        this.app.assets.load(this.bundleAsset);

        this.app.assets.bundles.loadUrl(this.assets[0].file.url, function (err, dataView) {
            expect(err).to.equal(null);
            expect(dataView instanceof DataView).to.equal(true);
            done();
        });
    });
});
