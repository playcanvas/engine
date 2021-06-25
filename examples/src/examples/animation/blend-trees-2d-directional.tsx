import React, { useEffect, createRef } from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';

// create an anim state graph
const animStateGraphData = {
    "layers": [
        {
            "name": "locomotion",
            "states": [
                {
                    "name": "START"
                },
                {
                    "name": "Travel",
                    "speed": 1.0,
                    "loop": true,
                    "blendTree": {
                        "type": pc.ANIM_BLEND_2D_DIRECTIONAL,
                        "syncDurations": true,
                        "parameters": ["posX", "posY"],
                        "children": [
                            {
                                "name": "Idle",
                                "point": [0.0, 0.0]
                            },
                            {
                                "speed": -1,
                                "name": "WalkBackwards",
                                "point": [0.0, -0.5]
                            },
                            {
                                "speed": 1,
                                "name": "Walk",
                                "point": [0.0, 0.5]
                            },
                            {
                                "speed": 1,
                                "name": "Jog",
                                "point": [0.0, 1.0]
                            }
                        ]
                    }
                }
            ],
            "transitions": [
                {
                    "from": "START",
                    "to": "Travel"
                }
            ]
        }
    ],
    "parameters": {
        "posX": {
            "name": "posX",
            "type": "FLOAT",
            "value": 0
        },
        "posY": {
            "name": "posY",
            "type": "FLOAT",
            "value": 0
        }
    }
};

class BlendTrees2DDirectionalExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Blend Trees 2D Directional';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='walkAnim' type='container' url='static/assets/animations/bitmoji/walk.glb' />
            <AssetLoader name='jogAnim' type='container' url='static/assets/animations/bitmoji/run.glb' />
            <AssetLoader name='animStateGraph' type='json' data={animStateGraphData} />
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        const canvasRef = createRef();
        useEffect(() => {
            if (!(window as any).pc.app) return;
            if (!(window as any).controlPanel) return;
            const canvas: any = canvasRef.current;
            // @ts-ignore engine-tsd
            const modelEntity: pc.Entity = (window as any).pc.app.root.findByName('model');
            const width = (window as any).controlPanel.offsetWidth;
            const height = width;
            const halfWidth = Math.floor(width / 2);
            const halfHeight = Math.floor(height / 2);
            canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);
            const ctx = canvas.getContext('2d');
            let position = new pc.Vec2(0);
            const drawPosition = (ctx: any) => {
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = '#B1B8BA';
                ctx.fillRect(halfWidth, 0, 1, height);
                ctx.fillRect(0, halfHeight, width, 1);
                ctx.fillStyle = '#232e30';
                // @ts-ignore engine-tsd
                modelEntity.anim.baseLayer._controller.activeState.animations.forEach((animNode: any) => {
                    if (animNode.point) {
                        ctx.fillRect((animNode.point.x + 1) * halfWidth - 2, (animNode.point.y * -1 + 1) * halfHeight - 2, 5, 5);
                    }
                });
                ctx.fillStyle = '#F60';
                ctx.beginPath();
                ctx.arc((modelEntity.anim.getFloat('posX') + 1) * halfWidth - 2, (modelEntity.anim.getFloat('posY') * - 1 + 1) * halfHeight - 2, 5, 0, 2 * Math.PI);
                ctx.fill();
            };
            drawPosition(ctx);
            const mouseEvent = (e: any) => {
                if (e.buttons) {
                    // @ts-ignore engine-tsd
                    position = new pc.Vec2(e.offsetX, e.offsetY).scale(1 / (width / 2)).sub(new pc.Vec2(1.0, 1.0));
                    position.y *= -1.0;
                    modelEntity.anim.setFloat('posX', position.x);
                    modelEntity.anim.setFloat('posY', position.y);
                    drawPosition(ctx);
                }
            };
            canvas.addEventListener('mousemove', mouseEvent);
            canvas.addEventListener('mousedown', mouseEvent);
        });
        return <>
            <canvas id='2d-blend-control' ref={canvasRef as React.RefObject<HTMLCanvasElement>} />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { model: pc.Asset, idleAnim: pc.Asset, jogAnim: pc.Asset, walkAnim: pc.Asset, animStateGraph: pc.Asset }, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.15, 0.2)
        });
        cameraEntity.translateLocal(0.0, 0.75, 5.0);
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });
        modelEntity.name = 'model';

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

        // load the state graph into the anim component
        modelEntity.anim.loadStateGraph(assets.animStateGraph.data);

        // load the state graph asset resource into the anim component
        const locomotionLayer = modelEntity.anim.baseLayer;
        locomotionLayer.assignAnimation('Travel.Idle', assets.idleAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.Walk', assets.walkAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.WalkBackwards', assets.walkAnim.resource.animations[0].resource);
        locomotionLayer.assignAnimation('Travel.Jog', assets.jogAnim.resource.animations[0].resource);

        app.root.addChild(modelEntity);

        app.start();
    }
}

export default BlendTrees2DDirectionalExample;
