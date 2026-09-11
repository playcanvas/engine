// @config
//
// Environment lighting sources test. Engine rules: the scene atlas and cubemap combine (atlas = rough
// reflections + ambient, cubemap = sharp mirror term); a material environment texture replaces the scene
// environment for every role, priority atlas + cubemap > atlas > cubemap > sphere map, and roles it does
// not cover fall back to constant ambient; useSkybox allows the scene environment when the material has
// none; ambient follows the atlas unless SH is set; refraction reuses reflections.
// Reference sphere: scene env (wide street, an HDR). Test spheres: material env from the controls (empty room; its
// atlas, cubemap, sphere map and SH come from one HDR and should match). The green neighbour probe draws
// before the test spheres: green on them means a leaked texture. The overlay attributes each role.
//
// @flag HIDDEN
// @flag ENGINE=debug

import {
    AMBIENTSRC_AMBIENTSH,
    AMBIENTSRC_CONSTANT,
    AMBIENTSRC_ENVALATLAS,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    Color,
    CUBEPROJ_BOX,
    CUBEPROJ_NONE,
    CubemapHandler,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LAYERID_SKYBOX,
    LAYERID_UI,
    LAYERID_WORLD,
    Layer,
    Mouse,
    PIXELFORMAT_RGBA8,
    Quat,
    REFLECTIONSRC_CUBEMAP,
    REFLECTIONSRC_ENVATLAS,
    REFLECTIONSRC_ENVATLASHQ,
    REFLECTIONSRC_NONE,
    REFLECTIONSRC_SPHEREMAP,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    SHADER_FORWARD,
    StandardMaterial,
    Texture,
    TextureHandler,
    TouchDevice,
    TRACEID_SHADER_ALLOC,
    Tracing,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ElementComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, CubemapHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// The material environment: cube faces, sphere map and SH are all generated offline from
// assets/hdri/empty-room.hdr. The sphere map is stored in the orientation reflectionSpherePS samples
// (t = 0 is the first row), so it appears upside down when viewed as an image.
const faceNames = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];

/** @type {Record<string, Asset>} */
const assets = {
    sceneHdr: new Asset('wide-street', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false }),
    roomSphereMap: new Asset(
        'empty-room-spheremap',
        'texture',
        { url: './assets/cubemaps/empty-room-spheremap.png' },
        { srgb: true }
    ),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};
for (const face of faceNames) {
    assets[`room_${face}`] = new Asset(
        `empty-room_${face}`,
        'texture',
        { url: `./assets/cubemaps/empty-room_faces/empty-room_${face}.png` },
        { srgb: true }
    );
}

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// combine the six faces into a cubemap
const roomCubemapAsset = new Asset('empty-room-cubemap', 'cubemap', null, {
    textures: faceNames.map((face) => assets[`room_${face}`].id)
});
roomCubemapAsset.loadFaces = true;
app.assets.add(roomCubemapAsset);
await new Promise((resolve) => {
    roomCubemapAsset.ready(resolve);
    app.assets.load(roomCubemapAsset);
});

app.start();

/**
 * Generates a prefiltered environment atlas from a cubemap or an equirect texture.
 *
 * @param {Texture} source - The source texture.
 * @param {string} name - The name of the resulting atlas texture.
 * @returns {Texture} The atlas.
 */
const createAtlas = (source, name) => {
    const lighting = EnvLighting.generateLightingSource(source);
    const atlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
    atlas.name = name;
    return atlas;
};

// scene environment (wide street): a full resolution skybox cubemap for the background and the sharp
// reflection term, and a lighting atlas, both generated from the same HDR
const sceneHdr = assets.sceneHdr.resource;
const sceneCubemap = EnvLighting.generateSkyboxCubemap(sceneHdr);
sceneCubemap.name = 'wide-street-skybox';
const sceneAtlas = createAtlas(sceneHdr, 'wide-street-atlas');

// material environment (empty room)
const roomCubemap = roomCubemapAsset.resource;
const roomAtlas = createAtlas(roomCubemap, 'empty-room-atlas');
const roomSphereMap = assets.roomSphereMap.resource;

// SH9 irradiance of the same environment, in the layout evaluated by ambientPS (r, g, b per coefficient)
const roomSH = new Float32Array([
    0.2198, 0.2041, 0.1619, 0.0195, 0.0219, 0.0247, 0.0243, 0.0317, 0.0318, -0.0232, -0.0201, -0.0036, -0.0475, -0.0447,
    -0.0337, 0.0059, 0.0067, 0.0097, 0.0161, 0.0168, 0.0162, 0.0022, 0.0032, 0.0023, -0.0038, -0.0019, -0.0025
]);

