// @config DESCRIPTION This example demonstrates creating GSplat resources from images or procedural canvases and shows text labels that can face the camera.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = document.getElementById('application-canvas');
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`,
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

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

async function createImageGsplat(app, device, imageUrl, opts = {}) {
    const { name = 'gsplat', splatRadius = 1, subsample = 1, parent = null, pixelScale = 0.01 } = opts;

    const gsplatData = await pc.GSplatProcedural.generateImage({ url: imageUrl, splatRadius, subsample });
    const resource = new pc.GSplatResource(device, gsplatData);
    const generatedAsset = new pc.Asset(name, 'gsplat');
    generatedAsset.resource = resource;
    app.assets.add(generatedAsset);
    const ent = new pc.Entity(`${name}-entity`);
    ent.addComponent('gsplat', { asset: generatedAsset, unified: true });
    ent.setLocalScale(pixelScale, pixelScale, pixelScale);
    if (parent) {
        parent.addChild(ent);
    } else {
        app.root.addChild(ent);
    }
    return ent;
}

function textToDataURL(text, opts = {}) {
    const fontSize = opts.fontSize || 64;
    const fontFamily = opts.fontFamily || 'sans-serif';
    const padding = typeof opts.padding === 'number' ? opts.padding : 12;
    const strokeWidth =
        typeof opts.strokeWidth === 'number' ? opts.strokeWidth : Math.max(2, Math.round(fontSize * 0.08));

    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const font = `${fontSize}px ${fontFamily}`;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    const textHeight = fontSize;

    c.width = textWidth + padding * 2 + strokeWidth * 2;
    c.height = textHeight + padding * 2 + strokeWidth * 2;

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.clearRect(0, 0, c.width, c.height);

    const cx = c.width / 2;
    const cy = c.height / 2;

    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = opts.strokeStyle || 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, cx, cy);

    ctx.fillStyle = opts.fillStyle || '#ffffff';
    ctx.fillText(text, cx, cy);

    return c.toDataURL();
}

async function createTextLabelForEntity(app, device, targetEntity, text, opts = {}) {
    const {
        name = `label-${text.toLowerCase()}`,
        pixelScale = 0.001,
        pixelSize = 48,
        offsetY = 1.6,
        fontSize = 64,
        padding,
        faceCamera = true
    } = opts;
    const dataUrl = textToDataURL(text, { fontSize, fontFamily: 'sans-serif', padding });
    if (!dataUrl) return null;

    const labelEnt = await createImageGsplat(app, device, dataUrl, { name, parent: app.root, pixelScale });

    const pos = targetEntity.getPosition();
    labelEnt.setPosition(pos.x, pos.y + offsetY, pos.z);
    labelEnt._labelMeta = {
        pixelSize: pixelSize,
        targetEntity: targetEntity,
        offsetY: offsetY,
        pixelScale: pixelScale,
        faceCamera: faceCamera
    };

    return labelEnt;
}

const getViewportHeight = () => {
    const canvasEl = app.graphicsDevice.canvas;
    return canvasEl
        ? canvasEl.clientHeight * (window.devicePixelRatio || 1)
        : window.innerHeight * (window.devicePixelRatio || 1);
};

function computeWorldScale(pixelSize, distance, fovDeg, viewportHeight) {
    const fovRad = (fovDeg * Math.PI) / 180;
    return (pixelSize * distance * 2 * Math.tan(fovRad / 2)) / viewportHeight;
}

function updateLabelForCamera(label, meta, camComp) {
    const camEntity = camComp.entity;
    const tPos = meta.targetEntity.getPosition();
    label.setPosition(tPos.x, tPos.y + meta.offsetY, tPos.z);

    const entPos = label.getPosition();
    const camPos = camEntity.getPosition();

    if (meta.faceCamera !== false) {
        label.lookAt(camPos, pc.Vec3.UP);
        label.rotateLocal(0, 180, 0);
    }

    const dx = camPos.x - entPos.x;
    const dy = camPos.y - entPos.y;
    const dz = camPos.z - entPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const viewportHeight = getViewportHeight();
    const fovDeg = camComp.fov ?? camComp.camera?.fov ?? 45;
    const worldHeight = computeWorldScale(meta.pixelSize, distance, fovDeg, viewportHeight);
    const finalScale = worldHeight * (meta.pixelScale || 1);
    label.setLocalScale(finalScale, finalScale, finalScale);
}

async function createProceduralImageSplats(app, device, opts = {}) {
    const { parent = app.root, pixelScale = 0.01, pixelSize = 1 } = opts;

    const c = document.createElement('canvas');
    const size = 64;
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    if (!cx) return null;

    cx.clearRect(0, 0, size, size);
    const grad = cx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,64,0,1)');
    grad.addColorStop(0.6, 'rgba(255,64,0,0.9)');
    grad.addColorStop(1, 'rgba(255,64,0,0)');
    cx.fillStyle = grad;
    cx.beginPath();
    cx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.beginPath();
    cx.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
    cx.fill();

    const dataUrl = c.toDataURL();
    const procEntity = await createImageGsplat(app, device, dataUrl, {
        name: 'procedural-gsplat',
        parent,
        pixelScale
    });

    if (procEntity) {
        procEntity.setLocalPosition(1, 0, 0);

        app.on('update', () => {
            const cams = app.root.findComponents('camera');
            if (!cams || cams.length === 0) return;
            const camComp = cams[0];
            if (!procEntity) return;
            const dummyMeta = {
                pixelSize: pixelSize,
                targetEntity: procEntity,
                offsetY: 0,
                pixelScale: 1,
                faceCamera: true,
            };
            updateLabelForCamera(procEntity, dummyMeta, camComp);
        });
    }

    return procEntity;
}

const assets = {
    hotel: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/hotel-culpture.compressed.ply` }),
    biker: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/biker.compressed.ply` }),
    guitar: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/guitar.compressed.ply` }),
    orbit: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(async () => {
    app.start();

    const hotel = new pc.Entity('garage');
    hotel.addComponent('gsplat', { asset: assets.hotel, unified: true });
    hotel.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(hotel);

    const biker1 = new pc.Entity('biker1');
    biker1.addComponent('gsplat', { asset: assets.biker, unified: true });
    biker1.setLocalPosition(0, -1.8, -2);
    biker1.setLocalEulerAngles(180, 90, 0);
    app.root.addChild(biker1);

    const biker2 = biker1.clone();
    biker2.setLocalPosition(0, -1.8, 2);
    biker2.rotate(0, 150, 0);
    app.root.addChild(biker2);

    const guitar = new pc.Entity('guitar');
    guitar.addComponent('gsplat', { asset: assets.guitar, unified: true });
    guitar.setLocalPosition(2, -1.8, -0.5);
    guitar.setLocalEulerAngles(0, 0, 180);
    guitar.setLocalScale(0.7, 0.7, 0.7);
    app.root.addChild(guitar);

    let logo = await createImageGsplat(app, device, `${rootPath}/playcanvas-logo.png`, {
        name: 'logo-gsplat',
        parent: app.root,
        pixelScale: 0.005
    });

    logo.setLocalPosition(0, 2, 0);

    const camera = new pc.Entity();
    camera.addComponent('camera', { clearColor: pc.Color.BLACK, fov: 80, toneMapping: pc.TONEMAP_ACES });
    camera.setLocalPosition(3, 1, 0.5);

    camera.addComponent('script');
    if (camera.script) {
        camera.script.create('orbitCamera', {
            attributes: { inertiaFactor: 0.2, focusEntity: guitar, distanceMax: 100, frameOnStart: false },
        });
        camera.script.create('orbitCameraInputMouse');
        camera.script.create('orbitCameraInputTouch');
    }
    app.root.addChild(camera);

    const labels = [];
    const raiseOffset = 3.3;
    let l1 = await createTextLabelForEntity(app, device, biker1, 'Biker', {
        name: 'label-biker1',
        pixelScale: 0.01,
        offsetY: raiseOffset,
        fontSize: 64
    });
    labels.push(l1);
    l1.setLocalPosition(0, raiseOffset, 0);

    let l2 = await createTextLabelForEntity(app, device, biker2, 'Biker', {
        name: 'label-biker2',
        pixelScale: 0.01,
        offsetY: raiseOffset,
        fontSize: 64,
        faceCamera: false
    });
    labels.push(l2);
    l2.setLocalPosition(0, raiseOffset, 0);

    let lg = await createTextLabelForEntity(app, device, guitar, 'Guitar', {
        name: 'label-guitar',
        pixelScale: 0.01,
        offsetY: raiseOffset,
        fontSize: 64
    });
    labels.push(lg);
    lg.setLocalPosition(0, raiseOffset, 0);

    createProceduralImageSplats(app, device, { parent: app.root, pixelScale: 0.003 });

    app.on('update', () => {
        const cams = app.root.findComponents('camera');
        if (!cams || cams.length === 0) return;
        const camComp = cams[0];
        const camEntity = camComp.entity;
        if (!camEntity) return;

        labels.forEach((label) => {
            if (!label) return;
            const rawMeta = label._labelMeta;
            if (!rawMeta || !rawMeta.targetEntity) return;
            const meta = rawMeta;
            updateLabelForCamera(label, meta, camComp);
        });
    });
});

export { app };
