// @config
//
// The easing functions of tween.js, animated by the tween script. Each card plots its easing curve,
// a dot traces the curve over time, and a puck slides to the eased value. Move the pointer to tilt
// the view.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CULLFACE_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Geometry,
    JsonHandler,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RoundedBoxGeometry,
    SHADOW_VSM_16F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    Vec3,
    Vec4,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @typedef {{ Easing: Record<string, Record<string, (amount: number) => number>> }} TweenLibrary
 */

// tween.js, which the tween script uses, registers itself as the TWEEN global. Its easing functions
// also plot the curves.
await import('https://cdnjs.cloudflare.com/ajax/libs/tween.js/20.0.0/tween.umd.js');
const { TWEEN } = /** @type {{ TWEEN: TweenLibrary }} */ (/** @type {unknown} */ (window));

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, JsonHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

const assets = {
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    boldFont: new Asset('bold-font', 'font', { url: './assets/fonts/roboto-bold.json' }),
    lightFont: new Asset('light-font', 'font', { url: './assets/fonts/roboto-extralight.json' }),
    script: new Asset('script', 'script', { url: './scripts/animation/tween.js' })
};
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// ----- The studio -----

const BACKGROUND = '#1b202b';

// The environment lights the scene and gives the glossy pucks their reflections. The camera does
// not render the skybox layer, so it is not visible.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.35;

/**
 * Creates a lit material.
 *
 * @param {Color} color - The color.
 * @param {number} gloss - The glossiness, 0-1 range.
 * @returns {StandardMaterial} The material.
 */
const createMaterial = (color, gloss) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0;
    material.gloss = gloss;
    material.update();
    return material;
};

/**
 * Creates an unlit material, which glows when its intensity is above 1.
 *
 * @param {Color} color - The color.
 * @param {number} intensity - The intensity of the color.
 * @returns {StandardMaterial} The material.
 */
const createGlowMaterial = (color, intensity) => {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = intensity;
    material.cull = CULLFACE_NONE;
    material.update();
    return material;
};

/**
 * Creates an entity rendering a mesh.
 *
 * @param {string} name - The name of the entity.
 * @param {Mesh} mesh - The mesh.
 * @param {StandardMaterial} material - The material.
 * @param {Entity} parent - The parent entity.
 * @param {boolean} castShadows - Whether the mesh casts shadows.
 * @returns {Entity} The entity.
 */
const createMeshEntity = (name, mesh, material, parent, castShadows) => {
    const entity = new Entity(name);
    entity.addComponent('render', { type: 'asset', castShadows });
    entity.render.meshInstances = [new MeshInstance(mesh, material, entity)];
    parent.addChild(entity);
    return entity;
};

/**
 * Creates a flat ribbon along a line, facing +Z. The joints are mitered, so the ribbon keeps its
 * width around the bends of the curves.
 *
 * @param {number[][]} points - The points of the line, as [x, y] pairs.
 * @param {number} width - The width of the ribbon.
 * @returns {Mesh} The mesh.
 */
const createRibbonMesh = (points, width) => {
    const positions = [];
    const normals = [];
    const indices = [];
    const last = points.length - 1;

    points.forEach(([x, y], i) => {
        // the directions of the segments before and after the point
        const [x0, y0] = points[Math.max(i - 1, 0)];
        const [x1, y1] = points[Math.min(i + 1, last)];
        const inLength = Math.hypot(x - x0, y - y0) || 1;
        const outLength = Math.hypot(x1 - x, y1 - y) || 1;
        const inX = i > 0 ? (x - x0) / inLength : (x1 - x) / outLength;
        const inY = i > 0 ? (y - y0) / inLength : (y1 - y) / outLength;
        const outX = i < last ? (x1 - x) / outLength : inX;
        const outY = i < last ? (y1 - y) / outLength : inY;

        // the miter is perpendicular to the average direction, and longer the sharper the bend
        const tangentLength = Math.hypot(inX + outX, inY + outY);
        const nx = -(inY + outY) / tangentLength;
        const ny = (inX + outX) / tangentLength;
        const miter = Math.min(width / 2 / Math.max(nx * -inY + ny * inX, 0.1), width * 2);

        positions.push(x - nx * miter, y - ny * miter, 0, x + nx * miter, y + ny * miter, 0);
        normals.push(0, 0, 1, 0, 0, 1);
        if (i < last) {
            const v = i * 2;
            indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        }
    });

    const geometry = new Geometry();
    geometry.positions = positions;
    geometry.normals = normals;
    geometry.indices = indices;
    return Mesh.fromGeometry(device, geometry);
};

