// @config DESCRIPTION <ul><li>Click to add sand<li>Shift-click to remove sand<li>Press space to reset.</ul>
import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

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
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [
    // @ts-ignore
    pc.TextureHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Helpers to create integer pixel buffers and render targets which we will ping-pong between
const createPixelColorBuffer = (i) => {
    return new pc.Texture(device, {
        name: `PixelBuffer_${i}`,
        width: TEXTURE_WIDTH,
        height: TEXTURE_HEIGHT,
        // Note that we are using an unsigned integer format here.
        // This can be helpful for storing bitfields in each pixel.
        // In this example, we are storing 3 different properties
        // in a single Uint8 value.
        format: pc.PIXELFORMAT_R8U,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
};
const createPixelRenderTarget = (i, colorBuffer) => {
    return new pc.RenderTarget({
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
const outputTexture = new pc.Texture(device, {
    name: 'OutputTexture',
    width: TEXTURE_WIDTH,
    height: TEXTURE_HEIGHT,
    format: pc.PIXELFORMAT_RGBA8,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT
});
const outputRenderTarget = createPixelRenderTarget(2, outputTexture);

// This is shader runs the sand simulation
// It uses integer textures to store the state of each pixel
const sandShader = pc.createShaderFromCode(
    device,
    pc.RenderPassShaderQuad.quadVertexShader,
    files['sandSimulation.frag'],
    'SandShader',
    { aPosition: pc.SEMANTIC_POSITION },
    // Note that we are changing the shader output type to 'uint'
    // This means we only have to return a single integer value from the shader,
    // whereas the default is to return a vec4. This option allows you to pass
    // an array of types to specify the output type for each color attachment.
    // Unspecified types are assumed to be 'vec4'.
    { fragmentOutputTypes: ['uint'] }
);

// This shader reads the integer textures
// and renders a visual representation of the simulation
const outputShader = pc.createShaderFromCode(
    device,
    pc.RenderPassShaderQuad.quadVertexShader,
    files['renderOutput.frag'],
    'RenderOutputShader',
    { aPosition: pc.SEMANTIC_POSITION }
    // For the output shader, we don't need to specify the output type,
    // as we are returning a vec4 by default.
);

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
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
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        farClip: 500
    });

    // add camera to the world
    cameraEntity.setPosition(0, 5, 15);
    cameraEntity.lookAt(0, 5, 0);
    app.root.addChild(cameraEntity);

    // create a plane called gameScreen to display the sand
    // simulation visualization texture
    const gameScreen = new pc.Entity();
    gameScreen.addComponent('render', {
        type: 'plane',
        castShadows: false,
        receiveShadows: false
    });
    gameScreen.setLocalPosition(0, 5, 0);
    gameScreen.setLocalScale(PLANE_WIDTH, 1, PLANE_HEIGHT);
    gameScreen.setEulerAngles(90, 0, 0);

    /** @type {pc.StandardMaterial} */
    const gameScreenMaterial = gameScreen.render.material;
    gameScreenMaterial.diffuse = pc.Color.BLACK;
    gameScreenMaterial.emissiveMap = outputTexture;
    gameScreenMaterial.useLighting = false;
    gameScreenMaterial.update();
    app.root.addChild(gameScreen);

    // Create a matching plane for mouse picking
    const gamePlane = new pc.Plane(new pc.Vec3(0, 0, 1), 0);

    // Setup mouse controls
    const mouse = new pc.Mouse(document.body);
    const keyboard = new pc.Keyboard(document.body);

    mouse.disableContextMenu();

    // Reset on space bar, select brush on 1-4
    keyboard.on(
        pc.EVENT_KEYUP,
        (event) => {
            switch (event.key) {
                case pc.KEY_SPACE:
                    resetData();
                    break;
                case pc.KEY_1:
                    data.set('options.brush', 1);
                    break;
                case pc.KEY_2:
                    data.set('options.brush', 2);
                    break;
                case pc.KEY_3:
                    data.set('options.brush', 3);
                    break;
                case pc.KEY_4:
                    data.set('options.brush', 4);
                    break;
            }
        },
        this
    );

    let mouseState = 0;
    mouse.on(pc.EVENT_MOUSEDOWN, function (event) {
        if (event.button === pc.MOUSEBUTTON_LEFT) {
            if (keyboard.isPressed(pc.KEY_SHIFT)) {
                mouseState = 2;
            } else {
                mouseState = 1;
            }
        } else if (event.button === pc.MOUSEBUTTON_RIGHT) {
            mouseState = 2;
        }
    });
    mouse.on(pc.EVENT_MOUSEUP, function () {
        mouseState = 0;
    });

    const mouseRay = new pc.Ray();
    const planePoint = new pc.Vec3();
    const mousePos = new pc.Vec2();
    const mouseUniform = new Float32Array(2);
    mouse.on(pc.EVENT_MOUSEMOVE, function (event) {
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
    app.on('update', function (/** @type {number} */) {
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
            pc.drawQuadWithShader(device, sandRenderTarget, sandShader);
            device.copyRenderTarget(sandRenderTarget, sourceRenderTarget, true, false);
            passNum = (passNum + 1) % 16;
        }

        // Render a visual representation of the simulation
        device.scope.resolve('sourceTexture').setValue(sandRenderTarget.colorBuffer);
        device.scope.resolve('mousePosition').setValue(mouseUniform);
        device.scope.resolve('brushRadius').setValue(brushRadius);
        pc.drawQuadWithShader(device, outputRenderTarget, outputShader);
    });
});

export { app };
