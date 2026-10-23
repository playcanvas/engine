import { expect } from 'chai';

import { getCanvasNavigatorGpu } from '../../../../src/platform/graphics/webgpu/navigator-gpu.js';

describe('getCanvasNavigatorGpu', function () {
    let windowDescriptor;

    beforeEach(function () {
        windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    });

    afterEach(function () {
        if (windowDescriptor) {
            Object.defineProperty(globalThis, 'window', windowDescriptor);
        } else {
            delete globalThis.window;
        }
    });

    it('returns the GPU from the canvas window', function () {
        const gpu = {};
        const canvas = { ownerDocument: { defaultView: { navigator: { gpu } } } };

        expect(getCanvasNavigatorGpu(canvas)).to.equal(gpu);
    });

    it('does not use the current window when WebGPU is unavailable in the canvas window', function () {
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { navigator: { gpu: {} } }
        });
        const canvas = { ownerDocument: { defaultView: { navigator: {} } } };

        expect(getCanvasNavigatorGpu(canvas)).to.equal(undefined);
    });

    it('uses the current window when the canvas has no window', function () {
        const gpu = {};
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { navigator: { gpu } }
        });
        const canvas = { ownerDocument: { defaultView: null } };

        expect(getCanvasNavigatorGpu(canvas)).to.equal(gpu);
    });
});
