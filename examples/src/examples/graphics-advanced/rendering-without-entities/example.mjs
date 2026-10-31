// @config
//
// A ground plane and an instanced GLB forest rendered directly through a layer. Toggle the trees
// or change their count while reusing the same mesh instance and buffer. Only the camera and
// light use entities; named GraphNodes provide the geometry transforms and debug labels.
//
// @credit
// title: Low-poly Tree with Twisting Branches
// author: Sketchfab
// source: https://sketchfab.com/3d-models/low-poly-tree-with-twisting-branches-4e2589134f2442bcbdab51c1f306cd58
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    GraphNode,
    LAYERID_WORLD,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    PlaneGeometry,
    Quat,
    RESOLUTION_AUTO,
    SHADOW_PCF3_32F,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    Vec2,
    Vec3,
    VertexBuffer,
    VertexFormat,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
// Geometry registered with a layer does not need RenderComponentSystem or ModelComponentSystem.
options.componentSystems = [CameraComponentSystem, LightComponentSystem];
options.resourceHandlers = [ContainerHandler, TextureHandler];

const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

const treeAsset = new Asset('Tree', 'container', { url: './assets/models/low-poly-tree.glb' });
await new Promise((resolve, reject) => {
    new AssetListLoader([treeAsset], app.assets).load((err) => (err ? reject(err) : resolve()));
});

data.set('settings', {
    showTrees: true,
    treeCount: 192,
    orbit: true
});

// A warm sun, cool ambient fill and distant haze keep the foliage and its shadows readable.
const skyColor = new Color(0.73, 0.8, 0.72);
app.scene.ambientLight = new Color(0.58, 0.62, 0.68);
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = skyColor;
app.scene.fog.start = 80;
app.scene.fog.end = 170;

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: skyColor,
    nearClip: 0.1,
    farClip: 500,
    fov: 45,
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.93, 0.8),
    intensity: 1.4,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowDistance: 100,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    numCascades: 2
});
sun.setLocalEulerAngles(48, 30, 0);
app.root.addChild(sun);

const layer = app.scene.layers.getLayerById(LAYERID_WORLD);

// Single mesh: geometry and material are created manually. A standalone GraphNode has an
// identity transform and provides the name shown in GPU markers. It needs no parent entity.
const groundMaterial = new StandardMaterial();
groundMaterial.name = 'Meadow';
groundMaterial.diffuse = new Color(0.53, 0.55, 0.43);
groundMaterial.gloss = 0.15;
groundMaterial.update();

const groundMesh = Mesh.fromGeometry(
    device,
    new PlaneGeometry({
        halfExtents: new Vec2(500, 500),
        widthSegments: 1,
        lengthSegments: 1
    })
);
const ground = new MeshInstance(groundMesh, groundMaterial, new GraphNode('Ground'));
const groundInstances = [ground];
layer.addMeshInstances(groundInstances);

// This GLB contains one static mesh with one material. Its ancestor rotations cancel out, so
// its mesh coordinates already have +Y up. Access the render asset directly, without creating
// an entity hierarchy. A general GLB may have several primitives, node transforms or skins.
const treeMesh = treeAsset.resource.renders[0].resource.meshes[0];
const treeMaterial = treeAsset.resource.materials[0].resource;
const forest = new MeshInstance(treeMesh, treeMaterial, new GraphNode('Instanced forest'));
forest.castShadow = true;

// Calibrate the raw mesh once: center its footprint and bring its lowest vertex to ground
// level. The inspected static mesh is 7.4634 units tall, with its base at Y = -4.5498.
const treeBounds = treeMesh.aabb;
const treeHeight = treeBounds.halfExtents.y * 2;
const origin = new Mat4().setTranslate(-treeBounds.center.x, -treeBounds.getMin().y, -treeBounds.center.z);

const maxTrees = 192;
const matrices = new Float32Array(maxTrees * 16);
const position = new Vec3();
const rotation = new Quat();
const scale = new Vec3();
const matrix = new Mat4();
const instanceBounds = new BoundingBox();
const forestBounds = new BoundingBox();

// A deterministic sunflower distribution leaves room between crowns. The curved clearing
// makes it easy to see individual trunks, contact shadows and the uninstanced ground plane.
let count = 0;
for (let candidate = 0; count < maxTrees; candidate++) {
    const angle = candidate * 2.399963;
    const radius = 24 * Math.sqrt((candidate + 0.5) / 256);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x - 2.8 * Math.sin(z * 0.2)) < 3.2) {
        continue;
    }

    const height = 3.5 + 1.5 * (0.5 + 0.5 * Math.sin(candidate * 11.7));
    const uniformScale = height / treeHeight;
    position.set(x, 0, z);
    rotation.setFromEulerAngles(0, candidate * 137.5, 0);
    scale.set(uniformScale, uniformScale, uniformScale);
    matrix.setTRS(position, rotation, scale);
    matrix.mul2(matrix, origin);
    matrices.set(matrix.data, count * 16);

    // Instancing is culled as one group. Accumulate a conservative bound for every tree,
    // rather than using the source mesh's bounds for the whole forest.
    instanceBounds.setFromTransformedAabb(treeBounds, matrix);
    if (count === 0) {
        forestBounds.copy(instanceBounds);
    } else {
        forestBounds.add(instanceBounds);
    }
    count++;
}

const instanceBuffer = new VertexBuffer(device, VertexFormat.getDefaultInstancingFormat(device), maxTrees, {
    data: matrices
});
forest.setInstancing(instanceBuffer, true);
// Instance matrices are world-space transforms; the forest's GraphNode stays at identity.
forest.setCustomAabb(forestBounds);

const forestInstances = [forest];
layer.addMeshInstances(forestInstances);

// Layer membership persists. Removing and re-adding the forest preserves its mesh, material,
// shader caches and instance buffer. Set castShadow before adding it to register shadow casters.
const showTreesEvent = data.on('settings.showTrees:set', (value) => {
    if (value) {
        layer.addMeshInstances(forestInstances);
    } else {
        layer.removeMeshInstances(forestInstances);
    }
});
const treeCountEvent = data.on('settings.treeCount:set', (value) => {
    forest.instancingCount = Math.max(0, Math.min(maxTrees, Math.floor(value)));
});

let azimuth = 0.25;
const updateCamera = () => {
    camera.setLocalPosition(48 * Math.sin(azimuth), 27, 48 * Math.cos(azimuth));
    camera.lookAt(0, 2, 0);
};
updateCamera();
app.on('update', (dt) => {
    if (data.get('settings.orbit')) {
        azimuth += Math.min(dt, 0.1) * 0.035;
        updateCamera();
    }
});

// Direct layer registration has no component to own these instances. Release them explicitly;
// the asset registry owns the loaded GLB resources, while this example owns the instance buffer
// and ground material. Destroying the ground instance releases its unshared mesh too.
app.on('destroy', () => {
    showTreesEvent.unbind();
    treeCountEvent.unbind();
    layer.removeMeshInstances(forestInstances);
    layer.removeMeshInstances(groundInstances);
    forest.destroy();
    ground.destroy();
    instanceBuffer.destroy();
    groundMaterial.destroy();
});

app.start();
