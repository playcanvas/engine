import { expect } from 'chai';

import { Color } from '../../src/core/math/color.js';
import { Mat4 } from '../../src/core/math/mat4.js';
import { Vec2 } from '../../src/core/math/vec2.js';
import { Vec3 } from '../../src/core/math/vec3.js';
import { Vec4 } from '../../src/core/math/vec4.js';
import { Entity } from '../../src/framework/entity.js';
import { SceneColorMapHandle } from '../../src/platform/graphics/scene-color-map-handle.js';
import { SceneDepthMapHandle } from '../../src/platform/graphics/scene-depth-map-handle.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import { Camera } from '../../src/scene/camera.js';
import { ASPECT_AUTO, ASPECT_MANUAL, PROJECTION_ORTHOGRAPHIC } from '../../src/scene/constants.js';
import { GraphNode } from '../../src/scene/graph-node.js';
import { RenderView } from '../../src/scene/render-view.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

/**
 * @import { Application } from '../../src/framework/application.js'
 */

describe('Camera', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#constructor', function () {

        it('requires a graphics device', function () {
            // Debug.assert is stripped in production, so this throws in dev builds only via
            // the assertion; we simply verify that passing the device works.
            const camera = new Camera(app.graphicsDevice);
            expect(camera.device).to.equal(app.graphicsDevice);
        });

        it('defaults to ASPECT_AUTO', function () {
            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatioMode).to.equal(ASPECT_AUTO);
        });
    });

    describe('#setClearColor', function () {

        it('sets the attachment 0 color, which is the clearColor', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.setClearColor(0, new Color(0.1, 0.2, 0.3, 0.4));
            expect(camera.clearColor.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
            expect(camera.getClearColor(0)).to.equal(camera.clearColor);
        });

        it('other attachments clear to the attachment 0 color until given their own', function () {
            const camera = new Camera(app.graphicsDevice);
            expect(camera.getClearColor(1)).to.equal(camera.clearColor);

            camera.setClearColor(1, new Color(1, 0, 0, 1));
            expect(camera.getClearColor(1).equals(new Color(1, 0, 0, 1))).to.equal(true);
            expect(camera.getClearColor(2)).to.equal(camera.clearColor);
        });

        it('copies the color rather than referencing it', function () {
            const camera = new Camera(app.graphicsDevice);
            const color = new Color(1, 0, 0, 1);
            camera.setClearColor(1, color);
            color.set(0, 1, 0, 1);
            expect(camera.getClearColor(1).equals(new Color(1, 0, 0, 1))).to.equal(true);
        });

        it('null removes the color of an attachment', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.setClearColor(1, new Color(1, 0, 0, 1));
            camera.setClearColor(1, null);
            expect(camera.getClearColor(1)).to.equal(camera.clearColor);
        });

        it('is copied by clone()', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.setClearColor(1, new Color(1, 0, 0, 1));
            camera.setClearColor(3, new Color(0, 0, 1, 1));

            const clone = camera.clone();
            expect(clone.getClearColor(1).equals(new Color(1, 0, 0, 1))).to.equal(true);
            expect(clone.getClearColor(2)).to.equal(clone.clearColor);
            expect(clone.getClearColor(3).equals(new Color(0, 0, 1, 1))).to.equal(true);
            expect(clone.getClearColor(1)).to.not.equal(camera.getClearColor(1));
        });
    });

    describe('#aspectRatio (ASPECT_AUTO)', function () {

        it('reflects the backbuffer size synchronously', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);
        });

        it('updates when renderTarget is assigned', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            // attach a mock render target with different dimensions
            camera.renderTarget = { width: 1024, height: 512 };
            expect(camera.aspectRatio).to.equal(2);

            camera.renderTarget = { width: 300, height: 100 };
            expect(camera.aspectRatio).to.equal(3);
        });

        it('updates when rect changes (viewport aspect ratio)', function () {
            app.graphicsDevice.setResolution(1000, 1000);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(1);

            // half-width viewport on a square render target -> 1:2 viewport aspect
            camera.rect = new Vec4(0, 0, 0.5, 1);
            expect(camera.aspectRatio).to.equal(0.5);
        });

        it('updates when the backbuffer is resized', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            app.graphicsDevice.setResolution(1600, 400);
            expect(camera.aspectRatio).to.equal(4);
        });

        it('recomputes when switching from MANUAL to AUTO', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            camera.aspectRatioMode = ASPECT_MANUAL;
            camera.aspectRatio = 3.14;
            expect(camera.aspectRatio).to.equal(3.14);

            camera.aspectRatioMode = ASPECT_AUTO;
            expect(camera.aspectRatio).to.equal(2);
        });
    });

    describe('#aspectRatio (ASPECT_MANUAL)', function () {

        it('preserves the manually assigned value', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            camera.aspectRatioMode = ASPECT_MANUAL;
            camera.aspectRatio = 2.5;
            expect(camera.aspectRatio).to.equal(2.5);

            // changes to inputs that would affect AUTO must not affect MANUAL
            camera.renderTarget = { width: 1000, height: 1000 };
            app.graphicsDevice.setResolution(1920, 1080);
            camera.rect = new Vec4(0, 0, 0.5, 1);

            expect(camera.aspectRatio).to.equal(2.5);
        });
    });

    describe('#projectionMatrix', function () {

        it('refreshes after a backbuffer resize (no setter touched)', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);

            // prime the projection matrix cache
            const before = camera.projectionMatrix.clone();

            // resize the backbuffer without touching any camera setter
            app.graphicsDevice.setResolution(1600, 400);

            // reading projectionMatrix should detect the aspect change via the getter and
            // rebuild the matrix
            const after = camera.projectionMatrix;
            expect(after.equals(before)).to.equal(false);
        });
    });

    describe('#projectionOffset', function () {

        it('defaults to (0, 0) and copies the assigned value', function () {
            const camera = new Camera(app.graphicsDevice);
            expect(camera.projectionOffset.equals(new Vec2())).to.equal(true);

            const value = new Vec2(0.25, -0.5);
            camera.projectionOffset = value;
            value.set(9, 9);
            expect(camera.projectionOffset.equals(new Vec2(0.25, -0.5))).to.equal(true);
        });

        it('applies off-center terms to the perspective projection matrix', function () {
            const camera = new Camera(app.graphicsDevice);
            const before = camera.projectionMatrix.clone();

            camera.projectionOffset = new Vec2(0.25, -0.5);
            const after = camera.projectionMatrix;
            expect(after.data[8]).to.equal(0.25);
            expect(after.data[9]).to.equal(-0.5);

            // no other element is affected
            for (let i = 0; i < 16; i++) {
                if (i !== 8 && i !== 9) {
                    expect(after.data[i]).to.equal(before.data[i]);
                }
            }
        });

        it('translates the orthographic projection window', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.projection = PROJECTION_ORTHOGRAPHIC;
            const before = camera.projectionMatrix.clone();

            camera.projectionOffset = new Vec2(0.25, -0.5);
            const after = camera.projectionMatrix;
            expect(after.data[12]).to.equal(-0.25);
            expect(after.data[13]).to.equal(0.5);

            // no other element is affected
            for (let i = 0; i < 16; i++) {
                if (i !== 12 && i !== 13) {
                    expect(after.data[i]).to.equal(before.data[i]);
                }
            }
        });

        it('keeps worldToScreen and screenToWorld consistent', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            camera.node = new Entity();
            camera.projectionOffset = new Vec2(0.3, -0.2);

            const world = new Vec3(0.5, -0.7, -5);
            const screen = camera.worldToScreen(world, 800, 400, new Vec3());

            // screenToWorld takes the distance from the camera along the ray
            const roundtrip = camera.screenToWorld(screen.x, screen.y, world.length(), 800, 400, new Vec3());
            expect(roundtrip.x).to.be.closeTo(world.x, 1e-6);
            expect(roundtrip.y).to.be.closeTo(world.y, 1e-6);
            expect(roundtrip.z).to.be.closeTo(world.z, 1e-6);
        });

        it('offsets the frustum corners', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.aspectRatioMode = ASPECT_MANUAL;
            camera.aspectRatio = 1;
            camera.fov = 90;
            camera.nearClip = 1;
            camera.farClip = 10;
            camera.projectionOffset = new Vec2(0, 0.5);

            // near plane: half-height = tan(45) = 1, window center offset by 0.5
            const corners = camera.getFrustumCorners();
            expect(corners[0].y).to.be.closeTo(-0.5, 1e-6);
            expect(corners[1].y).to.be.closeTo(1.5, 1e-6);

            // far plane: half-height = 10, window center offset by 5
            expect(corners[4].y).to.be.closeTo(-5, 1e-6);
            expect(corners[5].y).to.be.closeTo(15, 1e-6);
        });

        it('is transferred by clone()', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.projectionOffset = new Vec2(0.1, 0.2);

            const clone = camera.clone();
            expect(clone.projectionOffset.equals(new Vec2(0.1, 0.2))).to.equal(true);
        });
    });

    describe('#clone', function () {

        it('preserves aspect ratio state', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            const clone = camera.clone();
            expect(clone.device).to.equal(camera.device);
            expect(clone.aspectRatio).to.equal(2);
        });

        it('gives the clone its own scene map handles', function () {
            const camera = new Camera(app.graphicsDevice);
            const clone = camera.clone();
            expect(clone.sceneDepthMapHandle).to.not.equal(camera.sceneDepthMapHandle);
            expect(clone.sceneColorMapHandle).to.not.equal(camera.sceneColorMapHandle);
        });
    });

    describe('#publishSceneDepthMap', function () {

        it('updates the same handle on each publication', function () {
            const camera = new Camera(app.graphicsDevice);
            const handle = camera.sceneDepthMapHandle;
            const first = new Texture(app.graphicsDevice, { width: 4, height: 4 });
            const second = new Texture(app.graphicsDevice, { width: 8, height: 8 });

            camera.publishSceneDepthMap(first, 3, true, false, false);
            expect(camera.sceneDepthMapHandle).to.equal(handle);
            expect(handle.texture).to.equal(first);
            expect(handle.renderVersion).to.equal(3);

            camera.publishSceneDepthMap(second, 4, true, false, false);
            expect(camera.sceneDepthMapHandle).to.equal(handle);
            expect(handle.texture).to.equal(second);
            expect(handle.renderVersion).to.equal(4);

            first.destroy();
            second.destroy();
        });

        it('sets the global uniform, which the static helper can clear', function () {
            const camera = new Camera(app.graphicsDevice);
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });
            const uniform = app.graphicsDevice.scope.resolve(SceneDepthMapHandle.uniformName);

            camera.publishSceneDepthMap(texture, 1, true, false, false);
            expect(uniform.value).to.equal(texture);

            // clearing the uniform leaves the handle of the camera as it was
            SceneDepthMapHandle.setUniform(app.graphicsDevice, null);
            expect(uniform.value).to.equal(null);
            expect(camera.sceneDepthMapHandle.texture).to.equal(texture);

            texture.destroy();
        });

        it('records the encoding of each publication', function () {
            const camera = new Camera(app.graphicsDevice);
            const handle = camera.sceneDepthMapHandle;
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });

            camera.publishSceneDepthMap(texture, 1, true, true, false);
            expect(handle.linear).to.equal(true);
            expect(handle.packed).to.equal(true);
            expect(handle.reciprocal).to.equal(false);

            camera.publishSceneDepthMap(texture, 2, true, false, true);
            expect(handle.linear).to.equal(true);
            expect(handle.packed).to.equal(false);
            expect(handle.reciprocal).to.equal(true);

            // the packed and reciprocal encodings only exist for a linear depth
            camera.publishSceneDepthMap(texture, 3, false, true, true);
            expect(handle.linear).to.equal(false);
            expect(handle.packed).to.equal(false);
            expect(handle.reciprocal).to.equal(false);

            texture.destroy();
        });

        it('captures the camera parameters the depth was rendered with', function () {
            const camera = new Camera(app.graphicsDevice);
            const handle = camera.sceneDepthMapHandle;
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });

            camera.nearClip = 0.5;
            camera.farClip = 200;
            camera.publishSceneDepthMap(texture, 1, false, false, false);

            // a change made after the depth was rendered does not change how it decodes
            camera.nearClip = 2;
            camera.farClip = 50;
            camera.projection = PROJECTION_ORTHOGRAPHIC;

            expect(handle.cameraParams[0]).to.be.closeTo(1 / 200, 1e-7);
            expect(handle.cameraParams[1]).to.equal(200);
            expect(handle.cameraParams[2]).to.equal(0.5);
            expect(handle.cameraParams[3]).to.equal(0);

            camera.publishSceneDepthMap(texture, 2, false, false, false);
            expect(handle.cameraParams[1]).to.equal(50);
            expect(handle.cameraParams[2]).to.equal(2);
            expect(handle.cameraParams[3]).to.equal(1);

            texture.destroy();
        });
    });

    describe('#publishSceneColorMap', function () {

        it('updates the same handle on each publication', function () {
            const camera = new Camera(app.graphicsDevice);
            const handle = camera.sceneColorMapHandle;
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });

            camera.publishSceneColorMap(texture, true);
            expect(camera.sceneColorMapHandle).to.equal(handle);
            expect(handle.texture).to.equal(texture);
            expect(handle.gamma).to.equal(true);

            camera.publishSceneColorMap(texture, false);
            expect(handle.gamma).to.equal(false);

            texture.destroy();
        });

        it('sets the global uniform, which the static helper can clear', function () {
            const camera = new Camera(app.graphicsDevice);
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });
            const uniform = app.graphicsDevice.scope.resolve(SceneColorMapHandle.uniformName);

            camera.publishSceneColorMap(texture, false);
            expect(uniform.value).to.equal(texture);

            SceneColorMapHandle.setUniform(app.graphicsDevice, null);
            expect(uniform.value).to.equal(null);
            expect(camera.sceneColorMapHandle.texture).to.equal(texture);

            texture.destroy();
        });
    });

    describe('#destroy', function () {

        it('marks the scene map handles destroyed', function () {
            const camera = new Camera(app.graphicsDevice);
            const depthHandle = camera.sceneDepthMapHandle;
            const colorHandle = camera.sceneColorMapHandle;
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });

            camera.publishSceneDepthMap(texture, 1, true, false, false);
            camera.publishSceneColorMap(texture, false);
            expect(depthHandle.destroyed).to.equal(false);
            expect(colorHandle.destroyed).to.equal(false);

            camera.destroy();
            expect(depthHandle.destroyed).to.equal(true);
            expect(depthHandle.texture).to.equal(null);
            expect(colorHandle.destroyed).to.equal(true);
            expect(colorHandle.texture).to.equal(null);

            texture.destroy();
        });
    });

    describe('#updateFrustum (XR)', function () {

        /**
         * Creates a camera on a rig node, rendering a single XR view.
         *
         * @returns {{ camera: Camera, rig: GraphNode, view: RenderView }} The camera, its rig and
         * its view.
         */
        const createXrCamera = () => {
            const rig = new GraphNode();
            const node = new GraphNode();
            rig.addChild(node);

            const camera = new Camera(app.graphicsDevice);
            camera.node = node;

            const view = new RenderView();
            camera.xrViews = [view];

            return { camera, rig, view };
        };

        /**
         * Sets the pose of an XR view relative to the camera's parent, with a 90 degree field of
         * view reaching 20 units.
         *
         * @param {RenderView} view - The view.
         * @param {number} yaw - The rotation of the view around the y axis, in degrees.
         */
        const setViewPose = (view, yaw) => {
            const projMat = new Mat4().setPerspective(90, 1, 0.1, 20);
            const viewInvMat = new Mat4().setFromAxisAngle(Vec3.UP, yaw);
            view.setView(projMat.data, viewInvMat.data);
        };

        it('culls with the current pose of the views', function () {
            const { camera, view } = createXrCamera();

            // the previous frame was rendered looking down -z
            setViewPose(view, 0);
            camera.updateViewTransforms();

            // and the head has since turned to look down -x
            setViewPose(view, 90);
            camera.updateFrustum();

            expect(camera.frustum.containsPoint(new Vec3(-10, 0, 0))).to.be.true;
            expect(camera.frustum.containsPoint(new Vec3(0, 0, -10))).to.be.false;
        });

        it('culls with the current transform of the camera parent', function () {
            const { camera, rig, view } = createXrCamera();
            setViewPose(view, 0);

            // the previous frame was rendered with the rig at the origin
            camera.updateViewTransforms();

            // and the rig has since been teleported
            rig.setLocalPosition(0, 0, 50);
            camera.updateFrustum();

            expect(camera.frustum.containsPoint(new Vec3(0, 0, 40))).to.be.true;
            expect(camera.frustum.containsPoint(new Vec3(0, 0, -10))).to.be.false;
        });

        it('culls with the pose of the views on the first frame of a session', function () {
            const { camera, rig, view } = createXrCamera();
            rig.setLocalPosition(0, 0, 50);
            setViewPose(view, 0);

            camera.updateFrustum();

            expect(camera.frustum.containsPoint(new Vec3(0, 0, 40))).to.be.true;
            expect(camera.frustum.containsPoint(new Vec3(0, 0, -10))).to.be.false;
        });
    });
});

