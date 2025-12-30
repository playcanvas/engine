import files from 'examples/files';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const shaderLanguage = device.isWebGPU ? 'wgsl' : 'glsl';

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

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

const assets = {
    gallery: new pc.Asset('gallery', 'container', { url: `${rootPath}/static/assets/models/vr-gallery.glb` }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/guitar.compressed.ply` }),
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    skull: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/skull.sog` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // get the instance of the gallery and set up with render component
    const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
    app.root.addChild(galleryEntity);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(-3, 1, 2);

    // instantiate guitar with a custom shader
    const guitar = new pc.Entity('guitar');
    guitar.addComponent('gsplat', {
        asset: assets.guitar
    });
    const customShaderFile = shaderLanguage === 'wgsl' ? 'shader.wgsl.vert' : 'shader.glsl.vert';
    guitar.gsplat.material.getShaderChunks(shaderLanguage).set('gsplatModifyVS', files[customShaderFile]);
    guitar.setLocalPosition(0, 0.8, 0);
    guitar.setLocalEulerAngles(0, 0, 180);
    guitar.setLocalScale(0.4, 0.4, 0.4);
    app.root.addChild(guitar);

    // helper function to create a splat instance
    const createSplatInstance = (name, asset, px, py, pz, scale, vertex, fragment) => {
        const entity = new pc.Entity(name);
        entity.addComponent('gsplat', {
            asset: asset
        });
        entity.setLocalPosition(px, py, pz);
        entity.setLocalEulerAngles(180, 90, 0);
        entity.setLocalScale(scale, scale, scale);
        app.root.addChild(entity);

        return entity;
    };

    const biker = createSplatInstance('biker', assets.biker, -1.5, 0.05, 0, 0.7);

    // clone the biker and add the clone to the scene
    const skull = createSplatInstance('skull', assets.skull, 1.5, 0.05, 0, 0.7);
    skull.rotate(0, 150, 0);
    app.root.addChild(skull);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: guitar,
            distanceMax: 60,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    let useCustomShader = true;
    data.on('shader:set', () => {
        // Apply custom or default material options to the splats when the button is clicked. Note
        // that this uses non-public API, which is subject to change when a proper API is added.
        const customShaderFile = shaderLanguage === 'wgsl' ? 'shader.wgsl.vert' : 'shader.glsl.vert';
        const vs = files[customShaderFile];

        const mat1 = biker.gsplat.material;
        if (useCustomShader) {
            mat1.getShaderChunks(shaderLanguage).set('gsplatModifyVS', vs);
        } else {
            mat1.getShaderChunks(shaderLanguage).delete('gsplatModifyVS');
        }
        mat1.update();

        const mat2 = skull.gsplat.material;
        if (useCustomShader) {
            mat2.getShaderChunks(shaderLanguage).set('gsplatModifyVS', vs);
        } else {
            mat2.getShaderChunks(shaderLanguage).delete('gsplatModifyVS');
        }
        mat2.setDefine('CUTOUT', true);
        mat2.update();

        useCustomShader = !useCustomShader;
    });

    const uTime = app.graphicsDevice.scope.resolve('uTime');

    let currentTime = 0;
    app.on('update', (dt) => {
        currentTime += dt;

        uTime.setValue(currentTime);

        skull.rotate(0, 80 * dt, 0);
    });
});

export { app };
