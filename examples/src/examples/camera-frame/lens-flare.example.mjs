// @config
//
// This example shows the lens flare effect of a CameraFrame. A LensFlare follows a light: the sun
// of the procedural sky gets a large flare with a diffraction burst and a train of ghosts, the
// lamps a small glow, and the spot lights flare only while the camera is inside their cone. The
// flares fade as their light is occluded by the scene, which is measured against the scene depth.
// The shapes of all flares are textures of one shape library, which the effect copies into a
// texture array.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LensFlare,
    LensFlareEffect,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { ProceduralSky } from 'playcanvas/scripts/esm/sky/procedural-sky.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    rocks: new Asset('rocks', 'texture', { url: './assets/textures/aerial_rocks_02_diff_1k.jpg' }, { srgb: true })
};

// The lens flare shapes: procedurally generated textures, see assets/textures/lens-flare/lens-flare.txt, with the
// shape in the colour channels and its coverage in alpha
const flareShapeNames = [
    'glow_soft',
    'glow_disc',
    'glow_rim',
    'halo',
    'iris_hexagon',
    'iris_round',
    'iris_pentagon',
    'iris_triangle',
    'spike_6',
    'burst_star',
    'glint',
    'anamorphic_streak',
    'anamorphic_glow',
    'spectrum_arc',
    'spectrum_smudge'
];
const flareShapeAssets = flareShapeNames.map(
    (name) => new Asset(name, 'texture', { url: `./assets/textures/lens-flare/${name}.png` }, { srgb: true })
);

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);

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
    new AssetListLoader([...Object.values(assets), ...flareShapeAssets], app.assets).load(resolve);
});

app.start();

app.scene.exposure = 1;

// ------ Scene ------

// Lights shine along the negative y axis of their entity. Aims a light along a world direction.
const aimLight = (entity, direction) => {
    const target = entity.getPosition().clone().add(direction);
    entity.lookAt(target);
    entity.rotateLocal(90, 0, 0);
};

// A material with the rock texture, tiled
const createRockMaterial = (tiling) => {
    const material = new StandardMaterial();
    material.diffuseMap = assets.rocks.resource;
    material.diffuseMapTiling = new Vec2(tiling, tiling);
    material.gloss = 0.3;
    material.update();
    return material;
};

// Helper creating a primitive at a position with a scale
const createPrimitive = (type, position, scale, material) => {
    const entity = new Entity(type);
    entity.addComponent('render', { type, material });
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    app.root.addChild(entity);
    return entity;
};

// Helper creating an emissive material of a colour, bright enough to bloom
const createEmissiveMaterial = (color, intensity) => {
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = intensity;
    material.update();
    return material;
};

// The ground and a few walls, which occlude the sun and the lamps as the camera orbits
const groundMaterial = createRockMaterial(12);
const wallMaterial = createRockMaterial(3);
createPrimitive('box', new Vec3(0, -0.5, 0), new Vec3(120, 1, 120), groundMaterial);
createPrimitive('box', new Vec3(-6, 3, -8), new Vec3(1, 6, 10), wallMaterial);
createPrimitive('box', new Vec3(7, 2.5, -3), new Vec3(6, 5, 1), wallMaterial);
createPrimitive('box', new Vec3(0, 4, -14), new Vec3(12, 8, 1), wallMaterial);
createPrimitive('box', new Vec3(10, 3.5, 8), new Vec3(1.5, 7, 1.5), wallMaterial);
createPrimitive('box', new Vec3(-10, 2, 6), new Vec3(1.5, 4, 1.5), wallMaterial);

// The sun: a directional light, which the procedural sky aims, colours and dims with the sun
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    intensity: 2.5,
    castShadows: true,
    shadowDistance: 60,
    shadowResolution: 2048,
    shadowBias: 0.3,
    normalOffsetBias: 0.1
});
app.root.addChild(sun);

// The procedural sky, with the sun low above the horizon so that it sits in the view of the camera.
// It renders the sun disc the flare is drawn over, and generates the image based lighting.
const sky = new Entity('ProceduralSky');
sky.addComponent('script');
const skyScript = /** @type {ProceduralSky} */ (sky.script.create(ProceduralSky));
skyScript.sunLight = sun;
skyScript.elevation = 6;
skyScript.azimuth = 160;
skyScript.turbidity = 4;
skyScript.mieCoefficient = 0.002;
skyScript.rayleigh = 2.5;
skyScript.luminance = 0.7;
app.root.addChild(sky);

