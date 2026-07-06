// @config
//
// A gaussian splat encased in a solid glass shape, cropped to the shape and refracted (with
// chromatic dispersion) through its surface.
//
// @credit
// title: Knock Community Hall
// author: scbenoit
// source: https://superspl.at/scene/0ff2e6dc
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Brown Photostudio 01 (HDRI)
// author: Poly Haven
// source: https://polyhaven.com/a/brown_photostudio_01
// license: CC0

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    BoxGeometry,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    CylinderGeometry,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    Geometry,
    LAYERID_DEPTH,
    LAYERID_IMMEDIATE,
    LAYERID_SKYBOX,
    LAYERID_UI,
    LAYERID_WORLD,
    Layer,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    SphereGeometry,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
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
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

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

const assets = {
    hall: new Asset('gsplat', 'gsplat', { url: './assets/splats/knock-community-hall.sog' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    // HDRI environment referenced directly from Poly Haven (no local copy needed)
    hdri: new Asset(
        'hdri',
        'texture',
        { url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/brown_photostudio_01_2k.hdr' },
        { mipmaps: false }
    )
};

// maximum number of crop planes supported by the shader
const MAX_PLANES = 32;

// Work buffer modifier: crops splats to the inside of a convex shape when they are written to
// the unified work buffer. The shape is either a set of face planes (in the shape's local
// space) or an analytic unit sphere. Splats outside the shape are scaled to zero, splats near
// the surface are shrunk so their 3-sigma extent stays inside the glass.
const cropShaderGLSL = /* glsl */ `
    uniform mat4 uCropMatrix;                       // world -> shape local space
    uniform vec4 uCropPlanes[${MAX_PLANES}];        // xyz = face normal, w = face distance
    uniform float uCropSphere;                      // sphere radius (analytic), or 0 for planes
    uniform float uCropScale;                       // uniform world scale of the shape
    uniform float uEdgeScaleFactor;                 // how aggressively edge splats are shrunk
    uniform float uSplatExposure;                   // brightness multiplier of the splat

    void modifySplatCenter(inout vec3 center) {
    }

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
        vec3 local = (uCropMatrix * vec4(modifiedCenter, 1.0)).xyz;

        // distance from the splat center to the nearest shape face (negative = outside)
        float minDist;
        if (uCropSphere > 0.0) {
            minDist = uCropSphere - length(local);
        } else {
            minDist = 1e5;
            for (int i = 0; i < ${MAX_PLANES}; i++) {
                minDist = min(minDist, uCropPlanes[i].w - dot(uCropPlanes[i].xyz, local));
            }
        }

        // outside the shape - clip the whole splat
        if (minDist < 0.0) {
            scale = vec3(0.0);
            return;
        }

        // shrink splats close to the surface (conservative 3 sigma bound on the splat extent)
        float worldDist = minDist * uCropScale;
        float maxRadius = length(scale) * 3.0;
        if (maxRadius > worldDist) {
            scale *= (worldDist / maxRadius) * uEdgeScaleFactor;
        }
    }

    void modifySplatColor(vec3 center, inout vec4 color) {
        color.rgb *= uSplatExposure;
    }
`;

const cropShaderWGSL = /* wgsl */ `
    uniform uCropMatrix: mat4x4f;                   // world -> shape local space
    uniform uCropPlanes: array<vec4f, ${MAX_PLANES}>;  // xyz = face normal, w = face distance
    uniform uCropSphere: f32;                       // sphere radius (analytic), or 0 for planes
    uniform uCropScale: f32;                        // uniform world scale of the shape
    uniform uEdgeScaleFactor: f32;                  // how aggressively edge splats are shrunk
    uniform uSplatExposure: f32;                    // brightness multiplier of the splat

    fn modifySplatCenter(center: ptr<function, vec3f>) {
    }

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
        let local = (uniform.uCropMatrix * vec4f(modifiedCenter, 1.0)).xyz;

        // distance from the splat center to the nearest shape face (negative = outside)
        var minDist: f32;
        if (uniform.uCropSphere > 0.0) {
            minDist = uniform.uCropSphere - length(local);
        } else {
            minDist = 1e5;
            for (var i = 0; i < ${MAX_PLANES}; i++) {
                minDist = min(minDist, uniform.uCropPlanes[i].w - dot(uniform.uCropPlanes[i].xyz, local));
            }
        }

        // outside the shape - clip the whole splat
        if (minDist < 0.0) {
            *scale = vec3f(0.0);
            return;
        }

        // shrink splats close to the surface (conservative 3 sigma bound on the splat extent)
        let worldDist = minDist * uniform.uCropScale;
        let maxRadius = length(*scale) * 3.0;
        if (maxRadius > worldDist) {
            *scale = (*scale) * (worldDist / maxRadius) * uniform.uEdgeScaleFactor;
        }
    }

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        *color = vec4f((*color).rgb * uniform.uSplatExposure, (*color).a);
    }
`;

/**
 * Create a flat-shaded (faceted) copy of a geometry by unindexing it and computing per-face
 * normals, so each face of the glass shape refracts as a flat facet.
 *
 * @param {Geometry} geometry - The source geometry.
 * @returns {Geometry} The faceted geometry.
 */
const makeFaceted = (geometry) => {
    const { positions, indices } = geometry;
    const flatPositions = [];
    for (let i = 0; i < indices.length; i++) {
        const vi = indices[i] * 3;
        flatPositions.push(positions[vi], positions[vi + 1], positions[vi + 2]);
    }
    const faceted = new Geometry();
    faceted.positions = flatPositions;
    faceted.indices = Array.from({ length: flatPositions.length / 3 }, (_, i) => i);
    faceted.calculateNormals();
    return faceted;
};

/**
 * Extract the unique face planes of a convex geometry, in its local space. Each plane is stored
 * as (nx, ny, nz, distance) with the normal pointing outwards.
 *
 * @param {Geometry} geometry - The source geometry.
 * @returns {number[]} Flat array of plane values, 4 per plane.
 */
const extractPlanes = (geometry) => {
    const { positions, indices } = geometry;
    const planes = [];
    const seen = new Set();
    const a = new Vec3();
    const b = new Vec3();
    const c = new Vec3();
    const ab = new Vec3();
    const ac = new Vec3();
    const n = new Vec3();
    for (let i = 0; i < indices.length; i += 3) {
        a.set(positions[indices[i] * 3], positions[indices[i] * 3 + 1], positions[indices[i] * 3 + 2]);
        b.set(positions[indices[i + 1] * 3], positions[indices[i + 1] * 3 + 1], positions[indices[i + 1] * 3 + 2]);
        c.set(positions[indices[i + 2] * 3], positions[indices[i + 2] * 3 + 1], positions[indices[i + 2] * 3 + 2]);
        ab.sub2(b, a);
        ac.sub2(c, a);
        n.cross(ab, ac);

        // skip degenerate triangles (e.g. at sphere poles)
        if (n.length() < 1e-6) {
            continue;
        }
        n.normalize();
        const d = n.dot(a);

        // deduplicate coplanar faces
        const r = (v) => Math.round(v * 500) / 500;
        const key = `${r(n.x)}|${r(n.y)}|${r(n.z)}|${r(d)}`;
        if (!seen.has(key)) {
            seen.add(key);
            planes.push(n.x, n.y, n.z, d);
        }
    }
    console.assert(planes.length / 4 <= MAX_PLANES, 'Too many crop planes extracted from the glass shape.');
    return planes;
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Use the HDRI as both the visible background and the lighting/reflection environment.
// generateSkyboxCubemap gives a high-resolution skybox for the background, while the
// prefiltered env-atlas drives the glass reflections and scene lighting.
const hdri = assets.hdri.resource;
app.scene.skybox = EnvLighting.generateSkyboxCubemap(hdri);
const lightingSource = EnvLighting.generateLightingSource(hdri);
app.scene.envAtlas = EnvLighting.generateAtlas(lightingSource);
lightingSource.destroy();
app.scene.skyboxMip = 1;
app.scene.exposure = 1.5;

// The splat renders into its own layer, whose transparent sub-layer is inserted right after
// the opaque skybox (index 3 of the default composition: world opaque, depth, skybox). The
// camera frame's scene color grab boundary is moved to this layer below, so the grabbed
// scene color map - which the glass refraction samples - includes the splat.
const splatLayer = new Layer({ name: 'SplatInterior' });
app.scene.layers.insertTransparent(splatLayer, 3);

// default UI values
data.set('shape', 'prism');
data.set('size', 1.4);
data.set('splatOffset', [0, -0.7, 0]);
data.set('splatScale', 0.1);
data.set('ior', 1.85);
data.set('dispersion', 3);
data.set('thickness', 0.4);
data.set('reflection', 3.5);
data.set('frost', 0);
data.set('exposure', 0.6);
data.set('background', 0.05);

// create the splat inside the glass, rendered to the splat layer. The house of the scene
// is at the origin of the splat data, scaled down to fit inside the unit-sized glass shapes
const hall = new Entity('hall');
hall.addComponent('gsplat', {
    asset: assets.hall,
    layers: [splatLayer.id]
});
hall.setLocalEulerAngles(180, 0, 0);
app.root.addChild(hall);

// position and scale of the splat inside the glass, driven by the UI. Moving or scaling the
// entity automatically re-renders it into the work buffer, where it gets cropped again.
const updateSplatTransform = () => {
    const offset = data.get('splatOffset');
    const scale = data.get('splatScale');
    hall.setLocalPosition(offset[0], offset[1], offset[2]);
    hall.setLocalScale(scale, scale, scale);
};
// brightness of the splat only - applied to the splat colors in the work buffer, so the
// glass surface and the background are not affected
const updateSplatExposure = () => {
    hall.gsplat?.setParameter('uSplatExposure', data.get('exposure'));
};

// apply the shape cropping when the splat is written to the unified work buffer
hall.gsplat?.setWorkBufferModifier({
    glsl: cropShaderGLSL,
    wgsl: cropShaderWGSL
});

// glass material with dynamic (grab pass based) refraction
const glassMaterial = new StandardMaterial();
glassMaterial.useMetalness = true;
// enable the dielectric specular-color workflow so specularityFactor (the Reflection control)
// actually scales the environment reflection. The specular color defaults to black, which
// would give zero reflectance - set it white so the reflection is visible and scalable.
glassMaterial.useMetalnessSpecularColor = true;
glassMaterial.specular = Color.WHITE;
glassMaterial.metalness = 0;
glassMaterial.gloss = 1;
// note: the refracted (transmitted) light is tinted by the diffuse color, keep it white
glassMaterial.blendType = BLEND_NORMAL;
glassMaterial.depthWrite = false;
glassMaterial.useDynamicRefraction = true;
glassMaterial.refraction = 1;
glassMaterial.refractionIndex = 1 / data.get('ior');
glassMaterial.dispersion = data.get('dispersion');
glassMaterial.thickness = data.get('thickness');
// boost of the environment reflection on the glass surface
glassMaterial.specularityFactor = data.get('reflection');
// slight colored absorption inside the glass volume
glassMaterial.attenuation = new Color(0.8, 0.95, 0.9);
glassMaterial.attenuationDistance = 2;
glassMaterial.update();

// Geometry factory for the selectable glass shapes. The gem, hex prism and sphere use a
// larger radius than the cube half-extent (0.5) so they enclose more of the splat and crop
// it less at the same Size setting. The hex prism keeps a height of 1 so it stays as tall as
// the cube. The sphere crops analytically (see SPHERE_RADIUS); the rest crop by their faces.
const SPHERE_RADIUS = 0.9;
const shapeGeometry = {
    cube: () => new BoxGeometry(),
    gem: () => new SphereGeometry({ radius: 0.87, latitudeBands: 4, longitudeBands: 6 }),
    prism: () => new CylinderGeometry({ radius: 0.66, height: 1, capSegments: 6, heightSegments: 1 }),
    sphere: () => new SphereGeometry({ radius: SPHERE_RADIUS, latitudeBands: 64, longitudeBands: 64 })
};

// the glass shape entity, rendered in the world layer (after the grab pass)
const glass = new Entity('glass');
glass.addComponent('render', { meshInstances: [] });
app.root.addChild(glass);

// crop planes of the current shape in its local space, or null for the analytic sphere
let cropPlanes = null;

// Update the crop uniforms on the gsplat component. Setting a parameter on the component
// automatically triggers a re-render of the splat into the work buffer, so the crop only
// costs when it changes.
const cropMatrix = new Mat4();
const planesArray = new Float32Array(MAX_PLANES * 4);
const updateCrop = () => {
    const gsplat = hall.gsplat;
    if (!gsplat) {
        return;
    }

    const size = data.get('size');
    glass.setLocalScale(size, size, size);

    // unused crop plane slots are padded with far-away planes that never clip
    planesArray.fill(0);
    if (cropPlanes) {
        planesArray.set(cropPlanes);
        for (let i = cropPlanes.length; i < planesArray.length; i += 4) {
            planesArray[i + 3] = 1e5;
        }
    }

    cropMatrix.copy(glass.getWorldTransform()).invert();
    gsplat.setParameter('uCropMatrix', cropMatrix.data);
    gsplat.setParameter('uCropPlanes[0]', planesArray);
    gsplat.setParameter('uCropSphere', cropPlanes ? 0 : SPHERE_RADIUS);
    gsplat.setParameter('uCropScale', size);

    // how aggressively splats near the glass surface are shrunk: 0 fully clips any splat
    // whose conservative 3-sigma extent would poke through the surface, higher values let
    // edge splats shrink instead of disappearing (up to 1 = shrink just enough to touch)
    gsplat.setParameter('uEdgeScaleFactor', 0);
};

// build the selected shape's mesh (and crop planes) on demand
const applyShape = () => {
    const name = data.get('shape');
    const faceted = name !== 'sphere';
    const geometry = shapeGeometry[name]();
    const mesh = Mesh.fromGeometry(device, faceted ? makeFaceted(geometry) : geometry);
    cropPlanes = faceted ? extractPlanes(geometry) : null;
    glass.render.meshInstances = [new MeshInstance(mesh, glassMaterial)];
    updateCrop();
};

// update the glass material when the UI changes
const applyGlassSettings = () => {
    glassMaterial.refractionIndex = 1 / data.get('ior');
    glassMaterial.dispersion = data.get('dispersion');
    glassMaterial.thickness = data.get('thickness');
    glassMaterial.specularityFactor = data.get('reflection');
    glassMaterial.gloss = 1 - 0.7 * data.get('frost');
    glassMaterial.update();
};

// brightness of the HDRI background and the environment it lights/reflects
const applyBackground = () => {
    app.scene.skyboxIntensity = data.get('background');
};

// apply initial UI state
applyShape();
updateSplatTransform();
updateSplatExposure();
applyGlassSettings();
applyBackground();

// React to UI changes. A single wildcard handler is used because VectorInput edits emit
// per-element events (e.g. 'splatOffset.1:set'), which would be missed by exact-path
// listeners - so we route on the first path segment and re-read values via data.get.
data.on('*:set', (/** @type {string} */ path) => {
    const key = path.split('.')[0];
    if (key === 'shape') {
        applyShape();
    } else if (key === 'size') {
        updateCrop();
    } else if (key === 'splatOffset' || key === 'splatScale') {
        updateSplatTransform();
    } else if (key === 'exposure') {
        updateSplatExposure();
    } else if (key === 'background') {
        applyBackground();
    } else {
        applyGlassSettings();
    }
});

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    fov: 60,
    layers: [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, splatLayer.id, LAYERID_UI, LAYERID_IMMEDIATE]
});
// positioned slightly above the shape so the top face is visible
camera.setLocalPosition(0.8, 1.35, 2.9);

// add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script?.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: glass,
        distanceMin: 1.2,
        distanceMax: 8,
        frameOnStart: false
    }
});
camera.script?.create('orbitCameraInputMouse');
camera.script?.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Camera frame with the scene color map enabled for dynamic refraction. The grab boundary is
// moved past the splat layer, so the grabbed scene color includes the splat.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.rendering.sceneColorMap = true;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.options.lastGrabLayerId = splatLayer.id;
cameraFrame.options.lastGrabLayerIsTransparent = true;
cameraFrame.update();

