// @config
//
// Visual cross-API test for render-target Y-orientation (RenderTarget.flipY and related systems).
// The left half of the grid must render identically on WebGL2 and WebGPU, the right half is
// expected to differ per API. Each tile label states the expectation for the active device.
//
// @flag HIDDEN

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CULLFACE_NONE,
    CUBEFACE_POSX,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FontHandler,
    Layer,
    PIXELFORMAT_RGBA8,
    PROJECTION_ORTHOGRAPHIC,
    RENDERTARGET_ORIGIN_BOTTOM,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ScreenComponentSystem,
    ShaderMaterial,
    ShaderUtils,
    StandardMaterial,
    Texture,
    TextureHandler,
    Vec4,
    createGraphicsDevice,
    drawQuadWithShader
} from 'playcanvas';

import { deviceType } from 'examples/context';

// Expected results. The 'upload' tile is the control - it validates the display path (each tile
// is a plane sampling its texture with standard mesh UVs), so any other tile that differs from it
// does so due to the producer path it exercises. Every tile label also states the expectation for
// the currently active device, so a single run is self-validating.
//
// LEFT GROUP - must render identically on WebGL2 and WebGPU:
//
// upload                    | upright (the control)
// camera RT origin top      | upright (origin: 'top' - image convention storage)
// camera RT origin bottom   | flipped (origin: 'bottom' - consistent WebGL-layout storage)
// cube face +X origin top   | upright (origin: 'top' on a cube face - cubemap-renderer idiom)
// quad copy engine quadVS   | upright (engine quadVS compensates per API via getImageEffectUV)
// rect blit flipY on        | cell at bottom (flipY keeps raw texel-row viewport rects)
// uv-space write wgpu flip  | upright (applies the UV1LAYOUT-style WebGPU flip)
// readback top RT           | yellow (identical storage makes readback coordinates portable)
//
// RIGHT GROUP - expected to differ between the APIs:
//
// upload flipY on           | WebGL2: flipped         | WebGPU: upright - flipY upload ignored
// camera RT default         | WebGL2: flipped         | WebGPU: upright - the default divergence
// quad copy raw uv          | WebGL2: upright         | WebGPU: flipped - raw uv quads invert
// rect blit flipY off       | WebGL2: cell at bottom  | WebGPU: cell at top - viewport conversion
// uv-space write raw        | WebGL2: upright         | WebGPU: flipped - needs the WebGPU flip
// readback default RT       | WebGL2: black           | WebGPU: yellow - rows follow storage

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    channels: new Asset('channels', 'texture', { url: './assets/textures/channels.png' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const isWebGPU = device.isWebGPU;
const RT_SIZE = 256;
const channelsTexture = /** @type {Texture} */ (assets.channels.resource);

// layers for the scenes rendered into textures, not rendered by the main camera
const rttLayer = new Layer({ name: 'RTTSource' });
const uvRawLayer = new Layer({ name: 'UVBakeRaw' });
const uvFixLayer = new Layer({ name: 'UVBakeFix' });
app.scene.layers.push(rttLayer);
app.scene.layers.push(uvRawLayer);
app.scene.layers.push(uvFixLayer);

// main camera - orthographic, showing the grid of result tiles (default layers)
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 6.6,
    clearColor: new Color(0.13, 0.13, 0.13)
});
camera.setLocalPosition(0, 0, 20);
app.root.addChild(camera);

/**
 * Creates a texture suitable as a render target color buffer.
 *
 * @param {string} name - The texture name.
 * @param {number} size - The texture size.
 * @param {boolean} [cubemap] - Whether to create a cubemap.
 * @returns {Texture} The created texture.
 */
