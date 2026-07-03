// @config
//
// @credit
// title: Terrain Low Poly
// author: Sketchfab
// source: https://sketchfab.com/3d-models/terrain-low-poly-248b21331315466e98d20c441935d99d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_SKYBOX,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PlaneGeometry,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/terrain.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    texture: new Asset('color', 'texture', { url: './assets/textures/clouds.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('data', {
    softness: true
});

// Setup skydome
app.scene.skyboxMip = 3;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// Disable skydome rendering
const skyLayer = app.scene.layers.getLayerById(LAYERID_SKYBOX);
skyLayer.enabled = false;

// Instantiate the terrain
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// Find a tree in the middle to use as a focus point
const tree = terrain.findOne('name', 'Arbol 2.002');

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(150 / 255, 213 / 255, 63 / 255),
    farClip: 1000,
    toneMapping: TONEMAP_ACES
});

// and position it in the world
camera.setLocalPosition(-200, 120, 225);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: tree,
        distanceMax: 600
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Enable the camera to render the scene's depth map.
camera.camera.requestSceneDepthMap(true);

// Create a directional light casting cascaded shadows
const dirLight = new Entity();
dirLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    shadowBias: 0.3,
    normalOffsetBias: 0.2,
    intensity: 1.0,

    // Enable shadow casting
    castShadows: true,
    shadowDistance: 1000,
    shadowResolution: 2048,
    shadowType: SHADOW_PCF3_32F
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(45, 350, 20);

// Create a new material with a fog shader
const material = new ShaderMaterial({
    uniqueName: 'GroundFogShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_texCoord0: SEMANTIC_TEXCOORD0
    }
});
material.setParameter('uTexture', assets.texture.resource);
material.depthWrite = false;
material.blendType = BLEND_NORMAL;
material.update();

// Create a subdivided plane mesh, to allow for vertex animation by the shader
const mesh = Mesh.fromGeometry(app.graphicsDevice, new PlaneGeometry({ widthSegments: 20, lengthSegments: 20 }));
const meshInstance = new MeshInstance(mesh, material);
const ground = new Entity();
ground.addComponent('render', {
    meshInstances: [meshInstance],
    material: material,
    castShadows: false,
    receiveShadows: false
});
ground.setLocalScale(500, 1, 500);
ground.setLocalPosition(0, 25, 0);
app.root.addChild(ground);

let firstFrame = true;
let currentTime = 0;
app.on('update', dt => {
    // On the first frame, when camera is updated, move it further away from the focus tree
    if (firstFrame) {
        firstFrame = false;
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.distance = 320;
    }

    // Update the time and pass it to shader
    currentTime += dt;
    material.setParameter('uTime', currentTime);

    // Based on softness toggle, set shader parameter
    material.setParameter('uSoftening', data.get('data.softness') ? 50 : 1000);

    // Debug rendering of the depth texture in the corner
    app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
});
