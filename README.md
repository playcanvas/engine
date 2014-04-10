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

## Examples 

Take a look at in the [examples directory](examples)

## How to build

The PlayCanvas Engine uses the python and the Closure Compiler to build which requires Java.

    cd build
    python build.py

## Documentation

Full documentation available on the [PlayCanvas Developer](http://developer.playcanvas.com) site including [API reference](http://developer.playcanvas.com/engine/api/stable)

## Getting Help

[**Answers**](http://answers.playcanvas.com) - Use PlayCanvas Answers to ask specific questions about how to achieve something with the engine

[**Forums**](http://forum.playcanvas.com) - Use the forum to have more general conversions about PlayCanvas and the Engine

## Contributing

What to help us make the best damn 3D engine on the web? Great, just a few house rules first.

### Github Issues

Please use Github issues to report bugs or request features.

### Reporting bugs

Please follow these steps to report a bug

1. **Search for related issues** - search the existing issues so that you don't create duplicates

2. **Create a testcase** - Please create the smallest isolated testcase that you can that reproduces your bug

3. **Share as much information as possible** - everything little helps, OS, browser version, all that stuff.

### Making Changes

1. [**Sign the CLA**](https://docs.google.com/a/playcanvas.com/forms/d/1Ih69zQfJG-QDLIEpHr6CsaAs6fPORNOVnMv5nuo0cjk/viewform). Sadly, we can only look at pull requests if you have signed our Contributor License Agreement. This is to protect us and you and ensure that the PlayCanvas Engine remains open-source and trouble-free. 

2. **Use 'default' branch** - Pull requests should go to the 'default' branch. 'stable' branch is for release builds only.

3. **Stay focused** - Pull requests should only fix one issue.

## PlayCanvas Platform

The PlayCanvas Engine is an open-source game engine which you can use to create games or render 3D in the browser. In addition to the free and open-source engine we also make the [PlayCanvas development platform](https://playcanvas.com/) which features a level design tool, asset management and a hosting and publishing service. 

## License

The PlayCanvas Engine is released under the [XX](). See LICENSE file.