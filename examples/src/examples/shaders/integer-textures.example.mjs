// @config
//
// `Click` Add sand · `Shift-click` Remove sand · `Space` Reset

import {
    ADDRESS_CLAMP_TO_EDGE,
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    KEY_1,
    KEY_2,
    KEY_3,
    KEY_4,
    KEY_SHIFT,
    KEY_SPACE,
    Keyboard,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_RIGHT,
    Mouse,
    PIXELFORMAT_R8U,
    PIXELFORMAT_RGBA8,
    Plane,
    RESOLUTION_AUTO,
    Ray,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_POSITION,
    ShaderUtils,
    TEXTURETYPE_RGBP,
    Texture,
    TextureHandler,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    drawQuadWithShader
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import renderOutputGlslFrag from './renderOutput.glsl.frag';
import renderOutputWgslFrag from './renderOutput.wgsl.frag';
import sandSimulationGlslFrag from './sandSimulation.glsl.frag';
import sandSimulationWgslFrag from './sandSimulation.wgsl.frag';

/**
 * @import { StandardMaterial } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

//
//  In this example, integer textures are used to store the state of each pixel in a simulation.
//  The simulation is run in a shader, and the results are rendered to a texture.
//
//  Integer textures can be useful for "compute-like" use cases, where you want to store
//  arbitrary data in each pixel, and then use a shader to process the data.
//
//  This example uses integer textures instead of floats in order to store
//  multiple properties (element, shade, movedThisFrame) in the bits of each pixel.
//

const STEPS_PER_FRAME = 4;
const PLANE_WIDTH = 10;
const PLANE_HEIGHT = 10;

const TEXTURE_RATIO = PLANE_WIDTH / PLANE_HEIGHT;
const TEXTURE_HEIGHT = 512;
const TEXTURE_WIDTH = TEXTURE_HEIGHT * TEXTURE_RATIO;

// set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [
    // @ts-ignore
    TextureHandler
];

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

// Helpers to create integer pixel buffers and render targets which we will ping-pong between
const createPixelColorBuffer = (i) => {
    return new Texture(device, {
        name: `PixelBuffer_${i}`,
        width: TEXTURE_WIDTH,
        height: TEXTURE_HEIGHT,
        mipmaps: false,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,

        // Note that we are using an unsigned integer format here.
        // This can be helpful for storing bitfields in each pixel.
        // In this example, we are storing 3 different properties
        // in a single Uint8 value.
        format: PIXELFORMAT_R8U
    });
};
const createPixelRenderTarget = (i, colorBuffer) => {
    return new RenderTarget({
        name: `PixelRenderTarget_${i}`,
        colorBuffer: colorBuffer
    });
};

// Create our integer pixel buffers and render targets
const pixelColorBuffers = [];
const pixelRenderTargets = [];
pixelColorBuffers.push(createPixelColorBuffer(0), createPixelColorBuffer(1));
pixelRenderTargets.push(createPixelRenderTarget(0, pixelColorBuffers[0]));
pixelRenderTargets.push(createPixelRenderTarget(1, pixelColorBuffers[1]));

const sourceTexture = pixelColorBuffers[0];
const sourceRenderTarget = pixelRenderTargets[0];
const sandRenderTarget = pixelRenderTargets[1];

// Create an output texture and render target to render
// a visual representation of the simulation
const outputTexture = new Texture(device, {
    name: 'OutputTexture',
    width: TEXTURE_WIDTH,
    height: TEXTURE_HEIGHT,
    mipmaps: false,
    format: PIXELFORMAT_RGBA8,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT
});
const outputRenderTarget = createPixelRenderTarget(2, outputTexture);
// This is shader runs the sand simulation
// It uses integer textures to store the state of each pixel
const sandShader = ShaderUtils.createShader(device, {
    uniqueName: 'SandShader',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexChunk: 'quadVS',
    fragmentGLSL: sandSimulationGlslFrag,
    fragmentWGSL: sandSimulationWgslFrag,
    // Note that we are changing the shader output type to 'uint'
    // This means we only have to return a single integer value from the shader,
    // whereas the default is to return a vec4. This option allows you to pass
    // an array of types to specify the output type for each color attachment.
    // Unspecified types are assumed to be 'vec4'.
    fragmentOutputTypes: ['uint']
});

// This shader reads the integer textures
// and renders a visual representation of the simulation
const outputShader = ShaderUtils.createShader(device, {
    uniqueName: 'RenderOutputShader',
    attributes: { aPosition: SEMANTIC_POSITION },
    vertexChunk: 'quadVS',
    fragmentGLSL: renderOutputGlslFrag,
    fragmentWGSL: renderOutputWgslFrag
    // For the output shader, we don't need to specify the output type,
    // as we are returning a vec4 by default.
});

// Write the initial simulation state to the integer texture
const resetData = () => {
    // Loop through the pixels in the texture
    // and initialize them to either AIR, SAND or WALL
    const sourceTextureData = sourceTexture.lock();
    for (let x = 0; x < sourceTexture.width; x++) {
        for (let y = 0; y < sourceTexture.height; y++) {
            const i = y * sourceTexture.width + x;

            const isDefaultWall =
                x > sourceTexture.width * 0.3 &&
                x < sourceTexture.width * 0.7 &&
                y > sourceTexture.height * 0.7 &&
                y < sourceTexture.height * 0.8;

            if (isDefaultWall) {
                // Create the default wall in the middle of the screen
                // The WALL element is used to mark pixels that should not be moved
                // It uses the integer '4' (see sandCommon.frag)
                sourceTextureData[i] = 4;
            } else if (Math.random() > 0.94) {
                // Sprinkle some sand randomly around the scene
                // The SAND element is used to mark pixels that fall like sand
                // It uses the integer '1' (see sandCommon.frag)
                sourceTextureData[i] = 1;
                // The shade of each pixel is stored in the upper 4 bits of the integer
                // Here we write a random value to the shade bits
                sourceTextureData[i] |= Math.floor(Math.random() * 15) << 4;
            } else {
                // The AIR element is used to mark pixels that are empty
                // Other than the wall and sand, all pixels are initialized to AIR
                sourceTextureData[i] = 0;
            }
        }
    }
    sourceTexture.unlock();
};

resetData();
data.on('reset', resetData);

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

data.set('options', {
    brush: 1,
    brushSize: 8
});

app.start();

// setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 1;

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    farClip: 500
});

// add camera to the world
cameraEntity.setPosition(0, 5, 15);
cameraEntity.lookAt(0, 5, 0);
app.root.addChild(cameraEntity);

// create a plane called gameScreen to display the sand
// simulation visualization texture
const gameScreen = new Entity();
gameScreen.addComponent('render', {
    type: 'plane',
    castShadows: false,
    receiveShadows: false
});
gameScreen.setLocalPosition(0, 5, 0);
gameScreen.setLocalScale(PLANE_WIDTH, 1, PLANE_HEIGHT);
gameScreen.setEulerAngles(90, 0, 0);

/** @type {StandardMaterial} */
const gameScreenMaterial = gameScreen.render.material;
gameScreenMaterial.diffuse = Color.BLACK;
gameScreenMaterial.emissiveMap = outputTexture;
gameScreenMaterial.emissive = Color.WHITE;
gameScreenMaterial.useLighting = false;
gameScreenMaterial.update();
app.root.addChild(gameScreen);

// Create a matching plane for mouse picking
const gamePlane = new Plane(new Vec3(0, 0, 1), 0);

// Setup mouse controls
const mouse = new Mouse(document.body);
const keyboard = new Keyboard(document.body);

mouse.disableContextMenu();

// Reset on space bar, select brush on 1-4
keyboard.on(
    'keyup',
    (event) => {
        switch (event.key) {
            case KEY_SPACE:
                resetData();
                break;
            case KEY_1:
                data.set('options.brush', 1);
                break;
            case KEY_2:
                data.set('options.brush', 2);
                break;
            case KEY_3:
                data.set('options.brush', 3);
                break;
            case KEY_4:
                data.set('options.brush', 4);
                break;
        }
    },
    this
);

let mouseState = 0;
mouse.on('mousedown', (event) => {
    if (event.button === MOUSEBUTTON_LEFT) {
        if (keyboard.isPressed(KEY_SHIFT)) {
            mouseState = 2;
        } else {
            mouseState = 1;
        }
    } else if (event.button === MOUSEBUTTON_RIGHT) {
        mouseState = 2;
    }
});
mouse.on('mouseup', () => {
    mouseState = 0;
});

const mouseRay = new Ray();
const planePoint = new Vec3();
const mousePos = new Vec2();
const mouseUniform = new Float32Array(2);
mouse.on('mousemove', (event) => {
    const x = event.x;
    const y = event.y;

    mousePos.x = x;
    mousePos.y = y;

    if (cameraEntity.camera) {
        cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip, mouseRay.direction);
        mouseRay.origin.copy(cameraEntity.getPosition());
        mouseRay.direction.sub(mouseRay.origin).normalize();
        gamePlane.intersectsRay(mouseRay, planePoint);
        planePoint.x = PLANE_WIDTH / 2 + planePoint.x;
        planePoint.y = PLANE_HEIGHT - planePoint.y;
        mousePos.set(planePoint.x / PLANE_WIDTH, planePoint.y / PLANE_HEIGHT);
    }
});

