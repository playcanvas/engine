import { expect } from 'chai';
import { spy } from 'sinon';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { LIGHTTYPE_OMNI, MASK_AFFECT_DYNAMIC } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { Light } from '../../../src/scene/light.js';
import { WorldClusters } from '../../../src/scene/lighting/world-clusters.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('WorldClusters', function () {
    let device;
    let clusters;
    let light;

    const createLight = () => {
        const l = new Light(device, true);
        l.type = LIGHTTYPE_OMNI;
        l.enabled = true;
        l.mask = MASK_AFFECT_DYNAMIC;
        l.intensity = 1;
        l.attenuationEnd = 2;
        l._node = new GraphNode();
        l.visibleThisFrame = true;
        return l;
    };

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        clusters = new WorldClusters(device);
        light = null;
    });

    afterEach(function () {
        light?.destroy();
        clusters.destroy();
        device.destroy();
    });

    describe('#update', function () {

        it('uploads the textures once while there are no lights', function () {
            const upload = spy(clusters, 'uploadTextures');

            clusters.update([]);
            clusters.update([]);
            clusters.update([]);

            expect(upload.callCount).to.equal(1);
            expect(clusters.clusters.every(index => index === 0)).to.be.true;
        });

        it('uploads the textures every frame with lights, and once more when they are gone', function () {
            const upload = spy(clusters, 'uploadTextures');
            light = createLight();

            clusters.update([light]);
            clusters.update([light]);
            expect(upload.callCount).to.equal(2);
            expect(clusters.clusters.some(index => index !== 0)).to.be.true;

            // the frame the light goes, the texture is cleared and uploaded, after that it is kept
            clusters.update([]);
            expect(upload.callCount).to.equal(3);
            expect(clusters.clusters.every(index => index === 0)).to.be.true;

            clusters.update([]);
            expect(upload.callCount).to.equal(3);

            // a light coming back is uploaded again
            clusters.update([light]);
            expect(upload.callCount).to.equal(4);
        });

        it('uploads an empty cluster texture again after it is recreated', function () {
            const upload = spy(clusters, 'uploadTextures');

            clusters.update([]);
            expect(upload.callCount).to.equal(1);
            const texture = clusters.clusterTexture;

            // a different cell count creates a new cluster texture, which has not been uploaded yet
            clusters.cells = new Vec3(2, 2, 2);
            clusters.update([]);
            expect(clusters.clusterTexture).to.not.equal(texture);
            expect(upload.callCount).to.equal(2);

            clusters.update([]);
            expect(upload.callCount).to.equal(2);
        });
    });
});
