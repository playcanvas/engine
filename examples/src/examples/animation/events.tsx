import * as pc from '../../../../';

class EventsExample {
    static CATEGORY = 'Animation';
    static NAME = 'Events';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'model': new pc.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
            'walkAnim': new pc.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            'bloom': new pc.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
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
            createOptions.elementInput = new pc.ElementInput(canvas);

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
                pc.AnimComponentSystem
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

                app.start();

                // setup skydome
                app.scene.exposure = 2;
                app.scene.skyboxMip = 2;
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.skyboxIntensity = 0.4;    // make it darker

                // Create an Entity with a camera component
                const cameraEntity = new pc.Entity();
                cameraEntity.addComponent("camera", {
                    clearColor: new pc.Color(0.1, 0.1, 0.1)
                });
                cameraEntity.translate(0, 1, 0);

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

                const boxes: any = {};
                const highlightedBoxes: pc.Entity[] = [];

                // create a floor made up of box models
                for (let i = -5; i <= 5; i++) {
                    for (let j = -5; j <= 5; j++) {

                        const material = new pc.StandardMaterial();
                        material.diffuse = new pc.Color(0.7, 0.7, 0.7);
                        material.gloss = 0.3;
                        material.metalness = 0.2;
                        material.useMetalness = true;
                        material.update();

                        const box = new pc.Entity();
                        boxes[`${i}${j}`] = box;
                        box.addComponent('render', {
                            type: 'box',
                            material: material
                        });
                        box.setPosition(i, -0.5, j);
                        box.setLocalScale(0.95, 1, 0.95);
                        app.root.addChild(box);
                    }
                }

                // light up a box at the given position with a random color using the emissive material property
                const highlightBox = (pos: pc.Vec3) => {
                    const i = Math.floor(pos.x + 0.5);
                    const j = Math.floor(pos.z + 0.5);
                    const colorVec = new pc.Vec3(Math.random(), Math.random(), Math.random());
                    colorVec.mulScalar(1 / colorVec.length());
                    boxes[`${i}${j}`].render.material.emissive = new pc.Color(colorVec.x, colorVec.y, colorVec.z);
                    highlightedBoxes.push(boxes[`${i}${j}`]);
                };

                // create an entity from the loaded model using the render component
                const modelEntity = assets.model.resource.instantiateRenderEntity({
                    castShadows: true
                });

                // add an anim component to the entity
                modelEntity.addComponent('anim', {
                    activate: true
                });
                modelEntity.setLocalPosition(-3, 0, 0);

                const modelEntityParent = new pc.Entity();
                modelEntityParent.addChild(modelEntity);

                app.root.addChild(modelEntityParent);

                // rotate the model in a circle around the center of the scene
                app.on('update', (dt: number) => {
                    modelEntityParent.rotate(0, 13.8 * dt, 0);
                });

                const walkTrack = assets.walkAnim.resource.animations[0].resource;

                // Add two anim events to the walk animation, one for each foot step. These events should occur just as each foot touches the ground
                walkTrack.events = new pc.AnimEvents([
                    {
                        time: walkTrack.duration * 0.1,
                        name: 'foot_step',
                        bone: 'R_foot0002_bind_JNT'
                    },
                    {
                        time: walkTrack.duration * 0.6,
                        name: 'foot_step',
                        bone: 'L_foot0002_bind_JNT'
                    }
                ]);

                // add the animation track to the anim component, with a defined speed
                modelEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);

                modelEntity.anim.on('foot_step', (event: any) => {
                    // highlight the box that is under the foot's bone position
                    highlightBox(modelEntity.findByName(event.bone).getPosition());
                });

                app.on('update', () => {
                    // on update, iterate over any currently highlighted boxes and reduce their emissive property
                    highlightedBoxes.forEach((box: pc.Entity) => {
                        const material = box.render.material as pc.StandardMaterial;
                        const emissive = material.emissive;
                        emissive.lerp(emissive, pc.Color.BLACK, 0.08);
                        material.update();
                    });
                    // remove old highlighted boxes from the update loop
                    while (highlightedBoxes.length > 5) {
                        highlightedBoxes.shift();
                    }

                    // set the camera to follow the model
                    const modelPosition = modelEntity.getPosition().clone();
                    modelPosition.y = 0.5;
                    cameraEntity.lookAt(modelPosition);

                });
            });
        });
    }
}
export default EventsExample;
