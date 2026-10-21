import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA16F, RENDERTARGET_ORIGIN_TOP, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
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
    const addSplats = (colors, opacities) => {
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
});
