// @config
//
// Bakes a statue from 64 directions into the layers of a texture array, using a render target per
// layer, and draws thousands of instanced impostors showing the view closest to the camera direction.

import {
    ADDRESS_CLAMP_TO_EDGE,
    ASPECT_MANUAL,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    LAYERID_WORLD,
    Layer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_SRGBA8,
    PROJECTION_ORTHOGRAPHIC,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_ATTR12,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TYPE_FLOAT32,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

import shaderGlslFrag from './shader.glsl.frag';
import shaderGlslVert from './shader.glsl.vert';
import shaderWgslFrag from './shader.wgsl.frag';
import shaderWgslVert from './shader.wgsl.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// image based lighting and a skybox
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.7;

// the baked views: 16 directions around the statue, at 4 elevations above the ground
const azimuthCount = 16;
const elevationCount = 4;
const elevationStep = 25 * math.DEG_TO_RAD;
const frameCount = azimuthCount * elevationCount;
const frameSize = 512;

// a layer only the baking cameras render
const bakeLayer = new Layer({ name: 'ImpostorBake' });
app.scene.layers.push(bakeLayer);

// a directional light, lighting both the baked statue and the world
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 1.5,
    layers: [LAYERID_WORLD, bakeLayer.id]
});
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

// the statue to bake, rendered by the baking cameras only
const bakeStatue = assets.statue.resource.instantiateRenderEntity();
bakeStatue.findComponents('render').forEach((render) => {
    render.layers = [bakeLayer.id];
});
app.root.addChild(bakeStatue);

// the bounding sphere of the statue, which each baked view frames
const aabb = new BoundingBox();
bakeStatue.findComponents('render').forEach((render, index) => {
    render.meshInstances.forEach((meshInstance, miIndex) => {
        if (index === 0 && miIndex === 0) {
            aabb.copy(meshInstance.aabb);
        } else {
            aabb.add(meshInstance.aabb);
        }
    });
});
const center = aabb.center.clone();
const radius = aabb.halfExtents.length();

// a texture array with a layer for each baked view
const impostorTexture = new Texture(device, {
    name: 'ImpostorTexture',
    width: frameSize,
    height: frameSize,
    arrayLength: frameCount,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

// an orthographic camera per baked view, each rendering to its own layer of the texture array
const bakeCameras = [];
for (let elevationIndex = 0; elevationIndex < elevationCount; elevationIndex++) {
    for (let azimuthIndex = 0; azimuthIndex < azimuthCount; azimuthIndex++) {
        const layer = elevationIndex * azimuthCount + azimuthIndex;

        // A render target regenerates the mipmaps of its color buffer after it renders. On WebGPU,
        // this only regenerates the mipmaps of the rendered layer. On WebGL2, the mipmaps of all 64
        // layers would be regenerated after each layer is rendered (see #9688), so there the
        // mipmap generation is disabled by the mipLevel option on all render targets except the
        // last one, which generates the mipmaps of the whole texture array once.
        const skipMipmaps = device.isWebGL2 && layer < frameCount - 1;

        const renderTarget = new RenderTarget({
            name: `ImpostorLayer${layer}`,
            colorBuffer: impostorTexture,
            layer: layer,
            depth: true,
            samples: 4,

            // store the views the same way as images, to sample them using the quad's uvs
            origin: RENDERTARGET_ORIGIN_TOP,

            // render to mip level 0 without generating mipmaps, see above
            mipLevel: skipMipmaps ? 0 : undefined
        });

        const azimuth = (azimuthIndex / azimuthCount) * Math.PI * 2;
        const elevation = elevationIndex * elevationStep;
        const direction = new Vec3(
            Math.cos(elevation) * Math.sin(azimuth),
            Math.sin(elevation),
            Math.cos(elevation) * Math.cos(azimuth)
        );

        const bakeCamera = new Entity(`ImpostorCamera${layer}`);
        bakeCamera.addComponent('camera', {
            layers: [bakeLayer.id],
            renderTarget: renderTarget,
            clearColor: new Color(0, 0, 0, 0),
            projection: PROJECTION_ORTHOGRAPHIC,
            orthoHeight: radius,
            aspectRatioMode: ASPECT_MANUAL,
            aspectRatio: 1,
            nearClip: radius,
            farClip: radius * 5,
            toneMapping: TONEMAP_ACES,

            // render in order, before the main camera
            priority: layer - frameCount
        });
        bakeCamera.setPosition(direction.mulScalar(radius * 3).add(center));
        bakeCamera.lookAt(center);
        app.root.addChild(bakeCamera);
        bakeCameras.push(bakeCamera);
    }
}

// the texture array is baked during the first frame, after which the baking cameras, their render
// targets and the statue are no longer needed. The texture array stays.
app.once('frameend', () => {
    bakeCameras.forEach((bakeCamera) => {
        const renderTarget = bakeCamera.camera.renderTarget;
        bakeCamera.destroy();
        renderTarget.destroy();
    });
    bakeStatue.destroy();
});

// a full statue in the middle of the field, at twice the size, for comparison
const statue = assets.statue.resource.instantiateRenderEntity();
statue.setLocalScale(2, 2, 2);
app.root.addChild(statue);

// the ground
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.35, 0.33, 0.3);
groundMaterial.gloss = 0.2;
groundMaterial.update();

const ground = new Entity('ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial
});
ground.setLocalScale(3000, 1, 3000);
app.root.addChild(ground);

