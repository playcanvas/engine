import * as pc from 'playcanvas';
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    playcanvas: new pc.Asset('playcanvas', 'texture', { url: rootPath + '/static/assets/textures/playcanvas.png' })
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
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler];

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

    // Create a camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
    });
    app.root.addChild(camera);

    // Create a 2D screen
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });
    app.root.addChild(screen);

    // Create the shader from the vertex and fragment shader
    const shader = pc.createShaderFromCode(
        app.graphicsDevice,
        files['shader.vert'],
        files['shader.frag'],
        'myUIShader',
        {
            vertex_position: pc.SEMANTIC_POSITION,
            vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
        }
    );

    // Create a new material with the new shader and additive alpha blending
    const material = new pc.Material();
    material.shader = shader;
    material.blendType = pc.BLEND_ADDITIVEALPHA;
    material.depthWrite = true;
    material.setParameter('uDiffuseMap', assets.playcanvas.resource);
    material.update();

    // Create the UI image element with the custom material
    const entity = new pc.Entity();
    entity.addComponent('element', {
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        width: 350,
        height: 350,
        type: pc.ELEMENTTYPE_IMAGE
    });
    entity.element.material = material;
    screen.addChild(entity);

    // update the material's 'amount' parameter to animate the inverse effect
    let time = 0;
    app.on('update', (dt) => {
        time += dt;
        // animate the amount as a sine wave varying from 0 to 1
        material.setParameter('amount', (Math.sin(time * 4) + 1) * 0.5);
    });
});

export { app };
