// @config
//
// Single-frame color and depth texture previews with normalized coordinates.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_WORLD,
    LightComponentSystem,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGBA8,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    StandardMaterial,
    Texture,
    TextureRenderer,
    TONEMAP_ACES,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
const options = new AppOptions();
options.graphicsDevice = device;
options.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// A moving sculpture gives the live color and depth previews recognizable silhouettes.
app.scene.ambientLight = new Color(0.22, 0.25, 0.32);
const materials = [];
const sculpture = new Entity('Sculpture');
app.root.addChild(sculpture);

/**
 * @param {string} type - Primitive type.
 * @param {number[]} position - Local position.
 * @param {number[]} scale - Local scale.
 * @param {string} color - Surface color.
 * @returns {Entity} The primitive.
 */
function primitive(type, position, scale, color) {
    const material = new StandardMaterial();
    material.diffuse = new Color().fromString(color);
    material.gloss = 0.55;
    material.update();
    materials.push(material);
    const entity = new Entity(type);
    entity.addComponent('render', { type, material });
    entity.setLocalPosition(position[0], position[1], position[2]);
    entity.setLocalScale(scale[0], scale[1], scale[2]);
    sculpture.addChild(entity);
    return entity;
}

primitive('cylinder', [0, -0.2, 0], [6.7, 0.4, 6.7], '#283545');
for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const height = 0.8 + (i % 3) * 0.6;
    const x = Math.sin(angle) * 2.25;
    const z = Math.cos(angle) * 2.25;
    primitive('box', [x, height * 0.5, z], [0.5, height, 0.5], '#405366');
    primitive('sphere', [x, height + 0.38, z], [0.72, 0.72, 0.72], ['#67dccb', '#ffbb65', '#f07976'][i % 3]);
}
const centerpiece = primitive('cone', [0, 1.3, 0], [1.5, 2.6, 1.5], '#e4edf2');
const light = new Entity('Key light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.9, 0.76),
    intensity: 2.4,
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 25,
    normalOffsetBias: 0.05
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.018, 0.025, 0.04),
    fov: 48,
    farClip: 24,
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(8, 6.5, 11);
camera.lookAt(0, 0.1, 0);
app.root.addChild(camera);
// sceneDepth uses the depth map belonging to the camera rendering the preview layer.
camera.camera.requestSceneDepthMap(true);

const liveTexture = new Texture(device, {
    name: 'Live camera color',
    width: 512,
    height: 320,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});
const target = new RenderTarget({ colorBuffer: liveTexture, depth: true, origin: RENDERTARGET_ORIGIN_TOP });
const textureCamera = new Entity('Texture camera');
textureCamera.addComponent('camera', {
    // Exclude Immediate so previews are not rendered into their own source.
    layers: [LAYERID_WORLD],
    priority: -1,
    renderTarget: target,
    clearColor: new Color(0.025, 0.04, 0.065),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(textureCamera);

// An asymmetric image makes UV orientation visible without external assets.
const source = document.createElement('canvas');
source.width = 512;
source.height = 320;
const context = source.getContext('2d');
const gradient = context.createLinearGradient(0, 0, 512, 320);
gradient.addColorStop(0, '#164b66');
gradient.addColorStop(1, '#b15359');
context.fillStyle = gradient;
context.fillRect(0, 0, 512, 320);
context.strokeStyle = '#ffffff25';
for (let x = 0; x < 512; x += 32) {
    for (let y = 0; y < 320; y += 32) context.strokeRect(x, y, 32, 32);
}
context.fillStyle = '#73e4d1';
context.fillRect(24, 24, 8, 65);
context.fillStyle = '#ffffff';
context.font = 'bold 30px sans-serif';
context.fillText('TEXTURE / 01', 48, 58);
context.font = '16px monospace';
context.fillText('TOP LEFT  (0, 0)', 48, 84);
context.fillText('(1, 1)  BOTTOM RIGHT', 292, 288);
context.beginPath();
context.arc(256, 178, 55, 0, Math.PI * 2);
context.lineWidth = 3;
context.strokeStyle = '#ffffff';
context.stroke();
context.fillStyle = '#ffc575';
context.fillRect(246, 125, 20, 53);
// Store an alpha gradient so the alpha channel has useful content to inspect.
context.globalCompositeOperation = 'destination-in';
const alphaGradient = context.createLinearGradient(0, 0, 512, 0);
alphaGradient.addColorStop(0, 'rgba(255,255,255,0)');
alphaGradient.addColorStop(1, 'rgba(255,255,255,1)');
context.fillStyle = alphaGradient;
context.fillRect(0, 0, 512, 320);
const imageTexture = new Texture(device, {
    name: 'UV test image',
    width: source.width,
    height: source.height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: false
});
imageTexture.setSource(source);

// Draw each texture on every frame its preview should be visible.
const textures = new TextureRenderer(app);
data.set('settings', { previews: true, animate: true, swap: false, channels: 'rgb' });

// Captions sit outside the sampled images, keeping texture contents unmodified.
const captions = document.createElement('div');
captions.style.cssText =
    'position:absolute;inset:0;pointer-events:none;color:#c6d4df;font:11px monospace;letter-spacing:1px;';
const titles = ['01 / SOURCE IMAGE', '02 / LIVE CAMERA', '03 / SCENE DEPTH'];
for (let i = 0; i < titles.length; i++) {
    const caption = document.createElement('div');
    caption.textContent = titles[i];
    caption.style.cssText = `position:absolute;left:${4 + i * 32}%;top:69%;`;
    captions.appendChild(caption);
}
document.body.appendChild(captions);

let time = 0;
app.on('update', (dt) => {
    if (data.get('settings.animate')) time += dt;
    sculpture.setLocalEulerAngles(0, time * 12, 0);
    centerpiece.setLocalEulerAngles(0, 0, Math.sin(time) * 12);
    textureCamera.setLocalPosition(Math.sin(time * 0.3) * 8, 4.5, Math.cos(time * 0.3) * 8);
    textureCamera.lookAt(0, 0.7, 0);

    const show = data.get('settings.previews');
    captions.style.display = show ? '' : 'none';
    if (show) {
        const swap = data.get('settings.swap');
        // Coordinates are fractions of the viewport, measured from its top-left corner.
        // Switching textures needs no matching ID, or add/remove calls.
        textures.channels = data.get('settings.channels');
        textures.draw(swap ? liveTexture : imageTexture, 0.04, 0.73, 0.28, 0.23);
        textures.draw(swap ? imageTexture : liveTexture, 0.36, 0.73, 0.28, 0.23);
        // Depth previews stay grayscale regardless of the channel selection.
        textures.sceneDepth(0.68, 0.73, 0.28, 0.23);
        captions.children[0].textContent = swap ? titles[1] : titles[0];
        captions.children[1].textContent = swap ? titles[0] : titles[1];
    }
    // Skipping the calls hides all previews for this frame.
});

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    captions.remove();
    target.destroy();
    liveTexture.destroy();
    imageTexture.destroy();
    materials.forEach((material) => material.destroy());
});
app.start();
