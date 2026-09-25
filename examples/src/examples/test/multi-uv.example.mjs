// @config
// @flag HIDDEN
//
// Internal test for `StandardMaterial` sampling texture maps from all eight UV sets. Every box has
// a procedural mesh carrying TEXCOORD0 to TEXCOORD7, where set N maps each face onto cell N of an
// atlas showing the digit N. **Top row:** box N samples its diffuse map from UV set N, so the row
// reads 0 to 7. **Bottom row, left to right:** a diffuse map on UV3 offset by half the atlas
// height (the transformed uv path), which therefore reads 7; a dim diffuse map on UV1 under an
// emissive map on UV6; a lightmap on UV5; and a mesh with only four UV sets whose material asks
// for UV6, where the map must be dropped and the box drawn in its plain gray diffuse color
// without a shader error.

import {
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    BUFFER_STATIC,
    BoxGeometry,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    INDEXFORMAT_UINT16,
    IndexBuffer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_TRIANGLES,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD,
    StandardMaterial,
    TYPE_FLOAT32,
    Texture,
    VertexBuffer,
    VertexFormat,
    VertexIterator,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

app.scene.ambientLight = new Color(0.3, 0.3, 0.3);

// the atlas: a 4x2 grid of colored cells, cell N showing the digit N
const columns = 4;
const rows = 2;
const cellSize = 256;
const cellColors = ['#d64545', '#e08a2e', '#b8a82a', '#4fb35a', '#3fa7b8', '#4b6fd6', '#8e5bd1', '#d05aa8'];

const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = columns * cellSize;
atlasCanvas.height = rows * cellSize;
const context = /** @type {CanvasRenderingContext2D} */ (atlasCanvas.getContext('2d'));
context.font = `bold ${cellSize * 0.7}px sans-serif`;
context.textAlign = 'center';
context.textBaseline = 'middle';
for (let cell = 0; cell < columns * rows; cell++) {
    const x = (cell % columns) * cellSize;
    const y = Math.floor(cell / columns) * cellSize;
    context.fillStyle = cellColors[cell];
    context.fillRect(x, y, cellSize, cellSize);
    context.fillStyle = '#ffffff';
    context.fillText(String(cell), x + cellSize / 2, y + cellSize / 2);
}

const atlas = new Texture(device, {
    name: 'uv-set-atlas',
    width: atlasCanvas.width,
    height: atlasCanvas.height,
    format: PIXELFORMAT_RGBA8,
    srgb: true,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT
});
atlas.setSource(atlasCanvas);

/**
 * Creates a box mesh whose UV set N maps every face onto atlas cell N.
 *
 * @param {number} uvSetCount - The number of UV sets to generate, 1 to 8.
 * @returns {Mesh} The mesh.
 */
const createBoxMesh = (uvSetCount) => {
    const { positions, normals, uvs, indices } = new BoxGeometry();
    const vertexCount = positions.length / 3;

    // interleave the streams by hand: the Mesh stream API stores each one in its own vertex buffer,
    // and WebGPU allows at most 8 of those - fewer than position, normal and eight uv sets need
    const elements = [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32 }
    ];
    for (let set = 0; set < uvSetCount; set++) {
        elements.push({ semantic: SEMANTIC_TEXCOORD + set, components: 2, type: TYPE_FLOAT32 });
    }
    const vertexBuffer = new VertexBuffer(device, new VertexFormat(device, elements), vertexCount);

    const iterator = new VertexIterator(vertexBuffer);
    for (let i = 0; i < vertexCount; i++) {
        iterator.element[SEMANTIC_POSITION].set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        iterator.element[SEMANTIC_NORMAL].set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        for (let set = 0; set < uvSetCount; set++) {
            const column = set % columns;
            const row = Math.floor(set / columns);
            iterator.element[SEMANTIC_TEXCOORD + set].set(
                (column + uvs[i * 2]) / columns,
                (row + uvs[i * 2 + 1]) / rows
            );
        }
        iterator.next();
    }
    iterator.end();

    const mesh = new Mesh(device);
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = new IndexBuffer(
        device,
        INDEXFORMAT_UINT16,
        indices.length,
        BUFFER_STATIC,
        new Uint16Array(indices)
    );
    mesh.primitive[0] = { type: PRIMITIVE_TRIANGLES, base: 0, count: indices.length, indexed: true };
    mesh.aabb.compute(positions);
    return mesh;
};

const fullMesh = createBoxMesh(8);

/** @type {Entity[]} */
const boxes = [];

/**
 * Adds a box rendered with the given material.
 *
 * @param {string} name - The entity name.
 * @param {Mesh} mesh - The mesh to render.
 * @param {StandardMaterial} material - The material to render it with.
 * @param {number} x - The horizontal position.
 * @param {number} y - The vertical position.
 */
const addBox = (name, mesh, material, x, y) => {
    material.update();

    const box = new Entity(name);
    box.addComponent('render', {
        meshInstances: [new MeshInstance(mesh, material)]
    });
    box.setLocalPosition(x, y, 0);
    box.setLocalScale(1.6, 1.6, 1.6);
    app.root.addChild(box);
    boxes.push(box);
};

// top row - box N samples its diffuse map from UV set N
for (let set = 0; set < 8; set++) {
    const material = new StandardMaterial();
    material.diffuseMap = atlas;
    material.diffuseMapUv = set;
    addBox(`UV${set}`, fullMesh, material, (set - 3.5) * 1.9, 1.6);
}

// bottom row - a transformed map on a high set: UV3 offset by half the atlas height reads 7
const transformed = new StandardMaterial();
transformed.diffuseMap = atlas;
transformed.diffuseMapUv = 3;
transformed.diffuseMapOffset.set(0, 0.5);
addBox('UV3 offset', fullMesh, transformed, -3.15, -1.6);

// two maps from two sets in one shader
const combined = new StandardMaterial();
combined.diffuse = new Color(0.35, 0.35, 0.35);
combined.diffuseMap = atlas;
combined.diffuseMapUv = 1;
combined.emissive = Color.WHITE;
combined.emissiveMap = atlas;
combined.emissiveMapUv = 6;
combined.emissiveIntensity = 0.7;
addBox('UV1 diffuse + UV6 emissive', fullMesh, combined, -1.05, -1.6);

// a lightmap on a high set, lit by the lightmap and ambient alone so the digit stays readable
const lightmapped = new StandardMaterial();
lightmapped.useLighting = false;
lightmapped.lightMap = atlas;
lightmapped.lightMapUv = 5;
addBox('UV5 lightmap', fullMesh, lightmapped, 1.05, -1.6);

// a set the mesh does not have - the map must be dropped rather than sampled from a missing attribute
const missing = new StandardMaterial();
missing.diffuse = new Color(0.4, 0.4, 0.4);
missing.diffuseMap = atlas;
missing.diffuseMapUv = 6;
addBox('UV6 on a 4-set mesh', createBoxMesh(4), missing, 3.15, -1.6);

const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    intensity: 1.5
});
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.12, 0.12, 0.12)
});
camera.setLocalPosition(0, 2.5, 15);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

app.on('update', (dt) => {
    for (const box of boxes) {
        box.rotate(0, 15 * dt, 0);
    }
});
