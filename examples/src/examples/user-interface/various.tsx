import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class VariousExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Various';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
            <AssetLoader name="atlas" type="textureatlas"  url="static/assets/button/red_button_atlas.json" />
            <AssetLoader name="buttonDefault" type="sprite" url="static/assets/button/red_button_default.json" />
            <AssetLoader name="buttonPressed" type="sprite" url="static/assets/button/red_button_pressed.json" />
            <AssetLoader name="buttonHover" type="sprite" url="static/assets/button/red_button_hover.json" />
            <AssetLoader name="buttonDisabled" type="sprite" url="static/assets/button/red_button_disabled.json" />
            <AssetLoader name="heart" type="texture" url="static/assets/textures/heart.png" />
            <AssetLoader name="panel" type="texture"url="static/assets/textures/blue-panel.png"/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

        // draw some axes
        const drawAxes = function (pos: pc.Vec3, scale: number) {
            const color = new pc.Color(1, 0, 0);

            const axis = new pc.Vec3();
            const end = new pc.Vec3().copy(pos).add(axis.set(scale, 0, 0));

            app.renderLine(pos, end, color);

            color.set(0, 1, 0);
            end.sub(axis.set(scale, 0, 0)).add(axis.set(0, scale, 0));
            app.renderLine(pos, end, color);

            color.set(0, 0, 1);
            end.sub(axis.set(0, scale, 0)).add(axis.set(0, 0, scale));
            app.renderLine(pos, end, color);
        };

        // use device pixel ratio
        app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

        app.start();

        // create camera
        const c = new pc.Entity();
        c.addComponent('camera', {
            clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
            farClip: 10000
        });
        c.translate(1, 1, 1);
        c.lookAt(0, 0, 0);
        app.root.addChild(c);

        // global ui elements
        let menu: pc.Entity;
        let panel: pc.Entity;
        let hud: pc.Entity;
        let score: pc.Entity;
        let lives: Array<pc.Entity>;
        let fps: pc.Entity;
        let button: pc.Entity;

        let spin = false; // annoy mode
        let a = 0; // used for animating
        let points = 0; // current score
        let averageFps = 60; // current FPS

        // create a button
        // an image element, with button script and selector attached
        // and a text element label
        const createButton = function (text: string, x: number, y: number, active: boolean) {
            const button = new pc.Entity('Button');
            const label = new pc.Entity();
            button.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1],
                width: 256,
                height: 64,
                spriteAsset: assets.buttonDefault
            });
            button.element.useInput = true;

            button.addComponent('button', {
                active: active,
                transitionMode: pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE,
                hoverSpriteAsset: assets.buttonHover,
                pressedSpriteAsset: assets.buttonPressed,
                inactiveSpriteAsset: assets.buttonDisabled,
                imageEntity: button
            });

            button.setLocalPosition(x, y, 0);

            button.button.on('pressedstart', function () {
                label.translateLocal(0, -4, 0);
            });

            button.button.on('pressedend', function () {
                label.translateLocal(0, 4, 0);
            });

            label.name = "label";
            label.addComponent('element', {
                anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
                pivot: new pc.Vec2(0.5, 0.5),
                width: 256,
                height: 64,
                type: "text",
                text: text,
                fontAsset: assets.font,
                color: active ? new pc.Color(1, 1, 1) : new pc.Color(0.2, 0.2, 0.2),
                opacity: 0.5
            });
            label.setLocalPosition(0, 4, 0);
            button.addChild(label);

            return button;
        };

        // enable the menu, disable the hud
        const showMenu = function () {
            menu.enabled = true;
            hud.enabled = false;
            fps.enabled = false;
        };

        // enable and reset the hud, disable the menu
        const showGame = function () {
            menu.enabled = false;
            hud.enabled = true;
            fps.enabled = true;
            for (let i = 0; i < lives.length; i++) {
                lives[i].enabled = true;
                points = 0;
            }
        };

        // toggle annoy mode
        function toggleSpin() {
            spin = !spin;
        }

        // create the menu screen, panel and buttons
        function createMenu() {
            menu = new pc.Entity();
            menu.addComponent("screen", { resolution: new pc.Vec2(640, 480), screenSpace: true });
            menu.screen.scaleMode = "blend";
            menu.screen.referenceResolution = new pc.Vec2(1280, 720);
            app.root.addChild(menu);

            panel = new pc.Entity();
            panel.name = "panel";
            panel.addComponent('element', {
                anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
                pivot: new pc.Vec2(0.5, 0.5),
                width: 300,
                height: 300,
                type: "image",
                textureAsset: assets.panel
            });

            button = createButton("START", 0, -22, true);
            button.button.on('click', function () {
                showGame();
            });
            panel.addChild(button);

            button = createButton("ANNOY", 0, -108, true);
            button.button.on('click', function () {
                toggleSpin();
            });
            panel.addChild(button);

            button = createButton("DISABLED", 0, -192, false);

            panel.addChild(button);
            menu.addChild(panel);
            menu.enabled = false;
        }

        // create the score text and the lives display
        function createHud() {
            hud = new pc.Entity();
            hud.name = "hud";
            hud.addComponent("screen", { resolution: new pc.Vec2(640, 480), screenSpace: true });
            hud.screen.scaleMode = "blend";
            hud.screen.referenceResolution = new pc.Vec2(1280, 720);

            score = new pc.Entity();
            score.addComponent("element", {
                anchor: [1, 1, 1, 1],
                pivot: [1, 1],
                type: "text",
                text: "0",
                fontSize: 64,
                fontAsset: assets.font,
                color: new pc.Color(1, 1, 1)
            });
            hud.addChild(score);
            score.translateLocal(-84, -10, 0);

            lives = [];
            for (let i = 0; i < 3; i++) {
                lives[i] = new pc.Entity("Life " + i);
                lives[i].addComponent("element", {
                    anchor: [1, 1, 1, 1],
                    pivot: [1, 1],
                    width: 64,
                    height: 64,
                    type: "image",
                    textureAsset: assets.heart
                });
                hud.addChild(lives[i]);
                lives[i].translateLocal(-10, -64 * i - 10, 0);
            }
            app.root.addChild(hud);
            hud.enabled = false;
        }

        // create some world space text that displays the current FPS
        function createFps() {
            fps = new pc.Entity();
            fps.addComponent("element", {
                anchors: [0, 0, 0, 0],
                pivot: [0.5, 0],
                type: "text",
                text: "FPS",
                fontSize: 16,
                fontAsset: assets.font,
                color: new pc.Color(1, 1, 1),
                opacity: 1
            });
            fps.setLocalScale(1 / 64, 1 / 64, 1.64);
            app.root.addChild(fps);
        }

        // create the entities
        createMenu();
        createHud();
        createFps();

        // show main menu
        showMenu();

        // update every frame
        app.on("update", function (dt) {
            // increment angle counter
            a += dt;

            // draw origin
            drawAxes(pc.Vec3.ZERO, 1);

            // if hud is active
            if (hud && hud.enabled) {
                // increment score
                points += 10;
                score.element.text = Number(points).toString();

                // "lose" lives
                if (points > 1000) {
                    lives[2].enabled = false;
                }
                if (points > 2000) {
                    lives[1].enabled = false;
                }
                if (points > 3000) {
                    lives[0].enabled = false;
                    showMenu(); // return to main menu
                }

                // update world space FPS counter
                averageFps = pc.math.lerp(averageFps, (1 / dt), 0.01); // smooth fps
                fps.element.text = "Hello World!\n" + averageFps.toPrecision(3) + "fps";
                fps.setLocalPosition(
                    0.5 * Math.sin(2 * a),
                    0.125 * Math.sin(3 * a),
                    0.125 * Math.sin(5 * a)
                );
            } else {
                // if annoy mode is active rotate the panel
                if (spin) {
                    panel.rotateLocal(0, 0, 90 * dt);
                }
            }
        });
    }
}

export default VariousExample;
