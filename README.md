![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# PlayCanvas WebGL Game Engine

PlayCanvas is an open-source game engine. It uses HTML5 and WebGL to run games and other interactive 3D content in all modern browsers without the need for a plugin.

## Project Showcase

Many games and apps have been published using the PlayCanvas engine. Here is a small selection:

[![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://apps.facebook.com/1315812941823883/) [![Disney: Hour of Code](https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/images/disney_moana_hourofcode.jpg)](http://partners.disney.com/hour-of-code/wayfinding-with-code) [![WebVR Lab](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/446331/CAAA6B-image-25.jpg)](https://playcanv.as/p/sAsiDvtC/)
<br />
[![TANX](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/45093/ESR5DQ-image-25.jpg)](https://tanx.io/) [![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://chrome.google.com/webstore/detail/swooop/jblimahfbhdcengjfbdpdngcfcghladf) [![Flappy Bird](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/8/375389/23PRTL-image-25.jpg)](http://www.miniclip.com/games/flappy-bird/en/) [![Virtual Voodoo](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/422705/E23A1E-image-25.jpg)](http://www.miniclip.com/games/virtual-voodoo/en/)
<br />
[![Space Base](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/411394/I2C48B-image-25.jpg)](https://playcanv.as/p/yipplmVO/) [![Sponza Runtime Lightmaps](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/391368/221DFF-image-25.jpg)](https://playcanv.as/p/txPePQvy/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt) [![Orange Room VR](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/434546/BKST60-image-25.jpg)](https://playcanv.as/p/zi09Xvld/)
<br />
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](http://car.playcanvas.com/) [![Steampunk Slots](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/23510/344862/VH0NOH-image-25.jpg)](https://playcanv.as/p/nL1dYbMv) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](http://casino.playcanvas.com/) [![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](http://seemore.playcanvas.com/)

You can see more games on the [PlayCanvas website](https://playcanvas.com/explore).

## Users

PlayCanvas Engine and Tools been used by leading companies in game development, automotive, digital agencies and more. Some of them are:  
**Disney, King, Zynga, Miniclip, Nickelodeon, Leapfrog, IGT, ARM, Samsung, Mozilla, Facebook**

## Features

The PlayCanvas Engine is a fully featured game engine.

* **Graphics**
    * WebGL 2.0 based renderer (with fallback to WebGL 1.0)
    * Physically based rendering (PBR)
    * Directional, point and spot lights
    * Shadow mapping (PCF and VSM implementations)
    * Runtime lightmap baking
    * Static, skinned and morphed meshes
    * GPU Particle engine with editor
    * PostFX library: bloom, edge detect, FXAA, vignette, etc
    * Seamless default material support from Maya, 3DS Max, Blender, etc.
    * Full model export pipeline from Maya, 3DS Max, Blender, etc via [Assets User Manual](http://developer.playcanvas.com/en/user-manual/assets/)
* **Collision & Physics**
    * Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* **Audio**
    * 3D Positional audio via Web Audio API
* **Resource Loading**
    * Simple and powerful resource loading
    * Streaming of individual assets
    * Asset Variants - loads compressed textures (DXT, PVR, ETC1, ETC2) based on platform support
* **Entity / Component System**
    * Built-in components: model, sound, animation, camera, collision, light, rigidbody, script, particlesystem
* **Scripting system**
    * Write game behaviors by attaching JavaScript to game entities
    * Live code hot-swap enables rapid iteration
* **Input**
    * Mouse, Keyboard, Touch, Gamepad, VR

## Usage

Here's a super-simple Hello World example - a spinning cube!

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PlayCanvas Hello Cube</title>
    <meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no' />
    <style>
        body {
            margin: 0;
            overflow: hidden;
        }
    </style>
    <script src='https://code.playcanvas.com/playcanvas-stable.min.js'></script>
</head>
<body>
    <canvas id='application'></canvas>
    <script>
        // create a PlayCanvas application
        var canvas = document.getElementById('application');
        var app = new pc.Application(canvas, { });
        app.start();

        // fill the available space at full resolution
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // ensure canvas is resized when window changes size
        window.addEventListener('resize', function() {
            app.resizeCanvas();
        });

        // create box entity
        var cube = new pc.Entity('cube');
        cube.addComponent('model', {
            type: 'box'
        });

        // create camera entity
        var camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });

        // create directional light entity
        var light = new pc.Entity('light');
        light.addComponent('light');

        // add to hierarchy
        app.root.addChild(cube);
        app.root.addChild(camera);
        app.root.addChild(light);

        // set up initial positions and orientations
        camera.setPosition(0, 0, 3);
        light.setEulerAngles(45, 0, 0);

        // register a global update event
        app.on('update', function (deltaTime) {
            cube.rotate(10 * deltaTime, 20 * deltaTime, 30 * deltaTime);
        });
    </script>
</body>
</html>
```

Want to play with the code yourself? Edit it on [CodePen](http://codepen.io/playcanvas/pen/NPbxMj).

## Tutorials & Examples

See all the [tutorials](http://developer.playcanvas.com/tutorials/) here.

## Documentation

Full documentation available on the [PlayCanvas Developer](http://developer.playcanvas.com) site including [API reference](http://developer.playcanvas.com/en/api/)

## Releases

A full list of Releases and Release Notes is available [here](https://github.com/playcanvas/engine/releases).

## How to get models?

To convert any models created using a 3D modelling package see [this page](http://developer.playcanvas.com/en/engine/) in the developer documentation.

## How to build

* Ensure you have [nodejs](https://nodejs.org) installed
* Ensure you have [Java](https://java.com/en/download/) installed.

The first time you build you will be asked to install dependencies using `npm`. e.g.

    npm install fs-extra
    npm install google-closure-compiler
    npm install preprocessor

Then, to execute a build of the engine to the build/output folder, do:

    cd build
    node build.js

See the built in help for more build instructions

    node build.js -h

Pre-built versions of the engine are also available.

Latest development release:

* https://code.playcanvas.com/playcanvas-latest.js
* https://code.playcanvas.com/playcanvas-latest.min.js

Latest stable release:

* https://code.playcanvas.com/playcanvas-stable.js
* https://code.playcanvas.com/playcanvas-stable.min.js

Specific engine versions:

* https://code.playcanvas.com/playcanvas-0.181.11.js
* https://code.playcanvas.com/playcanvas-0.181.11.min.js

## How to run tests

PlayCanvas makes use of Karma for running unit tests, and provides three test ways of executing them depending on what phase of development you're in:

    # Runs the tests once over the unbuilt source files - useful if you just want a quick 'all-clear'
    npm run test

    # Watches all source and test files for changes, and automatically re-runs the tests when they change.
    # Open http://localhost:9876/debug.html in your browser to debug the tests in real time.
    #
    # You can also edit the `tests/**/test_*.js` glob in tests/karma.conf.js to run a subset of the tests,
    # during development.
    npm run test:watch

    # Runs the tests once over playcanvas-latest.js - mainly used by CI, but sometimes useful if you want
    # to test the engine after building it. Make sure to do `npm run build` first to make sure you have
    # an up-to-date build.
    npm run test:release

## Getting Help

[**Forums**](https://forum.playcanvas.com) - Use the forum to ask/answer questions about PlayCanvas.

[**Discord**](https://discord.gg/N67tQuU) - Real-time text, voice and video chat for the PlayCanvas developer community.

## Contributing

Want to help us make the best 3D engine on the web? Great!
Check out [CONTRIBUTING.md](https://github.com/playcanvas/engine/blob/master/.github/CONTRIBUTING.md) that will get you started.
And look for ["good first PR"](https://github.com/playcanvas/engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+PR%22)  label in Issues.

### Github Issues

Please use [Github Issues](https://github.com/playcanvas/engine/issues) to report bugs or request features.

### Reporting bugs

Please follow these steps to report a bug

1. **Search for related issues** - search the existing issues so that you don't create duplicates

2. **Create a testcase** - Please create the smallest isolated testcase that you can that reproduces your bug

3. **Share as much information as possible** - everything little helps, OS, browser version, all that stuff.

## PlayCanvas Platform

The PlayCanvas Engine is an open source engine which you can use to create games and 3D visualisation in the browser. In addition to the engine we also make the [PlayCanvas development platform](https://playcanvas.com/) which features an Visual Editor, asset management, code editing, hosting and publishing services.

## License

The PlayCanvas Engine is released under the [MIT](http://opensource.org/licenses/MIT) license. See LICENSE file.
