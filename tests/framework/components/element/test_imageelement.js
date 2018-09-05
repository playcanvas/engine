describe('pc.ImageElement', function () {
    var app;
    var assets;

    beforeEach(function (done) {
        app = new pc.Application(document.createElement("canvas"));
        console.log("before")
        loadAssets(function () {
            done();
        });
    });

    afterEach(function () {
        app.destroy();
    });

    var loadAssets = function (cb) {
        // listen for asset load events and fire cb() when all assets are loaded
        var count = 0;
        app.assets.on('load', function (asset) {
            count++;
            if (count === assetsToLoad.length) {
                cb();
            }
        });

        app.assets.prefix = '../../';

        // list of assets to load
        var assetsToLoad = [
            new pc.Asset('red-atlas', 'textureatlas', {
                url: 'base/tests/test-assets/sprite/red-atlas.json'
            }),
            new pc.Asset('red-sprite', 'sprite', {
                url: 'base/tests/test-assets/sprite/red-sprite.json'
            }),
            new pc.Asset('red-texture', 'texture', {
                url: 'base/tests/test-assets/sprite/red-atlas.png'
            }),
            new pc.Asset('red-material', 'material', {
                url: 'base/tests/test-assets/sprite/red-material.json'
            })
        ];

        // add and load assets
        for (var i = 0; i < assetsToLoad.length; i++) {
            app.assets.add(assetsToLoad[i]);
            app.assets.load(assetsToLoad[i]);
        }

        // convenient access to assets by type
        assets = {
            textureatlas: assetsToLoad[0],
            sprite: assetsToLoad[1],
            texture: assetsToLoad[2],
            material: assetsToLoad[3]
        };
    }

    it('Add Image Element', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        expect(e.element.type).to.equal('image');
    });

    it('Add / Remove Image Element', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.removeComponent('element');

        expect(!e.element).to.exist;
    });

    it('Destroy Sprite Image Element', function () {
        var e = new pc.Entity();

        // patch
        var destroyed = false;
        var _onSpriteAssetLoaded = pc.ImageElement.prototype._onSpriteAssetLoaded;
        pc.ImageElement.prototype._onSpriteAssetLoaded = function () {
            if (destroyed) {
                ok(false, "_onSpriteAssetLoaded called after Element is destroyed");
            } else {
                _onSpriteAssetLoaded.apply(this, arguments);
            }
        };

        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.destroy();
        destroyed = true;

        expect(!e.element).to.exist;
    });

    it('Destroy Texture Image Element', function (done) {
        // patch
        var destroyed = false;
        var _onTextureLoad = pc.ImageElement.prototype._onTextureLoad;
        pc.ImageElement.prototype._onTextureLoad = function () {
            if (destroyed) {
                fail("_onTextureLoad called after Element is destroyed");
                done();
            } else {
                _onTextureLoad.apply(this, arguments);
            }
        };


        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });

        e.destroy();
        destroyed = true;

        assets.texture.unload();
        app.assets.load(assets.texture);

        assets.texture.once('load', function () {
            expect(!e.element).to.exist;
            done();
        });
    });

    it('Destroy Material Image Element', function (done) {
        // patch
        var destroyed = false;
        var _onMaterialLoad = pc.ImageElement.prototype._onMaterialLoad;
        pc.ImageElement.prototype._onMaterialLoad = function () {
            if (destroyed) {
                fail(false, "_onMaterialLoad called after Element is destroyed");
                done();
            } else {
                _onMaterialLoad.apply(this, arguments);
            }
        };


        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            materialAsset: assets.material
        });

        e.destroy();
        destroyed = true;

        assets.material.unload();
        app.assets.load(assets.material);
        assets.material.once('load', function () {
            expect(!e.element).to.exist;
            done();
        });
    });


    it('Sprites assets unbound on destroy', function () {
        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.destroy();

        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;
    });

    it('Sprites assets unbound when reset', function () {
        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.element.spriteAsset = null;

        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;
    });


    it('Sprite resource unbound on destroy', function () {
        var atlas = assets.textureatlas;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        // var sprite = e.element.sprite;
        // ok(!e.element.sprite.hasEvent('add'));
        // ok(!e.element.sprite.hasEvent('load'));
        // ok(!e.element.sprite.hasEvent('remove'));

        expect(atlas.resource.hasEvent('set:texture')).to.equal(true);

        e.destroy();

        expect(atlas.resource.hasEvent('set:texture')).to.equal(false);

        // ok(!assets.sprite.hasEvent('add'));
        // ok(!assets.sprite.hasEvent('load'));
        // ok(!assets.sprite.hasEvent('remove'));
    });

    it('Image element defaults to white color and opacity 1', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        expect(e.element.color.r).to.equal(1);
        expect(e.element.color.g).to.equal(1);
        expect(e.element.color.b).to.equal(1);
        expect(e.element.opacity).to.equal(1);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.equal(1);
        expect(emissive[1]).to.equal(1);
        expect(emissive[2]).to.equal(1);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(1);
    });

    it('Image element initializes to color and opacity 1 specified in data', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.5, 0.6, 0.7],
            opacity: 0.1
        });

        expect(e.element.color.r).to.be.closeTo(0.5, 0.001);
        expect(e.element.color.g).to.be.closeTo(0.6, 0.001);
        expect(e.element.color.b).to.be.closeTo(0.7, 0.001);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.5, 0.001);
        expect(emissive[1]).to.be.closeTo(0.6, 0.001);
        expect(emissive[2]).to.be.closeTo(0.7, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.1, 0.001);
    });

    it('Image element color changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.element.color = new pc.Color(0, 0, 0);

        expect(e.element.color.r).to.equal(0);
        expect(e.element.color.g).to.equal(0);
        expect(e.element.color.b).to.equal(0);
        expect(e.element.opacity).to.equal(1);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.equal(0);
        expect(emissive[1]).to.equal(0);
        expect(emissive[2]).to.equal(0);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(1);
    });

    it('Image element opacity changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.element.opacity = 0;

        expect(e.element.opacity).to.equal(0);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(0);
    });

    it('Image element reverts back to the previous color, opacity and material if we clear its material', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4
        });

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Image element with mask reverts back to the previous color, opacity and material if we clear its material', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4,
            mask: true
        });

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Screenspace Image element reverts back to the previous color, opacity and material if we clear its material', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4
        });
        screen.addChild(e);

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Screenspace Image element with mask reverts back to the previous color, opacity and material if we clear its material', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4,
            mask: true
        });
        screen.addChild(e);

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

});
