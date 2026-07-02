// @config
//
// Two LOD-streamed Gaussian Splat scenes joined by a stencil-masked portal that swaps as you walk
// through it.
//
// @flag NO_MINISTATS
//
// @credit
// title: Portal Frame
// author: Sketchfab
// source: https://sketchfab.com/3d-models/portal-frame-da34b37a224e4e49b307c0b17a50af2c
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Roman Parish
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/
//
// @credit
// title: Skatepark
// author: Christoph Schindelar
// source: https://superspl.at/user?id=schindelar3d

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatWeather } from 'playcanvas/scripts/esm/gsplat/gsplat-weather.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const onResize = () => app.resizeCanvas();
window.addEventListener('resize', onResize);
app.on('destroy', () => {
    window.removeEventListener('resize', onResize);
});

// outside scene (roman parish) and inside-portal scene (skatepark) configuration
const OUTSIDE_URL = 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json';
const INSIDE_URL = 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json';

const assets = {
    outside: new pc.Asset('outside', 'gsplat', { url: OUTSIDE_URL }),
    inside: new pc.Asset('inside', 'gsplat', { url: INSIDE_URL }),
    portal: new pc.Asset('portal', 'container', { url: './assets/models/portal.glb' }),
    envAtlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// use the environment atlas for image-based lighting only - this gives the
// portal arch a soft ambient tint so it isn't pure black, while the actual
// sky geometry stays hidden (the camera's clear color remains the visible
// background, which keeps the focus on the splat scenes).
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 2.6;
app.scene.layers.getLayerById(pc.LAYERID_SKYBOX).enabled = false;

// global splat settings
app.scene.gsplat.lodUpdateAngle = 90;
app.scene.gsplat.lodBehindPenalty = 3;
app.scene.gsplat.radialSorting = true;
app.scene.gsplat.lodUpdateDistance = 0.5;
app.scene.gsplat.lodUnderfillLimit = 5;
app.scene.gsplat.splatBudget = pc.platform.mobile ? 500000 : 1500000;

// ---------- layer setup ----------
// each splat scene has its own dedicated layer (outsidelayer for parish,
// insidelayer for skatepark). the data on each layer never changes - we
// never reassign gsplat entities to a different layer, so the gsplat manager
// for each layer keeps its splat data preloaded and there's no reconciliation
// cost on portal crossings.
//
// what changes on a crossing is:
//   1) the order of the two splat transparent sub-layers, so the
//      "through-scene" renders before the glass overlay and the
//      "from-scene" renders after it (see comment below).
//   2) the stencil + depthfunc settings on each layer's gsplat material, so
//      whichever scene is currently being viewed through the portal gets
//      stencil-masked + func_greater, and the other gets no stencil +
//      func_lessequal.
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');

const portalMaskLayer = new pc.Layer({ name: 'PortalMask' });
const portalArchLayer = new pc.Layer({ name: 'PortalArch' });
const outsideLayer = new pc.Layer({ name: 'PortalOutside' });
const insideLayer = new pc.Layer({ name: 'PortalInside' });
// portalglasslayer renders a translucent specular "glass" pane inside the
// portal opening. it must render between the through-scene and the
// from-scene so the glass blends over the through-scene's splats, but
// any from-scene splats that sit between the camera and the portal still
// render on top of the glass.
const portalGlassLayer = new pc.Layer({ name: 'PortalGlass' });

// ---- layer ordering with explicit opaque/transparent control ----
// pc.layercomposition.insert() inserts both the opaque and transparent
// sub-layers of a layer in a single call, which makes precise transparent
// ordering awkward (transparent entries end up in reverse insertion order).
//
// we avoid that here by using the sub-layer api directly: each layer is
// only ever a pure-opaque or pure-transparent renderer, so we just place
// the relevant sub-layer where we want it in the composition.
//
//   - masklayer / archlayer:        only opaque   (mask plane + arch geom)
//   - insidelayer / outsidelayer:   only transparent (gsplats)
//   - portalglasslayer:             only transparent (glass overlay)
//
// initial sub-layer order (swapped=false: parish=from, skatepark=through):
//   [0] masklayer opaque        - stencil + depth at portal plane
//   [1] archlayer opaque        - arch geom, clears stencil on arch silhouette
//   [2] insidelayer transparent - through-scene splats (func_greater)
//   [3] portalglasslayer transp - glass overlay, blends over through-scene
//   [4] outsidelayer transparent- from-scene splats (func_lessequal); any
//                                 from-scene splat closer than the portal
//                                 renders over the glass, like glass behind
//                                 leaves.
app.scene.layers.insertOpaque(portalMaskLayer, 0);
app.scene.layers.insertOpaque(portalArchLayer, 1);
app.scene.layers.insertTransparent(insideLayer, 2);
app.scene.layers.insertTransparent(portalGlassLayer, 3);
app.scene.layers.insertTransparent(outsideLayer, 4);

/**
 * Reorder the two splat transparent sub-layers on swap. Mask, arch and
 * glass stay where they are; only the through/from splat layers swap
 * positions around the glass.
 *
 * @param {boolean} nowSwapped - True when the user has just entered the Skatepark world.
 */
const reorderLayersForSwap = (nowSwapped) => {
    const newFromLayer = nowSwapped ? insideLayer : outsideLayer;
    const newThroughLayer = nowSwapped ? outsideLayer : insideLayer;
    app.scene.layers.removeTransparent(insideLayer);
    app.scene.layers.removeTransparent(outsideLayer);
    app.scene.layers.removeTransparent(portalGlassLayer);
    app.scene.layers.insertTransparent(newThroughLayer, 2);
    app.scene.layers.insertTransparent(portalGlassLayer, 3);
    app.scene.layers.insertTransparent(newFromLayer, 4);
};

// ---------- camera with fly controls ----------
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.05, 0.05, 0.07),
    layers: [
        outsideLayer.id,
        portalMaskLayer.id,
        portalArchLayer.id,
        insideLayer.id,
        portalGlassLayer.id,
        worldLayer.id,
        skyboxLayer.id,
        uiLayer.id
    ],
    fov: 75,
    toneMapping: pc.TONEMAP_LINEAR
});
camera.setLocalPosition(10.3, 2, -10);
// push the near clip way in. the portal mask plane is a flat quad that needs
// to be fully visible (no near-plane clipping) right up to the moment the
// camera crosses it - otherwise the plane is partially clipped on the
// crossing frame, the stencil isn't written in part of the portal area,
// and you see a one-frame flicker of from-scene leaking into the portal.
camera.camera.nearClip = 0.001;
app.root.addChild(camera);

