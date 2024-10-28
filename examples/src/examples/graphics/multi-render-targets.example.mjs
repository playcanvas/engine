import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});

const assets = {
    board: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/chess-board.glb' }),
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.ScreenComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.ScriptHandler, pc.TextureHandler, pc.ContainerHandler, pc.FontHandler];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 1;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;

    // get existing layers
    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const uiLayer = app.scene.layers.getLayerByName('UI');

    // create a layer for object that render into texture, add it right after the world layer
    const rtLayer = new pc.Layer({ name: 'RTLayer' });
    app.scene.layers.insert(rtLayer, 1);

    /**
     * Helper function to create a texture to render to.
     * @param {string} name - The name.
     * @param {number} width - The width.
     * @param {number} height - The height.
     * @returns {pc.Texture} The returned texture.
     */
    const createTexture = (name, width, height) => {
        return new pc.Texture(app.graphicsDevice, {
            name: name,
            width: width,
            height: height,
            format: pc.PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
    };

    // create textures and render target for rendering into, including depth buffer
    const texture0 = createTexture('RT-texture-0', 512, 512);
    const texture1 = createTexture('RT-texture-1', 512, 512);
    const texture2 = createTexture('RT-texture-2', 512, 512);

    // render to multiple targets if supported
    const colorBuffers = [texture0, texture1, texture2];
    const renderTarget = new pc.RenderTarget({
        name: `MRT`,
        colorBuffers: colorBuffers,
        depth: true,
        flipY: !app.graphicsDevice.isWebGPU,
        samples: 2
    });

    // Create texture camera, which renders entities in RTLayer into the texture
    const textureCamera = new pc.Entity('TextureCamera');
    textureCamera.addComponent('camera', {
        layers: [rtLayer.id],
        farClip: 500,

        // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
        // to make it rendered first each frame
        priority: -1,

        // this camera renders into texture target
        renderTarget: renderTarget
    });
    app.root.addChild(textureCamera);

    // set the shader pass to use MRT output
    textureCamera.camera.setShaderPass('MyMRT');

    // get the instance of the chess board. Render it into RTLayer only.
    const boardEntity = assets.board.resource.instantiateRenderEntity({
        layers: [rtLayer.id]
    });
    app.root.addChild(boardEntity);

    // override output shader chunk for the material of the chess board, to inject our
    // custom shader chunk which outputs to multiple render targets during our custom
    // shader pass
    const outputChunk = files['output.frag'];
    /** @type {Array<pc.RenderComponent>} */
    const renders = boardEntity.findComponents('render');
    renders.forEach((render) => {
        const meshInstances = render.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            // @ts-ignore engine-tsd
            meshInstances[i].material.chunks.outputPS = outputChunk;
        }
    });

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        layers: [worldLayer.id, skyboxLayer.id, uiLayer.id]
    });
    app.root.addChild(camera);

    // update things every frame
    let angle = 1;
    app.on('update', function (/** @type {number} */ dt) {
        angle += dt;

        // orbit the camera around
        textureCamera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
        textureCamera.lookAt(pc.Vec3.ZERO);

        const gd = app.graphicsDevice;
        const ratio = gd.width / gd.height;

        // debug draw the texture on the screen in the world layer of the main camera
        // @ts-ignore engine-tsd
        app.drawTexture(0, 0.4, 1, ratio, texture0, null, worldLayer);

        // @ts-ignore engine-tsd
        app.drawTexture(-0.5, -0.5, 0.9, 0.9 * ratio, texture1, null, worldLayer);

        // @ts-ignore engine-tsd
        app.drawTexture(0.5, -0.5, 0.9, 0.9 * ratio, texture2, null, worldLayer);
    });
});

export { app };
