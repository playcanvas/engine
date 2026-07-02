// @config
//
// Multi-draw instanced rendering of multiple primitives in one call. WebGL2 lacks support for
// firstInstance for sub-draws, so instance data lives in a data texture and is fetched in the vertex
// shader via base[gl_DrawID] + gl_InstanceID — portable and fast workaround.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoxGeometry,
    CameraComponentSystem,
    Color,
    CylinderGeometry,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    Geometry,
    Mat4,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGBA32F,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_ATTR11,
    SphereGeometry,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TYPE_INT32,
    Texture,
    TextureHandler,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import transformInstancingVert from './transform-instancing.vert';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
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
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 0.3;
app.scene.envAtlas = assets.helipad.resource;
app.scene.ambientLight = new Color(0.1, 0.1, 0.1);

// camera
const camera = new Entity();
camera.addComponent('camera', { toneMapping: TONEMAP_ACES });
app.root.addChild(camera);
camera.translate(0, 0, 16);

// material
const material = new StandardMaterial();
material.gloss = 0.6;
material.metalness = 0.7;
material.useMetalness = true;

// build 3 primitive geometries (unit size)
const sphereGeom = new SphereGeometry({ radius: 0.5, latitudeBands: 24, longitudeBands: 24 });
const boxGeom = new BoxGeometry();
const cylGeom = new CylinderGeometry({ radius: 0.5, height: 1, heightSegments: 1, radialSegments: 32 });

// combine into single geometry
const combine = new Geometry();
const pushGeom = (g, vertexOffset) => {
    // positions / normals / uvs
    combine.positions.push(...g.positions);
    if (g.normals) combine.normals ??= [];
    if (g.normals) combine.normals.push(...g.normals);
    if (g.uvs) combine.uvs ??= [];
    if (g.uvs) combine.uvs.push(...g.uvs);

    // indices with offset
    const base = vertexOffset;
    const srcIdx = g.indices;
    for (let i = 0; i < srcIdx.length; i++) combine.indices.push(srcIdx[i] + base);
};

// initialize arrays
combine.positions = [];
combine.normals = [];
combine.uvs = [];
combine.indices = [];

// vertex offsets and firstIndex tracking (in indices)
const vtxCounts = [sphereGeom.positions.length / 3, boxGeom.positions.length / 3, cylGeom.positions.length / 3];
const idxCounts = [sphereGeom.indices.length, boxGeom.indices.length, cylGeom.indices.length];
const firstIndex = [0, idxCounts[0], idxCounts[0] + idxCounts[1]];

// append geometries
pushGeom(sphereGeom, 0);
pushGeom(boxGeom, vtxCounts[0]);
pushGeom(cylGeom, vtxCounts[0] + vtxCounts[1]);

// create mesh
const mesh = Mesh.fromGeometry(app.graphicsDevice, combine);

// MeshInstance
const meshInst = new MeshInstance(mesh, material);

// entity to render our MeshInstance
const entity = new Entity('MultiDrawEntity');
entity.addComponent('render', { meshInstances: [meshInst] });
app.root.addChild(entity);

// instancing
const ringCounts = [8, 15, 25];
const totalInstances = ringCounts[0] + ringCounts[1] + ringCounts[2];

const matrices = new Float32Array(totalInstances * 16);
const instanceIndexes = new Uint32Array(totalInstances);
const drawOffsets = new Float32Array(ringCounts.length);

// populate matrices on 3 concentric rings; assign groups sequentially
const tmpPos = new Vec3();
const tmpRot = new Quat();
const tmpScl = new Vec3(1, 1, 1);
const m = new Mat4();

let write = 0;
let indexCounter = 0;
let prevInstanceMaxCount = 0;
const radii = [2, 4, 6];
for (let ring = 0; ring < 3; ring++) {
    const n = ringCounts[ring];
    const r = radii[ring];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        tmpPos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        tmpRot.setFromEulerAngles(0, (a * 180) / Math.PI, 0);
        m.setTRS(tmpPos, tmpRot, tmpScl);
        matrices.set(m.data, write);
        instanceIndexes[indexCounter] = indexCounter;
        indexCounter++;
        write += 16;
    }
    drawOffsets[ring] = prevInstanceMaxCount;
    prevInstanceMaxCount += n;
}

let vbFormat;
let vbData;

if (app.graphicsDevice.isWebGL2 && app.graphicsDevice.supportsMultiDraw) {
    // webgl2 not support instancing counter use vertex workaround
    // update shader transform instancing chunk
    material.shaderChunks.glsl.set('transformInstancingVS', transformInstancingVert);

    // store matrices in texture
    const matricesDataTexture = new Texture(app.graphicsDevice, {
        width: (totalInstances * 16) / 4, // write rbga as vec4
        height: 1,
        format: PIXELFORMAT_RGBA32F,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        mipmaps: false,
        numLevels: 1,
        levels: [matrices]
    });

    vbData = instanceIndexes;
    vbFormat = new VertexFormat(app.graphicsDevice, [
        {
            semantic: SEMANTIC_ATTR11,
            components: 1,
            type: TYPE_INT32,
            asInt: true
        }
    ]);

    material.setAttribute('aInstanceId', SEMANTIC_ATTR11);
    material.setParameter('uDrawOffsets[0]', drawOffsets);
    material.setParameter('uInstanceMatrices', matricesDataTexture);
    material.update();
} else {
    vbData = matrices;
    vbFormat = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
}

const vb = new VertexBuffer(app.graphicsDevice, vbFormat, totalInstances, { data: vbData });
meshInst.setInstancing(vb);

// multi-draw: 3 draws (sphere, box, cylinder) with different instance counts
// provide firstInstance (instances are packed sequentially per ring) - this is WebGPU only
const firstInstance = [0, ringCounts[0], ringCounts[0] + ringCounts[1]];
const cmd = meshInst.setMultiDraw(null, 3);
cmd.add(0, idxCounts[0], ringCounts[0], firstIndex[0], 0, firstInstance[0]);
cmd.add(1, idxCounts[1], ringCounts[1], firstIndex[1], 0, firstInstance[1]);
cmd.add(2, idxCounts[2], ringCounts[2], firstIndex[2], 0, firstInstance[2]);
cmd.update(3);

// draw helper lines around each ring to visualize distribution
const linesPositions = [];
const linesColors = [];
const ringColor = [Color.RED, Color.GREEN, Color.YELLOW];
for (let ring = 0; ring < 3; ring++) {
    const n = ringCounts[ring];
    const r = radii[ring];
    const col = ringColor[ring];
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = (((i + 1) % n) / n) * Math.PI * 2;
        const p0 = new Vec3(Math.cos(a0) * r, 0, Math.sin(a0) * r);
        const p1 = new Vec3(Math.cos(a1) * r, 0, Math.sin(a1) * r);
        linesPositions.push(p0, p1);
        linesColors.push(col, col);
    }
}

// orbit camera
let angle = 0;
app.on('update', (dt) => {
    angle += dt * 0.2;
    camera.setLocalPosition(15 * Math.sin(angle), 7, 15 * Math.cos(angle));
    camera.lookAt(Vec3.ZERO);

    app.drawLines(linesPositions, linesColors);
});