const focusPoint = new pc.Vec3(12, 2, 0);
camera.addComponent('script');
const cc = /** @type {CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));
Object.assign(cc, {
    sceneSize: 500,
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: focusPoint
});

// ---------- portal mesh + stencil mask plane ----------
// the portal group holds both the visible decorative arch (rendered to the world
// layer) and an invisible plane (rendered to the portal mask layer) that writes 1
// into the stencil buffer over the portal opening.
//
// portal_world_pos / portal_world_yaw is the single source of truth for where the
// portal sits in the app world. both splat scenes are then positioned so that
// their declared local portal anchors line up with this transform - meaning the
// camera can walk continuously between worlds, no teleport required.
const PORTAL_WORLD_POS = new pc.Vec3(12, 1.5, 0);
const PORTAL_WORLD_YAW = 180;

const portalGroup = new pc.Entity('Portal');
portalGroup.setLocalPosition(PORTAL_WORLD_POS);
portalGroup.setLocalEulerAngles(0, PORTAL_WORLD_YAW, 0);
app.root.addChild(portalGroup);

// ---------- splat scenes ----------
// each scene declares where the portal sits inside its own upright space:
//  - intrinsiceuler: rotation required to bring the raw splat data upright
//  - portallocalpos / portallocalyaw: portal anchor expressed in that upright space
//
// the scene's entity transform is then derived as:
//     entity.transform = tworld * tlocal^(-1) * tintrinsic
// which guarantees that the scene's declared portal point coincides exactly with
// the world portal. tune these per-scene values to choose where each world's
// "doorway" lives.
// each scene also declares a "viewthroughoffset" - a world-space translation
// applied to the scene's entity only while it's being viewed *through* the portal
// (i.e. it's not the world the camera currently lives in).
//
// parallax trade-off (tune via the "parish through z" slider):
//   offset.z =  0  →  parish content sits at the same depth as the portal.
//                     it "stays in the portal frame" as you move - matches the
//                     gentle parallax you get on the parish side looking at the
//                     skatepark. cost: your camera is inside the parish data, so
//                     the visible part of the parish is whatever is right around
//                     the portal in 3d space.
//   offset.z << 0  →  parish content gets pushed far behind the portal.
//                     visually distant, but it shifts in the same direction as
//                     your strafe (depth-ambiguity parallax, like a far landscape
//                     seen through a window).
//   offset.z >  0  →  parish content sits between you and the portal (visible
//                     only inside the portal frame). parallaxes in the opposite
//                     direction to your motion, like a close object.
// the skatepark already sits at the portal so its through-portal view doesn't
// need an offset.
// each scene is permanently bound to its own layer (parish -> outsidelayer,
// skatepark -> insidelayer). the reorder + material-flip logic in the swap
// handler is what makes a layer act as "from" or "through" at any time.
const sceneConfigs = [
    {
        name: 'Parish',
        asset: assets.outside,
        layer: outsideLayer,
        lodBaseDistance: 7,
        lodMultiplier: 3,
        intrinsicEuler: new pc.Vec3(-90, 0, 0),
        portalLocalPos: new pc.Vec3(2, 2.4, 5),
        portalLocalYaw: 130,
        viewThroughOffset: new pc.Vec3(0, 0, 0)
    },
    {
        name: 'Skatepark',
        asset: assets.inside,
        layer: insideLayer,
        lodBaseDistance: 15,
        lodMultiplier: 4,
        intrinsicEuler: new pc.Vec3(-90, 0, 0),
        portalLocalPos: new pc.Vec3(14, 1, 13.5),
        portalLocalYaw: 50,
        viewThroughOffset: new pc.Vec3(0, 0, 0)
    }
];

// helper: build a trs mat4 from position + y-only yaw (degrees).
const trsYaw = (/** @type {pc.Vec3} */ pos, /** @type {number} */ yaw) => {
    return new pc.Mat4().setTRS(pos, new pc.Quat().setFromEulerAngles(0, yaw, 0), pc.Vec3.ONE);
};

