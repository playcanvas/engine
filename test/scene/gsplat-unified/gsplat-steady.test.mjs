import { expect } from 'chai';
import sinon from 'sinon';

import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, PIXELFORMAT_RGBA16F } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import {
    GSPLAT_RENDERER_AUTO, GSPLAT_RENDERER_RASTER_CPU_SORT, GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_RENDERER_STEADY, PROJECTION_ORTHOGRAPHIC, LAYERID_WORLD, LAYERID_UI, GAMMA_NONE, GAMMA_SRGB, TONEMAP_NONE
} from '../../../src/scene/constants.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import { GSplatDirector } from '../../../src/scene/gsplat-unified/gsplat-director.js';
import { GSplatIntervalCompaction } from '../../../src/scene/gsplat-unified/gsplat-interval-compaction.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import { GSplatSteadyCompaction } from '../../../src/scene/gsplat-unified/gsplat-steady-compaction.js';
import { GSplatSteadyRenderer } from '../../../src/scene/gsplat-unified/gsplat-steady-renderer.js';
import { GSplatSteadyView } from '../../../src/scene/gsplat-unified/gsplat-steady-view.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GSplat SteadySplats settings', function () {
    let device;
    let params;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 64, height: 64 });
        params = new GSplatParams(device);
    });

    afterEach(function () {
        params.material.destroy();
        device.destroy();
    });

    it('keeps automatic renderer selection unchanged', function () {
        expect(params.renderer).to.equal(GSPLAT_RENDERER_AUTO);
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
        device.isWebGPU = true;
        params.renderer = GSPLAT_RENDERER_RASTER_GPU_SORT;
        params.renderer = GSPLAT_RENDERER_AUTO;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_GPU_SORT);
    });

    it('resolves the new mode on WebGPU and preserves the fallback on unsupported devices', function () {
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.renderer).to.equal(GSPLAT_RENDERER_STEADY);
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
        device.isWebGPU = true;
        params.renderer = GSPLAT_RENDERER_AUTO;
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_STEADY);
    });

    it('enables SteadySplats on WebGL2 with float targets and four history attachments', function () {
        device.isWebGL2 = true;
        device.maxColorAttachments = 4;
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_STEADY);
        params.renderer = GSPLAT_RENDERER_RASTER_GPU_SORT;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
    });

    it('uses sorted rendering when WebGL2 cannot allocate the required targets', function () {
        device.isWebGL2 = true;
        device.textureFloatRenderable = false;
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
        device.textureFloatRenderable = true;
        device.maxColorAttachments = 3;
        params.renderer = GSPLAT_RENDERER_AUTO;
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
    });

    it('invalidates history without changing sampling or renderer settings', function () {
        const version = params.historyVersion;
        params.resetHistory();
        params.resetHistory();
        expect(params.historyVersion).to.equal(version + 2);
        expect(params.steadyHistoryWeight).to.equal(0.7);
        expect(params.steadyConvergence).to.equal(true);
        expect(params.steadyConvergenceFrames).to.equal(16);
        expect(params.stochastic).to.equal(false);
        expect(params.renderer).to.equal(GSPLAT_RENDERER_AUTO);
    });
});

