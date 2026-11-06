// @config
//
// @flag CREDITS_HIDDEN
//
// @credit
// title: SAINT GERMAIN – POMPERTUZAT
// author: Stéphane Agullo
// source: https://superspl.at/scene/1a31ac64
// license: CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CULLFACE_BACK,
    CameraComponentSystem,
    CameraFrame,
    CameraFrameEffect,
    Entity,
    FILLMODE_FILL_WINDOW,
    FRAMERESOURCE_DEPTH,
    GSplatComponentSystem,
    GSplatHandler,
    Layer,
    MiniStats,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SceneDepthReader,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    TONEMAP_LINEAR,
    TextureHandler,
    Vec2,
    Vec3,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GSplatTrees } from 'playcanvas/scripts/esm/gsplat/gsplat-trees.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],

    // splats do not benefit from antialiasing, and the scene depth cannot be multi sampled
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// ------ The capture, and the villas in it ------
// The capture is Y down and about 146 units tall, roughly a meter each. The footprints were fitted
// to the splats of the shafts seen from above, and the floors to the rhythm of the slabs. They only
// have to be close, as the surface of the splats decides what each apartment covers, see below.
const CAPTURE = {
    splatUrl: './assets/splats/saint-germain-villas.sog',
    // the view of the whole plot, turning around the middle of the houses
    focusPoint: /** @type {[number, number, number]} */ ([-7.25, 3, -0.75]),
    cameraPosition: /** @type {[number, number, number]} */ ([-75.89, 40.83, -20.0]),

    // the villas still for sale, by number. The rest are sold.
    available: [2, 4, 6, 7, 9],

    title: 'Saint-Germain Villas',

    // how far the skin of an apartment stands off the facade: far enough to clear the splats which
    // stick out of the wall, and the balconies
    offset: 0.4,

    // how much deeper than the splat depth the skin can be and still be seen, for the same reason
    depthTolerance: 0.5,

    // the villas, each the rectangles of its roofs: x0, x1, z0, z1, the height of the eaves, the kind of roof
    // - a gable with its ridge along x or z, or a shed, a single slope falling along z or x, away from the
    // main block - and how far the roof rises above the eaves
    villas: /** @type {{ name: string, rects: [number, number, number, number, number, string, number][] }[]} */ ([
        {
            name: 'Villa 1',
            rects: [
                [-31.7, -22.0, -28.0, -20.3, 4.4, 'gable-x', 1.4],
                [-22.0, -16.3, -28.0, -22.0, 1.5, 'gable-x', 0.9]
            ]
        },
        {
            name: 'Villa 2',
            rects: [[-16.1, -6.7, -28.0, -20.3, 4.4, 'gable-x', 1.4]]
        },
        {
            name: 'Villa 3',
            rects: [
                [5.3, 15.0, -24.3, -16.8, 4.4, 'gable-x', 1.4],
                [2.2, 5.3, -24.3, -18.0, 1.5, 'gable-x', 0.9]
            ]
        },
        {
            name: 'Villa 4',
            rects: [
                [5.9, 15.5, -12.5, -5.0, 4.4, 'gable-x', 1.4],
                [8.1, 14.0, -5.0, -1.7, 1.6, 'shed-z', 0.9]
            ]
        },
        {
            name: 'Villa 5',
            rects: [
                [5.9, 17.2, 0.7, 8.3, 4.4, 'gable-x', 1.4],
                [8.1, 14.0, 8.3, 11.3, 1.6, 'shed-z', 0.9]
            ]
        },
        {
            name: 'Villa 6',
            rects: [
                [5.9, 15.5, 19.0, 26.5, 4.4, 'gable-x', 1.4],
                [8.1, 14.0, 16.0, 19.0, 1.6, 'shed-z', 0.9]
            ]
        },
        {
            name: 'Villa 7',
            rects: [
                [-17.8, -8.1, -11.3, -3.7, 4.4, 'gable-x', 1.4],
                [-8.1, -5.1, -7.8, -2.3, 1.5, 'gable-x', 0.9]
            ]
        },
        {
            name: 'Villa 8',
            rects: [
                [-15.8, -4.6, 3.3, 11.0, 4.4, 'gable-x', 1.4],
                [-12.7, -6.8, 0.1, 3.3, 1.6, 'shed-z', 0.9]
            ]
        },
        {
            name: 'Villa 9',
            rects: [
                [-15.8, -4.6, 16.9, 24.5, 4.4, 'gable-x', 1.4],
                [-12.7, -6.8, 13.6, 16.9, 1.6, 'shed-z', 0.9]
            ]
        }
    ]),

    // the trees, which the wind sways: x, z and the radius of the canopy, read off a top-down view
    trees: /** @type {[number, number, number][]} */ ([
        [-1.2, -25.6, 2.6],
        [-26.0, -18.2, 2.2],
        [-12.2, -18.6, 2.0],
        [4.4, -13.2, 1.8],
        [16.4, -15.6, 2.4],
        [-32.8, -19.2, 2.4],
        [-3.2, -3.6, 2.0],
        [5.2, -0.8, 2.2],
        [16.8, -3.2, 2.4],
        [-18.8, -1.6, 2.4],
        [-21.2, -4.6, 2.2],
        [-21.4, 5.2, 2.8],
        [-18.0, 12.0, 2.2],
        [-14.8, 13.6, 2.2],
        [10.0, 13.6, 2.2],
        [16.4, 10.4, 2.4],
        [-20.8, 17.2, 2.4],
        [-19.2, 23.6, 2.4],
        [-9.2, 26.8, 2.2],
        [10.4, 28.4, 2.4]
    ]),

    // the height of the ground the villas stand on
    groundY: 1.6,

    // the faces of a tower, in the order walking round it: how the box of the face turns, so that its
    // Z axis points out of the facade and its X axis runs along it, and what it looks out on
    faces: [
        { view: 'Street', turn: 0 },
        { view: 'City', turn: 90 },
        { view: 'Garden', turn: 180 },
        { view: 'City', turn: -90 }
    ]
};

// The depth the splats write is stored as the reciprocal of the distance, so the far clip is kept
// inside what the narrower format can carry.
const FAR_CLIP = device.textureFloatBlendable ? 500 : 300;

// ------ Look ------
// colors are linear, as everything is rendered without a tone curve
const COLORS = {
    available: [0.2, 0.95, 0.75],
    hovered: [0.85, 1, 0.95],
    selected: [1, 0.68, 0.18],
    sold: [0.68, 0.7, 0.74]
};

const VILLA_LAYOUTS = [
    { name: '3 bedroom', area: 118, beds: 3 },
    { name: '4 bedroom', area: 146, beds: 4 }
];

// a small deterministic generator, so the same apartments are available on every load
let seed = 4242;
const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};

/**
 * @typedef {object} Apartment
 * @property {string} id - Unit label.
 * @property {string} tower - Tower name.
 * @property {number} floor - Floor number.
 * @property {number} floors - The floors of the tower.
 * @property {boolean} villa - Whether it is a whole villa rather than an apartment.
 * @property {number} plot - The area of the plot, for a villa.
 * @property {string} view - What the apartment looks out on.
 * @property {typeof VILLA_LAYOUTS[0]} layout - The layout.
 * @property {number} price - Asking price.
 * @property {Piece[]} pieces - The volumes the apartment is made of, one per facade it wraps.
 * @property {object[]} pick - The volumes the apartment is picked by.
 * @property {Vec3} [center] - What the camera orbits once the apartment is clicked.
 * @property {Float32Array} color - The color the mesh instance holds.
 * @property {Float32Array} params - The parameters the mesh instance holds.
 * @property {number} blend - Eased 0 to 1 amount of hover.
 * @property {number} select - Eased 0 to 1 amount of selection.
 * @property {boolean} visible - Whether the filters let it through.
 * @property {'available'|'sold'} status - Whether it is still for sale.
 */