const createRTTexture = (name, size, cubemap = false) => {
    return new Texture(device, {
        name: name,
        width: size,
        height: size,
        cubemap: cubemap,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
};

/**
 * Creates an emissive-only material displaying a texture.
 *
 * @param {Texture} texture - The texture to display.
 * @returns {StandardMaterial} The created material.
 */
const createTileMaterial = (texture) => {
    const material = new StandardMaterial();
    material.emissiveMap = texture;
    material.emissive = Color.WHITE;
    material.useLighting = false;
    material.update();
    return material;
};

/**
 * Creates a text label.
 *
 * @param {string} message - The text.
 * @param {number} x - The x position.
 * @param {number} y - The y position.
 * @param {number} [fontSize] - The font size.
 */
const createLabel = (message, x, y, fontSize = 0.22) => {
    const text = new Entity('Label');
    text.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        fontAsset: assets.font,
        fontSize: fontSize,
        pivot: [0.5, 0.5],
        text: message,
        type: ELEMENTTYPE_TEXT
    });
    text.setLocalPosition(x, y, 0);
    app.root.addChild(text);
};

/**
 * Adds a result tile (a plane displaying a material) with a label under it, at a grid position.
 *
 * @param {number} col - The grid column (0..3). Columns 0-1 are the 'must match across APIs'
 * group, columns 2-3 the 'expected to differ per API' group.
 * @param {number} row - The grid row (0..3).
 * @param {StandardMaterial|ShaderMaterial} material - The material to display.
 * @param {string} label - The label text.
 * @param {string} expect - The expected result on the currently active device.
 */
const addTile = (col, row, material, label, expect) => {
    // columns 0-1 form the left group, columns 2-3 the right group, with a gap between the groups
    const x = (col < 2 ? -3.4 : 3.4) + ((col % 2) - 0.5) * 2.7;
    const y = (1.5 - row) * 3.2 + 0.2;

    const tile = new Entity(`Tile-${label}`);
    tile.addComponent('render', { type: 'plane' });
    tile.render.material = material;
    tile.setLocalPosition(x, y, 0);
    tile.setLocalEulerAngles(90, 0, 0);
    tile.setLocalScale(2, 1, 2);
    app.root.addChild(tile);

    createLabel(`${label}\nexpect: ${expect}`, x, y - 1.4);
};

// ---------- source scene, rendered into textures by the camera RT tiles ----------

// channels plane with a yellow marker box in its top-left corner, far from the main grid
const srcMaterial = createTileMaterial(channelsTexture);
const srcPlane = new Entity('RTTSourcePlane');
srcPlane.addComponent('render', { type: 'plane', layers: [rttLayer.id] });
srcPlane.render.material = srcMaterial;
srcPlane.setLocalPosition(100, 0, 0);
srcPlane.setLocalEulerAngles(90, 0, 0);
srcPlane.setLocalScale(2, 1, 2);
app.root.addChild(srcPlane);

const markerMaterial = new StandardMaterial();
markerMaterial.emissive = new Color(1, 1, 0);
markerMaterial.useLighting = false;
markerMaterial.update();
const marker = new Entity('Marker');
marker.addComponent('render', { type: 'box', layers: [rttLayer.id] });
marker.render.material = markerMaterial;
marker.setLocalPosition(100 - 0.75, 0.75, 0.2);
marker.setLocalScale(0.2, 0.2, 0.05);
app.root.addChild(marker);

/**
 * Creates a camera rendering the source scene into a render target.
 *
 * @param {string} name - The camera name.
 * @param {RenderTarget} renderTarget - The render target to render into.
 * @param {boolean} [perspective] - Use perspective projection (for cube face rendering).
 */
const createRTCamera = (name, renderTarget, perspective = false) => {
    const rtCamera = new Entity(name);
    rtCamera.addComponent('camera', {
        layers: [rttLayer.id],
        priority: -1,
        clearColor: new Color(0.1, 0.1, 0.25),
        renderTarget: renderTarget,
        ...(perspective ? { fov: 90 } : { projection: PROJECTION_ORTHOGRAPHIC, orthoHeight: 1 })
    });
    rtCamera.setLocalPosition(100, 0, perspective ? 1 : 5);
    app.root.addChild(rtCamera);
};

