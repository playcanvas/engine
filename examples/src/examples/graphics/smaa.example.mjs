// @config
//
// @credit
// title: House 03 PBR
// author: Sketchfab
// source: https://sketchfab.com/3d-models/house-03-pbr-c56521b89188460a99235dec8bcd0ed3
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    house: new pc.Asset('house', 'container', { url: './assets/models/pbr-house.glb' }),
    cube: new pc.Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // CameraFrame owns the selected anti-aliasing mode, including its offscreen MSAA target.
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 0;
    app.scene.exposure = 2.5;

    // create an instance of the house and add it to the scene
    const houseEntity = assets.house.resource.instantiateRenderEntity();
    houseEntity.setLocalScale(100, 100, 100);
    app.root.addChild(houseEntity);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        nearClip: 10,
        farClip: 600,
        fov: 80
    });

    // add orbit camera script with a mouse and a touch support
    cameraEntity.addComponent('script');
    cameraEntity.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: houseEntity,
            distanceMax: 400,
            frameOnStart: true
        }
    });
    cameraEntity.script.create('orbitCameraInputMouse');
    cameraEntity.script.create('orbitCameraInputTouch');
    cameraEntity.setLocalPosition(0, 40, -220);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // Add a camera-relative high-contrast pattern. The thin diagonal bars make spatial aliasing
    // visible without relying on a particular edge in the model or on display pixel density.
    const createUnlitMaterial = (color) => {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.emissive = color;
        material.useLighting = false;
        material.update();
        return material;
    };
    const blackMaterial = createUnlitMaterial(pc.Color.BLACK);
    const whiteMaterial = createUnlitMaterial(pc.Color.WHITE);

    const aaPattern = new pc.Entity('AA comparison pattern');
    aaPattern.setLocalPosition(-15, 9, -30);
    cameraEntity.addChild(aaPattern);

    const patternBackground = new pc.Entity();
    patternBackground.addComponent('render', {
        type: 'box',
        material: blackMaterial
    });
    patternBackground.setLocalScale(14, 9, 0.1);
    aaPattern.addChild(patternBackground);

    for (let i = 0; i < 13; i++) {
        const bar = new pc.Entity();
        bar.addComponent('render', {
            type: 'box',
            material: whiteMaterial
        });
        bar.setLocalPosition(-6 + i, 0, 0.1);
        bar.setLocalEulerAngles(0, 0, 17);
        bar.setLocalScale(0.08, 8, 0.08);
        aaPattern.addChild(bar);
    }

    // add a shadow casting directional light
    const lightColor = new pc.Color(1, 1, 1);
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: lightColor,
        intensity: 1,
        range: 700,
        shadowResolution: 4096,
        shadowDistance: 600,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(40, 10, 0);

    const cubeEntity = assets.cube.resource.instantiateRenderEntity();
    cubeEntity.setLocalScale(30, 30, 30);
    app.root.addChild(cubeEntity);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
    cameraFrame.bloom.intensity = 0.02;
    cameraFrame.update();

    // ------

    const applySettings = () => {

        const method = data.get('data.aa.method') ?? 'smaa';
        cameraFrame.bloom.intensity = data.get('data.scene.bloom') ? 0.02 : 0;
        cameraFrame.smaa.enabled = method === 'smaa';
        cameraFrame.taa.enabled = method === 'taa';
        cameraFrame.taa.jitter = data.get('data.taa.jitter') ?? 1;
        cameraFrame.rendering.samples = method === 'msaa' ? 4 : 1;
        cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
        cameraFrame.rendering.sharpness = method === 'taa' ? (data.get('data.taa.sharpness') ?? 0.5) : 0;
        cameraFrame.update();
    };

    // apply UI changes
    data.on('*:set', applySettings);

    // set initial values
    data.set('data', {
        scene: {
            scale: 1,
            bloom: true
        },
        aa: {
            method: 'smaa'
        },
        taa: {
            jitter: 1,
            sharpness: 0.5
        }
    });

    let time = 0;
    app.on('update', (/** @type {number} */ dt) => {
        time += dt;
        cubeEntity.setLocalPosition(130 * Math.sin(time), 0, 130 * Math.cos(time));
        cubeEntity.rotate(50 * dt, 20 * dt, 30 * dt);
        aaPattern.setLocalPosition(-15 + 0.03 * Math.sin(time * 0.7), 9, -30);
    });
});