/**
 * @typedef {object} Piece
 * @property {Entity} entity - The skin.
 * @property {(offset: number) => object} spec - Where the piece goes for an offset from the walls.
 * @property {number} fill - How much of the fill the piece gets.
 * @property {boolean} openTop - Whether the piece is a wall: left without an outline, as the roof outlines the house, and filled fading towards the ground.
 * @property {number} tolerance - How much deeper than the splats the piece can be and still be seen, on top of the depth tolerance.
 * @property {Float32Array} box0 - The center and the fill the mesh instance holds.
 * @property {Float32Array} box1 - The half extents the mesh instance holds.
 * @property {Float32Array} axis0 - The X axis of the piece the mesh instance holds.
 * @property {Float32Array} axis1 - The Y axis of the piece the mesh instance holds.
 * @property {Float32Array} edge - The ends and the gable the mesh instance holds.
 */

// ------ The overlay material ------
// The skin of an apartment is a thin box, a piece of it for each facade it wraps. It is hidden
// wherever the splats are in front of it, within a tolerance as their depth is soft. The outline is
// a fixed number of pixels wide, from the distance to the edge of the panel, so it reads the same
// from the far side of the lot as up close.
//
// The scene depth is published by the camera frame for the passes which follow the scene, and the
// layer the apartments are in renders after those.
const overlayMaterial = new ShaderMaterial({
    uniqueName: 'ApartmentOverlay',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexGLSL: /* glsl */ `
        attribute vec4 aPosition;
        uniform mat4 matrix_model;
        uniform mat4 matrix_view;
        uniform mat4 matrix_viewProjection;
        varying float vViewZ;
        varying vec3 vWorld;
        void main() {
            vec4 world = matrix_model * aPosition;
            vWorld = world.xyz;
            vViewZ = -(matrix_view * world).z;
            gl_Position = matrix_viewProjection * world;
        }
    `,
    fragmentGLSL: /* glsl */ `
        uniform highp sampler2D uSceneDepthMap;
        uniform vec4 screen_size;
        uniform vec4 uBox0;   // center, how much of the fill the piece gets
        uniform vec4 uBox1;   // half extents, the shape of the top of the panel: 0 flat, 1 gable, 2 or -2 a slope rising to the right or the left
        uniform vec4 uAxis0;  // the X axis of the piece, how much more depth tolerance it gets
        uniform vec4 uAxis1;  // the Y axis of the piece, whether it is a wall: no outline, and a fill fading to the ground
        uniform vec4 uEdge;   // whether the left and the right end continue into another piece, how far a gable rises, the height of its eaves
        uniform vec4 uColor;  // rgb, the fill opacity
        uniform vec4 uParams; // outline opacity, outline width in pixels, size of a pixel at one unit, depth tolerance
        varying float vViewZ;
        varying vec3 vWorld;
        void main() {
            vec2 uv = gl_FragCoord.xy * screen_size.zw;
            float recip = texelFetch(uSceneDepthMap, ivec2(uv * vec2(textureSize(uSceneDepthMap, 0))), 0).r;

            // behind the splats
            if (recip > 0.0 && vViewZ > 1.0 / recip + uParams.w + uAxis0.w) {
                discard;
            }

            // this point in the frame of the piece, and its height above the bottom of it
            vec3 d = vWorld - uBox0.xyz;
            float x = dot(d, uAxis0.xyz);
            float height = dot(d, uAxis1.xyz) + uBox1.y;

            // the height of the top of the panel here: flat, a gable rising to its middle, or a slope
            float shape = uBox1.w;
            float rising = shape > 1.5 ? (x / uBox1.x + 1.0) * 0.5 : (shape < -1.5 ? (1.0 - x / uBox1.x) * 0.5 : (shape > 0.5 ? 1.0 - abs(x) / uBox1.x : 0.0));
            float top = uEdge.w + uEdge.z * rising;
            if (height > top) {
                discard;
            }

            // the distance to the nearest edge of the panel, the top of it measured across its slope
            float slope = abs(shape) > 1.5 ? uEdge.z / (2.0 * uBox1.x) : (shape > 0.5 ? uEdge.z / uBox1.x : 0.0);
            float left = uEdge.x > 0.5 ? 1e4 : uBox1.x + x;
            float right = uEdge.y > 0.5 ? 1e4 : uBox1.x - x;
            bool wall = uAxis1.w > 0.5;
            float edge = wall ? 1e4 : min(min(left, right), min(height, (top - height) / sqrt(1.0 + slope * slope)));

            // in pixels, as they are on the screen, whichever way the panel is turned
            float pixels = edge / max(fwidth(edge), 1e-5);
            float line = 1.0 - smoothstep(uParams.y - 1.0, uParams.y, pixels);

            // a roof is filled evenly, a wall as much at the roof and fading out towards the ground
            float fill = uColor.a * uBox0.w * (wall ? clamp(height / max(top, 1e-3), 0.0, 1.0) : 1.0);

            vec3 rgb = mix(uColor.rgb, vec3(1.0), 0.35 * line);
            float alpha = max(fill, uParams.x * line);
            gl_FragColor = vec4(rgb, alpha);
        }
    `,
    vertexWGSL: /* wgsl */ `
        attribute aPosition: vec4f;
        uniform matrix_model: mat4x4f;
        uniform matrix_view: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;
        varying vViewZ: f32;
        varying vWorld: vec3f;
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let world = uniform.matrix_model * input.aPosition;
            output.vWorld = world.xyz;
            output.vViewZ = -(uniform.matrix_view * world).z;
            output.position = uniform.matrix_viewProjection * world;
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */ `
        var uSceneDepthMap: texture_2d<uff>;
        uniform screen_size: vec4f;
        uniform uBox0: vec4f;
        uniform uBox1: vec4f;
        uniform uAxis0: vec4f;
        uniform uAxis1: vec4f;
        uniform uEdge: vec4f;
        uniform uColor: vec4f;
        uniform uParams: vec4f;
        varying vViewZ: f32;
        varying vWorld: vec3f;
        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;

            let dims = vec2f(textureDimensions(uSceneDepthMap, 0));
            let texel = vec2i(pcPosition.xy * uniform.screen_size.zw * dims);
            let recip = textureLoad(uSceneDepthMap, texel, 0).r;
            if (recip > 0.0 && input.vViewZ > 1.0 / recip + uniform.uParams.w + uniform.uAxis0.w) {
                discard;
            }

            let d = input.vWorld - uniform.uBox0.xyz;
            let x = dot(d, uniform.uAxis0.xyz);
            let height = dot(d, uniform.uAxis1.xyz) + uniform.uBox1.y;

            let shape = uniform.uBox1.w;
            var rising = 0.0;
            if (shape > 1.5) {
                rising = (x / uniform.uBox1.x + 1.0) * 0.5;
            } else if (shape < -1.5) {
                rising = (1.0 - x / uniform.uBox1.x) * 0.5;
            } else if (shape > 0.5) {
                rising = 1.0 - abs(x) / uniform.uBox1.x;
            }
            let top = uniform.uEdge.w + uniform.uEdge.z * rising;
            if (height > top) {
                discard;
            }

            var slope = 0.0;
            if (abs(shape) > 1.5) {
                slope = uniform.uEdge.z / (2.0 * uniform.uBox1.x);
            } else if (shape > 0.5) {
                slope = uniform.uEdge.z / uniform.uBox1.x;
            }
            let left = select(uniform.uBox1.x + x, 1e4, uniform.uEdge.x > 0.5);
            let right = select(uniform.uBox1.x - x, 1e4, uniform.uEdge.y > 0.5);
            let wall = uniform.uAxis1.w > 0.5;
            let edge = select(min(min(left, right), min(height, (top - height) / sqrt(1.0 + slope * slope))), 1e4, wall);

            let pixels = edge / max(fwidth(edge), 1e-5);
            let line = 1.0 - smoothstep(uniform.uParams.y - 1.0, uniform.uParams.y, pixels);
            let fill = uniform.uColor.a * uniform.uBox0.w * select(1.0, clamp(height / max(top, 1e-3), 0.0, 1.0), wall);

            let rgb = mix(uniform.uColor.rgb, vec3f(1.0), 0.35 * line);
            let alpha = max(fill, uniform.uParams.x * line);
            output.color = vec4f(rgb, alpha);
            return output;
        }
    `
});
overlayMaterial.blendType = BLEND_NORMAL;
overlayMaterial.depthWrite = false;
overlayMaterial.cull = CULLFACE_BACK;
overlayMaterial.update();

// ------ Splat asset ------
const splatAsset = new Asset('villas', 'gsplat', { url: CAPTURE.splatUrl });
await new Promise((resolve) => {
    new AssetListLoader([splatAsset], app.assets).load(resolve);
});

app.start();
const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['gsplats']));

data.set('settings', {
    show: true,
    offset: CAPTURE.offset,
    fill: 0.3,
    outline: 1,
    layout: -1,
    maxPrice: 1000,
    wind: 0.2
});

// ------ Camera ------
const camera = new Entity('camera');
camera.addComponent('camera', {
    fov: 38,
    nearClip: 0.5,
    farClip: FAR_CLIP,
    toneMapping: TONEMAP_LINEAR,
    clearColor: [0.006, 0.01, 0.008, 1]
});
camera.addComponent('script');
const cc = /** @type {CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));
app.root.addChild(camera);
camera.setLocalPosition(...CAPTURE.cameraPosition);

// map controls: the left button turns the view, the right one drags the plot like a map, and the
// camera stays above the ground
Object.assign(cc, {
    sceneSize: 50,
    moveSpeed: 20,
    moveFastSpeed: 80,
    leftButton: 'orbit',
    middleButton: 'pan',
    rightButton: 'pan',
    groundPan: true,
    pitchRange: new Vec2(-89, -8),
    zoomRange: new Vec2(8, 160),
    focusPoint: new Vec3(...CAPTURE.focusPoint)
});

// ------ Splats ------
const splat = new Entity('villas');
splat.addComponent('gsplat', { asset: splatAsset });
splat.setLocalEulerAngles(180, 0, 0);
app.root.addChild(splat);

app.scene.gsplat.splatBudget = 1000000;
app.scene.gsplat.radialSorting = true;
app.scene.gsplat.sceneDepthWrite = true;

// ------ Wind ------
// The trees sway with the reusable GSplatTrees script, see gaussian-splatting-fx/wind. Each tree is a
// sphere with its bottom on the ground, a little larger than the canopy, and the splats in it sway more
// the higher they are, so the trunks stay put. The trees are small, so the sway is too.
splat.addComponent('script');
const trees = /** @type {GSplatTrees} */ (/** @type {any} */ (splat.script).create(GSplatTrees));
Object.assign(trees, { speed: 0.9, direction: 30, gustiness: 0.5, flutter: 0.35 });
trees.setSpheres(
    CAPTURE.trees.map(([x, z, canopy]) => {
        const radius = canopy + 0.6;
        return { center: new Vec3(x, CAPTURE.groundY + radius, z), radius };
    })
);
const applyWind = () => {
    trees.strength = data.get('settings.wind');
};
applyWind();
data.on('settings.wind:set', applyWind);

// ------ Camera frame ------
// Something has to consume the scene depth for the camera to render it. This effect owns no pass and
// no compose code, it is only here to ask for the depth, which the apartments then read.
const depthEffect = new CameraFrameEffect(device, 'sceneDepth', { requires: [FRAMERESOURCE_DEPTH] });
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.addEffect(depthEffect);
cameraFrame.update();

// ------ Apartment layer ------
// After everything else, so that it renders after the post processing, when the scene depth is complete
const layer = new Layer({ name: 'Apartments' });
app.scene.layers.push(layer);
camera.camera.layers = [...camera.camera.layers, layer.id];

/** @type {Apartment[]} */
const apartments = [];
const root = new Entity('apartments');
app.root.addChild(root);

// The skin of a villa is made of the walls of each rectangle of its roof, the gable ends reaching up to
// the ridge, and the two slopes of its roof. A face which is up against another rectangle of the same
// villa is left out.
const faces = CAPTURE.faces.map((face) => {
    const turn = (face.turn * Math.PI) / 180;
    return { ...face, turnRad: turn, nx: Math.sin(turn), nz: Math.cos(turn) };
});

const SKIN = 0.01;
const turnQuat = new Quat();
const pitchQuat = new Quat();
const axis = new Vec3();

// Places a piece, standing off the nominal walls by the offset, and turns it to the axes the shader works in
const layoutPiece = (/** @type {Piece} */ piece, /** @type {number} */ offset) => {
    const { x, y, z, hx, hy, hz, turn, pitch, edge, shape = 0 } = piece.spec(offset);

    turnQuat.setFromEulerAngles(0, turn, 0);
    if (pitch) {
        turnQuat.mul(pitchQuat.setFromEulerAngles(pitch, 0, 0));
    }

    const { entity } = piece;
    entity.setLocalScale(hx * 2, hy * 2, hz * 2);
    entity.setPosition(x, y, z);
    entity.setRotation(turnQuat);

    turnQuat.transformVector(Vec3.RIGHT, axis);
    piece.axis0.set([axis.x, axis.y, axis.z, piece.tolerance]);
    turnQuat.transformVector(Vec3.UP, axis);
    piece.axis1.set([axis.x, axis.y, axis.z, piece.openTop ? 1 : 0]);
    piece.box0.set([x, y, z, piece.fill]);
    piece.box1.set([hx, hy, hz, shape]);
    piece.edge.set(edge);

    const mi = entity.render.meshInstances[0];
    mi.setParameter('uBox0', piece.box0);
    mi.setParameter('uBox1', piece.box1);
    mi.setParameter('uAxis0', piece.axis0);
    mi.setParameter('uAxis1', piece.axis1);
    mi.setParameter('uEdge', piece.edge);
};

CAPTURE.villas.forEach((villa, index) => {
    const layout = VILLA_LAYOUTS[Math.floor(random() * 2)];
    const price = Math.round((layout.area * (3800 + random() * 300)) / 1000) * 1000;
    const plot = Math.round((260 + random() * 200) / 10) * 10;
    const status = CAPTURE.available.includes(index + 1) ? 'available' : 'sold';
    const ground = CAPTURE.groundY;

    /** @type {Piece[]} */
    const pieces = [];
    const pick = [];

    const addPiece = (
        /** @type {string} */ name,
        /** @type {number} */ fill,
        /** @type {number} */ tolerance,
        /** @type {boolean} */ openTop,
        /** @type {Piece['spec']} */ spec
    ) => {
        const entity = new Entity(name);
        entity.addComponent('render', {
            type: 'box',
            material: overlayMaterial,
            layers: [layer.id],
            castShadows: false,
            receiveShadows: false
        });
        root.addChild(entity);
        pieces.push({
            entity,
            spec,
            fill,
            tolerance,
            openTop,
            box0: new Float32Array(4),
            box1: new Float32Array(4),
            axis0: new Float32Array(4),
            axis1: new Float32Array(4),
            edge: new Float32Array(4)
        });
    };

    villa.rects.forEach(([x0, x1, z0, z1, eave, roof, rise], r) => {
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const hw = (x1 - x0) / 2;
        const hd = (z1 - z0) / 2;

        // which way the eaves run, and whether the roof is a gable or a single slope
        const [kind, direction] = roof.split('-');
        const gable = kind === 'gable';
        const runsX = gable ? direction === 'x' : direction === 'z';

        // a single slope falls away from the main block, which is the first rectangle
        const [mx0, mx1, mz0, mz1] = villa.rects[0];
        const away = (/** @type {{ nx: number, nz: number }} */ face) =>
            face.nx * (cx - (mx0 + mx1) / 2) + face.nz * (cz - (mz0 + mz1) / 2);

        // the two faces the eaves run along
        const eaveFaces = faces.filter((face, i) => (i % 2 === 0) === runsX);
        const low = gable || r === 0 ? eaveFaces[0] : eaveFaces.reduce((a, b) => (away(a) > away(b) ? a : b));

        faces.forEach((face, i) => {
            const alongX = i % 2 === 0;
            const half = alongX ? hw : hd;
            const distance = alongX ? hd : hw;

            // up against another rectangle of the villa
            const covered = villa.rects.some(
                ([ax0, ax1, az0, az1], other) =>
                    other !== r &&
                    cx + face.nx * (distance + 0.4) > ax0 &&
                    cx + face.nx * (distance + 0.4) < ax1 &&
                    cz + face.nz * (distance + 0.4) > az0 &&
                    cz + face.nz * (distance + 0.4) < az1
            );

            // a wall: flat at the eaves, higher on the high side of a slope, and with its top following
            // the roof on the faces the eaves do not run along
            const isEave = alongX === runsX;
            const wall = eave - 0.1;
            let wallRise = 0;
            let shape = 0;
            let topRise = 0;
            if (!isEave) {
                topRise = rise;
                if (gable) {
                    shape = 1;
                } else {
                    // rising towards the side of the slope away from the low face
                    const xAxis = [Math.cos(face.turnRad), -Math.sin(face.turnRad)];
                    shape = (-low.nx * xAxis[0] - low.nz * xAxis[1] > 0 ? 1 : -1) * 2;
                }
            } else if (!gable && face !== low) {
                wallRise = rise;
            }

            // the wall is left out where it is up against another rectangle, the roof above it is not
            if (!covered) {
                addPiece(`${villa.name} wall`, 1, 0, true, (offset) => {
                    const total = wall + wallRise + topRise;
                    return {
                        x: cx + face.nx * (distance + offset),
                        y: ground + 0.1 + total / 2,
                        z: cz + face.nz * (distance + offset),
                        hx: half + offset,
                        hy: total / 2,
                        hz: SKIN,
                        turn: face.turn,
                        pitch: 0,
                        shape,
                        edge: [1, 1, topRise, wall + wallRise]
                    };
                });
            }

            // the slope of the roof: on both eave faces of a gable, and once on the low face of a single slope
            if (isEave && (gable || face === low)) {
                addPiece(`${villa.name} roof`, 1, 1.2, false, (offset) => {
                    // out to the skirts, so that the eaves meet the tops of them
                    const edge = offset;
                    const run = gable ? distance + edge : (distance + edge) * 2;
                    const mid = gable ? run / 2 : 0;

                    return {
                        x: cx + face.nx * mid,
                        y: ground + eave + rise / 2,
                        z: cz + face.nz * mid,
                        hx: half + edge,
                        hy: Math.hypot(run, rise) / 2,
                        hz: SKIN,
                        turn: face.turn,
                        // the plane's Y axis runs up the slope, so it is turned from vertical by the rest of the way
                        pitch: (Math.atan2(rise, run) * 180) / Math.PI - 90,
                        edge: [0, 0, 0, Math.hypot(run, rise)]
                    };
                });
            }
        });

        // a villa is picked by the whole house, its roof as well as its walls
        // as tall as the roof of this part only, so that a low carport does not take the pointer from the
        // wall of the house behind it
        const top = eave + rise + 0.4;
        pick.push({
            center: new Vec3(cx, ground + top / 2, cz),
            half: new Vec3(hw + 0.5, top / 2, hd - 0.1),
            cos: 1,
            sin: 0
        });
    });

    apartments.push({
        id: `V${index + 1}`,
        tower: villa.name,
        floor: 1,
        floors: 1,
        villa: true,
        plot,
        view: 'Private garden',
        layout,
        price,
        pieces,
        pick,
        // the middle of the main block, which the camera orbits once the villa is clicked
        center: new Vec3(
            (villa.rects[0][0] + villa.rects[0][1]) / 2,
            ground + 3,
            (villa.rects[0][2] + villa.rects[0][3]) / 2
        ),
        status,
        color: new Float32Array(4),
        params: new Float32Array(4),
        blend: 0,
        select: 0,
        visible: true
    });
});

// ------ Picking ------
// The depth under the pointer is read back, and the point of the surface it gives is looked up in the
// volumes of the villas.
const depthReader = new SceneDepthReader(camera.camera);
const depthRect = new Vec4();
const depthSample = new Float32Array(1);

const rayStart = new Vec3();
const rayEnd = new Vec3();
const rayDir = new Vec3();
const surface = new Vec3();

const pointer = { x: 0, y: 0, inside: false, downX: 0, downY: 0 };
canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
});
canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
});
canvas.addEventListener('pointerdown', (e) => {
    pointer.downX = e.clientX;
    pointer.downY = e.clientY;
});

/** @type {Apartment|null} */
let hovered = null;

/** @type {Apartment|null} */
let selected = null;

// ------ HTML overlay ------
// A product page around the 3D view: a bar across the top, the villas on the left, the view in a
// frame in the middle, and the details of the villa picked - or of the development - on the right.
const PLAN_URL = './assets/textures/villa-floor-plan.webp';

// the small sketch of the house in the corner of the plan, cropped as the thumbnail of every villa
const thumb = `background-image: url(${PLAN_URL}); background-size: 538px auto; background-position: -432px -256px;`;

// the rooms of the representative plan
const ROOMS = {
    'Ground floor': [
        ['Entry', 5.6],
        ['WC', 2.3],
        ['Living / Dining / Kitchen', 40.9],
        ['Bedroom', 11.7],
        ['Utility', 6.5]
    ],
    'First floor': [
        ['Hallway', 6.7],
        ['Master bedroom', 15.1],
        ['Bathroom', 8.4],
        ['Bedroom', 11.9],
        ['Bedroom', 11.6],
        ['Bedroom', 11.3]
    ]
};

const SPECIFICATIONS = [
    ['Construction', 'Brick and render, tiled roof'],
    ['Heating', 'Heat pump, underfloor heating'],
    ['Glazing', 'Double glazed aluminium'],
    ['Energy rating', 'A'],
    ['Parking', 'Garage and driveway'],
    ['Completion', 'Autumn 2027']
];

// line icons for the specification tiles
const ICONS = {
    bed: '<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V6h10v3"/>',
    bath: '<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2zM6 12V6a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2"/>',
    floors: '<path d="M4 20h5v-5h5v-5h6M14 6l4 0 0 4"/>',
    area: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    garden: '<path d="M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>'
};
const icon = (/** @type {string} */ name) =>
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[/** @type {keyof ICONS} */ (name)]}</svg>`;

const style = document.createElement('style');
style.textContent = `
    .apt-ui { font-family: Inter, system-ui, -apple-system, sans-serif; color: #e9eee9; }
    .apt-ui * { box-sizing: border-box; }
    .apt-ui ::-webkit-scrollbar { width: 6px; }
    .apt-ui ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
    .apt-ui ::-webkit-scrollbar-track { background: transparent; }
    .apt-ui * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent; }
    .apt-ui .eyebrow { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.55; }

    /* frosted glass, for everything over the 3D */
    .apt-glass { background: rgba(14, 20, 17, 0.5); border: 1px solid rgba(255, 255, 255, 0.09);
        backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35); }

    .apt-bar { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); height: 48px; display: flex;
        align-items: center; gap: 20px; padding: 0 8px 0 18px; border-radius: 999px; white-space: nowrap; }
    .apt-bar .brand { display: flex; align-items: center; gap: 9px; font: 500 18px Georgia, 'Times New Roman', serif; }
    .apt-bar .brand svg { color: #cfe3c8; }
    .apt-bar .numbers { display: flex; align-items: center; gap: 14px; padding-left: 18px; font-size: 13px;
        border-left: 1px solid rgba(255,255,255,0.12); }
    .apt-bar .numbers span { opacity: 0.65; }
    .apt-bar .numbers b { font-weight: 600; opacity: 1; font-variant-numeric: tabular-nums; }
    .apt-bar .numbers i { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%;
        background: #6fd17d; vertical-align: 1px; }
    .apt-bar .contact { padding: 8px 14px; border-radius: 999px; font-size: 13px; color: inherit;
        background: transparent; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; }
    .apt-bar .contact:hover { background: rgba(255,255,255,0.06); }

    .apt-left { position: absolute; top: 76px; bottom: 16px; left: 16px; width: var(--left); display: flex; flex-direction: column;
        padding: 14px 10px 10px; border-radius: 18px; }
    .apt-left header { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 6px 14px; }
    .apt-left h2 { margin: 0; font-size: 20px; font-weight: 500; }
    .apt-left header span { font-size: 12px; opacity: 0.6; }
    .apt-left .list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px; }
    .apt-left .row { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; cursor: pointer;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);
        transition: background 0.15s ease, border-color 0.15s ease; }
    .apt-left .row:hover { background: rgba(255,255,255,0.07); }
    .apt-left .row.selected { background: rgba(160, 200, 160, 0.12); border-color: rgba(220, 235, 215, 0.6); }
    .apt-left .row.sold { cursor: default; }
    .apt-left .row.sold .thumb, .apt-left .row.sold .info { opacity: 0.55; filter: grayscale(1); }
    .apt-left .thumb { flex: none; width: 76px; height: 58px; border-radius: 8px; background-color: #f7f5f0; ${thumb} }
    .apt-left .info { flex: 1; min-width: 0; }
    .apt-left .name { font-size: 15px; font-weight: 500; }
    .apt-left .meta { margin-top: 2px; font-size: 12px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .apt-left .name, .apt-left .cost { white-space: nowrap; }
    .apt-left .cost { margin-top: 4px; font-size: 15px; font-weight: 600; }
    .apt-left .badge { align-self: flex-start; padding: 2px 8px; border-radius: 6px; font-size: 11px;
        background: rgba(255,255,255,0.12); }

    .apt-right { position: absolute; bottom: 16px; right: 16px; width: var(--right); max-height: calc(100% - 280px);
        overflow-y: auto; padding: 18px 18px 16px; border-radius: 18px; }
    .apt-right .status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 999px;
        font-size: 12px; background: rgba(120, 200, 130, 0.16); color: #cfeccb; }
    .apt-right .status i { width: 7px; height: 7px; border-radius: 50%; background: #6fd17d; }
    .apt-right .status.sold { background: rgba(255,255,255,0.1); color: #d0d4d8; }
    .apt-right .status.sold i { background: #9aa0a6; }
    .apt-right .heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-top: 12px; }
    .apt-right h1 { margin: 0; font-size: 34px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
    .apt-right .price { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; padding-top: 4px; }
    .apt-right .sub { margin-top: 6px; font-size: 15px; opacity: 0.8; }
    .apt-right p { margin: 14px 0 16px; font-size: 13px; line-height: 1.6; opacity: 0.75; }
    .apt-right .tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .apt-right .tile { padding: 12px 4px 10px; border-radius: 10px; text-align: center; background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07); }
    .apt-right .tile svg { opacity: 0.8; }
    .apt-right .tile b { display: block; margin-top: 4px; font-size: 14px; font-weight: 600; }
    .apt-right .tile span { font-size: 10.5px; opacity: 0.6; }
    .apt-right .tabs-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.07); overflow: hidden; }
    .apt-right .tabs { display: flex; gap: 4px; padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .apt-right .tabs button { flex: 1; padding: 8px; border: 0; border-radius: 9px; font-size: 13px; color: inherit;
        background: transparent; opacity: 0.75; cursor: pointer; transition: background 0.15s ease; }
    .apt-right .tabs button:hover { background: rgba(255,255,255,0.05); }
    .apt-right .tabs button.active { background: rgba(160, 200, 160, 0.2); opacity: 1; }
    .apt-right .pane { display: none; padding: 12px; }
    .apt-right .pane.active { display: block; }
    .apt-right .plan-thumb { display: block; width: 100%; border-radius: 8px; background: #f7f5f0; cursor: zoom-in;
        transition: transform 0.2s ease; }
    .apt-right .plan-thumb:hover { transform: scale(1.01); }
    .apt-right .caption { margin-top: 8px; font-size: 11.5px; opacity: 0.55; text-align: center; }
    .apt-right table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .apt-right th { padding: 10px 4px 6px; text-align: left; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
        font-weight: 500; opacity: 0.55; }
    .apt-right td { padding: 6px 4px; border-top: 1px solid rgba(255,255,255,0.06); }
    .apt-right td:last-child { text-align: right; opacity: 0.8; font-variant-numeric: tabular-nums; }
    .apt-right .actions { display: flex; gap: 8px; margin: 14px 0 4px; }
    .apt-right .actions button { flex: 1; padding: 12px; border-radius: 10px; font-size: 13px; cursor: pointer;
        transition: filter 0.15s ease, background 0.15s ease; }
    .apt-right .primary { border: 0; font-weight: 600; color: #10170f; background: #cfe3c8; }
    .apt-right .primary:hover { filter: brightness(1.08); }
    .apt-right .secondary { color: inherit; background: transparent; border: 1px solid rgba(255,255,255,0.18); }
    .apt-right .secondary:hover { background: rgba(255,255,255,0.06); }
    .apt-right .stats { display: flex; gap: 26px; margin: 18px 0 6px; }
    .apt-right .stat b { display: block; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .apt-right .stat span { font-size: 12px; opacity: 0.6; }
    .apt-right .fade { animation: apt-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
    @keyframes apt-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .apt-help { position: absolute; bottom: 30px; left: calc(var(--left) + 28px); right: calc(var(--right) + 28px);
        display: flex; justify-content: center; pointer-events: none; }
    .apt-help div { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 12px; max-width: calc(100% - 24px);
        padding: 7px 12px; border-radius: 10px; font-size: 11.5px; white-space: nowrap;
        background: rgba(12, 17, 14, 0.7); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); }
    .apt-help span { display: flex; align-items: center; gap: 6px; opacity: 0.85; }
    .apt-help kbd { padding: 1px 6px; border-radius: 5px; font: 600 10px Inter, system-ui, sans-serif;
        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-bottom-width: 2px; }

    .apt-tooltip { position: absolute; padding: 8px 12px; pointer-events: none; display: none; font-size: 12px;
        white-space: nowrap; border-radius: 10px; background: rgba(12, 17, 14, 0.85); border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px); }
    .apt-tooltip b { font-weight: 600; margin-right: 6px; }
    .apt-tooltip .muted { opacity: 0.6; }

    .apt-plan { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
        background: rgba(5, 8, 6, 0.6); backdrop-filter: blur(8px); opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
    .apt-plan.open { opacity: 1; pointer-events: auto; }
    .apt-plan .sheet { width: min(92vw, 1080px); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden;
        border-radius: 18px; background: #18201b; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        transform: translateY(18px) scale(0.98); transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .apt-plan.open .sheet { transform: none; }
    .apt-plan header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 14px; }
    .apt-plan h3 { margin: 3px 0 0; font-size: 18px; font-weight: 600; }
    .apt-plan h3 span { font-weight: 400; opacity: 0.6; }
    .apt-plan .close { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06); color: inherit; font-size: 18px; line-height: 1; cursor: pointer; }
    .apt-plan .close:hover { background: rgba(255,255,255,0.14); }
    .apt-plan .paper { margin: 0 16px 16px; border-radius: 12px; overflow: hidden; background: #f7f5f0; min-height: 0; cursor: zoom-in; }
    .apt-plan .paper.zoomed { cursor: zoom-out; }
    .apt-plan img { display: block; width: 100%; height: auto; max-height: calc(92vh - 90px); object-fit: contain;
        transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); user-select: none; -webkit-user-drag: none; }
    .apt-plan .paper.zoomed img { transform: scale(2); }
`;
document.head.appendChild(style);

const makeElement = (/** @type {string} */ className, /** @type {string} */ html = '') => {
    const element = document.createElement('div');
    element.className = className;
    element.innerHTML = html;
    document.body.appendChild(element);
    return element;
};

// the widths of the columns, which the frame of the view and its camera follow
const LEFT_WIDTH = 'clamp(220px, 19vw, 320px)';
const RIGHT_WIDTH = 'clamp(320px, 30vw, 500px)';
document.body.style.setProperty('--left', LEFT_WIDTH);
document.body.style.setProperty('--right', RIGHT_WIDTH);

const bar = makeElement(
    'apt-ui apt-glass apt-bar',
    `
    <div class="brand">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20c6 0 13-4 15-16C11 5 5 10 4 20zM4 20c3-5 6-8 10-10"/>
        </svg>
        ${CAPTURE.title}
    </div>
    <div class="numbers">
        <span><i></i><b data-stat="available">0</b> available</span>
        <span>from <b data-stat="from">-</b></span>
        <span><b data-stat="sold">0</b> sold</span>
    </div>
    <button class="contact">Contact us</button>`
);
const left = makeElement(
    'apt-ui apt-glass apt-left',
    `
    <header><h2>Our villas</h2><span data-count></span></header>
    <div class="list"></div>`
);
const listView = /** @type {HTMLElement} */ (left.querySelector('.list'));
const side = makeElement('apt-ui apt-glass apt-right');
const help = makeElement(
    'apt-ui apt-help',
    `<div>${[
        ['Drag', 'Rotate'],
        ['Right drag', 'Move'],
        ['Scroll', 'Zoom'],
        ['Click', 'Select a villa'],
        ['Esc', 'Overview']
    ]
        .map(([key, action]) => `<span><kbd>${key}</kbd>${action}</span>`)
        .join('')}</div>`
);
const tooltip = makeElement('apt-ui apt-tooltip');

/** @type {Apartment|null} */
let listHovered = null;

// ------ Floor plan ------
// A representative plan, the same for every villa. Clicking it zooms in on the point clicked, and moving
// the pointer then looks around the plan.
const plan = makeElement(
    'apt-ui apt-plan',
    `
    <div class="sheet">
        <header>
            <div>
                <div class="eyebrow">Floor plan · representative layout</div>
                <h3 data-plan="title"></h3>
            </div>
            <button class="close" aria-label="Close">×</button>
        </header>
        <div class="paper"><img src="${PLAN_URL}" alt="Floor plan"></div>
    </div>`
);
const planTitle = /** @type {HTMLElement} */ (plan.querySelector('[data-plan="title"]'));
const planPaper = /** @type {HTMLElement} */ (plan.querySelector('.paper'));
const planImage = /** @type {HTMLImageElement} */ (plan.querySelector('img'));

const openPlan = (/** @type {Apartment} */ apartment) => {
    planTitle.innerHTML = `${apartment.tower} <span>· ${apartment.layout.name} · ${apartment.layout.area} m²</span>`;
    planPaper.classList.remove('zoomed');
    plan.classList.add('open');
};
const closePlan = () => plan.classList.remove('open');
const planOpen = () => plan.classList.contains('open');

// zoom on the point clicked, and follow the pointer while zoomed
const aimZoom = (/** @type {MouseEvent} */ e) => {
    const rect = planPaper.getBoundingClientRect();
    planImage.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
};
planPaper.addEventListener('click', (e) => {
    aimZoom(e);
    planPaper.classList.toggle('zoomed');
});
planPaper.addEventListener('mousemove', (e) => {
    if (planPaper.classList.contains('zoomed')) aimZoom(e);
});
plan.querySelector('.close')?.addEventListener('click', closePlan);
plan.addEventListener('click', (e) => {
    if (e.target === plan) closePlan();
});

app.on('destroy', () => {
    [bar, left, side, help, tooltip, plan, style].forEach((e) => e.remove());
    document.body.style.removeProperty('--left');
    document.body.style.removeProperty('--right');
    depthReader.destroy();
});

const money = (/** @type {number} */ v) => `$${v.toLocaleString('en-US')}`;

// ------ Camera focus ------
// A picked villa is flown to, and the view turns around it. Closing its details flies back to the view
// of the whole plot. The point the view turns around stays in the middle of the part of the screen the
// panels leave free - not by moving the camera, which would put that point off the houses, but with an
// off-center projection, which the picking takes into account.
const FOCUS_DISTANCE = 26;
const sceneCenter = new Vec3(...CAPTURE.focusPoint);
const projectionOffset = new Vec2();

const updateFraming = () => {
    // the part of the screen nothing covers: right of the list of villas, below the bar, and left of the
    // details when they are shown
    const leftEdge = left.getBoundingClientRect().right;
    const rightEdge = side.style.display === 'none' ? canvas.clientWidth : side.getBoundingClientRect().left;
    const topEdge = bar.getBoundingClientRect().bottom;
    const x = (leftEdge + rightEdge) / canvas.clientWidth - 1;
    const y = 1 - (topEdge + canvas.clientHeight) / canvas.clientHeight;

    // in half frustum units, the offset of the window moving the image the other way
    if (projectionOffset.x !== -x || projectionOffset.y !== -y) {
        projectionOffset.set(-x, -y);
        camera.camera.projectionOffset = projectionOffset;
    }
};

const homeTarget = new Vec3();
const homePosition = new Vec3();
const flyHome = () => {
    homeTarget.copy(sceneCenter);
    homePosition.set(...CAPTURE.cameraPosition);
    cc.reset(homeTarget, homePosition);
};

const focusOn = (/** @type {Apartment} */ apartment) => {
    // from the direction the camera looks at the villa from now, raised a little to look down at it
    const target = /** @type {Vec3} */ (apartment.center);
    const position = new Vec3().sub2(camera.getPosition(), target).normalize();
    position.y = Math.max(position.y, 0.45);
    position.normalize().mulScalar(FOCUS_DISTANCE).add(target);
    cc.reset(target, position);
};

// Zooming out draws the view back to the middle of the village: each step out moves the point the
// view turns around towards the middle by the share of the way out to the overview it covers, so
// that it arrives there with the overview distance. Zooming in and dragging leave it where it is.
// CameraControls has no public access to the point, so this moves its orbit controller's target pose,
// which the controller then eases towards - with no jump, and keeping the damping of the zoom.
const HOME_DISTANCE = new Vec3(...CAPTURE.cameraPosition).distance(sceneCenter);
const recenterOffset = new Vec3();
let lastZoom = -1;

const recenter = () => {
    const controls = /** @type {any} */ (cc);
    if (controls._mode !== 'orbit') {
        lastZoom = -1;
        return;
    }

    const orbitController = controls._orbitController;
    const zoom = orbitController._targetChildPose.position.z;
    if (lastZoom >= 0 && zoom > lastZoom) {
        const share = lastZoom < HOME_DISTANCE ? Math.min(1, (zoom - lastZoom) / (HOME_DISTANCE - lastZoom)) : 1;
        const pivot = orbitController._targetRootPose.position;
        recenterOffset.sub2(homeTarget, pivot).mulScalar(share);
        pivot.add(recenterOffset);
    }
    lastZoom = zoom;
};

// redrawn when the numbers change, and when the details are redrawn with them
let statsKey = '';

// A picked villa is slowly turned around once the flight to it has landed, until the user takes over -
// through the orbit controller's own target pose, like the recentering above, so that it keeps its
// damping and starts and stops without a jerk.
const AUTO_ORBIT_SPEED = 9; // degrees per second
const autoOrbit = { active: false, speed: 0 };
const autoOrbitDelta = new Vec3();

const updateAutoOrbit = (/** @type {number} */ dt) => {
    const controls = /** @type {any} */ (cc);

    // held still until the flight in has landed, and then eased up to speed over a few seconds
    if (controls._mode !== 'orbit') {
        autoOrbit.speed = 0;
        return;
    }
    autoOrbit.speed += ((autoOrbit.active ? AUTO_ORBIT_SPEED : 0) - autoOrbit.speed) * (1 - Math.exp(-dt * 0.6));
    if (autoOrbit.speed < 0.01) return;
    controls._orbitController._targetRootPose.rotate(autoOrbitDelta.set(0, autoOrbit.speed * dt, 0));
};

// any input of the user's own on the view stops it
const stopAutoOrbit = () => {
    autoOrbit.active = false;
    autoOrbit.speed = 0;
};
canvas.addEventListener('pointerdown', stopAutoOrbit);
canvas.addEventListener('wheel', stopAutoOrbit, { passive: true });

// set once select exists, which they need to call
let close = () => {};
/** @type {(apartment: Apartment) => void} */
let pick = () => {};

// ------ The list of villas ------
const buildList = () => {
    const shown = apartments.filter((a) => a.visible);
    /** @type {HTMLElement} */ (left.querySelector('[data-count]')).textContent = `${shown.length} properties`;
    listView.innerHTML = shown
        .map(
            (a) => `
        <div class="row ${a.status}${a === selected ? ' selected' : ''}" data-id="${a.id}">
            <div class="thumb"></div>
            <div class="info">
                <div class="name">${a.tower}</div>
                <div class="meta">${a.layout.name} · ${a.layout.area} m²</div>
                ${a.status === 'available' ? `<div class="cost">${money(a.price)}</div>` : ''}
            </div>
            ${a.status === 'sold' ? '<span class="badge">Sold</span>' : ''}
        </div>`
        )
        .join('');
    listView.querySelectorAll('.row').forEach((row) => {
        const apartment = /** @type {Apartment} */ (
            apartments.find((a) => a.id === /** @type {HTMLElement} */ (row).dataset.id)
        );
        if (apartment.status !== 'available') return;
        row.addEventListener('click', () => pick(apartment));
        row.addEventListener('mouseenter', () => {
            listHovered = apartment;
        });
        row.addEventListener('mouseleave', () => {
            listHovered = null;
        });
    });
};

// ------ The details ------
// the panel is only shown while a villa is picked
const showOverview = () => {
    side.innerHTML = '';
    side.style.display = 'none';
};

const showDetails = (/** @type {Apartment} */ apartment) => {
    side.style.display = '';
    const { layout } = apartment;
    const rooms = Object.entries(ROOMS)
        .map(
            ([floor, list]) =>
                `<tr><th colspan="2">${floor}</th></tr>${list.map(([name, area]) => `<tr><td>${name}</td><td>${area} m²</td></tr>`).join('')}`
        )
        .join('');
    side.innerHTML = `
        <div class="fade">
            <span class="status"><i></i>Available</span>
            <div class="heading"><h1>${apartment.tower}</h1><div class="price">${money(apartment.price)}</div></div>
            <div class="sub">${layout.beds} bedrooms · 2 floors · ${layout.area} m²</div>
            <p>A modern two storey villa with an open plan living area, ${layout.beds} bedrooms and a private garden
            of ${apartment.plot} m², on a quiet lane with its own garage.</p>
            <div class="tiles">
                <div class="tile">${icon('bed')}<b>${layout.beds}</b><span>Bedrooms</span></div>
                <div class="tile">${icon('bath')}<b>2</b><span>Bathrooms</span></div>
                <div class="tile">${icon('floors')}<b>2</b><span>Floors</span></div>
                <div class="tile">${icon('area')}<b>${layout.area} m²</b><span>Total area</span></div>
                <div class="tile">${icon('garden')}<b>${apartment.plot} m²</b><span>Garden</span></div>
            </div>
            <div class="tabs-box">
                <div class="tabs">
                    <button class="active" data-tab="plan">Floor plan</button>
                    <button data-tab="rooms">Room sizes</button>
                    <button data-tab="specs">Specifications</button>
                </div>
                <div class="pane active" data-pane="plan">
                    <img class="plan-thumb" src="${PLAN_URL}" alt="Floor plan">
                    <div class="caption">Representative layout · click to enlarge</div>
                </div>
                <div class="pane" data-pane="rooms"><table>${rooms}</table></div>
                <div class="pane" data-pane="specs"><table>${SPECIFICATIONS.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table></div>
            </div>
            <div class="actions">
                <button class="secondary" data-action="back">‹ All villas</button>
                <button class="primary">Request a visit</button>
            </div>
        </div>`;

    side.querySelectorAll('[data-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            const name = /** @type {HTMLElement} */ (tab).dataset.tab;
            side.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === tab));
            side.querySelectorAll('[data-pane]').forEach((pane) => {
                pane.classList.toggle('active', /** @type {HTMLElement} */ (pane).dataset.pane === name);
            });
        });
    });
    side.querySelector('.plan-thumb')?.addEventListener('click', () => openPlan(apartment));
    side.querySelector('[data-action="back"]')?.addEventListener('click', () => close());
    side.scrollTop = 0;
};

