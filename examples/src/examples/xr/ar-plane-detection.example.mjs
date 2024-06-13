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
        type: 'spot',
        range: 30
    });
    l.translate(0, 10, 0);
    camera.addChild(l);

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                camera.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                    planeDetection: true,
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

            // trigger manual scanning on session start
            // app.xr.initiateRoomCapture((err) => { });
        });
        app.xr.on('end', function () {
            message('Immersive AR session has ended');
        });
        app.xr.on('available:' + pc.XRTYPE_AR, function (available) {
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

        const material = new pc.StandardMaterial();
        material.blendType = pc.BLEND_PREMULTIPLIED;
        material.opacity = 0.5;

        const materialWireframe = new pc.StandardMaterial();
        materialWireframe.emissive = new pc.Color(1, 1, 1);

        const updateMesh = (xrPlane, entity) => {
            let created = false;
            let mesh = entity.render.meshInstances[0]?.mesh;
            if (!mesh) {
                mesh = new pc.Mesh(app.graphicsDevice);
                created = true;
            }
            mesh.clear(true, false);

            let meshWireframe = entity.render.meshInstances[1]?.mesh;
            if (created) {
                meshWireframe = new pc.Mesh(app.graphicsDevice);
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
            mesh.setNormals(pc.calculateNormals(vertices, indices));
            mesh.setIndices(indices);
            mesh.update(pc.PRIMITIVE_TRIANGLES);

            meshWireframe.setPositions(verticesWireframe);
            meshWireframe.setIndices(indicesWireframe);
            meshWireframe.update(pc.PRIMITIVE_LINELOOP);

            let meshInstance = entity.render.meshInstances[0];
            if (created) {
                meshInstance = new pc.MeshInstance(mesh, material);
            }

            let meshInstanceWireframe = entity.render.meshInstances[1];
            if (created) {
                meshInstanceWireframe = new pc.MeshInstance(meshWireframe, materialWireframe);
                meshInstanceWireframe.renderStyle = pc.RENDERSTYLE_WIREFRAME;
            }

            if (created) entity.render.meshInstances = [meshInstance, meshInstanceWireframe];
        };

        const entities = new Map();

        app.xr.planeDetection.on('add', (xrPlane) => {
            // entity
            const entity = new pc.Entity();
            entity.addComponent('render');
            app.root.addChild(entity);
            entities.set(xrPlane, entity);

            updateMesh(xrPlane, entity);

            // label
            const label = new pc.Entity();
            label.setLocalPosition(0, 0, 0);
            label.addComponent('element', {
                pivot: new pc.Vec2(0.5, 0.5),
                fontAsset: assets.font.id,
                fontSize: 0.05,
                text: xrPlane.label || '-',
                width: 1,
                height: 0.1,
                color: new pc.Color(1, 0, 0),
                type: pc.ELEMENTTYPE_TEXT
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
        app.xr.planeDetection.on('remove', (xrPlane) => {
            const entity = entities.get(xrPlane);
            if (entity) {
                entity.destroy();
                entities.delete(xrPlane);
            }
        });

        const vec3A = new pc.Vec3();
        const vec3B = new pc.Vec3();
        const vec3C = new pc.Vec3();
        const transform = new pc.Mat4();

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
                    transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
                    vec3A.set(0.2, 0, 0);
                    vec3B.set(0, 0.2, 0);
                    vec3C.set(0, 0, 0.2);
                    transform.transformPoint(vec3A, vec3A);
                    transform.transformPoint(vec3B, vec3B);
                    transform.transformPoint(vec3C, vec3C);
                    app.drawLine(plane.getPosition(), vec3A, pc.Color.RED, false);
                    app.drawLine(plane.getPosition(), vec3B, pc.Color.GREEN, false);
                    app.drawLine(plane.getPosition(), vec3C, pc.Color.BLUE, false);

                    vec3A.copy(plane.points[0]);
                    transform.transformPoint(vec3A, vec3A);
                }
            }
        });

        if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            message('Immersive AR is not available');
        } else if (!app.xr.planeDetection.supported) {
            message('AR Plane Detection is not supported');
        } else {
            message('Touch screen to start AR session and look at the floor or walls');
        }
    } else {
        message('WebXR is not supported');
    }
});

export { app };
