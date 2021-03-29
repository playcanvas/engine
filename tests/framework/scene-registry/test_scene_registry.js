describe("pc.SceneRegistry", function () {
    var app;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
        app.systems.add(new pc.DummyComponentSystem(app));
    });

    afterEach(function () {
        app.destroy();
    });

    it("new registry is empty", function () {
        var registry = new pc.SceneRegistry();

        expect(registry.list().length).to.equal(0);
    });

    it("add", function () {
        var registry = new pc.SceneRegistry();

        registry.add("New Scene", "/test.json");

        expect(registry.list().length).to.equal(1);
    });

    it("find", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene", "/test.json");

        var result = registry.find("New Scene");

        expect(result.name).to.equal("New Scene");
        expect(result.url).to.equal("/test.json");
    });

    it("remove", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene", "/test.json");

        registry.remove("New Scene");

        expect(registry.list().length).to.equal(0);
        expect(registry.find("New Scene")).to.equal(null);
    });

    it("add multiple", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene 1", "/test1.json");
        registry.add("New Scene 2", "/test2.json");
        registry.add("New Scene 3", "/test3.json");

        expect(registry.list().length).to.equal(3);
        expect(registry.list()[0].url).to.equal('/test1.json');
        expect(registry.list()[1].url).to.equal('/test2.json');
        expect(registry.list()[2].url).to.equal('/test3.json');

        expect(registry.find("New Scene 1").url).to.equal("/test1.json");
        expect(registry.find("New Scene 2").url).to.equal("/test2.json");
        expect(registry.find("New Scene 3").url).to.equal("/test3.json");
    });

    it("remove middle value", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene 1", "/test1.json");
        registry.add("New Scene 2", "/test2.json");
        registry.add("New Scene 3", "/test3.json");

        registry.remove("New Scene 2");

        expect(registry.list().length).to.equal(2);
        expect(registry.list()[0].url).to.equal('/test1.json');
        expect(registry.list()[1].url).to.equal('/test3.json');

        expect(registry.find("New Scene 1").url).to.equal("/test1.json");
        expect(registry.find("New Scene 3").url).to.equal("/test3.json");
    });

    it("url index", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene 1", "/test1.json");

        var result = registry.findByUrl('/test1.json');
        expect(result.name).to.equal("New Scene 1");
        expect(result.url).to.equal("/test1.json");

    });


    it("remove middle, url index", function () {
        var registry = new pc.SceneRegistry();
        registry.add("New Scene 1", "/test1.json");
        registry.add("New Scene 2", "/test2.json");
        registry.add("New Scene 3", "/test3.json");

        registry.remove("New Scene 2");

        expect(registry.findByUrl("/test1.json").name).to.equal("New Scene 1");
        expect(registry.findByUrl("/test2.json")).to.equal(null);
        expect(registry.findByUrl("/test3.json").name).to.equal("New Scene 3");
    });

    it("load and cache, check data is valid, unload data, check data is removed with SceneItem", function () {
        var registry = new pc.SceneRegistry(app);
        registry.add("New Scene 1", "/test1.json");

        var sceneItem = registry.find("New Scene 1");
        registry.loadSceneData(sceneItem, function (err, sceneItem) {
            expect(err).to.null;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);

            registry.unloadSceneData(sceneItem);
            expect(sceneItem.data).to.null;
            expect(sceneItem._loading).to.equal(false);

            done();
        });
    });

    it("load and cache, check data is valid, unload data, check data is removed with Urls", function () {
        var registry = new pc.SceneRegistry(app);
        registry.add("New Scene 1", "/test1.json");

        registry.loadSceneData("test1.json", function (err, sceneItem) {
            expect(err).to.null;
            expect(sceneItem.data).to.exist;
            expect(sceneItem._loading).to.equal(false);

            registry.unloadSceneData("test1.json");
            expect(sceneItem.data).to.null;
            expect(sceneItem._loading).to.equal(false);

            done();
        });
    });
});