const select = (/** @type {Apartment|null} */ apartment) => {
    selected = apartment;
    listHovered = null;
    if (apartment) {
        showDetails(apartment);
    } else {
        showOverview();
    }
    statsKey = '';
};

close = () => {
    if (!selected) return;
    stopAutoOrbit();
    select(null);
    flyHome();
};

// a villa picked in the scene or in the list is shown and flown to - after the camera controls have
// seen the click, which would otherwise switch them back to orbiting and cancel the flight
pick = (apartment) => {
    select(apartment);
    app.once('update', () => {
        focusOn(apartment);
        autoOrbit.active = true;
    });
};

canvas.addEventListener('click', (e) => {
    // a drag which moves the camera is not a click
    if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 4) return;
    if (hovered?.status === 'available') {
        pick(hovered);
    }
});
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (planOpen()) {
        closePlan();
    } else {
        close();
    }
});

showOverview();
flyHome();

// ------ Per frame ------
const ease = (/** @type {number} */ value, /** @type {number} */ target, /** @type {number} */ dt) =>
    value + (target - value) * (1 - Math.exp(-dt * 14));

const setStat = (/** @type {string} */ name, /** @type {string} */ value) => {
    const element = bar.querySelector(`[data-stat="${name}"]`);
    if (element) element.textContent = value;
};
let appliedOffset = NaN;