const portalWorldMat = trsYaw(PORTAL_WORLD_POS, PORTAL_WORLD_YAW);
const tmpPos = new pc.Vec3();
const tmpEuler = new pc.Vec3();

// helper: apply a mat4 to an entity by extracting position + euler.
const applyMatToEntity = (/** @type {pc.Entity} */ entity, /** @type {pc.Mat4} */ mat) => {
    mat.getTranslation(tmpPos);
    mat.getEulerAngles(tmpEuler);
    entity.setLocalPosition(tmpPos);
    entity.setLocalEulerAngles(tmpEuler);
};

// build the natural ("portal-aligned") world transform for a scene.
const buildOriginalTransform = (/** @type {typeof sceneConfigs[number]} */ config) => {
    const portalLocalMat = trsYaw(config.portalLocalPos, config.portalLocalYaw);
    const intrinsicMat = new pc.Mat4().setTRS(
        pc.Vec3.ZERO,
        new pc.Quat().setFromEulerAngles(config.intrinsicEuler.x, config.intrinsicEuler.y, config.intrinsicEuler.z),
        pc.Vec3.ONE
    );
    // entity = tworld * tlocal^(-1) * tintrinsic
    return new pc.Mat4().mul2(portalWorldMat, portalLocalMat.invert()).mul(intrinsicMat);
};

