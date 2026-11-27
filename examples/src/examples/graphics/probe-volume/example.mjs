// @config
//
// A pavilion lit by a probe volume, with three lighting presets loaded from a baked file. Apart from
// the sun, there are no lights: the glowing objects are emissive meshes, which light the scene only
// through the probes. The Baking panel edits the probes and the lighting of a preset, and bakes them
// again.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BatchManager,
    BinaryHandler,
    BoundingBox,
    BoxGizmo,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    DynamicSkyEffect,
    Entity,
    FILLMODE_FILL_WINDOW,
    Gizmo,
    Keyboard,
    LAYERID_IMMEDIATE,
    LAYERID_SKYBOX,
    LAYERID_UI,
    Layer,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA8,
    PROBESOURCE_GBUFFER,
    ProbeVolume,
    ProbeVolumeBaker,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGeometry,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec3,
    VertexBuffer,
    VertexFormat,
    WasmModule,
    WireRenderer,
    createGraphicsDevice,
    featureAnim,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the Draco decoder, for the meshes of the pavilion
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    pavilion: new Asset('concrete-pavilion', 'container', { url: './assets/models/concrete-pavilion.glb' }),
    bitmoji: new Asset('bitmoji', 'container', { url: './assets/models/bitmoji.glb' }),
    walk: new Asset('walk', 'container', { url: './assets/animations/bitmoji/walk.glb' })
};

// the probes of the presets, baked with the Baking panel and saved with its Download button
const probesAsset = new Asset('concrete-pavilion-probes', 'binary', {
    url: './assets/models/concrete-pavilion-probes.bin'
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);
createOptions.batchManager = BatchManager;

createOptions.features = [featureAnim];

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, BinaryHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// renderer for the debug lines
const wire = new WireRenderer(app);
wire.depthTest = false;

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

// the probes, baked at startup instead when they could not be loaded
const probesLoaded = await new Promise((resolve) => {
    new AssetListLoader([probesAsset], app.assets).load((/** @type {any} */ err) => resolve(!err));
});

app.start();

// The lighting presets, each baked into a lighting of the probe volume, see
// ProbeVolume#activeLighting. The dynamic sky follows the preset, and sets the direction, the color
// and the intensity of the sun light: the elevation of the sun, below the horizon at night, the
// rotation of the sky, turning the sun and the moon, the intensity of the sun and the brightness of
// the sky. The Baking panel edits the preset selected. Each preset also has its intensity of the
// probes, and its bloom, which are not baked
const presets = [
    { elevation: 60, rotation: 35, sunIntensity: 2, luminance: 1, intensity: 1, bloom: 0 },
    { elevation: 6, rotation: 250, sunIntensity: 2, luminance: 1, intensity: 1, bloom: 0.015 },
    { elevation: -20, rotation: 120, sunIntensity: 2, luminance: 1, intensity: 3, bloom: 0.1 }
];

// the settings of a preset its lighting is baked with, and all its settings in the controls
const bakedSettings = ['elevation', 'rotation', 'sunIntensity', 'luminance'];
const presetSettings = [...bakedSettings, 'intensity'];

/**
 * Returns the settings of a preset shown in the controls.
 *
 * @param {object} preset - The preset.
 * @returns {object} The settings, by name.
 */
const presetControls = (preset) => Object.fromEntries(presetSettings.map((name) => [name, preset[name]]));

// the preset shown at startup, the sunset
const initialPreset = 1;

data.set('settings', {
    preset: initialPreset,
    probes: true,
    shSharpening: true,
    leakReduction: true,
    visibility: true,
    reflectionOcclusion: true,
    normalBias: 0.5,
    format: 'rgba16f',
    showProbes: false,
    characters: true,
    editVolume: false,
    spacing: 2,
    faceSize: 8,
    emissive: true,
    validity: true,
    virtualOffset: true,
    ...presetControls(presets[initialPreset]),
    bounces: 2,
    source: PROBESOURCE_GBUFFER,
    dilation: true,
    autoRelight: true
});
// the status of the bake, the number of probes, and the times of the last capture and bake, shown in
// the Baking panel
data.set('bake', {
    status: '',
    probes: '',
    geometry: '',
    lighting: '',
    baking: false,
    capturing: false,
    progress: 0,
    relight: false,
    capture: false
});

// layers: the characters and the other dynamic objects are on their own layer, which the probes don't
// capture, they are only lit by them
const worldLayer = app.scene.layers.getLayerByName('World');
const dynamicLayer = new Layer({ name: 'Dynamic' });
app.scene.layers.insert(dynamicLayer, app.scene.layers.getTransparentIndex(worldLayer));

// the sun, whose direction, color and intensity the dynamic sky sets
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    layers: [worldLayer.id, dynamicLayer.id]
});
app.root.addChild(sun);