// Lamps: omni lights on poles, each with an emissive bulb
const lamps = [];
const createLamp = (position, color) => {
    const pole = createPrimitive(
        'cylinder',
        new Vec3(position.x, position.y * 0.5, position.z),
        new Vec3(0.15, position.y, 0.15),
        wallMaterial
    );
    const bulb = createPrimitive('sphere', position, new Vec3(0.5, 0.5, 0.5), createEmissiveMaterial(color, 12));
    const lamp = new Entity('Lamp');
    lamp.addComponent('light', {
        type: 'omni',
        color,
        intensity: 2,
        range: 14,
        castShadows: false
    });
    lamp.setLocalPosition(position);
    app.root.addChild(lamp);
    lamps.push({ lamp, pole, bulb });
    return lamp;
};
createLamp(new Vec3(-4, 3.5, 2), new Color(1, 0.6, 0.2));
createLamp(new Vec3(4, 3, 4), new Color(0.3, 0.8, 1));
createLamp(new Vec3(1, 4, -6), new Color(1, 0.3, 0.7));

// Spot lights: stage lights on a tall mast, aimed across the scene. One sweeps slowly, so its cone
// crosses the camera. The flare of a spot light only shows while the camera is inside its cone.
const spots = [];
const createSpot = (position, direction, color, outerAngle) => {
    const mast = createPrimitive(
        'cylinder',
        new Vec3(position.x, position.y * 0.5, position.z),
        new Vec3(0.2, position.y, 0.2),
        wallMaterial
    );
    const pivot = new Entity('SpotPivot');
    pivot.setLocalPosition(position);
    app.root.addChild(pivot);

    const spot = new Entity('Spot');
    spot.addComponent('light', {
        type: 'spot',
        color,
        intensity: 6,
        range: 40,
        innerConeAngle: outerAngle * 0.6,
        outerConeAngle: outerAngle,
        castShadows: false
    });
    pivot.addChild(spot);
    aimLight(spot, direction);

    // the fixture: a short cylinder along the beam with an emissive face
    const fixture = new Entity('Fixture');
    fixture.addComponent('render', { type: 'cylinder', material: wallMaterial });
    fixture.setLocalScale(0.6, 0.6, 0.6);
    spot.addChild(fixture);
    const face = new Entity('Face');
    face.addComponent('render', { type: 'cylinder', material: createEmissiveMaterial(color, 8) });
    face.setLocalPosition(0, -0.3, 0);
    face.setLocalScale(0.5, 0.05, 0.5);
    spot.addChild(face);

    spots.push({ spot, pivot, mast });
    return spot;
};
createSpot(new Vec3(-12, 7, -10), new Vec3(1, -0.25, 1), new Color(1, 1, 0.9), 25);
createSpot(new Vec3(14, 6, -2), new Vec3(-1, -0.15, 0.4), new Color(0.6, 0.8, 1), 20);

// Create an Entity with a camera component
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    farClip: 400,
    fov: 65
});
cameraEntity.setLocalPosition(2, 4, 22);

// Add orbit camera script with a mouse and a touch support
const focusPoint = new Entity('Focus');
focusPoint.setLocalPosition(0, 3, 0);
app.root.addChild(focusPoint);

cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: focusPoint,
        distanceMax: 60,
        distanceMin: 2,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');
app.root.addChild(cameraEntity);

// ------ Lens flares ------

// The looks: the elements each kind of light places along the axis from the light through the
// centre of the screen. Offsets of 0 sit on the light, 1 at the centre, 2 mirrored across it.
// Sizes are fractions of the screen height, and the shapes are the textures loaded above.
const sunLook = {
    elements: [
        { shape: 'glow_soft', size: 0.4, color: [1, 0.85, 0.65], intensity: 3 },
        { shape: 'burst_star', size: 0.8, color: [1, 0.95, 0.85], intensity: 3.5 },
        { shape: 'anamorphic_streak', size: 0.08, aspect: 18, intensity: 1.5 },
        { shape: 'halo', size: 0.5, color: [1, 0.9, 0.8], intensity: 0.5 },
        {
            shape: 'iris_hexagon',
            offset: 0.45,
            size: 0.05,
            color: [0.5, 0.8, 1],
            intensity: 0.35,
            count: 3,
            spread: 0.35
        },
        { shape: 'spectrum_arc', offset: 1.1, size: 0.6, rotation: 180, autoRotate: true, intensity: 0.5 },
        { shape: 'iris_round', offset: 1.35, size: 0.2, color: [1, 0.6, 0.35], intensity: 0.4 },
        { shape: 'iris_pentagon', offset: 1.75, size: 0.1, color: [0.6, 1, 0.6], intensity: 0.6 },
        { shape: 'glow_rim', offset: 2.2, size: 0.28, color: [1, 0.5, 0.8], intensity: 0.3 },
        { shape: 'spectrum_smudge', offset: 2.6, size: 0.1, aspect: 2.5, autoRotate: true, intensity: 0.6 }
    ]
};

