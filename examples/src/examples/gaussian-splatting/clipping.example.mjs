// @config
//
// Demonstrates clipping gaussian splats by an animated world-space box, using custom varying
// streams: the vertex stage customization classifies each splat against the box once per splat,
// clipping splats fully inside and passing a flag to the fragment stage as a custom varying.
// Only splats intersecting the box surface pay for the per-pixel clipping test.
//
// @credit
// title: PLAYBOT
// author: Stephane Agullo
// source: https://superspl.at/view?id=ee6d8bc4
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import clipGlslVert from './clip.glsl.vert';
import clipWgslVert from './clip.wgsl.vert';
import clipGlslFrag from './clip.glsl.frag';
import clipWgslFrag from './clip.wgsl.frag';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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

// auto resolution: treat DPR >= 2 as high-DPI (drops to half)
const applyResolution = () => {
    const dpr = window.devicePixelRatio || 1;
    device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;
};
applyResolution();

// Ensure DPR and canvas are updated when window changes size
const resize = () => {
    applyResolution();
    app.resizeCanvas();
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// configuration for grid instances
const GRID_SIZE = 5; // N x N grid
const GRID_SPACING = 2; // spacing between instances in world units

const assets = {
    playbot: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/playbot/lod-meta.json' }),
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 3;
    app.scene.exposure = 1.5;

    // Add a custom varying stream: written once per splat by the vertex stage customization
    // using setClipState(value), and read per fragment using getClipState()
    app.scene.gsplat.varyings.add([
        { name: 'clipState', type: pc.TYPE_UINT32, components: 1 }
    ]);

    // apply the clipping customization to the scene-wide gsplat material
    const material = app.scene.gsplat.material;
    material.getShaderChunks('glsl').set('gsplatModifyVS', clipGlslVert);
    material.getShaderChunks('wgsl').set('gsplatModifyVS', clipWgslVert);
    material.getShaderChunks('glsl').set('gsplatModifyPS', clipGlslFrag);
    material.getShaderChunks('wgsl').set('gsplatModifyPS', clipWgslFrag);
    material.update();

    data.on('renderer:set', () => {
        app.scene.gsplat.renderer = data.get('renderer');
        const current = app.scene.gsplat.currentRenderer;
        if (current !== data.get('renderer')) {
            setTimeout(() => data.set('renderer', current), 0);
        }
    });
    data.set('renderer', pc.GSPLAT_RENDERER_AUTO);
    data.set('animate', true);

    // enable rotation-based LOD updates and behind-camera penalty
    app.scene.gsplat.lodUpdateAngle = 90;
    app.scene.gsplat.lodBehindPenalty = 4;

    // allow rendering with lower LOD quality when optimal is not yet loaded
    app.scene.gsplat.lodUnderfillLimit = 10;

    data.set('splatBudget', pc.platform.mobile ? 1 : 3);

    // create grid of instances centered around origin on XZ plane
    const half = (GRID_SIZE - 1) * 0.5;
    for (let z = 0; z < GRID_SIZE; z++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const entity = new pc.Entity(`playbot-${x}-${z}`);
            entity.addComponent('gsplat', {
                asset: assets.playbot
            });
            const px = (x - half) * GRID_SPACING;
            const pz = (z - half) * GRID_SPACING;
            entity.setLocalPosition(px, 0, pz);
            entity.setLocalEulerAngles(180, 0, 0);
            app.root.addChild(entity);
            const gs = /** @type {any} */ (entity.gsplat);
            gs.lodBaseDistance = 1.2;
        }
    }

    const applySplatBudget = () => {
        const millions = data.get('splatBudget');
        app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
    };

    applySplatBudget();
    data.on('splatBudget:set', applySplatBudget);

    // Create a camera with fly controls
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        fov: 75,
        toneMapping: pc.TONEMAP_ACES
    });

    camera.setLocalPosition(4, 2.6, 4);
    app.root.addChild(camera);

    camera.addComponent('script');
    const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
    Object.assign(cc, {
        sceneSize: 500,
        moveSpeed: 1.5,
        moveFastSpeed: 5,
        enableOrbit: true,
        enablePan: true,
        focusPoint: new pc.Vec3(0, 0.8, 0)
    });

    // the animated clipping box
    const clipCenter = new pc.Vec3(0, 0.8, 0);
    const clipHalf = new pc.Vec3(2.1, 1, 2.1);
    const clipCenterArray = [clipCenter.x, clipCenter.y, clipCenter.z];
    const clipHalfArray = [clipHalf.x, clipHalf.y, clipHalf.z];
    const invViewProj = new pc.Mat4();
    const boxMin = new pc.Vec3();
    const boxMax = new pc.Vec3();

    let time = 0;
    app.on('update', (dt) => {
        if (data.get('animate')) {
            time += dt;
        }

        // stretch the box along x and z using different sin waves
        clipHalf.x = 2.1 + Math.sin(time * 0.7) * 1.05;
        clipHalf.z = 2.1 + Math.sin(time * 1.1) * 1.05;
        clipHalfArray[0] = clipHalf.x;
        clipHalfArray[2] = clipHalf.z;

        // drive the clipping uniforms
        material.setParameter('uClipCenter', clipCenterArray);
        material.setParameter('uClipHalf', clipHalfArray);
        invViewProj.mul2(camera.camera.projectionMatrix, camera.camera.viewMatrix).invert();
        material.setParameter('uInvViewProj', invViewProj.data);
        material.update();

        // draw the clipping box
        boxMin.copy(clipCenter).sub(clipHalf);
        boxMax.copy(clipCenter).add(clipHalf);
        app.drawWireAlignedBox(boxMin, boxMax, pc.Color.YELLOW);

        // stats
        data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    });
});