// the materials lit by the probes
/** @type {Set<StandardMaterial>} */
const probeLitMaterials = new Set();

// the pavilion, its meshes batched by material, so that the probes capture it with few draw calls
const pavilionBatchGroup = app.batcher.addGroup('Pavilion', false, 100, undefined, [worldLayer.id]);
const pavilion = assets.pavilion.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });

// the emissive lights of the pavilion, dimmed so that the tone mapping keeps their color instead of
// showing them almost white. The probes capture them at this brightness, so their light matches
const EMISSIVE_SCALE = 0.25;
const emissiveMaterials = new Set();
pavilion.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        const material = meshInstance.material;
        if (material instanceof StandardMaterial && material.emissiveIntensity > 1) {
            emissiveMaterials.add(material);
        }
    });
});
emissiveMaterials.forEach((material) => {
    material.emissiveIntensity *= EMISSIVE_SCALE;
    material.update();
});
app.root.addChild(pavilion);

// the box the probe volume covers: the pavilion, its planters and trees, with a margin of a meter
// around and above them, so that their outside faces have probes in front of them, but not the large
// ground around them
const pavilionBox = new BoundingBox();
let pavilionBoxEmpty = true;
pavilion.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        if (render.entity.name !== 'Ground') {
            if (pavilionBoxEmpty) {
                pavilionBox.copy(meshInstance.aabb);
                pavilionBoxEmpty = false;
            } else {
                pavilionBox.add(meshInstance.aabb);
            }
        }
        if (meshInstance.material instanceof StandardMaterial) {
            probeLitMaterials.add(meshInstance.material);
        }
    });
    render.batchGroupId = pavilionBatchGroup.id;
});
pavilionBox.setMinMax(
    pavilionBox
        .getMin()
        .clone()
        .sub(new Vec3(1, 0, 1)),
    pavilionBox
        .getMax()
        .clone()
        .add(new Vec3(1, 1, 1))
);
app.batcher.generate([pavilionBatchGroup.id]);

// the sun shadow covers the pavilion for any camera, so it doesn't fade out with the distance
sun.light.shadowBounds = pavilionBox;

// the camera: drag to orbit, right drag to look around, WASD to fly, Q and E to move down and up,
// shift to move faster
const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 60,
    nearClip: 0.05,
    farClip: 2000,
    layers: [worldLayer.id, dynamicLayer.id, LAYERID_SKYBOX, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
const cameraPosition = new Vec3(-14.35, 9.04, 27.3);
camera.setLocalPosition(cameraPosition);
app.root.addChild(camera);
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cameraControls, {
    focusPoint: new Vec3(0.453, -0.239, -0.859).mulScalar(25).add(cameraPosition),
    moveSpeed: 6,
    moveFastSpeed: 15,
    moveSlowSpeed: 1.5
});

// the dynamic sky, rendered by the camera frame: it keeps the sun light in sync with the sun and the
// moon, and generates the lighting of the environment from the sky, which lights the scene outside
// of the probe volume, and the probes see when they are baked
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
const sky = new DynamicSkyEffect(device);
sky.light = sun.light;
sky.moonIntensity = 0.4;
cameraFrame.addEffect(sky);
cameraFrame.update();

/**
 * Applies the real-time lighting of a preset to the scene, the settings of the dynamic sky, and its
 * bloom.
 *
 * @param {object} preset - The preset.
 */
const applyLighting = (preset) => {
    sky.elevation = preset.elevation;
    sky.rotation = preset.rotation;
    sky.sunIntensity = preset.sunIntensity;
    sky.luminance = preset.luminance;
    cameraFrame.bloom.intensity = preset.bloom;
    cameraFrame.update();
};
applyLighting(presets[initialPreset]);

// resolves after a number of frames, for the sky, its lighting and the sun light to follow a change
const waitFrames = (/** @type {number} */ count) =>
    new Promise((resolve) => {
        const onFrame = () => {
            if (--count <= 0) {
                app.off('frameend', onFrame);
                resolve();
            }
        };
        app.on('frameend', onFrame);
    });

