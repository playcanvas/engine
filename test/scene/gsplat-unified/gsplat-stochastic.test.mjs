import { expect } from 'chai';
import sinon from 'sinon';

import {
    BLEND_NONE, BLEND_PREMULTIPLIED,
    DITHER_BAYER8, DITHER_BLUENOISE, DITHER_IGNNOISE, DITHER_NONE
} from '../../../src/scene/constants.js';
import { GSplatHybridRenderer } from '../../../src/scene/gsplat-unified/gsplat-hybrid-renderer.js';
import { GSplatManager } from '../../../src/scene/gsplat-unified/gsplat-manager.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';

// Exercise the real view pipeline without a GPU. Projection and indirect argument generation
// must still run when sorting is bypassed, and picking must retain its sorted depth semantics.
describe('GSplat stochastic rendering', function () {
    const pipeline = () => {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        Object.assign(renderer, {
            _ensureGpuPipeline: sinon.spy(),
            computeDistanceRange: sinon.stub().returns({ minDist: 0, maxDist: 10 }),
            fisheyeProj: { enabled: false },
            gpuSorter: {
                radixBits: 4,
                prepareIndirect: sinon.stub().returns([1, 1, 1, 1]),
                sortIndirect: sinon.stub().returns({ sorted: true })
            },
            projector: {
                dispatch: sinon.spy(),
                writeIndirectArgs: sinon.spy(),
                sortKeys: { stableIds: true }
            },
            intervalCompaction: {
                uploadIntervals() {},
                dispatchCompact() {},
                writeIndirectArgs: sinon.spy(),
                compactedSplatIds: {},
                sortElementCountBuffer: {},
                numSplatsBuffer: {}
            },
            device: {
                submit: sinon.spy(),
                getIndirectDrawSlot: sinon.stub().returns(0),
                getIndirectDispatchSlot: sinon.stub().returns(0)
            },
            indirectDrawSlot: 0,
            indirectDispatchSlot: 0
        });
        return renderer;
    };

    const render = (renderer, stochastic, pickMode = false) => renderer.sortAndProjectForCamera(
        { hasBounds: false, workBuffer: { frustumCuller: {} } },
        { totalActiveSplats: 1000, totalIntervals: 1 },
        {}, 960, 540, 1 / 255, pickMode, false,
        { stochastic, radialSorting: true, minPixelSize: 0, varyings: { words: 0 } }
    );

    it('projects and draws compacted splats without any radix sort', function () {
        const renderer = pipeline();
        expect(render(renderer, true)).to.equal(renderer.projector.sortKeys);
        expect(renderer.gpuSorter.sortIndirect.called).to.equal(false);
        expect(renderer.gpuSorter.prepareIndirect.called).to.equal(false);
        expect(renderer._ensureGpuPipeline.calledWith(false)).to.equal(true);
        expect(renderer.device.getIndirectDispatchSlot.calledWith(1)).to.equal(true);
        expect(Array.from(renderer.projector.writeIndirectArgs.firstCall.args[4])).to.deep.equal([0, 0, 0, 0]);
        expect(renderer.computeDistanceRange.called).to.equal(false);
        expect(renderer.projector.dispatch.firstCall.args[0].stochastic).to.equal(true);
        expect(renderer.projector.writeIndirectArgs.calledOnce).to.equal(true);
    });

    it('renders with no sorter allocated', function () {
        const renderer = pipeline();
        renderer.gpuSorter = null;
        renderer._ensureGpuPipeline = GSplatHybridRenderer.prototype._ensureGpuPipeline;
        expect(render(renderer, true)).to.equal(renderer.projector.sortKeys);
        expect(renderer.gpuSorter).to.equal(null);
        expect(renderer.device.getIndirectDispatchSlot.calledWith(1)).to.equal(true);
    });

    it('creates the sorter only when needed and retains it across mode changes', function () {
        const renderer = pipeline();
        renderer.gpuSorter = null;
        renderer._ensureGpuPipeline = GSplatHybridRenderer.prototype._ensureGpuPipeline;
        Object.assign(renderer.device, {
            supportsCompute: true,
            scope: { resolve: () => ({}) },
            createBindGroupFormatImpl: () => ({ destroy() {} })
        });
        renderer._ensureGpuPipeline(false);
        expect(renderer.gpuSorter).to.equal(null);
        renderer._ensureGpuPipeline(true);
        const sorter = renderer.gpuSorter;
        expect(sorter).to.not.equal(null);
        renderer._ensureGpuPipeline(false);
        renderer._ensureGpuPipeline(true);
        expect(renderer.gpuSorter).to.equal(sorter);
        sorter.destroy();
    });

    it('sorts normal rendering and picking even when stochastic is requested', function () {
        for (const [stochastic, pickMode] of [[false, false], [true, true]]) {
            const renderer = pipeline();
            expect(render(renderer, stochastic, pickMode)).to.deep.equal({ sorted: true });
            expect(renderer.gpuSorter.sortIndirect.calledOnce).to.equal(true);
            expect(renderer._ensureGpuPipeline.calledWith(true)).to.equal(true);
            expect(renderer.device.getIndirectDispatchSlot.calledWith(2)).to.equal(true);
            expect(renderer.projector.dispatch.firstCall.args[0].stochastic).to.equal(false);
            expect(renderer.device.submit.called).to.equal(pickMode);
        }
    });

    it('sorts picking even without a per-splat ID stream', function () {
        const renderer = pipeline();
        renderer.prepareForPicking = sinon.stub().returns({ picked: true });
        const manager = Object.create(GSplatManager.prototype);
        manager._pickParams = {};
        manager._writeGsplatParams = p => Object.assign(p, {
            stochastic: true,
            alphaClip: 0.3,
            alphaClipForward: 1 / 255,
            minPixelSize: 0,
            varyings: { words: 0 }
        });
        const params = manager._fillPickParams({ node: {} }, 960, 540);
        renderer.preparePickingView(
            { hasBounds: false, workBuffer: { frustumCuller: {}, format: { getStream: () => null } } },
            { totalActiveSplats: 1000, totalIntervals: 1 },
            params
        );
        expect(renderer.gpuSorter.sortIndirect.calledOnce).to.equal(true);
        expect(renderer.projector.dispatch.firstCall.args[0].stochastic).to.equal(false);
    });

    it('switches depth writes, blend state and shader defines together', function () {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        renderer._material = new ShaderMaterial();
        renderer._updateIdDefines = () => {};
        renderer.dither = DITHER_BLUENOISE;
        for (const stochastic of [false, true, false]) {
            renderer.stochastic = stochastic;
            renderer.configureMaterial();
            expect(renderer.material.depthWrite).to.equal(stochastic);
            expect(renderer.material.blendType).to.equal(stochastic ? BLEND_NONE : BLEND_PREMULTIPLIED);
            expect(renderer.material.defines.has('DITHER_NONE')).to.equal(!stochastic);
            expect(renderer.material.defines.get('STD_OPACITY_DITHER')).to.equal(stochastic ? 'BLUENOISE' : undefined);
        }
        renderer._material.destroy();
    });

    // opacityDitherPS only declares a noise source for a mode it recognizes, so an unusable mode
    // has to resolve to a real one rather than reaching the shader and failing to compile.
    it('selects the dither noise source from the scene dither mode', function () {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        renderer._material = new ShaderMaterial();
        renderer._updateIdDefines = () => {};
        renderer.stochastic = true;
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (...args) => warnings.push(args.join(' '));
        try {
            for (const [mode, expected, warns] of [
                [DITHER_BAYER8, 'BAYER8', false],
                [DITHER_IGNNOISE, 'IGNNOISE', false],
                [DITHER_BLUENOISE, 'BLUENOISE', false],
                [DITHER_NONE, 'BLUENOISE', true],
                ['nonsense', 'BLUENOISE', true]
            ]) {
                warnings.length = 0;
                renderer.dither = mode;
                renderer.configureMaterial();
                expect(renderer.material.defines.get('STD_OPACITY_DITHER')).to.equal(expected);
                expect(warnings.length > 0).to.equal(warns);
            }
        } finally {
            console.warn = originalWarn;
        }
        renderer._material.destroy();
    });

    it('follows a mid-session dither mode change', function () {
        const renderer = Object.create(GSplatHybridRenderer.prototype);
        Object.assign(renderer, {
            _material: new ShaderMaterial(),
            _updateIdDefines: () => {},
            stochastic: true,
            dither: DITHER_BLUENOISE,
            configureMaterial: sinon.spy(GSplatHybridRenderer.prototype.configureMaterial),
            setStereo: () => {},
            sortAndProjectForCamera: sinon.stub().returns(null),
            device: { width: 960, height: 540 }
        });
        const cameraNode = { camera: { camera: { xrActive: false }, renderTarget: null, rect: { z: 1, w: 1 } } };
        const view = dither => renderer.prepareRenderView({}, {}, { cameraNode, stochastic: true, dither });
        view(DITHER_BLUENOISE);
        expect(renderer.configureMaterial.called).to.equal(false);
        view(DITHER_BAYER8);
        expect(renderer.configureMaterial.calledOnce).to.equal(true);
        expect(renderer.material.defines.get('STD_OPACITY_DITHER')).to.equal('BAYER8');
        view(DITHER_BAYER8);
        expect(renderer.configureMaterial.calledOnce).to.equal(true);
        renderer._material.destroy();
    });
});
