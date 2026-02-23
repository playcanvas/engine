// @config DESCRIPTION This example demonstrates the HTML-in-Canvas proposal using texElement2D to render HTML content directly as a WebGL texture. Features graceful fallback to canvas rendering when not supported.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));

// Enable layoutsubtree for HTML-in-Canvas support
canvas.setAttribute('layoutsubtree', '');
// Alternative attribute names that might be used in different implementations
canvas.setAttribute('data-layoutsubtree', '');
canvas.style.contain = 'layout style paint';

window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create an HTML element to use as texture source
// According to the HTML-in-Canvas proposal, the element must be a direct child of the canvas
const htmlElement = document.createElement('div');
htmlElement.style.width = '512px';
htmlElement.style.height = '512px';
htmlElement.style.position = 'absolute';
htmlElement.style.top = '0';
htmlElement.style.left = '0';
htmlElement.style.pointerEvents = 'none'; // Prevent interaction
htmlElement.style.zIndex = '-1'; // Place behind canvas content
htmlElement.style.backgroundColor = '#ff6b6b';
htmlElement.style.background = 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24)';
htmlElement.style.borderRadius = '20px';
htmlElement.style.padding = '20px';
htmlElement.style.fontFamily = 'Arial, sans-serif';
htmlElement.style.fontSize = '24px';
htmlElement.style.color = 'white';
htmlElement.style.textAlign = 'center';
htmlElement.style.display = 'flex';
htmlElement.style.flexDirection = 'column';
htmlElement.style.justifyContent = 'center';
htmlElement.style.alignItems = 'center';
htmlElement.innerHTML = `
    <h1 style="margin: 0 0 20px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">HTML in Canvas!</h1>
    <p style="margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">This texture is rendered from HTML using texElement2D</p>
    <div id="animated-element" style="margin-top: 20px; width: 50px; height: 50px; background: white; border-radius: 50%; animation: pulse 2s infinite;">
    </div>
`;

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Add the HTML element as a direct child of the canvas
canvas.appendChild(htmlElement);

// Create texture from HTML element
const htmlTexture = new pc.Texture(device, {
    width: 512,
    height: 512,
    format: pc.PIXELFORMAT_RGBA8,
    name: 'htmlTexture'
});

// Helper function to create fallback canvas texture
const createFallbackTexture = () => {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 512;
    fallbackCanvas.height = 512;
    const ctx = fallbackCanvas.getContext('2d');

    if (!ctx) {
        console.error('Failed to get 2D context');
        return null;
    }

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
    ctx.fillText('texElement2D not available', 256, 260);

    ctx.beginPath();
    ctx.arc(256, 320, 25, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    return fallbackCanvas;
};

// Set the HTML element as the texture source
if (device.supportsTexElement2D) {
    console.log('texElement2D is supported - attempting to use HTML element as texture');
    try {
        htmlTexture.setSource(/** @type {any} */ (htmlElement));
        console.log('Successfully set HTML element as texture source');
    } catch (error) {
        console.warn('Failed to use texElement2D:', error.message);
        console.log('Falling back to canvas rendering');

        const fallbackCanvas = createFallbackTexture();
        if (fallbackCanvas) {
            htmlTexture.setSource(fallbackCanvas);
        }
    }
} else {
    console.warn('texElement2D is not supported - falling back to canvas rendering');
    const fallbackCanvas = createFallbackTexture();
    if (fallbackCanvas) {
        htmlTexture.setSource(fallbackCanvas);
    }
}

// Create material with the HTML texture
const material = new pc.StandardMaterial();
material.diffuseMap = htmlTexture;
material.update();

// create box entity
const box = new pc.Entity('cube');
box.addComponent('render', {
    type: 'box',
    material: material
});
app.root.addChild(box);

// create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// create directional light entity
const light = new pc.Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// Update the HTML texture periodically to capture animations
let updateCounter = 0;
app.on('update', (/** @type {number} */ dt) => {
    box.rotate(10 * dt, 20 * dt, 30 * dt);

    // Update texture every few frames to capture HTML animations
    updateCounter += dt;
    if (updateCounter > 0.1) { // Update 10 times per second
        updateCounter = 0;
        if (device.supportsTexElement2D) {
            htmlTexture.upload();
        }
    }
});

export { app };