// three camera render targets: default (native), origin top (flip on WebGL), origin bottom (flip on WebGPU)
const texNative = createRTTexture('RT-native', RT_SIZE);
const rtNative = new RenderTarget({ name: 'RT-native', colorBuffer: texNative, depth: true });
createRTCamera('CameraNative', rtNative);

const texTop = createRTTexture('RT-top', RT_SIZE);
const rtTop = new RenderTarget({ name: 'RT-top', colorBuffer: texTop, depth: true, origin: RENDERTARGET_ORIGIN_TOP });
createRTCamera('CameraTop', rtTop);

const texBottom = createRTTexture('RT-bottom', RT_SIZE);
const rtBottom = new RenderTarget({
    name: 'RT-bottom',
    colorBuffer: texBottom,
    depth: true,
    origin: RENDERTARGET_ORIGIN_BOTTOM
});
createRTCamera('CameraBottom', rtBottom);

// cube map +X face render target, using the origin-top idiom (matches scripts/utils/cubemap-renderer.js)
const texCube = createRTTexture('RT-cube', 128, true);
const rtCube = new RenderTarget({
    name: 'RT-cube',
    colorBuffer: texCube,
    face: CUBEFACE_POSX,
    depth: true,
    origin: RENDERTARGET_ORIGIN_TOP
});
createRTCamera('CameraCube', rtCube, true);

// ---------- quad copy targets ----------

const copyFragmentGLSL = /* glsl */ `
    uniform sampler2D uTex;
    varying vec2 uv0;
    void main(void) {
        gl_FragColor = texture2D(uTex, uv0);
    }
`;

const copyFragmentWGSL = /* wgsl */ `
    var uTex: texture_2d<f32>;
    var uTexSampler: sampler;
    varying uv0: vec2f;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = textureSample(uTex, uTexSampler, input.uv0);
        return output;
    }
`;

// raw fullscreen quad vertex shader - derives uv from position with no cross-API compensation,
// mirroring the engine internal 'fullscreenQuadVS' chunk convention
const rawQuadVertexGLSL = /* glsl */ `
    attribute vec2 aPosition;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(aPosition, 0.5, 1.0);
        uv0 = aPosition * 0.5 + 0.5;
    }
`;

const rawQuadVertexWGSL = /* wgsl */ `
    attribute aPosition: vec2f;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.aPosition, 0.5, 1.0);
        output.uv0 = input.aPosition * 0.5 + vec2f(0.5);
        return output;
    }
`;

const solidFragmentGLSL = /* glsl */ `
    void main(void) {
        gl_FragColor = vec4(0.1, 0.1, 0.25, 1.0);
    }
`;

const solidFragmentWGSL = /* wgsl */ `
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = vec4f(0.1, 0.1, 0.25, 1.0);
        return output;
    }
`;

// copy using the engine 'quadVS' chunk - its uv is compensated per-API by getImageEffectUV()
const shaderCopyEngine = ShaderUtils.createShader(device, {
    uniqueName: 'OrientationCopyEngineQuad',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexChunk: 'quadVS',
    fragmentGLSL: copyFragmentGLSL,
    fragmentWGSL: copyFragmentWGSL
});

// copy using a raw uv quad - no per-API compensation
const shaderCopyRaw = ShaderUtils.createShader(device, {
    uniqueName: 'OrientationCopyRawQuad',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexGLSL: rawQuadVertexGLSL,
    vertexWGSL: rawQuadVertexWGSL,
    fragmentGLSL: copyFragmentGLSL,
    fragmentWGSL: copyFragmentWGSL
});

const shaderSolid = ShaderUtils.createShader(device, {
    uniqueName: 'OrientationSolidQuad',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexGLSL: rawQuadVertexGLSL,
    vertexWGSL: rawQuadVertexWGSL,
    fragmentGLSL: solidFragmentGLSL,
    fragmentWGSL: solidFragmentWGSL
});

const texCopyEngine = createRTTexture('RT-copy-engine', RT_SIZE);
const rtCopyEngine = new RenderTarget({ name: 'RT-copy-engine', colorBuffer: texCopyEngine, depth: false });

