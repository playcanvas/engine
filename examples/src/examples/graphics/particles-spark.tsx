import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ParticlesSparkExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Particles: Spark';

    load() {
        return <>
            <AssetLoader name='spark' type='texture' url='static/assets/textures/spark.png' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { spark: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0.05)
        });
        cameraEntity.rotateLocal(0, 0, 0);
        cameraEntity.translateLocal(0, 0, 10);

        // Create a directional light
        const lightDirEntity = new pc.Entity();
        lightDirEntity.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            intensity: 1
        });
        lightDirEntity.setLocalEulerAngles(45, 0, 0);

        // Add Entities into the scene hierarchy
        app.root.addChild(cameraEntity);
        app.root.addChild(lightDirEntity);


        // Offset position
        const localPosCurve = new pc.CurveSet([
            [0, 0, 1, 4],
            [0, 0, 1, 3],
            [0, 0, 1, 0]
        ]);
        localPosCurve.type = pc.CURVE_LINEAR;

        // make particles move in different directions
        const localVelocityCurve = new pc.CurveSet([
            [0, 0, 1, 8],
            [0, 0, 1, 6],
            [0, 0, 1, 0]
        ]);
        const localVelocityCurve2 = new pc.CurveSet([
            [0, 0, 1, -8],
            [0, 0, 1, -6],
            [0, 0, 1, 0]
        ]);

        // increasing gravity
        const worldVelocityCurve = new pc.CurveSet([
            [0, 0],
            [0, 0, 0.2, 6, 1, -48],
            [0, 0]
        ]);

        // gradually make sparks bigger
        const scaleCurve = new pc.Curve(
            [0, 0, 0.5, 0.3, 0.8, 0.2, 1, 0.1]
        );

        // rotate sparks 360 degrees per second
        const angleCurve = new pc.Curve(
            [0, 360]
        );

        // color changes throughout lifetime
        const colorCurve = new pc.CurveSet([
            [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
            [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
            [0, 0, 1, 0]
        ]);

        // Create entity for particle system
        const entity = new pc.Entity();
        app.root.addChild(entity);
        entity.setLocalPosition(0, 0, 0);

        // when texture is loaded add particlesystem component to entity
        entity.addComponent("particlesystem", {
            numParticles: 200,
            lifetime: 2,
            rate: 0.01,
            scaleGraph: scaleCurve,
            rotationSpeedGraph: angleCurve,
            colorGraph: colorCurve,
            colorMap: assets.spark.resource,
            velocityGraph: worldVelocityCurve,
            localVelocityGraph: localVelocityCurve,
            localVelocityGraph2: localVelocityCurve2
        });
    }
}

export default ParticlesSparkExample;
