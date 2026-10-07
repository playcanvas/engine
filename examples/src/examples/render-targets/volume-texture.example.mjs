// @config
//
// Fills a 3D (volume) texture with colorful fog data on the CPU, and raymarches it over the scene
// with a fullscreen quad, stopping at the scene geometry using the scene depth map.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_PREMULTIPLIED,
    BoundingBox,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Mat4,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_RGBA8,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
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
    )
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    density: 0.1,
    brightness: 1
});

// image based lighting only, no lights
app.scene.skyboxMip = 3;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// the terrain
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// the bounds of the terrain
const terrainBounds = new BoundingBox();
terrain.findComponents('render').forEach((render, renderIndex) => {
    render.meshInstances.forEach((meshInstance, index) => {
        if (renderIndex === 0 && index === 0) {
            terrainBounds.copy(meshInstance.aabb);
        } else {
            terrainBounds.add(meshInstance.aabb);
        }
    });
});

// the fog volume covers the terrain, from the bottom of its bounds up to about half its height
const boxMin = terrainBounds.getMin().clone();
const boxMax = terrainBounds.getMax().clone();
boxMax.y = boxMin.y + (boxMax.y - boxMin.y) * 0.525;

// the volume texture, rgb: fog color, a: fog density
const volumeWidth = 128;
const volumeHeight = 32;
const volumeDepth = 128;

// a fully saturated color of the specified hue (0..1)
const hueToColor = (hue) => {
    const channel = (n) => Math.min(1, Math.max(0, Math.abs(((hue * 6 + n) % 6) - 3) - 1));
    return new Color(channel(0), channel(4), channel(2));
};

// a seeded random number generator, so the fog looks the same on every run
let seed = 7;
const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

// a few colorful blobs of fog, at random positions and of different hues
const blobs = [];
for (let i = 0; i < 12; i++) {
    blobs.push({
        center: new Vec3(random(), random() * 0.6, random()),
        radius: 0.12 + random() * 0.15,
        color: hueToColor(i / 12)
    });
}

const fillVolume = () => {
    const voxels = new Uint8Array(volumeWidth * volumeHeight * volumeDepth * 4);
    let offset = 0;
    for (let z = 0; z < volumeDepth; z++) {
        const w = (z + 0.5) / volumeDepth;
        for (let y = 0; y < volumeHeight; y++) {
            const v = (y + 0.5) / volumeHeight;
            for (let x = 0; x < volumeWidth; x++) {
                const u = (x + 0.5) / volumeWidth;

                // sum the blobs, weighting their colors by their density
                let density = 0;
                let r = 0,
                    g = 0,
                    b = 0;
                for (let i = 0; i < blobs.length; i++) {
                    const blob = blobs[i];
                    const dx = u - blob.center.x;
                    const dy = (v - blob.center.y) * 0.5;
                    const dz = w - blob.center.z;
                    const d = Math.exp(-(dx * dx + dy * dy + dz * dz) / (blob.radius * blob.radius));
                    density += d;
                    r += d * blob.color.r;
                    g += d * blob.color.g;
                    b += d * blob.color.b;
                }

                // break the blobs up with some wavy detail, and fade out the fog towards the top
                const detail = 0.6 + 0.4 * Math.sin(u * 37 + Math.sin(w * 23)) * Math.sin(w * 31 + v * 11);
                const fade = (1 - v) * (1 - v);
                const scale = density > 0 ? 1 / density : 0;

                voxels[offset++] = Math.min(255, r * scale * 255);
                voxels[offset++] = Math.min(255, g * scale * 255);
                voxels[offset++] = Math.min(255, b * scale * 255);
                voxels[offset++] = Math.min(255, density * detail * fade * 255);
            }
        }
    }
    return voxels;
};

const volumeTexture = new Texture(device, {
    name: 'FogVolume',
    width: volumeWidth,
    height: volumeHeight,
    depth: volumeDepth,
    volume: true,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    addressW: ADDRESS_CLAMP_TO_EDGE,
    levels: [fillVolume()]
});

// a fullscreen quad raymarching the volume, rendered with the transparent objects of the world
// layer, so after the scene depth map is captured
const mesh = new Mesh(device);
mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
mesh.setIndices([0, 1, 2, 0, 2, 3]);
mesh.update();

const material = new ShaderMaterial({
    uniqueName: 'VolumeTextureShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION
    }
});
material.cull = CULLFACE_NONE;
material.depthTest = false;
material.depthWrite = false;
material.blendType = BLEND_PREMULTIPLIED;
material.setParameter('uVolume', volumeTexture);
material.setParameter('uBoxMin', [boxMin.x, boxMin.y, boxMin.z]);
material.setParameter('uBoxMax', [boxMax.x, boxMax.y, boxMax.z]);
material.update();

const meshInstance = new MeshInstance(mesh, material);

// the quad covers the screen, and is not culled by the camera frustum
meshInstance.cull = false;

const fog = new Entity('fog');
fog.addComponent('render', {
    meshInstances: [meshInstance]
});
app.root.addChild(fog);

// Find a tree in the middle to use as a focus point
// @ts-ignore
const tree = terrain.findOne('name', 'Arbol 2.002');

// the camera, with the scene depth map the fog stops at
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.9, 0.9, 0.9),
    farClip: 3000,
    toneMapping: TONEMAP_ACES
});
camera.camera.requestSceneDepthMap(true);
camera.setLocalPosition(600, 320, 50);

camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: tree,
        frameOnStart: false,
        distanceMax: 1800
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// the inverse view-projection matrix of the camera, used to compute the view rays
const invViewProjection = new Mat4();
app.on('framerender', () => {
    invViewProjection.mul2(camera.camera.projectionMatrix, camera.camera.viewMatrix).invert();
    material.setParameter('uInvViewProjection', invViewProjection.data);
    material.setParameter('uDensity', data.get('settings.density'));
    material.setParameter('uBrightness', data.get('settings.brightness'));
});
