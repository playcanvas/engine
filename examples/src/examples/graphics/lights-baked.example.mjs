// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.lightmapper = pc.Lightmapper;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];

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

app.start();

// create material used on the geometry
const material = new pc.StandardMaterial();
material.gloss = 0.6;
material.metalness = 0.4;
material.useMetalness = true;
material.update();

// All render component primitive shape types
const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule', 'torus'];

for (let i = 0; i < 40; i++) {
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    // Create an entity with a render component that is set up to be lightmapped with baked direct lighting
    const entity = new pc.Entity();
    entity.addComponent('render', {
        castShadows: false,
        castShadowsLightmap: true,
        lightmapped: true,
        type: shape,
        material: material
    });
    app.root.addChild(entity);

    // random orientation
    entity.setLocalPosition(Math.random() * 10 - 5, Math.random() * 5, Math.random() * 10 - 5);
}

const ground = new pc.Entity();
ground.addComponent('render', {
    castShadows: false,
    castShadowsLightmap: false,
    lightmapped: true,
    type: 'plane',
    material: material
});
app.root.addChild(ground);
ground.setLocalPosition(0, -1, 0);
ground.setLocalScale(40, 40, 40);

// Create an entity with a directional light component that is configured as a baked light
const light = new pc.Entity();
light.addComponent('light', {
    affectDynamic: false,
    affectLightmapped: true,
    bake: true,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 50,
    shadowResolution: 2048,
    shadowType: pc.SHADOW_PCF3,
    color: pc.Color.GREEN,
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with an omni light component that is configured as a baked light
const lightPoint = new pc.Entity();
lightPoint.addComponent('light', {
    affectDynamic: false,
    affectLightmapped: true,
    bake: true,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 50,
    shadowResolution: 512,
    shadowType: pc.SHADOW_PCF3,
    color: pc.Color.RED,
    range: 100,
    type: 'point'
});
lightPoint.setLocalPosition(0, 2, 0);
app.root.addChild(lightPoint);

// Create an entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.4, 0.45, 0.5),
    farClip: 100,
    nearClip: 0.05
});
app.root.addChild(camera);

// lightmap baking properties
app.scene.lightmapMode = pc.BAKE_COLOR;
app.scene.lightmapMaxResolution = 2048;

// For baked lights, this property perhaps has the biggest impact on lightmap resolution:
app.scene.lightmapSizeMultiplier = 32;

// bake lightmaps
app.lightmapper.bake(null, pc.BAKE_COLORDIR);

// Set an update function on the app's update event
let time = 4;
app.on('update', function (dt) {
    time += dt;

    // orbit camera
    camera.setLocalPosition(20 * Math.sin(time * 0.4), 3, 6);
    camera.lookAt(pc.Vec3.ZERO);
});

export { app };