let passNum = 0;
app.on('update', (/** @type {number} */) => {
    mouseUniform[0] = mousePos.x;
    mouseUniform[1] = mousePos.y;

    const brushRadius = data.get('options.brushSize') / Math.max(TEXTURE_WIDTH, TEXTURE_HEIGHT);
    const brush = data.get('options.brush') ?? 1;

    // Run the sand simulation shader
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        device.scope.resolve('sourceTexture').setValue(sourceTexture);
        device.scope.resolve('mousePosition').setValue(mouseUniform);
        device.scope.resolve('mouseButton').setValue(mouseState);
        device.scope.resolve('brush').setValue(brush);
        device.scope.resolve('brushRadius').setValue(brushRadius);
        device.scope.resolve('passNum').setValue(passNum);
        device.scope.resolve('randomVal').setValue(Math.random());
        drawQuadWithShader(device, sandRenderTarget, sandShader);
        device.copyRenderTarget(sandRenderTarget, sourceRenderTarget, true, false);
        passNum = (passNum + 1) % 16;
    }

    // Render a visual representation of the simulation
    device.scope.resolve('sourceTexture').setValue(sandRenderTarget.colorBuffer);
    device.scope.resolve('mousePosition').setValue(mouseUniform);
    device.scope.resolve('brushRadius').setValue(brushRadius);
    drawQuadWithShader(device, outputRenderTarget, outputShader);
});
