// @config
//
// Demonstrates relighting of a Gaussian Splat scene using a matching simplified mesh
// with positions and normals, loaded from a draco compressed glb file. The proxy mesh is lit by
// lights and rendered into an offscreen texture (lit color in RGB, mesh coverage mask in A),
// which is then used to relight the splats.
//
// @flag NO_MINISTATS
//
// @credit
// title: Roman Parish
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/
//
// @credit
// title: HDRI Environments
// author: Poly Haven
// source: https://polyhaven.com
// license: CC0

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GsplatRelighting } from 'playcanvas/scripts/esm/gsplat/gsplat-relighting.mjs';

import { data, deviceType, win } from 'examples/context';

// allow overriding scene url and orientation via hash query params, e.g.
// #/gaussian-splatting/relighting?url=https://example.com/scene/lod-meta.json&orientation=90
const hashQuery = (win.location.hash || window.location.hash || '').split('?')[1] || '';
const hashParams = new URLSearchParams(hashQuery);
const paramUrl = hashParams.get('url');
const paramOrientation = hashParams.get('orientation');

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the mesh glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve(true));
});

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

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

// High Res toggle (false by default): when false, use half native DPR; when true, use min(DPR, 2)
data.set('highRes', !!data.get('highRes'));
const applyResolution = () => {
    const dpr = window.devicePixelRatio || 1;
    // auto: treat DPR >= 2 as high-DPI (drops to half); High Res forces native capped at 2
    device.maxPixelRatio = data.get('highRes') ? Math.min(dpr, 2) : (dpr >= 2 ? dpr * 0.5 : dpr);
};
applyResolution();
const applyAndResize = () => {
    applyResolution(); app.resizeCanvas();
};
data.on('highRes:set', applyAndResize);

// Ensure DPR and canvas are updated when window changes size
window.addEventListener('resize', applyAndResize);
app.on('destroy', () => {
    window.removeEventListener('resize', applyAndResize);
});

// Roman-Parish configuration
// original dataset: https://www.youtube.com/watch?v=3RtY_cLK13k
const config = {
    name: 'Roman-Parish',
    url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json',
    lodUpdateDistance: 0.5,
    lodUnderfillLimit: 5,
    cameraPosition: [10.3, 2, -10],
    eulerAngles: [-90, 0, 0],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: [12, 3, 0]
};

// HDRI environment presets (Poly Haven, infinite projection)
/** @type {Record<string, string | null>} */
const ENV_PRESETS = {
    'none': null,
    'rosendal': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/rosendal_park_sunset_puresky_2k.hdr',
    'industrial-sunset': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/industrial_sunset_puresky_2k.hdr',
    'partly-cloudy': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
    'moonlit': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/qwantani_moon_noon_puresky_2k.hdr',
    'sunflowers': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/sunflowers_puresky_2k.hdr',
    'table-mountain': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/table_mountain_2_puresky_2k.hdr',
    'cloud-layers': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/cloud_layers_2k.hdr',
    'night': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/qwantani_night_puresky_2k.hdr'
};