const texCopyRaw = createRTTexture('RT-copy-raw', RT_SIZE);
const rtCopyRaw = new RenderTarget({ name: 'RT-copy-raw', colorBuffer: texCopyRaw, depth: false });

// ---------- viewport rect placement targets ----------

const texRectOff = createRTTexture('RT-rect-off', RT_SIZE);
const rtRectOff = new RenderTarget({ name: 'RT-rect-off', colorBuffer: texRectOff, depth: false });

const texRectOn = createRTTexture('RT-rect-on', RT_SIZE);
const rtRectOn = new RenderTarget({ name: 'RT-rect-on', colorBuffer: texRectOn, depth: false, flipY: true });

// blit destination rect in pixels - the same numbers on both render targets and both APIs
const blitRect = new Vec4(64, 128, 128, 128);

// ---------- uv-space write targets (paint-mesh / lightmapper style rendering) ----------

const uvWriteFragmentGLSL = /* glsl */ `
    uniform sampler2D uTexSrc;
    varying vec2 vUv0;
    void main(void) {
        gl_FragColor = texture2D(uTexSrc, vUv0);
    }
`;

const uvWriteFragmentWGSL = /* wgsl */ `
    var uTexSrc: texture_2d<f32>;
    var uTexSrcSampler: sampler;
    varying vUv0: vec2f;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = textureSample(uTexSrc, uTexSrcSampler, input.vUv0);
        return output;
    }
`;

/**
 * Creates a material which renders a mesh in its UV space, sampling the channels texture.
 *
 * @param {string} name - The unique shader name.
 * @param {boolean} webgpuFlip - Apply the Y-flip on WebGPU (like the engine UV1LAYOUT path does).
 * @returns {ShaderMaterial} The created material.
 */
const createUVWriteMaterial = (name, webgpuFlip) => {
    const material = new ShaderMaterial({
        uniqueName: name,
        attributes: { vertex_texCoord0: SEMANTIC_TEXCOORD0 },
        vertexGLSL: /* glsl */ `
            attribute vec2 vertex_texCoord0;
            varying vec2 vUv0;
            void main(void) {
                vUv0 = vertex_texCoord0;
                gl_Position = vec4(vertex_texCoord0 * 2.0 - 1.0, 0.5, 1.0);
            }
        `,
        vertexWGSL: /* wgsl */ `
            attribute vertex_texCoord0: vec2f;
            varying vUv0: vec2f;
            @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                output.vUv0 = input.vertex_texCoord0;
                var pos: vec2f = input.vertex_texCoord0 * 2.0 - vec2f(1.0);
                ${webgpuFlip ? 'pos.y = -pos.y;' : ''}
                output.position = vec4f(pos, 0.5, 1.0);
                return output;
            }
        `,
        fragmentGLSL: uvWriteFragmentGLSL,
        fragmentWGSL: uvWriteFragmentWGSL
    });
    material.cull = CULLFACE_NONE;
    material.setParameter('uTexSrc', channelsTexture);
    material.update();
    return material;
};

/**
 * Creates a plane rendered in UV space into a render target.
 *
 * @param {string} name - The name.
 * @param {Layer} layer - The layer to use.
 * @param {ShaderMaterial} material - The uv-space material.
 * @param {RenderTarget} renderTarget - The render target to render into.
 * @param {number} x - The world x position of this setup.
 */
const createUVWriteSetup = (name, layer, material, renderTarget, x) => {
    const plane = new Entity(`${name}-plane`);
    plane.addComponent('render', { type: 'plane', layers: [layer.id] });
    plane.render.material = material;
    plane.setLocalPosition(x, 0, 0);
    plane.setLocalEulerAngles(90, 0, 0);
    app.root.addChild(plane);

    const uvCamera = new Entity(`${name}-camera`);
    uvCamera.addComponent('camera', {
        layers: [layer.id],
        priority: -1,
        projection: PROJECTION_ORTHOGRAPHIC,
        orthoHeight: 2,
        clearColor: new Color(0.25, 0.1, 0.1),
        clearDepthBuffer: false,
        renderTarget: renderTarget
    });
    uvCamera.setLocalPosition(x, 0, 5);
    app.root.addChild(uvCamera);
};

