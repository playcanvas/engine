import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class TextOutlineExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Outline';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // Create a camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0)
        });
        app.root.addChild(camera);

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // Create a text element a font outline enabled
        const text = new pc.Entity();
        text.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            autoWidth: false,
            color: new pc.Color(0, 0, 0),
            fontSize: 128,
            outlineColor: new pc.Color(1, 1, 1),
            outlineThickness: 0.75,
            pivot: [0.5, 0.5],
            text: "Outline",
            type: pc.ELEMENTTYPE_TEXT,
            width: 640
        });
        screen.addChild(text);

        // Apply the font to the text element
        text.element.fontAsset = assets.font.id;
    }
}

export default TextOutlineExample;
