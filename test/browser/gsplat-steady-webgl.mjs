import { runSteadyWebglNumericTests } from './gsplat-steady-webgl-numeric.mjs';
import { CameraFrame } from '../../src/extras/render-passes/camera-frame.js';
import * as pc from '../../src/index.js';
import { GSplatData } from '../../src/scene/gsplat/gsplat-data.js';
import { GSplatResource } from '../../src/scene/gsplat/gsplat-resource.js';
import { GSplatSteadyWebglRenderer } from '../../src/scene/gsplat-unified/gsplat-steady-webgl-renderer.js';
import { RenderPassForward } from '../../src/scene/renderer/render-pass-forward.js';

/**
 * Runs on an actual browser WebGL2 context. The local test server collects the result; no
 * browser automation or graphics mocks are involved.
 *
 * @returns {Promise<object>} Test results and device information.
 */
export async function runSteadyWebglTests() {
    const assert = (value, message) => {
        if (!value) throw new Error(message);
    };
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    document.body.appendChild(canvas);
    const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [pc.DEVICETYPE_WEBGL2], antialias: false });
    assert(device.isWebGL2, 'Expected an actual WebGL2 graphics device');
    const app = new pc.Application(canvas, { graphicsDevice: device });
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', { clearColor: new pc.Color(0.08, 0.08, 0.08),
        gammaCorrection: pc.GAMMA_NONE,
        toneMapping: pc.TONEMAP_NONE,
        nearClip: 0.1,
        farClip: 100 });
    camera.camera.jitter = 1;
    camera.setPosition(0, 0, 3);
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
    for (let i = 0; i < 9; i++) values[`f_rest_${i}`] = [0, 0, 0];
    const data = new GSplatData([{ name: 'vertex',
        count: 3,
        properties: Object.entries(values).map(([name, storage]) => ({
            name, type: 'float', byteSize: 4, storage: new Float32Array(storage)
        })) }]);
    const asset = new pc.Asset('Procedural splats', 'gsplat');
    asset.resource = new GSplatResource(device, data);
    asset.loaded = true;
    app.assets.add(asset);
    const splat = new pc.Entity('Splats');
    splat.addComponent('gsplat', { asset, unified: true });
    app.root.addChild(splat);
    app.scene.gsplat.renderer = pc.GSPLAT_RENDERER_STEADY;
    app.scene.gsplat.colorUpdateAngle = 0;
    const render = () => {
        app.fire('framerender');
        app.render();
    };
    const manager = () => Array.from(app.renderer.gsplatDirector.camerasMap.get(camera.camera.camera).layersMap.values())[0].gsplatManager;
    const tests = [];
    const record = (...messages) => {
        tests.push(...messages);
        fetch('/progress', { method: 'POST', body: JSON.stringify({ step: messages[messages.length - 1], count: tests.length }) }).catch(() => {});
    };
    const lens = camera.camera;
    const gsplat = app.scene.gsplat;
    const readIds = async () => {
        const pass = manager().renderer.steadyPass;
        const samples = await pass.samples.read(0, 0, pass.width, pass.height, { immediate: true });
        return Array.from(samples).filter((value, index) => index % 4 === 0);
    };
    const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
    try {
        render();
        assert(app.scene.gsplat.currentRenderer === pc.GSPLAT_RENDERER_STEADY, 'SteadySplats was resolved to a fallback');
        assert(manager().renderer instanceof GSplatSteadyWebglRenderer, 'WebGL2 renderer was not selected');
        assert(!manager().renderer.usesGpuSort, 'Texture-based reconstruction must not advertise a GPU sort pipeline');
        assert(manager().cpuSorter === null, 'Supported SteadySplats views must not create a CPU depth sorter');
        const ids = await readIds();
        assert(ids.some(id => id !== 0), 'Stochastic rasterization produced no visible IDs');
        const pass = manager().renderer.steadyPass;
        const image = await pass.colors[1 - pass.writeIndex].read(0, 0, pass.width, pass.height, { immediate: true });
        assert(Array.from(image).some(value => value > 0), 'Spatial reconstruction produced no visible color');
        assert(!Array.from(image).some(value => (value & 0x7c00) === 0x7c00), 'Resolved image contains non-finite half floats');
        record('renders visible stochastic samples and finite reconstructed color without CPU sorting');

        render();
        assert(!equal(ids, await readIds()), 'Animated STBN repeated the same sample IDs');
        lens.jitter = 0;
        render();
        const fixed = await readIds();
        render();
        assert(equal(fixed, await readIds()), 'Fixed STBN changed sample IDs');
        record('animates STBN only when camera jitter is enabled');

        lens.jitter = 1;
        render();
        render();
        assert(pass.restFrames === 1, 'Stationary accumulation did not start');
        camera.setPosition(0.01, 0, 3);
        render();
        assert(pass.restFrames === 0, 'Camera motion did not restart rest convergence');
        assert(pass.resolvePasses[1 - pass.writeIndex].parameters.get('steadyValid').data === 1, 'Smooth motion discarded temporal history');
        assert(manager().world.bufferCopyUploaded > 0, 'SH color-refresh motion case did not upload colors');
        record('reprojects motion history and restarts stationary accumulation on camera motion');

        const checkRefinement = (settings) => {
            settings.steadyConvergenceFrames = 3;
            app.autoRender = false;
            let requests = 0;
            const request = () => {
                requests++;
                app.renderNextFrame = true;
            };
            app.systems.gsplat.on('frame:request', request);
            try {
                const frame = pass.frame;
                for (let i = 0; i < 20; i++) {
                    app.renderNextFrame = false;
                    app.fire('framerender');
                    if (app.renderNextFrame) app.render();
                }
                assert(requests === 3 && pass.restFrames === 3 && pass.frame === frame + 3, 'On-demand refinement did not stop at its budget');
                const image = manager().renderer.resolveMaterial.getParameter('steadyImage').data;
                render();
                render();
                assert(pass.frame === frame + 3 && manager().renderer.resolveMaterial.getParameter('steadyImage').data === image, 'Converged rendering changed the retained image');
                camera.setPosition(0.02, 0, 3);
                render();
                assert(pass.frame === frame + 4 && pass.restFrames === 0, 'Camera motion did not resume reconstruction');
            } finally {
                app.systems.gsplat.off('frame:request', request);
                app.autoRender = true;
                settings.steadyConvergenceFrames = 16;
            }
        };
        checkRefinement(gsplat);
        record('requests finite on-demand refinement, freezes the last image and resumes on motion');

        gsplat.steadyHistoryWeight = 0;
        render();
        assert(pass.colors.length === 1 && pass.averages.length === 0, 'Disabling temporal reuse retained temporal resources');
        assert(pass.histories[0].length === 4, 'Disabling temporal reuse removed spatial occluder history');
        record('retains spatial reuse while disabling temporal accumulation and convergence');

        record(...(await runSteadyWebglNumericTests(device, manager().renderer, app.renderer, assert)));


        gsplat.steadyHistoryWeight = 0.7;
        render();
        render();
        gsplat.resetHistory();
        render();
        assert(pass.resolvePasses[1 - pass.writeIndex].parameters.get('steadyValid').data === 0, 'Explicit reset retained temporal history');
        const oldRaw = pass.raw;
        device.resizeCanvas(80, 56);
        render();
        assert(pass.width === 80 && pass.height === 56 && pass.raw !== oldRaw, 'Resize did not recreate render-sized resources');
        record('resets histories explicitly and recreates resources on resize');

        const second = new pc.Entity('Second Camera');
        second.addComponent('camera', { priority: 1 });
        second.setPosition(0.2, 0, 3);
        app.root.addChild(second);
        render();
        const secondData = app.renderer.gsplatDirector.camerasMap.get(second.camera.camera);
        const other = Array.from(secondData.layersMap.values())[0].gsplatManager.renderer;
        assert(other.steadyPass.histories[0][0] !== pass.histories[0][0], 'Cameras share visibility history');
        assert(other.steadyPass.colors[0] !== pass.colors[0], 'Cameras share accumulated color');
        assert(other.sampleMaterial.getParameter('steadyNoise').data === manager().renderer.sampleMaterial.getParameter('steadyNoise').data, 'Cameras do not share the cached STBN texture');
        second.destroy();
        render();
        record('keeps histories independent between cameras while sharing STBN');

        gsplat.enableIds = true;
        render();
        const picker = new pc.Picker(app, 80, 56, true);
        try {
            picker.prepare(lens, app.scene);
            const selection = await picker.getSelectionAsync(38, 26, 4, 4);
            assert(selection.includes(splat.gsplat), 'Native picking did not identify the gsplat component');
        } finally {
            picker.destroy();
        }
        render();
        record('retains native component picking with a stochastic forward renderer');

        const chunks = gsplat.material.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
        chunks.set('gsplatModifyPS', 'void modifySplatColor(vec2 uv, inout vec4 color) {}');
        gsplat.material.update();
        render();
        assert(manager().cpuSorter !== null && manager().renderer.renderPasses === null, 'Custom fragment coverage did not select CPU-sorted fallback');
        const waitForSort = (sortManager) => {
            const sortDeadline = Date.now() + 3000;
            const poll = () => {
                render();
                if (sortManager.world.currentState?.sortedBefore) return Promise.resolve();
                assert(Date.now() < sortDeadline, `CPU sort timed out: ${JSON.stringify({ current: sortManager.world.currentVersion,
                    latest: sortManager.world.lastWorldStateVersion,
                    jobs: sortManager.cpuSorter?.jobsInFlight })}`);
                return new Promise((resolve) => {
                    setTimeout(resolve, 10);
                }).then(poll);
            };
            return poll();
        };
        await waitForSort(manager());
        chunks.delete('gsplatModifyPS');
        gsplat.material.update();
        render();
        assert(manager().cpuSorter === null && manager().renderer.renderPasses !== null, 'Supported coverage did not restore unsorted reconstruction');
        record('switches to native CPU sorting for unsupported coverage and restores SteadySplats');

        const ramp = new pc.Texture(device, { width: 2, height: 1, mipmaps: false });
        ramp.lock().fill(255);
        ramp.unlock();
        try {
            const previousFrame = pass.frame;
            gsplat.colorRamp = ramp;
            render();
            assert(manager().cpuSorter !== null && manager().renderer.renderPasses === null, 'Overdraw did not select CPU sorting in the same frame');
            assert(pass.frame === previousFrame, 'Overdraw ran stochastic reconstruction');
            await waitForSort(manager());
            gsplat.colorRamp = null;
            render();
            assert(manager().cpuSorter === null && pass.frame === previousFrame + 1, 'Disabling overdraw did not immediately restore reconstruction');
        } finally {
            gsplat.colorRamp = null;
            ramp.destroy();
        }
        record('selects native sorting immediately when overdraw visualization is toggled');

        const centerlessAsset = new pc.Asset('Splats without CPU centers', 'gsplat');
        centerlessAsset.resource = new GSplatResource(device, data, { prepareCenters: false });
        centerlessAsset.loaded = true;
        app.assets.add(centerlessAsset);
        const centerless = new pc.Entity('Splats without CPU centers');
        centerless.addComponent('gsplat', { asset: centerlessAsset, unified: true });
        app.root.addChild(centerless);
        try {
            render();
            assert(manager().world.currentState.totalActiveSplats === 6, 'Unsorted rendering excluded resources without CPU centers');
            const version = manager().world.currentVersion;
            chunks.set('gsplatModifyPS', 'void modifySplatColor(vec2 uv, inout vec4 color) {}');
            gsplat.material.update();
            render();
            const fallback = manager().world.getState(manager().world.lastWorldStateVersion);
            assert(fallback.version > version && fallback.totalActiveSplats === 3, 'Fallback did not rebuild the world with CPU center requirements');
            assert(fallback.splats.every(info => info.resource.hasCenters), 'CPU fallback retained a resource without centers');
            await waitForSort(manager());
            assert(manager().cpuSorter.jobsInFlight === 0, 'Fallback sorting did not complete');
            chunks.delete('gsplatModifyPS');
            gsplat.material.update();
            render();
            assert(manager().cpuSorter === null && manager().world.currentState.totalActiveSplats === 6, 'Returning to SteadySplats did not restore resources without centers');
            assert(manager().world.currentVersion > fallback.version, 'Returning to SteadySplats reused the CPU-only world state');
        } finally {
            centerless.destroy();
            chunks.delete('gsplatModifyPS');
            gsplat.material.update();
            render();
            app.assets.remove(centerlessAsset);
            centerlessAsset.unload();
        }
        record('rebuilds center requirements on both transitions between unsorted rendering and CPU fallback');

        const projection = lens.camera.projectionMatrix.data;
        const originalDepthX = projection[2];
        try {
            projection[2] = 0.2;
            render();
            assert(manager().cpuSorter !== null && manager().renderer.renderPasses === null, 'Oblique projection did not select native CPU sorting');
            await waitForSort(manager());
        } finally {
            projection[2] = originalDepthX;
            render();
        }
        assert(manager().cpuSorter === null && manager().renderer.renderPasses !== null, 'Restoring perspective did not restore reconstruction');
        record('uses native sorting for oblique depth projections and restores supported perspective views');

        const transparentLayer = new pc.Layer({ name: 'Transparency after splats' });
        app.scene.layers.pushTransparent(transparentLayer);
        const previousLayers = lens.layers;
        lens.layers = [...previousLayers, transparentLayer.id];
        const transparentMaterial = new pc.StandardMaterial();
        transparentMaterial.useLighting = false;
        transparentMaterial.emissive.set(0, 0, 1);
        transparentMaterial.opacity = 0.5;
        transparentMaterial.blendType = pc.BLEND_NORMAL;
        transparentMaterial.depthWrite = false;
        transparentMaterial.cull = pc.CULLFACE_NONE;
        transparentMaterial.update();
        const transparent = new pc.Entity('Transparent plane behind splats');
        transparent.addComponent('render', { type: 'plane', material: transparentMaterial, layers: [transparentLayer.id] });
        transparent.setEulerAngles(90, 0, 0);
        transparent.setPosition(0, 0, -1);
        transparent.setLocalScale(4, 4, 4);
        transparent.enabled = false;
        app.root.addChild(transparent);
        const transparencyTarget = new pc.RenderTarget({
            colorBuffer: new pc.Texture(device, { width: 80, height: 56, format: pc.PIXELFORMAT_RGBA8, mipmaps: false }),
            depth: true
        });
        const previousTarget = lens.renderTarget;
        lens.renderTarget = transparencyTarget;
        try {
            for (let i = 0; i <= gsplat.steadyConvergenceFrames; i++) render();
            const before = await transparencyTarget.colorBuffer.read(39, 27, 2, 2, { immediate: true });
            const frame = pass.frame;
            transparent.enabled = true;
            render();
            assert(manager().cpuSorter === null && pass.frame === frame, 'Transparent geometry changed the converged reconstruction');
            const after = await transparencyTarget.colorBuffer.read(39, 27, 2, 2, { immediate: true });
            for (let i = 0; i < before.length; i++) {
                if (i % 4 === 3) continue;
                const expected = before[i] * 0.5 + (i % 4 === 2 ? 127.5 : 0);
                assert(Math.abs(after[i] - expected) <= 2, 'Reconstructed splat depth blocked a later transparent draw');
            }
        } finally {
            lens.renderTarget = previousTarget;
            lens.layers = previousLayers;
            transparent.destroy();
            app.scene.layers.remove(transparentLayer);
            transparentMaterial.destroy();
            transparencyTarget.destroyTextureBuffers();
            transparencyTarget.destroy();
        }
        record('blends later transparent geometry over reconstructed splats without writing hardware depth');

        lens.gammaCorrection = pc.GAMMA_SRGB;
        const frame = new CameraFrame(app, lens);
        try {
            frame.rendering.renderTargetScale = 0.5;
            frame.rendering.toneMapping = pc.TONEMAP_NONE;
            frame.update();
            render();
            assert(pass.width === 40 && pass.height === 28, 'CameraFrame samples use the wrong render resolution');
            assert(pass.samplePass.gammaCorrection === pc.GAMMA_NONE, 'CameraFrame HDR sampling uses display gamma');
            const sampleTarget = pass.samplePass.renderTarget;
            render();
            assert(pass.samplePass.renderTarget === sampleTarget, 'Scaled targets are recreated each frame');
            assert(lens.gammaCorrection === pc.GAMMA_SRGB, 'Sampling did not restore camera color settings');
        } finally {
            frame.destroy();
        }
        record('uses CameraFrame render scale and linear HDR sampling without repeated allocation');

        const composition = app.scene.layers;
        const world = composition.getLayerById(pc.LAYERID_WORLD);
        const target = new pc.RenderTarget({
            colorBuffer: new pc.Texture(device, {
                width: 36,
                height: 24,
                format: pc.PIXELFORMAT_RGBA16F,
                mipmaps: false
            }),
            depth: true
        });
        const early = new RenderPassForward(device, composition, app.scene, app.renderer, lens);
        early.init(null);
        early.gammaCorrection = pc.GAMMA_SRGB;
        early.addLayer(composition.getLayerById(pc.LAYERID_UI), true);
        early.addLayer(world, false);
        const late = new RenderPassForward(device, composition, app.scene, app.renderer, lens);
        late.init(target);
        late.gammaCorrection = pc.GAMMA_NONE;
        late.toneMapping = pc.TONEMAP_NONE;
        late.addLayer(world, true);
        lens.framePasses = [early, late];
        try {
            const previousFrame = pass.frame;
            render();
            assert(pass.width === 36 && pass.height === 24, 'Sampling used the target of a pass without splats');
            assert(pass.samplePass.gammaCorrection === pc.GAMMA_NONE, 'Sampling used color settings from a pass without splats');
            assert(pass.frame === previousFrame + 1, 'Split forward passes reconstructed more than once');
            assert(!early.internalBeforePasses.includes(pass) && late.internalBeforePasses.includes(pass), 'Reconstruction was scheduled before the wrong sublayer');
        } finally {
            lens.framePasses = [];
            early.destroy();
            late.destroy();
            target.destroyTextureBuffers();
            target.destroy();
        }
        record('uses the target and color settings of the forward pass drawing the splat sublayer');

        const light = new pc.Entity('Shadow light');
        light.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 64 });
        light.setEulerAngles(45, 30, 0);
        app.root.addChild(light);
        splat.gsplat.castShadows = true;
        render();
        assert(manager().shadowRenderer === null, 'WebGL2 created a compute-based shadow renderer');
        record('casts native splat shadows without allocating WebGPU compute resources');

        const caster = new pc.Entity('Separate shadow caster');
        caster.addComponent('gsplat', { asset, unified: true, castShadows: true });
        app.root.addChild(caster);
        splat.gsplat.castShadows = false;
        render();
        const layerData = app.renderer.gsplatDirector.camerasMap.get(lens.camera).layersMap.get(world);
        const shadowManager = layerData.gsplatManagerShadow;
        assert(shadowManager?.cpuSorter, 'The shadow-only manager did not retain native CPU sorting');
        await waitForSort(shadowManager);
        assert(shadowManager.world.currentState?.sortedBefore, 'The shadow-only work buffer never became render-ready');
        assert(shadowManager.renderer.steadyPass === null, 'A shadow-only manager allocated reconstruction targets');
        const orderTexture = shadowManager.world.workBuffer.orderTexture;
        const order = await orderTexture.read(0, 0, orderTexture.width, orderTexture.height, { immediate: true });
        assert(new Set(order.slice(0, 3)).size === 3, 'The shadow-only order texture did not contain all three splats');
        caster.destroy();
        splat.gsplat.castShadows = true;
        light.destroy();
        record('prepares native index data for a separate shadow-only manager without reconstruction');

        await new Promise((resolve, reject) => {
            const restoreTimeout = setTimeout(() => reject(new Error('WebGL2 context restoration timed out')), 5000);
            device.once('devicerestored', () => {
                clearTimeout(restoreTimeout);
                resolve();
            });
            device.debugLoseContext(25);
        });
        render();
        assert((await readIds()).some(id => id !== 0), 'Context restoration did not restore sample resources');
        assert(pass.resolvePasses[1 - pass.writeIndex].parameters.get('steadyValid').data === 0, 'Context restoration reused lost history');
        record('recreates native resources and invalidates history after WebGL2 context restoration');

        const biker = new pc.Asset('Biker', 'gsplat', { url: '/examples/assets/splats/biker.compressed.ply' });
        app.assets.add(biker);
        await new Promise((resolve, reject) => {
            biker.once('load', resolve);
            biker.once('error', reject);
            app.assets.load(biker);
        });
        splat.gsplat.asset = biker;
        splat.setEulerAngles(180, 90, 0);
        camera.setPosition(0, 1.4, 5);
        camera.lookAt(0, 1.4, 0);
        render();
        assert(biker.resource.numSplats === 152746, 'Biker fixture changed unexpectedly');
        assert((await readIds()).some(id => id !== 0), 'Compressed Biker asset produced no stochastic samples');
        record('renders the real compressed Biker example asset');

        const previous = manager().renderer.steadyPass;
        gsplat.renderer = pc.GSPLAT_RENDERER_AUTO;
        render();
        assert(previous.textures.length === 0 && previous.histories.every(history => history.length === 0), 'Switching renderers leaked history resources');
        record('releases reconstruction resources when switching back to automatic rendering');
        assert(!device.shaders.some(shader => shader.failed), 'A WebGL shader failed to compile or link');
        assert(device.gl.getError() === device.gl.NO_ERROR, 'WebGL reported an API error');
        return { tests,
            backend: device.deviceType,
            renderer: device.unmaskedRenderer,
            capabilities: { floatTargets: device.textureFloatRenderable, colorAttachments: device.maxColorAttachments } };
    } finally {
        app.destroy();
    }
}
