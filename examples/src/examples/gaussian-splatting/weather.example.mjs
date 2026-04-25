// @config NO_MINISTATS
// @config DESCRIPTION Procedural infinite weather particles rendered as Gaussian splats over a LOD-streamed scene. Particles follow the camera using a deterministic 3D grid with hash-based positioning and animation.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
const { GsplatWeather } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-weather.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    scene: new pc.Asset('gsplat', 'gsplat', { url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const miniStats = new pc.MiniStats(app, pc.MiniStats.getDefaultOptions(['gsplats'])); // eslint-disable-line no-unused-vars

    // LOD streaming settings
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;
    app.scene.gsplat.lodUpdateDistance = 0.5;
    app.scene.gsplat.lodUnderfillLimit = 5;
    app.scene.gsplat.splatBudget = pc.platform.mobile ? 1000000 : 4000000;

    // Camera
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.6, 0.65, 0.75),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR
    });
    camera.setLocalPosition(10.3, 2, -10);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type {CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: 4,
        moveFastSpeed: 15,
        enableOrbit: false,
        enablePan: false,
        focusPoint: new pc.Vec3(12, 3, 0)
    });

    // Load the gsplat scene
    const gsplatEntity = new pc.Entity('Roman-Parish');
    gsplatEntity.addComponent('gsplat', {
        asset: assets.scene,
        unified: true
    });
    gsplatEntity.setLocalEulerAngles(270, 0, 0);
    app.root.addChild(gsplatEntity);

    gsplatEntity.gsplat.lodBaseDistance = 5;
    gsplatEntity.gsplat.lodMultiplier = 4;

    // Procedural weather
    const weatherEntity = new pc.Entity('Weather');
    weatherEntity.addComponent('script');
    const weather = /** @type {GsplatWeather} */ (weatherEntity.script.create(GsplatWeather, {
        properties: {
            followEntity: camera,
            speed: 1.0,
            drift: 0.15,
            opacity: 0.8,
            particleMinSize: 0.006,
            particleMaxSize: 0.012
        }
    }));
    app.root.addChild(weatherEntity);

    // Particle size slider mapping: 0..1 slider ↔ 0.0001..0.04 world units
    const PSIZE_LO = 0.0001, PSIZE_HI = 0.04, PSIZE_RANGE = PSIZE_HI - PSIZE_LO;
    const sizeToSlider = v => (v - PSIZE_LO) / PSIZE_RANGE;
    const sliderToSize = v => PSIZE_LO + v * PSIZE_RANGE;

    const presets = {
        none: {
            speed: 0,
            drift: 0,
            angle: 0,
            opacity: 0,
            color: [1, 1, 1],
            elongate: 1,
            particleMinSize: 0,
            particleMaxSize: 0,
            fogDensity: 0,
            exposure: 1
        },
        snow: {
            speed: 2.0,
            drift: 0.4,
            angle: 0,
            opacity: 0.8,
            color: [1, 1, 1],
            elongate: 1,
            particleMinSize: 0.006,
            particleMaxSize: 0.012,
            fogDensity: 0.03,
            exposure: 0.8
        },
        rain: {
            speed: 10,
            drift: 0,
            angle: 0,
            opacity: 0.57,
            color: [0.812, 0.812, 0.812],
            elongate: 20,
            particleMinSize: 0.003,
            particleMaxSize: 0.003,
            fogDensity: 0.02,
            exposure: 0.5
        }
    };

    const applyFog = (density) => {
        if (density > 0) {
            app.scene.fog.type = pc.FOG_EXP;
            app.scene.fog.density = density;
            app.scene.fog.color.set(1, 1, 1);
        } else {
            app.scene.fog.type = pc.FOG_NONE;
        }
    };

    const applyPreset = (name) => {
        const p = presets[name];
        if (!p) return;
        weatherEntity.enabled = name !== 'none';
        data.set('speed', p.speed);
        data.set('drift', p.drift);
        data.set('angle', p.angle);
        data.set('opacity', p.opacity);
        data.set('color', [...p.color]);
        data.set('elongate', p.elongate);
        data.set('particleMinSize', sizeToSlider(p.particleMinSize));
        data.set('particleMaxSize', sizeToSlider(p.particleMaxSize));
        data.set('fogDensity', p.fogDensity);
        data.set('exposure', p.exposure);

        weather.speed = p.speed;
        weather.drift = p.drift;
        weather.opacity = p.opacity;
        weather.color = p.color;
        weather.elongate = p.elongate;
        weather.particleMinSize = p.particleMinSize;
        weather.particleMaxSize = p.particleMaxSize;
        weatherEntity.setLocalEulerAngles(p.angle, 0, 0);
        applyFog(p.fogDensity);
        app.scene.exposure = p.exposure;
    };

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });

    // Initialize UI data
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('exposure', 1);
    data.set('useFog', true);
    data.set('preset', 'snow');
    applyPreset('snow');
    data.set('extents', [weather.extents.x, weather.extents.y, weather.extents.z]);
    data.set('density', weather.density);
    data.set('particles', weather.numParticles.toLocaleString());

    // Preset dropdown
    data.on('preset:set', () => applyPreset(data.get('preset')));

    // Angle tilts the entity so particles fall at an angle
    data.on('angle:set', () => {
        weatherEntity.setLocalEulerAngles(data.get('angle'), 0, 0);
    });

    // Runtime uniforms — applied directly each frame
    data.on('speed:set', () => {
        weather.speed = data.get('speed');
    });
    data.on('drift:set', () => {
        weather.drift = data.get('drift');
    });
    data.on('opacity:set', () => {
        weather.opacity = data.get('opacity');
    });
    data.on('color:set', () => {
        weather.color = data.get('color');
    });
    data.on('elongate:set', () => {
        weather.elongate = data.get('elongate');
    });
    data.on('particleMinSize:set', () => {
        weather.particleMinSize = sliderToSize(data.get('particleMinSize'));
    });
    data.on('particleMaxSize:set', () => {
        weather.particleMaxSize = sliderToSize(data.get('particleMaxSize'));
    });
    data.on('fogDensity:set', () => {
        applyFog(data.get('fogDensity'));
    });
    data.on('exposure:set', () => {
        app.scene.exposure = data.get('exposure');
    });
    data.on('useFog:set', () => {
        app.scene.gsplat.useFog = data.get('useFog');
    });

    // Grid config — requires rebuild
    const rebuild = () => {
        const ext = data.get('extents');
        weather.extents.set(ext[0], ext[1], ext[2]);
        weather.density = data.get('density');
        weather.rebuild();
        data.set('particles', weather.numParticles.toLocaleString());
    };
    data.on('extents:set', rebuild);
    data.on('extents.0:set', rebuild);
    data.on('extents.1:set', rebuild);
    data.on('extents.2:set', rebuild);
    data.on('density:set', rebuild);
});

export { app };
