import { expect } from 'chai';
import { spy } from 'sinon';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { Layer } from '../../../src/scene/layer.js';
import { WorldClustersDebug } from '../../../src/scene/lighting/world-clusters-debug.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('WorldClustersDebug', function () {
    let device;
    let debug;
    let scene;
    let clusters;

    beforeEach(function () {
        device = createGraphicsDevice({ id: 'clusters-debug-test' });
        debug = new WorldClustersDebug();
        scene = { device, defaultDrawLayer: new Layer(), drawLineArrays: spy() };
        clusters = {
            cells: new Vec3(1, 1, 1),
            _cells: new Vec3(1, 1, 1),
            _maxCellLightCount: 4,
            counts: new Int32Array([1]),
            lightsBuffer: { boundsMin: new Vec3(), boundsDelta: new Vec3(1, 1, 1) }
        };
    });

    afterEach(function () {
        debug.destroy();
        device.destroy();
    });

    it('reuses occupancy geometry and skips it when there are no occupied cells', function () {
        debug.render(clusters, scene);
        const instance = debug.meshInstance;
        expect(instance.mesh.primitive[0].count).to.equal(36);
        debug.render(clusters, scene);
        expect(debug.meshInstance).to.equal(instance);
        clusters.counts[0] = 0;
        debug.render(clusters, scene);
        const visible = [];
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        expect(visible).to.have.length(0);
        expect(scene.drawLineArrays.callCount).to.equal(3);
        clusters.counts[0] = 1;
        debug.render(clusters, scene);
        expect(debug.meshInstance).to.equal(instance);
    });

    it('submits once to its destination layer and discards output from skipped frames', function () {
        const visible = [];
        debug.render(clusters, scene);
        debug.onPreRenderLayer(new Layer(), visible);
        expect(visible).to.have.length(0);
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        expect(visible).to.deep.equal([debug.meshInstance]);

        visible.length = 0;
        debug.render(clusters, scene);
        debug.frameUpdate();
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        expect(visible).to.have.length(0);

        debug.render(clusters, scene);
        debug.destroy();
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        expect(visible).to.have.length(0);
    });

    it('releases mesh and material resources independently for each renderer', function () {
        const other = new WorldClustersDebug();
        debug.render(clusters, scene);
        other.render(clusters, scene);
        const first = debug.meshInstance;
        const second = other.meshInstance;
        const material = first.material;
        const vertexBuffer = spy(first.mesh.vertexBuffer, 'destroy');
        const indexBuffer = spy(first.mesh.indexBuffer[0], 'destroy');
        const destroyMaterial = spy(material, 'destroy');
        expect(first.mesh).not.to.equal(second.mesh);
        debug.destroy();
        expect(vertexBuffer.calledOnce).to.be.true;
        expect(indexBuffer.calledOnce).to.be.true;
        expect(destroyMaterial.calledOnce).to.be.true;
        expect(material.meshInstances.size).to.equal(0);
        other.render(clusters, scene);
        expect(other.meshInstance).to.equal(second);
        other.destroy();
    });

    it('releases the mesh even if no occupied cells were rendered', function () {
        clusters.counts[0] = 0;
        debug.render(clusters, scene);
        const visible = [];
        debug.onPreRenderLayer(scene.defaultDrawLayer, visible);
        expect(visible).to.have.length(0);
        const destroyMesh = spy(debug.mesh, 'destroy');
        debug.destroy();
        expect(destroyMesh.calledOnce).to.be.true;
    });
});
