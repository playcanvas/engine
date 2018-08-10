
describe('pc.AssetRegistry', () => {
    beforeEach(function () {
        this.loader = sinon.fake();

        this.assets = new pc.AssetRegistry(this.loader);

        this.asset = new pc.Asset("Test Asset", 'text', {
            url: 'fake/url/file.txt'
        });
    });

    afterEach(function () {

    });


    it('should create a new pc.AssetRegistry', function () {
        var reg = new pc.AssetRegistry(this.loader);
        expect(reg instanceof pc.AssetRegistry).toBe(true);
    });

    it('add() adds asset', function () {
        this.assets.add(this.asset);

        var assets = this.assets.list();

        expect(assets.length).toBe(1);
        expect(assets[0].name).toBe(this.asset.name);
    });

    it('get() retrieves asset by id', function () {
        this.assets.add(this.asset);

        var asset = this.assets.get(this.asset.id);

        expect(asset).toBe(this.asset);
    });

    it('getByUrl() retrieves asset by url', function () {
        this.assets.add(this.asset);

        var asset = this.assets.getByUrl(this.asset.file.url);

        expect(asset).toBe(this.asset);
    });

    it('list() lists all assets', function () {
        var asset1 = new pc.Asset("Asset 1", "text", {
            url: "fake/one/file.txt"
        });
        var asset2 = new pc.Asset("Asset 2", "text", {
            url: "fake/two/file.txt"
        });
        var asset3 = new pc.Asset("Asset 3", "text", {
            url: "fake/three/file.txt"
        });

        this.assets.add(asset1);
        this.assets.add(asset2);
        this.assets.add(asset3);

        var assets = this.assets.list()

        expect(assets[0]).toBe(asset1);
        expect(assets[1]).toBe(asset2);
        expect(assets[2]).toBe(asset3);
    });


    it('remove() removes by id', function () {
        var asset1 = new pc.Asset("Asset 1", "text", {
            url: "fake/one/file.txt"
        });
        var asset2 = new pc.Asset("Asset 2", "text", {
            url: "fake/two/file.txt"
        });
        var asset3 = new pc.Asset("Asset 3", "text", {
            url: "fake/three/file.txt"
        });

        this.assets.add(asset1);
        this.assets.add(asset2);
        this.assets.add(asset3);

        this.assets.remove(asset2);

        var assets = this.assets.list()

        expect(this.assets.get(asset1.id)).toBe(asset1);
        expect(this.assets.get(asset2.id)).toBe(undefined);
        expect(this.assets.get(asset3.id)).toBe(asset3);

        expect(this.assets.findAll(asset1.name)[0]).toBe(asset1);
        expect(this.assets.findAll(asset2.name).length).toBe(0);
        expect(this.assets.findAll(asset3.name)[0]).toBe(asset3);

        expect(assets[0].id).toBe(asset1.id);
        expect(assets[1].id).toBe(asset3.id);
    });

});

