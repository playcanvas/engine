import * as pc from '../../../../';

class ShaderCompileExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Shader Compile';

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        // This example servers as a test framework for large shader compilation speed test. Enable tracking for it.
        pc.Tracing.set(pc.TRACEID_SHADER_COMPILE, true);

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        const assets = {
            'color': new pc.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
            'normal': new pc.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
            'gloss': new pc.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
            'luts': new pc.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            // helper function to create a primitive with shape type, position, scale, color
            function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color, assetManifest: any, id: boolean = false) {

                // create material of specified color
                const material = new pc.StandardMaterial();
                material.diffuse = color;
                material.gloss = 0.4;
                material.useMetalness = true;

                material.diffuseMap = assetManifest.color.resource;
                material.normalMap = assetManifest.normal.resource;
                material.glossMap = assetManifest.gloss.resource;
                material.metalness = 0.4;

                material.diffuseMapTiling.set(7, 7);
                material.normalMapTiling.set(7, 7);
                material.glossMapTiling.set(7, 7);

                // do a small update to a chunk to generate unique shader each time, to avoid any shader compilation caching
                if (id) {
                    material.chunks.viewDirPS = `
                        void getViewDir() {
                            dViewDirW = normalize(view_position - vPositionW);
                            dViewDirW.x += 0.00001 * ${Math.random()};
                        }
                    `;
                }

                material.update();

                // create primitive
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: primitiveType,
                    material: material
                });

                // set position and scale and add it to scene
                primitive.setLocalPosition(position);
                primitive.setLocalScale(scale);
                app.root.addChild(primitive);

                return primitive;
            }

            app.start();

            // enable area lights which are disabled by default for clustered lighting
            app.scene.lighting.areaLightsEnabled = true;

            // set the loaded area light LUT data
            const luts = assets.luts.resource;
            app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

            // set up some general scene rendering properties
            app.scene.toneMapping = pc.TONEMAP_ACES;

            // setup skydome
            app.scene.skyboxMip = 1;
            app.scene.skyboxIntensity = 0.7;
            app.scene.envAtlas = assets.helipad.resource;

            // create ground plane
            createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.3, 0.3), assets);

            // Create the camera, which renders entities
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.2, 0.2, 0.2),
                fov: 60,
                farClip: 100000
            });
            app.root.addChild(camera);
            camera.setLocalPosition(0, 15, 40);
            camera.lookAt(0, 0, 0);

            // generate a grid of spheres, each with a unique material / shader
            for (let x = -10; x <= 10; x += 6) {
                for (let y = -10; y <= 10; y += 6) {
                    const pos = new pc.Vec3(x, 0.6, y);
                    const color = new pc.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7);
                    createPrimitive("sphere", pos, new pc.Vec3(1, 1, 1), color, assets, true);
                }
            }

            // create some omni lights
            const count = 10;
            const lights: Array<pc.Entity> = [];
            for (let i = 0; i < count; i++) {
                const color = new pc.Color(Math.random(), Math.random(), Math.random(), 1);
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "spot",
                    color: color,
                    intensity: 4,
                    range: 16,
                    castShadows: false
                });

                // attach a render component with a small cone to each light
                const material = new pc.StandardMaterial();
                material.emissive = color;
                material.update();

                light.addComponent('render', {
                    type: "sphere",
                    material: material
                });
                light.setLocalScale(0.5, 0.5, 0.5);

                app.root.addChild(light);
                lights.push(light);
            }

            // update things each frame
            let time = 0;
            app.on("update", function (dt: number) {
                time += dt;

                // orbit spot lights around
                lights.forEach(function (light, i) {
                    const angle = (i / lights.length) * Math.PI * 2;
                    light.setLocalPosition(8 * Math.sin(time + angle), 4, 8 * Math.cos(time + angle));
                });
            });
        });
    }
}

export default ShaderCompileExample;
