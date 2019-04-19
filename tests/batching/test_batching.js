describe('pc.Batcher', function () {
    beforeEach(function () {
        this.app = new pc.Application(document.createElement("canvas"));

        this.bg = this.app.batcher.addGroup("Test Group", false, 100);

    });

    afterEach(function () {
        this.app.destroy();
    });

    it("generate: removes model component mesh instances from layer", function() {
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

        expect(instances.length).to.equal(1); // "Too many mesh instances in layer");
        expect(instances[0]).not.to.equal(e1.model.model.meshInstances[0]); //"e1 still references instance in layer");
        expect(instances[1]).not.to.equal(e2.model.model.meshInstances[0]); // "e2 still references instance in layer");
    });

    // it("generate: removes sprite component mesh instances from layer", function() {
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

    it("disable model component, marks batch group dirty", function() {
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

        expect(this.app.batcher._dirtyGroups[0]).to.equal(this.bg.id);
    });


    it("batch with all invisible meshinstances works", function () {
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


        e1.model.model.meshInstances[0].visible = false;
        e2.model.model.meshInstances[0].visible = false;

        this.app.root.addChild(e1);
        this.app.root.addChild(e2);

        this.app.batcher.generate();

        var layer = this.app.scene.layers.getLayerById(pc.LAYERID_WORLD);

        expect(this.app.batcher._batchList.length).to.equal(0);

    })
})

