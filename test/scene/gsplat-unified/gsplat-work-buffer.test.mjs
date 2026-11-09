import { expect } from 'chai';

import { PIXELFORMAT_R8 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import { GSplatWorkBuffer } from '../../../src/scene/gsplat-unified/gsplat-work-buffer.js';

describe('GSplatWorkBuffer#syncWithFormat', function () {
    let device;
    let workBuffer;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 1, height: 1 });
    });

    afterEach(function () {
        workBuffer?.destroy();
        workBuffer = null;
        device.destroy();
    });

    it('attaches a stream added after creation', function () {
        const params = new GSplatParams(device);
        workBuffer = new GSplatWorkBuffer(device, params.format);
        const before = workBuffer.renderTarget.colorBufferCount;

        params.format.addExtraStreams([{ name: 'testStream', format: PIXELFORMAT_R8 }]);
        workBuffer.syncWithFormat();

        expect(workBuffer.renderTarget.colorBufferCount).to.equal(before + 1);
        expect(workBuffer.renderTarget.getColorBuffer(before)).to.equal(workBuffer.getTexture('testStream'));
    });

    it('attaches a stream added after creation even if getTexture() synced the streams first', function () {
        const params = new GSplatParams(device);
        workBuffer = new GSplatWorkBuffer(device, params.format);
        const before = workBuffer.renderTarget.colorBufferCount;

        params.format.addExtraStreams([{ name: 'testStream', format: PIXELFORMAT_R8 }]);

        // a renderer binding textures by name syncs the streams on its own
        const texture = workBuffer.getTexture('testStream');
        expect(texture).to.not.equal(undefined);

        workBuffer.syncWithFormat();
        expect(workBuffer.renderTarget.colorBufferCount).to.equal(before + 1);
        expect(workBuffer.renderTarget.getColorBuffer(before)).to.equal(texture);
    });
});
