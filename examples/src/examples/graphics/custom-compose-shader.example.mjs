// @config DESCRIPTION This example shows how to customize the final compose pass by injecting a simple pixelation post-effect. Useful if no additional render passes are needed. Changes are applied globally to all CameraFrames.
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    apartment: new pc.Asset('apartment', 'container', { url: `${rootPath}/static/assets/models/apartment.glb` }),
    love: new pc.Asset('love', 'container', { url: `${rootPath}/static/assets/models/love.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler
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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome with low intensity
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.exposure = 1.2;

    // create an instance of the apartment and add it to the scene
    const platformEntity = assets.apartment.resource.instantiateRenderEntity();
    platformEntity.setLocalScale(30, 30, 30);
    app.root.addChild(platformEntity);

    // load a love sign model and add it to the scene
    const loveEntity = assets.love.resource.instantiateRenderEntity();
    loveEntity.setLocalPosition(-80, 30, -20);
    loveEntity.setLocalScale(130, 130, 130);
    loveEntity.rotate(0, -90, 0);
    app.root.addChild(loveEntity);

    // make the love sign emissive to bloom
    const loveMaterial = loveEntity.findByName('s.0009_Standard_FF00BB_0').render.meshInstances[0].material;
    loveMaterial.emissive = pc.Color.YELLOW;
    loveMaterial.emissiveIntensity = 200;
    loveMaterial.update();

    // adjust all materials of the love sign to disable dynamic refraction
    loveEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material.useDynamicRefraction = false;
        });
    });

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 1500,
        fov: 80
    });

    const focusPoint = new pc.Entity();
    focusPoint.setLocalPosition(-80, 80, -20);

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: focusPoint,
            distanceMax: 500,
            frameOnStart: false
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');

    cameraEntity.setLocalPosition(-50, 100, 220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // ------ Custom shader chunks for the camera frame ------

    // Note: Override these empty chunks with your own custom code. Available chunk names:
    // - composeDeclarationsPS: declarations for your custom code
    // - composeMainStartPS: code to run at the start of the compose code
    // - composeMainEndPS: code to run at the end of the compose code

    // Pixelation shader is based on this shadertoy shader: https://www.shadertoy.com/view/4dsXWs

    // Define the pixelation helper in declarations so it's available in main
    pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).set('composeDeclarationsPS', `
        uniform float pixelationTilePixels;
        uniform float pixelationIntensity;
        vec3 pixelateResult(vec3 color, vec2 uv, vec2 invRes) {
            vec2 tileUV = vec2(pixelationTilePixels, pixelationTilePixels) * invRes;
            vec2 centerUv = (floor(uv / tileUV) + 0.5) * tileUV;

            vec2 local = (uv - centerUv) / tileUV;
            float dist = length(local);
            float radius = 0.35;
            float edge = fwidth(dist) * 1.5;
            float mask = 1.0 - smoothstep(radius, radius + edge, dist);
            vec3 dotResult = mix(vec3(0.0), color, mask);
            return mix(color, dotResult, pixelationIntensity);
        }
    `);

    // WGSL equivalent declarations
    pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL).set('composeDeclarationsPS', `
        uniform pixelationTilePixels: f32;
        uniform pixelationIntensity: f32;
        fn pixelateResult(color: vec3f, uv: vec2f, invRes: vec2f) -> vec3f {
            let tileUV = vec2f(uniform.pixelationTilePixels, uniform.pixelationTilePixels) * invRes;
            let centerUv = (floor(uv / tileUV) + vec2f(0.5, 0.5)) * tileUV;
            let local = (uv - centerUv) / tileUV;
            let dist = length(local);
            let radius: f32 = 0.35;
            let edge: f32 = fwidth(dist) * 1.5;
            let mask: f32 = 1.0 - smoothstep(radius, radius + edge, dist);
            let dotResult = vec3f(0.0) * (1.0 - mask) + color * mask;
            return mix(color, dotResult, uniform.pixelationIntensity);
        }
    `);

    // Call the helper at the end of compose to apply on top of previous effects
    pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).set('composeMainEndPS', `
        result = pixelateResult(result, uv, sceneTextureInvRes);
    `);

    // WGSL equivalent call
    pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL).set('composeMainEndPS', `
        result = pixelateResult(result, uv, uniform.sceneTextureInvRes);
    `);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.samples = 4;
    cameraFrame.bloom.intensity = 0.03;
    cameraFrame.bloom.blurLevel = 7;
    cameraFrame.vignette.inner = 0.5;
    cameraFrame.vignette.outer = 1;
    cameraFrame.vignette.curvature = 0.5;
    cameraFrame.vignette.intensity = 0.8;

    cameraFrame.update();

    // apply UI changes (tone mapping only)
    data.on('*:set', (/** @type {string} */ path, value) => {
        if (path === 'data.sceneTonemapping') {
            // postprocessing tone mapping
            cameraFrame.rendering.toneMapping = value;
            cameraFrame.update();
        }

        if (path === 'data.pixelSize') {
            // global uniform for pixelation tile size
            device.scope.resolve('pixelationTilePixels').setValue(value);
        }

        if (path === 'data.pixelationIntensity') {
            device.scope.resolve('pixelationIntensity').setValue(value);
        }
    });

    // set initial values
    data.set('data', {
        sceneTonemapping: pc.TONEMAP_NEUTRAL,
        pixelSize: 8,
        pixelationIntensity: 0.5
    });
});

export { app };