// the dynamic objects, lit by the probes but not captured by them
const dynamic = new Entity('Dynamic');
app.root.addChild(dynamic);

// the closed path the characters walk along, around the edge of the plinth, and the distances along
// it of its points
const path = [
    [-11.8, 0, -9.8],
    [9.5, 0, -9.8],
    [9.5, 0, 13.9],
    [-11.8, 0, 13.9],
    [-11.8, 0, -9.8]
].map(([x, y, z]) => new Vec3(x, y, z));
const pathDistances = [0];
for (let i = 1; i < path.length; i++) {
    pathDistances.push(pathDistances[i - 1] + path[i].distance(path[i - 1]));
}
const pathLength = pathDistances[pathDistances.length - 1];

/**
 * Samples the closed path at a distance along it.
 *
 * @param {number} distance - The distance walked.
 * @param {Vec3} position - Receives the position.
 * @param {Vec3} direction - Receives the direction of walking.
 */
const samplePath = (distance, position, direction) => {
    const d = distance % pathLength;
    let i = 0;
    while (i < path.length - 2 && pathDistances[i + 1] < d) {
        i++;
    }
    const t = (d - pathDistances[i]) / (pathDistances[i + 1] - pathDistances[i]);
    position.lerp(path[i], path[i + 1], t);
    direction.sub2(path[i + 1], path[i]);
};

// the characters, walking along the path, spread out along it. Their model leaves the metalness of
// its materials at the glTF default of 1, so they would only reflect the environment, and get no
// diffuse light from the probes: they are made non-metallic
const characters = [0, 1, 2, 3].map((index) => {
    const entity = assets.bitmoji.resource.instantiateRenderEntity({ castShadows: true });
    entity.findComponents('render').forEach((render) => {
        render.layers = [dynamicLayer.id];
        render.meshInstances.forEach((meshInstance) => {
            const material = /** @type {StandardMaterial} */ (meshInstance.material);
            material.metalness = 0;
            material.update();
            probeLitMaterials.add(material);
        });
    });
    entity.addComponent('anim', { activate: true });
    entity.anim.assignAnimation('Walk', assets.walk.resource.animations[0].resource);
    dynamic.addChild(entity);
    return { entity, distance: (index * pathLength) / 4 };
});

const WALK_SPEED = 1;
const position = new Vec3();
const direction = new Vec3();
app.on('update', (/** @type {number} */ dt) => {
    characters.forEach((character) => {
        character.distance += dt * WALK_SPEED;
        samplePath(character.distance, position, direction);
        character.entity.setPosition(position);
        character.entity.setEulerAngles(0, Math.atan2(direction.x, direction.z) * math.RAD_TO_DEG, 0);
    });
});

// the box of the probe volume, edited with a box gizmo. Its changes need the geometry captured again
const volumeBox = new BoundingBox();
volumeBox.copy(pavilionBox);
const volumeGizmo = new BoxGizmo(camera.camera, Gizmo.createLayer(app, 'Volume', undefined, true));
volumeGizmo.enabled = false;

// the camera doesn't move while a handle is dragged
volumeGizmo.on('pointer:down', (/** @type {number} */ x, /** @type {number} */ y, /** @type {any} */ meshInstance) => {
    cameraControls.enabled = !meshInstance;
});
volumeGizmo.on('pointer:up', () => {
    cameraControls.enabled = true;
});

// while editing the box, the probes it would have at the probe spacing, as small orange spheres
// without lighting, to see the probes which would be inside the geometry before capturing it
const previewMaterial = new StandardMaterial();
previewMaterial.useLighting = false;
previewMaterial.useSkybox = false;
previewMaterial.diffuse = new Color(0, 0, 0);
previewMaterial.emissive = new Color(1, 0.45, 0.05);
previewMaterial.update();

const previewMesh = Mesh.fromGeometry(device, new SphereGeometry({ latitudeBands: 6, longitudeBands: 8 }));
const previewInstance = new MeshInstance(previewMesh, previewMaterial);
const previewSpheres = new Entity('VolumePreview');
previewSpheres.addComponent('render', {
    meshInstances: [previewInstance],
    layers: [dynamicLayer.id],
    castShadows: false
});
previewSpheres.enabled = false;
app.root.addChild(previewSpheres);