describe('GSplat SteadySplats view admission', function () {
    let app;
    let camera;
    let renderer;
    let material;
    let params;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        camera = new Entity('Camera');
        camera.addComponent('camera');
        app.root.addChild(camera);
        material = new ShaderMaterial();
        renderer = Object.create(GSplatSteadyRenderer.prototype);
        renderer._material = new ShaderMaterial();
        renderer._forwardRenderer = app.renderer;
        renderer._steadyView = new GSplatSteadyView(SHADERLANGUAGE_WGSL, app.renderer, []);
        params = { cameraNode: camera, material, varyings: { words: 0 }, fisheye: 0 };
    });

    afterEach(function () {
        renderer._material.destroy();
        material.destroy();
        app.destroy();
        jsdomTeardown();
    });

    it('admits a full perspective view with standard coverage', function () {
        expect(renderer.supportsView(params)).to.equal(true);
    });

    it('keeps unsupported projections on the existing pipeline', function () {
        camera.camera.projection = PROJECTION_ORTHOGRAPHIC;
        expect(renderer.supportsView(params)).to.equal(false);
        camera.camera.projection = 0;
        params.fisheye = 0.5;
        expect(renderer.supportsView(params)).to.equal(false);
        params.fisheye = 0;
        camera.camera.rect.z = 0.5;
        expect(renderer.supportsView(params)).to.equal(false);
    });

    [SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL].forEach((shaderLanguage) => {
        it(`supports off-axis perspective and rejects oblique depth on ${shaderLanguage}`, function () {
            const view = new GSplatSteadyView(shaderLanguage, app.renderer, []);
            const projection = camera.camera.camera.projectionMatrix.data;
            projection[8] = 0.2;
            projection[9] = -0.3;
            expect(view.supports(params)).to.equal(true);
            for (const index of [2, 6, 3, 7]) {
                projection[index] = 0.1;
                expect(view.supports(params)).to.equal(false);
                projection[index] = 0;
            }
        });
    });

    it('never evaluates a Gaussian PDF for custom fragment coverage', function () {
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('gsplatModifyPS', 'fn modifySplatColor() {}');
        expect(renderer.supportsView(params)).to.equal(false);
    });

    it('preserves output modifiers while rejecting unsupported render chunks', function () {
        const chunks = material.getShaderChunks(SHADERLANGUAGE_WGSL);
        chunks.set('gsplatOutputVS', 'fn prepareOutputFromGamma(c: vec3f, d: f32) -> vec3f { return c; }');
        expect(renderer.supportsView(params)).to.equal(true);
        chunks.set('opacityDitherPS', '');
        expect(renderer.supportsView(params)).to.equal(false);
        chunks.delete('opacityDitherPS');
        expect(renderer.supportsView(params)).to.equal(true);
    });

    it('preserves custom varying and overdraw behavior through sorted fallback', function () {
        params.varyings.words = 1;
        expect(renderer.supportsView(params)).to.equal(false);
        params.varyings.words = 0;
        params.overdraw = true;
        expect(renderer.supportsView(params)).to.equal(false);
    });

    it('uses sorted rendering when a mesh contributes opaque scene depth', function () {
        const box = new Entity('Opaque mesh');
        box.addComponent('render', { type: 'box' });
        app.root.addChild(box);
        expect(renderer.supportsView(params)).to.equal(false);
        box.enabled = false;
        expect(renderer.supportsView(params)).to.equal(true);
    });

    it('collects dependencies only for the matching camera and active managers', function () {
        const passA = {}, passB = {};
        const forwardPass = {};
        const prepare = sinon.stub().returns(true);
        const director = new GSplatDirector(null, null, null, null, null);
        director.camerasMap.set(camera.camera.camera, {
            layersMap: new Map([
                [1, { gsplatManager: { prepareRenderPass: prepare, renderer: { renderPasses: [passA, passB] } } }],
                [2, { gsplatManager: { prepareRenderPass: () => true, renderer: { renderPasses: null } } }],
                [3, { gsplatManager: { prepareRenderPass: () => false, renderer: { renderPasses: [{}] } } }],
                [4, { gsplatManager: null }]
            ])
        });
        const passes = [];
        director.collectRenderPasses({}, passes, forwardPass);
        expect(passes).to.deep.equal([]);
        expect(prepare.called).to.equal(false);
        director.collectRenderPasses(camera.camera.camera, passes, forwardPass);
        expect(prepare.calledOnceWithExactly(forwardPass)).to.equal(true);
        expect(passes).to.deep.equal([passA, passB]);
    });
});

