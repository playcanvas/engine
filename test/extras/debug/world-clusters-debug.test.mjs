import { expect } from 'chai';
import { spy } from 'sinon';

import { EventHandler } from '../../../src/core/event-handler.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { WorldClustersDebug } from '../../../src/extras/debug/world-clusters-debug.js';
import { Layer } from '../../../src/scene/layer.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('WorldClustersDebug', function () {
    let device;
    let app;
    let clusters;
    let debug;
    let layer;

    beforeEach(function () {
        device = createGraphicsDevice({ id: 'clusters-debug-test' });
        clusters = {
            cells: new Vec3(1, 1, 1),
            maxCellLightCount: 4,
            counts: new Int32Array([1]),
            lightsBuffer: { boundsMin: new Vec3(), boundsDelta: new Vec3(1, 1, 1) }
        };

        // minimal stand-in for the parts of the application the visualization uses
        app = new EventHandler();
        app.graphicsDevice = device;
        app.scene = { defaultDrawLayer: new Layer() };
        app.renderer = { worldClustersAllocator: { getClusters: () => clusters } };
        app.drawLineArrays = spy();

        layer = new Layer();
        debug = new WorldClustersDebug(app);
    });

    afterEach(function () {
        debug.destroy();
        device.destroy();
    });

    const update = () => app.fire('update', 0);
    const drawn = () => app.scene.defaultDrawLayer.meshInstances;

    it('renders nothing until a layer is set', function () {
        update();
        expect(app.drawLineArrays.called).to.be.false;
        expect(drawn()).to.have.length(0);
    });

    it('draws the grid and adds a single occupancy mesh instance to the draw layer', function () {
        debug.layer = layer;
        update();
        expect(app.drawLineArrays.calledOnce).to.be.true;
        expect(drawn()).to.have.length(1);

        const instance = drawn()[0];
        expect(instance.visible).to.be.true;
        expect(instance.mesh.primitive[0].count).to.equal(36);

        update();
        expect(drawn()).to.deep.equal([instance]);
    });

    it('hides the occupancy mesh when no cells are occupied or the clusters are unavailable', function () {
        debug.layer = layer;
        update();
        const instance = drawn()[0];

        clusters.counts[0] = 0;
        update();
        expect(instance.visible).to.be.false;

        clusters.counts[0] = 1;
        update();
        expect(instance.visible).to.be.true;

        app.renderer.worldClustersAllocator.getClusters = () => null;
        app.drawLineArrays.resetHistory();
        update();
        expect(instance.visible).to.be.false;
        expect(app.drawLineArrays.called).to.be.false;
    });

    it('hides the occupancy mesh when the layer is cleared', function () {
        debug.layer = layer;
        update();
        const instance = drawn()[0];

        debug.layer = null;
        expect(instance.visible).to.be.false;
        app.drawLineArrays.resetHistory();
        update();
        expect(app.drawLineArrays.called).to.be.false;
    });

    it('releases its resources and stops updating when destroyed', function () {
        debug.layer = layer;
        update();
        const instance = drawn()[0];
        const material = instance.material;
        const vertexBuffer = spy(instance.mesh.vertexBuffer, 'destroy');
        const indexBuffer = spy(instance.mesh.indexBuffer[0], 'destroy');
        const destroyMaterial = spy(material, 'destroy');

        debug.destroy();
        expect(drawn()).to.have.length(0);
        expect(vertexBuffer.calledOnce).to.be.true;
        expect(indexBuffer.calledOnce).to.be.true;
        expect(destroyMaterial.calledOnce).to.be.true;

        app.drawLineArrays.resetHistory();
        update();
        expect(app.drawLineArrays.called).to.be.false;
    });
});
