import { expect } from 'chai';
import sinon from 'sinon';

import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import {
    GSPLAT_RENDERER_AUTO, GSPLAT_RENDERER_RASTER_CPU_SORT, GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_RENDERER_STEADY, PROJECTION_ORTHOGRAPHIC
} from '../../../src/scene/constants.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import { GSplatDirector } from '../../../src/scene/gsplat-unified/gsplat-director.js';
import { GSplatParams } from '../../../src/scene/gsplat-unified/gsplat-params.js';
import { GSplatSteadyRenderer } from '../../../src/scene/gsplat-unified/gsplat-steady-renderer.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';
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

    it('resolves the new mode on WebGPU and preserves the sorted WebGL fallback', function () {
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.renderer).to.equal(GSPLAT_RENDERER_STEADY);
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_RASTER_CPU_SORT);
        device.isWebGPU = true;
        params.renderer = GSPLAT_RENDERER_AUTO;
        params.renderer = GSPLAT_RENDERER_STEADY;
        expect(params.currentRenderer).to.equal(GSPLAT_RENDERER_STEADY);
    });

    it('invalidates history without changing sampling or renderer settings', function () {
        const version = params.historyVersion;
        params.resetHistory();
        params.resetHistory();
        expect(params.historyVersion).to.equal(version + 2);
        expect(params.steadyHistoryWeight).to.equal(0.7);
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
        renderer._coverageSupported = true;
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
        renderer._material.setDefine('GSPLAT_OVERDRAW', true);
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
        const director = new GSplatDirector(null, null, null, null, null);
        director.camerasMap.set(camera.camera.camera, {
            layersMap: new Map([
                [1, { gsplatManager: { renderer: { renderPasses: [passA, passB] } } }],
                [2, { gsplatManager: { renderer: { renderPasses: null } } }],
                [3, { gsplatManager: null }]
            ])
        });
        const passes = [];
        director.collectRenderPasses({}, passes);
        expect(passes).to.deep.equal([]);
        director.collectRenderPasses(camera.camera.camera, passes);
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
        expect(renderer.steadyPass.frame).to.equal(1);
        expect(renderer.steadyPass.valid).to.equal(true);
        renderFrame();
        expect(renderer.steadyPass.frame).to.equal(2);
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
        const chunks = app.scene.gsplat.material.getShaderChunks(SHADERLANGUAGE_WGSL);
        chunks.set('gsplatModifyPS', 'fn modifySplatColor(uv: vec2f, color: ptr<function, vec4f>) {}');
        app.scene.gsplat.material.update();
        renderFrame();
        expect(renderer.renderPasses).to.equal(null);
        expect(renderer.gpuSorter).to.not.equal(null);
        chunks.delete('gsplatModifyPS');
        app.scene.gsplat.material.update();
        renderFrame();
        expect(renderer.renderPasses).to.not.equal(null);
    });

    it('releases frame resources when switching back to automatic rendering', function () {
        renderFrame();
        const renderer = getRenderer();
        const pass = renderer.steadyPass;
        app.scene.gsplat.renderer = GSPLAT_RENDERER_AUTO;
        renderFrame();
        expect(renderer.steadyPass).to.equal(null);
        expect(pass.textures).to.have.length(0);
        expect(pass.historyBuffers).to.have.length(0);
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
            return Array.from(samples).filter((value, index) => index % 4 === 1);
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
        // the same projected data, output processing and per-splat sampling seed.
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
                    let pixel = p.x + p.y * u32(uniform.steadySize.x);
                    let key = steadySeed ^ steadyHash(pixel);
                    let threshold = f32(steadyHash(key) >> 8u) * (1.0 / 16777216.0);
                    let alpha = steadyAlphaFromUV(steadyOpacity, steadyUV);
                    if (alpha <= threshold) {
                        discard;
                    }
                    output.color = vec4f(steadyColor, 1.0);
                    output.color1 = vec4u(steadyIndex + 1u, steadyId,
                        bitcast<u32>(steadyDepth), bitcast<u32>(input.position.z));
                    return output;
                }
            `
        };
        const setSampleShader = (desc) => {
            material.shaderDesc = desc;
            material.update();
        };
        const sample = async (desc, frame) => {
            // Capture the acceptance values in the two depth channels for boundary diagnostics.
            setSampleShader({
                ...desc,
                uniqueName: `${desc.uniqueName}Coverage`,
                fragmentWGSL: desc.fragmentWGSL.replace('bitcast<u32>(steadyDepth)', 'bitcast<u32>(alpha)')
                .replace('bitcast<u32>(input.position.z)', 'bitcast<u32>(threshold)')
            });
            renderer.steadyPass.frame = frame;
            renderFrame();
            const pass = renderer.steadyPass;
            const pixels = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
            return { ids: Array.from(pixels).filter((value, index) => index % 4 === 1),
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
                    const alpha = capture.values[pixel * 4 + 2];
                    const threshold = capture.values[pixel * 4 + 3];
                    return capture.ids[pixel] > 0 &&
                        Math.min(Math.abs(alpha - cutoff), Math.abs(alpha - threshold)) < 1e-4;
                };
                for (const pixel of changed) {
                    expect(nearBoundary(clipped, pixel) || nearBoundary(unclipped, pixel),
                        `cutoff ${cutoff}, frame ${frame}, pixel ${pixel}`).to.equal(true);
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
        expect(pass.temporalCompute.getParameter('steadyValid')).to.equal(0);
        expect(pass.historyBuffers[0]).to.equal(history);
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
    });

    it('retains sorted picking and restores the forward projection on the next frame', function () {
        renderFrame();
        const renderer = getRenderer();
        const data = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        const manager = Array.from(data.layersMap.values())[0].gsplatManager;
        const mesh = manager.prepareForPicking(camera.camera.camera, 96, 64);
        expect(mesh).to.not.equal(null);
        expect(renderer.gpuSorter).to.not.equal(null);
        renderFrame();
        expect(renderer.steadyPass.frame).to.equal(2);
        expect(renderer.renderPasses).to.not.equal(null);
    });

    it('schedules resampling with CameraFrame, HDR and a scaled scene target', function () {
        const frame = new CameraFrame(app, camera.camera);
        try {
            frame.rendering.renderTargetScale = 0.5;
            frame.update();
            renderFrame();
            expect(getRenderer().steadyPass.frame).to.equal(1);
            renderFrame();
            expect(getRenderer().steadyPass.frame).to.equal(2);
        } finally {
            frame.destroy();
        }
    });
});