// also shown while the probe spacing changes, until the slider is released
let spacingPreview = false;

// the most probes previewed, as the preview of a very small spacing would use a lot of memory
const MAX_PREVIEW_PROBES = 200000;

// the bake status, while the status says there are too many probes to preview
let statusBeforePreview = null;

const updateVolumePreview = () => {
    const show = data.get('settings.editVolume') || spacingPreview;
    previewSpheres.enabled = show;
    if (!show) {
        return;
    }

    // the probes at the centers of the cells, as the volume places them
    const spacing = data.get('settings.spacing');
    const center = volumeGizmo.position;
    const half = volumeGizmo.halfExtents;
    const extents = [half.x * 2, half.y * 2, half.z * 2];
    const count = extents.map((extent) => Math.max(1, Math.round(extent / spacing)));
    const cell = extents.map((extent, i) => extent / count[i]);
    const total = count[0] * count[1] * count[2];
    if (total > MAX_PREVIEW_PROBES) {
        previewSpheres.enabled = false;
        statusBeforePreview ??= data.get('bake.status');
        data.set('bake.status', 'Too many to preview');
        return;
    }
    if (statusBeforePreview !== null) {
        data.set('bake.status', statusBeforePreview);
        statusBeforePreview = null;
    }
    const size = Math.min(cell[0], cell[1], cell[2]) * 0.12;
    const scale = new Vec3(size, size, size);
    const matrix = new Mat4();
    const matrices = new Float32Array(total * 16);
    let offset = 0;
    for (let z = 0; z < count[2]; z++) {
        for (let y = 0; y < count[1]; y++) {
            for (let x = 0; x < count[0]; x++) {
                position.set(
                    center.x - half.x + (x + 0.5) * cell[0],
                    center.y - half.y + (y + 0.5) * cell[1],
                    center.z - half.z + (z + 0.5) * cell[2]
                );
                matrix.setTRS(position, Quat.IDENTITY, scale);
                matrices.set(matrix.data, offset);
                offset += 16;
            }
        }
    }
    previewInstance.instancingData?.vertexBuffer?.destroy();
    const format = VertexFormat.getDefaultInstancingFormat(device);
    previewInstance.setInstancing(new VertexBuffer(device, format, total, { data: matrices }));
};

// shows the box of the volume in the gizmo, and its probes, when editing it
const updateVolumeGizmo = () => {
    volumeGizmo.position.copy(volumeBox.center);
    volumeGizmo.halfExtents.copy(volumeBox.halfExtents);
    volumeGizmo.enabled = data.get('settings.editVolume');
    updateVolumePreview();
};

// a resized box needs the geometry captured again
volumeGizmo.on('handle:move', () => {
    volumeBox.center.copy(volumeGizmo.position);
    volumeBox.halfExtents.copy(volumeGizmo.halfExtents);
    data.set('bake.capture', true);
    updateVolumePreview();
});

const formats = { rgba16f: PIXELFORMAT_RGBA16F, rgba8: PIXELFORMAT_RGBA8 };

/** @type {ProbeVolume|null} */
let volume = null;

// the probes, shown as small spheres around them: each shows the lighting of its probe as it is
// stored, from the directions of its surface, the invalid probes are red, and the moved probes have a
// line to the position they were captured at
const probeMaterial = new StandardMaterial();
probeMaterial.useLighting = false;
probeMaterial.useSkybox = false;
probeMaterial.useMetalness = true;
probeMaterial.metalness = 0;
probeMaterial.gloss = 0;
probeMaterial.setDefine('PROBE_VOLUME_DEBUG', true);
probeMaterial.update();

const invalidProbeMaterial = new StandardMaterial();
invalidProbeMaterial.useLighting = false;
invalidProbeMaterial.useSkybox = false;
invalidProbeMaterial.diffuse = new Color(0, 0, 0);
invalidProbeMaterial.emissive = new Color(1, 0.1, 0.1);
invalidProbeMaterial.update();

const probeSpheres = new Entity('ProbeSpheres');
app.root.addChild(probeSpheres);

// a sphere instanced for the valid probes and one for the invalid probes, two draw calls
const probeInstances = [probeMaterial, invalidProbeMaterial].map((material) => {
    const entity = new Entity();
    entity.addComponent('render', {
        type: 'sphere',
        material: material,
        layers: [dynamicLayer.id],
        castShadows: false
    });
    probeSpheres.addChild(entity);
    return entity;
});

