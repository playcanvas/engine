![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# PlayCanvas WebGL Game Engine

PlayCanvas is an open-source game engine. It uses HTML5 and WebGL to run games and other interactive 3D content in any mobile or desktop browser.

## Project Showcase

Many games and apps have been published using the PlayCanvas engine. Here is a small selection:

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://apps.facebook.com/1315812941823883/) [![Flappy Bird](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/8/375389/23PRTL-image-25.jpg)](https://playcanv.as/p/2OlkUaxF/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](http://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/ )  



You can see more games on the [PlayCanvas website](https://playcanvas.com/explore).

## Users

PlayCanvas is used by leading companies in video games, advertising and visualization such as:  
**Animech, ARM, Disney, Facebook, IGT, King, Miniclip, Leapfrog, Mozilla, Nickelodeon, Nordeus, PikPok, PlaySide Studios, Polaris, Samsung, Spry Fox, Zeptolab, Zynga**

## Features

PlayCanvas is a fully featured game engine.

* 🧊 **Graphics** - Advanced 2D + 3D graphics engine built on WebGL 1 & 2.
* 🏃 **Animation** - Powerful state-based animations for characters and arbitrary scene properties
* ⚛️ **Physics** - Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* 🎮 **Input** - Mouse, keyboard, touch, gamepad and VR controller APIs
* 🔊 **Sound** - 3D positional sounds built on the Web Audio API
* 📦 **Assets** - Asynchronous streaming system built on [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/) and [Basis](https://github.com/BinomialLLC/basis_universal) compression
* 📜 **Scripts** - Write game behaviors in Typescript or JavaScript

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
        const canvas = document.getElementById('application');
        const app = new pc.Application(canvas);

        // fill the available space at full resolution
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // ensure canvas is resized when window changes size
        window.addEventListener('resize', () => app.resizeCanvas());

        // create box entity
        const box = new pc.Entity('cube');
        box.addComponent('model', {
            type: 'box'
        });
        app.root.addChild(box);

        // create camera entity
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.1, 0.1, 0.1)
        });
        app.root.addChild(camera);
        camera.setPosition(0, 0, 3);

        // create directional light entity
        const light = new pc.Entity('light');
        light.addComponent('light');
        app.root.addChild(light);
        light.setEulerAngles(45, 0, 0);

        // rotate the box according to the delta time since the last frame
        app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));

        app.start();
    </script>
</body>
</html>
```

Want to play with the code yourself? Edit it on [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

## How to build

Ensure you have [Node.js](https://nodejs.org) installed. Then, install all of the required Node.js dependencies:

    npm install

To execute a build of the engine to build/playcanvas-latest.js, do:

    npm run build

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

## How to get models?

To convert any models created using a 3D modelling package see [this page](https://developer.playcanvas.com/en/engine/) in the developer documentation.

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

    # Runs the tests once over playcanvas.js - mainly used by CI, but sometimes useful if you want to
    # test the engine after building it. Make sure to do `npm run build` first to make sure you have
    # an up-to-date build.
    npm run test:release

## Documentation

Full documentation available on the [PlayCanvas Developer](https://developer.playcanvas.com) site including [API reference](https://developer.playcanvas.com/en/api/). To build a local copy of the API reference manual to the docs folder, do:

    npm run docs

## Tutorials & Examples

See all the [tutorials](https://developer.playcanvas.com/tutorials/) here.

## TypeScript Bindings

You can develop TypeScript applications against the PlayCanvas engine. To generate a TypeScript definitions file for the entire API, do:

    npm run tsd

This will output to build/output/playcanvas.d.ts

## Generating Source Map

To build the source map to allow for easier engine debugging, use the following command:

    npm run build -- -m

This will output to build/output/playcanvas.js.map

## Getting Help

[**Forums**](https://forum.playcanvas.com) - Use the forum to ask/answer questions about PlayCanvas.

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

The PlayCanvas Engine is released under the [MIT](https://opensource.org/licenses/MIT) license. See LICENSE file.