const texUvRaw = createRTTexture('RT-uv-raw', RT_SIZE);
const rtUvRaw = new RenderTarget({ name: 'RT-uv-raw', colorBuffer: texUvRaw, depth: false });
createUVWriteSetup('UVRaw', uvRawLayer, createUVWriteMaterial('OrientationUVWriteRaw', false), rtUvRaw, 200);

const texUvFix = createRTTexture('RT-uv-fix', RT_SIZE);
const rtUvFix = new RenderTarget({ name: 'RT-uv-fix', colorBuffer: texUvFix, depth: false });
createUVWriteSetup('UVFix', uvFixLayer, createUVWriteMaterial('OrientationUVWriteFix', true), rtUvFix, 210);

// ---------- upload flipY tile ----------

// Create a texture from the same image, but with flipY enabled at upload time. The image is drawn
// into a 2d canvas first, as canvas is a valid upload source on both APIs, and unlike ImageBitmap
// (which the texture loader produces) it is affected by UNPACK_FLIP_Y_WEBGL on WebGL - note that
// Texture.flipY is a silent no-op for ImageBitmap sources on both APIs.
const srcImage = channelsTexture.getSource();
const srcCanvas = document.createElement('canvas');
srcCanvas.width = channelsTexture.width;
srcCanvas.height = channelsTexture.height;
srcCanvas.getContext('2d').drawImage(srcImage, 0, 0);
const texUploadFlip = new Texture(device, {
    name: 'upload-flipY',
    width: channelsTexture.width,
    height: channelsTexture.height,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    flipY: true
});
texUploadFlip.setSource(srcCanvas);

// ---------- cube face display material ----------

const cubeDisplayMaterial = new ShaderMaterial({
    uniqueName: 'OrientationCubeDisplay',
    attributes: { vertex_position: SEMANTIC_POSITION, vertex_texCoord0: SEMANTIC_TEXCOORD0 },
    vertexGLSL: /* glsl */ `
        attribute vec4 vertex_position;
        attribute vec2 vertex_texCoord0;
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
        varying vec2 vUv0;
        void main(void) {
            vUv0 = vertex_texCoord0;
            gl_Position = matrix_viewProjection * matrix_model * vertex_position;
        }
    `,
    vertexWGSL: /* wgsl */ `
        attribute vertex_position: vec4f;
        attribute vertex_texCoord0: vec2f;
        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;
        varying vUv0: vec2f;
        @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.vUv0 = input.vertex_texCoord0;
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * input.vertex_position;
            return output;
        }
    `,
    // display the +X cube face using the standard cube face st mapping (s ~ -z, t ~ -y),
    // which is identical between the APIs, making this a valid cross-API comparison
    fragmentGLSL: /* glsl */ `
        uniform samplerCube uCube;
        varying vec2 vUv0;
        void main(void) {
            vec2 st = vUv0 * 2.0 - 1.0;
            gl_FragColor = textureCube(uCube, vec3(1.0, -st.y, -st.x));
        }
    `,
    fragmentWGSL: /* wgsl */ `
        var uCube: texture_cube<f32>;
        var uCubeSampler: sampler;
        varying vUv0: vec2f;
        @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            let st: vec2f = input.vUv0 * 2.0 - vec2f(1.0);
            output.color = textureSample(uCube, uCubeSampler, vec3f(1.0, -st.y, -st.x));
            return output;
        }
    `
});
cubeDisplayMaterial.setParameter('uCube', texCube);
cubeDisplayMaterial.update();

// ---------- readback tiles ----------

const readbackNativeMaterial = new StandardMaterial();
readbackNativeMaterial.useLighting = false;
readbackNativeMaterial.update();

const readbackTopMaterial = new StandardMaterial();
readbackTopMaterial.useLighting = false;
readbackTopMaterial.update();

