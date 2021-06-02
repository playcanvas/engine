import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class BlendExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Blend';

    load() {
        return <>
            <AssetLoader name='model' type='model' url='static/assets/models/playbot/playbot.json' />
            <AssetLoader name='runAnim' type='animation' url='static/assets/animations/playbot/playbot-run.json' />
            <AssetLoader name='idleAnim' type='animation' url='static/assets/animations/playbot/playbot-idle.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { model: pc.Asset, idleAnim: pc.Asset, runAnim: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // var miniStats = new pcx.MiniStats(app);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0)
        });
        cameraEntity.translateLocal(0, 0.6, 2.4);
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 10,
            shadowBias: 0.2,
            shadowDistance: 5,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        const entity = new pc.Entity();

        // add model component to entity
        entity.addComponent("model", {
            type: "asset",
            asset: assets.model,
            castShadows: true
        });

        // add animation component to entity
        entity.addComponent("animation", {
            assets: [assets.idleAnim, assets.runAnim],
            speed: 1
        });

        app.root.addChild(entity);

        // Start running then stop in 1s
        function run() {
            entity.animation.play("playbot-run.json", 0.2);
            setTimeout(function () {
                stop();
            }, 1000);
        }

        // Stop running then start running in 1s
        function stop() {
            entity.animation.play("playbot-idle.json", 0.2);
            setTimeout(function () {
                run();
            }, 1000);
        }

        // Start alternating between run and stop
        setTimeout(function () {
            app.start();
            run();
        }, 1000);
    }
}

export default BlendExample;