// the lines from the moved probes to the positions they were captured at, as pairs of points
/** @type {number[]} */
let probeLines = [];

// whether the spheres show older probes, as they are only updated when shown
let probeSpheresStale = true;

const updateProbeSpheres = () => {
    const cellSize = volume.getCellSize(new Vec3());
    const size = Math.min(cellSize.x, cellSize.y, cellSize.z) * 0.2;
    const scale = new Vec3(size, size, size);
    const matrix = new Mat4();

    /** @type {number[][]} */
    const matrices = [[], []];
    const offsets = volume.offsets;
    probeLines = [];
    for (let i = 0; i < volume.probeCount; i++) {
        volume.getProbePosition(i, position);
        matrix.setTRS(position, Quat.IDENTITY, scale);
        matrices[volume.validity[i] ? 0 : 1].push(...matrix.data);

        if (offsets && (offsets[i * 3] || offsets[i * 3 + 1] || offsets[i * 3 + 2])) {
            const { x, y, z } = position;
            probeLines.push(x, y, z, x + offsets[i * 3], y + offsets[i * 3 + 1], z + offsets[i * 3 + 2]);
        }
    }

    probeInstances.forEach((entity, index) => {
        const meshInstance = entity.render.meshInstances[0];
        meshInstance.instancingData?.vertexBuffer?.destroy();
        const instances = new Float32Array(matrices[index]);
        const count = instances.length / 16;
        const format = VertexFormat.getDefaultInstancingFormat(device);
        meshInstance.setInstancing(count > 0 ? new VertexBuffer(device, format, count, { data: instances }) : null);
        entity.enabled = count > 0;
    });
};

const showProbeSpheres = (/** @type {boolean} */ show) => {
    if (show && probeSpheresStale && volume) {
        updateProbeSpheres();
        probeSpheresStale = false;
    }
    probeSpheres.enabled = show && !!volume;
};

const lineColor = new Color(1, 0.9, 0.1);
app.on('update', () => {
    if (probeSpheres.enabled && probeLines.length > 0) {
        wire.color = lineColor;
        wire.linesPacked(probeLines);
    }
});

/**
 * Sets the probe volume shown, with the display settings, and applies it to the materials.
 *
 * @param {ProbeVolume} newVolume - The probe volume.
 */
const setVolume = (newVolume) => {
    volume?.destroy();
    volume = newVolume;
    volume.enabled = data.get('settings.probes');
    volume.shSharpening = data.get('settings.shSharpening');
    volume.leakReduction = data.get('settings.leakReduction');
    volume.visibility = data.get('settings.visibility');
    volume.reflectionOcclusion = data.get('settings.reflectionOcclusion');
    volume.intensity = data.get('settings.intensity');
    volume.normalBias = data.get('settings.normalBias');
    volume.blendDistance = 0.2;
    probeSpheresStale = true;

    [...probeLitMaterials, probeMaterial].forEach((material) => {
        volume.applyToMaterial(material);
        material.update();
    });
};

// the settings set by the example rather than by the controls, which don't mark a bake as needed
let quiet = false;

/**
 * Sets settings without marking a bake as needed.
 *
 * @param {object} values - The settings, by name.
 */
const setQuietly = (values) => {
    quiet = true;
    Object.entries(values).forEach(([name, value]) => data.set(`settings.${name}`, value));
    quiet = false;
};

// the baker of the volume, created on the first bake, and again when the volume, its face size or
// emission changes
/** @type {ProbeVolumeBaker|null} */
let baker = null;

// the presets whose bake was requested during a bake, and whether with a capture
/** @type {Set<number>} */
const bakePendingPresets = new Set();
let bakePendingCapture = false;

/**
 * Bakes the lighting of presets, and with capture true, captures the geometry of the probes first.
 *
 * @param {boolean} capture - Whether to capture the geometry.
 * @param {number[]} [indices] - The presets to bake. Defaults to all presets after a capture, as the
 * probes changed, and to the preset selected otherwise. An empty list only captures the geometry.
 */
