import { expect } from 'chai';

import { PIXELFORMAT_R8 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSplatSogResource } from '../../../src/scene/gsplat/gsplat-sog-resource.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import { GSplatWorkBuffer } from '../../../src/scene/gsplat-unified/gsplat-work-buffer.js';

describe('GSplatParams#compensation', function () {
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 1, height: 1 });
    });

    afterEach(function () {
        device.destroy();
    });

    it('defaults to on and adds the plateau stream only on request', function () {
        const params = new GSplatParams(device);
        expect(params.compensation).to.equal(true);
        expect(params.format.getStream('splatPlateau')).to.equal(undefined);

        params._enableOverUnity(true);
        expect(params.format.getStream('splatPlateau')?.format).to.equal(PIXELFORMAT_R8);
    });

    it('removes the stream when switched off and does not re-add it while off', function () {
        const params = new GSplatParams(device);
        params._enableOverUnity(true);
        const version = params._compensationVersion;

        params.compensation = false;
        expect(params.format.getStream('splatPlateau')).to.equal(undefined);
        expect(params._compensationVersion).to.equal(version + 1);

        params._enableOverUnity(true);
        expect(params.format.getStream('splatPlateau')).to.equal(undefined);

        params.compensation = true;
        params._enableOverUnity(true);
        expect(params.format.getStream('splatPlateau')).to.not.equal(undefined);
    });
});

describe('GSplatSogResource#hasOverUnity', function () {
    const resource = meta => Object.assign(Object.create(GSplatSogResource.prototype), { gsplatData: { meta } });

    it('is true only for v3 data whose opacity codebook exceeds 1', function () {
        expect(resource({ version: 3, opacity: { codebook: [0, 0.5, 1, 2.5] } }).hasOverUnity).to.equal(true);
        expect(resource({ version: 3, opacity: { codebook: [0, 0.5, 1] } }).hasOverUnity).to.equal(false);
        expect(resource({ version: 2 }).hasOverUnity).to.equal(false);
    });
});

describe('GSplatWorkBuffer#syncWithFormat', function () {
    it('attaches a stream added after creation even if getTexture() synced the streams first', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const params = new GSplatParams(device);
        const workBuffer = new GSplatWorkBuffer(device, params.format);
        const before = workBuffer.renderTarget._colorBuffers.length;

        params._enableOverUnity(true);
        // a renderer binding textures by name syncs the streams on its own
        const texture = workBuffer.getTexture('splatPlateau');
        expect(texture).to.not.equal(undefined);

        workBuffer.syncWithFormat();
        expect(workBuffer.renderTarget._colorBuffers.length).to.equal(before + 1);
        expect(workBuffer.renderTarget._colorBuffers).to.include(texture);

        workBuffer.destroy();
        device.destroy();
    });
});
