// @config DESCRIPTION This example demonstrates unified gsplat rendering with annotations for testing annotation functionality on gaussian splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { Annotation, AnnotationManager } = await fileImport(`${rootPath}/static/scripts/esm/annotation.mjs`);
const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { CameraFrame } = await fileImport(`${rootPath}/static/scripts/esm/camera-frame.mjs`);

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
    bicycle: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/bicycle.sog` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create an Entity with a camera component
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        fov: 30
    });
    camera.setLocalPosition(-2, 1.2, -2.5);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    camera.script.create(CameraControls, {
        properties: {
            focusPoint: new pc.Vec3(0, 0.575, 0)
        }
    });
    camera.script.create(CameraFrame, {
        properties: {
            vignette: {
                enabled: true,
                color: pc.Color.BLACK,
                intensity: 0.5,
                inner: 0.5,
                outer: 1,
                curvature: 0.5
            }
        }
    });
    app.root.addChild(camera);

    // instantiate bicycle gsplat
    const bicycle = new pc.Entity('Bicycle');
    bicycle.addComponent('gsplat', {
        asset: assets.bicycle,
        unified: true
    });
    bicycle.setLocalEulerAngles(0, 0, 180);
    app.root.addChild(bicycle);

    // Add annotation manager to the bicycle entity - handles global settings and shared resources
    // The manager listens for 'annotation:add' events on the app to automatically register annotations
    bicycle.addComponent('script');
    const manager = bicycle.script.create(AnnotationManager);

    // Set default values for controls
    data.set('data', {
        opacity: 1.0,
        behindOpacity: 0.25
    });

    // Handle control changes - update the manager directly
    data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        if (path === 'data.opacity') {
            manager.opacity = value;
        } else if (path === 'data.behindOpacity') {
            manager.behindOpacity = value;
        }
    });

    // Create annotations at specific locations
    // Annotations fire 'annotation:add' on the app, which the manager listens for
    const annotationData = [
        {
            pos: new pc.Vec3(0, 0.6, -0.86),
            title: 'Smooth-Rolling Tires',
            text: 'Wide, durable tires absorb road vibrations while rolling smoothly, offering a perfect balance of comfort, grip, and efficiency.'
        },
        {
            pos: new pc.Vec3(0, 0.88, -0.49),
            title: 'Front Lighting System',
            text: 'The built-in front light improves visibility in low-light conditions, helping you see and be seen for safer rides day or night.'
        },
        {
            pos: new pc.Vec3(0.0, 1.13, -0.31),
            title: 'Upright Handlebar Position',
            text: 'Balanced frame geometry delivers a smooth, stable ride, giving you confidence on city streets and casual pathRaised handlebars promote an upright riding position, reducing strain on your back, shoulders, and wrists for longer, more enjoyable rides.'
        },
        {
            pos: new pc.Vec3(0.0, 1.2, 0.9),
            title: 'Upright Handlebars',
            text: 'Raised handlebars encourage an upright riding position, reducing strain on your back, shoulders, and wrists.'
        },
        {
            pos: new pc.Vec3(0.0, 1.1, -0.4),
            title: 'Ergonomic Saddle',
            text: 'A wide, cushioned saddle provides excellent support, keeping every ride comfortable and relaxed.'
        },
        {
            pos: new pc.Vec3(0.0, 0.9, 1.6),
            title: 'Front Light',
            text: 'Built-in front lighting improves visibility and safety, helping you see and be seen in low-light conditions.'
        },
        {
            pos: new pc.Vec3(0.0, 0.3, 1.3),
            title: 'Full Fenders',
            text: 'Full front and rear fenders keep you clean and dry by deflecting water, mud, and road debris.'
        },
        {
            pos: new pc.Vec3(0.0, 1.0, -1.3),
            title: 'Rear Cargo Rack',
            text: 'A sturdy rear rack makes it easy to carry bags, groceries, or accessories—perfect for daily errands.'
        },
        {
            pos: new pc.Vec3(0.5, 0.3, 0.8),
            title: 'Braking System',
            text: 'High-quality brakes deliver reliable stopping power, giving you peace of mind in traffic and changing weather.'
        },
        {
            pos: new pc.Vec3(-0.4, 0.4, 0.2),
            title: 'Chain Guard',
            text: 'An enclosed chain guard protects your clothing and reduces upkeep, so you can focus on riding.'
        },
        {
            pos: new pc.Vec3(0.0, 0.6, -0.9),
            title: 'Adjustable Seat Height',
            text: 'Easily adjust the seat height to dial in the perfect riding position for comfort and control.'
        },
        {
            pos: new pc.Vec3(0.0, 1.0, 0.0),
            title: 'Urban Design',
            text: 'A timeless urban design blends style and function—this bike looks as good as it rides.'
        }
    ];

    annotationData.forEach(({pos, title, text}, index) => {
        const annotation = new pc.Entity(title);
        annotation.setLocalPosition(pos);
        annotation.addComponent('script');
        annotation.script.create(Annotation, {
            properties: {
                label: String(index + 1),
                title: title,
                text: text
            }
        });
        bicycle.addChild(annotation);
    });
});

export { app };