describe('GSplat SteadySplats WebGPU rendering', function () {
    let app;
    let camera;
    let asset;
    let splat;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        if (!app.graphicsDevice.isWebGPU) this.skip();
        app.graphicsDevice.resizeCanvas(96, 64);
        camera = new Entity('Camera');
        camera.addComponent('camera', { nearClip: 0.1, farClip: 100 });
        camera.setPosition(0, 0, 3);
        camera.lookAt(0, 0, 0);
        app.root.addChild(camera);
        const values = {
            x: [0, 0.1, -0.1],
            y: [0, 0, 0],
            z: [0, -0.2, -0.4],
            rot_0: [1, 1, 1],
            rot_1: [0, 0, 0],
            rot_2: [0, 0, 0],
            rot_3: [0, 0, 0],
            scale_0: [-1, -1, -1],
            scale_1: [-1, -1, -1],
            scale_2: [-1, -1, -1],
            f_dc_0: [1, 0, -1],
            f_dc_1: [0, 1, 0],
            f_dc_2: [-1, 0, 1],
            opacity: [0, 0, 0]
        };
        const data = new GSplatData([{ name: 'vertex',
            count: 3,
            properties: Object.entries(values).map(([name, storage]) => ({
                name, type: 'float', byteSize: 4, storage: new Float32Array(storage)
            })) }]);
        asset = new Asset('Procedural splats', 'gsplat');
        asset.resource = new GSplatResource(app.graphicsDevice, data);
        asset.loaded = true;
        app.assets.add(asset);
        splat = new Entity('Splats');
        splat.addComponent('gsplat', { asset, unified: true });
        app.root.addChild(splat);
        app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
    });

    afterEach(function () {
        app?.destroy();
        jsdomTeardown();
        sinon.restore();
    });

    const getRenderer = () => {
        const cameraData = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        return Array.from(cameraData.layersMap.values())[0].gsplatManager.renderer;
    };

    const renderFrame = () => {
        app.fire('framerender');
        app.render();
    };

    it('draws through the engine frame graph without allocating a radix sorter', function () {
        renderFrame();
        const renderer = getRenderer();
        expect(renderer).to.be.instanceOf(GSplatSteadyRenderer);
        expect(renderer.gpuSorter).to.equal(null);
        expect(renderer.intervalCompaction).to.equal(null);
        expect(renderer._steadyCompaction).to.be.instanceOf(GSplatSteadyCompaction);
        expect(renderer.steadyPass.frame).to.equal(1);
        expect(renderer.steadyPass.valid).to.equal(true);
        renderFrame();
        expect(renderer.steadyPass.frame).to.equal(2);
    });

    it('keeps SteadySplats projection independent of sorted preparation', function () {
        renderFrame();
        const renderer = getRenderer();
        const sortedPreparation = sinon.spy(renderer, 'sortAndProjectForCamera');
        const projection = sinon.spy(renderer.projector, 'dispatch');
        renderer._projectionValid = false;
        renderFrame();
        expect(projection.calledOnce).to.equal(true);
        expect(sortedPreparation.called).to.equal(false);
        expect(renderer.intervalCompaction).to.equal(null);
        expect(renderer.gpuSorter).to.equal(null);
    });

    it('invalidates histories on explicit reset, resize and device recovery', function () {
        renderFrame();
        const renderer = getRenderer();
        app.scene.gsplat.resetHistory();
        renderFrame();
        expect(renderer.steadyPass.temporalCompute.getParameter('steadyValid')).to.equal(0);
        app.graphicsDevice.resizeCanvas(80, 56);
        renderFrame();
        expect(renderer.steadyPass.width).to.equal(80);
        expect(renderer.steadyPass.height).to.equal(56);
        expect(renderer.steadyPass.temporalCompute.getParameter('steadyValid')).to.equal(0);
        app.graphicsDevice.fire('devicelost');
        expect(renderer.steadyPass.valid).to.equal(false);
    });

    it('uses sorted fallback for custom coverage and restores resampling afterwards', function () {
        renderFrame();
        const renderer = getRenderer();
        const steadyCompaction = renderer._steadyCompaction;
        const chunks = app.scene.gsplat.material.getShaderChunks(SHADERLANGUAGE_WGSL);
        chunks.set('gsplatModifyPS', 'fn modifySplatColor(uv: vec2f, color: ptr<function, vec4f>) {}');
        app.scene.gsplat.material.update();
        renderFrame();
        expect(renderer.renderPasses).to.equal(null);
        expect(renderer.gpuSorter).to.not.equal(null);
        expect(renderer.intervalCompaction.constructor).to.equal(GSplatIntervalCompaction);
        expect(renderer.intervalCompaction).to.not.equal(steadyCompaction);
        const sortedCompaction = renderer.intervalCompaction;
        chunks.delete('gsplatModifyPS');
        app.scene.gsplat.material.update();
        renderFrame();
        expect(renderer.renderPasses).to.not.equal(null);
        expect(renderer._steadyCompaction).to.equal(steadyCompaction);
        expect(renderer.intervalCompaction).to.equal(sortedCompaction);
        renderer.invalidateCullUpload();
        expect(steadyCompaction._uploadedVersion).to.equal(-1);
        expect(sortedCompaction._uploadedVersion).to.equal(-1);
        renderFrame();
        expect(steadyCompaction._uploadedVersion).to.not.equal(-1);
        expect(sortedCompaction._uploadedVersion).to.equal(-1);
    });

    it('switches overdraw visualization to sorted rendering in the frame it is enabled', function () {
        renderFrame();
        const renderer = getRenderer();
        const frame = renderer.steadyPass.frame;
        const ramp = new Texture(app.graphicsDevice, { width: 2, height: 1, mipmaps: false });
        ramp.lock().fill(255);
        ramp.unlock();
        try {
            app.scene.gsplat.colorRamp = ramp;
            renderFrame();
            expect(renderer.renderPasses).to.equal(null);
            expect(renderer.gpuSorter).to.not.equal(null);
            expect(renderer.steadyPass.frame).to.equal(frame);
            app.scene.gsplat.colorRamp = null;
            renderFrame();
            expect(renderer.renderPasses).to.not.equal(null);
            expect(renderer.steadyPass.frame).to.equal(frame + 1);
        } finally {
            app.scene.gsplat.colorRamp = null;
            ramp.destroy();
        }
    });

    it('releases frame resources when switching back to automatic rendering', function () {
        renderFrame();
        const renderer = getRenderer();
        const pass = renderer.steadyPass;
        const compaction = renderer._steadyCompaction;
        app.scene.gsplat.renderer = GSPLAT_RENDERER_AUTO;
        renderFrame();
        expect(renderer.steadyPass).to.equal(null);
        expect(pass.textures).to.have.length(0);
        expect(pass.historyBuffers).to.have.length(0);
        expect(renderer._steadyCompaction).to.equal(null);
        expect(compaction.intervalsBuffer).to.equal(null);
    });

    it('produces visible samples and a finite resampled image on an executing GPU', async function () {
        // Dawn's null backend validates shaders and resources but does not execute the shader.
        if (process.env.PC_WEBGPU_BACKEND === 'null' || !process.env.PC_WEBGPU_BACKEND) this.skip();
        for (let i = 0; i < 8; i++) renderFrame();
        const pass = getRenderer().steadyPass;
        const samples = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
        const image = await pass.colors[1 - pass.writeIndex].read(0, 0, pass.width, pass.height, { immediate: true });
        expect(Array.from(samples).some((value, index) => index % 4 === 1 && value > 0)).to.equal(true);
        expect(Array.from(image).some(value => value > 0)).to.equal(true);
        expect(Array.from(image).some(value => (value & 0x7c00) === 0x7c00)).to.equal(false);
        expect(pass.temporalCompute.getParameter('steadyValid')).to.equal(1);
    });

    it('uses camera jitter to control fixed and animated samples independently of accumulation', async function () {
        if (process.env.PC_WEBGPU_BACKEND === 'null' || !process.env.PC_WEBGPU_BACKEND) this.skip();
        app.scene.gsplat.steadyHistoryWeight = 0;
        const ids = async () => {
            const pass = getRenderer().steadyPass;
            const samples = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
            return Array.from(samples).filter((value, index) => index % 2 === 0);
        };
        renderFrame();
        const renderer = getRenderer();
        const fixed = await ids();
        renderFrame();
        expect(await ids()).to.deep.equal(fixed);
        expect(renderer.sampleMaterial.getParameter('steadyFrame').data).to.equal(0);
        camera.camera.jitter = 1;
        renderFrame();
        const animated = await ids();
        expect(animated).to.not.deep.equal(fixed);
        renderFrame();
        expect(await ids()).to.not.deep.equal(animated);
        camera.camera.jitter = 0;
        renderFrame();
        expect(await ids()).to.deep.equal(fixed);
    });

    it('preserves full-quad coverage within raster precision when clipping rotated splats', async function () {
        if (process.env.PC_WEBGPU_BACKEND === 'null' || !process.env.PC_WEBGPU_BACKEND) this.skip();
        splat.setEulerAngles(0, 0, 37);
        splat.setLocalScale(1.5, 0.4, 1);
        splat.setPosition(0.35, 0.1, 0);
        camera.camera.jitter = 1;
        app.scene.gsplat.steadyHistoryWeight = 0;
        renderFrame();
        const renderer = getRenderer();
        const material = renderer.sampleMaterial;
        const original = material.shaderDesc;
        // Restore the full quad independently of the optimized corner calculation, retaining
        // the same projected data, output processing and STBN thresholds.
        const reference = {
            ...original,
            uniqueName: 'GSplatSteadyUnclipped',
            vertexWGSL: `${original.vertexWGSL.replace('@vertex\nfn vertexMain', 'fn clippedVertexMain')}
                @vertex
                fn vertexMain(input: VertexInput) -> VertexOutput {
                    var output = clippedVertexMain(input);
                    let index = pcInstanceIndex * {GSPLAT_INSTANCE_SIZE}u + u32(vertex_position.z);
                    if (index >= numSplatsStorage[0]) {
                        return output;
                    }
                    let base = index * uniform.steadyCacheStride;
                    let clip = steadyClip(index);
                    let a = unpack2x16float(projCache[base + 4u]);
                    let b = unpack2x16float(projCache[base + 5u]);
                    let offset = vertex_position.x * a + vertex_position.y * b;
                    output.position = clip + vec4f(offset * clip.w * uniform.viewport_size.zw, 0.0, 0.0);
                    output.steadyUV = vertex_position.xy;
                    return output;
                }
            `,
            // The reference uses the original acceptance test without early rejection.
            fragmentWGSL: `${original.fragmentWGSL.slice(0, original.fragmentWGSL.indexOf('@fragment'))}
                @fragment
                fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    let p = vec2u(input.position.xy);
                    let threshold = steadyThreshold(p);
                    let alpha = steadyAlphaFromUV(steadyOpacity, steadyUV);
                    if (alpha <= threshold) {
                        discard;
                    }
                    output.color = vec4f(steadyColor, 1.0);
                    output.color1 = vec4u(steadyIndex + 1u, bitcast<u32>(steadyDepth), 0u, 0u);
                    return output;
                }
            `
        };
        const setSampleShader = (desc) => {
            material.shaderDesc = desc;
            material.update();
        };
        const sample = async (desc, frame) => {
            // Capture distance to either acceptance boundary in the linear depth channel.
            setSampleShader({
                ...desc,
                uniqueName: `${desc.uniqueName}Coverage`,
                fragmentWGSL: desc.fragmentWGSL.replace('bitcast<u32>(steadyDepth)',
                    'bitcast<u32>(min(abs(alpha - uniform.alphaClipForward), abs(alpha - threshold)))')
            });
            renderer.steadyPass.frame = frame;
            renderFrame();
            const pass = renderer.steadyPass;
            const pixels = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
            return { ids: Array.from(pixels).filter((value, index) => index % 2 === 0),
                values: new Float32Array(pixels.buffer) };
        };
        try {
            // Include a disabled cutoff, the default, a tighter bound, and opacity equality.
            const cases = [0, 1 / 255, 0.1, 0.49, 0.5].flatMap(cutoff => (
                Array.from({ length: 16 }, (_, frame) => ({ cutoff, frame }))));
            // Read each frame before the next draw overwrites the same sample texture.
            await cases.reduce(async (previous, { cutoff, frame }) => {
                await previous;
                app.scene.gsplat.alphaClipForward = cutoff;
                const unclipped = await sample(reference, frame);
                const clipped = await sample(original, frame);
                const changed = clipped.ids.flatMap((id, pixel) => (id === unclipped.ids[pixel] ? [] : [pixel]));
                // Different quad edges can slightly change interpolants at rasterizer subpixel
                // precision. Permit only rare decisions within 1e-4 of an acceptance boundary.
                expect(changed.length).to.be.at.most(clipped.ids.length / 1000);
                const nearBoundary = (capture, pixel) => {
                    return capture.ids[pixel] > 0 && capture.values[pixel * 2 + 1] < 1e-4;
                };
                for (const pixel of changed) {
                    expect(nearBoundary(clipped, pixel) || nearBoundary(unclipped, pixel),
                        `cutoff ${cutoff}, frame ${frame}, pixel ${pixel}, ` +
                        `clipped ${clipped.ids[pixel]}:${clipped.values[pixel * 2 + 1]}, ` +
                        `full ${unclipped.ids[pixel]}:${unclipped.values[pixel * 2 + 1]}`).to.equal(true);
                }
                if (cutoff < 0.49) expect(unclipped.ids.some(id => id > 0)).to.equal(true);
            }, Promise.resolve());
        } finally {
            setSampleShader(original);
        }
    });

    it('removes temporal bindings and its spare texture when temporal reuse is disabled', function () {
        renderFrame();
        const pass = getRenderer().steadyPass;
        const history = pass.historyBuffers[0];
        const count = pass.textures.length;
        app.scene.gsplat.steadyHistoryWeight = 0;
        renderFrame();
        expect(pass.colors).to.have.length(1);
        expect(pass.textures).to.have.length(count - 1);
        expect(pass.resolvePass.computes[0]).to.equal(pass.spatialCompute);
        expect(pass.spatialCompute.getParameter('steadyPrevious')).to.equal(undefined);
        expect(pass.beforePasses).to.have.length(3);
        expect(pass.historyBuffers[0]).to.equal(history);
        app.scene.gsplat.steadyHistoryWeight = 0.7;
        renderFrame();
        expect(pass.colors).to.have.length(2);
        expect(pass.resolvePass.computes[0]).to.equal(pass.temporalCompute);
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(0);
        expect(pass.temporalCompute.getParameter('steadyValid')).to.equal(0);
        expect(pass.historyBuffers[0]).to.equal(history);
    });

    it('uses same-pixel history for an unchanged camera independently of convergence', function () {
        app.scene.gsplat.steadyConvergence = false;
        renderFrame();
        const pass = getRenderer().steadyPass;
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(0);
        renderFrame();
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(1);
        camera.setPosition(0.01, 0, 3);
        renderFrame();
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(0);
        renderFrame();
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(1);
        app.scene.gsplat.resetHistory();
        renderFrame();
        expect(pass.temporalCompute.getParameter('steadyCameraStill')).to.equal(0);
    });

    it('keeps histories independent for two cameras sharing the same splat layer', function () {
        const second = new Entity('Second camera');
        second.addComponent('camera', { nearClip: 0.1, farClip: 100, priority: 1 });
        second.setPosition(1, 0, 3);
        second.lookAt(0, 0, 0);
        app.root.addChild(second);
        renderFrame();
        const firstRenderer = getRenderer();
        const data = app.renderer.gsplatDirector.camerasMap.get(second.camera.camera);
        const secondRenderer = Array.from(data.layersMap.values())[0].gsplatManager.renderer;
        expect(firstRenderer.steadyPass.frame).to.equal(1);
        expect(secondRenderer.steadyPass.frame).to.equal(1);
        expect(firstRenderer.steadyPass.colors[0]).to.not.equal(secondRenderer.steadyPass.colors[0]);
        expect(firstRenderer.steadyPass.historyBuffers[0]).to.not.equal(secondRenderer.steadyPass.historyBuffers[0]);
        expect(firstRenderer.sampleMaterial.getParameter('steadyNoise').data)
        .to.equal(secondRenderer.sampleMaterial.getParameter('steadyNoise').data);
    });

    it('retains sorted picking and restores the forward projection on the next frame', function () {
        renderFrame();
        const renderer = getRenderer();
        const steadyCompaction = renderer._steadyCompaction;
        const data = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        const manager = Array.from(data.layersMap.values())[0].gsplatManager;
        const mesh = manager.prepareForPicking(camera.camera.camera, 96, 64);
        expect(mesh).to.not.equal(null);
        expect(renderer.gpuSorter).to.not.equal(null);
        expect(renderer.intervalCompaction.constructor).to.equal(GSplatIntervalCompaction);
        expect(renderer.intervalCompaction).to.not.equal(steadyCompaction);
        const sortedCompaction = renderer.intervalCompaction;
        renderFrame();
        expect(renderer.steadyPass.frame).to.equal(2);
        expect(renderer.renderPasses).to.not.equal(null);
        expect(renderer.intervalCompaction).to.equal(sortedCompaction);
        expect(renderer._steadyCompaction).to.equal(steadyCompaction);
    });

    it('schedules resampling with CameraFrame, HDR and a scaled scene target', function () {
        const frame = new CameraFrame(app, camera.camera);
        try {
            frame.rendering.renderTargetScale = 0.5;
            frame.update();
            renderFrame();
            expect(getRenderer().steadyPass.frame).to.equal(1);
            expect(getRenderer().steadyPass.width).to.equal(48);
            expect(getRenderer().steadyPass.height).to.equal(32);
            const target = getRenderer().steadyPass.target;
            renderFrame();
            expect(getRenderer().steadyPass.frame).to.equal(2);
            expect(getRenderer().steadyPass.target).to.equal(target);
        } finally {
            frame.destroy();
        }
    });

    it('uses the target and color settings of the pass drawing the splat sublayer', function () {
        const device = app.graphicsDevice;
        const composition = app.scene.layers;
        const world = composition.getLayerById(LAYERID_WORLD);
        const target = new RenderTarget({
            colorBuffer: new Texture(device, {
                width: 40,
                height: 28,
                format: PIXELFORMAT_RGBA16F,
                mipmaps: false
            }),
            depth: true
        });
        const early = new RenderPassForward(device, composition, app.scene, app.renderer, camera.camera);
        early.init(null);
        early.gammaCorrection = GAMMA_SRGB;
        early.addLayer(composition.getLayerById(LAYERID_UI), true);
        early.addLayer(world, false);
        const late = new RenderPassForward(device, composition, app.scene, app.renderer, camera.camera);
        late.init(target);
        late.gammaCorrection = GAMMA_NONE;
        late.toneMapping = TONEMAP_NONE;
        late.addLayer(world, true);
        camera.camera.framePasses = [early, late];
        try {
            renderFrame();
            const pass = getRenderer().steadyPass;
            expect(pass.width).to.equal(40);
            expect(pass.height).to.equal(28);
            expect(pass.samplePass.gammaCorrection).to.equal(GAMMA_NONE);
            expect(pass.samplePass.toneMapping).to.equal(TONEMAP_NONE);
            expect(pass.frame).to.equal(1);
            expect(early.internalBeforePasses).to.not.include(pass);
            expect(late.internalBeforePasses).to.include(pass);
            renderFrame();
            expect(pass.frame).to.equal(2);
        } finally {
            camera.camera.framePasses = [];
            early.destroy();
            late.destroy();
            target.destroyTextureBuffers();
            target.destroy();
        }
    });

    it('restarts stationary convergence on motion and history invalidation', function () {
        camera.camera.jitter = 1;
        renderFrame();
        const pass = getRenderer().steadyPass;
        expect(pass.restFrames).to.equal(0);
        renderFrame();
        expect(pass.restFrames).to.equal(1);
        renderFrame();
        expect(pass.restFrames).to.equal(2);
        const buffer = pass.convergenceBuffers[0];
        expect(buffer.byteSize).to.equal(pass.width * pass.height * 16);
        expect(pass.resolvePass.computes).to.equal(pass.convergenceComputes);
        camera.setPosition(0.01, 0, 3);
        renderFrame();
        expect(pass.restFrames).to.equal(0);
        expect(pass.resolvePass.computes[0].getParameter('steadyValid')).to.equal(1);
        renderFrame();
        expect(pass.restFrames).to.equal(1);
        app.scene.gsplat.resetHistory();
        renderFrame();
        expect(pass.restFrames).to.equal(0);
        expect(pass.resolvePass.computes[0].getParameter('steadyValid')).to.equal(0);
        expect(pass.convergenceBuffers[0]).to.equal(buffer);
        renderFrame();
        expect(pass.restFrames).to.equal(1);
        app.graphicsDevice.resizeCanvas(80, 56);
        renderFrame();
        expect(pass.restFrames).to.equal(0);
        expect(pass.convergenceBuffers[0]).to.not.equal(buffer);
        expect(pass.convergenceBuffers[0].byteSize).to.equal(80 * 56 * 16);
        app.graphicsDevice.fire('devicelost');
        expect(pass.restFrames).to.equal(0);
    });

    it('releases the stationary average for fixed samples, disabled convergence or zero retention', function () {
        renderFrame();
        const pass = getRenderer().steadyPass;
        expect(pass.convergenceBuffers).to.have.length(0);
        camera.camera.jitter = 1;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(1);
        renderFrame();
        expect(pass.restFrames).to.equal(1);
        app.scene.gsplat.steadyConvergence = false;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(0);
        expect(pass.restFrames).to.equal(0);
        expect(pass.resolvePass.computes[0]).to.equal(pass.temporalCompute);
        app.scene.gsplat.steadyConvergence = true;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(1);
        app.scene.gsplat.steadyHistoryWeight = 0;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(0);
        expect(pass.resolvePass.computes[0]).to.equal(pass.spatialCompute);
        app.scene.gsplat.steadyHistoryWeight = 0.7;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(1);
        camera.camera.jitter = 0;
        renderFrame();
        expect(pass.convergenceBuffers).to.have.length(0);
    });

    it('freezes the last image at its refinement limit and resumes on motion or a larger budget', function () {
        camera.camera.jitter = 1;
        renderFrame();
        const renderer = getRenderer();
        const pass = renderer.steadyPass;
        const project = sinon.spy(renderer.projector, 'dispatch');
        for (let i = 0; i < 16; i++) renderFrame();
        expect(pass.restFrames).to.equal(16);
        expect(project.callCount).to.equal(0);
        const frame = pass.frame;
        const image = renderer.resolveMaterial.getParameter('steadyImage').data;
        const sample = sinon.spy(pass.samplePass, 'execute');
        const drawArgs = sinon.spy(renderer.projector, 'writeIndirectArgs');
        renderFrame();
        renderFrame();
        expect(pass.frame).to.equal(frame);
        expect(sample.called).to.equal(false);
        expect(drawArgs.called).to.equal(false);
        expect(renderer.resolveMaterial.getParameter('steadyImage').data).to.equal(image);
        app.scene.gsplat.steadyConvergenceFrames = 18;
        renderFrame();
        expect(pass.restFrames).to.equal(17);
        expect(pass.frame).to.equal(frame + 1);
        expect(project.called).to.equal(false);
        camera.setPosition(0.01, 0, 3);
        renderFrame();
        expect(pass.restFrames).to.equal(0);
        expect(project.callCount).to.equal(1);
    });

    it('matches fresh projection samples while reusing a stationary camera cache', async function () {
        if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
        camera.camera.jitter = 1;
        app.scene.gsplat.steadyConvergence = false;
        renderFrame();
        const renderer = getRenderer();
        const pass = renderer.steadyPass;
        const capture = async (cached) => {
            if (!cached) renderer._projectionValid = false;
            pass.frame = 37;
            renderFrame();
            const pixels = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
            // Cache-local indices can change during compaction; visibility identity must agree.
            return Array.from(pixels).filter((value, index) => index % 4 === 1);
        };
        const first = await capture(false);
        expect(await capture(true)).to.deep.equal(first);
        expect(await capture(false)).to.deep.equal(first);
        const data = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        const manager = Array.from(data.layersMap.values())[0].gsplatManager;
        expect(manager.prepareForPicking(camera.camera.camera, 48, 48)).to.not.equal(null);
        const project = sinon.spy(renderer.projector, 'dispatch');
        expect(await capture(true)).to.deep.equal(first);
        expect(project.callCount).to.equal(1);
    });

    it('requests finite refinement frames for an on-demand application and restarts after camera motion', function () {
        camera.camera.jitter = 1;
        app.autoRender = false;
        app.scene.gsplat.steadyConvergenceFrames = 3;
        let requested = 0;
        const request = () => {
            requested++;
            app.renderNextFrame = true;
        };
        app.systems.gsplat.on('frame:request', request);
        renderFrame();
        const pass = getRenderer().steadyPass;
        requested = 0;
        const tick = () => {
            app.renderNextFrame = false;
            app.fire('framerender');
            if (app.renderNextFrame) app.render();
        };
        for (let i = 0; i < 20; i++) tick();
        expect(pass.restFrames).to.equal(3);
        expect(pass.frame).to.equal(4);
        expect(requested).to.equal(3);
        camera.setPosition(0.01, 0, 3);
        for (let i = 0; i < 20; i++) tick();
        expect(pass.frame).to.equal(8);
        expect(requested).to.equal(7);
        camera.enabled = false;
        app.scene.gsplat.resetHistory();
        tick();
        expect(requested).to.equal(7);
    });

    it('shifts STBN with fixed-point arithmetic between 64-frame cycles', function () {
        camera.camera.jitter = 1;
        app.scene.gsplat.steadyConvergence = false;
        renderFrame();
        const renderer = getRenderer();
        const pass = renderer.steadyPass;
        pass.frame = 63;
        renderFrame();
        expect(renderer.sampleMaterial.getParameter('steadyNoiseShift').data).to.equal(0);
        renderFrame();
        expect(renderer.sampleMaterial.getParameter('steadyNoiseShift').data).to.equal(0x9e3779b9);
    });
});
