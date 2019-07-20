
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
        expect(reg instanceof pc.AssetRegistry).to.equal(true);
    });

    it('add() adds asset', function () {
        this.assets.add(this.asset);

        var assets = this.assets.list();

        expect(assets.length).to.equal(1);
        expect(assets[0].name).to.equal(this.asset.name);
    });

    it('get() retrieves asset by id', function () {
        this.assets.add(this.asset);

        var asset = this.assets.get(this.asset.id);

        expect(asset).to.equal(this.asset);
    });

    it('getByUrl() retrieves asset by url', function () {
        this.assets.add(this.asset);

        var asset = this.assets.getByUrl(this.asset.file.url);

        expect(asset).to.equal(this.asset);
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

        expect(assets[0]).to.equal(asset1);
        expect(assets[1]).to.equal(asset2);
        expect(assets[2]).to.equal(asset3);
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

        expect(this.assets.get(asset1.id)).to.equal(asset1);
        expect(this.assets.get(asset2.id)).to.equal(undefined);
        expect(this.assets.get(asset3.id)).to.equal(asset3);

        expect(this.assets.findAll(asset1.name)[0]).to.equal(asset1);
        expect(this.assets.findAll(asset2.name).length).to.equal(0);
        expect(this.assets.findAll(asset3.name)[0]).to.equal(asset3);

        expect(assets[0].id).to.equal(asset1.id);
        expect(assets[1].id).to.equal(asset3.id);
    });

    it('getByUrl works after removing asset', function () {
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

        this.assets.remove(asset1);

        expect(this.assets.getByUrl(asset1.file.url)).to.equal(undefined);
        expect(this.assets.getByUrl(asset2.file.url)).to.equal(asset2);
        expect(this.assets.getByUrl(asset3.file.url)).to.equal(asset3);
    });


    it('find() works after removing asset', function () {
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

        this.assets.remove(asset1);

        expect(this.assets.find(asset1.name)).to.equal(undefined);
        expect(this.assets.find(asset2.name)).to.equal(asset2);
        expect(this.assets.find(asset3.name)).to.equal(asset3);
    });
});

