// @config
//
// Demonstrates independent blending, where each color attachment of a render target uses its own
// blend state and color write mask, specified using BlendState#setAttachment.
//
// A dark grey base quad is rendered into both attachments of an MRT, and a semi-transparent light
// grey overlay quad is then blended on top of it. Attachment 0 uses alpha blending and writes all
// channels, so its overlay stays grey. Attachment 1 uses additive blending and writes the red channel
// only, so its overlay turns red. Both attachments are then displayed side by side - left is
// attachment 0, right is attachment 1.
//
// The example also demonstrates per-attachment clear colors, specified using
// RenderPass#setClearColor with an attachment index - a standalone clear-only render pass clears
// attachment 0 to dark blue and attachment 1 to dark green, visible as the border around each
// panel, and the camera renders on top without clearing.
//
// Additionally, an unsigned integer format render target is cleared to a marker value, verifying
// the clear support of integer formats. The small indicator panel below the two attachments
// samples it and shows green when it contains the expected value, and red otherwise.
//
// When the device does not support independent blending (the OES_draw_buffers_indexed extension is
// unavailable on WebGL2), the blend state of attachment 0 is used for all attachments and the two
// halves render identically.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA,
    BlendState,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    Layer,
    PIXELFORMAT_R32U,
    PIXELFORMAT_RGBA8,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPass,
    RenderTarget,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ShaderMaterial,
    StandardMaterial,
    Texture,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const appOptions = new AppOptions();
appOptions.graphicsDevice = device;
appOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];

const app = new AppBase(canvas);
app.init(appOptions);

app.start();

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// ------ Multiple render target with two color attachments ------

const createAttachment = (name) => {
    return new Texture(device, {
        name: name,
        width: 512,
        height: 512,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST
    });
};

const attachment0 = createAttachment('attachment0');
const attachment1 = createAttachment('attachment1');

const renderTarget = new RenderTarget({
    name: 'MRT',
    colorBuffers: [attachment0, attachment1],
    depth: true
});

app.on('destroy', () => {
    renderTarget.destroyTextureBuffers();
    renderTarget.destroy();
});

// ------ Scene rendered into the MRT ------

// the quads rendered into the MRT are on their own layer, so that the camera rendering them does not
// also pick up the quads which display the results
const offscreenLayer = new Layer({ name: 'Offscreen' });
app.scene.layers.push(offscreenLayer);

// Writes the same color to both attachments. Any material rendering into the MRT needs to write all
// of its attachments, as the content of an attachment the shader does not write is undefined.
const createWritingMaterial = (r, g, b, a) => {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.useTonemap = false;
    material.cull = CULLFACE_NONE;
    material.getShaderChunks(SHADERLANGUAGE_GLSL).set(
        'outputPS',
        /* glsl */ `
        gl_FragColor = vec4(${r}, ${g}, ${b}, ${a});
        pcFragColor1 = vec4(${r}, ${g}, ${b}, ${a});
    `
    );
    material.getShaderChunks(SHADERLANGUAGE_WGSL).set(
        'outputPS',
        /* wgsl */ `
        output.color = vec4f(${r}, ${g}, ${b}, ${a});
        output.color1 = vec4f(${r}, ${g}, ${b}, ${a});
    `
    );
    return material;
};

// opaque grey base, identical in both attachments
const baseMaterial = createWritingMaterial(0.25, 0.25, 0.25, 1.0);
baseMaterial.update();

const base = new Entity('Base');
base.addComponent('render', {
    type: 'plane',
    material: baseMaterial,
    layers: [offscreenLayer.id]
});
base.setLocalEulerAngles(90, 0, 0);
base.setLocalScale(1.8, 1, 1.8);
app.root.addChild(base);

// semi-transparent light grey overlay, blended differently into each attachment. A neutral color
// makes the color write mask obvious - the attachment which only writes red turns the overlay red.
const overlayMaterial = createWritingMaterial(0.6, 0.6, 0.6, 0.5);

// attachment 0 - regular alpha blending, writing all channels: 0.5 * 0.6 + 0.5 * 0.25 = grey 0.425
const blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA);

// attachment 1 - additive blending, writing the red channel only: red 0.6 + 0.25 = 0.85, green and
// blue left at the base 0.25
const attachment1State = new BlendState(
    true,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ONE,
    undefined,
    undefined,
    undefined,
    true,
    false,
    false,
    false
);
blendState.setAttachment(1, attachment1State);

overlayMaterial.blendState = blendState;
overlayMaterial.depthWrite = false;
overlayMaterial.update();

const overlay = new Entity('Overlay');
overlay.addComponent('render', {
    type: 'plane',
    material: overlayMaterial,
    layers: [offscreenLayer.id]
});
overlay.setLocalPosition(0, 0, 0.01);
overlay.setLocalEulerAngles(90, 0, 0);
overlay.setLocalScale(1.2, 1, 1.2);
app.root.addChild(overlay);

// The attachments are cleared by a standalone clear-only render pass, using a different clear
// color per attachment, specified using the attachment index of setClearColor. The clear colors
// stay visible as the border around each panel, as the quads do not cover the full attachment.
const clearPass = new RenderPass(device);
clearPass.name = 'PerAttachmentClear';
clearPass.init(renderTarget);
clearPass.setClearColor(new Color(0, 0, 0.25, 1), 0);
clearPass.setClearColor(new Color(0, 0.25, 0, 1), 1);

// ------ Clear of an unsigned integer format render target ------

// the expected marker value the indicator panel tests for
const UINT_CLEAR_VALUE = 12648430;

const uintTexture = new Texture(device, {
    name: 'uintClear',
    width: 4,
    height: 4,
    format: PIXELFORMAT_R32U,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST
});