/**
 * @typedef {object} SceneState
 * @property {pc.Entity} entity - The splat entity for this scene.
 * @property {pc.Mat4} fromTransform - world transform used while the user is *in* this scene (content wraps around the camera).
 * @property {pc.Mat4} throughTransform - world transform used while this scene is viewed *through* the portal.
 */
/** @type {Map<pc.Layer, SceneState>} */
const sceneStates = new Map();

sceneConfigs.forEach((config) => {
    const entity = new pc.Entity(`${config.name}Splat`);
    entity.addComponent('gsplat', {
        asset: config.asset,
        layers: [config.layer.id],
        lodBaseDistance: config.lodBaseDistance,
        lodMultiplier: config.lodMultiplier,
        // start with the lowest lod until the first frame settles, then unlock the full range
        lodRangeMin: 4,
        lodRangeMax: 5
    });

    // "from" pose - the portal-aligned natural transform (used while you live in this scene)
    const fromTransform = buildOriginalTransform(config);

    // "through" pose - same as the from pose, but translated by viewthroughoffset.
    const throughOffsetMat = new pc.Mat4().setTRS(config.viewThroughOffset, new pc.Quat(), pc.Vec3.ONE);
    const throughTransform = new pc.Mat4().mul2(throughOffsetMat, fromTransform);

    // start each scene at whichever pose matches the initial swap state
    // (initially swapped=false: parish=from, skatepark=through).
    const startMat = config.layer === insideLayer ? throughTransform : fromTransform;
    applyMatToEntity(entity, startMat);
    app.root.addChild(entity);

    sceneStates.set(config.layer, { entity, fromTransform, throughTransform });
});

// ---------- snow particles bound to the skatepark layer ----------
// procedural gaussian-splat snow that follows the camera. it's rendered on
// insidelayer (the skatepark layer), so it inherits whatever stencil/depth
// rules are active for that layer:
//  - while the user is in the skatepark (insidelayer = from-scene): snow
//    renders normally everywhere around the camera (lessequal, no stencil).
//  - while the user is in the parish, looking through the portal at the
//    skatepark (insidelayer = through-scene): snow is stencil-masked and
//    depth-clipped to the far side of the portal plane, so the camera-
//    relative snow volume isn't visible from outside the skatepark world.
// no enable/disable logic needed - the per-layer material state flip in
// applymaterialstateforlayer is reused for the snow.
// half-extent (world units) of the camera-relative particle volume. the
// grid is square in all three axes, so this single value controls the
// overall size of the snow volume.
const SNOW_EXTENT = 20;
const weatherEntity = new pc.Entity('Weather');
weatherEntity.addComponent('script');
const weather = /** @type {GsplatWeather} */ (
    weatherEntity.script.create(GsplatWeather, {
        properties: {
            followEntity: camera,
            speed: 2.0,
            drift: 0.4,
            opacity: 0.8,
            color: [1, 1, 1],
            elongate: 1,
            particleMinSize: 0.006,
            particleMaxSize: 0.012
        }
    })
);
weather.extents.set(SNOW_EXTENT, SNOW_EXTENT, SNOW_EXTENT);
app.root.addChild(weatherEntity);
// the script creates the gsplat component during initialize() (fired when
// the entity is attached to the hierarchy). now retarget it to the
// skatepark layer so the snow shares its rendering state.
weatherEntity.gsplat.layers = [insideLayer.id];