app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    layer.enabled = settings.show;

    // the size of a pixel at a distance of one unit, in the device pixels the depth is stored in
    const pixelSize = (2 * Math.tan((camera.camera.fov * Math.PI) / 360)) / device.height;

    // stand the skins off the facade
    if (settings.offset !== appliedOffset) {
        appliedOffset = settings.offset;
        for (let i = 0; i < apartments.length; i++) {
            apartments[i].pieces.forEach((piece) => layoutPiece(piece, settings.offset));
        }
    }

    // the filters
    let count = 0;
    let cheapest = Infinity;
    for (let i = 0; i < apartments.length; i++) {
        const a = apartments[i];
        a.visible =
            a.status === 'sold' ||
            ((settings.layout < 0 || a.layout.beds === settings.layout) && a.price <= settings.maxPrice * 1000);
        if (a.visible && a.status === 'available') {
            count++;
            cheapest = Math.min(cheapest, a.price);
        }
    }
    const key = `${count}:${cheapest}`;
    if (key !== statsKey) {
        statsKey = key;
        buildList();
        setStat('available', String(count));
        setStat('sold', String(apartments.filter((a) => a.status === 'sold').length));
        setStat('from', count ? money(cheapest) : '-');
    }
    if (selected && !selected.visible) select(null);
    updateFraming();
    recenter();
    updateAutoOrbit(dt);

    // pick, with a read of the depth of the pixel under the pointer every frame - the camera can
    // move while the pointer does not
    if (pointer.inside && settings.show) {
        const cam = camera.camera;
        cam.screenToWorld(pointer.x, pointer.y, cam.nearClip, rayStart);
        cam.screenToWorld(pointer.x, pointer.y, cam.farClip, rayEnd);
        rayDir.sub2(rayEnd, rayStart).normalize();
        const origin = camera.getPosition().clone();
        const dir = rayDir.clone();

        // the origin of the region is the bottom left
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        depthRect.set(pointer.x / w, 1 - (pointer.y + 1) / h, 1 / w, 1 / h);
        const forward = camera.forward.clone();
        depthReader.read(depthRect, 1, 1, depthSample)?.then(() => {
            // the point of the surface under the pointer - the depth is measured along the view direction,
            // not along the ray - and the villa whose volume holds it. Testing the ray against the volumes
            // instead would let the air above a villa in front take the pointer from one behind it.
            hovered = null;
            const distance = depthSample[0] / dir.dot(forward);
            if (!Number.isFinite(distance)) return;
            surface.copy(dir).mulScalar(distance).add(origin);
            // the volumes are a little larger than the roofs, to take in the eaves, so neighbours overlap -
            // the villa the point is the furthest inside of is the one under the pointer
            let deepest = 0;
            for (let i = 0; i < apartments.length; i++) {
                if (!apartments[i].visible) continue;
                for (const piece of apartments[i].pick) {
                    const inside = Math.min(
                        piece.half.x + 0.3 - Math.abs(surface.x - piece.center.x),
                        piece.half.y - Math.abs(surface.y - piece.center.y),
                        piece.half.z + 0.6 - Math.abs(surface.z - piece.center.z)
                    );
                    if (inside >= 0 && (!hovered || inside > deepest)) {
                        deepest = inside;
                        hovered = apartments[i];
                    }
                }
            }
        });
    } else if (!pointer.inside) {
        hovered = null;
    }

    // tooltip
    if (hovered && hovered !== selected) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${pointer.x + 16}px`;
        tooltip.style.top = `${pointer.y + 16}px`;
        tooltip.innerHTML =
            hovered.status === 'sold'
                ? `<b>${hovered.tower}</b><span class="muted">Sold</span>`
                : `<b>${hovered.villa ? hovered.tower : `Unit ${hovered.id}`}</b><span class="muted">${hovered.layout.name} · ${hovered.layout.area} m² · </span>${money(hovered.price)}`;
    } else {
        tooltip.style.display = 'none';
    }
    canvas.style.cursor = hovered?.status === 'available' ? 'pointer' : 'default';

    // the style of each apartment, eased so the highlights fade rather than snap
    for (let i = 0; i < apartments.length; i++) {
        const a = apartments[i];
        const show = settings.show && a.visible;
        a.pieces.forEach((piece) => {
            piece.entity.render.meshInstances[0].visible = show;
        });
        if (!show) continue;

        a.blend = ease(a.blend, a === (listHovered ?? hovered) ? 1 : 0, dt);
        a.select = ease(a.select, a === selected ? 1 : 0, dt);

        const { color, params } = a;
        params[2] = pixelSize;
        params[3] = CAPTURE.depthTolerance;

        // sold is greyed out, and under the pointer only greyer - more solid, with a bolder outline
        if (a.status === 'sold') {
            color.set(COLORS.sold);
            color[3] = Math.min(0.95, 0.35 + settings.fill * 1.2 + 0.25 * a.blend);
            params[0] = Math.min(1, 0.9 * settings.outline + 0.1 * a.blend);
            params[1] = 3 + 2 * a.blend;
            a.pieces.forEach((piece) => {
                const mi = piece.entity.render.meshInstances[0];
                mi.setParameter('uColor', color);
                mi.setParameter('uParams', params);
            });
            continue;
        }

        for (let c = 0; c < 3; c++) {
            const hover = COLORS.available[c] + (COLORS.hovered[c] - COLORS.available[c]) * a.blend;
            color[c] = hover + (COLORS.selected[c] - hover) * a.select;
        }
        const lit = Math.max(a.blend, a.select);
        // the picked villa fades out completely, so that nothing is in front of the house itself
        color[3] = (settings.fill + (1 - settings.fill) * 0.2 * a.blend) * (1 - a.select);
        params[0] = Math.min(1, settings.outline + 0.1 * lit) * (1 - a.select);
        params[1] = 4 + 3 * lit;
        a.pieces.forEach((piece) => {
            const mi = piece.entity.render.meshInstances[0];
            mi.setParameter('uColor', color);
            mi.setParameter('uParams', params);
        });
    }
});

// ------ Hold the loading screen until the capture is on screen ------
await new Promise((resolve) => {
    const timer = setTimeout(resolve, 60000);
    const onFrameReady = (
        /** @type {any} */ cam,
        /** @type {any} */ l,
        /** @type {boolean} */ ready,
        /** @type {number} */ loadingCount
    ) => {
        if (ready && loadingCount === 0) {
            app.systems.gsplat.off('frame:ready', onFrameReady);
            clearTimeout(timer);
            resolve();
        }
    };
    app.systems.gsplat.on('frame:ready', onFrameReady);
});

export { miniStats };
