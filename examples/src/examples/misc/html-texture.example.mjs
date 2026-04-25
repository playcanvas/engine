// @config DESCRIPTION <div style="color:black">Renders live HTML content directly as a WebGL texture via the <b>HTML-in-Canvas</b> API (<code>texElementImage2D</code>).<br>Includes animated CSS gradients, text glow, and a pulsing circle — all driven by standard CSS.</div>
//
// This example demonstrates the HTML-in-Canvas API: a styled HTML element with
// CSS animations is appended to a canvas marked with the "layoutsubtree"
// attribute, then captured into a WebGL texture via texElementImage2D.
//
// Fallback: when device.supportsHtmlTextures is false, a static 2D canvas with
// hand-drawn placeholder graphics is used as the texture source instead.
//
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));

// Enable layoutsubtree for HTML-in-Canvas support
canvas.setAttribute('layoutsubtree', 'true');

window.focus();

const assets = {
    envatlas: new pc.Asset(
        'env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// Create an HTML element to use as texture source.
// Per the HTML-in-Canvas proposal, the element must be a direct child of the canvas.
// The 'inert' attribute prevents hit testing on the element.
const htmlElement = document.createElement('div');
htmlElement.setAttribute('inert', '');
htmlElement.style.width = '512px';
htmlElement.style.height = '512px';
htmlElement.style.padding = '10px';
htmlElement.style.background = 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24)';
htmlElement.style.backgroundSize = '400% 400%';
htmlElement.style.animation = 'gradient-shift 4s ease infinite';
htmlElement.style.borderRadius = '0';
htmlElement.style.fontFamily = 'Arial, sans-serif';
htmlElement.style.fontSize = '24px';
htmlElement.style.color = 'white';
htmlElement.style.textAlign = 'center';
htmlElement.style.display = 'flex';
htmlElement.style.flexDirection = 'column';
htmlElement.style.justifyContent = 'center';
htmlElement.style.alignItems = 'center';
htmlElement.innerHTML = `
    <h1 style="margin: 0 0 20px 0; animation: glow 3s ease-in-out infinite;">HTML in Canvas!</h1>
    <p style="margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">This texture is rendered from HTML using texElementImage2D</p>
    <div style="margin-top: 20px; width: 50px; height: 50px; border-radius: 50%; animation: pulse 2s infinite;"></div>
`;

const style = document.createElement('style');
style.textContent = `
    @keyframes glow {
        0%, 100% { color: white;   text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4); font-size: 42px; }
        50%      { color: #f9ca24; text-shadow: 0 0 15px rgba(0,0,0,0.8), 0 0 30px #f9ca24, 0 0 60px #f9ca24, 0 0 90px rgba(249,202,36,0.4); font-size: 48px; }
    }
    @keyframes gradient-shift {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    @keyframes pulse {
        0%   { transform: scale(1);   background: #ff6b6b; }
        25%  { transform: scale(1.2); background: #f9ca24; }
        50%  { transform: scale(1);   background: #4ecdc4; }
        75%  { transform: scale(1.2); background: #45b7d1; }
        100% { transform: scale(1);   background: #ff6b6b; }
    }
`;
document.head.appendChild(style);

canvas.appendChild(htmlElement);

// Create texture
const htmlTexture = new pc.Texture(device, {
    width: 512,
    height: 512,
    format: pc.PIXELFORMAT_RGBA8,
    name: 'htmlTexture'
});

// Fallback canvas texture for browsers without texElementImage2D support
const createFallbackTexture = () => {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 512;
    fallbackCanvas.height = 512;
    const ctx = fallbackCanvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.33, '#4ecdc4');
    gradient.addColorStop(0.66, '#45b7d1');
    gradient.addColorStop(1, '#f9ca24');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('HTML in Canvas!', 256, 180);

    ctx.font = '20px Arial';
    ctx.fillText('(Canvas Fallback)', 256, 220);
    ctx.fillText('texElementImage2D not available', 256, 260);

    ctx.beginPath();
    ctx.arc(256, 320, 25, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    return fallbackCanvas;
};

// Start with fallback texture, then switch to HTML source once the paint record is ready
const fallbackCanvas = createFallbackTexture();
if (fallbackCanvas) {
    htmlTexture.setSource(fallbackCanvas);
}

const onPaintUpload = () => {
    if (!app.graphicsDevice) return;
    htmlTexture.upload();
};

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('paint', onPaintUpload);
    if (htmlElement.parentNode) htmlElement.parentNode.removeChild(htmlElement);
    if (style.parentNode) style.parentNode.removeChild(style);
});

if (device.supportsHtmlTextures) {
    // The browser must paint the HTML element before texElementImage2D can use it.
    // Wait for the 'paint' event, then set the HTML element as the texture source.
    canvas.addEventListener('paint', () => {
        htmlTexture.setSource(/** @type {any} */ (htmlElement));
    }, { once: true });
    canvas.requestPaint();

    // Re-upload the texture whenever the browser repaints the HTML children
    canvas.addEventListener('paint', onPaintUpload);
} else {
    console.warn('HTML textures are not supported - using canvas fallback');
}

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.envAtlas = assets.envatlas.resource;
    app.scene.skyboxMip = 0;
    app.scene.skyboxIntensity = 2;
    app.scene.exposure = 1.5;

    // Create metallic material with the HTML texture for mirror-like reflections
    const material = new pc.StandardMaterial();
    material.diffuseMap = htmlTexture;
    material.useMetalness = true;
    material.metalness = 0.7;
    material.gloss = 0.9;
    material.update();

    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box',
        material: material
    });
    app.root.addChild(box);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        intensity: 1.5
    });
    app.root.addChild(light);
    light.setEulerAngles(45, 30, 0);

    app.on('update', (/** @type {number} */ dt) => {
        box.rotate(3 * dt, 5 * dt, 6 * dt);
    });
});

export { app };