// The wall behind the cards, which catches their shadows
const wallMaterial = createMaterial(new Color().fromString(BACKGROUND), 0.2);
const wall = new Entity('Wall');
wall.addComponent('render', { type: 'plane', material: wallMaterial, castShadows: false });
wall.setLocalEulerAngles(90, 0, 0);
wall.setLocalScale(200, 1, 200);
app.root.addChild(wall);

// ----- The cards -----

const EASING_FUNCTIONS = [
    'Linear',
    'Quadratic',
    'Cubic',
    'Quartic',
    'Quintic',
    'Sinusoidal',
    'Exponential',
    'Circular',
    'Elastic',
    'Back',
    'Bounce'
];

// The tween script attributes: the easing type of all but the linear function, which has none, and
// the timing. The tweens play forwards and backwards forever, holding at each end.
const EASING_TYPE_IN_OUT = 2;
const DURATION = 2000;
const HOLD = 500;

// The size of a card and the gap between the cards
const CARD_WIDTH = 3;
const CARD_HEIGHT = 2.2;
const CARD_DEPTH = 0.12;
const GAP = 0.3;

// The cards float in front of the wall, so their shadows show their distance from it
const CARD_Z = 0.5;
const FACE_Z = CARD_Z + CARD_DEPTH / 2;

// The plot of the curve on a card: the eased value goes from 0 at the bottom to 1 at the top over
// the duration of the tween, from left to right. Some functions overshoot both ends.
const PLOT_LEFT = -1.25;
const PLOT_RIGHT = 0.7;
const PLOT_BOTTOM = -0.6;
const PLOT_TOP = 0.4;
const TRACK_X = 1.1;

// A gradient across the cards, from teal to amber
const PALETTE = ['#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fbbf24'].map((hex) =>
    new Color().fromString(hex)
);

/**
 * Returns a color of the palette gradient.
 *
 * @param {number} t - The position in the gradient, 0-1 range.
 * @returns {Color} The color.
 */
const paletteColor = (t) => {
    const position = t * (PALETTE.length - 1);
    const i = Math.min(Math.floor(position), PALETTE.length - 2);
    return new Color().lerp(PALETTE[i], PALETTE[i + 1], position - i);
};

/**
 * Adds the tween script to an entity, with a tween of its local position.
 *
 * @param {Entity} entity - The entity.
 * @param {number} easingFunction - The index of the easing function.
 * @param {Vec4} start - The start position.
 * @param {Vec4} end - The end position.
 */
const addTween = (entity, easingFunction, start, end) => {
    entity.addComponent('script');
    entity.script.create('tween', {
        attributes: {
            tweens: [
                {
                    autoPlay: true,
                    path: 'localPosition',
                    start,
                    end,
                    easingFunction,
                    easingType: EASING_TYPE_IN_OUT,
                    delay: 0,
                    duration: DURATION,
                    repeat: -1,
                    repeatDelay: HOLD,
                    yoyo: true
                }
            ]
        }
    });
};

/**
 * Creates a text label on a card.
 *
 * @param {Entity} card - The card.
 * @param {Asset} font - The font asset.
 * @param {string} text - The text.
 * @param {number} x - The x position on the card.
 * @param {number} pivotX - The horizontal pivot of the text, 0 to align it left, 1 to align it right.
 * @param {Color} color - The color of the text.
 */
const createLabel = (card, font, text, x, pivotX, color) => {
    const label = new Entity('Label');
    label.addComponent('element', {
        type: ELEMENTTYPE_TEXT,
        fontAsset: font,
        fontSize: 0.2,
        pivot: [pivotX, 0.5],
        text,
        color,
        layers: [LAYERID_WORLD]
    });
    label.setLocalPosition(x, 0.8, CARD_DEPTH / 2 + 0.002);
    card.addChild(label);
};

const cardMaterial = createMaterial(new Color().fromString('#2a3142'), 0.45);
const trackMaterial = createMaterial(new Color().fromString('#161a23'), 0.3);
const guideMaterial = createGlowMaterial(new Color().fromString('#6a7894'), 1);
const nameColor = new Color().fromString('#e6ebf3');
const typeColor = new Color().fromString('#8792a8');

