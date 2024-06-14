import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    portal: new pc.Asset('portal', 'container', { url: rootPath + '/static/assets/models/portal.glb' }),
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' }),
    bitmoji: new pc.Asset('bitmoji', 'container', { url: rootPath + '/static/assets/models/bitmoji.glb' })
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

    // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxMip = 1;
    app.scene.skyboxIntensity = 0.7;

    ////////////////////////////////
    // Script to rotate the scene //
    ////////////////////////////////
    const Rotator = pc.createScript('rotator');

    let t = 0;

    Rotator.prototype.update = function (/** @type {number} */ dt) {
        t += dt;
        this.entity.setEulerAngles(0, Math.sin(t) * 40, 0);
    };

    //////////////////////////////////////////////////
    // Script to set up rendering the portal itself //
    //////////////////////////////////////////////////
    const Portal = pc.createScript('portal');

    // initialize code called once per entity
    Portal.prototype.initialize = function () {
        // increment value in stencil (from 0 to 1) for stencil geometry
        const stencil = new pc.StencilParameters({
            zpass: pc.STENCILOP_INCREMENT
        });

        // set the stencil and other parameters on all materials
        /** @type {Array<pc.RenderComponent>} */
        const renders = this.entity.findComponents('render');
        renders.forEach((render) => {
            for (const meshInstance of render.meshInstances) {
                const mat = meshInstance.material;
                mat.stencilBack = mat.stencilFront = stencil;

                // We only want to write to the stencil buffer
                mat.depthWrite = false;
                mat.redWrite = mat.greenWrite = mat.blueWrite = mat.alphaWrite = false;
                mat.update();
            }
        });
    };

    /////////////////////////////////////////////////////////////////////////////
    // Script to set stencil options for entities inside or outside the portal //
    /////////////////////////////////////////////////////////////////////////////

    const PortalGeometry = pc.createScript('portalGeometry');

    PortalGeometry.attributes.add('inside', {
        type: 'boolean',
        default: true,
        title: 'True indicating the geometry is inside the portal, false for outside'
    });

    PortalGeometry.prototype.initialize = function () {
        // based on value in the stencil buffer (0 outside, 1 inside), either render
        // the geometry when the value is equal, or not equal to zero.
        const stencil = new pc.StencilParameters({
            func: this.inside ? pc.FUNC_NOTEQUAL : pc.FUNC_EQUAL,
            ref: 0
        });

        // set the stencil parameters on all materials
        /** @type {Array<pc.RenderComponent>} */
        const renders = this.entity.findComponents('render');
        renders.forEach((render) => {
            for (const meshInstance of render.meshInstances) {
                meshInstance.material.stencilBack = meshInstance.material.stencilFront = stencil;
            }
        });
    };

    /////////////////////////////////////////////////////////////////////////////

    // find world layer - majority of objects render to this layer
    const worldLayer = app.scene.layers.getLayerByName('World');

    // find skybox layer - to enable it for the camera
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');

    const uiLayer = app.scene.layers.getLayerByName('UI');

    // portal layer - this is where the portal geometry is written to the stencil
    // buffer, and this needs to render first, so insert it before the world layer
    const portalLayer = new pc.Layer({ name: 'Portal' });
    app.scene.layers.insert(portalLayer, 0);

    // Create an Entity with a camera component
    // this camera renders both world and portal layers
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        layers: [worldLayer.id, portalLayer.id, skyboxLayer.id, uiLayer.id]
    });
    camera.setLocalPosition(7, 5.5, 7.1);
    camera.setLocalEulerAngles(-27, 45, 0);
    app.root.addChild(camera);

    // Create an Entity with a directional light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1)
    });
    light.setEulerAngles(45, 35, 0);
    app.root.addChild(light);

    // Create a root for the graphical scene
    const group = new pc.Entity();
    group.addComponent('script');
    group.script.create('rotator');
    app.root.addChild(group);

    // Create the portal entity - this plane is written to stencil buffer,
    // which is then used to test for inside / outside. This needs to render
    // before all elements requiring stencil buffer, so add to to a portalLayer.
    // This is the plane that fills the inside of the portal geometry.
    const portal = new pc.Entity('Portal');
    portal.addComponent('render', {
        type: 'plane',
        material: new pc.StandardMaterial(),
        layers: [portalLayer.id]
    });
    portal.addComponent('script');
    portal.script.create('portal'); // comment out this line to see the geometry
    portal.setLocalPosition(0, 0.4, -0.3);
    portal.setLocalEulerAngles(90, 0, 0);
    portal.setLocalScale(3.7, 1, 6.7);
    group.addChild(portal);

    // Create the portal visual geometry
    const portalEntity = assets.portal.resource.instantiateRenderEntity();
    portalEntity.setLocalPosition(0, -3, 0);
    portalEntity.setLocalScale(0.02, 0.02, 0.02);
    group.addChild(portalEntity);

    // Create a statue entity, whic is visible inside the portal only
    const statue = assets.statue.resource.instantiateRenderEntity();
    statue.addComponent('script');
    statue.script.create('portalGeometry', {
        attributes: {
            inside: true
        }
    });
    statue.setLocalPosition(0, -1, -2);
    statue.setLocalScale(0.25, 0.25, 0.25);
    group.addChild(statue);

    // Create a bitmoji entity, whic is visible outside the portal only
    const bitmoji = assets.bitmoji.resource.instantiateRenderEntity();
    bitmoji.addComponent('script');
    bitmoji.script.create('portalGeometry', {
        attributes: {
            inside: false
        }
    });
    bitmoji.setLocalPosition(0, -1, -2);
    bitmoji.setLocalScale(2.5, 2.5, 2.5);
    group.addChild(bitmoji);
});

export { app };