const lampLook = {
    elements: [
        { shape: 'glow_disc', size: 0.14, intensity: 0.8 },
        { shape: 'spike_6', size: 0.4, intensity: 1 },
        { shape: 'iris_round', offset: 0.65, size: 0.035, intensity: 0.3, count: 2, spread: 0.25 },
        { shape: 'iris_hexagon', offset: 1.5, size: 0.06, intensity: 0.3 }
    ]
};

const spotLook = {
    elements: [
        { shape: 'anamorphic_glow', size: 0.35, aspect: 2.5, intensity: 1.2 },
        { shape: 'anamorphic_streak', size: 0.06, aspect: 22, intensity: 1 },
        { shape: 'anamorphic_streak', size: 0.22, aspect: 7, intensity: 1.5 },
        { shape: 'glint', size: 0.5, intensity: 0.4 },
        { shape: 'iris_triangle', offset: 1.6, size: 0.14, intensity: 0.3 }
    ]
};

// The effect, registered with the camera frame, with the shape library and a flare per light
const lensFlare = new LensFlareEffect(device);
lensFlare.shapes = {
    resolution: 512,
    shapes: Object.fromEntries(flareShapeAssets.map((asset) => [asset.name, asset.resource]))
};

const sunFlare = new LensFlare(sunLook, { light: sun.light });
sunFlare.occlusionRadius = 0.03;
lensFlare.add(sunFlare);

const lampFlares = lamps.map(({ lamp }) => {
    const flare = new LensFlare(lampLook, { light: lamp.light });

    // the bulb is half a unit across, so test the visibility in front of it
    flare.occlusionOffset = 0.3;
    flare.fadeStart = 30;
    flare.fadeEnd = 50;
    lensFlare.add(flare);
    return flare;
});

const spotFlares = spots.map(({ spot }) => {
    const flare = new LensFlare(spotLook, { light: spot.light });
    flare.occlusionOffset = 0.5;
    lensFlare.add(flare);
    return flare;
});

const allFlares = [sunFlare, ...lampFlares, ...spotFlares];

// ------ Camera frame ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.bloom.blurLevel = 6;
cameraFrame.addEffect(lensFlare);
cameraFrame.update();

// Sweep the first spot light, so that its cone crosses the camera from time to time
let sweep = 0;
app.on('update', (dt) => {
    sweep += dt * 18;
    spots[0].pivot.setLocalEulerAngles(0, Math.sin(sweep * 0.02) * 60, 0);
});

const applySettings = () => {
    // the effect
    lensFlare.intensity = data.get('data.flare.intensity');
    lensFlare.scale = data.get('data.flare.scale');

    // the flares
    const occlusionRadius = data.get('data.flare.occlusionRadius');
    const occlusionFade = data.get('data.flare.occlusionFade');
    const edgeFade = data.get('data.flare.edgeFade');
    const allowOffScreen = data.get('data.flare.allowOffScreen');
    allFlares.forEach((flare) => {
        flare.occlusionRadius = flare === sunFlare ? occlusionRadius * 1.5 : occlusionRadius;
        flare.occlusionFade = occlusionFade;
        flare.edgeFade = edgeFade;
        flare.allowOffScreen = allowOffScreen;
    });

    // the lights
    sun.light.enabled = data.get('data.lights.sun');
    lamps.forEach(({ lamp, bulb }) => {
        lamp.light.enabled = data.get('data.lights.lamps');
        bulb.enabled = lamp.light.enabled;
    });
    spots.forEach(({ spot }) => {
        spot.light.enabled = data.get('data.lights.spots');
    });

    // debugging
    const debug = data.get('data.scene.debug');
    cameraFrame.debug = debug === 'none' ? null : debug;

    cameraFrame.update();
};

// Apply UI changes
data.on('*:set', applySettings);

// Set initial values
data.set('data', {
    scene: {
        debug: 'none'
    },
    flare: {
        intensity: 0.25,
        scale: 0.5,
        occlusionRadius: 0.02,
        occlusionFade: 0.15,
        edgeFade: 0.2,
        allowOffScreen: true
    },
    lights: {
        sun: true,
        lamps: true,
        spots: true
    }
});
