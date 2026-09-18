import { expect } from 'chai';

import { Picker } from '../../../src/framework/graphics/picker.js';

describe('Picker readback coordinates', function () {

    const WIDTH = 200;
    const HEIGHT = 100;

    // a picker with no graphics device behind it, just enough state for the readback paths
    const createPicker = (isWebGL2) => {
        const picker = Object.create(Picker.prototype);
        picker.device = { isWebGL2 };
        picker.renderTarget = { width: WIDTH, height: HEIGHT, colorBuffer: {} };
        picker.mapping = new Map();
        return picker;
    };

    // the rectangle the async path hands to the texture read, in the backend's own coordinate space
    const readRect = (picker, x, y, width, height) => {
        let rect;
        const texture = {
            read: (rx, ry, rwidth, rheight) => {
                rect = { x: rx, y: ry, width: rwidth, height: rheight };
                return Promise.resolve(new Uint8Array(4 * rwidth * rheight));
            }
        };
        picker._readTexture(texture, x, y, width, height, picker.renderTarget);
        return rect;
    };

    it('reads the pixel containing a fractional coordinate on WebGL2', function () {
        const picker = createPicker(true);

        // top-left row 10 is bottom-left row 89, and a fractional coordinate inside that pixel
        // must not land on a different row
        expect(readRect(picker, 12, 10, 1, 1)).to.deep.equal({ x: 12, y: 89, width: 1, height: 1 });
        expect(readRect(picker, 12.5, 10.25, 1, 1)).to.deep.equal({ x: 12, y: 89, width: 1, height: 1 });
    });

    it('clips a rectangle overhanging the bottom edge on WebGL2', function () {
        const picker = createPicker(true);

        // rows 95-104 are requested but only 95-99 exist, so 5 rows are read from the bottom of
        // the buffer rather than 10 rows shifted up to 90-99
        expect(readRect(picker, 0, 95, 1, 10)).to.deep.equal({ x: 0, y: 0, width: 1, height: 5 });
    });

    it('reads without flipping on WebGPU', function () {
        const picker = createPicker(false);

        expect(readRect(picker, 12.5, 10.25, 1, 1)).to.deep.equal({ x: 12, y: 10, width: 1, height: 1 });
    });

    it('getSelection reads the same rectangle as the async path', function () {
        const picker = createPicker(true);
        let rect;
        Object.assign(picker.device, {
            isWebGPU: false,
            setRenderTarget: () => {},
            updateBegin: () => {},
            updateEnd: () => {},
            readPixels: (x, y, width, height) => {
                rect = { x, y, width, height };
            }
        });

        picker.getSelection(12.5, 10.25, 1, 1);
        expect(rect).to.deep.equal({ x: 12, y: 89, width: 1, height: 1 });
    });
});

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
