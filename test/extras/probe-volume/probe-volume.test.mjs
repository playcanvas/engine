import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { ProbeVolumeBaker } from '../../../src/extras/probe-volume/probe-volume-baker.js';
import { ProbeVolume } from '../../../src/extras/probe-volume/probe-volume.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('ProbeVolume', function () {

    let device;
    let volume;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 100, height: 100 });
        volume = new ProbeVolume(device, {
            aabb: new BoundingBox(new Vec3(0, 1, 0), new Vec3(2, 1, 2)),
            resolution: [2, 1, 2]
        });
    });

    afterEach(function () {
        volume.destroy();
        device.destroy();
    });

    // the spherical harmonics of all probes, set to a value
    const lighting = value => new Float32Array(volume.probeCount * 12).fill(value);

    // the weight of the probes the shaders read, 0 showing the ambient lighting of the environment
    const probeWeight = () => device.scope.resolve('probeVolumeBlend').value[1];

    describe('#hasData', function () {

        it('shows the ambient lighting of the environment until the probes are set', function () {
            expect(volume.hasData).to.be.false;
            expect(probeWeight()).to.equal(0);

            volume.setData(new Float32Array(volume.probeCount * 12).fill(0.5));
            expect(volume.hasData).to.be.true;
            expect(probeWeight()).to.equal(1);
        });

        it('shows the ambient lighting of the environment while disabled, with probes', function () {
            volume.setData(new Float32Array(volume.probeCount * 12).fill(0.5));
            volume.enabled = false;
            expect(probeWeight()).to.equal(0);

            volume.enabled = true;
            expect(probeWeight()).to.equal(1);
        });

        it('has the probes of a deserialized volume', function () {
            volume.setData(new Float32Array(volume.probeCount * 12).fill(0.5));
            const loaded = ProbeVolume.deserialize(device, volume.serialize());

            expect(loaded.hasData).to.be.true;
            expect(loaded.lightingCount).to.equal(1);
            expect(Array.from(loaded.getData())).to.deep.equal(Array.from(volume.getData()));
            loaded.destroy();
        });
    });

    describe('#setData', function () {

        it('adds a lighting at the index of the lighting count', function () {
            expect(volume.lightingCount).to.equal(1);
            volume.setData(lighting(0.25));
            volume.setData(lighting(0.75), 1);

            expect(volume.lightingCount).to.equal(2);
            expect(volume.getData(0)[0]).to.equal(0.25);
            expect(volume.getData(1)[0]).to.equal(0.75);
        });
    });

    describe('#activeLighting', function () {

        it('defaults to the first lighting, and switches to another one', function () {
            volume.setData(lighting(0.25));
            volume.setData(lighting(0.75), 1);
            expect(volume.activeLighting).to.equal(0);

            volume.activeLighting = 1;
            expect(volume.activeLighting).to.equal(1);
        });
    });

    describe('#serialize', function () {

        it('restores all lightings', function () {
            volume.setData(lighting(0.25));
            volume.setData(lighting(0.75), 1);
            const loaded = ProbeVolume.deserialize(device, volume.serialize());

            expect(loaded.lightingCount).to.equal(2);
            expect(loaded.activeLighting).to.equal(0);
            expect(Array.from(loaded.getData(0))).to.deep.equal(Array.from(volume.getData(0)));
            expect(Array.from(loaded.getData(1))).to.deep.equal(Array.from(volume.getData(1)));
            loaded.destroy();
        });
    });
});

describe('ProbeVolumeBaker', function () {

    describe('.isSupported', function () {

        it('cannot bake on the null device', function () {
            const device = createGraphicsDevice({ width: 100, height: 100 });
            if (!device.isNull) {
                device.destroy();
                this.skip();
            }
            expect(ProbeVolumeBaker.isSupported(device)).to.equal(false);
            device.destroy();
        });
    });
});
