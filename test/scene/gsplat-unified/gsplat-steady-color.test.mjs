import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, RENDERTARGET_ORIGIN_TOP, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { Camera } from '../../../src/scene/camera.js';
import {
    FOG_EXP, FOG_EXP2, FOG_LINEAR, GAMMA_NONE, GAMMA_SRGB, GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_RENDERER_STEADY, TONEMAP_ACES, TONEMAP_NONE
} from '../../../src/scene/constants.js';
import { GSplatData } from '../../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../../src/scene/gsplat/gsplat-resource.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Decode readback independently of the render shaders.
const half = (value) => {
    const sign = value & 0x8000 ? -1 : 1;
    const exponent = (value >> 10) & 31;
    const mantissa = value & 1023;
    return sign * (exponent ? 2 ** (exponent - 15) * (1 + mantissa / 1024) : 2 ** -14 * mantissa / 1024);
};

describe('GSplat SteadySplats color processing', function () {
    let app;
    let camera;
    let image;
    let target;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        image = null;
        target = null;
        if (!app.graphicsDevice.isWebGPU) this.skip();
        app.graphicsDevice.resizeCanvas(64, 64);
        image = new Texture(app.graphicsDevice, { width: 64, height: 64, format: PIXELFORMAT_RGBA16F, mipmaps: false });
        target = new RenderTarget({ colorBuffer: image, depth: true, samples: 1, origin: RENDERTARGET_ORIGIN_TOP });
        camera = new Entity('Camera');
        camera.addComponent('camera', { nearClip: 0.1,
            farClip: 100,
            gammaCorrection: GAMMA_NONE,
            toneMapping: TONEMAP_NONE,
            clearColor: new Color(0, 0, 0, 0) });
        camera.camera.jitter = 1;
        camera.camera.renderTarget = target;
        camera.setPosition(0, 0, 3);
        camera.lookAt(0, 0, 0);
        app.root.addChild(camera);
        app.scene.gsplat.steadyHistoryWeight = 0;
        app.scene.gsplat.useFog = false;
        app.scene.gsplat.useTonemap = false;
    });

    afterEach(function () {
        app?.destroy();
        target?.destroy();
        image?.destroy();
        jsdomTeardown();
    });

    const requireExecution = function () {
        if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
    };
    const render = () => {
        app.fire('framerender');
        app.render();
    };
    const addSplats = (colors, opacities, withSH = false) => {
        const values = {
            x: colors.map(() => 0),
            y: colors.map(() => 0),
            z: colors.map((color, i) => -i * 0.1),
            rot_0: colors.map(() => 1),
            rot_1: colors.map(() => 0),
            rot_2: colors.map(() => 0),
            rot_3: colors.map(() => 0),
            scale_0: colors.map(() => 0),
            scale_1: colors.map(() => 0),
            scale_2: colors.map(() => 0),
            f_dc_0: colors.map(c => (c[0] - 0.5) / 0.28209479177387814),
            f_dc_1: colors.map(c => (c[1] - 0.5) / 0.28209479177387814),
            f_dc_2: colors.map(c => (c[2] - 0.5) / 0.28209479177387814),
            opacity: opacities
        };
        if (withSH) {
            for (let i = 0; i < 9; i++) values[`f_rest_${i}`] = colors.map(() => 0);
        }
        const data = new GSplatData([{ name: 'vertex',
            count: colors.length,
            properties: Object.entries(values).map(([name, storage]) => ({ name,
                type: 'float',
                byteSize: 4,
                storage: new Float32Array(storage) })) }]);
        const asset = new Asset('Procedural colors', 'gsplat');
        asset.resource = new GSplatResource(app.graphicsDevice, data);
        asset.loaded = true;
        app.assets.add(asset);
        const entity = new Entity('Splats');
        entity.addComponent('gsplat', { asset, unified: true });
        app.root.addChild(entity);
        return entity;
    };
    const mean = (mode, count = 48) => {
        app.scene.gsplat.renderer = mode;
        const sum = [0, 0, 0, 0];
        let remaining = count;
        // Finish each readback before drawing the next frame into the same texture.
        const sample = async () => {
            if (remaining-- === 0) return sum;
            render();
            const pixels = await image.read(28, 28, 8, 8, { immediate: true });
            for (let i = 0; i < pixels.length; i++) sum[i % 4] += half(pixels[i]) / (64 * count);
            return sample();
        };
        return sample();
    };

    it('matches sorted linear HDR color rather than decoding the averaged gamma color', async function () {
        requireExecution.call(this);
        addSplats([[0, 0, 0], [1, 1, 1]], [0, 20]);
        const sorted = await mean(GSPLAT_RENDERER_RASTER_GPU_SORT);
        const steady = await mean(GSPLAT_RENDERER_STEADY);
        expect(steady[0]).to.be.closeTo(sorted[0], 0.03);
        expect(steady[3]).to.be.closeTo(sorted[3], 0.03);
    });

    it('matches native per-Gaussian tone mapping before blending', async function () {
        requireExecution.call(this);
        addSplats([[0.1, 0.2, 0.3], [0.8, 0.9, 1]], [0, 20]);
        camera.camera.toneMapping = TONEMAP_ACES;
        app.scene.gsplat.useTonemap = true;
        const sorted = await mean(GSPLAT_RENDERER_RASTER_GPU_SORT);
        const steady = await mean(GSPLAT_RENDERER_STEADY);
        for (let c = 0; c < 3; c++) expect(steady[c]).to.be.closeTo(sorted[c], 0.03);
    });

    it('matches the effective CameraFrame color domain at a scaled HDR resolution', async function () {
        requireExecution.call(this);
        addSplats([[0.2, 0.4, 0.8]], [20]);
        camera.camera.gammaCorrection = GAMMA_SRGB;
        const frame = new CameraFrame(app, camera.camera);
        try {
            frame.rendering.renderTargetScale = 0.5;
            frame.rendering.toneMapping = TONEMAP_NONE;
            frame.update();
            const sorted = await mean(GSPLAT_RENDERER_RASTER_GPU_SORT);
            const steady = await mean(GSPLAT_RENDERER_STEADY);
            for (let c = 0; c < 3; c++) expect(steady[c]).to.be.closeTo(sorted[c], 0.03);
            expect(camera.camera.gammaCorrection).to.equal(GAMMA_SRGB);
        } finally {
            frame.destroy();
        }
    });

    it('retains moving-camera history across SH color refreshes and resets it for moved geometry', function () {
        const splat = addSplats([[0.2, 0.4, 0.8]], [20], true);
        app.scene.gsplat.steadyHistoryWeight = 0.7;
        app.scene.gsplat.colorUpdateAngle = 0;
        app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
        render();
        render();
        const data = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        const manager = Array.from(data.layersMap.values())[0].gsplatManager;
        const version = manager.world.contentVersion;
        for (let i = 1; i <= 4; i++) {
            camera.setPosition(i * 0.01, 0, 3);
            render();
            expect(manager.world.bufferCopyUploaded).to.be.greaterThan(0);
            expect(manager.world.contentVersion).to.equal(version);
            expect(manager.renderer.steadyPass.resolvePass.computes[0].getParameter('steadyValid')).to.equal(1);
        }
        splat.setPosition(0.1, 0, 0);
        render();
        expect(manager.world.contentVersion).to.be.greaterThan(version);
        expect(manager.renderer.steadyPass.resolvePass.computes[0].getParameter('steadyValid')).to.equal(0);
    });

    it('compiles each native fog mode in the sampling vertex stage', function () {
        addSplats([[1, 0, 0]], [0]);
        app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
        app.scene.gsplat.useFog = true;
        for (const type of [FOG_LINEAR, FOG_EXP, FOG_EXP2]) {
            app.scene.fog.type = type;
            render();
        }
    });

    it('preserves fogged foreground color when a background sample reuses foreground neighbors', async function () {
        requireExecution.call(this);
        addSplats([[1, 0, 0]], [0]);
        camera.camera.gammaCorrection = GAMMA_SRGB;
        app.scene.gsplat.useFog = true;
        app.scene.fog.type = FOG_LINEAR;
        app.scene.fog.color.set(0, 0, 1);
        app.scene.fog.start = 0;
        app.scene.fog.end = 10;
        const sorted = await mean(GSPLAT_RENDERER_RASTER_GPU_SORT);
        const steady = await mean(GSPLAT_RENDERER_STEADY);
        for (let c = 0; c < 3; c++) expect(steady[c]).to.be.closeTo(sorted[c], 0.03);
    });

    it('honors output shader chunks, defines and parameters on the global template material', async function () {
        requireExecution.call(this);
        addSplats([[1, 0, 0]], [5]);
        const material = app.scene.gsplat.material;
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('gsplatOutputVS', `
            uniform customColor: vec3f;
            fn prepareOutputFromGamma(color: vec3f, depth: f32) -> vec3f {
                return uniform.customColor * {CUSTOM_SCALE};
            }
        `);
        material.setDefine('{CUSTOM_SCALE}', '0.5');
        material.setParameter('customColor', [0, 0, 0]);
        material.update();
        expect((await mean(GSPLAT_RENDERER_STEADY, 1))[0]).to.equal(0);
        material.setParameter('customColor', [0.5, 1, 0]);
        material.update();
        const color = await mean(GSPLAT_RENDERER_STEADY, 1);
        expect(color[0] / color[3]).to.be.closeTo(0.25, 0.001);
        expect(color[1] / color[3]).to.be.closeTo(0.5, 0.001);
    });

    it('recovers composite device depth from full-precision linear visibility depth', async function () {
        requireExecution.call(this);
        target.destroy();
        image.destroy();
        image = new Texture(app.graphicsDevice, { width: 64, height: 64, format: PIXELFORMAT_RGBA32F, mipmaps: false });
        target = new RenderTarget({ colorBuffer: image, depth: true, samples: 1, origin: RENDERTARGET_ORIGIN_TOP });
        camera.camera.renderTarget = target;
        const splat = addSplats([[0.5, 0.5, 0.5]], [20]);
        app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
        render();
        const data = app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera);
        const renderer = Array.from(data.layersMap.values())[0].gsplatManager.renderer;
        const material = renderer.resolveMaterial;
        // Observe the production composite's depth result in a full-precision color target.
        material.shaderDesc = {
            ...material.shaderDesc,
            uniqueName: 'SteadyCompositeDepthOracle',
            fragmentWGSL: material.shaderDesc.fragmentWGSL.replace('return output;',
                'output.color = vec4f(output.fragDepth, depth, 0.0, 1.0); return output;')
        };
        material.update();
        const projection = new Mat4();
        const clip = new Vec4();
        const cases = [[0.1, 100, 3], [2.99, 3.01, 3], [0.001, 100000, 3], [1, 100000, 9000]];
        await cases.reduce(async (previous, [near, far, distance]) => {
            await previous;
            camera.camera.nearClip = near;
            camera.camera.farClip = far;
            camera.setPosition(0, 0, distance);
            splat.setLocalScale(distance / 3, distance / 3, distance / 3);
            render();
            Camera.applyShaderProjectionTransform(camera.camera.camera.projectionMatrix, projection, false, true);
            const samples = await renderer.steadyPass.samples.read(0, 0, 64, 64, { immediate: true });
            const depths = new Float32Array(samples.buffer, samples.byteOffset, samples.length);
            const pixels = await image.read(0, 0, 64, 64, { immediate: true });
            let visible = 0;
            for (let p = 0; p < 64 * 64; p++) {
                if (samples[p * 2]) {
                    const depth = depths[p * 2 + 1];
                    clip.set(0, 0, -depth, 1);
                    projection.transformVec4(clip, clip);
                    const expected = Math.max(0, Math.min(1, clip.z / clip.w));
                    expect(pixels[p * 4]).to.be.closeTo(expected, 2e-6);
                    expect(pixels[p * 4 + 1]).to.equal(depth);
                    visible++;
                } else if (pixels[p * 4 + 3] > 0) {
                    expect(pixels[p * 4]).to.equal(1);
                }
            }
            expect(visible).to.be.greaterThan(0);
        }, Promise.resolve());
    });

    it('reduces stationary image error against sorted rendering as samples accumulate', async function () {
        requireExecution.call(this);
        addSplats([[1, 0, 0]], [0]);
        app.scene.gsplat.renderer = GSPLAT_RENDERER_RASTER_GPU_SORT;
        render();
        const reference = await image.read(28, 28, 8, 8, { immediate: true });
        app.scene.gsplat.renderer = GSPLAT_RENDERER_STEADY;
        app.scene.gsplat.steadyHistoryWeight = 0.7;
        app.scene.gsplat.steadyConvergenceFrames = 256;
        let earlyError = 0;
        let lateError = 0;
        const sample = async (frame) => {
            if (frame === 144) return;
            render();
            if ((frame >= 8 && frame < 24) || frame >= 128) {
                const pixels = await image.read(28, 28, 8, 8, { immediate: true });
                let error = 0;
                for (let p = 0; p < pixels.length; p += 4) error += (half(pixels[p]) - half(reference[p])) ** 2;
                if (frame < 24) earlyError += error;
                else lateError += error;
            }
            await sample(frame + 1);
        };
        await sample(0);
        expect(earlyError).to.be.greaterThan(0);
        expect(lateError).to.be.below(earlyError * 0.5);
    });
});