// neighbour probe environment: a saturated green cubemap nothing else in the scene can be confused with
const greenFace = new Uint8Array(4 * 4 * 4);
for (let i = 0; i < 16; i++) {
    greenFace.set([0, 255, 0, 255], i * 4);
}
const probeCubemap = new Texture(device, {
    name: 'probe-green-cubemap',
    cubemap: true,
    width: 4,
    height: 4,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    levels: [[greenFace, greenFace, greenFace, greenFace, greenFace, greenFace]]
});
const probeAtlas = createAtlas(probeCubemap, 'probe-green-atlas');

// layers: the probe draws first, then the test spheres, then the reference sphere in the world layer
const worldLayer = app.scene.layers.getLayerByName('World');
const probeLayer = new Layer({ name: 'Probe' });
const testLayer = new Layer({ name: 'Test' });
app.scene.layers.insertOpaque(probeLayer, app.scene.layers.getOpaqueIndex(worldLayer));
app.scene.layers.insertOpaque(testLayer, app.scene.layers.getOpaqueIndex(worldLayer));

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    layers: [probeLayer.id, testLayer.id, LAYERID_WORLD, LAYERID_SKYBOX, LAYERID_UI]
});
camera.addComponent('script');
camera.setPosition(0, 1, 9.5);
app.root.addChild(camera);

// orbit around the middle sphere; the initial view looks straight down -z so a sphere map and a
// cubemap of the same environment render the same until the camera moves
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cameraControls, {
    focusPoint: new Vec3(0, 1, 0),
    sceneSize: 10,
    enableFly: false,
    enablePan: false,
    zoomRange: new Vec2(3, 30)
});

/**
 * Creates a metallic-workflow standard material.
 *
 * @param {string} name - The material name.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (name) => {
    const material = new StandardMaterial();
    material.name = name;
    material.diffuse = new Color(0.8, 0.8, 0.8);
    material.useMetalness = true;
    material.glossInvert = true; // the gloss value is roughness
    material.update();
    return material;
};

const referenceMaterial = createMaterial('reference');
const testMaterial = createMaterial('test');
// a mid grey dielectric, so the ambient readout does not blow out under a sunlit environment
const matteMaterial = createMaterial('test-matte');
matteMaterial.diffuse = new Color(0.5, 0.5, 0.5);
matteMaterial.metalness = 0;
matteMaterial.gloss = 0.75; // roughness

const probeMaterial = createMaterial('neighbour-probe');
probeMaterial.envAtlas = probeAtlas;
probeMaterial.useSkybox = false;
probeMaterial.metalness = 1;
probeMaterial.gloss = 0; // roughness
probeMaterial.update();

/**
 * Creates a sphere with a text label above it. The returned entity is the parent of both, so
 * disabling it hides the label as well.
 *
 * @param {string} label - The label text.
 * @param {StandardMaterial} material - The material.
 * @param {number} x - The x position.
 * @param {number} y - The y position.
 * @param {number} radius - The sphere radius.
 * @param {number} [layer] - The render layer id.
 * @returns {Entity} The parent entity.
 */
const createSphere = (label, material, x, y, radius, layer = LAYERID_WORLD) => {
    const root = new Entity(label);
    root.setLocalPosition(x, y, 0);
    app.root.addChild(root);

    const sphere = new Entity('sphere');
    sphere.addComponent('render', {
        type: 'sphere',
        material: material,
        layers: [layer]
    });
    sphere.setLocalScale(radius * 2, radius * 2, radius * 2);
    root.addChild(sphere);

    const text = new Entity('label');
    text.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        text: label,
        fontAsset: assets.font,
        fontSize: 0.22,
        pivot: [0.5, 0.5],
        anchor: [0.5, 0.5, 0.5, 0.5]
    });
    text.setLocalPosition(0, radius + 0.35, 0);
    root.addChild(text);

    return root;
};

createSphere('reference: scene env', referenceMaterial, -2.95, 1, 1.4);
const testSphere = createSphere('test: material env', testMaterial, 0, 1, 1.4, testLayer.id);
createSphere('test: matte dielectric', matteMaterial, 2.95, 1, 1.4, testLayer.id);
const probe = createSphere('neighbour probe (green atlas)', probeMaterial, 2.95, -2.6, 0.5, probeLayer.id);

