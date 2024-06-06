import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: rootPath + '/static/lib/ammo/ammo.wasm.js',
    wasmUrl: rootPath + '/static/lib/ammo/ammo.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/ammo/ammo.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.JsonHandler,
    pc.FontHandler
];

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

app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);
/**
 * @param {pc.Color} color - The diffuse color.
 * @returns {pc.StandardMaterial} The standard material.
 */
function createMaterial(color) {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

// Create a couple of materials for our objects
const red = createMaterial(new pc.Color(0.7, 0.3, 0.3));
const gray = createMaterial(new pc.Color(0.7, 0.7, 0.7));

// Define a scene hierarchy in JSON format. This is loaded/parsed in
// the parseScene function below
const scene = [
    {
        // The Chair entity has a collision component of type 'compound' and a
        // rigidbody component. This means that any descendent entity with a
        // collision component is added to a compound collision shape on the
        // Chair entity. You can use compound collision shapes to define
        // complex, rigid shapes.
        name: 'Chair',
        pos: [0, 1, 0],
        components: [
            {
                type: 'collision',
                options: {
                    type: 'compound'
                }
            },
            {
                type: 'rigidbody',
                options: {
                    type: 'dynamic',
                    friction: 0.5,
                    mass: 10,
                    restitution: 0.5
                }
            }
        ],
        children: [
            {
                name: 'Seat',
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'box',
                            halfExtents: [0.25, 0.025, 0.25]
                        }
                    }
                ],
                children: [
                    {
                        name: 'Seat Model',
                        scl: [0.5, 0.05, 0.5],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'box',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            },
            {
                name: 'Seat Back',
                pos: [0, 0.3, -0.2],
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'box',
                            halfExtents: [0.25, 0.2, 0.025]
                        }
                    }
                ],
                children: [
                    {
                        name: 'Seat Back Model',
                        scl: [0.5, 0.4, 0.05],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'box',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            },
            {
                name: 'Leg 1',
                pos: [0.2, -0.25, 0.2],
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'cylinder',
                            height: 0.5,
                            radius: 0.025
                        }
                    }
                ],
                children: [
                    {
                        name: 'Leg 1 Model',
                        scl: [0.05, 0.5, 0.05],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'cylinder',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            },
            {
                name: 'Leg 2',
                pos: [-0.2, -0.25, 0.2],
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'cylinder',
                            height: 0.5,
                            radius: 0.025
                        }
                    }
                ],
                children: [
                    {
                        name: 'Leg 2 Model',
                        scl: [0.05, 0.5, 0.05],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'cylinder',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            },
            {
                name: 'Leg 3',
                pos: [0.2, 0, -0.2],
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'cylinder',
                            height: 1,
                            radius: 0.025
                        }
                    }
                ],
                children: [
                    {
                        name: 'Leg 3 Model',
                        scl: [0.05, 1, 0.05],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'cylinder',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            },
            {
                name: 'Leg 4',
                pos: [-0.2, 0, -0.2],
                components: [
                    {
                        type: 'collision',
                        options: {
                            type: 'cylinder',
                            height: 1,
                            radius: 0.025
                        }
                    }
                ],
                children: [
                    {
                        name: 'Leg 4 Model',
                        scl: [0.05, 1, 0.05],
                        components: [
                            {
                                type: 'render',
                                options: {
                                    type: 'cylinder',
                                    material: gray
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'Ground',
        pos: [0, -0.5, 0],
        components: [
            {
                type: 'collision',
                options: {
                    type: 'box',
                    halfExtents: [5, 0.5, 5]
                }
            },
            {
                type: 'rigidbody',
                options: {
                    type: 'static',
                    restitution: 0.5
                }
            }
        ],
        children: [
            {
                name: 'Ground Model',
                scl: [10, 1, 10],
                components: [
                    {
                        type: 'render',
                        options: {
                            type: 'box',
                            material: gray
                        }
                    }
                ]
            }
        ]
    },
    {
        name: 'Directional Light',
        rot: [45, 130, 0],
        components: [
            {
                type: 'light',
                options: {
                    type: 'directional',
                    castShadows: true,
                    shadowDistance: 8,
                    shadowBias: 0.1,
                    intensity: 1,
                    normalOffsetBias: 0.05
                }
            }
        ]
    },
    {
        name: 'Camera',
        pos: [0, 4, 7],
        rot: [-30, 0, 0],
        components: [
            {
                type: 'camera',
                options: {
                    color: [0.5, 0.5, 0.5]
                }
            }
        ]
    }
];

/**
 * Convert an entity definition in the structure above to a pc.Entity object
 *
 * @param {typeof scene} e - The scene definition.
 * @returns {pc.Entity} The entity.
 */
function parseEntity(e) {
    const entity = new pc.Entity(e.name);

    if (e.pos) {
        entity.setLocalPosition(e.pos[0], e.pos[1], e.pos[2]);
    }
    if (e.rot) {
        entity.setLocalEulerAngles(e.rot[0], e.rot[1], e.rot[2]);
    }
    if (e.scl) {
        entity.setLocalScale(e.scl[0], e.scl[1], e.scl[2]);
    }

    if (e.components) {
        e.components.forEach(function (c) {
            entity.addComponent(c.type, c.options);
        });
    }

    if (e.children) {
        e.children.forEach(function (/** @type {typeof scene} */ child) {
            entity.addChild(parseEntity(child));
        });
    }

    return entity;
}

// Parse the scene data above into entities and add them to the scene's root entity
function parseScene(s) {
    s.forEach(function (e) {
        app.root.addChild(parseEntity(e));
    });
}

parseScene(scene);

let numChairs = 0;

// Clone the chair entity hierarchy and add it to the scene root
function spawnChair() {
    /** @type {pc.Entity} */
    const chair = app.root.findByName('Chair');
    const clone = chair.clone();
    clone.setLocalPosition(Math.random() * 1 - 0.5, Math.random() * 2 + 1, Math.random() * 1 - 0.5);
    app.root.addChild(clone);
    numChairs++;
}

// Set an update function on the application's update event
let time = 0;
app.on('update', function (dt) {
    // Add a new chair every 250 ms
    time += dt;
    if (time > 0.25 && numChairs < 20) {
        spawnChair();
        time = 0;
    }

    // Show active bodies in red and frozen bodies in gray
    app.root.findComponents('rigidbody').forEach(function (/** @type {pc.RigidBodyComponent} */ body) {
        body.entity.findComponents('render').forEach(function (/** @type {pc.RenderComponent} */ render) {
            render.material = body.isActive() ? red : gray;
        });
    });
});

export { app };