// stencil parameters used by the portal pieces (defined together for clarity).
//  - maskstencil:        always increments stencil (used by the invisible mask plane).
//  - archstencil:        always clears stencil to 0 (used by the visible arch frame).
//  - portalonlystencil:  passes when stencil != 0 (used by the through-scene and
//                        the visible glass overlay, so they only render inside
//                        the portal opening - not where the arch cleared it).
const maskStencil = new pc.StencilParameters({
    zpass: pc.STENCILOP_INCREMENT
});
const archStencil = new pc.StencilParameters({
    func: pc.FUNC_ALWAYS,
    ref: 0,
    zpass: pc.STENCILOP_ZERO
});
const portalOnlyStencil = new pc.StencilParameters({
    func: pc.FUNC_NOTEQUAL,
    ref: 0
});

// ---------- invisible stencil mask plane ----------
// increments stencil from 0 to 1 inside the portal opening, and writes depth
// at the portal plane's depth. the depth write is what gives us an "oblique
// near clip plane at the portal": the through-scene splats use depthfunc =
// func_greater, so they only render where their depth is *past* the mask
// plane's depth. that means parish content sitting between the camera and the
// portal (or anywhere else not on the far side) gets discarded - you only see
// what's beyond the portal, exactly like a real window. no color is written
// so the plane stays invisible; culling is off so the mask still works from
// both sides of the portal.
const maskMaterial = new pc.StandardMaterial();
maskMaterial.depthWrite = true;
maskMaterial.redWrite = false;
maskMaterial.greenWrite = false;
maskMaterial.blueWrite = false;
maskMaterial.alphaWrite = false;
maskMaterial.cull = pc.CULLFACE_NONE;
maskMaterial.stencilFront = maskMaterial.stencilBack = maskStencil;
maskMaterial.update();

const maskPlane = new pc.Entity('PortalMaskPlane');
maskPlane.addComponent('render', {
    type: 'plane',
    material: maskMaterial,
    layers: [portalMaskLayer.id]
});
// match the inner opening of the portal model and orient it as a vertical doorway
maskPlane.setLocalPosition(0, 0.55, 0);
maskPlane.setLocalEulerAngles(90, 0, 0);
maskPlane.setLocalScale(3.5, 1, 6.7);
portalGroup.addChild(maskPlane);

// decorative portal arch - rendered to portalarchlayer, which sits before the
// splat layers in the layer composition. the arch's opaque materials write to
// the depth buffer, so any splats further from the camera than the arch are
// depth-tested out and properly occluded by it.
//
// additionally, the arch's materials are configured to *clear* the stencil
// (archstencil, defined above) wherever the arch geometry is drawn. the mask
// plane wrote stencil = 1 across a rectangular region matching the doorway;
// without this clear, the through-scene splats would spill into the
// rectangular area outside the arch's actual silhouette and the rectangle
// would look "visible". clearing the stencil at the arch geometry confines
// the through-scene render (and the glass overlay) to the arch's true opening.
const portalEntity = assets.portal.resource.instantiateRenderEntity();
portalEntity.setLocalPosition(0, -3, 0);
portalEntity.setLocalScale(0.02, 0.02, 0.02);
portalGroup.addChild(portalEntity);
const archMaterials = new Set();
portalEntity.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
    render.layers = [portalArchLayer.id];
    for (const meshInstance of render.meshInstances) {
        archMaterials.add(meshInstance.material);
    }
});
archMaterials.forEach((/** @type {pc.Material} */ mat) => {
    mat.stencilFront = archStencil;
    mat.stencilBack = archStencil;
    mat.update();
});

