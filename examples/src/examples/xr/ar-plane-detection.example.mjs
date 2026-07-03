import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_PREMULTIPLIED,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    KEY_ESCAPE,
    Keyboard,
    LightComponentSystem,
    Mat4,
    Mesh,
    MeshInstance,
    Mouse,
    PRIMITIVE_LINELOOP,
    PRIMITIVE_TRIANGLES,
    RENDERSTYLE_WIREFRAME,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScreenComponentSystem,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    XRSPACE_LOCALFLOOR,
    XRTYPE_AR,
    XrManager,
    calculateNormals,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = msg => {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        el.style.position = 'absolute';
        el.style.bottom = '96px';
        el.style.right = '0';
        el.style.padding = '8px 16px';
        el.style.fontFamily = 'Helvetica, Arial, sans-serif';
        el.style.color = '#fff';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        document.body.append(el);
    }
    el.textContent = msg;
};

const assets = {
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = window.devicePixelRatio;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(canvas);
createOptions.touch = new TouchDevice(canvas);
createOptions.keyboard = new Keyboard(window);
createOptions.xr = XrManager;
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// create camera
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 0),
    farClip: 10000
});
app.root.addChild(camera);

const l = new Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
camera.addChild(l);

if (app.xr.supported) {
    const activate = () => {
        if (app.xr.isAvailable(XRTYPE_AR)) {
            camera.camera.startXr(XRTYPE_AR, XRSPACE_LOCALFLOOR, {
                planeDetection: true,
                callback: err => {
                    if (err) message(`WebXR Immersive AR failed to start: ${err.message}`);
                }
            });
        } else {
            message('Immersive AR is not available');
        }
    };

    app.mouse.on('mousedown', () => {
        if (!app.xr.active) activate();
    });

    if (app.touch) {
        app.touch.on('touchend', evt => {
            if (!app.xr.active) {
                // if not in VR, activate
                activate();
            } else {
                // otherwise reset camera
                camera.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // end session by keyboard ESC
    app.keyboard.on('keydown', evt => {
        if (evt.key === KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    app.xr.on('start', () => {
        message('Immersive AR session has started');

        // trigger manual scanning on session start
        // app.xr.initiateRoomCapture((err) => { });
    });
    app.xr.on('end', () => {
        message('Immersive AR session has ended');
    });
    app.xr.on(`available:${XRTYPE_AR}`, available => {
        if (available) {
            if (app.xr.planeDetection.supported) {
                message('Touch screen to start AR session and look at the floor or walls');
            } else {
                message('AR Plane Detection is not supported');
            }
        } else {
            message('Immersive AR is unavailable');
        }
    });

    const material = new StandardMaterial();
    material.blendType = BLEND_PREMULTIPLIED;
    material.opacity = 0.5;

    const materialWireframe = new StandardMaterial();
    materialWireframe.emissive = new Color(1, 1, 1);

    const updateMesh = (xrPlane, entity) => {
        let created = false;
        let mesh = entity.render.meshInstances[0]?.mesh;
        if (!mesh) {
            mesh = new Mesh(app.graphicsDevice);
            created = true;
        }
        mesh.clear(true, false);

        let meshWireframe = entity.render.meshInstances[1]?.mesh;
        if (created) {
            meshWireframe = new Mesh(app.graphicsDevice);
        }
        meshWireframe.clear(true, false);

        const vertices = new Float32Array((xrPlane.points.length + 1) * 3);
        const verticesWireframe = new Float32Array(xrPlane.points.length * 3);
        vertices[0] = 0;
        vertices[1] = 0;
        vertices[2] = 0;

        const indices = new Uint32Array(xrPlane.points.length * 3);
        const indicesWireframe = new Uint32Array(xrPlane.points.length);

        for (let i = 0; i < xrPlane.points.length; i++) {
            vertices[i * 3 + 3 + 0] = xrPlane.points[i].x;
            vertices[i * 3 + 3 + 1] = xrPlane.points[i].y;
            vertices[i * 3 + 3 + 2] = xrPlane.points[i].z;
            verticesWireframe[i * 3 + 0] = xrPlane.points[i].x;
            verticesWireframe[i * 3 + 1] = xrPlane.points[i].y;
            verticesWireframe[i * 3 + 2] = xrPlane.points[i].z;
            indices[i * 3 + 0] = 0;
            indices[i * 3 + 1] = i + 1;
            indices[i * 3 + 2] = ((i + 1) % xrPlane.points.length) + 1;
            indicesWireframe[i] = i;
        }

        mesh.setPositions(vertices);
        mesh.setNormals(calculateNormals(vertices, indices));
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES);

        meshWireframe.setPositions(verticesWireframe);
        meshWireframe.setIndices(indicesWireframe);
        meshWireframe.update(PRIMITIVE_LINELOOP);

        let meshInstance = entity.render.meshInstances[0];
        if (created) {
            meshInstance = new MeshInstance(mesh, material);
        }

        let meshInstanceWireframe = entity.render.meshInstances[1];
        if (created) {
            meshInstanceWireframe = new MeshInstance(meshWireframe, materialWireframe);
            meshInstanceWireframe.renderStyle = RENDERSTYLE_WIREFRAME;
        }

        if (created) entity.render.meshInstances = [meshInstance, meshInstanceWireframe];
    };

    const entities = new Map();

    app.xr.planeDetection.on('add', xrPlane => {
        // entity
        const entity = new Entity();
        entity.addComponent('render');
        app.root.addChild(entity);
        entities.set(xrPlane, entity);

        updateMesh(xrPlane, entity);

        // label
        const label = new Entity();
        label.setLocalPosition(0, 0, 0);
        label.addComponent('element', {
            pivot: new Vec2(0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 0.05,
            text: xrPlane.label || '-',
            width: 1,
            height: 0.1,
            color: new Color(1, 0, 0),
            type: ELEMENTTYPE_TEXT
        });
        entity.addChild(label);
        label.setLocalPosition(0, -0.05, 0);
        entity.label = label;

        // transform
        entity.setPosition(xrPlane.getPosition());
        entity.setRotation(xrPlane.getRotation());

        xrPlane.on('change', () => {
            updateMesh(xrPlane, entity);
        });
    });

    // when XrPlane is removed, destroy related entity
    app.xr.planeDetection.on('remove', xrPlane => {
        const entity = entities.get(xrPlane);
        if (entity) {
            entity.destroy();
            entities.delete(xrPlane);
        }
    });

    const vec3A = new Vec3();
    const vec3B = new Vec3();
    const vec3C = new Vec3();
    const transform = new Mat4();

    app.on('update', () => {
        if (app.xr.active && app.xr.planeDetection.supported) {
            // iterate through each XrMesh
            for (let i = 0; i < app.xr.planeDetection.planes.length; i++) {
                const plane = app.xr.planeDetection.planes[i];

                const entity = entities.get(plane);
                if (entity) {
                    // update entity transforms based on XrPlane
                    entity.setPosition(plane.getPosition());
                    entity.setRotation(plane.getRotation());

                    // make sure label is looking at the camera
                    entity.label.setLocalPosition(0, -0.05, 0);
                    entity.label.lookAt(camera.getPosition());
                    entity.label.rotateLocal(0, 180, 0);
                    entity.label.translateLocal(0, 0, 0.05);
                }

                // render XrPlane gizmo axes
                transform.setTRS(plane.getPosition(), plane.getRotation(), Vec3.ONE);
                vec3A.set(0.2, 0, 0);
                vec3B.set(0, 0.2, 0);
                vec3C.set(0, 0, 0.2);
                transform.transformPoint(vec3A, vec3A);
                transform.transformPoint(vec3B, vec3B);
                transform.transformPoint(vec3C, vec3C);
                app.drawLine(plane.getPosition(), vec3A, Color.RED, false);
                app.drawLine(plane.getPosition(), vec3B, Color.GREEN, false);
                app.drawLine(plane.getPosition(), vec3C, Color.BLUE, false);

                vec3A.copy(plane.points[0]);
                transform.transformPoint(vec3A, vec3A);
            }
        }
    });

    if (!app.xr.isAvailable(XRTYPE_AR)) {
        message('Immersive AR is not available');
    } else if (!app.xr.planeDetection.supported) {
        message('AR Plane Detection is not supported');
    } else {
        message('Touch screen to start AR session and look at the floor or walls');
    }
} else {
    message('WebXR is not supported');
}
