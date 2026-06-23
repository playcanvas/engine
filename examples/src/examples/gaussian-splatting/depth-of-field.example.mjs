// @config
//
// `WASD` Move · `Space` Jump · `Mouse` Look
//
// A Gaussian Splatting scene using Depth of Field post-processing, where the depth is based on a
// proxy mesh.
//
// @flag PREFERRED_DEVICE=webgpu
//
// @credit
// title: Ice Cave
// author: SpAItial AI
// source: https://spaitial.ai/

import * as pc from 'playcanvas';
import { FirstPersonController } from 'playcanvas/scripts/esm/first-person-controller.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// physics engine (Ammo) - required for the character controller and the mesh collider
pc.WasmModule.setConfig('Ammo', {
    glueUrl: './assets/wasm/ammo/ammo.wasm.js',
    wasmUrl: './assets/wasm/ammo/ammo.wasm.wasm',
    fallbackUrl: './assets/wasm/ammo/ammo.js'
});

// Draco decoder - the proxy and collision meshes are Draco-compressed glbs
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await Promise.all([
    new Promise((resolve) => {
        pc.WasmModule.getInstance('Ammo', () => resolve(true));
    }),
    new Promise((resolve) => {
        pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
    })
]);

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. Gaussian splats do not benefit from MSAA either.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.gamepads = new pc.GamePads();

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.GSplatHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    island: new pc.Asset('gsplat', 'gsplat', { url: 'https://code.playcanvas.com/examples_data/example_cave_01/lod-meta.json' }),
    proxy: new pc.Asset('proxy', 'container', { url: './assets/models/cave.glb' }),
    collision: new pc.Asset('collision', 'container', { url: './assets/models/cave-collision.glb' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.systems.rigidbody?.gravity.set(0, -10, 0);

    // cap the number of rendered splats - lower on mobile to keep performance up
    app.scene.gsplat.splatBudget = (pc.platform.mobile ? 1 : 3) * 1000000;

    // use the GPU-sort raster renderer on WebGPU, CPU-sort on WebGL
    app.scene.gsplat.renderer = device.isWebGPU ?
        pc.GSPLAT_RENDERER_RASTER_GPU_SORT :
        pc.GSPLAT_RENDERER_RASTER_CPU_SORT;

    // ------ Content root ------
    // The splat and the proxy / collision meshes share the same coordinate space, so we parent
    // them to a single entity to keep them aligned.
    const content = new pc.Entity('content');
    app.root.addChild(content);

    // ------ Gaussian Splat ------
    // The splat is rendered as usual, in the transparent sublayer of the world layer.
    const splat = new pc.Entity('splat');
    splat.addComponent('gsplat', {
        asset: assets.island
    });
    content.addChild(splat);

    // Fast time to first frame: start by loading only the coarsest LOD level so the splat appears
    // almost immediately. Once it is on screen, restore the full LOD range (so higher detail
    // streams in) and enable Depth of Field at the same time.
    const lodLevels = splat.gsplat.resource?.octree?.lodLevels;
    if (lodLevels) {
        splat.gsplat.lodRangeMin = lodLevels - 1;
        splat.gsplat.lodRangeMax = lodLevels - 1;
    }
    const onFrameReady = (camera, layer, ready, loadingCount) => {
        if (ready && loadingCount === 0) {
            app.systems.gsplat.off('frame:ready', onFrameReady);
            if (lodLevels) {
                splat.gsplat.lodRangeMin = 0;
                splat.gsplat.lodRangeMax = lodLevels - 1;
            }
            data.set('data.dof.enabled', true);
        }
    };
    app.systems.gsplat.on('frame:ready', onFrameReady);

    // ------ Proxy geometry (depth only) ------
    // A detailed mesh approximating the splat geometry. It writes depth and so feeds the camera
    // depth prepass used by DOF, but we exclude it from the forward (color) pass via the mesh
    // instance shaderPassMask, so it contributes depth only and is never visible.
    const proxy = assets.proxy.resource.instantiateRenderEntity();
    // the reconstructed mesh is flipped relative to the splat, so flip just the proxy to match
    proxy.setLocalEulerAngles(180, 0, 0);
    content.addChild(proxy);

    proxy.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
        render.meshInstances.forEach((mi) => {
            // keep the mesh in the depth prepass but exclude it from the forward (color) pass
            mi.shaderPassMask &= ~(1 << pc.SHADER_FORWARD);
        });
    });

    // ------ Collision geometry ------
    // A simplified, positions-only mesh used purely as a static triangle-mesh collider. It is
    // flipped to match the splat (like the proxy) and its rendering is disabled - it only provides
    // the surface the character controller walks on.
    const collision = assets.collision.resource.instantiateRenderEntity();
    collision.setLocalEulerAngles(180, 0, 0);
    collision.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
        const entity = render.entity;
        entity.addComponent('rigidbody', {
            type: 'static',
            friction: 0.5,
            restitution: 0
        });
        entity.addComponent('collision', {
            type: 'mesh',
            renderAsset: render.asset
        });
        render.enabled = false;
    });
    content.addChild(collision);

    // ------ First-person character controller ------
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.55, 0.7),
        farClip: 1000,
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(0, 0.35, 0);

    // The cave interior is only ~3.4 units tall (floor ≈ -0.9, ceiling ≈ 2.5). A small capsule that
    // sits just above the floor - spawning higher would straddle the ceiling and the physics solver
    // would eject the body out of the world.
    const characterController = new pc.Entity('character-controller');
    // camera sits 0.35 above the controller, so the controller Y is the desired eye Y minus 0.35
    characterController.setPosition(0.10, -0.45, 0.06);
    characterController.addChild(camera);
    characterController.addComponent('collision', {
        type: 'capsule',
        radius: 0.2,
        height: 0.9
    });
    characterController.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 100,
        linearDamping: 0,
        angularDamping: 0,
        linearFactor: pc.Vec3.ONE,
        angularFactor: pc.Vec3.ZERO,
        friction: 0.5,
        restitution: 0
    });
    characterController.addComponent('script');
    const fpc = /** @type {any} */ (characterController.script.create(FirstPersonController, {
        properties: {
            camera,
            jumpForce: 420,
            speedGround: 25,
            sprintMult: 1.73
        }
    }));
    // seed the initial look direction (pitch, yaw) - the controller keeps both in the camera's
    // local euler angles, matching the values logged from the camera
    fpc._angles.set(-10.2, 35.3, 0);
    app.root.addChild(characterController);

    // ------ Camera frame with Depth of Field ------
    // Enabling DOF automatically enables the camera depth prepass. The prepass renders opaque
    // world-layer meshes that write depth (our proxy mesh) into a linear depth texture, which the
    // DOF effect samples. The transparent splat is then blurred according to the proxy depth.
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.rendering.samples = 4;
    cameraFrame.vignette.inner = 0.5;
    cameraFrame.vignette.outer = 1.4;
    cameraFrame.vignette.curvature = 0.5;
    cameraFrame.vignette.intensity = 0.4;
    // near blur and high quality are left on; focus distance / range are driven by autofocus below
    cameraFrame.dof.nearBlur = true;
    cameraFrame.dof.highQuality = true;
    cameraFrame.update();

    const applySettings = () => {
        const dofEnabled = data.get('data.dof.enabled');
        cameraFrame.dof.enabled = dofEnabled;
        cameraFrame.dof.blurRadius = data.get('data.dof.blurRadius');
        cameraFrame.dof.blurRings = data.get('data.dof.blurRings');
        cameraFrame.dof.blurRingPoints = data.get('data.dof.blurRingPoints');
        // enable sharpening together with DOF (both kick in on the first ready frame)
        cameraFrame.rendering.sharpness = dofEnabled ? 1 : 0;
        cameraFrame.update();
    };

    // apply UI changes
    data.on('*:set', () => {
        applySettings();
    });

    // ------ Autofocus ------
    // Raycast the physics (collision) mesh straight ahead from the camera and focus DOF on the hit
    // point. A small HTML reticle marks the focus point at the center of the screen.
    const focusReticle = document.createElement('div');
    focusReticle.style.cssText = 'position:absolute;left:50%;top:50%;width:28px;height:28px;' +
        'margin:-16px 0 0 -16px;border:2px solid rgba(255,255,255,0.85);border-radius:50%;' +
        'box-shadow:0 0 3px rgba(0,0,0,0.7);pointer-events:none;display:none;';
    document.body.appendChild(focusReticle);
    app.on('destroy', () => focusReticle.remove());

    const rayStart = new pc.Vec3();
    const rayDir = new pc.Vec3();
    const rayEnd = new pc.Vec3();

    // smoothed focus distance, eased toward the ray hit for a cinematic focus pull (~0.5s settle)
    let smoothedFocus = 5;
    let targetFocus = 5;
    const FOCUS_TAU = 0.15;

    // focus range driven from the focus distance: linear through (0.5, 0.15) and (10, 2), so it is
    // a tight macro-like range up close and widens with distance
    const focusRangeForDistance = (d) => {
        const range = 0.15 + (d - 0.5) * (2 - 0.15) / (10 - 0.5);
        return Math.max(0.05, range);
    };

    app.on('update', (dt) => {
        if (!data.get('data.dof.enabled')) {
            focusReticle.style.display = 'none';
            return;
        }
        const camPos = camera.getPosition();
        rayDir.copy(camera.forward);
        // start a little ahead of the camera so the ray does not hit the player's own capsule
        rayStart.copy(rayDir).mulScalar(0.3).add(camPos);
        rayEnd.copy(rayDir).mulScalar(1000).add(camPos);
        const hit = app.systems.rigidbody.raycastFirst(rayStart, rayEnd);
        if (hit) {
            targetFocus = camPos.distance(hit.point);
            focusReticle.style.display = 'block';
        } else {
            focusReticle.style.display = 'none';
        }

        // ease the focus distance toward the target (frame-rate independent), and derive the range
        smoothedFocus += (targetFocus - smoothedFocus) * (1 - Math.exp(-dt / FOCUS_TAU));
        cameraFrame.dof.focusDistance = smoothedFocus;
        cameraFrame.dof.focusRange = focusRangeForDistance(smoothedFocus);
        cameraFrame.update();
    });

    // set initial values
    data.set('data', {
        dof: {
            // enabled once the first (coarse) splat frame is ready - see the frame:ready handler
            enabled: false,
            blurRadius: 5,
            blurRings: 4,
            blurRingPoints: 5
        }
    });
});
