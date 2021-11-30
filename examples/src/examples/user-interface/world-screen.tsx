import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class WorldScreenExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'World Screen';

    load() {
        return <>
            <AssetLoader name="checkboard" type="texture" url="static/assets/textures/checkboard.png" />
            <AssetLoader name='font' type='font' url='static/assets/fonts/courier.json' />
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: { checkboard: pc.Asset, font: pc.Asset }): void {

        // Create the application with input and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        app.start();

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(1, 0, 0)
        });
        camera.rotateLocal(-30, 0, 0);
        camera.translateLocal(0, 0, 7);
        app.root.addChild(camera);

        // Create an Entity for the ground
        const material = new pc.StandardMaterial();
        material.diffuse = pc.Color.WHITE;
        material.diffuseMap = assets.checkboard.resource;
        material.diffuseMapTiling = new pc.Vec2(50, 50);
        material.update();

        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material
        });
        ground.setLocalScale(50, 1, 50);
        ground.setLocalPosition(0, -0.5, 0);
        app.root.addChild(ground);

        // Create an entity with a light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 1,
            shadowBias: 0.2,
            shadowDistance: 16,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        // Create a capsule entity to represent a player in the 3d world
        const entity = new pc.Entity();
        entity.setLocalScale(new pc.Vec3(0.5, 0.5, 0.5));
        entity.addComponent("render", {
            type: "capsule"
        });
        app.root.addChild(entity);

        // update the player position every frame with some mock logic
        // normally, this would be taking inputs, running physics simulation, etc
        let angle = 135;
        const radius = 1.5;
        const height = 0.5;
        app.on("update", function (dt) {
            angle += 30 * dt;
            if (angle > 360) {
                angle -= 360;
            }
            entity.setLocalPosition(radius * Math.sin(angle * pc.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc.math.DEG_TO_RAD));
            entity.setLocalEulerAngles(0, angle + 90, 0);
        });

        // Create a 3D world screen
        const screen = new pc.Entity();
        screen.setLocalScale(0.01, 0.01, 0.01);
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            screenSpace: false
        });
        app.root.addChild(screen);

        // Create a text element that will hover the player's head
        const playerText = new pc.Entity();
        playerText.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 20,
            text: "Player 1",
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(playerText);

        // update the player text's position to always hover the player
        app.on("update", function () {
            const playerPosition = entity.getPosition();
            playerText.setPosition(playerPosition.x, playerPosition.y + 0.6, playerPosition.z);
        });
    }
}

export default WorldScreenExample;
