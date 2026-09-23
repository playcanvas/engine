import { expect } from 'chai';
import { spy } from 'sinon';

import { Renderer } from '../../../src/scene/renderer/renderer.js';
import { Scene } from '../../../src/scene/scene.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('Renderer destruction', function () {
    let device;
    let scene;
    let renderer;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        scene = new Scene(device);
        renderer = new Renderer(device, scene);
    });

    afterEach(function () {
        renderer?.destroy();
        scene.destroy();
        device.destroy();
    });

    it('releases the empty and shared layer cluster textures before device destruction', function () {
        const allocator = renderer.worldClustersAllocator;
        const empty = allocator.empty;
        const layer = {
            hasClusteredLights: true,
            meshInstances: [{}],
            getLightIdHash: () => 1,
            clusteredLightsSet: new Set()
        };
        const steps = [{ layer }, { layer }];

        // mirror a frame: recycle, request a cluster per step (deduped by light hash), then upload
        allocator.reset();
        allocator.request(steps[0]);
        allocator.request(steps[1]);
        allocator.upload(scene.lighting);

        expect(steps[0].lightClusters).to.equal(steps[1].lightClusters);
        expect(allocator.count).to.equal(1);

        const textures = [empty, steps[0].lightClusters].flatMap(cluster => [
            cluster.lightsBuffer.lightsTexture, cluster.clusterTexture
        ]);
        const destroys = textures.map(texture => spy(texture.impl, 'destroy'));

        const destroyedRenderer = renderer;
        renderer.destroy();
        renderer = null;

        for (let i = 0; i < textures.length; i++) {
            expect(destroys[i].calledOnceWithExactly(device)).to.be.true;
            expect(textures[i].device).to.be.null;
        }
        expect(destroyedRenderer.worldClustersAllocator).to.be.null;
        expect(allocator._empty).to.be.null;
        expect(allocator.count).to.equal(0);
        expect(allocator._clusters.size).to.equal(0);
        expect(device._destroyed).not.to.be.true;
    });

    it('keeps a cluster owned by the allocator across reset, so destroying after reset does not leak it', function () {
        const allocator = renderer.worldClustersAllocator;
        const layer = {
            hasClusteredLights: true,
            meshInstances: [{}],
            getLightIdHash: () => 1,
            clusteredLightsSet: new Set()
        };

        // a frame: request a cluster and upload it
        allocator.reset();
        allocator.request({ layer });
        allocator.upload(scene.lighting);
        expect(allocator.count).to.equal(1);

        const cluster = allocator._allocated[0];
        const textures = [cluster.lightsBuffer.lightsTexture, cluster.clusterTexture];
        const destroys = textures.map(texture => spy(texture.impl, 'destroy'));

        // the next frame begins (reset) but is torn down before it uploads; the previous frame's
        // cluster must still be owned by the allocator and released on destroy
        allocator.reset();
        renderer.destroy();
        renderer = null;

        for (let i = 0; i < textures.length; i++) {
            expect(destroys[i].calledOnceWithExactly(device)).to.be.true;
            expect(textures[i].device).to.be.null;
        }
    });

    it('can destroy a renderer before any clusters are allocated', function () {
        const destroyedRenderer = renderer;
        renderer.destroy();
        renderer = null;
        expect(destroyedRenderer.worldClustersAllocator).to.be.null;
    });
});
