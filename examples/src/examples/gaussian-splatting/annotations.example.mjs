// @config DESCRIPTION Interactive 3D annotations on a gaussian splat model. Click hotspots to reveal product details with tooltips that follow the 3D positions.
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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.GSplatHandler];

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

app.start();

// Create an Entity with a camera component
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    fov: 30
});
camera.setLocalPosition(-2, 1.2, -2.5);

// Add camera controls and post-processing
camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        enableFly: false,
        enablePan: false,
        focusPoint: new pc.Vec3(0, 0.575, 0),
        zoomRange: new pc.Vec2(1, 5)
    }
});
camera.script.create(CameraFrame, {
    properties: {
        vignette: {
            enabled: true,
            color: pc.Color.BLACK,
            curvature: 0.5,
            intensity: 0.5,
            inner: 0.5,
            outer: 1
        }
    }
});
app.root.addChild(camera);

const assets = {
    bicycle: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/bicycle.sog` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    // instantiate bicycle gsplat
    const bicycle = new pc.Entity('Bicycle');
    bicycle.addComponent('gsplat', {
        asset: assets.bicycle
    });
    bicycle.setLocalEulerAngles(0, 0, 180);
    app.root.addChild(bicycle);

    // Add annotation manager to the bicycle entity - handles global settings and shared resources
    // The manager listens for 'annotation:add' events on the app to automatically register annotations
    bicycle.addComponent('script');
    const manager = bicycle.script.create(AnnotationManager);

    // Set default values for controls
    data.set('data', {
        hotspotSize: 25,
        hotspotColor: [0.8, 0.8, 0.8],
        hoverColor: [1, 0.4, 0],
        opacity: 1,
        behindOpacity: 0.25
    });

    // Handle control changes - update the manager directly
    data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        const prop = path.split('.')[1];
        if (prop === 'hotspotSize') {
            manager.hotspotSize = value;
        } else if (prop === 'hotspotColor' || prop === 'hoverColor') {
            manager[prop] = new pc.Color(value[0], value[1], value[2]);
        } else if (prop === 'opacity') {
            manager.opacity = value;
        } else if (prop === 'behindOpacity') {
            manager.behindOpacity = value;
        }
    });

    // Create annotations at specific locations (positions are local to the bicycle entity)
    // Annotations fire 'annotation:add' on the app, which the manager listens for
    const annotations = [
        {
            pos: [0, -0.6, -0.86],
            title: 'Smooth-Rolling Tires',
            text: 'Wide, durable tires absorb road vibrations while rolling smoothly, offering a perfect balance of comfort, grip, and efficiency.'
        },
        {
            pos: [0, -0.88, -0.49],
            title: 'Front Lighting System',
            text: 'The built-in front light improves visibility in low-light conditions, helping you see and be seen for safer rides day or night.'
        },
        {
            pos: [0, -1.13, -0.31],
            title: 'Upright Handlebar Position',
            text: 'Raised handlebars promote an upright riding position, reducing strain on your back, shoulders, and wrists for longer, more enjoyable rides.'
        },
        {
            pos: [0, -0.656, -0.048],
            title: 'Step-Through Frame',
            text: 'The low step-through frame makes getting on and off effortless—ideal for everyday riding, commuting, or riders who value comfort and accessibility.'
        },
        {
            pos: [-0.07, -0.391, 0.181],
            title: 'Chain Guard',
            text: 'The enclosed chain guard protects your clothing and reduces maintenance, so you can ride without worrying about grease or snagging.'
        },
        {
            pos: [-0.062, -0.748, 0.234],
            title: 'Adjustable Seat Height',
            text: 'Easily adjust the seat height to match your riding style and body position, ensuring optimal comfort and control.'
        },
        {
            pos: [0, -1.0, 0.309],
            title: 'Ergonomic Saddle',
            text: 'A wide, cushioned saddle provides excellent support, making every ride comfortable—no matter how long the journey.'
        },
        {
            pos: [0, -0.58, 0.416],
            title: 'Reliable Braking System',
            text: 'High-quality brakes deliver consistent stopping power, giving you peace of mind in traffic, on hills, or in changing weather.'
        },
        {
            pos: [0, -0.78, 0.596],
            title: 'Rear Cargo Rack',
            text: 'A sturdy rear rack makes it easy to transport bags, groceries, or accessories—perfect for commuting or daily errands.'
        },
        {
            pos: [0, -0.701, 0.816],
            title: 'Full Coverage Fenders',
            text: 'Full front and rear fenders protect you from splashes and debris, keeping your clothes clean in wet or unpredictable conditions.'
        }
    ];

    annotations.forEach(({ pos, title, text }, index) => {
        const annotation = new pc.Entity(title);
        annotation.setLocalPosition(pos[0], pos[1], pos[2]);
        annotation.addComponent('script');
        annotation.script.create(Annotation, {
            properties: {
                label: String(index + 1),
                title,
                text
            }
        });
        bicycle.addChild(annotation);
    });
});

export { app };