const bake = async (capture, indices) => {
    // a bake in progress, set for the whole bake: the baker is not busy between the presets, while the
    // sky follows the next preset
    if (data.get('bake.baking')) {
        bakePendingPresets.add(data.get('settings.preset'));
        bakePendingCapture ||= capture;
        return;
    }

    // a device which cannot render to float textures cannot bake, and loads the probes baked ahead
    // of time
    if (!ProbeVolumeBaker.isSupported(device)) {
        data.set('bake.status', 'Cannot bake here');
        return;
    }

    // the settings of the probe volume apply when its geometry is captured, so the lighting baked
    // while they are edited is baked for the volume captured before
    if (capture || !baker) {
        // a new volume for a new box or spacing
        const spacing = data.get('settings.spacing');
        const size = volumeBox.halfExtents;
        const resolution = [size.x, size.y, size.z].map((half) => Math.max(1, Math.round((half * 2) / spacing)));
        if (
            !volume ||
            !volume.aabb.equals(volumeBox) ||
            volume.resolution.some((count, i) => count !== resolution[i])
        ) {
            setVolume(
                new ProbeVolume(device, { aabb: volumeBox, resolution, format: formats[data.get('settings.format')] })
            );
            baker?.destroy();
            baker = null;
        }
        const faceSize = data.get('settings.faceSize');
        const emissive = data.get('settings.emissive');
        if (!baker || baker.faceSize !== faceSize || baker.emissive !== emissive) {
            baker?.destroy();
            baker = new ProbeVolumeBaker(app, volume, { faceSize, emissive, layers: [worldLayer.id, LAYERID_SKYBOX] });
        }
    }
    capture ||= !baker.hasGeometry;
    indices ??= capture ? presets.map((preset, index) => index) : [data.get('settings.preset')];

    // the settings changed from now on need another bake
    if (indices.length > 0) {
        data.set('bake.relight', false);
    }
    if (capture) {
        data.set('bake.capture', false);
        spacingPreview = false;
        updateVolumePreview();
    }

    // the volume baked, as the volume could be replaced during the bake
    const bakedVolume = volume;
    data.set('bake.baking', true);

    // the dynamic objects are not part of the baked lighting, so hide them, which also keeps them
    // from casting shadows into it
    dynamic.enabled = false;
    probeSpheres.enabled = false;

    try {
        // the capture of the geometry shows its progress, and the Baking panel is disabled during it
        if (capture) {
            const startTime = performance.now();
            data.set('bake.progress', 0);
            data.set('bake.capturing', true);
            const result = await baker.captureGeometry({
                validity: data.get('settings.validity'),
                virtualOffset: data.get('settings.virtualOffset'),
                onProgress: (/** @type {number} */ progress) => {
                    data.set('bake.progress', progress);
                    data.set('bake.status', `Capturing ${Math.round(progress * 100)}%`);
                }
            });
            data.set('bake.capturing', false);
            const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
            data.set('bake.probes', `${result.probeCount}`);
            data.set('bake.geometry', `${seconds} s`);
            probeSpheresStale = true;
        }

        // each preset baked into its lighting, under its real-time lighting
        const source = data.get('settings.source');
        const startTime = performance.now();
        await indices.reduce(
            (previous, index) =>
                previous.then(async () => {
                    applyLighting(presets[index]);
                    await waitFrames(4);
                    return baker.bakeLighting({
                        source,
                        index,
                        bounces: data.get('settings.bounces'),
                        dilation: data.get('settings.dilation'),
                        onProgress: (/** @type {number} */ progress) => {
                            data.set('bake.status', `Baking ${index + 1}: ${Math.round(progress * 100)}%`);
                        }
                    });
                }),
            Promise.resolve()
        );
        // the preset selected now, which could have changed during the bake
        const active = data.get('settings.preset');
        applyLighting(presets[active]);
        bakedVolume.activeLighting = active;

        const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
        if (indices.length > 0) {
            data.set('bake.lighting', `${seconds} s`);
        }
        data.set('bake.status', 'Ready');
        showProbeSpheres(data.get('settings.showProbes'));
    } catch (error) {
        data.set('bake.status', 'Bake failed');
        console.error(error);
    }
    data.set('bake.capturing', false);
    dynamic.enabled = data.get('settings.characters');
    data.set('bake.baking', false);

    if (bakePendingPresets.size > 0) {
        const pendingCapture = bakePendingCapture;
        const pendingPresets = [...bakePendingPresets];
        bakePendingPresets.clear();
        bakePendingCapture = false;
        bake(pendingCapture, pendingCapture ? undefined : pendingPresets);
    }
};

