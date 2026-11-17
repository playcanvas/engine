// @config
//
// A frosted glass shader refracting the scene color map, which the Depth layer grabs with mipmaps.
// The rougher the glass, the more blurred the mip level it samples.
//
// @credit
// title: Wide Street 02
// author: Poly Haven
// source: https://polyhaven.com/a/wide_street_02
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    EnvLighting,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_DEPTH,
    LightComponentSystem,
    MIPMAPFILTER_BOX,
    MIPMAPFILTER_GAUSSIAN,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RoundedBoxGeometry,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SHADOW_VSM_16F,
    SKYTYPE_DOME,
    ScriptComponentSystem,
    ShaderMaterial,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    roughness: new Asset('roughness', 'texture', { url: './assets/textures/pc-gray.png' }),
    hdri: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false })
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
createOptions.resourceHandlers = [TextureHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// The street the scene stands in, a full resolution skybox projected onto a dome with a flat
// ground, and the environment lighting generated from the same HDRI
const applyHdri = () => {
    const source = assets.hdri.resource;
    app.scene.skybox?.destroy();
    app.scene.skybox = EnvLighting.generateSkyboxCubemap(source);
    const lighting = EnvLighting.generateLightingSource(source);
    app.scene.envAtlas?.destroy();
    app.scene.envAtlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
};
applyHdri();
device.on('devicerestored', applyHdri);

app.scene.sky.type = SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new Vec3(200, 200, 200));
app.scene.sky.center = new Vec3(0, 0.05, 0);
app.scene.exposure = 0.7;

// The sun casts soft shadows of the shapes, onto a shadow catcher on the ground
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    intensity: 1.5,
    castShadows: true,
    shadowDistance: 60,
    shadowIntensity: 0.7,
    shadowResolution: 2048,
    shadowType: SHADOW_VSM_16F
});
sun.setEulerAngles(50, 30, 0);
app.root.addChild(sun);

const shadowCatcher = new Entity('ShadowCatcher');
shadowCatcher.addComponent('script');
shadowCatcher.script.create(ShadowCatcher, {
    properties: {
        scale: new Vec3(60, 60, 60)
    }
});
app.root.addChild(shadowCatcher);

// Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
// Move the depth layer to take place after World and Skydome layers, to capture both of them.
const depthLayer = app.scene.layers.getLayerById(LAYERID_DEPTH);
app.scene.layers.remove(depthLayer);
app.scene.layers.insertOpaque(depthLayer, 2);

// A ring of shapes around the glass. Those behind it rise to its height, to be seen refracted
// through it, and those in front of it rest on the ground, clear of the view of the glass.
/** @type {{ type: RenderComponent['type'], color: string }[]} */
const SHAPES = [
    { type: 'sphere', color: '#ff6b6b' },
    { type: 'torus', color: '#feca57' },
    { type: 'cone', color: '#1dd1a1' },
    { type: 'capsule', color: '#48dbfb' },
    { type: 'cylinder', color: '#8c5cf0' },
    { type: 'box', color: '#ff9ff3' },
    { type: 'torus', color: '#54a0ff' }
];
const shapes = SHAPES.map(({ type, color }, index) => {
    const material = new StandardMaterial();
    material.diffuse = new Color().fromString(color);
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    const shape = new Entity(type);
    shape.addComponent('render', { type, material });
    const angle = (2 * Math.PI * index) / SHAPES.length;
    shape.setLocalPosition(9 * Math.sin(angle), 0, 9 * Math.cos(angle));
    shape.setLocalScale(4, 4, 4);

    // the tori stand up as rings, and the capsule lies down
    if (type === 'torus') {
        shape.setLocalEulerAngles(90, 0, 0);
    } else if (type === 'capsule') {
        shape.setLocalEulerAngles(0, 0, 90);
    }
    app.root.addChild(shape);

    // the height at which the shape rests on the ground
    shape.translate(0, -shape.render.meshInstances[0].aabb.getMin().y, 0);
    return { shape, restHeight: shape.getLocalPosition().y };
});
const SHAPE_LIFT = 7;

// Create the camera, which renders entities
const camera = new Entity('SceneCamera');
camera.addComponent('camera', {
    farClip: 500,
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

// Enable the camera to render the scene's color map.
camera.camera.requestSceneColorMap(true);

// The glass is a rounded cube, frosted around a clear logo. Its shader samples the scene color
// map, blurred more on the rougher parts of the glass.
const glassMaterial = new ShaderMaterial({
    uniqueName: 'GlassShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_normal: SEMANTIC_NORMAL,
        vertex_texCoord0: SEMANTIC_TEXCOORD0
    }
});
glassMaterial.setParameter('uOffsetMap', assets.normal.resource);
glassMaterial.setParameter('uRoughnessMap', assets.roughness.resource);

// Transparent, so it renders after the Depth layer captured the scene behind it
glassMaterial.blendType = BLEND_NORMAL;
glassMaterial.update();

const glass = new Entity('Glass');
glass.addComponent('render', { castShadows: false });
const glassMesh = Mesh.fromGeometry(device, new RoundedBoxGeometry({ radius: 0.12, radiusSegments: 8 }));
glass.render.meshInstances = [new MeshInstance(glassMesh, glassMaterial)];
glass.setLocalPosition(0, 9.5, 0);
glass.setLocalScale(7, 7, 7);
app.root.addChild(glass);

// The mipmaps of the scene color map are generated with the Gaussian filter, which blurs the
// frosted glass smoothly, or with the box filter, whose blocks flicker as the scene moves
data.set('settings', { gaussian: true });
const applyMipmapFilter = () => {
    camera.camera.sceneColorMapMipmapFilter = data.get('settings.gaussian') ? MIPMAPFILTER_GAUSSIAN : MIPMAPFILTER_BOX;
};
data.on('settings.gaussian:set', applyMipmapFilter);
applyMipmapFilter();

// Update things each frame
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // Orbit the camera
    const cameraX = 27 * Math.sin(time * 0.2);
    const cameraZ = 27 * Math.cos(time * 0.2);
    camera.setLocalPosition(cameraX, 7, cameraZ);
    camera.lookAt(0, 7.5, 0);

    // Spin the shapes, lifting them the further behind the glass they are from the camera
    shapes.forEach(({ shape, restHeight }) => {
        const { x, z } = shape.getLocalPosition();
        const behind = -(x * cameraX + z * cameraZ) / (Math.hypot(x, z) * 27);
        const lift = SHAPE_LIFT * math.smoothstep(0.3, 0.9, behind);
        shape.setLocalPosition(x, restHeight + lift, z);
        shape.rotate(0, 20 * dt, 0);
    });

    // Tumble the glass
    glass.rotate(-6 * dt, 6 * dt, -9 * dt);
});
