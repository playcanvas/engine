QUnit.module("pc.Batcher", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
        this.bg = this.app.batcher.addGroup("Test Group", false, 100);

    },

    teardown: function () {
        this.app.destroy();
    }

    // loadAssets: function () {
    //     this.atlasAsset = new pc.Asset('red-atlas', 'textureatlas', {
    //         url: 'base/tests/test-assets/sprite/red-atlas.json'
    //     });

    //     this.spriteAsset = new pc.Asset('red-sprite', 'sprite', {
    //         url: 'base/tests/test-assets/sprite/red-sprite.json'
    //     });

    //     this.app.assets.add(this.atlasAsset);
    //     this.app.assets.add(this.spriteAsset);

    //     this.app.assets.load(this.atlasAsset);
    //     this.app.assets.load(this.spriteAsset);

    // }
});




test("generate: removes model component mesh instances from layer", function() {
    var e1 = new pc.Entity();
    e1.name = "e1";
    e1.addComponent("model", {
        type: "box",
        batchGroupId: this.bg.id
    });

    var e2 = new pc.Entity();
    e2.name = "e2";
    e2.addComponent("model", {
        type: "box",
        batchGroupId: this.bg.id
    });

    this.app.root.addChild(e1);
    this.app.root.addChild(e2);

    this.app.batcher.generate();

    var layer = this.app.scene.layers.getLayerById(pc.LAYERID_WORLD);
    var instances = layer.opaqueMeshInstances;

    ok(instances.length === 1, "Too many mesh instances in layer");
    ok(instances[0] !== e1.model.model.meshInstances[0], "e1 still references instance in layer");
    ok(instances[1] !== e2.model.model.meshInstances[0], "e2 still references instance in layer");
});

// test("generate: removes sprite component mesh instances from layer", function() {
//     var e1 = new pc.Entity();
//     e1.name = "e1";
//     e1.addComponent("sprite", {
//         spriteAsset: this.spriteAsset,
//         batchGroupId: this.bg.id
//     });

//     var e2 = new pc.Entity();
//     e2.name = "e2";
//     e2.addComponent("sprite", {
//         spriteAsset: this.spriteAsset,
//         batchGroupId: this.bg.id
//     });

//     this.app.root.addChild(e1);
//     this.app.root.addChild(e2);

//     this.app.batcher.generate();

//     var layer = this.app.scene.layers.getLayerById(pc.LAYERID_WORLD);
//     var instances = layer.opaqueMeshInstances;

//     ok(instances.length === 1, "Too many mesh instances in layer");
//     ok(instances[0] !== e1.model.model.meshInstances[0], "e1 still references instance in layer");
//     ok(instances[1] !== e2.model.model.meshInstances[0], "e2 still references instance in layer");
// });

test("disable model component, marks batch group dirty", function() {
    var e1 = new pc.Entity();
    e1.name = "e1";
    e1.addComponent("model", {
        type: "box",
        batchGroupId: this.bg.id
    });

    var e2 = new pc.Entity();
    e2.name = "e2";
    e2.addComponent("model", {
        type: "box",
        batchGroupId: this.bg.id
    });

    this.app.root.addChild(e1);
    this.app.root.addChild(e2);

    this.app.batcher.generate();

    var layer = this.app.scene.layers.getLayerById(pc.LAYERID_WORLD);

    var batch = this.app.batcher._batchList[0];

    var mi = batch.meshInstance;

    e2.enabled = false;

    strictEqual(this.app.batcher._dirtyGroups[0], this.bg.id);
});
