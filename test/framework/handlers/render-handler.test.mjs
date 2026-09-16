import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { ResourceLoader } from '../../../src/framework/handlers/loader.js';
import { RenderHandler } from '../../../src/framework/handlers/render.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { Render } from '../../../src/scene/render.js';

describe('RenderHandler', function () {
    let registry;
    let loader;
    let requests;

    beforeEach(function () {
        const app = {};
        loader = new ResourceLoader(app);
        registry = app.assets = new AssetRegistry(loader);
        requests = new Map();
        loader.addHandler('render', new RenderHandler(app));
        // Control dependency completion while exercising the real registry and loader lifecycle.
        loader.addHandler('container', {
            load(url, callback, asset) {
                requests.set(asset, callback);
            },
            open(url, data) {
                return data;
            }
        });
    });

    afterEach(function () {
        restore();
    });

    function createContainer(add = true) {
        const asset = new Asset('container', 'container', { url: '' });
        if (add) registry.add(asset);
        return asset;
    }

    function createRender(container, index = 0) {
        const asset = new Asset('render', 'render', null, {
            containerAsset: container.id,
            renderIndex: index
        });
        registry.add(asset);
        return asset;
    }

    function createResource() {
        const render = new Render();
        render.meshes = [new Mesh({})];
        return { renders: [{ resource: render }] };
    }

    it('delays ready and all load events until meshes are available', function () {
        const container = createContainer();
        const asset = createRender(container);
        const resource = createResource();
        const meshes = resource.renders[0].resource.meshes;
        const readyBefore = spy();
        const readyDuring = spy();
        const loaded = spy((loadedAsset) => {
            expect(loadedAsset.loaded).to.equal(true);
            expect(loadedAsset.loading).to.equal(false);
            expect(loadedAsset.resource.meshes).to.equal(meshes);
        });
        asset.ready(readyBefore);
        asset.on('load', loaded);
        registry.on(`load:${asset.id}`, loaded);
        registry.on('load', (loadedAsset) => {
            if (loadedAsset === asset) loaded(loadedAsset);
        });

        registry.load(asset);
        asset.ready(readyDuring);
        registry.load(asset);
        expect(asset.loading).to.equal(true);
        expect(asset.loaded).to.equal(false);
        expect(asset.resource).to.equal(undefined);
        expect(readyBefore.called).to.equal(false);
        expect(readyDuring.called).to.equal(false);
        expect(loaded.called).to.equal(false);

        requests.get(container)(null, resource);
        expect(readyBefore.calledOnceWithExactly(asset)).to.equal(true);
        expect(readyDuring.calledOnceWithExactly(asset)).to.equal(true);
        expect(loaded.callCount).to.equal(3);
        expect(asset.resource).not.to.equal(resource.renders[0].resource);
        expect(meshes[0].refCount).to.equal(2);

        const readyAfter = spy();
        asset.ready(readyAfter);
        expect(readyAfter.calledOnceWithExactly(asset)).to.equal(true);
    });

    it('loads immediately when the container already has a resource', function () {
        const container = createContainer();
        container.resource = createResource();
        container.loaded = true;
        const asset = createRender(container);
        const ready = spy();
        asset.ready(ready);

        registry.load(asset);

        expect(ready.calledOnce).to.equal(true);
        expect(asset.resource.meshes).to.equal(container.resource.renders[0].resource.meshes);
        expect(requests.size).to.equal(0);
    });

    it('waits for a container to be added to the registry', function () {
        const warn = stub(Debug, 'warnOnce');
        const container = createContainer(false);
        const asset = createRender(container);
        const ready = spy();
        asset.ready(ready);
        registry.load(asset);
        expect(ready.called).to.equal(false);
        expect(warn.calledOnce).to.equal(true);
        expect(warn.firstCall.args[0]).to.include(`'${asset.name}' (${asset.id})`);
        expect(warn.firstCall.args[0]).to.include(`container asset ${container.id}, which is not registered yet`);

        registry.add(container);
        expect(ready.called).to.equal(false);
        requests.get(container)(null, createResource());
        expect(ready.calledOnce).to.equal(true);
        expect(registry.hasEvent(`add:${container.id}`)).to.equal(false);
    });

    it('completes without render data when the optional asset is omitted', function () {
        const loaded = spy();
        loader.getHandler('render').load(null, loaded);

        expect(loaded.calledOnceWithExactly(null, null)).to.equal(true);
    });

    it('loads multiple render assets from one pending container', function () {
        const container = createContainer();
        const first = createRender(container);
        const second = createRender(container);
        const resource = createResource();
        const load = spy(loader.getHandler('container'), 'load');
        registry.load(first);
        registry.load(second);

        requests.get(container)(null, resource);

        expect(load.calledOnce).to.equal(true);
        expect(first.resource.meshes).to.equal(second.resource.meshes);
        expect(first.resource).not.to.equal(second.resource);
        expect(first.resource.meshes[0].refCount).to.equal(3);
        first.unload();
        expect(second.resource.meshes[0].refCount).to.equal(2);
    });

    it('propagates container failures without firing ready', function () {
        const container = createContainer();
        const asset = createRender(container);
        const ready = spy();
        const error = spy();
        const registryError = spy();
        asset.ready(ready);
        asset.on('error', error);
        registry.on(`error:${asset.id}`, registryError);
        registry.load(asset);

        requests.get(container)('container failed');

        expect(ready.called).to.equal(false);
        expect(error.calledOnceWith('container failed', asset)).to.equal(true);
        expect(registryError.calledOnceWith('container failed', asset)).to.equal(true);
        expect(asset.loading).to.equal(false);
        expect(asset.resource).to.equal(undefined);
        expect(container.hasEvent('load')).to.equal(false);
        expect(container.hasEvent('error')).to.equal(false);
    });

    it('reports an already failed container instead of waiting indefinitely', function () {
        const container = createContainer();
        container.loaded = true;
        const asset = createRender(container);
        const error = spy();
        asset.on('error', error);
        registry.load(asset);

        expect(error.calledOnce).to.equal(true);
        expect(error.firstCall.args[0]).to.include('has no resource');
        expect(asset.loading).to.equal(false);
    });

    it('reports an invalid render index instead of succeeding with an empty resource', function () {
        const container = createContainer();
        const asset = createRender(container, 10);
        const ready = spy();
        const error = spy();
        asset.ready(ready);
        asset.on('error', error);
        registry.load(asset);
        requests.get(container)(null, createResource());

        expect(ready.called).to.equal(false);
        expect(error.calledOnce).to.equal(true);
        expect(error.firstCall.args[0]).to.include('Render 10 is unavailable');
    });

    it('reports removal of a pending container', function () {
        const container = createContainer();
        const asset = createRender(container);
        const ready = spy();
        const error = spy();
        asset.ready(ready);
        asset.on('error', error);
        registry.load(asset);
        registry.remove(container);
        requests.get(container)(null, createResource());

        expect(ready.called).to.equal(false);
        expect(error.calledOnce).to.equal(true);
        expect(asset.loading).to.equal(false);
    });

    it('cancels pending render loads on unload and permits loading again', function () {
        const container = createContainer();
        const asset = createRender(container);
        const ready = spy();
        asset.ready(ready);
        registry.load(asset);
        asset.unload();
        expect(asset.loading).to.equal(false);
        expect(container.hasEvent('load')).to.equal(false);

        requests.get(container)(null, createResource());
        expect(ready.called).to.equal(false);
        expect(asset.resource).to.equal(undefined);

        registry.load(asset);
        expect(ready.calledOnce).to.equal(true);
        expect(asset.resource.meshes).to.equal(container.resource.renders[0].resource.meshes);
    });

    it('cancels pending render loads on removal', function () {
        const container = createContainer();
        const asset = createRender(container);
        const ready = spy();
        asset.ready(ready);
        registry.load(asset);
        registry.remove(asset);
        requests.get(container)(null, createResource());

        expect(ready.called).to.equal(false);
        expect(asset.loading).to.equal(false);
        expect(asset.resource).to.equal(undefined);
    });

    it('ignores completion when an earlier container load listener unloads the render', function () {
        const container = createContainer();
        const asset = createRender(container);
        const ready = spy();
        asset.ready(ready);
        container.on('load', () => asset.unload());
        registry.load(asset);
        requests.get(container)(null, createResource());

        expect(ready.called).to.equal(false);
        expect(asset.loaded).to.equal(false);
        expect(asset.loading).to.equal(false);
        expect(asset.resource).to.equal(undefined);
    });

    it('detaches late-registration listeners when unloaded', function () {
        const container = createContainer(false);
        const asset = createRender(container);
        registry.load(asset);
        asset.unload();
        registry.add(container);

        expect(registry.hasEvent(`add:${container.id}`)).to.equal(false);
        expect(requests.size).to.equal(0);
    });

    it('follows a changed container reference during loading', function () {
        const first = createContainer();
        const second = createContainer();
        const asset = createRender(first);
        const ready = spy();
        asset.ready(ready);
        registry.load(asset);
        asset.data = { containerAsset: second.id, renderIndex: 0 };

        requests.get(first)(null, createResource());
        expect(ready.called).to.equal(false);
        requests.get(second)(null, createResource());
        expect(ready.calledOnce).to.equal(true);
        expect(asset.resource.meshes).to.equal(second.resource.renders[0].resource.meshes);
    });

    it('completes a forced pending load only once', function () {
        const container = createContainer();
        const asset = createRender(container);
        const loaded = spy();
        asset.on('load', loaded);
        registry.load(asset);
        registry.load(asset, { force: true });
        requests.get(container)(null, createResource());

        expect(loaded.calledOnce).to.equal(true);
        expect(asset.resource.meshes[0].refCount).to.equal(2);
    });

    it('updates meshes on container reload without firing another render load', function () {
        const container = createContainer();
        const asset = createRender(container);
        const loaded = spy();
        asset.on('load', loaded);
        registry.load(asset);
        requests.get(container)(null, createResource());
        const render = asset.resource;
        const previousMesh = render.meshes[0];
        const changed = spy();
        render.on('set:meshes', changed);

        container.reload();
        requests.get(container)(null, createResource());

        expect(asset.resource).to.equal(render);
        expect(render.meshes).to.equal(container.resource.renders[0].resource.meshes);
        expect(changed.calledOnce).to.equal(true);
        expect(loaded.calledOnce).to.equal(true);
        expect(previousMesh.refCount).to.equal(1);
        expect(render.meshes[0].refCount).to.equal(2);
    });

    it('rebinds loaded assets when their container reference changes', function () {
        const first = createContainer();
        const second = createContainer();
        const asset = createRender(first);
        registry.load(asset);
        requests.get(first)(null, createResource());
        asset.data = { containerAsset: second.id, renderIndex: 0 };
        requests.get(second)(null, createResource());

        registry.remove(first);
        expect(asset.resource.meshes).to.equal(second.resource.renders[0].resource.meshes);
        registry.remove(second);
        expect(asset.resource.meshes).to.equal(null);
    });

    it('detaches reload listeners when a loaded render is unloaded', function () {
        const container = createContainer();
        const asset = createRender(container);
        registry.load(asset);
        requests.get(container)(null, createResource());
        const mesh = asset.resource.meshes[0];
        asset.unload();

        expect(mesh.refCount).to.equal(1);
        expect(registry.hasEvent(`load:${container.id}`)).to.equal(false);
        expect(registry.hasEvent(`remove:${container.id}`)).to.equal(false);
    });

    it('ignores stale reload callbacks when an earlier listener changes the dependency', function () {
        const first = createContainer();
        const second = createContainer();
        second.loaded = true;
        second.resource = createResource();
        const asset = createRender(first);
        registry.load(asset);
        registry.on(`load:${first.id}`, () => {
            if (asset.loaded) asset.data = { containerAsset: second.id, renderIndex: 0 };
        });
        requests.get(first)(null, createResource());

        first.reload();
        requests.get(first)(null, createResource());

        expect(asset.resource.meshes).to.equal(second.resource.renders[0].resource.meshes);
    });

    it('preserves synchronous loading for renders without a container', function () {
        const asset = new Asset('standalone', 'render');
        registry.add(asset);
        const ready = spy();
        asset.ready(ready);
        registry.load(asset);

        expect(ready.calledOnce).to.equal(true);
        expect(asset.resource).to.be.instanceOf(Render);
        expect(asset.resource.meshes).to.equal(null);
    });
});
