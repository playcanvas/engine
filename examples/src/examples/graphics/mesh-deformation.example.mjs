import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TEXTURETYPE_RGBP,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.skyboxMip = 2;
app.scene.exposure = 1;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
camera.translate(0, 7, 24);
app.root.addChild(camera);

// create a hierarchy of entities with render components, representing the statue model
const entity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(entity);

// collect positions from all mesh instances to work on
/** @type {object[]} */
const allMeshes = [];
/** @type {Array<RenderComponent>} */
const renders = entity.findComponents('render');
renders.forEach(render => {
    // collect positions from all mesh instances on this render component
    const meshInstances = render.meshInstances;
    for (let i = 0; i < meshInstances.length; i++) {
        const meshInstance = meshInstances[i];

        // get positions from the mesh
        const mesh = meshInstance.mesh;
        /** @type {number[]} */
        const srcPositions = [];
        mesh.getPositions(srcPositions);

        // store it
        allMeshes.push({
            mesh: mesh,
            srcPositions: srcPositions
        });
    }
});

// temporary work array of positions to avoid per frame allocations
/** @type {number[]} */
const tempPositions = [];

let time = 0;
app.on('update', dt => {
    time += dt;

    if (entity) {
        // orbit the camera
        camera.setLocalPosition(25 * Math.sin(time * 0.2), 15, 25 * Math.cos(time * 0.2));
        camera.lookAt(new Vec3(0, 7, 0));

        const strength = 50;

        // modify mesh positions on each frame
        for (let i = 0; i < allMeshes.length; i++) {
            tempPositions.length = 0;
            const srcPositions = allMeshes[i].srcPositions;

            // loop over all positions, and fill up tempPositions array with waved version of positions from srcPositions array
            // modify .x and .z components based on sin function, which uses .y component
            for (let k = 0; k < srcPositions.length; k += 3) {
                tempPositions[k] = srcPositions[k] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
                tempPositions[k + 1] = srcPositions[k + 1];
                tempPositions[k + 2] = srcPositions[k + 2] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
            }

            // set new positions on the mesh
            const mesh = allMeshes[i].mesh;
            mesh.setPositions(tempPositions);
            mesh.update();
        }
    }
});