// ---------- visible glass overlay plane ----------
// a second plane, geometrically identical to the invisible mask plane, but
// rendered on portalglasslayer (the last custom layer). it uses a translucent
// specular material that picks up specular highlights from the env atlas,
// giving the portal opening a real glassy quality.
//
// render-order argument: it sits after the through-scene, so the glass color
// and specular blend over the through-scene splats. it sits before the
// default "world" layer and renders only inside the portal opening (stencil =
// portalonlystencil), so it doesn't paint over the from-scene or the arch.
//
// following the "spec fade off" sphere recipe from
// material-translucent-specular.example.mjs:
//  - blend_normal alpha blending
//  - opacityfadesspecular = false so the specular stays bright at low opacity
//  - low diffuse opacity, white specular, high gloss
//  - depthwrite = false (the mask plane already wrote depth at this position)
//  - alphawrite = false (matches the example; avoids alpha-only writes mucking
//    up later passes)
const glassMaterial = new pc.StandardMaterial();
// temporary red tint + higher opacity so the glass plane is obviously visible
// for debugging - dial these back once you can see it.
glassMaterial.diffuse = new pc.Color(0, 1, 1);
glassMaterial.specular = new pc.Color(0.4, 0.4, 0.4);
glassMaterial.useMetalness = true;
glassMaterial.metalness = 0.5;
glassMaterial.gloss = 1;
glassMaterial.blendType = pc.BLEND_NORMAL;
glassMaterial.opacity = 0.3;
glassMaterial.opacityFadesSpecular = false;
glassMaterial.alphaWrite = false;
glassMaterial.depthWrite = false;
glassMaterial.cull = pc.CULLFACE_NONE;
glassMaterial.stencilFront = portalOnlyStencil;
glassMaterial.stencilBack = portalOnlyStencil;
glassMaterial.update();

const glassPlane = new pc.Entity('PortalGlassPlane');
glassPlane.addComponent('render', {
    type: 'plane',
    material: glassMaterial,
    layers: [portalGlassLayer.id]
});
glassPlane.setLocalPosition(maskPlane.getLocalPosition());
glassPlane.setLocalEulerAngles(maskPlane.getLocalEulerAngles());
glassPlane.setLocalScale(maskPlane.getLocalScale());
portalGroup.addChild(glassPlane);

// ---------- stencil + depth setup for the two splat scenes ----------
// the gsplat material is created lazily per (camera, layer) pair.
// the from-scene (the world the camera is in) gets:
//  - no stencil restriction
//  - depthfunc = lessequal
// so its splats render everywhere and naturally occlude the portal area when
// there are from-scene splats between the camera and the portal plane.
//
// the through-scene (the world visible through the portal) gets:
//  - portalonlystencil (func_notequal ref=0) - renders only inside the portal opening
//  - depthfunc = func_greater                 - renders only past the portal plane
// giving us an oblique near-clip anchored at the portal.
//
// on every portal crossing both materials are reconfigured to swap their
// from/through roles. the splat data on each layer stays put (no reload),
// so the swap is just a state flip - much cheaper than moving placements
// between layers.

/** @type {pc.GSplatComponentSystem} */
const gsplatSystem = /** @type {any} */ (app.systems.gsplat);

// gsplatcomponentsystem.getmaterial is keyed by the low-level camera instance,
// not by the entity or the cameracomponent. unwrap: entity → cameracomponent → camera.
const cameraInstance = /** @type {any} */ (camera.camera).camera;

// tracks which world the user is currently *in*.
// false = parish is from-scene (around user) and skatepark is through-scene.
// true  = swapped: skatepark is from-scene and parish is through-scene.
let swapped = false;

const isLayerThrough = (/** @type {pc.Layer} */ layer) => {
    return layer === outsideLayer ? swapped : !swapped;
};

const applyMaterialStateForLayer = (/** @type {pc.ShaderMaterial} */ material, /** @type {pc.Layer} */ layer) => {
    const through = isLayerThrough(layer);
    material.stencilFront = material.stencilBack = through ? portalOnlyStencil : null;
    material.depthFunc = through ? pc.FUNC_GREATER : pc.FUNC_LESSEQUAL;
    material.update();
};

