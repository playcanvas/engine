// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import { rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
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
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' })
};

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: { alpha: true }
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0, 0),
        farClip: 10000
    });
    app.root.addChild(camera);

    const l = new pc.Entity();
    l.addComponent('light', {
        type: 'omni',
        range: 20
    });
    camera.addChild(l);

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                camera.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                    meshDetection: true,
                    callback: function (err) {
                        if (err) message('WebXR Immersive AR failed to start: ' + err.message);
                    }
                });
            } else {
                message('Immersive AR is not available');
            }
        };

        app.mouse.on('mousedown', function () {
            if (!app.xr.active) activate();
        });

        if (app.touch) {
            app.touch.on('touchend', function (evt) {
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
        app.keyboard.on('keydown', function (evt) {
            if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
                app.xr.end();
            }
        });

        app.xr.on('start', function () {
            message('Immersive AR session has started');

            // Trigger manual room capture
            // With a delay due to some issues on Quest 3 triggering immediately
            setTimeout(() => {
                app.xr.initiateRoomCapture((err) => {
                    if (err) console.log(err);
                });
            }, 500);
        });
        app.xr.on('end', function () {
            message('Immersive AR session has ended');
        });
        app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
            if (available) {
                if (app.xr.meshDetection.supported) {
                    message('Touch screen to start AR session and look at the floor or walls');
                } else {
                    message('AR Mesh Detection is not supported');
                }
            } else {
                message('Immersive AR is unavailable');
            }
        });

        const entities = new Map();

        // materials
        const materialDefault = new pc.StandardMaterial();

        const materialGlobalMesh = new pc.StandardMaterial();
        materialGlobalMesh.blendType = pc.BLEND_ADDITIVEALPHA;
        materialGlobalMesh.opacity = 0.2;

        const materialWireframe = new pc.StandardMaterial();
        materialWireframe.emissive = new pc.Color(1, 1, 1);

        // create entities for each XrMesh as they are added
        app.xr.meshDetection.on('add', (xrMesh) => {
            // solid mesh
            const mesh = new pc.Mesh(app.graphicsDevice);
            mesh.clear(true, false);
            mesh.setPositions(xrMesh.vertices);
            mesh.setNormals(pc.calculateNormals(xrMesh.vertices, xrMesh.indices));
            mesh.setIndices(xrMesh.indices);
            mesh.update(pc.PRIMITIVE_TRIANGLES);
            const material = xrMesh.label === 'global mesh' ? materialGlobalMesh : materialDefault;
            const meshInstance = new pc.MeshInstance(mesh, material);

            // wireframe mesh
            const meshWireframe = new pc.Mesh(app.graphicsDevice);
            meshWireframe.clear(true, false);
            meshWireframe.setPositions(xrMesh.vertices);
            const indices = new Uint16Array((xrMesh.indices.length / 3) * 4);
            for (let i = 0; i < xrMesh.indices.length; i += 3) {
                const ind = (i / 3) * 4;
                indices[ind + 0] = xrMesh.indices[i + 0];
                indices[ind + 1] = xrMesh.indices[i + 1];
                indices[ind + 2] = xrMesh.indices[i + 1];
                indices[ind + 3] = xrMesh.indices[i + 2];
            }
            meshWireframe.setIndices(indices);
            meshWireframe.update(pc.PRIMITIVE_LINES);
            const meshInstanceWireframe = new pc.MeshInstance(meshWireframe, materialWireframe);
            meshInstanceWireframe.renderStyle = pc.RENDERSTYLE_WIREFRAME;

            // entity
            const entity = new pc.Entity();
            entity.addComponent('render', {
                meshInstances: [meshInstance, meshInstanceWireframe]
            });
            app.root.addChild(entity);
            entities.set(xrMesh, entity);

            // label
            const label = new pc.Entity();
            label.setLocalPosition(0, 0, 0);
            label.addComponent('element', {
                pivot: new pc.Vec2(0.5, 0.5),
                fontAsset: assets.font.id,
                fontSize: 0.05,
                text: xrMesh.label,
                width: 1,
                height: 0.1,
                color: new pc.Color(1, 0, 0),
                type: pc.ELEMENTTYPE_TEXT
            });
            entity.addChild(label);
            label.setLocalPosition(0, 0, 0.05);
            entity.label = label;

            // transform
            entity.setPosition(xrMesh.getPosition());
            entity.setRotation(xrMesh.getRotation());
        });

        // when XrMesh is removed, destroy related entity
        app.xr.meshDetection.on('remove', (xrMesh) => {
            const entity = entities.get(xrMesh);
            if (entity) {
                entity.destroy();
                entities.delete(xrMesh);
            }
        });

        const vec3A = new pc.Vec3();
        const vec3B = new pc.Vec3();
        const vec3C = new pc.Vec3();
        const transform = new pc.Mat4();

        app.on('update', () => {
            if (app.xr.active && app.xr.meshDetection.supported) {
                // iterate through each XrMesh
                for (let i = 0; i < app.xr.meshDetection.meshes.length; i++) {
                    const mesh = app.xr.meshDetection.meshes[i];

                    const entity = entities.get(mesh);
                    if (entity) {
                        // update entity transforms based on XrMesh
                        entity.setPosition(mesh.getPosition());
                        entity.setRotation(mesh.getRotation());

                        // make sure label is looking at the camera
                        entity.label.lookAt(camera.getPosition());
                        entity.label.rotateLocal(0, 180, 0);
                    }

                    // render XrMesh gizmo axes
                    transform.setTRS(mesh.getPosition(), mesh.getRotation(), pc.Vec3.ONE);
                    vec3A.set(0.2, 0, 0);
                    vec3B.set(0, 0.2, 0);
                    vec3C.set(0, 0, 0.2);
                    transform.transformPoint(vec3A, vec3A);
                    transform.transformPoint(vec3B, vec3B);
                    transform.transformPoint(vec3C, vec3C);
                    app.drawLine(mesh.getPosition(), vec3A, pc.Color.RED, false);
                    app.drawLine(mesh.getPosition(), vec3B, pc.Color.GREEN, false);
                    app.drawLine(mesh.getPosition(), vec3C, pc.Color.BLUE, false);
                }
            }
        });

        if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            message('Immersive AR is not available');
        } else if (!app.xr.meshDetection.supported) {
            message('AR Mesh Detection is not available');
        } else {
            message('Touch screen to start AR session and look at the floor or walls');
        }
    } else {
        message('WebXR is not supported');
    }
});

export { app };