// Auto-rotate camera when idle
let autoRotateEnabled = true;
let lastInteractionTime = 0;
const autoRotateDelay = 2; // seconds of inactivity before auto-rotate resumes
const autoRotateSpeed = 10; // degrees per second

// Detect user interaction (click/touch only, not mouse movement)
const onUserInteraction = () => {
    autoRotateEnabled = false;
    lastInteractionTime = Date.now();
};

// Listen for click and touch events only
if (app.mouse) {
    app.mouse.on('mousedown', onUserInteraction);
    app.mouse.on('mousewheel', onUserInteraction);
}
if (app.touch) {
    app.touch.on('touchstart', onUserInteraction);
}

// Clean up event listeners on destroy
app.on('destroy', () => {
    if (app.mouse) {
        app.mouse.off('mousedown', onUserInteraction);
        app.mouse.off('mousewheel', onUserInteraction);
    }
    if (app.touch) {
        app.touch.off('touchstart', onUserInteraction);
    }
});

app.on('update', (dt) => {
    // Re-enable auto-rotate after delay
    if (!autoRotateEnabled && (Date.now() - lastInteractionTime) / 1000 > autoRotateDelay) {
        autoRotateEnabled = true;
    }

    // Apply auto-rotation
    if (autoRotateEnabled) {
        const orbitCamera = camera.script?.get('orbitCamera');
        if (orbitCamera) {
            orbitCamera.yaw += autoRotateSpeed * dt;
        }
    }
});