// capture the options selected for the test material's forward shader
const reflectionNames = {
    [REFLECTIONSRC_NONE]: 'none',
    [REFLECTIONSRC_ENVATLAS]: 'atlas',
    [REFLECTIONSRC_ENVATLASHQ]: 'atlas + cubemap',
    [REFLECTIONSRC_CUBEMAP]: 'cubemap',
    [REFLECTIONSRC_SPHEREMAP]: 'sphere map'
};
const ambientNames = {
    [AMBIENTSRC_CONSTANT]: 'constant',
    [AMBIENTSRC_ENVALATLAS]: 'atlas',
    [AMBIENTSRC_AMBIENTSH]: 'SH'
};
let shaderInfo = 'not compiled yet';
let compiles = 0;
let compiledReflection = null;
let compiledAmbient = null;
let compiledRefraction = null;
testMaterial.onUpdateShader = (options) => {
    if (options.pass === SHADER_FORWARD) {
        compiles++;
        const lit = options.litOptions;
        compiledReflection = lit.reflectionSource;
        compiledAmbient = lit.ambientSource;
        compiledRefraction = !!lit.useRefraction;
        shaderInfo =
            `reflection=${reflectionNames[lit.reflectionSource]} [${lit.reflectionEncoding ?? '-'}], ` +
            `ambient=${ambientNames[lit.ambientSource]} [${lit.ambientEncoding ?? '-'}], ` +
            `intensity ${lit.skyboxIntensity ? 'yes' : 'no'}, rotation ${lit.useCubeMapRotation ? 'yes' : 'no'}`;
    }
    return options;
};

// rebuild the test shaders on request, so rows that the material does not invalidate itself can still be inspected
data.on('rebuild', () => {
    testMaterial.clearVariants();
    matteMaterial.clearVariants();
});

// record what the env samplers actually see when the test sphere draws: the forward renderer publishes
// meshInstanceId right before each draw, which identifies the draw call without any renderer hooks
const testMeshInstance = testSphere.findByName('sphere').render.meshInstances[0];
const meshInstanceIdScope = device.scope.resolve('meshInstanceId');
const envScopes = ['texture_envAtlas', 'texture_cubeMap', 'texture_sphereMap', 'scene_envAtlas', 'scene_skybox'].map(
    (name) => device.scope.resolve(name)
);
let scopeAtTestDraw = 'not drawn yet';
const originalDraw = device.draw;
device.draw = function (...args) {
    if (meshInstanceIdScope.value === testMeshInstance.id) {
        const values = envScopes.map((scope) => `${scope.name}=${scope.value?.name ?? 'NONE'}`);
        scopeAtTestDraw = `    ${values.slice(0, 3).join(', ')}\n    ${values.slice(3).join(', ')}`;
    }
    return originalDraw.apply(this, args);
};

// count missing texture errors reported by the engine
let textureErrors = 0;
let lastTextureError = '';
const originalConsoleError = console.error;
console.error = (...args) => {
    const message = args.map(String).join(' ');
    if (/texture/i.test(message) && /not set|required for rendering/i.test(message)) {
        textureErrors++;
        lastTextureError = message.split(' Rendering [')[0].slice(0, 110);
    }
    originalConsoleError.apply(console, args);
};

const overlay = document.createElement('div');
overlay.style.cssText = [
    'position:absolute',
    'left:14px',
    'bottom:14px',
    'max-width:760px',
    'padding:10px 12px',
    'border-radius:4px',
    'background:rgba(0,0,0,0.72)',
    'color:#fff',
    'font:12px/1.4 monospace',
    'pointer-events:none',
    'white-space:pre'
].join(';');
document.body.appendChild(overlay);

data.set('data', {
    scene: {
        env: 'atlas+cubemap',
        mip: 0,
        intensity: 1,
        rotation: 0,
        ambient: 0.2
    },
    material: {
        env: 'none',
        useSkybox: true,
        ambientSH: false,
        boxProjection: false,
        refraction: false,
        roughness: 0.1,
        metalness: 1
    },
    probe: {
        enabled: false
    },
    traceShaderAlloc: false
});

const hasAtlas = (env) => env === 'atlas' || env === 'atlas+cubemap';
const hasCubemap = (env) => env === 'cubemap' || env === 'atlas+cubemap';

const skyboxRotation = new Quat();
const projectionBox = new BoundingBox(new Vec3(0, 0, 0), new Vec3(6, 4, 8));

/**
 * Applies the control state to the scene and materials.
 */
