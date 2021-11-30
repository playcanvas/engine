import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class TextExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Text';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/courier.json' />
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }): void {

        // Create the application with input and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
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
            clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
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

        /** Basic Text */
        const textBasic = new pc.Entity();
        textBasic.setLocalPosition(0, 200, 0);
        textBasic.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 42,
            text: "Basic Text",
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(textBasic);

        /** Markup Text with wrap */
        const textMarkup = new pc.Entity();
        textMarkup.setLocalPosition(0, 50, 0);
        textMarkup.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 32,
            text: 'There are seven colors in the rainbow: [color="#ff0000"]red[/color], [color="#ffa500"]orange[/color], [color="#ffff00"]yellow[/color], [color="#00ff00"]green[/color], [color="#0000ff"]blue[/color], [color="#4b0082"]indigo[/color] and [color="#7f00ff"]violet[/color].',
            width: 500,
            height: 100,
            autoWidth: false,
            autoHeight: false,
            wrapLines: true,
            enableMarkup: true,
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(textMarkup);

        /** Text with outline */
        const textOutline = new pc.Entity();
        textOutline.setLocalPosition(0, -100, 0);
        textOutline.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 62,
            text: "Outline",
            color: new pc.Color(0, 0, 0),
            outlineColor: new pc.Color(1, 1, 1),
            outlineThickness: 0.75,
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(textOutline);

        /** Text with drop shadow */
        const textDropShadow = new pc.Entity();
        textDropShadow.setLocalPosition(0, -200, 0);
        textDropShadow.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: 62,
            text: "Drop Shadow",
            shadowColor: new pc.Color(1, 0, 0),
            shadowOffset: new pc.Vec2(0.25, -0.25),
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(textDropShadow);
    }
}

export default TextExample;