/**
 * Reads a pixel from a render target texture and displays it as the material color.
 *
 * @param {Texture} texture - The texture to read.
 * @param {RenderTarget} renderTarget - The render target the texture belongs to.
 * @param {StandardMaterial} material - The material to update with the read color.
 */
const readbackPixel = async (texture, renderTarget, material) => {
    try {
        // texel (32, 32) is where the yellow marker lands when the stored image has top-left origin
        const data = await texture.read(32, 32, 1, 1, { renderTarget: renderTarget, immediate: true });
        material.emissive.set(data[0] / 255, data[1] / 255, data[2] / 255);
        material.update();
    } catch (err) {
        console.error('readback failed', err);
    }
};

// ---------- the grid of result tiles ----------

// group headers
createLabel('MUST MATCH ACROSS WEBGL2 / WEBGPU', -3.4, 6.3, 0.26);
createLabel('EXPECTED TO DIFFER PER API', 3.4, 6.3, 0.26);

// left group (columns 0-1) - these must render identically on both APIs
addTile(0, 0, createTileMaterial(channelsTexture), 'upload', 'upright');
addTile(1, 0, createTileMaterial(texTop), 'camera RT origin top', 'upright');
addTile(0, 1, createTileMaterial(texBottom), 'camera RT origin bottom', 'flipped');
addTile(1, 1, cubeDisplayMaterial, 'cube face +X origin top', 'upright');
addTile(0, 2, createTileMaterial(texCopyEngine), 'quad copy engine quadVS', 'upright');
addTile(1, 2, createTileMaterial(texRectOn), 'rect blit flipY on', 'cell at bottom');
addTile(0, 3, createTileMaterial(texUvFix), 'uv-space write wgpu flip', 'upright');
addTile(1, 3, readbackTopMaterial, 'readback top RT', 'yellow');

// right group (columns 2-3) - these are expected to differ between the APIs,
// each label states the expectation for the currently active device
addTile(2, 0, createTileMaterial(texUploadFlip), 'upload flipY on', isWebGPU ? 'upright (flipY ignored)' : 'flipped');
addTile(3, 0, createTileMaterial(texNative), 'camera RT default', isWebGPU ? 'upright' : 'flipped');
addTile(2, 1, createTileMaterial(texCopyRaw), 'quad copy raw uv', isWebGPU ? 'flipped' : 'upright');
addTile(3, 1, createTileMaterial(texRectOff), 'rect blit flipY off', isWebGPU ? 'cell at top' : 'cell at bottom');
addTile(2, 2, createTileMaterial(texUvRaw), 'uv-space write raw', isWebGPU ? 'flipped' : 'upright');
addTile(3, 2, readbackNativeMaterial, 'readback default RT', isWebGPU ? 'yellow' : 'black');

// ---------- per-frame work ----------

const uTex = device.scope.resolve('uTex');
let frame = 0;

app.on('update', () => {
    frame++;

    // quad copies of the origin-top camera RT (uses the previous frame content - scene is static)
    uTex.setValue(texTop);
    drawQuadWithShader(device, rtCopyEngine, shaderCopyEngine);
    drawQuadWithShader(device, rtCopyRaw, shaderCopyRaw);

    // rect blits - clear to a solid color, then blit channels texture into the same pixel rect
    uTex.setValue(channelsTexture);
    drawQuadWithShader(device, rtRectOff, shaderSolid, undefined);
    uTex.setValue(channelsTexture);
    drawQuadWithShader(device, rtRectOff, shaderCopyEngine, blitRect);
    drawQuadWithShader(device, rtRectOn, shaderSolid, undefined);
    uTex.setValue(channelsTexture);
    drawQuadWithShader(device, rtRectOn, shaderCopyEngine, blitRect);

    // one-time readback of the same texel coordinates from the default and the origin-top RTs
    if (frame === 5) {
        readbackPixel(texNative, rtNative, readbackNativeMaterial);
        readbackPixel(texTop, rtTop, readbackTopMaterial);
    }
});