// LOD preset definitions
/** @type {Record<string, { range: number[], lodBaseDistance: number, lodMultiplier: number }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodBaseDistance: 7,
        lodMultiplier: 3
    },
    'desktop': {
        range: [1, 5],
        lodBaseDistance: 5,
        lodMultiplier: 4
    },
    'mobile-max': {
        range: [2, 5],
        lodBaseDistance: 5,
        lodMultiplier: 2
    },
    'mobile': {
        range: [3, 5],
        lodBaseDistance: 2,
        lodMultiplier: 2
    }
};

const assets = {
    church: new pc.Asset('gsplat', 'gsplat', { url: config.url }),

    // draco compressed mesh matching the splat scene, with positions and normals
    mesh: new pc.Asset('mesh', 'container', { url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/roman-parish-mesh.glb' }),

    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(async () => {
    app.start();

    const miniStats = new pc.MiniStats(app, pc.MiniStats.getDefaultOptions(['gsplats', 'gsplatsCopy'])); // eslint-disable-line no-unused-vars

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;

    data.on('radialSorting:set', () => {
        app.scene.gsplat.radialSorting = !!data.get('radialSorting');
    });

    app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
    app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.on('minPixelSize:set', () => {
        app.scene.gsplat.minPixelSize = data.get('minPixelSize');
    });
    data.on('alphaClipForward:set', () => {
        app.scene.gsplat.alphaClipForward = data.get('alphaClipForward');
    });
    data.on('minContribution:set', () => {
        app.scene.gsplat.minContribution = data.get('minContribution');
    });
    data.on('debug:set', () => {
        app.scene.gsplat.debug = data.get('debug');
    });
    data.on('compact:set', () => {
        app.scene.gsplat.dataFormat = data.get('compact') ? pc.GSPLATDATA_COMPACT : pc.GSPLATDATA_LARGE;
    });

    const MAX_PERSPECTIVE_FOV = 140;

    // initialize UI settings (must be after observer registration)
    const initialSettings = {
        fisheye: 0,
        cameraFov: 75,
        toneMapping: pc.TONEMAP_LINEAR,
        exposure: 0.3,
        minPixelSize: 2,
        alphaClipForward: 1 / 255,
        minContribution: 3,
        radialSorting: true,
        renderer: pc.GSPLAT_RENDERER_AUTO,
        culling: device.isWebGPU,
        compact: true,
        debug: pc.GSPLAT_DEBUG_NONE,
        lodPreset: pc.platform.mobile ? 'mobile' : 'desktop',
        splatBudget: pc.platform.mobile ? 1 : 4,
        environment: 'rosendal',
        fogDensity: 0,
        url: paramUrl || '',
        orientation: paramOrientation ? parseFloat(paramOrientation) : 270,
        blend: 0.5,
        brightness: 1,
        textureScale: 1,
        debugRt: false,
        lightIntensity: 3,
        lightColor: [1, 1, 1],
        shadows: true,
        omniRadius: 12.9,
        omniIntensity: 3,
        omniColor: [1, 1, 1],
        omniShadows: true,
        envRotation: 20,
        skyExposure: 1
    };
    Object.entries(initialSettings).forEach(([key, value]) => data.set(key, value));

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        fov: 75,
        toneMapping: pc.TONEMAP_LINEAR
    });

    const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
    const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
    const focusPoint = new pc.Vec3(focusX, focusY, focusZ);

    camera.setLocalPosition(camX, camY, camZ);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ ((/** @type {any} */ (camera.script)).create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: /** @type {number} */ (config.moveSpeed),
        moveFastSpeed: /** @type {number} */ (config.moveFastSpeed),
        enableOrbit: false,
        enablePan: false,
        focusPoint: focusPoint
    });

    // Relighting renderer: renders the relighting layer (proxy mesh) from a camera matching the
    // main camera into an RGBA16F texture - lit mesh color in RGB, mesh coverage mask in A
    const relighting = /** @type {GsplatRelighting} */ (
        (/** @type {any} */ (camera.script)).create(GsplatRelighting, {
            properties: {
                textureScale: data.get('textureScale'),
                blend: data.get('blend'),
                brightness: data.get('brightness'),
                background: data.get('skyExposure')
            }
        })
    );
    const relightLayer = /** @type {pc.Layer} */ (relighting.layer);

    data.on('textureScale:set', () => {
        relighting.textureScale = data.get('textureScale');
    });
    data.on('blend:set', () => {
        relighting.blend = data.get('blend');
    });
    data.on('brightness:set', () => {
        relighting.brightness = data.get('brightness');
    });

    // Directional light with PCSS soft shadows, lighting the proxy mesh on the relighting layer
    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: data.get('lightIntensity'),
        layers: [relightLayer.id],
        castShadows: !!data.get('shadows'),
        shadowType: pc.SHADOW_PCSS_32F,
        shadowResolution: 4096,
        shadowDistance: 150,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        penumbraSize: 0.015,
        penumbraFalloff: 4,
        shadowSamples: 16,
        shadowBlockerSamples: 16
    });
    light.setLocalPosition(0, 1, 0);
    light.setEulerAngles(-20, 30, 0);
    light.enabled = data.get('lightIntensity') > 0;
    app.root.addChild(light);

    const gizmoLayer = pc.Gizmo.createLayer(app);

    // rotation gizmo to orient the directional light; disable camera controls while dragging it
    const lightGizmo = new pc.RotateGizmo(camera.camera, gizmoLayer);
    lightGizmo.size = 0.5;
    lightGizmo.attach(light);
    lightGizmo.on('pointer:down', (/** @type {number} */ _x, /** @type {number} */ _y, /** @type {pc.MeshInstance} */ meshInstance) => {
        if (meshInstance) cc.enabled = false;
    });
    lightGizmo.on('pointer:up', () => {
        cc.enabled = true;
    });

    data.on('lightIntensity:set', () => {
        const intensity = data.get('lightIntensity');
        light.light.intensity = intensity;

        // disable the light completely when intensity is 0, including its gizmo
        light.enabled = intensity > 0;
        if (intensity > 0) {
            lightGizmo.attach(light);
        } else {
            lightGizmo.detach();
        }
    });

    data.on('lightColor:set', () => {
        const c = data.get('lightColor');
        light.light.color = new pc.Color(c[0], c[1], c[2]);
    });

    data.on('shadows:set', () => {
        light.light.castShadows = !!data.get('shadows');
    });

    // Omni lights with translate gizmos, used to interactively tune light placements - their
    // settings are logged to the console once a second
    const OMNI_LIGHTS = [
        { position: [12.02, 4.45, 9.04], radius: 12.9, intensity: 3.67, color: [1.00, 1.00, 1.00] },
        { position: [8.19, 4.67, 11.76], radius: 12.9, intensity: 3.67, color: [0.97, 0.91, 0.72] },
        { position: [4.22, 4.80, 13.69], radius: 12.9, intensity: 3.67, color: [0.97, 0.72, 0.72] },
        { position: [4.22, 4.80, 13.69], radius: 12.9, intensity: 3.67, color: [0.97, 0.72, 0.72] },
        { position: [-6.58, 0.52, -7.01], radius: 12.9, intensity: 3.67, color: [0.97, 0.72, 0.72] }
    ];

    /** @type {pc.Entity[]} */
    const omniLights = [];
    /** @type {pc.TranslateGizmo[]} */
    const omniGizmos = [];

    // Color / radius edits apply to all lights until one is moved using its gizmo - from then on
    // they apply only to the light last grabbed (-1 means all)
    let selectedOmni = -1;

    OMNI_LIGHTS.forEach((def, index) => {
        const entity = new pc.Entity(`omni-light-${index}`);
        entity.addComponent('light', {
            type: 'omni',
            color: new pc.Color(def.color[0], def.color[1], def.color[2]),
            intensity: def.intensity * data.get('omniIntensity'),
            range: def.radius,
            layers: [relightLayer.id],
            castShadows: !!data.get('omniShadows'),
            shadowType: pc.SHADOW_PCF3_32F,
            shadowResolution: 1024,
            shadowBias: 0.2,
            normalOffsetBias: 0.05,

            // the lights are static unless moved by their gizmo, so render their shadows once
            shadowUpdateMode: pc.SHADOWUPDATE_THISFRAME
        });
        entity.setLocalPosition(def.position[0], def.position[1], def.position[2]);
        app.root.addChild(entity);
        omniLights.push(entity);

        // translate gizmo to position the light; disable camera controls while dragging it
        const gizmo = new pc.TranslateGizmo(camera.camera, gizmoLayer);
        gizmo.size = 0.5;

        // double the size of the plane-movement squares
        gizmo.axisPlaneSize *= 2;
        gizmo.attach(entity);
        gizmo.on('pointer:down', (/** @type {number} */ _x, /** @type {number} */ _y, /** @type {pc.MeshInstance} */ meshInstance) => {
            if (meshInstance) {
                cc.enabled = false;

                // select this light for color / radius edits and sync the UI to its values
                selectedOmni = index;
                const lightComponent = /** @type {pc.LightComponent} */ (entity.light);
                data.set('omniColor', [lightComponent.color.r, lightComponent.color.g, lightComponent.color.b]);
                data.set('omniRadius', lightComponent.range);

                // update shadows every frame while the light is being moved
                lightComponent.shadowUpdateMode = pc.SHADOWUPDATE_REALTIME;
            }
        });
        gizmo.on('pointer:up', () => {
            cc.enabled = true;

            // render the shadows once more, then stop updating them
            entity.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
        });
        omniGizmos.push(gizmo);
    });

    // UI intensity is a multiplier on the per-light intensities; when zero, the lights are
    // disabled and their gizmos hidden
    const applyOmniIntensity = () => {
        const multiplier = data.get('omniIntensity');
        omniLights.forEach((entity, index) => {
            entity.light.intensity = OMNI_LIGHTS[index].intensity * multiplier;
            entity.enabled = multiplier > 0;
            if (multiplier > 0) {
                // refresh the static shadows after re-enabling
                entity.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
            }
        });
        omniGizmos.forEach((gizmo, index) => {
            if (multiplier > 0) {
                gizmo.attach(omniLights[index]);
            } else {
                gizmo.detach();
            }
        });
    };
    data.on('omniIntensity:set', applyOmniIntensity);

    data.on('omniRadius:set', () => {
        const radius = data.get('omniRadius');
        omniLights.forEach((entity, index) => {
            if (selectedOmni === -1 || selectedOmni === index) {
                entity.light.range = radius;

                // radius affects the shadow projection, refresh the static shadows
                entity.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
            }
        });
    });
    data.on('omniColor:set', () => {
        const c = data.get('omniColor');
        omniLights.forEach((entity, index) => {
            if (selectedOmni === -1 || selectedOmni === index) {
                entity.light.color = new pc.Color(c[0], c[1], c[2]);
            }
        });
    });
    data.on('omniShadows:set', () => {
        const castShadows = !!data.get('omniShadows');
        omniLights.forEach((entity) => {
            entity.light.castShadows = castShadows;
            if (castShadows) {
                // render the newly enabled shadows once
                entity.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
            }
        });
    });

    // Rotation of the image based lighting around the Y axis
    const envRotationQuat = new pc.Quat();
    const applyEnvRotation = () => {
        app.scene.skyboxRotation = envRotationQuat.setFromEulerAngles(0, data.get('envRotation'), 0);
    };
    applyEnvRotation();
    data.on('envRotation:set', applyEnvRotation);

    // Intensity of the image based lighting. The same value is used as the background multiplier
    // of the relighting effect, so the splat based sky follows the environment exposure.
    data.on('skyExposure:set', () => {
        app.scene.skyboxIntensity = data.get('skyExposure');
        relighting.background = data.get('skyExposure');
    });

    // Image based lighting for the proxy mesh. This needs to be the scene environment (not a
    // per-material env atlas), as skyboxIntensity and skyboxRotation only apply to materials
    // using the scene environment.
    app.scene.envAtlas = assets.envatlas.resource;

    // Instantiate the draco compressed proxy mesh matching the splat scene. It renders only to
    // the relighting layer, with a lit gray material configured to write a coverage mask to alpha.
    const meshEntity = assets.mesh.resource.instantiateRenderEntity();
    const meshMaterial = new pc.StandardMaterial();
    meshMaterial.diffuse = new pc.Color(0.5, 0.5, 0.5);
    meshMaterial.update();
    relighting.configureMaterial(meshMaterial);
    meshEntity.findComponents('render').forEach((/** @type {pc.RenderComponent} */ render) => {
        render.layers = [relightLayer.id];
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material = meshMaterial;
        });
    });

    // wrap in a parent so the same orientation as the splat can be applied
    const meshParent = new pc.Entity('mesh-parent');
    meshParent.addChild(meshEntity);
    meshParent.setLocalEulerAngles(data.get('orientation'), 0, 0);
    app.root.addChild(meshParent);

    // CameraFrame for HDR linear rendering (created lazily on first enable)
    /** @type {pc.CameraFrame|null} */
    let cameraFrame = null;

    const applyToneMapping = () => {
        const tm = data.get('toneMapping');
        if (cameraFrame?.enabled) {
            cameraFrame.rendering.toneMapping = tm;
            cameraFrame.update();
        } else {
            camera.camera.toneMapping = tm;
        }
    };

    data.set('cameraFrame', false);
    data.on('cameraFrame:set', () => {
        if (data.get('cameraFrame')) {
            if (!cameraFrame) {
                cameraFrame = new pc.CameraFrame(app, camera.camera);
                cameraFrame.rendering.toneMapping = data.get('toneMapping');
            }
            cameraFrame.enabled = true;
            cameraFrame.update();
        } else if (cameraFrame) {
            cameraFrame.destroy();
            cameraFrame = null;
        }
        applyToneMapping();
    });

    const applyFov = () => {
        const fov = data.get('cameraFov');
        camera.camera.fov = (data.get('fisheye') === 0) ? Math.min(fov, MAX_PERSPECTIVE_FOV) : fov;
    };
    data.on('cameraFov:set', applyFov);
    data.on('fisheye:set', () => {
        const fisheye = data.get('fisheye');
        app.scene.gsplat.fisheye = fisheye;
        app.scene.sky.fisheye = fisheye;
        applyFov();
    });
    data.on('toneMapping:set', applyToneMapping);
    data.on('exposure:set', () => {
        app.scene.exposure = data.get('exposure');
    });
    app.scene.exposure = data.get('exposure');

    data.on('fogDensity:set', () => {
        const density = data.get('fogDensity');
        if (density > 0) {
            app.scene.fog.type = pc.FOG_EXP;
            app.scene.fog.density = density;
            app.scene.fog.color.copy(camera.camera.clearColor);
        } else {
            app.scene.fog.type = pc.FOG_NONE;
        }
    });

    // HDRI environment loading
    /** @type {Map<string, { skybox: pc.Texture, envAtlas: pc.Texture }>} */
    const hdriCache = new Map();

    const applyEnvironment = async (/** @type {string} */ name) => {
        const url = ENV_PRESETS[name];
        if (!url) {
            app.scene.skybox = null;
            // restore the default environment used to light the proxy mesh
            app.scene.envAtlas = assets.envatlas.resource;
            return;
        }

        if (!hdriCache.has(url)) {
            const asset = new pc.Asset('hdri', 'texture', { url: url }, { mipmaps: false });
            await new Promise((resolve, reject) => {
                asset.on('load', resolve);
                asset.on('error', (/** @type {string} */ err) => {
                    console.error('Failed to load HDRI:', err);
                    reject(err);
                });
                app.assets.add(asset);
                app.assets.load(asset);
            });

            const source = asset.resource;
            const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
            const lighting = pc.EnvLighting.generateLightingSource(source);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            hdriCache.set(url, { skybox, envAtlas });
        }

        const cached = /** @type {{ skybox: pc.Texture, envAtlas: pc.Texture }} */ (hdriCache.get(url));
        app.scene.skybox = cached.skybox;
        app.scene.envAtlas = cached.envAtlas;
        app.scene.sky.type = pc.SKYTYPE_INFINITE;
    };

    data.on('environment:set', () => {
        applyEnvironment(data.get('environment')).catch((err) => {
            console.warn('Environment load failed:', err);
        });
    });

    // apply the initial environment
    applyEnvironment(data.get('environment')).catch((err) => {
        console.warn('Environment load failed:', err);
    });

    // Gsplat loading state
    /** @type {pc.Entity|null} */
    let gsplatEntity = null;
    /** @type {any} */
    let gsplatGs = null;
    /** @type {pc.Asset|null} */
    let customAsset = null;

    const applyPreset = () => {
        const preset = data.get('lodPreset');
        const presetData = LOD_PRESETS[preset] || LOD_PRESETS.desktop;
        if (gsplatGs) {
            gsplatGs.lodRangeMin = presetData.range[0];
            gsplatGs.lodRangeMax = presetData.range[1];
            gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
            gsplatGs.lodMultiplier = presetData.lodMultiplier;
        }
        data.set('lodBaseDistance', presetData.lodBaseDistance);
        data.set('lodMultiplier', presetData.lodMultiplier);
    };

    const loadGsplat = async (/** @type {string|null} */ url) => {
        if (gsplatEntity) {
            gsplatEntity.destroy();
            gsplatEntity = null;
            gsplatGs = null;
        }

        if (customAsset) {
            app.assets.remove(customAsset);
            customAsset.unload();
            customAsset = null;
        }

        /** @type {pc.Asset} */
        let asset;
        if (url) {
            asset = new pc.Asset('gsplat', 'gsplat', { url: url });
            app.assets.add(asset);
            await new Promise((resolve, reject) => {
                asset.on('load', resolve);
                asset.on('error', (/** @type {string} */ err) => {
                    console.error('Failed to load gsplat:', err);
                    reject(err);
                });
                app.assets.load(asset);
            });
            customAsset = asset; // eslint-disable-line require-atomic-updates
        } else {
            asset = assets.church;
        }

        gsplatEntity = new pc.Entity(config.name || 'gsplat'); // eslint-disable-line require-atomic-updates
        gsplatEntity.addComponent('gsplat', {
            asset: asset
        });
        gsplatEntity.setLocalPosition(0, 0, 0);
        gsplatEntity.setLocalEulerAngles(data.get('orientation'), 0, 0);
        gsplatEntity.setLocalScale(1, 1, 1);
        app.root.addChild(gsplatEntity);
        gsplatGs = /** @type {any} */ (gsplatEntity.gsplat);

        const presetData = LOD_PRESETS[data.get('lodPreset')] || LOD_PRESETS.desktop;
        gsplatGs.lodBaseDistance = presetData.lodBaseDistance;
        gsplatGs.lodMultiplier = presetData.lodMultiplier;

        // Start with lowest LOD for fast initial display, then stream up
        const lodLevels = gsplatGs.resource?.octree?.lodLevels;
        if (lodLevels) {
            const worstLod = lodLevels - 1;
            gsplatGs.lodRangeMin = worstLod;
            gsplatGs.lodRangeMax = worstLod;
        }

        const onFrameReady = (/** @type {any} */ cam, /** @type {any} */ layer, /** @type {boolean} */ ready, /** @type {number} */ loadingCount) => {
            if (ready && loadingCount === 0) {
                gsplatSystem.off('frame:ready', onFrameReady);
                applyPreset();
            }
        };
        gsplatSystem.on('frame:ready', onFrameReady);
    };

    // Initial load — use the observer's current url, which is paramUrl from the
    // hash query if set, or the share-URL state value applied during app.start().
    await loadGsplat(data.get('url') || null);

    data.on('lodPreset:set', applyPreset);

    data.on('lodBaseDistance:set', () => {
        if (gsplatGs) gsplatGs.lodBaseDistance = data.get('lodBaseDistance');
    });
    data.on('lodMultiplier:set', () => {
        if (gsplatGs) gsplatGs.lodMultiplier = data.get('lodMultiplier');
    });

    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };

    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    data.on('orientation:set', () => {
        if (gsplatEntity) {
            gsplatEntity.setLocalEulerAngles(data.get('orientation'), 0, 0);
        }
        meshParent.setLocalEulerAngles(data.get('orientation'), 0, 0);
    });

    data.on('url:set', () => {
        const url = data.get('url');
        loadGsplat(url || null).catch((err) => {
            console.warn('Loading failed, reverting to default:', err);
            loadGsplat(null);
        });
    });

    let logTexturesRequested = false;
    data.on('logTextures', () => {
        logTexturesRequested = true;
    });

    let logBuffersRequested = false;
    data.on('logBuffers', () => {
        logBuffersRequested = true;
    });

    app.on('update', () => {

        // debug display of the relighting texture
        if (data.get('debugRt') && relighting.texture) {
            // @ts-ignore engine-tsd
            app.drawTexture(0.6, -0.6, 0.7, 0.7, relighting.texture);
        }

        // log textures for one frame if requested
        pc.Tracing.set(pc.TRACEID_TEXTURES, logTexturesRequested);
        logTexturesRequested = false;

        pc.Tracing.set(pc.TRACEID_BUFFERS, logBuffersRequested);
        logBuffersRequested = false;

        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
        const bb = app.graphicsDevice.backBufferSize;
        data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
    });
});
