import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/camera-controls.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: `${rootPath}/static/lib/ammo/ammo.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/ammo/ammo.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/ammo/ammo.js`
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.CameraComponentSystem,
    pc.CollisionComponentSystem,
    pc.JointComponentSystem,
    pc.LightComponentSystem,
    pc.RenderComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [
    pc.ScriptHandler
];

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

// Start the app and create the scene
app.start();

// Create materials
const woodMaterial = new pc.StandardMaterial();
woodMaterial.diffuse = new pc.Color(0.7, 0.5, 0.3);
woodMaterial.update();

const anchorMaterial = new pc.StandardMaterial();
anchorMaterial.diffuse = new pc.Color(0.3, 0.3, 0.3);
anchorMaterial.update();

// Create the camera
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.5, 0.5, 0.8)
});
camera.addComponent('script');
camera.setLocalPosition(0, 7, 10);
app.root.addChild(camera);

camera.script.create(CameraControls, {
    attributes: {
        focusPoint: new pc.Vec3(0, 3, 0),
        sceneSize: 10
    }
});

// Create the light
const light = new pc.Entity('Light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.2,
    shadowDistance: 40,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

function createGround() {
    const ground = new pc.Entity();
    ground.addComponent('render', { type: 'plane' });
    ground.addComponent('rigidbody', {
        type: 'static',
        restitution: 0.5
    });
    ground.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(20, 0.5, 10),
        linearOffset: new pc.Vec3(0, -0.5, 0)
    });
    ground.setLocalScale(40, 1, 20);
    app.root.addChild(ground);
}

// Create a bridge with physics joints
function createBridge(startPos, endPos, segments) {
    const plankWidth = 0.5;    // Width along X axis (spacing between planks)
    const plankHeight = 0.1;   // Height along Y axis
    const plankLength = 2;     // Length along Z axis (across the bridge)
    
    const plankPos = startPos.clone();
    plankPos.x += plankWidth / 2;

    // Create bridge planks with minimal spacing
    const planks = [];
    for (let i = 0; i < segments; i++) {
        // Create the physics plank with no scaling
        const plank = new pc.Entity();
        plank.addComponent('rigidbody', {
            type: 'dynamic',
            mass: 0.5,
            friction: 0.6,
            restitution: 0.1
        });
        plank.addComponent('collision', {
            type: 'box',
            halfExtents: new pc.Vec3(plankWidth/2, plankHeight/2, plankLength/2)
        });

        // Position the plank
        plank.setLocalPosition(plankPos);
        plankPos.x += plankWidth;
        
        // Create a child entity for the visual representation
        const visualPlank = new pc.Entity('visual');
        visualPlank.addComponent('render', {
            type: 'box',
            material: woodMaterial
        });
        visualPlank.setLocalScale(plankWidth, plankHeight, plankLength);
        plank.addChild(visualPlank);
        
        app.root.addChild(plank);
        planks.push(plank);
    }

    // Connect planks with joints
    const jointPos = startPos.clone();
    jointPos.x += plankWidth;

    for (let i = 0; i < segments - 1; i++) {
        const joint = new pc.Entity();
        
        // Position the joint at the center of plankA
        joint.setLocalPosition(jointPos);
        jointPos.x += plankWidth;

        joint.addComponent('joint', {
            entityA: planks[i],
            entityB: planks[i + 1],
            enableCollision: false
        });
        app.root.addChild(joint);
    }

    // Create fixed anchor points in space
    function createFixedPoint(pos, plank) {
        const joint = new pc.Entity();
        joint.setLocalPosition(pos);

        joint.addComponent('joint', {
            entityA: plank,          // Only connect to the plank
            entityB: null,           // No second entity needed for fixed point
            enableCollision: false,
            angularMotionZ: pc.MOTION_FREE
        });
        app.root.addChild(joint);
    }

    // Create fixed points at start and end
    createFixedPoint(startPos, planks[0]);
    createFixedPoint(endPos, planks[planks.length - 1]);
}

// Create towers at the ends of the bridge
function createTower(position) {
    const towerWidth = 2;
    const towerHeight = 6;
    const towerDepth = 2;

    const tower = new pc.Entity('Tower');
    tower.addComponent('rigidbody', {
        type: 'static'
    });
    tower.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(towerWidth/2, towerHeight/2, towerDepth/2)
    });

    const visualTower = new pc.Entity('visual');
    visualTower.addComponent('render', {
        type: 'box',
        material: anchorMaterial
    });
    visualTower.setLocalScale(towerWidth, towerHeight, towerDepth);
    tower.addChild(visualTower);

    const towerPos = new pc.Vec3(position.x, position.y - 3, position.z);
    tower.setLocalPosition(towerPos);
    app.root.addChild(tower);
}

// Create bridge and towers
const towerWidth = 2;

// Calculate bridge connection points at tower sides and plank edges
const bridgeStart = new pc.Vec3(-5, 5, 0);  // Right side of left tower + half plank
const bridgeEnd = new pc.Vec3(5, 5, 0);     // Left side of right tower - half plank

createGround();
createTower(new pc.Vec3(-5 - towerWidth/2, 5, 0));
createTower(new pc.Vec3(5 + towerWidth/2, 5, 0));
createBridge(bridgeStart, bridgeEnd, 20);

// Create a test sphere to drop on the bridge
function createTestSphere(position) {
    const sphere = new pc.Entity();
    sphere.addComponent('render', {
        type: 'sphere'
    });
    sphere.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 5,
        friction: 0.5,
        restitution: 0.3
    });
    sphere.addComponent('collision', {
        type: 'sphere',
        radius: 0.5
    });
    sphere.setLocalPosition(position);
    app.root.addChild(sphere);
    return sphere;
}

// Add a sphere that can be dropped with spacebar
let testSphere = null;
app.keyboard.on('keydown', (event) => {
    if (event.key === pc.KEY_SPACE) {
        if (testSphere) {
            testSphere.destroy();
        }
        testSphere = createTestSphere(new pc.Vec3(0, 10, 0));
    }
});

export { app }; 