# PlayCanvas Engine<a href="https://github.com/playcanvas/engine/blob/main/README-kr.md"><img align="right" src=".github/readme/lang-kr.svg" alt="한글"></a><a href="https://github.com/playcanvas/engine/blob/main/README-ja.md"><img align="right" src=".github/readme/lang-ja.svg" alt="日本語"></a><a href="https://github.com/playcanvas/engine/blob/main/README-zh.md"><img align="right" src=".github/readme/lang-zh.svg" alt="中文"></a>
<!-- The language labels are images so that they can float beside the title. They float right, so they are listed in reverse display order. -->

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

[User Manual](https://developer.playcanvas.com/user-manual/engine/) · [API Reference](https://api.playcanvas.com/engine/) · [Examples](https://playcanvas.com/examples/) · [Blog](https://blog.playcanvas.com) · [Forum](https://forum.playcanvas.com)

PlayCanvas is an open-source web graphics engine built on WebGPU and WebGL2. Use it to create interactive 2D and 3D apps, games and visualizations that run in any browser on any device.

## Install

```sh
npm install playcanvas
```

Or scaffold a full project in seconds with [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas):

```sh
npm create playcanvas@latest
```

Release notes for every version are on the [Releases](https://github.com/playcanvas/engine/releases) page.

## Usage

Here's a super-simple Hello World example - a spinning cube!

```js
import * as pc from 'playcanvas';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// create a graphics device, preferring WebGPU and falling back to WebGL2
const device = await pc.createGraphicsDevice(canvas, {
  deviceTypes: [pc.DEVICETYPE_WEBGPU]
});

// create an app with only the component systems it uses
const options = new pc.AppOptions();
options.graphicsDevice = device;
options.componentSystems = [
  pc.RenderComponentSystem,
  pc.CameraComponentSystem,
  pc.LightComponentSystem
];
const app = new pc.AppBase(canvas);
app.init(options);

// fill the window and keep the canvas sized to it
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

// create a box, a camera and a light
const box = new pc.Entity('cube');
box.addComponent('render', { type: 'box' });
app.root.addChild(box);

const camera = new pc.Entity('camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.1, 0.2, 0.3) });
camera.setPosition(0, 0, 3);
app.root.addChild(camera);

const light = new pc.Entity('light');
light.addComponent('light');
light.setEulerAngles(45, 0, 0);
app.root.addChild(light);

// spin the box and start the app
app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));
app.start();
```

Want to play with the code yourself? Edit it on [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

The package includes TypeScript declarations, and it also runs without a build step using an import map and a CDN build. [Using the Engine Standalone](https://developer.playcanvas.com/user-manual/engine/standalone/) walks through both setups, and [Bundle Size and Tree Shaking](https://developer.playcanvas.com/user-manual/engine/bundle-size/) lists the component systems and resource handlers an app can register.

## Features

* 🧊 **Graphics** - Advanced 2D + 3D graphics engine built on WebGL2 & WebGPU, with physically based materials, clustered lighting, soft shadows and WebGPU compute shaders
* 💠 **Gaussian Splatting** - First-class support for loading, streaming and rendering [3D Gaussian Splats](https://developer.playcanvas.com/user-manual/gaussian-splatting/)
* 🎨 **Post-Processing** - HDR effects pipeline with bloom, SSAO, TAA, depth of field and color grading
* ✨ **Particles** - GPU-accelerated particle systems
* 🔘 **User Interface** - Text, images, buttons, layouts and scroll views for 2D and 3D UI
* 🥽 **XR** - Built-in support for immersive AR and VR experiences via [WebXR](https://developer.playcanvas.com/user-manual/xr/)
* ⚛️ **Physics** - Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* 🏃 **Animation** - Powerful state-based animations for characters and arbitrary scene properties
* 🎮 **Input** - Mouse, keyboard, touch and gamepad APIs
* 🔊 **Sound** - 3D positional sounds built on the Web Audio API
* 📦 **Assets** - Asynchronous streaming system built on [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/), [Meshopt](https://meshoptimizer.org/) and [Basis](https://github.com/BinomialLLC/basis_universal) compression
* 📜 **Scripts** - Write game behaviors in TypeScript or JavaScript

## Developing with AI

Coding agents: start from the [Engine guides index](https://developer.playcanvas.com/user-manual/engine/llms.txt) and the [Engine API index](https://api.playcanvas.com/engine/llms.txt), which link a Markdown version of every page. [Developing with AI](https://developer.playcanvas.com/user-manual/engine/developing-with-ai/) explains how to set up an agent on a project, and [PlayCanvas Skills](https://github.com/playcanvas/skills) add task-specific workflows to compatible agents.

## Ecosystem

Build with PlayCanvas your way:

| Package | Description |
| ------- | ----------- |
| [`playcanvas`](https://www.npmjs.com/package/playcanvas) | Core engine (you are here) |
| [`@playcanvas/react`](https://www.npmjs.com/package/@playcanvas/react) | React renderer for PlayCanvas |
| [`@playcanvas/web-components`](https://www.npmjs.com/package/@playcanvas/web-components) | Declarative 3D via Custom Elements |
| [`create-playcanvas`](https://www.npmjs.com/package/create-playcanvas) | Project scaffolding CLI |
| [PlayCanvas Editor](https://github.com/playcanvas/editor) | Browser-based visual editor |

## Project Showcase

[Many games and apps](https://github.com/playcanvas/awesome-playcanvas) have been published using the PlayCanvas engine. Here is a small selection:

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![BMW i8](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Interior Visualization](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

You can see more games on the [PlayCanvas website](https://playcanvas.com/explore).

## Users

PlayCanvas is used by leading companies in video games, advertising and visualization such as:  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## Contributing

Contributions are welcome, from typo fixes to new features. [CONTRIBUTING.md](https://github.com/playcanvas/engine/blob/main/.github/CONTRIBUTING.md) explains how to set up, test and submit a change. For larger changes, please open an issue first to discuss the approach.

## How to build

Ensure you have [Node.js 18+](https://nodejs.org) installed. Then, install all of the required Node.js dependencies:

```sh
npm install
```

Now you can run various build options:

| Command | Description | Outputs To |
| ------- | ----------- | ---------- |
| `npm run build` | Build all engine flavors and type declarations | `build` |
| `npm run docs` | Build engine [API reference docs](https://api.playcanvas.com/engine/) | `docs` |

Run the unit tests with `npm test` and the linter with `npm run lint`. To run the examples browser locally, see the [examples README](https://github.com/playcanvas/engine/blob/main/examples/README.md).

## License

The PlayCanvas Engine is released under the [MIT](https://github.com/playcanvas/engine/blob/main/LICENSE) license.