const applyState = () => {
    const scene = data.get('data.scene');
    const mat = data.get('data.material');

    app.scene.envAtlas = hasAtlas(scene.env) ? sceneAtlas : null;
    app.scene.skybox = hasCubemap(scene.env) ? sceneCubemap : null;
    app.scene.skyboxMip = scene.mip;
    app.scene.skyboxIntensity = scene.intensity;
    app.scene.skyboxRotation = skyboxRotation.setFromEulerAngles(0, scene.rotation, 0);
    app.scene.ambientLight.set(scene.ambient, scene.ambient, scene.ambient);

    for (const material of [testMaterial, matteMaterial]) {
        material.envAtlas = hasAtlas(mat.env) ? roomAtlas : null;
        material.cubeMap = hasCubemap(mat.env) ? roomCubemap : null;
        material.sphereMap = mat.env === 'spheremap' ? roomSphereMap : null;
        material.ambientSH = mat.ambientSH ? roomSH : null;
        material.useSkybox = mat.useSkybox;
        material.cubeMapProjection = mat.boxProjection ? CUBEPROJ_BOX : CUBEPROJ_NONE;
        material.cubeMapProjectionBox = mat.boxProjection ? projectionBox : null;
        // full transmission, so the refracted environment replaces the diffuse term entirely
        material.refraction = mat.refraction ? 1 : 0;
    }

    for (const material of [referenceMaterial, testMaterial]) {
        material.gloss = mat.roughness; // glossInvert: roughness
        material.metalness = mat.metalness;
    }

    for (const material of [referenceMaterial, testMaterial, matteMaterial]) {
        material.update();
    }

    probe.enabled = data.get('data.probe.enabled');
    Tracing.set(TRACEID_SHADER_ALLOC, data.get('data.traceShaderAlloc'));
};

/**
 * Resolves the source of each lighting role of the test material the way StandardMaterialOptionsBuilder
 * does: every candidate is listed in priority order, the first available one is used.
 *
 * @returns {object} The candidate lists (items have text, available, active), the resolved reflection
 * and ambient constants, and explanatory notes.
 */
const describeSources = () => {
    const scene = data.get('data.scene');
    const mat = data.get('data.material');
    const matAtlas = hasAtlas(mat.env);
    const matCubemap = hasCubemap(mat.env);
    const matSphere = mat.env === 'spheremap';
    const sceneAtlasOn = hasAtlas(scene.env);
    const sceneCubemapOn = hasCubemap(scene.env);
    const materialEnv = matAtlas || matCubemap || matSphere;
    const sceneUsable = mat.useSkybox && !materialEnv;

    // marks the first available candidate as the one in use
    const pick = (items) => {
        const first = items.find((item) => item.available);
        first.active = true;
        return first;
    };

    const reflectionMaterial = [
        { text: 'atlas+cubemap', available: matAtlas && matCubemap, source: REFLECTIONSRC_ENVATLASHQ, blurred: true },
        { text: 'atlas', available: matAtlas, source: REFLECTIONSRC_ENVATLAS, blurred: true },
        { text: 'cubemap', available: matCubemap, source: REFLECTIONSRC_CUBEMAP, blurred: false },
        { text: 'sphere map', available: matSphere, source: REFLECTIONSRC_SPHEREMAP, blurred: false }
    ];
    const reflectionScene = [
        {
            text: 'atlas+skybox',
            available: sceneUsable && sceneAtlasOn && sceneCubemapOn,
            source: REFLECTIONSRC_ENVATLASHQ,
            blurred: true
        },
        { text: 'atlas', available: sceneUsable && sceneAtlasOn, source: REFLECTIONSRC_ENVATLAS, blurred: true },
        { text: 'skybox', available: sceneUsable && sceneCubemapOn, source: REFLECTIONSRC_CUBEMAP, blurred: false },
        { text: 'none', available: true, source: REFLECTIONSRC_NONE, blurred: false }
    ];
    const reflection = pick([...reflectionMaterial, ...reflectionScene]);
    const materialReflections = reflectionMaterial.some((item) => item.active);

    const ambientItems = [
        { text: 'material SH', available: mat.ambientSH, source: AMBIENTSRC_AMBIENTSH },
        { text: 'material atlas', available: matAtlas, source: AMBIENTSRC_ENVALATLAS },
        { text: 'scene atlas', available: sceneUsable && sceneAtlasOn, source: AMBIENTSRC_ENVALATLAS },
        { text: 'constant ambientLight', available: true, source: AMBIENTSRC_CONSTANT }
    ];
    const ambient = pick(ambientItems);

    const refractionItems = [
        { text: 'the reflections', available: mat.refraction && reflection.source !== REFLECTIONSRC_NONE },
        { text: 'off', available: true }
    ];
    const refraction = pick(refractionItems);

    // the sky mesh: Scene._getSkyboxTex prefers the cubemap at mip 0 and the atlas otherwise
    const backgroundItems =
        scene.mip > 0
            ? [
                  { text: `atlas mip ${scene.mip}`, available: sceneAtlasOn },
                  { text: 'skybox cubemap', available: sceneCubemapOn },
                  { text: 'clear color', available: true }
              ]
            : [
                  { text: 'skybox cubemap', available: sceneCubemapOn },
                  { text: 'atlas mip 0', available: sceneAtlasOn },
                  { text: 'clear color', available: true }
              ];
    pick(backgroundItems);

    const notes = [];
    if (materialEnv && !matAtlas && !mat.ambientSH) {
        notes.push('the material environment has no atlas: ambient falls back to constant ambientLight');
    }
    if (matSphere) {
        notes.push('a sphere map is view-space: orbit the camera and its reflection follows the view');
    }
    if (refraction.text === 'the reflections') {
        notes.push(
            `refraction is ${reflection.blurred ? 'blurred by roughness' : 'sharp'} and scaled by 1 - metalness: matte sphere only`
        );
    } else if (mat.refraction) {
        notes.push('refraction is off: it needs a reflection source');
    }
    if (!mat.useSkybox && !materialReflections) {
        notes.push('useSkybox off: the scene environment is ignored by this material');
    }
    if (materialEnv && mat.useSkybox && (sceneAtlasOn || sceneCubemapOn)) {
        notes.push('the scene environment is present but overridden by the material');
    }

    return {
        reflectionMaterial,
        reflectionScene,
        ambientItems,
        refractionItems,
        backgroundItems,
        reflection,
        ambient,
        refraction,
        notes
    };
};

