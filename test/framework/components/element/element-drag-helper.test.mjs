import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Quat } from '../../../../src/core/math/quat.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { platform } from '../../../../src/core/platform.js';
import { Application } from '../../../../src/framework/application.js';
import { ElementDragHelper } from '../../../../src/framework/components/element/element-drag-helper.js';
import { Entity } from '../../../../src/framework/entity.js';
import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { Mouse } from '../../../../src/platform/input/mouse.js';
import { TouchDevice } from '../../../../src/platform/input/touch-device.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ElementDragHelper', function () {
    let stubbedOntouchstart;
    let app;
    let entity;
    let element;
    let dragHelper;
    let dragStartHandler;
    let dragEndHandler;
    let dragMoveHandler;
    let camera;
    let parent;

    const createDragHelper = function (axis) {
        dragHelper = new ElementDragHelper(element, axis);
        dragHelper.on('drag:start', dragStartHandler);
        dragHelper.on('drag:end', dragEndHandler);
        dragHelper.on('drag:move', dragMoveHandler);
    };

    beforeEach(function () {
        jsdomSetup();

        // Simulate Node.js being touch capable, so that we can test touch-based dragging
        if (!('ontouchstart' in global)) {
            global.ontouchstart = {};
            stubbedOntouchstart = true;
            platform.touch = true;
        }

        const canvasWidth = 300;
        const canvasHeight = 400;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.getBoundingClientRect = function () {
            return {
                left: 0,
                top: 0,
                right: canvasWidth,
                bottom: canvasHeight,
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight
            };
        };

        const graphicsDevice = new NullGraphicsDevice(canvas);
        graphicsDevice.updateClientRect();

        app = new Application(canvas, {
            graphicsDevice,
            mouse: new Mouse(canvas),
            touch: new TouchDevice(canvas)
        });

        entity = new Entity('entity', app);
        element = entity.addComponent('element', {
            type: 'image',
            width: 100,
            height: 200,
            useInput: true
        });

        dragStartHandler = stub();
        dragEndHandler = stub();
        dragMoveHandler = stub();

        createDragHelper(null);

        const cameraEntity = new Entity('camera', app);
        cameraEntity.setPosition(new Vec3(0, 0, 100));
        camera = cameraEntity.addComponent('camera', {});

        parent = new Entity('parent', app);
        parent.addChild(entity);
        app.root.addChild(parent);
    });

    afterEach(function () {
        restore();

        dragHelper.destroy();

        app.destroy();

        if (stubbedOntouchstart) {
            delete global.ontouchstart;
            platform.touch = false;
        }
        jsdomTeardown();
    });

    it('fires a drag:start event when dragging starts via mouse', function () {
        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(true);
    });

    it('fires a drag:start event when dragging starts via touch', function () {
        element.fire('touchstart', {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(true);
    });

    it('fires a drag:move event when dragging moves via mouse', function () {
        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        element.fire('mousemove', {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(1);

        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(0.49, 0.01);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(-0.41, 0.01);
    });

    it('fires a drag:move event when dragging moves via touch', function () {
        element.fire('touchstart', {
            x: 50,
            y: 50,
            camera: camera
        });

        element.fire('touchmove', {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(1);
        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(0.49, 0.01);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(-0.41, 0.01);
    });

    it('fires a drag:end event when dragging ends via mouse and stops firing drag:move events', function () {
        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        element.fire('mouseup');

        expect(dragEndHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(false);

        app.mouse.fire('mousemove', {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(0);
    });

    function testDragEndViaTouch(touchEventName) {
        element.fire('touchstart', {
            x: 50,
            y: 50,
            camera: camera
        });

        element.fire(touchEventName);

        expect(dragEndHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(false);

        app.touch.fire('touchmove', {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(0);
    }

    it('fires a drag:end event when dragging ends via touchend and stops firing drag:move events', function () {
        testDragEndViaTouch.call(this, 'touchend');
    });

    it('fires a drag:end event when dragging ends via touchcancel and stops firing drag:move events', function () {
        testDragEndViaTouch.call(this, 'touchcancel');
    });

    it('does not allow dragging if not enabled', function () {
        dragHelper.enabled = false;

        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(0);
        expect(dragHelper.isDragging).to.equal(false);
    });

    it('does not allow dragging once destroyed', function () {
        dragHelper.destroy();

        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(0);
        expect(dragHelper.isDragging).to.equal(false);
    });

    const defaultXDelta = 4.90;
    const defaultYDelta = -2.07;

    function runTransformTest(expectedXDelta, expectedYDelta) {
        element.fire('mousedown', {
            x: 50,
            y: 50,
            camera: camera
        });

        element.fire('mousemove', {
            x: 60,
            y: 60
        });

        expect(dragMoveHandler.callCount).to.equal(1);
        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(expectedXDelta, 0.02);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(expectedYDelta, 0.02);
    }

    it('includes ancestral rotation in coordinate conversion', function () {
        const fourtyFiveDegreesAboutZ = new Quat();
        fourtyFiveDegreesAboutZ.setFromAxisAngle(new Vec3(0, 0, 1), 45);

        parent.setLocalRotation(fourtyFiveDegreesAboutZ);
        entity.setLocalRotation(fourtyFiveDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated 90 degrees about the Z axis in total
        runTransformTest.call(this, defaultYDelta, -defaultXDelta);
    });

    it('includes ancestral scale in coordinate conversion', function () {
        const twoXandFourY = new Vec3(2, 4, 1);

        parent.setLocalScale(twoXandFourY);
        entity.setLocalScale(twoXandFourY);

        runTransformTest.call(this, defaultXDelta / 2, defaultYDelta / 4);
    });

    it('includes camera rotation in coordinate conversion', function () {
        const ninetyDegreesAboutZ = new Quat();
        ninetyDegreesAboutZ.setFromAxisAngle(new Vec3(0, 0, 1), 90);
        camera.entity.setLocalRotation(ninetyDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated the camera
        runTransformTest.call(this, -defaultYDelta, defaultXDelta);
    });

    it('includes screen scale in coordinate conversion and disables perspective when using screen space', function () {
        app.root.removeChild(parent);

        const screen = new Entity('screen', app);
        screen.addComponent('screen', { screenSpace: true });
        screen.addChild(parent);
        screen.screen.scale = 0.5;

        app.root.addChild(screen);
        entity.element.screen = screen;

        runTransformTest.call(this, 20, -20);
    });

    it('allows dragging to be constrained to the X axis', function () {
        dragHelper.destroy();
        createDragHelper('x');

        runTransformTest.call(this, defaultXDelta, 0);
    });

    it('allows dragging to be constrained to the Y axis', function () {
        dragHelper.destroy();
        createDragHelper('y');

        runTransformTest.call(this, 0, defaultYDelta);
    });

    it('takes device pixel ratio into account', function () {
        app.graphicsDevice.maxPixelRatio = 2;
        runTransformTest.call(this, defaultXDelta * 2, defaultYDelta * 2);
    });

});
