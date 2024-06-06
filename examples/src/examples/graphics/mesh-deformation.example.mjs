import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' }),
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
    app.scene.skyboxMip = 2;
    app.scene.exposure = 1;
    app.scene.envAtlas = assets.helipad.resource;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.translate(0, 7, 24);
    app.root.addChild(camera);

    // create a hierarchy of entities with render components, representing the statue model
    const entity = assets.statue.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    // collect positions from all mesh instances to work on
    /** @type {object[]} */
    const allMeshes = [];
    /** @type {Array<pc.RenderComponent>} */
    const renders = entity.findComponents('render');
    renders.forEach((render) => {
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
    app.on('update', function (dt) {
        time += dt;

        if (entity) {
            // orbit the camera
            camera.setLocalPosition(25 * Math.sin(time * 0.2), 15, 25 * Math.cos(time * 0.2));
            camera.lookAt(new pc.Vec3(0, 7, 0));

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
});

export { app };
