import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new pc.Asset('statue', 'container', { url: `${rootPath}/static/assets/models/statue.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
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
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.translate(0, 7, 24);

    // Create an Entity with a omni light component and a sphere model component.
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        radius: 10
    });
    light.translate(0, 1, 0);

    // Add entities into scene hierarchy
    app.root.addChild(camera);
    app.root.addChild(light);

    // Create a new material with a custom shader
    const material = new pc.ShaderMaterial({
        uniqueName: 'toon',
        vertexGLSL: files['shader.glsl.vert'],
        fragmentGLSL: files['shader.glsl.frag'],
        vertexWGSL: files['shader.wgsl.vert'],
        fragmentWGSL: files['shader.wgsl.frag'],
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aNormal: pc.SEMANTIC_NORMAL,
            aUv: pc.SEMANTIC_TEXCOORD0
        }
    });

    // create a hierarchy of entities with render components, representing the statue model
    const entity = assets.statue.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    /**
     * Set the new material on all meshes in the model, and use original texture from the model on the new material
     * @type {pc.Texture | null}
     */
    /** @type {Array<pc.RenderComponent>} */
    const renders = entity.findComponents('render');
    renders.forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material = material;
        });
    });

    // material parameters
    const lightPosArray = [light.getPosition().x, light.getPosition().y, light.getPosition().z];
    material.setParameter('uLightPos', lightPosArray);
    material.update();

    // rotate the statue
    app.on('update', (dt) => {
        entity.rotate(0, 60 * dt, 0);
    });
});

export { app };
