import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// A simple render pass that renders a quad with a shader. The shader tints the source texture.
class RenderPassTint extends pc.RenderPassShaderQuad {
    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.tint = pc.Color.WHITE.clone();

        this.shader = this.createQuadShader(
            'TintShader',
            `
                uniform sampler2D sourceTexture;
                uniform vec3 tint;
                varying vec2 uv0;
                void main() {
                    vec4 color = texture2D(sourceTexture, uv0);
                    gl_FragColor = vec4(color.rgb * tint, color.a);
                }`
        );
    }

    execute() {
        this.device.scope.resolve('sourceTexture').setValue(this.sourceTexture);
        this.device.scope.resolve('tint').setValue([this.tint.r, this.tint.g, this.tint.b]);
        super.execute();
    }
}

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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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
    app.scene.skyboxMip = 2;
    app.scene.exposure = 5;

    // get the instance of the chess board and set up with render component
    const boardEntity = assets.board.resource.instantiateRenderEntity({
        castShadows: false,
        receiveShadows: false
    });
    app.root.addChild(boardEntity);

    // Create an Entity with a camera component, and attach postprocessing effects scripts on it
    const cameraEntity = new pc.Entity();
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        farClip: 500
    });

    // position the camera in the world
    cameraEntity.setLocalPosition(0, 30, -60);
    cameraEntity.lookAt(0, 0, 100);
    app.root.addChild(cameraEntity);

    // the scene gets rendered to a texture first
    const texture = new pc.Texture(device, {
        name: 'RTTexture',
        width: 4,
        height: 4,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    const rt = new pc.RenderTarget({
        colorBuffer: texture,
        depth: true
    });

    // layers used in rendering
    const worldLayer = app.scene.layers.getLayerByName('World');
    const uiLayer = app.scene.layers.getLayerById(pc.LAYERID_UI);

    // use the render pass to render the world and ui layers to the created texture
    const renderPass = new pc.RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);

    // this render pass resizes the texture to match the size of are on the scene we render to
    renderPass.init(rt, {
        resizeSource: null
    });
    renderPass.addLayer(cameraEntity.camera, worldLayer, false);
    renderPass.addLayer(cameraEntity.camera, uiLayer, true);

    // tint pass uses the scene rendered to a texture, and applies a tint to it
    const tintPass = new RenderPassTint(app.graphicsDevice, texture);

    // rendering goes directly to the front-buffer
    tintPass.init(null);

    // assign those two passes to the camera to be used instead of its default rendering
    cameraEntity.camera.renderPasses = [renderPass, tintPass];

    // update things every frame
    let angle = 3;
    app.on('update', function (/** @type {number} */ dt) {
        angle += dt;

        // move the focus position in the world
        const focusPosition = new pc.Vec3(0, 10, Math.sin(1 + angle * 0.3) * 90);

        // orbit the camera around
        cameraEntity.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
        cameraEntity.lookAt(focusPosition);

        // tint color
        tintPass.tint.lerp(pc.Color.YELLOW, pc.Color.CYAN, Math.sin(angle * 0.5) * 0.5 + 0.5);
    });
});

export { app };