// called when the swap state changes. we look up each layer's existing
// gsplat material via the system and reconfigure it in place.
// (note: getmaterial returns null *during* the material:created event because
// the director only stores the manager after the event fires - so on the
// initial setup we use the material argument passed to the event handler
// below instead.)
const applyMaterialStateToBothLayers = () => {
    const outMat = gsplatSystem.getMaterial(cameraInstance, outsideLayer);
    const inMat = gsplatSystem.getMaterial(cameraInstance, insideLayer);
    if (outMat) applyMaterialStateForLayer(outMat, outsideLayer);
    if (inMat) applyMaterialStateForLayer(inMat, insideLayer);
};

gsplatSystem.on('material:created', (material, cam, layer) => {
    if (layer === outsideLayer || layer === insideLayer) {
        applyMaterialStateForLayer(material, layer);
    }
});

// ---------- walk-through detection ----------
// we swap worlds only when the camera's movement from the previous frame to
// the current one passes through the rectangular mask plane (not just crosses
// its infinite extension). the check works in the mask plane's mesh-local
// space: the plane primitive lives in the xz plane (y=0) with corners at
// (±0.5, 0, ±0.5), so we transform the previous and current camera positions
// into that space, look for a y sign change (= plane crossing), then verify
// the intersection point lies within x,z ∈ [-0.5, 0.5] (= passes through the
// quad). walking *around* the plane gives a y sign change but with the
// intersection outside the quad bounds, so the swap is suppressed.
const prevCamWorldPos = new pc.Vec3().copy(camera.getPosition());
const localPrev = new pc.Vec3();
const localCurr = new pc.Vec3();
const planeWorldInv = new pc.Mat4();
const updatePortalSide = () => {
    const currCamWorldPos = camera.getPosition();

    // convert prev and current camera positions to mask plane local space.
    planeWorldInv.copy(maskPlane.getWorldTransform()).invert();
    planeWorldInv.transformPoint(prevCamWorldPos, localPrev);
    planeWorldInv.transformPoint(currCamWorldPos, localCurr);

    // expose current world to the stats panel
    data.set('data.stats.world', swapped ? 'Skatepark' : 'Parish');

    // did the camera cross the plane between frames?
    const crossed = localPrev.y > 0 !== localCurr.y > 0;
    if (crossed) {
        // solve for the parameter t along the segment where it hits y=0.
        const t = localPrev.y / (localPrev.y - localCurr.y);
        const ix = localPrev.x + t * (localCurr.x - localPrev.x);
        const iz = localPrev.z + t * (localCurr.z - localPrev.z);
        const insideQuad = Math.abs(ix) <= 0.5 && Math.abs(iz) <= 0.5;

        if (insideQuad) {
            swapped = !swapped;

            // reorder layers so the new from-scene renders first (no portal
            // depth clipping) and the new through-scene renders last (with
            // stencil + greater depth). material state flips to match.
            reorderLayersForSwap(swapped);
            applyMaterialStateToBothLayers();

            // snap each scene to whichever pose matches the new swap state.
            const fromLayer = swapped ? insideLayer : outsideLayer;
            const throughLayer = swapped ? outsideLayer : insideLayer;
            const fromState = sceneStates.get(fromLayer);
            const throughState = sceneStates.get(throughLayer);
            if (fromState) applyMatToEntity(fromState.entity, fromState.fromTransform);
            if (throughState) applyMatToEntity(throughState.entity, throughState.throughTransform);
        }
    }

    prevCamWorldPos.copy(currCamWorldPos);
};

// unlock the full lod range once the first frame is ready
const onFrameReady = (
    /** @type {any} */ cam,
    /** @type {any} */ layer,
    /** @type {boolean} */ ready,
    /** @type {number} */ loadingCount
) => {
    if (ready && loadingCount === 0) {
        gsplatSystem.off('frame:ready', onFrameReady);
        for (const { entity } of sceneStates.values()) {
            const gs = /** @type {any} */ (entity.gsplat);
            gs.lodRangeMin = 0;
            gs.lodRangeMax = 5;
        }
    }
};
gsplatSystem.on('frame:ready', onFrameReady);

app.on('update', () => {
    updatePortalSide();
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
});
