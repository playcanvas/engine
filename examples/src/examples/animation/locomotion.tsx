import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, BooleanInput, Button, LabelGroup } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class LocomotionExample {
    static CATEGORY = 'Animation';
    static NAME = 'Locomotion';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Button text='Jump' onClick={() => data.emit('jump')}/>
            <LabelGroup text='Run: '>
                <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'jogToggle' }} />
            </LabelGroup>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        pc.WasmModule.setConfig('Ammo', {
            glueUrl: '/static/lib/ammo/ammo.wasm.js',
            wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
            fallbackUrl: '/static/lib/ammo/ammo.js'
        });

        pc.WasmModule.getInstance('Ammo', run);

        function run() {

            const assets = {
                'playcanvasGreyTexture': new pc.Asset('playcanvasGreyTexture', 'texture', { url: '/static/assets/textures/playcanvas-grey.png' }),
                'model': new pc.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'idleAnim': new pc.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                'walkAnim': new pc.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                'jogAnim': new pc.Asset('jogAnim', 'container', { url: '/static/assets/animations/bitmoji/run.glb' }),
                'jumpAnim': new pc.Asset('jumpAnim', 'container', { url: '/static/assets/animations/bitmoji/jump-flip.glb' }),
                helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            };

            const gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };

            pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

                const createOptions = new pc.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc.Mouse(document.body);
                createOptions.touch = new pc.TouchDevice(document.body);

                createOptions.componentSystems = [
                    // @ts-ignore
                    pc.RenderComponentSystem,
                    // @ts-ignore
                    pc.CameraComponentSystem,
                    // @ts-ignore
                    pc.LightComponentSystem,
                    // @ts-ignore
                    pc.ScriptComponentSystem,
                    // @ts-ignore
                    pc.AnimComponentSystem,
                    // @ts-ignore
                    pc.CollisionComponentSystem,
                    // @ts-ignore
                    pc.RigidBodyComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc.TextureHandler,
                    // @ts-ignore
                    pc.ContainerHandler,
                    // @ts-ignore
                    pc.ScriptHandler,
                    // @ts-ignore
                    pc.AnimClipHandler,
                    // @ts-ignore
                    pc.AnimStateGraphHandler
                ];

                const app = new pc.AppBase(canvas);
                app.init(createOptions);

                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc.RESOLUTION_AUTO);

                const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(() => {

                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.skyboxIntensity = 0.7;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc.TONEMAP_ACES;

                    // Create an Entity with a camera component
                    const cameraEntity = new pc.Entity();
                    cameraEntity.name = "Camera";
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc.Color(0.1, 0.15, 0.2)
                    });

                    cameraEntity.translateLocal(0.5, 3, 8);
                    cameraEntity.rotateLocal(-30, 0, 0);
                    app.root.addChild(cameraEntity);

                    // Create an entity with a light component
                    const light = new pc.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        color: new pc.Color(1, 1, 1),
                        castShadows: true,
                        intensity: 2,
                        shadowBias: 0.2,
                        shadowDistance: 16,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    light.setLocalEulerAngles(60, 30, 0);
                    app.root.addChild(light);

                    app.start();

                    const characterEntity = new pc.Entity();

                    // create an entity from the loaded model using the render component
                    const renderEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });

                    // assign the renderEntity as the child of character entity. All transforms of the
                    // renderEntity and its children are driven by the anim component.
                    // The characterEntity transform will be controlled by the Locomotion script.
                    characterEntity.addChild(renderEntity);

                    // add an anim component to the entity
                    characterEntity.addComponent('anim', {
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
                                        "name": "Idle",
                                        "speed": 1.0
                                    },
                                    {
                                        "name": "Walk",
                                        "speed": 1.0
                                    },
                                    {
                                        "name": "Jump",
                                        "speed": 1
                                    },
                                    {
                                        "name": "Jog",
                                        "speed": 1.0
                                    },
                                    {
                                        "name": "END"
                                    }
                                ],
                                "transitions": [
                                    {
                                        "from": "START",
                                        "to": "Idle",
                                        "time": 0,
                                        "priority": 0
                                    },
                                    {
                                        "from": "Idle",
                                        "to": "Walk",
                                        "time": 0.1,
                                        "priority": 0,
                                        "conditions": [
                                            {
                                                "parameterName": "speed",
                                                "predicate": pc.ANIM_GREATER_THAN,
                                                "value": 0
                                            }
                                        ]
                                    },
                                    {
                                        "from": "ANY",
                                        "to": "Jump",
                                        "time": 0.1,
                                        "priority": 0,
                                        "conditions": [
                                            {
                                                "parameterName": "jump",
                                                "predicate": pc.ANIM_EQUAL_TO,
                                                "value": true
                                            }
                                        ]
                                    },
                                    {
                                        "from": "Jump",
                                        "to": "Idle",
                                        "time": 0.2,
                                        "priority": 0,
                                        "exitTime": 0.8
                                    },
                                    {
                                        "from": "Jump",
                                        "to": "Walk",
                                        "time": 0.2,
                                        "priority": 0,
                                        "exitTime": 0.8
                                    },
                                    {
                                        "from": "Walk",
                                        "to": "Idle",
                                        "time": 0.1,
                                        "priority": 0,
                                        "conditions": [
                                            {
                                                "parameterName": "speed",
                                                "predicate": pc.ANIM_LESS_THAN_EQUAL_TO,
                                                "value": 0
                                            }
                                        ]
                                    },
                                    {
                                        "from": "Walk",
                                        "to": "Jog",
                                        "time": 0.1,
                                        "priority": 0,
                                        "conditions": [
                                            {
                                                "parameterName": "speed",
                                                "predicate": pc.ANIM_GREATER_THAN,
                                                "value": 1
                                            }
                                        ]
                                    },
                                    {
                                        "from": "Jog",
                                        "to": "Walk",
                                        "time": 0.1,
                                        "priority": 0,
                                        "conditions": [
                                            {
                                                "parameterName": "speed",
                                                "predicate": pc.ANIM_LESS_THAN,
                                                "value": 2
                                            }
                                        ]
                                    }
                                ]
                            }
                        ],
                        "parameters": {
                            "speed": {
                                "name": "speed",
                                "type": pc.ANIM_PARAMETER_INTEGER,
                                "value": 0
                            },
                            "jump": {
                                "name": "jump",
                                "type": pc.ANIM_PARAMETER_TRIGGER,
                                "value": false
                            }
                        }
                    };

                    // load the state graph into the anim component
                    characterEntity.anim.loadStateGraph(animStateGraphData);

                    // assign the loaded animation assets to each of the states present in the state graph
                    const locomotionLayer = characterEntity.anim.baseLayer;
                    locomotionLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Jog', assets.jogAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Jump', assets.jumpAnim.resource.animations[0].resource);

                    app.root.addChild(characterEntity);

                    const planeEntity = new pc.Entity();
                    planeEntity.name = 'Plane';
                    planeEntity.addComponent("render", {
                        type: "plane"
                    });
                    planeEntity.addComponent("collision", {
                        type: 'box',
                        halfExtents: new pc.Vec3(7.5, 0, 7.5)
                    });
                    planeEntity.addComponent("rigidbody", {
                        type: 'static'
                    });
                    planeEntity.setLocalScale(15, 1, 15);
                    planeEntity.setPosition(0, 0, 0);
                    const material = new pc.StandardMaterial();
                    material.diffuseMap = assets.playcanvasGreyTexture.resource;
                    material.update();
                    planeEntity.render.meshInstances[0].material = material;
                    app.root.addChild(planeEntity);

                    data.on('jump', function () {
                        const isJumping = characterEntity.anim.baseLayer.activeState === 'Jump';
                        if (!isJumping) {
                            characterEntity.anim.setTrigger('jump');
                        }
                    });

                    // create a Locomotion script and initialize some variables
                    const Locomotion = pc.createScript('Locomotion');

                    let characterDirection;
                    let targetPosition: pc.Vec3;

                    // initialize code called once per entity
                    Locomotion.prototype.initialize = function () {
                        characterDirection = new pc.Vec3(1, 0, 0);
                        targetPosition = new pc.Vec3(2, 0, 2);
                        document.addEventListener("mousedown", this.onMouseDown);
                    };

                    // @ts-ignore engine-tsd
                    Locomotion.prototype.onMouseDown = function (event: any) {
                        if (event.button !== 0) return;
                        // Set the character target position to a position on the plane that the user has clicked
                        const cameraEntity = app.root.findByName('Camera') as pc.Entity;
                        const near = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
                        const far = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
                        const result = app.systems.rigidbody.raycastFirst(far, near);
                        if (result) {
                            targetPosition = new pc.Vec3(result.point.x, 0, result.point.z);
                            characterEntity.anim.setInteger('speed', data.get('jogToggle') ? 2 : 1);
                        }
                    };

                    // defines how many units the character should move per second given its current animation state
                    function speedForState(state: any) {
                        switch (state) {
                            case 'Walk':
                                return 1.0;
                            case 'Jog':
                                return 4.0;
                            case 'Jump':
                            case 'Idle':
                            default:
                                return 0.0;
                        }
                    }

                    const currentPosition = new pc.Vec3(0, 0, 0);

                    // update code called every frame
                    Locomotion.prototype.update = function (dt: number) {
                        if (characterEntity.anim.getInteger('speed')) {
                            // Update position if target position is not the same as entity position. Base the movement speed on the current state
                            // Move the character along X & Z axis based on click target position & make character face click direction
                            let moveSpeed = speedForState(characterEntity.anim.baseLayer.activeState);
                            if (characterEntity.anim.baseLayer.transitioning) {
                                const prevMoveSpeed = speedForState(characterEntity.anim.baseLayer.previousState);
                                const progress = characterEntity.anim.baseLayer.transitionProgress;
                                moveSpeed = (prevMoveSpeed * (1.0 - progress)) + (moveSpeed * progress);
                            }
                            const distance = targetPosition.clone().sub(currentPosition);
                            const direction = distance.clone().normalize();
                            characterDirection = new pc.Vec3().sub(direction);
                            const movement = direction.clone().mulScalar(dt * moveSpeed);
                            if (movement.length() < distance.length()) {
                                currentPosition.add(movement);
                                characterEntity.setPosition(currentPosition);
                                characterEntity.lookAt(characterEntity.getPosition().clone().add(characterDirection));
                            } else {
                                currentPosition.copy(targetPosition);
                                characterEntity.setPosition(currentPosition);
                                characterEntity.anim.setInteger('speed', 0);
                            }
                        }

                    };

                    characterEntity.addComponent("script");
                    characterEntity.script.create('Locomotion', {});
                });
            });
        }
    }
}

export default LocomotionExample;