data.on('*:set', applyState);
applyState();

const STYLE_USED = 'color:#8f8;font-weight:bold';
const STYLE_OVERRIDDEN = 'color:#fff';
const STYLE_OFF = 'color:#777';
const SEPARATOR = '<span style="color:#666"> &rsaquo; </span>';
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const span = (style, text) => `<span style="${style}">${escapeHtml(text)}</span>`;
const chain = (items) =>
    items
        .map((item) => span(item.active ? STYLE_USED : item.available ? STYLE_OVERRIDDEN : STYLE_OFF, item.text))
        .join(SEPARATOR);

app.on('update', () => {
    const published = Object.keys(testMaterial.parameters)
        .filter((name) => name.startsWith('texture_'))
        .map((name) => `${name.replace('texture_', '')}=${testMaterial.parameters[name].data?.name ?? '?'}`)
        .join(', ');

    const sources = describeSources();
    const agrees =
        compiledReflection === sources.reflection.source &&
        compiledAmbient === sources.ambient.source &&
        compiledRefraction === (sources.refraction.text === 'the reflections');
    const check =
        compiledReflection === null
            ? 'shader not compiled yet'
            : agrees
              ? 'the compiled shader agrees'
              : `!! the compiled shader differs: ${shaderInfo}, refraction ${compiledRefraction ? 'on' : 'off'}`;

    const notes = sources.notes.map((note) => `  ${escapeHtml(note)}\n`).join('');

    overlay.innerHTML =
        `<b>WHAT FEEDS THE TEST MATERIAL</b>   first available wins:  ${span(STYLE_USED, 'used')}  ${span(STYLE_OVERRIDDEN, 'available, overridden')}  ${span(STYLE_OFF, 'not set')}\n` +
        `REFLECTIONS  material: ${chain(sources.reflectionMaterial)}\n` +
        `             scene:    ${chain(sources.reflectionScene)}\n` +
        `AMBIENT      ${chain(sources.ambientItems)}\n` +
        `REFRACTION   ${chain(sources.refractionItems)}\n` +
        `BACKGROUND   ${chain(sources.backgroundItems)}   (skyboxMip ${data.get('data.scene.mip')}, sky mesh only)\n` +
        `${notes}  ${escapeHtml(check)}\n\n` +
        `<b>COMPILED SHADER</b> (${compiles}x): ${escapeHtml(shaderInfo)}\n` +
        `  publishes: ${escapeHtml(published || '(no textures)')}\n` +
        `  scope at test sphere draw:\n${escapeHtml(scopeAtTestDraw)}\n\n` +
        `MISSING TEXTURE ERRORS: ${textureErrors}${lastTextureError ? `\n  ${escapeHtml(lastTextureError)}` : ''}\n` +
        'Drag to orbit the middle sphere. Green on a test sphere = a neighbour texture leaked through the scope.';
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    console.error = originalConsoleError;
    device.draw = originalDraw;
    Tracing.set(TRACEID_SHADER_ALLOC, false);
    overlay.remove();
    sceneAtlas.destroy();
    sceneCubemap.destroy();
    roomAtlas.destroy();
    probeAtlas.destroy();
    probeCubemap.destroy();
});
