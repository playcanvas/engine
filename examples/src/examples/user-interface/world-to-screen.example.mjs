import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScreenComponentSystem,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    Vec4,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { CameraComponent, ScreenComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    checkboard: new Asset('checkboard', 'texture', { url: './assets/textures/checkboard.png' }),
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});
camera.rotateLocal(-30, 0, 0);
camera.translateLocal(0, 0, 7);
app.root.addChild(camera);

// Create an Entity for the ground
const material = new StandardMaterial();
material.diffuse = Color.WHITE;
material.diffuseMap = assets.checkboard.resource;
material.diffuseMapTiling = new Vec2(50, 50);
material.update();

const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material
});
ground.setLocalScale(50, 1, 50);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// Create an entity with a light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    intensity: 1,
    shadowBias: 0.2,
    shadowDistance: 16,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// Create a 2D screen
const screen = new Entity();
screen.setLocalScale(0.01, 0.01, 0.01);
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    screenSpace: true
});
app.root.addChild(screen);

/**
 * Converts a coordinate in world space into a screen's space.
 *
 * @param {Vec3} worldPosition - the Vec3 representing the world-space coordinate.
 * @param {CameraComponent} camera - the Camera.
 * @param {ScreenComponent} screen - the Screen
 * @returns {Vec3} a Vec3 of the input worldPosition relative to the camera and screen. The Z coordinate represents the depth,
 * and negative numbers signal that the worldPosition is behind the camera.
 */
function worldToScreenSpace(worldPosition, camera, screen) {
    const screenPos = camera.worldToScreen(worldPosition);

    // take pixel ratio into account
    const pixelRatio = app.graphicsDevice.maxPixelRatio;
    screenPos.x *= pixelRatio;
    screenPos.y *= pixelRatio;

    // account for screen scaling
    const scale = screen.scale;

    // invert the y position
    screenPos.y = screen.resolution.y - screenPos.y;

    // put that into a Vec3
    return new Vec3(screenPos.x / scale, screenPos.y / scale, screenPos.z / scale);
}

/**
 * @param {number} id - The player ID.
 * @param {number} startingAngle - The starting angle.
 * @param {number} speed - The speed.
 * @param {number} radius - The radius.
 */
function createPlayer(id, startingAngle, speed, radius) {
    // Create a capsule entity to represent a player in the 3d world
    const entity = new Entity();
    entity.setLocalScale(new Vec3(0.5, 0.5, 0.5));
    entity.addComponent('render', {
        type: 'capsule'
    });
    app.root.addChild(entity);

    // update the player position every frame with some mock logic
    // normally, this would be taking inputs, running physics simulation, etc
    let angle = startingAngle;
    const height = 0.5;
    app.on('update', (dt) => {
        angle += dt * speed;
        if (angle > 360) {
            angle -= 360;
        }
        entity.setLocalPosition(
            radius * Math.sin(angle * math.DEG_TO_RAD),
            height,
            radius * Math.cos(angle * math.DEG_TO_RAD)
        );
        entity.setLocalEulerAngles(0, angle + 90, 0);
    });

    // Create a text element that will hover the player's head
    const playerInfo = new Entity();
    playerInfo.addComponent('element', {
        pivot: new Vec2(0.5, 0),
        anchor: new Vec4(0, 0, 0, 0),
        width: 150,
        height: 50,
        opacity: 0.05,
        type: ELEMENTTYPE_IMAGE
    });
    screen.addChild(playerInfo);

    const name = new Entity();
    name.addComponent('element', {
        pivot: new Vec2(0.5, 0.5),
        anchor: new Vec4(0, 0.4, 1, 1),
        margin: new Vec4(0, 0, 0, 0),
        fontAsset: assets.font.id,
        fontSize: 20,
        text: `Player ${id}`,
        useInput: true,
        type: ELEMENTTYPE_TEXT
    });
    name.addComponent('button', {
        imageEntity: name
    });
    name.button.on('click', () => {
        const color = new Color(Math.random(), Math.random(), Math.random());
        name.element.color = color;
        entity.render.material.setParameter('material_diffuse', [color.r, color.g, color.b]);
    });
    playerInfo.addChild(name);

    const healthBar = new Entity();
    healthBar.addComponent('element', {
        pivot: new Vec2(0.5, 0),
        anchor: new Vec4(0, 0, 1, 0.4),
        margin: new Vec4(0, 0, 0, 0),
        color: new Color(0.2, 0.6, 0.2, 1),
        opacity: 1,
        type: ELEMENTTYPE_IMAGE
    });
    playerInfo.addChild(healthBar);

    // update the player text's position to always hover the player
    app.on('update', () => {
        // get the desired world position
        const worldPosition = entity.getPosition();
        worldPosition.y += 0.6; // slightly above the player's head

        // convert to screen position
        const screenPosition = worldToScreenSpace(worldPosition, camera.camera, screen.screen);

        if (screenPosition.z > 0) {
            // if world position is in front of the camera, show it
            playerInfo.enabled = true;

            // set the UI position
            playerInfo.setLocalPosition(screenPosition);
        } else {
            // if world position is actually *behind* the camera, hide the UI
            playerInfo.enabled = false;
        }
    });
}

createPlayer(1, 135, 30, 1.5);
createPlayer(2, 65, -18, 1);
createPlayer(3, 0, 15, 2.5);