// downloads the probes of all presets, as loaded at startup. The settings of the presets, which the
// example code holds, are printed to the console
const download = () => {
    const blob = new Blob([volume.serialize()], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'concrete-pavilion-probes.bin';
    link.click();
    URL.revokeObjectURL(link.href);
    console.log('the presets:', JSON.stringify(presets));
};

// the Baking panel expanded the first time: the geometry of the probes is captured, without baking
// their lighting, which was loaded, so that editing the lighting of a preset only bakes its lighting
data.on('expand', () => {
    if (!baker?.hasGeometry && !data.get('bake.baking')) {
        bake(true, []);
    }
});
data.on('relight', () => bake(false));
data.on('download', download);
data.on('pointerup', () => {
    if (spacingPreview) {
        spacingPreview = false;
        updateVolumePreview();
    }
});

// the settings applied by baking the lighting again from the captured geometry, and the settings
// which need the geometry captured again, which enable the Bake preset and the Capture buttons when
// changed. With auto bake, the lighting is baked again as soon as a lighting setting changes
const relightSettings = new Set([...bakedSettings, 'source', 'bounces', 'dilation']);
const captureSettings = new Set(['spacing', 'faceSize', 'emissive', 'validity', 'virtualOffset']);

data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [group, name] = path.split('.');
    if (group !== 'settings') {
        return;
    }

    // the settings of the preset selected, edited. During a bake, the sky shows the preset baked, and
    // the preset selected is shown when the bake ends
    if (presetSettings.includes(name)) {
        const preset = presets[data.get('settings.preset')];
        preset[name] = value;
        if (!data.get('bake.baking')) {
            applyLighting(preset);
        }
    }

    if (!quiet) {
        if (relightSettings.has(name)) {
            data.set('bake.relight', true);
        }
        if (
            (relightSettings.has(name) || name === 'autoRelight') &&
            data.get('settings.autoRelight') &&
            data.get('bake.relight')
        ) {
            bake(false);
        }
        if (captureSettings.has(name)) {
            data.set('bake.capture', true);
        }
    }

    switch (name) {
        case 'preset':
            // the real-time lighting and the baked lighting of the preset
            setQuietly(presetControls(presets[value]));
            if (!data.get('bake.baking')) {
                applyLighting(presets[value]);
            }
            if (volume && value < volume.lightingCount) {
                volume.activeLighting = value;
            }
            data.set('bake.relight', false);
            break;
        case 'probes':
            volume.enabled = value;
            break;
        case 'shSharpening':
            volume.shSharpening = value;
            break;
        case 'leakReduction':
            volume.leakReduction = value;
            break;
        case 'visibility':
            volume.visibility = value;
            break;
        case 'reflectionOcclusion':
            volume.reflectionOcclusion = value;
            break;
        case 'intensity':
            volume.intensity = value;
            break;
        case 'normalBias':
            volume.normalBias = value;
            break;
        case 'format':
            volume.format = formats[value];
            break;
        case 'showProbes':
            showProbeSpheres(value && !data.get('bake.baking'));
            break;
        case 'characters':
            dynamic.enabled = value && !data.get('bake.baking');
            break;
        case 'editVolume':
            updateVolumeGizmo();

            // done editing the probe volume: its geometry is captured again when it changed, and the
            // lighting of all presets baked again for it
            if (!value && data.get('bake.capture')) {
                bake(true);
            }
            break;
        case 'spacing':
            if (!quiet) {
                spacingPreview = true;
                updateVolumePreview();
            }
            break;
    }
});

// the probes baked ahead of time, showing the initial preset, or baked now if they could not be loaded
if (probesLoaded) {
    setVolume(ProbeVolume.deserialize(device, probesAsset.resource, { format: formats[data.get('settings.format')] }));
    volume.activeLighting = initialPreset;
    volumeBox.copy(volume.aabb);
    setQuietly({ spacing: Math.round(volume.getCellSize(new Vec3()).x * 10) / 10 });
    data.set('bake.probes', `${volume.probeCount}`);
    data.set('bake.geometry', 'Loaded');
    data.set('bake.lighting', `${volume.lightingCount} presets loaded`);
    data.set('bake.status', 'Ready');
} else {
    bake(true);
}
updateVolumeGizmo();
