import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class TextDropShadowExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Drop Shadow';

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

        // Create a text element with drop shadow enabled
        const text = new pc.Entity();
        text.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            autoWidth: false,
            fontSize: 96,
            pivot: [0.5, 0.5],
            shadowColor: new pc.Color(1, 0, 0),
            shadowOffset: new pc.Vec2(0.25, -0.25),
            text: "Drop Shadow",
            type: pc.ELEMENTTYPE_TEXT,
            width: 640
        });
        screen.addChild(text);

        // Apply the font to the text element
        text.element.fontAsset = assets.font.id;
    }
}

export default TextDropShadowExample;
