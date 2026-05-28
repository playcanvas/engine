// @config
//
// This example loads the Khronos SpecularTest grid to visually verify the glTF KHR_materials_specular
// extension. Rows 1/2, 3/4 and 5/6 should each look identical (factor-only vs. texture-only with
// matching factor), and the last sphere on row 7 should look like a mirror ball.
//
// @flag HIDDEN
//
// @credit
// title: Specular Test
// author: Ed Mackey / Analytical Graphics, Inc.
// source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularTest
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: './assets/models/SpecularTest.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // IBL is required to see the dielectric F0 changes that the extension controls
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.exposure = 10;

    const testEntity = assets.model.resource.instantiateRenderEntity();
    app.root.addChild(testEntity);

    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: testEntity
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
    camera.script.orbitCamera.pitch = 0;
    camera.script.orbitCamera.yaw = 0;

    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: false,
        intensity: 1
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);
});