const cardMesh = Mesh.fromGeometry(
    device,
    new RoundedBoxGeometry({
        halfExtents: new Vec3(CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_DEPTH / 2),
        radius: 0.12,
        radiusSegments: 6
    })
);
const trackMesh = Mesh.fromGeometry(
    device,
    new RoundedBoxGeometry({
        halfExtents: new Vec3(0.045, (PLOT_TOP - PLOT_BOTTOM) / 2 + 0.045, 0.012),
        radius: 0.012,
        radiusSegments: 4
    })
);
const puckMesh = Mesh.fromGeometry(
    device,
    new RoundedBoxGeometry({
        halfExtents: new Vec3(0.15, 0.15, 0.07),
        radius: 0.065,
        radiusSegments: 8
    })
);
const guideMesh = createRibbonMesh(
    [
        [PLOT_LEFT, 0],
        [PLOT_RIGHT, 0]
    ],
    0.018
);
const playheadMesh = createRibbonMesh(
    [
        [0, PLOT_BOTTOM - 0.16],
        [0, PLOT_TOP + 0.16]
    ],
    0.016
);

const SAMPLES = 160;
const cards = EASING_FUNCTIONS.map((name, i) => {
    const color = paletteColor(i / (EASING_FUNCTIONS.length - 1));

    const card = createMeshEntity(name, cardMesh, cardMaterial, app.root, true);

    // the name of the easing function, and its type, as in TWEEN.Easing.Cubic.InOut
    const type = i === 0 ? 'None' : 'InOut';
    createLabel(card, assets.boldFont, name, PLOT_LEFT, 0, nameColor);
    createLabel(card, assets.lightFont, type, CARD_WIDTH / 2 - 0.25, 1, typeColor);

    // faint guides at the start and end values
    [PLOT_BOTTOM, PLOT_TOP].forEach((y) => {
        const guide = createMeshEntity('Guide', guideMesh, guideMaterial, card, false);
        guide.setLocalPosition(0, y, CARD_DEPTH / 2 + 0.001);
    });

    // the glowing curve of the easing function
    const easing = TWEEN.Easing[name][type];
    const points = [];
    for (let s = 0; s <= SAMPLES; s++) {
        const t = s / SAMPLES;
        // not math.lerp, which clamps the value, cutting off the overshoot
        points.push([math.lerp(PLOT_LEFT, PLOT_RIGHT, t), PLOT_BOTTOM + (PLOT_TOP - PLOT_BOTTOM) * easing(t)]);
    }
    const curve = createMeshEntity(
        'Curve',
        createRibbonMesh(points, 0.035),
        createGlowMaterial(color, 2.5),
        card,
        false
    );
    curve.setLocalPosition(0, 0, CARD_DEPTH / 2 + 0.003);

    // The playhead moves linearly over the plot, and the dot it carries moves up to the eased value,
    // so together they trace the curve. Their tweens have the same timing, so they stay in sync.
    const playhead = createMeshEntity('Playhead', playheadMesh, guideMaterial, card, false);
    addTween(
        playhead,
        0,
        new Vec4(PLOT_LEFT, 0, CARD_DEPTH / 2 + 0.002, 0),
        new Vec4(PLOT_RIGHT, 0, CARD_DEPTH / 2 + 0.002, 0)
    );

    const dotColor = new Color().lerp(color, Color.WHITE, 0.5);
    const dot = new Entity('Dot');
    dot.addComponent('render', { type: 'sphere', material: createGlowMaterial(dotColor, 6), castShadows: false });
    dot.setLocalScale(0.13, 0.13, 0.13);
    playhead.addChild(dot);
    addTween(dot, i, new Vec4(0, PLOT_BOTTOM, 0.03, 0), new Vec4(0, PLOT_TOP, 0.03, 0));

    // the puck slides along its track to the eased value, raised above the card to cast a shadow on it
    const track = createMeshEntity('Track', trackMesh, trackMaterial, card, false);
    track.setLocalPosition(TRACK_X, (PLOT_BOTTOM + PLOT_TOP) / 2, CARD_DEPTH / 2);

    const puckMaterial = createMaterial(color, 0.8);
    puckMaterial.clearCoat = 0.5;
    puckMaterial.clearCoatGloss = 0.9;
    puckMaterial.update();

    const puck = createMeshEntity('Puck', puckMesh, puckMaterial, card, true);
    puck.render.receiveShadows = false;
    const puckZ = CARD_DEPTH / 2 + 0.16;
    addTween(puck, i, new Vec4(TRACK_X, PLOT_BOTTOM, puckZ, 0), new Vec4(TRACK_X, PLOT_TOP, puckZ, 0));

    return card;
});