const uintRenderTarget = new RenderTarget({
    name: 'UintRT',
    colorBuffer: uintTexture,
    depth: false
});

app.on('destroy', () => {
    uintRenderTarget.destroyTextureBuffers();
    uintRenderTarget.destroy();
});

// a clear-only render pass storing the marker value in the texture. For integer formats, the
// clear color components are the raw integer values.
const uintClearPass = new RenderPass(device);
uintClearPass.name = 'UintClear';
uintClearPass.init(uintRenderTarget);
uintClearPass.setClearColor(new Color(UINT_CLEAR_VALUE, 0, 0, 0));

// execute the clears before the cameras render each frame
app.on('prerender', () => {
    clearPass.render();
    uintClearPass.render();
});

// The camera renders on top of the cleared attachments, without clearing the color itself. It
// renders before the main camera, so that the displayed attachments contain this frame's result.
const offscreenCamera = new Entity('Offscreen Camera');
offscreenCamera.addComponent('camera', {
    clearColorBuffer: false,
    priority: -1,
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1,
    layers: [offscreenLayer.id],
    renderTarget: renderTarget
});
offscreenCamera.setLocalPosition(0, 0, 5);
app.root.addChild(offscreenCamera);

// ------ Display of both attachments, side by side ------

const worldLayer = app.scene.layers.getLayerByName('World');

// the two panels are laid out side by side in world space, and the camera is then fitted around them
const PANEL_SIZE = 1.6;
const PANEL_GAP = 0.1;
const PANEL_X = (PANEL_SIZE + PANEL_GAP) * 0.5;

const createDisplay = (name, texture, x) => {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.useTonemap = false;
    material.emissive = Color.WHITE;
    material.emissiveMap = texture;
    material.cull = CULLFACE_NONE;
    material.update();

    const entity = new Entity(name);
    entity.addComponent('render', {
        type: 'plane',
        material: material,
        layers: [worldLayer.id]
    });
    entity.setLocalPosition(x, 0, 0);
    entity.setLocalEulerAngles(90, 0, 0);
    entity.setLocalScale(PANEL_SIZE, 1, PANEL_SIZE);
    app.root.addChild(entity);
};

// left: attachment 0, right: attachment 1
createDisplay('Display 0', attachment0, -PANEL_X);
createDisplay('Display 1', attachment1, PANEL_X);

// ------ Indicator panel testing the integer clear value ------

// the indicator sits below the two panels
const INDICATOR_SIZE = 0.25;
const INDICATOR_Y = -(PANEL_SIZE + INDICATOR_SIZE) * 0.5 - 0.1;

// samples the unsigned integer texture and shows green when it contains the expected clear value
const uintMaterial = new ShaderMaterial({
    uniqueName: 'UintClearIndicator',
    vertexGLSL: /* glsl */ `
        attribute vec4 aPosition;
        attribute vec2 aUv0;
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
        varying vec2 vUv0;
        void main() {
            vUv0 = aUv0;
            gl_Position = matrix_viewProjection * matrix_model * aPosition;
        }
    `,
    fragmentGLSL: /* glsl */ `
        varying vec2 vUv0;
        uniform highp usampler2D uintMap;
        void main() {
            uint value = texture(uintMap, vUv0).r;
            gl_FragColor = value == ${UINT_CLEAR_VALUE}u ? vec4(0.2, 0.55, 0.25, 1.0) : vec4(0.7, 0.15, 0.15, 1.0);
        }
    `,
    vertexWGSL: /* wgsl */ `
        attribute aPosition: vec4f;
        attribute aUv0: vec2f;
        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;
        varying vUv0: vec2f;
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * input.aPosition;
            output.vUv0 = input.aUv0;
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */ `
        varying vUv0: vec2f;
        var uintMap: texture_2d<u32>;
        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            let dims = vec2i(textureDimensions(uintMap));
            let coords = min(vec2i(input.vUv0 * vec2f(dims)), dims - vec2i(1));
            let value = textureLoad(uintMap, coords, 0).r;
            output.color = select(vec4f(0.7, 0.15, 0.15, 1.0), vec4f(0.2, 0.55, 0.25, 1.0), value == ${UINT_CLEAR_VALUE}u);
            return output;
        }
    `,
    attributes: {
        aPosition: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0
    }
});
uintMaterial.setParameter('uintMap', uintTexture);
uintMaterial.cull = CULLFACE_NONE;
uintMaterial.update();

const indicator = new Entity('Uint Clear Indicator');
indicator.addComponent('render', {
    type: 'plane',
    material: uintMaterial,
    layers: [worldLayer.id]
});
indicator.setLocalPosition(0, INDICATOR_Y, 0);
indicator.setLocalEulerAngles(90, 0, 0);
indicator.setLocalScale(INDICATOR_SIZE, 1, INDICATOR_SIZE);
app.root.addChild(indicator);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.02, 0.02),
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1,
    layers: [worldLayer.id]
});
camera.setLocalPosition(0, 0, 5);
app.root.addChild(camera);

// Keep the panels and the indicator fully visible at any canvas aspect ratio. An orthographic
// camera sees a 2 * orthoHeight tall and 2 * orthoHeight * aspect wide area, so the height is
// chosen as whichever of the two constraints is tighter, with a small margin around the content.
const contentWidth = PANEL_SIZE * 2 + PANEL_GAP;
const contentHalfHeight = -INDICATOR_Y + INDICATOR_SIZE * 0.5;
const MARGIN = 1.06;

const fitCamera = () => {
    const aspect = device.width / device.height;
    camera.camera.orthoHeight = Math.max(contentWidth / (2 * aspect), contentHalfHeight) * MARGIN;
};

fitCamera();
app.on('update', fitCamera);
