# PlayCanvas Engine<a href="https://github.com/playcanvas/engine/blob/main/README-kr.md"><img align="right" src=".github/readme/lang-kr.svg" alt="한글"></a><a href="https://github.com/playcanvas/engine/blob/main/README-ja.md"><img align="right" src=".github/readme/lang-ja.svg" alt="日本語"></a><a href="https://github.com/playcanvas/engine/blob/main/README.md"><img align="right" src=".github/readme/lang-en.svg" alt="English"></a>
<!-- The language labels are images so that they can float beside the title. They float right, so they are listed in reverse display order. -->

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

[用户手册](https://developer.playcanvas.com/user-manual/engine/) · [API 参考](https://api.playcanvas.com/engine/) · [例子](https://playcanvas.com/examples/) · [博客](https://blog.playcanvas.com) · [论坛](https://forum.playcanvas.com)

PlayCanvas 是一款基于 WebGPU 和 WebGL2 构建的开源 Web 图形引擎。使用它可以创建在任何浏览器和任何设备上运行的交互式 2D 和 3D 应用、游戏和可视化内容。

## 安装

```sh
npm install playcanvas
```

或者使用 [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas) 快速创建一个完整项目：

```sh
npm create playcanvas@latest
```

每个版本的发行说明都可以在 [Releases](https://github.com/playcanvas/engine/releases) 页面查看。

## 如何使用

以下为一个简单的使用案例 - 实现一个旋转的立方体！

```js
import * as pc from 'playcanvas';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// 创建图形设备，优先使用 WebGPU，不可用时回退到 WebGL2
const device = await pc.createGraphicsDevice(canvas, {
  deviceTypes: [pc.DEVICETYPE_WEBGPU]
});

// 创建应用，只注册它用到的组件系统
const options = new pc.AppOptions();
options.graphicsDevice = device;
options.componentSystems = [
  pc.RenderComponentSystem,
  pc.CameraComponentSystem,
  pc.LightComponentSystem
];
const app = new pc.AppBase(canvas);
app.init(options);

// 填满窗口，并让画布随窗口尺寸变化
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

// 创建一个立方体、一个摄像头和一个灯光
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

// 旋转立方体并启动应用
app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));
app.start();
```

想要自己动手试试？点击 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

该软件包自带 TypeScript 类型声明，也可以借助 import map 和 CDN 构建版本在无需构建步骤的情况下运行。[独立使用引擎](https://developer.playcanvas.com/user-manual/engine/standalone/)介绍了这两种配置方式，[包体积与 Tree Shaking](https://developer.playcanvas.com/user-manual/engine/bundle-size/) 列出了应用可以注册的组件系统和资源处理器。

## 特点

- 🧊 **图形** - 基于 WebGL2 和 WebGPU 的超前 2D + 3D 图形引擎，支持基于物理的材质、分簇光照、软阴影和 WebGPU 计算着色器
- 💠 **高斯泼溅** - 原生支持加载、流式传输和渲染 [3D 高斯泼溅](https://developer.playcanvas.com/user-manual/gaussian-splatting/)
- 🎨 **后期处理** - HDR 特效管线，包含泛光、SSAO、TAA、景深和颜色分级
- ✨ **粒子** - GPU 加速的粒子系统
- 🔘 **用户界面** - 用于 2D 和 3D 界面的文本、图像、按钮、布局和滚动视图
- 🥽 **XR** - 通过 [WebXR](https://developer.playcanvas.com/user-manual/xr/) 内置支持沉浸式 AR 和 VR 体验
- ⚛️ **物理** - 一体化的 3D 刚体物理引擎 [ammo.js](https://github.com/kripken/ammo.js)
- 🏃 **动画** - 基于状态的强大动画功能，有效展现动画角色和随机场景属性
- 🎮 **输入** - 支持鼠标、键盘、触控和游戏控制器 API
- 🔊 **声音** - 基于 Web Audio API 的 3D 音效
- 📦 **资源** - 使用 [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/), [Meshopt](https://meshoptimizer.org/) 以及 [Basis](https://github.com/BinomialLLC/basis_universal) 的异步流媒体系统
- 📜 **代码** - 支持 TypeScript 以及 JavaScript

## 使用 AI 进行开发

编码智能体请从[引擎指南索引](https://developer.playcanvas.com/user-manual/engine/llms.txt)和[引擎 API 索引](https://api.playcanvas.com/engine/llms.txt)开始，两者都链接到每个页面的 Markdown 版本。[Developing with AI](https://developer.playcanvas.com/user-manual/engine/developing-with-ai/) 介绍了如何在项目中配置智能体，[PlayCanvas Skills](https://github.com/playcanvas/skills) 则为兼容的智能体提供针对特定任务的工作流。

## 生态系统

以你喜欢的方式使用 PlayCanvas 进行开发：

| 包 | 描述 |
| --- | ---- |
| [`playcanvas`](https://www.npmjs.com/package/playcanvas) | 核心引擎（当前页面） |
| [`@playcanvas/react`](https://www.npmjs.com/package/@playcanvas/react) | PlayCanvas 的 React 渲染器 |
| [`@playcanvas/web-components`](https://www.npmjs.com/package/@playcanvas/web-components) | 通过自定义元素实现声明式 3D |
| [`create-playcanvas`](https://www.npmjs.com/package/create-playcanvas) | 项目脚手架 CLI |
| [PlayCanvas 编辑器](https://github.com/playcanvas/editor) | 基于浏览器的可视化编辑器 |

## 项目展示

许多团队已经成功地使用了 PlayCanvas 引擎开发并发布了[游戏和应用](https://github.com/playcanvas/awesome-playcanvas)。以下是一些项目案例：

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![BMW i8](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Interior Visualization](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

点击此链接查看更多案例： [PlayCanvas website](https://playcanvas.com/explore).

## 我们的客户

许多行业龙头公司在不同领域（广告，电子游戏以及产品可视化等）均使用了 PlayCanvas：  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 参与贡献

欢迎各种形式的贡献，无论是修正错别字还是添加新功能。[CONTRIBUTING.md](https://github.com/playcanvas/engine/blob/main/.github/CONTRIBUTING.md) 说明了如何搭建环境、测试并提交更改。如果改动较大，请先提交 issue 讨论方案。

## 如何搭建项目

确保已安装 [Node.js 18+](https://nodejs.org) ，并安装 Node.js 相关依赖组件。

```sh
npm install
```

现在您就可以运行不同的搭建选项了：

| 命令 | 描述 | 输出到 |
| ---- | ---- | ----- |
| `npm run build` | 构建所有引擎构建目标和类型声明 | `build` |
| `npm run docs` | 构建引擎[API参考文档](https://api.playcanvas.com/engine/) | `docs` |

使用 `npm test` 运行单元测试，使用 `npm run lint` 运行代码检查。如需在本地运行示例浏览器，请参阅[示例 README](https://github.com/playcanvas/engine/blob/main/examples/README.md)。

## 许可证

PlayCanvas 引擎基于 [MIT](https://github.com/playcanvas/engine/blob/main/LICENSE) 许可证发布。