// ----- Light and camera -----

// The key light from the upper left casts soft shadows of the cards on the wall, and of the pucks on
// the cards. Its shadow map is fitted to the cards.
const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.97, 0.92),
    intensity: 1,
    castShadows: true,
    shadowType: SHADOW_VSM_16F,
    shadowResolution: 2048,
    vsmBlurSize: 15
});
app.root.addChild(light);

// the light shines along its -Y axis, turned to the -Z axis, which looks down and to the right
light.lookAt(0.45, -0.6, -1);
light.rotateLocal(90, 0, 0);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 30,
    nearClip: 0.5,
    farClip: 100,
    layers: [LAYERID_WORLD, LAYERID_UI]
});
app.root.addChild(camera);

// The neutral tone mapping keeps the colors of the palette, the bloom makes the curves and the dots
// glow, and a vignette darkens the corners of the wall
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 5;
cameraFrame.vignette.intensity = 0.45;
cameraFrame.vignette.inner = 0.4;
cameraFrame.vignette.outer = 1.3;
cameraFrame.update();

// ----- Layout -----

// The cards are arranged in as many columns as fit the screen best, the last row centered. The
// camera distance fits all of them on the screen.
const MARGIN = 0.6;
let cameraDistance = 20;

const layout = () => {
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const tanHalfFov = Math.tan(camera.camera.fov * 0.5 * math.DEG_TO_RAD);

    let columns = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    cameraDistance = Infinity;
    for (let c = 2; c <= 6; c++) {
        const r = Math.ceil(cards.length / c);
        const w = c * CARD_WIDTH + (c - 1) * GAP;
        const h = r * CARD_HEIGHT + (r - 1) * GAP;
        const distance = Math.max((h / 2 + MARGIN) / tanHalfFov, (w / 2 + MARGIN) / (tanHalfFov * aspect));
        if (distance < cameraDistance) {
            cameraDistance = distance;
            columns = c;
            rows = r;
            width = w;
            height = h;
        }
    }

    cards.forEach((card, i) => {
        const row = Math.floor(i / columns);
        const inRow = Math.min(columns, cards.length - row * columns);
        const column = i % columns;
        card.setLocalPosition(
            (column - (inRow - 1) / 2) * (CARD_WIDTH + GAP),
            ((rows - 1) / 2 - row) * (CARD_HEIGHT + GAP),
            CARD_Z
        );
    });

    light.light.shadowBounds = new BoundingBox(new Vec3(0, 0, FACE_Z), new Vec3(width / 2, height / 2, 0.4));
};
layout();
window.addEventListener('resize', layout);
app.on('destroy', () => window.removeEventListener('resize', layout));

// ----- Pointer parallax -----

// The camera turns around the center of the cards towards the pointer, smoothed over time
let targetYaw = 0;
let targetPitch = 0;
let yaw = 0;
let pitch = 0;

/**
 * @param {PointerEvent} event - The pointer event.
 */
const onPointerMove = (event) => {
    targetYaw = ((event.clientX / window.innerWidth) * 2 - 1) * 6;
    targetPitch = (1 - (event.clientY / window.innerHeight) * 2) * 4;
};
window.addEventListener('pointermove', onPointerMove);
app.on('destroy', () => window.removeEventListener('pointermove', onPointerMove));

const center = new Vec3(0, 0, FACE_Z);
app.on('update', (/** @type {number} */ dt) => {
    const blend = 1 - Math.exp(-4 * dt);
    yaw = math.lerp(yaw, targetYaw, blend);
    pitch = math.lerp(pitch, targetPitch, blend);

    const yawRad = yaw * math.DEG_TO_RAD;
    const pitchRad = pitch * math.DEG_TO_RAD;
    camera.setLocalPosition(
        center.x + Math.sin(yawRad) * Math.cos(pitchRad) * cameraDistance,
        center.y + Math.sin(pitchRad) * cameraDistance,
        center.z + Math.cos(yawRad) * Math.cos(pitchRad) * cameraDistance
    );
    camera.lookAt(center);
});