describe('CameraComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#aspectRatio', function () {

        it('reflects the backbuffer size before the first frame', function () {
            app.graphicsDevice.setResolution(1600, 400);

            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            expect(entity.camera.aspectRatio).to.equal(4);
        });

        it('calculateAspectRatio forwards to the underlying Camera', function () {
            app.graphicsDevice.setResolution(800, 400);

            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            expect(entity.camera.calculateAspectRatio()).to.equal(2);
            expect(entity.camera.calculateAspectRatio({ width: 300, height: 100 })).to.equal(3);
        });
    });

    describe('#sceneDepthMapHandle', function () {

        it('returns the handle of the underlying Camera', function () {
            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            const handle = entity.camera.sceneDepthMapHandle;
            expect(handle).to.be.instanceOf(SceneDepthMapHandle);
            expect(handle).to.equal(entity.camera.camera.sceneDepthMapHandle);
            expect(handle.destroyed).to.equal(false);
        });

        it('is marked destroyed with the camera component', function () {
            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            const handle = entity.camera.sceneDepthMapHandle;
            entity.destroy();
            expect(handle.destroyed).to.equal(true);
        });
    });

    describe('#sceneColorMapHandle', function () {

        it('returns the handle of the underlying Camera', function () {
            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            const handle = entity.camera.sceneColorMapHandle;
            expect(handle).to.be.instanceOf(SceneColorMapHandle);
            expect(handle).to.equal(entity.camera.camera.sceneColorMapHandle);
            expect(handle.destroyed).to.equal(false);
        });

        it('is marked destroyed with the camera component', function () {
            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            const handle = entity.camera.sceneColorMapHandle;
            entity.removeComponent('camera');
            expect(handle.destroyed).to.equal(true);
        });
    });
});
