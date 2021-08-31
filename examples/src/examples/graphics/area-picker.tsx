import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class AreaPickerExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Area Picker';

    load() {
        return <>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { bloom : pc.Asset, 'helipad.dds': pc.Asset}): void {
        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // setup skydome
        app.scene.skyboxMip = 2;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // use a quarter resolution for picker render target (faster but less precise - can miss small objects)
        const pickerScale = 0.25;
        let mouseX = 0, mouseY = 0;

        // generate a box area with specified size of random primitives
        const size = 30;
        const halfSize = size * 0.5;
        for (let i = 0; i < 300; i++) {
            const shape = Math.random() < 0.5 ? "cylinder" : "sphere";
            const position = new pc.Vec3(Math.random() * size - halfSize, Math.random() * size - halfSize, Math.random() * size - halfSize);
            const scale = 1 + Math.random();
            const entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));
            app.root.addChild(entity);
        }

        // handle mouse move event and store current mouse position to use as a position to pick from the scene
        new pc.Mouse(document.body).on(pc.EVENT_MOUSEMOVE, function (event) {
            mouseX = event.x;
            mouseY = event.y;
        }, this);

        // Create an instance of the picker class
        // Lets use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
        const picker = new pc.Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);

        // helper function to create a primitive with shape type, position, scale
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {
            // create material of random color
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
            material.shininess = 60;
            material.metalness = 0.4;
            material.useMetalness = true;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);

            return primitive;
        }

        // Create main camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });

        // add bloom postprocessing (this is ignored by the picker)
        camera.addComponent("script");
        camera.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.7,
                blurAmount: 4
            }
        });
        app.root.addChild(camera);

        // function to draw a 2D rectangle in the screen space coordinates
        function drawRectangle(x: number, y: number, w: number, h: number) {

            const pink = new pc.Color(1, 0.02, 0.58);

            // transform 4 2D screen points into world space
            const pt0 = camera.camera.screenToWorld(x, y, 1);
            const pt1 = camera.camera.screenToWorld(x + w, y, 1);
            const pt2 = camera.camera.screenToWorld(x + w, y + h, 1);
            const pt3 = camera.camera.screenToWorld(x, y + h, 1);

            // and connect them using white lines
            const points = [pt0, pt1,  pt1, pt2,  pt2, pt3,  pt3, pt0];
            const colors = [pink, pink, pink, pink, pink, pink, pink, pink];
                // const colors = [pc.Color.WHITE, pc.Color.WHITE,  pc.Color.WHITE, pc.Color.WHITE,
                // pc.Color.WHITE, pc.Color.WHITE,  pc.Color.WHITE, pc.Color.WHITE];
            app.renderLines(points, colors);
        }

        // sets material emissive color to specified color
        function highlightMaterial(material: pc.Material, color: pc.Color) {
            // @ts-ignore engine-tsd
            material.emissive = color;
            material.update();
        }

        // array of highlighted materials
        const highlights: any = [];

        // update each frame
        let time = 0;
        app.on("update", function (dt) {

            time += dt * 0.1;

            // orbit the camera around
            if (!camera) {
                return;
            }

            camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
            camera.lookAt(pc.Vec3.ZERO);

            // turn all previously highlighted meshes to black at the start of the frame
            for (let h = 0; h < highlights.length; h++) {
                highlightMaterial(highlights[h], pc.Color.BLACK);
            }
            highlights.length = 0;

            // Make sure the picker is the right size, and prepare it, which renders meshes into its render target
            if (picker) {
                picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
                picker.prepare(camera.camera, app.scene);
            }

            // areas we want to sample - two larger rectangles, one small square, and one pixel at a mouse position
            // assign them different highlight colors as well
            const areas = [
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.3, canvas.clientHeight * 0.3),
                    size: new pc.Vec2(100, 200),
                    color: pc.Color.YELLOW
                },
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.6, canvas.clientHeight * 0.7),
                    size: new pc.Vec2(200, 20),
                    color: pc.Color.CYAN
                },
                {
                    pos: new pc.Vec2(canvas.clientWidth * 0.8, canvas.clientHeight * 0.3),
                    size: new pc.Vec2(5, 5),
                    color: pc.Color.MAGENTA
                },
                {
                    // area based on mouse position
                    pos: new pc.Vec2(mouseX, mouseY),
                    size: new pc.Vec2(1, 1),
                    color: pc.Color.RED
                }
            ];

            // process all areas
            for (let a = 0; a < areas.length; a++) {
                const areaPos = areas[a].pos;
                const areaSize = areas[a].size;
                const color = areas[a].color;

                // display 2D rectangle around it
                drawRectangle(areaPos.x, areaPos.y, areaSize.x, areaSize.y);

                // get list of meshInstances inside the area from the picker
                // this scans the pixels inside the render target and maps the id value stored there into meshInstalces
                const selection = picker.getSelection(areaPos.x * pickerScale, areaPos.y * pickerScale, areaSize.x * pickerScale, areaSize.y * pickerScale);

                // process all meshInstances it found - highlight them to appropriate color for the area
                for (let s = 0; s < selection.length; s++) {
                    if (selection[s]) {
                        highlightMaterial(selection[s].material, color);
                        highlights.push(selection[s].material);
                    }
                }
            }
        });
    }
}

export default AreaPickerExample;
