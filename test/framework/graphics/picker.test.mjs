import { expect } from 'chai';

import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Picker } from '../../../src/framework/graphics/picker.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../../src/scene/constants.js';

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

describe('Picker world point reconstruction', function () {

    const WIDTH = 200;
    const HEIGHT = 100;

    // an orthographic camera spanning x [-100, 100] and y [-50, 50], so an NDC coordinate maps to
    // world space by a simple scale and the expected position can be written by hand
    const createPicker = () => {
        const picker = Object.create(Picker.prototype);
        picker.width = WIDTH;
        picker.height = HEIGHT;
        picker.renderPass = {
            camera: {
                camera: {
                    projectionMatrix: new Mat4().setOrtho(-100, 100, -50, 50, 0, 10),
                    viewMatrix: new Mat4()
                },
                nearClip: 0,
                farClip: 10,
                projection: PROJECTION_ORTHOGRAPHIC
            }
        };
        picker.getPointDepthAsync = () => Promise.resolve(0.5);
        return picker;
    };

    it('reconstructs the position at the center of the picked pixel', async function () {
        const picker = createPicker();

        // pixel (12, 10) has its center at (12.5, 10.5), which is NDC (-0.875, 0.79)
        const expected = new Vec3(-87.5, 39.5, -5);

        // every coordinate inside that pixel, including the integer one on its edge, reports the
        // position of the center
        const points = await Promise.all(
            [[12, 10], [12.5, 10.5], [12.9, 10.1]].map(([x, y]) => picker.getWorldPointAsync(x, y))
        );
        points.forEach((point) => {
            expect(point.distance(expected)).to.be.closeTo(0, 1e-5);
        });
    });

    it('reconstructs the position of the pixel a coordinate outside the buffer reads', async function () {
        const picker = createPicker();

        // the depth read is clamped to the buffer, so the position is that of the edge pixel
        const point = await picker.getWorldPointAsync(-5, HEIGHT + 5);
        expect(point.distance(new Vec3(-99.5, -49.5, -5))).to.be.closeTo(0, 1e-5);
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
