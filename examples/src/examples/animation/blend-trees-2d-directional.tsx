import React, { useEffect, createRef } from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class BlendTrees2DDirectionalExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Blend Trees 2D Directional';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='walkAnim' type='container' url='static/assets/animations/bitmoji/walk.glb' />
            <AssetLoader name='jogAnim' type='container' url='static/assets/animations/bitmoji/run.glb' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
        </>;
    }

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
                        const posX = (animNode.point.x + 1) * halfWidth;
                        const posY = (animNode.point.y * -1 + 1) * halfHeight;
                        const width = 8;
                        const height = 8;

                        ctx.fillStyle = "#ffffff80";
                        ctx.beginPath();
                        ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                        ctx.fill();

                        ctx.fillStyle = '#283538';
                        ctx.beginPath();
                        ctx.moveTo(posX, posY - height / 2);
                        ctx.lineTo(posX - width / 2, posY);
                        ctx.lineTo(posX, posY + height / 2);
                        ctx.lineTo(posX + width / 2, posY);
                        ctx.closePath();
                        ctx.fill();
                    }
                });
                ctx.fillStyle = '#F60';
                ctx.beginPath();
                ctx.arc((modelEntity.anim.getFloat('posX') + 1) * halfWidth, (modelEntity.anim.getFloat('posY') * - 1 + 1) * halfHeight, 5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = '#283538';
                ctx.stroke();
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

    example(canvas: HTMLCanvasElement, assets: any, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

        // setup skydome
        app.scene.exposure = 2;
        app.scene.skyboxMip = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        cameraEntity.translate(0, 0.75, 3);
        // add bloom postprocessing (this is ignored by the picker)
        cameraEntity.addComponent("script");
        cameraEntity.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.7,
                blurAmount: 4
            }
        });
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        const lightEntity = new pc.Entity();
        lightEntity.addComponent("light", {
            castShadows: true,
            intensity: 1.5,
            normalOffsetBias: 0.02,
            shadowType: pc.SHADOW_PCF5,
            shadowDistance: 6,
            shadowResolution: 2048,
            shadowBias: 0.02
        });
        app.root.addChild(lightEntity);
        lightEntity.setLocalEulerAngles(45, 30, 0);

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });
        modelEntity.name = 'model';

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

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

        // load the state graph into the anim component
        modelEntity.anim.loadStateGraph(animStateGraphData);

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
