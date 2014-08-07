![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# PlayCanvas WebGL Game Engine

PlayCanvas is an open-source game engine. It uses HTML5 and WebGL to run games and other interactive 3D content in all modern browsers without the need for a plugin.

## Published games

Many games have been published using the PlayCanvas engine. Here is a small selection.

[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](http://swooop.playcanvas.com) [![Dungeon Fury](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4450/DVBWHU-image-25.jpg)](http://dungeonfury.playcanvas.com) [![Accelerally](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/8/3489/RK8NH5-image-25.jpg)](http://apps.playcanvas.com/will/acceleronly/accelerally) [![Going Around](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/7/3491/HMYM08-image-25.jpg)](http://apps.playcanvas.com/dave/goingaround/goingaround)

You can see more games on the [PlayCanvas website](https://playcanvas.com/play).

## Features

The PlayCanvas Engine is a fully feature 3D game engine.

* **Graphics**
    * WebGL-based 3D renderer
    * Ambient, directional, point and spot lights
    * Static and Skinned Meshes
    * Skinned animation support
    * Shadows
    * Seamless default material support from Maya, 3DS Max, Blender, etc.
    * Full model export pipeline from Maya, 3DS Max, Blender, etc via [PlayCanvas Tools](https://playcanvas.com)
    * PostFX library, bloom, bokah, edge detect, fxaa, vignette, etc
* **Collision & Physics**
    * Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* **Audio**
    * 3D Positional audio via Web Audio API
* **Resource Loading**
    * Simple and powerful resource loading
* **Entity / Component System**
    * Built-in components for model rendering, animation, audio sources, rigidbodies, collision, trigger volumes
* **Scripting system**
    * Write game behaviours by attaching Javascript to game entities.
* **Input**
    * Mouse, Keyboard, Touch, Gamepad support

## Usage

Here's a super-simple Hello World example - a spinning cube!

```html
<script>
    // Create a PlayCanvas application
    var canvas = document.getElementById("application-canvas");
    var app = new pc.fw.Application(canvas, {});
    app.start();

    // Fill the available space at full resolution
    app.setCanvasFillMode(pc.fw.FillMode.FILL_WINDOW);
    app.setCanvasResolution(pc.fw.ResolutionMode.AUTO);

    // Create box entity
    var cube = new pc.fw.Entity();
    app.context.systems.model.addComponent(cube, {
        type: "box"
    });

    // Create camera entity
    var camera = new pc.fw.Entity();
    app.context.systems.camera.addComponent(camera, {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });

    // Create directional light entity
    var light = new pc.fw.Entity();
    app.context.systems.light.addComponent(light);

    // Add to hierarchy
    app.context.root.addChild(cube);
    app.context.root.addChild(camera);
    app.context.root.addChild(light);

    // Set up initial positions and orientations
    camera.setPosition(0, 0, 3);
    light.setEulerAngles(45, 0, 0);

    // Register an update event
    app.on("update", function (deltaTime) {
    	cube.rotate(10 * deltaTime, 20 * deltaTime, 30 * deltaTime);
    });
</script>
```

Want to play with the code yourself? Edit it on [CodePen](http://codepen.io/daredevildave/pen/mkazy).

## Examples

See all the [examples](http://playcanvas.github.io) here or browse them locally in the examples directory

## How to build

The PlayCanvas Engine uses the Python 2.7 and the Closure Compiler to build which requires Java.

    cd build
    python build.py

## Documentation

Full documentation available on the [PlayCanvas Developer](http://developer.playcanvas.com) site including [API reference](http://developer.playcanvas.com/engine/api/stable)

## How to get models?

To convert any models created using a 3D modelling package see [this page](http://developer.playcanvas.com/engine/) in the developer documentation.

## Getting Help

[**Answers**](http://answers.playcanvas.com) - Use PlayCanvas Answers to ask specific questions about how to achieve something with the engine

[**Forums**](http://forum.playcanvas.com) - Use the forum to have more general conversions about PlayCanvas and the Engine

## Contributing

What to help us make the best damn 3D engine on the web? Great!

### Github Issues

Please use Github issues to report bugs or request features.

### Reporting bugs

Please follow these steps to report a bug

1. **Search for related issues** - search the existing issues so that you don't create duplicates

2. **Create a testcase** - Please create the smallest isolated testcase that you can that reproduces your bug

3. **Share as much information as possible** - everything little helps, OS, browser version, all that stuff.

## PlayCanvas Platform

The PlayCanvas Engine is an open source game engine which you can use to create games or render 3D in the browser. In addition to the engine we also make the [PlayCanvas development platform](https://playcanvas.com/) which features a level design tool, asset management and a hosting and publishing service.

## License

The PlayCanvas Engine is released under the [MIT](http://opensource.org/licenses/MIT) license. See LICENSE file.
