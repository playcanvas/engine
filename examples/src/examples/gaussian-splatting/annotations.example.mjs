// @config DESCRIPTION This example demonstrates unified gsplat rendering with annotations for testing annotation functionality on gaussian splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { Annotation } = await fileImport(`${rootPath}/static/scripts/esm/annotation.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    hotel: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/hotel-culpture.compressed.ply` }),
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/guitar.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set default values for controls
    data.set('data', {
        opacity: 1.0,
        behindOpacity: 0.25
    });

    // Handle control changes
    data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        if (path === 'data.opacity') {
            Annotation.opacity = value;
        } else if (path === 'data.behindOpacity') {
            Annotation.behindOpacity = value;
        }
    });

    // instantiate hotel gsplat
    const hotel = new pc.Entity('hotel');
    hotel.addComponent('gsplat', {
        asset: assets.hotel,
        unified: true
    });
    hotel.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(hotel);

    // create biker1
    const biker1 = new pc.Entity('biker1');
    biker1.addComponent('gsplat', {
        asset: assets.biker,
        unified: true
    });
    biker1.setLocalPosition(0, -1.8, -2);
    biker1.setLocalEulerAngles(180, 90, 0);
    app.root.addChild(biker1);

    // clone the biker and add the clone to the scene
    const biker2 = biker1.clone();
    biker2.setLocalPosition(0, -1.8, 2);
    biker2.rotate(0, 150, 0);
    app.root.addChild(biker2);

    // create guitar
    const guitar = new pc.Entity('guitar');
    guitar.addComponent('gsplat', {
        asset: assets.guitar,
        unified: true
    });
    guitar.setLocalPosition(2, -1.8, -0.5);
    guitar.setLocalEulerAngles(0, 0, 180);
    guitar.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(guitar);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: pc.Color.BLACK,
        fov: 80,
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(3, 1, 0.5);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: guitar,
            distanceMax: 3.2,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    /**
     * Create an annotation entity
     * @param {pc.Vec3} position - Position in the scene
     * @param {string} label - Label number
     * @param {string} title - Annotation title
     * @param {string} text - Annotation description
     * @returns {pc.Entity} The annotation entity
     */
    const createAnnotation = (position, label, title, text) => {
        const entity = new pc.Entity(`annotation${label}`);
        entity.setLocalPosition(position);
        entity.addComponent('script');
        entity.script.create(Annotation, {
            properties: {
                label: label,
                title: title,
                text: text
            }
        });
        return entity;
    };

    // Create annotations at specific locations
    const annotationData = [
        { pos: new pc.Vec3(0.6, -0.6, 1.7), title: 'Helmet 1', text: 'First helmet display.' },
        { pos: new pc.Vec3(-0.5, -0.2, -1.5), title: 'Helmet 2', text: 'Second helmet display.' },
        { pos: new pc.Vec3(2.0, 0, 0), title: 'Guitar', text: 'Guitar on display.' },
        { pos: new pc.Vec3(-2.2, 2.0, -4.8), title: 'Black Light Projector', text: 'Black light projector equipment.' },
        { pos: new pc.Vec3(2.0, 2.0, 0.2), title: 'White Light Projector', text: 'White light projector equipment.' },
        { pos: new pc.Vec3(3.7, 0, -3.6), title: 'Stairs', text: 'Staircase area.' },
        { pos: new pc.Vec3(-0.2, -0.5, -5.5), title: 'Basement', text: 'Basement level.' },
        { pos: new pc.Vec3(-0.1, -1.5, -0.3), title: 'Statue', text: 'Statue display.' }
    ];

    annotationData.forEach((data, index) => {
        const annotation = createAnnotation(
            data.pos,
            String(index + 1),
            data.title,
            data.text
        );
        app.root.addChild(annotation);
    });
});

export { app };
