describe('pc.ImageElement', function () {
    var app;
    var assets;
    var sandbox;

    var loadAssets = function (cb) {
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

        // listen for asset load events and fire cb() when all assets are loaded
        var count = 0;
        app.assets.on('load', function (asset) {
            count++;
            if (count === assetsToLoad.length) {
                cb();
            }
        });

        app.assets.prefix = '../../';

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

    beforeEach(function (done) {
        sandbox = sinon.createSandbox();
        app = new pc.Application(document.createElement("canvas"));
        loadAssets(function () {
            done();
        });
    });

    afterEach(function () {
        sandbox.restore();
        app.destroy();
    });

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

    it('Image element calls _updateMesh once when rect changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.rect = [1, 1, 1, 1];
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if rect is the same', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.rect = [0, 0, 1, 1];
        e.element.rect = new pc.Vec4(0, 0, 1, 1);
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element calls _updateMesh if only rect passed in data', function () {
        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');

        var rect = [1, 1, 1, 1];

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            rect: rect
        });
        app.root.addChild(e);

        expect(spy.calledTwice).to.equal(true);

        expect(e.element._image._uvs).to.deep.equal([
            rect[0],
            rect[1],
            rect[0] + rect[2],
            rect[1],
            rect[0] + rect[2],
            rect[1] + rect[3],
            rect[0],
            rect[1] + rect[3]
        ]);
    });

    it('Image element calls _updateMesh once at the start and once at the end when all properties that call it are passed into the data', function () {
        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');

        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: [1, 2]
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            rect: [1, 1, 1, 1],
            spriteFrame: 1,
            sprite: sprite
        });
        app.root.addChild(e);

        expect(spy.calledTwice).to.equal(true);

        expect(e.element.sprite).to.equal(sprite);
        expect(e.element.spriteFrame).to.equal(1);
        expect(e.element.rect.x).to.equal(1);
        expect(e.element.rect.y).to.equal(1);
        expect(e.element.rect.z).to.equal(1);
        expect(e.element.rect.w).to.equal(1);
    });

    it('Image element calls _updateMesh once when sprite changes', function () {

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if sprite is the same', function () {
        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.sprite = sprite;
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element calls _updateMesh once when spriteFrame changes', function () {

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteFrame: 1,
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            })
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.spriteFrame = 0;
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if spriteFrame is the same', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.spriteFrame = 1;
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 2
        });
        app.root.addChild(e);

        expect(e.element.spriteFrame).to.equal(1);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite when a different sprite is assigned', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);
        expect(e.element.spriteFrame).to.equal(1);

        e.element.sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: [1]
        });
        expect(e.element.spriteFrame).to.equal(0);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite when the frame keys of the sprite change', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [0, 1],
                atlas: atlas
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);
        expect(e.element.spriteFrame).to.equal(1);

        e.element.sprite.frameKeys = [0];
        expect(e.element.spriteFrame).to.equal(0);
    });

    it('Image element calls _updateMesh when its sprite is 9-sliced and the sprite\'s PPU changes', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: atlas,
            frameKeys: [0, 1],
            pixelsPerUnit: 1,
            renderMode: pc.SPRITE_RENDERMODE_SLICED
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite,
            spriteFrame: 0
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        sprite.pixelsPerUnit = 2;
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element calls _updateMesh once when its sprite is not 9-sliced and the sprite\'s PPU changes', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: atlas,
            frameKeys: [0, 1],
            pixelsPerUnit: 1,
            renderMode: pc.SPRITE_RENDERMODE_SIMPLE
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite,
            spriteFrame: 0
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        sprite.pixelsPerUnit = 2;
        expect(spy.calledOnce).to.equal(true);
    });

});
