// @config
// @flag HIDDEN
//
// Tests a lit front end setting the world position the lighting is evaluated at. The floor on the
// right is a LitMaterial whose front end moves that position back and forth along the x axis, so the
// spot light, its cookie, the shadows and the omni light slide across it, while the floor itself stays
// still. The floor on the left is a StandardMaterial, lit at its rasterized position, for comparison.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    LitMaterial,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SHADOW_PCF3_32F,
    StandardMaterial,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    heart: new Asset('heart', 'texture', { url: './assets/textures/heart.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.08, 0.08, 0.1);
app.scene.lighting.cookiesEnabled = true;
app.scene.lighting.shadowsEnabled = true;

// the floor on the left, lit at its rasterized position
const standardMaterial = new StandardMaterial();
standardMaterial.diffuse = new Color(0.8, 0.8, 0.8);
standardMaterial.update();

// the floor on the right, lit at the position its front end sets: the rasterized position moved by
// an offset. The front end also sets the geometric normal and the view direction to match the moved
// position, as the lit shader expects. The forward pass is the only one lighting the surface, and the
// only one declaring those globals. The albedo is linear, the diffuse color of the left floor in linear space
const litMaterial = new LitMaterial();
litMaterial.useSkybox = false;
litMaterial.shaderChunkGLSL = /* glsl */ `
    #include "litShaderCorePS"

    uniform vec3 positionOffset;

    void evaluateFrontend() {
        litArgs_albedo = vec3(0.6);
        litArgs_opacity = 1.0;
        litArgs_emission = vec3(0.0);
        litArgs_ao = 1.0;

        #ifdef FORWARD_PASS
            litArgs_worldPosition = vPositionW + positionOffset;
            litArgs_worldNormal = dVertexNormalW;
            dViewDirW = normalize(view_position - litArgs_worldPosition);
        #endif
    }
`;
litMaterial.shaderChunkWGSL = /* wgsl */ `
    #include "litShaderCorePS"

    uniform positionOffset: vec3f;

    fn evaluateFrontend() {
        litArgs_albedo = vec3f(0.6);
        litArgs_opacity = 1.0;
        litArgs_emission = vec3f(0.0);
        litArgs_ao = 1.0;

        #ifdef FORWARD_PASS
            litArgs_worldPosition = vPositionW + uniform.positionOffset;
            litArgs_worldNormal = dVertexNormalW;
            dViewDirW = normalize(uniform.view_position - litArgs_worldPosition);
        #endif
    }
`;
litMaterial.update();

/**
 * @param {number} x - The x position of the floor.
 * @param {StandardMaterial|LitMaterial} material - The material of the floor.
 */
const createFloor = (x, material) => {
    const floor = new Entity('Floor');
    floor.addComponent('render', { type: 'plane', material, castShadows: false });
    floor.setLocalScale(6, 1, 6);
    floor.setPosition(x, 0, 0);
    app.root.addChild(floor);

    // boxes casting shadows onto the floor
    [-1.5, 1.5].forEach((z) => {
        const box = new Entity('Box');
        box.addComponent('render', { type: 'box', material: standardMaterial });
        box.setLocalScale(0.6, 1.2, 0.6);
        box.setPosition(x, 0.6, z);
        app.root.addChild(box);
    });

    // a spot light with a cookie and shadows, and an omni light
    const spot = new Entity('Spot');
    spot.addComponent('light', {
        type: 'spot',
        color: new Color(1, 0.9, 0.7),
        intensity: 3,
        range: 12,
        innerConeAngle: 25,
        outerConeAngle: 35,
        castShadows: true,
        shadowType: SHADOW_PCF3_32F,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        cookie: assets.heart.resource,
        cookieChannel: 'a'
    });
    spot.setPosition(x, 5, 0);
    app.root.addChild(spot);

    const omni = new Entity('Omni');
    omni.addComponent('light', {
        type: 'omni',
        color: new Color(0.3, 0.5, 1),
        intensity: 2,
        range: 3
    });
    omni.setPosition(x + 2, 0.5, 2);
    app.root.addChild(omni);
};

createFloor(-3.5, standardMaterial);
createFloor(3.5, litMaterial);

const camera = new Entity('Camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.1, 0.12) });
camera.setPosition(0, 9, 9);
camera.addComponent('script');
app.root.addChild(camera);
const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cc.focusPoint = new Vec3(0, 0, 0);

const offset = new Float32Array(3);
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;
    offset[0] = Math.sin(time) * 1.5;
    litMaterial.setParameter('positionOffset', offset);
    litMaterial.update();
});
