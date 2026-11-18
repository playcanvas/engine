// @config
//
// Loads several assets from a single bundle: a tar archive of their files. The statue model with
// its textures, and the environment atlas lighting the scene, are downloaded as one file, and each
// asset is then loaded from the archive instead of being requested separately.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    CylinderGeometry,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    LAYERID_SKYBOX,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    SSAOTYPE_COMBINE,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES2,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

// The tar file has been created from the examples folder by a command line:
// : cd engine/examples/
// : COPYFILE_DISABLE=1 tar --format ustar --no-mac-metadata -cvf assets/bundles/bundle.tar
//       ./assets/models/statue.glb ./assets/cubemaps/product-studio-env-atlas.png

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    bundle: new Asset('bundle', 'bundle', { url: './assets/bundles/bundle.tar' }),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    studio: new Asset(
        'studio-env-atlas',
        'texture',
        { url: './assets/cubemaps/product-studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

// The bundle lists the ids of the assets it contains
assets.bundle.data = { assets: [assets.statue.id, assets.studio.id] };

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

// Load the assets. Only the tar file is downloaded, and the assets are loaded from its files.
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Soft studio reflections and ambient light from the bundled environment atlas. The skybox is not
// rendered, the dark backdrop is the clear color of the camera.
app.scene.envAtlas = assets.studio.resource;
app.scene.skyboxIntensity = 0.35;
app.scene.exposure = 1;

// The statue from the bundled model, measured to frame the scene around it
const statue = assets.statue.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
app.root.addChild(statue);

const bounds = new BoundingBox();
statue.findComponents('render').forEach((render, index) => {
    render.meshInstances.forEach((meshInstance, meshIndex) => {
        if (index === 0 && meshIndex === 0) {
            bounds.copy(meshInstance.aabb);
        } else {
            bounds.add(meshInstance.aabb);
        }
    });
});
const height = bounds.halfExtents.y * 2;
const radius = Math.max(bounds.halfExtents.x, bounds.halfExtents.z);

// A polished dark stone plinth
const plinthHeight = height * 0.12;
const plinthMaterial = new StandardMaterial();
plinthMaterial.diffuse = new Color(0.02, 0.02, 0.022);
plinthMaterial.useMetalness = true;
plinthMaterial.metalness = 0;
plinthMaterial.gloss = 0.75;
plinthMaterial.clearCoat = 1;
plinthMaterial.clearCoatGloss = 0.9;
plinthMaterial.update();

const plinth = new Entity('Plinth');
const plinthMesh = Mesh.fromGeometry(device, new CylinderGeometry({ capSegments: 96, heightSegments: 1 }));
plinth.addComponent('render', {
    meshInstances: [new MeshInstance(plinthMesh, plinthMaterial)],
    castShadows: true
});
plinth.setLocalScale(radius * 2.6, plinthHeight, radius * 2.6);
plinth.setLocalPosition(bounds.center.x, plinthHeight * 0.5, bounds.center.z);
app.root.addChild(plinth);

// Stand the statue on the plinth
statue.setLocalPosition(0, plinthHeight - (bounds.center.y - bounds.halfExtents.y), 0);

// A large floor matching the backdrop, catching the shadows and a soft reflection of the lights
const backdrop = new Color(0.07, 0.072, 0.08);
const floorMaterial = new StandardMaterial();
floorMaterial.diffuse = new Color(0.16, 0.16, 0.17);
floorMaterial.useMetalness = true;
floorMaterial.metalness = 0;
floorMaterial.gloss = 0.45;
floorMaterial.update();

const floor = new Entity('Floor');
floor.addComponent('render', { type: 'plane', material: floorMaterial });
floor.setLocalScale(height * 30, 1, height * 30);
floor.setLocalPosition(bounds.center.x, 0, bounds.center.z);
app.root.addChild(floor);

// A warm key light from above, with soft shadows
const key = new Entity('Key');
key.addComponent('light', {
    type: 'spot',
    color: new Color(1, 0.86, 0.7),
    intensity: 6,
    range: height * 6,
    innerConeAngle: 15,
    outerConeAngle: 38,
    castShadows: true,
    shadowType: SHADOW_PCF5_32F,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.02
});
key.setLocalPosition(bounds.center.x + height * 0.9, height * 2.6, bounds.center.z + height * 1.1);
key.lookAt(bounds.center.x, height * 0.4, bounds.center.z);
key.rotateLocal(90, 0, 0);
app.root.addChild(key);

// A cool rim light from behind, separating the statue from the backdrop
const rim = new Entity('Rim');
rim.addComponent('light', {
    type: 'spot',
    color: new Color(0.55, 0.7, 1),
    intensity: 5,
    range: height * 6,
    innerConeAngle: 12,
    outerConeAngle: 22
});
rim.setLocalPosition(bounds.center.x - height * 0.8, height * 1.1, bounds.center.z - height * 1.6);
rim.lookAt(bounds.center.x, height * 0.9, bounds.center.z);
rim.rotateLocal(90, 0, 0);
app.root.addChild(rim);

// The camera, with ambient occlusion, a touch of bloom and a vignette fading into the backdrop
const camera = new Entity('Camera');
camera.addComponent('camera', {
    // the clear color is written to the HDR frame as is, so it is given in linear space to match the fog
    clearColor: backdrop.clone().linear(),
    fov: 35,
    nearClip: height * 0.05,
    farClip: height * 40
});
app.root.addChild(camera);

// The environment atlas only lights the scene, the skybox is not rendered
camera.camera.layers = camera.camera.layers.filter((id) => id !== LAYERID_SKYBOX);

// Fog fades the floor into the backdrop, hiding its edge
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = backdrop;
app.scene.fog.start = height * 4;
app.scene.fog.end = height * 9;

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES2;
cameraFrame.rendering.samples = 4;
cameraFrame.ssao.type = SSAOTYPE_COMBINE;
cameraFrame.ssao.intensity = 0.6;
cameraFrame.ssao.radius = height * 0.15;
cameraFrame.bloom.intensity = 0.015;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.vignette.intensity = 0.7;
cameraFrame.vignette.inner = 0.3;
cameraFrame.vignette.outer = 1.3;
cameraFrame.vignette.curvature = 0.6;
cameraFrame.update();

// Slowly orbit the camera around the statue, from slightly below its head
const target = bounds.center.clone();
target.y = plinthHeight + height * 0.45;
const distance = height * 2.5;
let angle = 0.6;
app.on('update', (dt) => {
    angle += dt * 0.15;
    camera.setLocalPosition(
        target.x + Math.sin(angle) * distance,
        target.y + height * 0.12,
        target.z + Math.cos(angle) * distance
    );
    camera.lookAt(target);
});

export { app };