// a quad with corners at -0.5 .. 0.5, which the shader orients to face the camera
const mesh = new Mesh(device);
mesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
mesh.setUvs(0, [0, 1, 1, 1, 1, 0, 0, 0]);
mesh.setIndices([0, 1, 2, 0, 2, 3]);
mesh.update();

const material = new ShaderMaterial({
    uniqueName: 'ImpostorShader',
    vertexGLSL: shaderGlslVert,
    fragmentGLSL: shaderGlslFrag,
    vertexWGSL: shaderWgslVert,
    fragmentWGSL: shaderWgslFrag,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0,
        aInstance: SEMANTIC_ATTR12
    }
});
material.cull = CULLFACE_NONE;
material.setParameter('uImpostorMap', impostorTexture);
material.setParameter('uCenterOffset', [center.x, center.y, center.z]);
material.setParameter('uRadius', radius);
material.setParameter('uFrameInfo', [azimuthCount, elevationCount, elevationStep]);
material.update();

// the statues are placed on a jittered grid, leaving the middle for the full statue
const gridSize = 60;
const spacing = radius * 2.5;
const instances = [];
for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
        const px = (x - (gridSize - 1) * 0.5 + (Math.random() - 0.5) * 0.6) * spacing;
        const pz = (z - (gridSize - 1) * 0.5 + (Math.random() - 0.5) * 0.6) * spacing;
        if (Math.abs(px) < spacing * 2 && Math.abs(pz) < spacing * 2) {
            continue;
        }
        instances.push(px, 0, pz, 0.7 + Math.random() * 0.6);
    }
}
const instanceCount = instances.length / 4;

const vertexFormat = new VertexFormat(device, [{ semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 }]);
const vertexBuffer = new VertexBuffer(device, vertexFormat, instanceCount, {
    data: new Float32Array(instances)
});

const meshInstance = new MeshInstance(mesh, material);
meshInstance.setInstancing(vertexBuffer);

// the instances cover the whole field, far outside of the bounds of the single quad
meshInstance.cull = false;

const impostors = new Entity('impostors');
impostors.addComponent('render', {
    meshInstances: [meshInstance]
});
app.root.addChild(impostors);

// the camera
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    toneMapping: TONEMAP_ACES,
    farClip: 5000
});
// start far enough out to see the field, looking slightly down at the full statue
const startDistance = radius * 11;
const startPitch = 14 * math.DEG_TO_RAD;
camera.setPosition(
    center.x * 2,
    center.y * 2 + startDistance * Math.sin(startPitch),
    center.z * 2 + startDistance * Math.cos(startPitch)
);
app.root.addChild(camera);

camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: statue,
        frameOnStart: false,
        distanceMax: spacing * gridSize,
        pitchAngleMin: 0,
        pitchAngleMax: 85
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
