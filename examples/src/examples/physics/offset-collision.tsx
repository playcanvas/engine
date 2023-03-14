import React from 'react';
import * as pc from '../../../../';

class OffsetCollisionExample {
    static CATEGORY = 'Physics';
    static NAME = 'Offset Collision';

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

        const assets = {
            'model': new pc.Asset('model', 'container', {url: '/static/assets/models/bitmoji.glb'}),
            'idleAnim': new pc.Asset('idleAnim', 'container', {url: '/static/assets/animations/bitmoji/idle.glb'}),
            'helipad.dds': new pc.Asset('helipad.dds', 'cubemap', {url: '/static/assets/cubemaps/helipad.dds'}, {type: pc.TEXTURETYPE_RGBM})
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            // setup skydome
            app.scene.exposure = 2;
            app.scene.skyboxMip = 2;
            app.scene.setSkybox(assets['helipad.dds'].resources);

            pc.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });

            pc.WasmModule.getInstance('Ammo', demo);

            function demo() {
                app.start();

                // Create an entity with a light component
                const lightEntity = new pc.Entity();
                lightEntity.addComponent("light", {
                    castShadows: true,
                    intensity: 1.5,
                    normalOffsetBias: 0.2,
                    shadowType: pc.SHADOW_PCF5,
                    shadowDistance: 12,
                    shadowResolution: 4096,
                    shadowBias: 0.2
                });
                app.root.addChild(lightEntity);
                lightEntity.setLocalEulerAngles(45, 30, 0);

                // Set the gravity for our rigid bodies
                app.systems.rigidbody.gravity.set(0, -9.81, 0);

                function createMaterial(color: pc.Color) {
                    const material = new pc.StandardMaterial();
                    material.diffuse = color;
                    // we need to call material.update when we change its properties
                    material.update();
                    return material;
                }

                // create a few materials for our objects
                const red = createMaterial(new pc.Color(1, 0.3, 0.3));
                const gray = createMaterial(new pc.Color(0.7, 0.7, 0.7));

                const floor = new pc.Entity();
                floor.addComponent("render", {
                    type: "box",
                    material: gray
                });

                // Scale it and move it so that the top is at 0 on the y axis
                floor.setLocalScale(10, 1, 10);
                floor.translateLocal(0, -0.5, 0);

                // Add a rigidbody component so that other objects collide with it
                floor.addComponent("rigidbody", {
                    type: "static",
                    restitution: 0.5
                });

                // Add a collision component
                floor.addComponent("collision", {
                    type: "box",
                    halfExtents: new pc.Vec3(5, 0.5, 5)
                });

                // Add the floor to the hierarchy
                app.root.addChild(floor);

                // Create an entity from the loaded model using the render component
                const modelEntity = assets.model.resource.instantiateRenderEntity({
                    castShadows: true
                });

                // Add an anim component to the entity
                modelEntity.addComponent('anim', {
                    activate: true
                });

                // create an anim state graph
                const animStateGraphData = {
                    "layers": [
                        {
                            "name": "characterState",
                            "states": [
                                {
                                    "name": "START"
                                },
                                {
                                    "name": "Idle",
                                    "speed": 1.0,
                                    "loop": true
                                }
                            ],
                            "transitions": [
                                {
                                    "from": "START",
                                    "to": "Idle"
                                }
                            ]
                        }
                    ],
                    "parameters": {}
                };

                // load the state graph into the anim component
                modelEntity.anim.loadStateGraph(animStateGraphData);

                // Add a rigid body and collision for the head with offset as the model's origin is
                // at the feet on the floor
                modelEntity.addComponent("rigidbody", {
                    type: "static",
                    restitution: 0.5
                });

                modelEntity.addComponent("collision", {
                    type: "sphere",
                    radius: 0.3,
                    linearOffset: [0, 1.25, 0]
                });

                // load the state graph asset resource into the anim component
                const characterStateLayer = modelEntity.anim.baseLayer;
                characterStateLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);

                app.root.addChild(modelEntity);

                // Create an Entity with a camera component
                const cameraEntity = new pc.Entity();
                cameraEntity.addComponent("camera");
                cameraEntity.translate(0, 2, 5);
                const lookAtPosition = modelEntity.getPosition();
                cameraEntity.lookAt(lookAtPosition.x, lookAtPosition.y + 0.75, lookAtPosition.z);

                app.root.addChild(cameraEntity);

                // create a ball template that we can clone in the update loop
                const ball = new pc.Entity();
                ball.tags.add('shape');
                ball.setLocalScale(0.4, 0.4, 0.4);
                ball.addComponent("render", {
                    type: "sphere"
                });

                ball.addComponent("rigidbody", {
                    type: "dynamic",
                    mass: 50,
                    restitution: 0.5
                });

                ball.addComponent("collision", {
                    type: "sphere",
                    radius: 0.2
                });

                ball.enabled = false;

                // initialize variables for our update function
                let timer = 0;
                let count = 40;

                // Set an update function on the application's update event
                app.on("update", function (dt) {
                    // create a falling box every 0.2 seconds
                    if (count > 0) {
                        timer -= dt;
                        if (timer <= 0) {
                            count--;
                            timer = 0.5;

                            // Create a new ball to drop
                            const clone = ball.clone();
                            clone.rigidbody.teleport(pc.math.random(-0.25, 0.25), 5, pc.math.random(-0.25, 0.25));

                            app.root.addChild(clone);
                            clone.enabled = true;
                        }
                    }

                    // Show active bodies in red and frozen bodies in gray
                    app.root.findByTag("shape").forEach(function (entity: pc.Entity) {
                        entity.render.meshInstances[0].material = entity.rigidbody.isActive() ? red : gray;
                    });

                    // Render the offset collision
                    app.scene.immediate.drawWireSphere(
                        modelEntity.collision.getShapePosition(),
                        0.3,
                        pc.Color.GREEN,
                        16,
                        true,
                        app.scene.layers.getLayerByName("World")
                    );
                });
            }
        });
    }
}

export default OffsetCollisionExample;
