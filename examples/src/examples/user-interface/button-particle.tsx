import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class ButtonParticleExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Button Particle';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/courier.json' />
            <AssetLoader name='spark' type='texture' url='static/assets/textures/spark.png' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset, spark: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        app.start();

        // Create a camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0)
        });
        app.root.addChild(camera);

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // Create a simple button
        const button = new pc.Entity();
        button.addComponent("button", {
            imageEntity: button
        });
        button.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            color: new pc.Color(0.4, 0.4, 0.4),
            height: 40,
            pivot: [0.5, 0.5],
            type: pc.ELEMENTTYPE_IMAGE,
            width: 175,
            useInput: true
        });
        screen.addChild(button);

        // Create a label for the button
        const label = new pc.Entity();
        label.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            color: new pc.Color(1, 1, 0),
            fontSize: 36,
            height: 64,
            pivot: [0.5, 0.5],
            text: "LABEL",
            type: pc.ELEMENTTYPE_TEXT,
            width: 128,
            wrapLines: true
        });
        button.addChild(label);
        label.element.fontAsset = assets.font.id;


        // Create entity for particle system
        const particles = new pc.Entity();

        // insert sparks as a child of the button, but before Label - that is the order for rendering
        button.insertChild(particles, 0);

        // particles will render in UI layer
        const UILayer = app.scene.layers.getLayerByName("UI");

        // particle size
        const scaleCurve = new pc.Curve(
            [0, 0.03]
        );

        // color changes throughout lifetime
        const colorCurve = new pc.CurveSet([
            [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
            [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
            [0, 0, 1, 0]
        ]);

        // increasing gravity to get them to move
        const worldVelocityCurve = new pc.CurveSet([
            [0, 0],
            [0, 0, 0.1, 0.1, 0.1, -0.1],
            [0, 0]
        ]);

        // rotate sparks 360 degrees per second
        const angleCurve = new pc.Curve(
            [0, 360]
        );

        // when texture is loaded add particlesystem component to entity
        particles.addComponent("particlesystem", {
            numParticles: 100,
            lifetime: 1,
            rate: 0.01,

            // make them follow the buttn in screen-space
            localSpace: true,
            screenSpace: true,

            emitterShape: pc.EMITTERSHAPE_SPHERE,
            emitterRadius: 100,

            scaleGraph: scaleCurve,
            rotationSpeedGraph: angleCurve,
            colorGraph: colorCurve,
            velocityGraph: worldVelocityCurve,

            colorMap: assets.spark.resource,
            layers: [UILayer.id]
        });

        // sort all screen elements
        screen.screen.syncDrawOrder();

        let time = 0;
        app.on("update", function (dt) {
            time += dt * 0.3;

            // move buttons along the circular path
            button.setLocalPosition(300 * Math.sin(time), 300 * Math.cos(time), 0);
        });

    }
}

export default ButtonParticleExample;
