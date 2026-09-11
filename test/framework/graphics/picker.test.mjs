import { expect } from 'chai';

import { Picker } from '../../../src/framework/graphics/picker.js';

describe('Picker readback cancellation', function () {
    for (const [method, empty] of [['getSelectionAsync', []], ['getPointDepthAsync', null]]) {
        it(`${method} returns no selection when a WebGL fence fails during native context loss`, async function () {
            const picker = {
                deviceValid: true,
                device: { isContextLost: () => true },
                renderTarget: { colorBuffer: {} },
                depthBuffer: {},
                _readTexture: () => Promise.reject(new Error('webgl clientWaitSync sync failed'))
            };
            expect(await Picker.prototype[method].call(picker, 0, 0)).to.deep.equal(empty);
        });

        for (const name of ['AbortError', 'OperationError']) {
            it(`${method} ${name === 'AbortError' ? 'returns no selection for cancellation' : 'propagates unexpected failures'} before device loss is reported`, async function () {
                const error = new DOMException('Mapping failed', name);
                const picker = {
                    deviceValid: true,
                    device: { isContextLost: () => false },
                    renderTarget: { colorBuffer: {} },
                    depthBuffer: {},
                    _readTexture: () => Promise.reject(error)
                };
                let result;
                let rejection;
                try {
                    result = await Picker.prototype[method].call(picker, 0, 0);
                } catch (error) {
                    rejection = error;
                }
                if (name === 'AbortError') {
                    expect(rejection).to.equal(undefined);
                    expect(result).to.deep.equal(empty);
                } else {
                    expect(rejection).to.equal(error);
                }
            });
        }
    }
});
