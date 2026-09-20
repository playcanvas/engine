// @config
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BAKE_COLOR,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Lightmapper,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    StandardMaterial,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

// The two sources of a lightmap, side by side, each on a box above its own ground plane. A lightmap
// either comes from the material, as it does for a lightmap baked in another tool and loaded with a
// glb or assigned in the Editor, or from the mesh instance, where the runtime lightmapper stores
// what it baked. Each source has its own texture slot in the shader, and the third group, which has
// both, shows the precedence: the mesh instance lightmap is the one sampled.
//
// The baked groups are lit by a baked directional light with an area plus the baked ambient, so the
// box casts a soft shadow onto its plane and the softness makes clear the shadow is in the lightmap
// rather than a real-time one. The scene is static, as a baked shadow is only correct for the pose
// it was baked in.

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    lightmap: new Asset('lightmap', 'texture', { url: './assets/textures/clouds.jpg' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.lightmapper = Lightmapper;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// a dim sky ambient. A lightmap is taken to carry the ambient light already, so none of these
// groups adds it at runtime: the baked groups get it baked in below, and the material-only group is
// lit by its assigned lightmap alone.
app.scene.ambientLight = new Color(0.16, 0.18, 0.24);

// lightmap baking settings for the runtime bake, with enough resolution and filtering for the soft
// shadow of the box to read as a gradient rather than a hard edge
app.scene.lightmapMode = BAKE_COLOR;
app.scene.lightmapMaxResolution = 2048;
app.scene.lightmapSizeMultiplier = 256;
app.scene.lightmapFilterEnabled = true;
app.scene.lightmapFilterRange = 5;
app.scene.lightmapFilterSmoothness = 0.1;

// bake the ambient light as well, so the faces the directional light misses are filled by the sky
// instead of going black, and the crease where the box meets its plane is occluded
app.scene.ambientBake = true;
app.scene.ambientBakeNumSamples = 20;
app.scene.ambientBakeSpherePart = 0.4;
app.scene.ambientBakeOcclusionBrightness = -0.3;
app.scene.ambientBakeOcclusionContrast = -0.4;

// the material of the meshes that take their lightmap from the mesh instance
const plain = new StandardMaterial();
plain.diffuse = new Color(0.8, 0.8, 0.8);
plain.gloss = 0.3;
plain.update();

// the same material with a lightmap assigned on it, as a glb or the Editor would. A mottled texture
// stands in for a baked one, so it is obvious which meshes read it. The lightmap samples uv1, which
// the box and plane primitives both provide.
const withLightmap = new StandardMaterial();
withLightmap.diffuse = new Color(0.8, 0.8, 0.8);
withLightmap.gloss = 0.3;
withLightmap.lightMap = assets.lightmap.resource;
withLightmap.lightMapUv = 1;
withLightmap.update();

/**
 * A box floating above its own ground plane, both rendered with the given material. When
 * lightmapped, the runtime lightmapper bakes both and the box casts a shadow onto the plane.
 *
 * @param {string} label - The label shown above the box.
 * @param {number} x - Horizontal position of the group.
 * @param {StandardMaterial} material - The material to render both meshes with.
 * @param {boolean} lightmapped - True to let the runtime lightmapper bake this group.
 */
const createGroup = (label, x, material, lightmapped) => {
    const root = new Entity(label);
    root.setLocalPosition(x, 0, 0);
    app.root.addChild(root);

    const ground = new Entity('ground');
    ground.addComponent('render', {
        type: 'plane',
        material: material,
        lightmapped: lightmapped,
        castShadows: false,
        castShadowsLightmap: false
    });
    ground.setLocalScale(3.2, 1, 3.2);
    root.addChild(ground);

    const box = new Entity('box');
    box.addComponent('render', {
        type: 'box',
        material: material,
        lightmapped: lightmapped,
        castShadows: false,
        castShadowsLightmap: lightmapped
    });
    box.setLocalPosition(0, 1.25, 0);
    box.setLocalScale(1.1, 1.1, 1.1);
    root.addChild(box);

    const text = new Entity('label');
    text.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        text: label,
        fontAsset: assets.font,
        fontSize: 0.16,
        pivot: [0.5, 0.5],
        anchor: [0.5, 0.5, 0.5, 0.5]
    });
    text.setLocalPosition(0, 2.45, 0);
    root.addChild(text);
};

// 1. the lightmapper bakes this group, and stores the result on its mesh instances
createGroup('mesh instance\n(runtime bake)', -3.6, plain, true);

// 2. the lightmap comes from the material, and the lightmapper leaves this group alone
createGroup('material\n(assigned texture)', 0, withLightmap, false);

// 3. both sources: the mesh instance value wins today
createGroup('both\n(instance wins)', 3.6, withLightmap, true);

// a baked light for the runtime bake: it affects lightmapped objects only, and its area spreads the
// shadow it bakes, so a soft gradient in the lightmap distinguishes it from a real-time shadow
const lightBaked = new Entity('baked light');
lightBaked.addComponent('light', {
    affectDynamic: false,
    affectLightmapped: true,
    bake: true,
    bakeArea: 25,
    bakeNumSamples: 24,
    castShadows: true,
    normalOffsetBias: 0.05,
    shadowBias: 0.2,
    shadowDistance: 50,
    shadowResolution: 1024,
    shadowType: SHADOW_PCF3_32F,
    color: new Color(1, 0.8, 0.55),
    intensity: 1.8,
    type: 'directional'
});
lightBaked.setEulerAngles(50, -62, 0);
app.root.addChild(lightBaked);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.05, 0.06, 0.08)
});
camera.setLocalPosition(0, 4.6, 11);
camera.lookAt(new Vec3(0, 0.7, 0));
app.root.addChild(camera);

// bake once the scene is complete, and again after a device restore drops the lightmaps
app.lightmapper.bake(null, BAKE_COLOR);
device.on('devicerestored', () => app.lightmapper.bake(null, BAKE_COLOR));

export { app };
