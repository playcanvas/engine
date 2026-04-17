# PlayCanvas Engine

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

| [用户手册](https://developer.playcanvas.com/user-manual/engine/) | [API 参考](https://api.playcanvas.com/engine/) | [例子](https://playcanvas.github.io) | [博客](https://blog.playcanvas.com) | [论坛](https://forum.playcanvas.com) |

PlayCanvas 是一款基于 WebGL2 和 WebGPU 构建的开源游戏引擎。使用它可以创建在任何浏览器和任何设备上运行的交互式 3D 应用、游戏和可视化内容。

[English](https://github.com/playcanvas/engine/blob/dev/README.md)
[中文](https://github.com/playcanvas/engine/blob/dev/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/dev/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/dev/README-kr.md)

## 安装

```sh
npm install playcanvas
```

或者使用 [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas) 快速创建一个完整项目：

```sh
npm create playcanvas@latest
```

## 如何使用

以下为一个简单的使用案例 - 实现一个旋转的立方体！

```js
import {
  Application,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO
} from 'playcanvas';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const app = new Application(canvas);

// 在全屏模式下填满可用空间
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// 确保在窗口尺寸变化同时画布也同时改变其大小
window.addEventListener('resize', () => app.resizeCanvas());

// 创建一个立方体
const box = new Entity('cube');
box.addComponent('render', {
  type: 'box'
});
app.root.addChild(box);

// 创建一个摄像头
const camera = new Entity('camera');
camera.addComponent('camera', {
  clearColor: new Color(0.1, 0.2, 0.3)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// 创建一个指向灯
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// 根据立方体的时间增量旋转立方体
app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));

app.start();
```

想要自己动手试试？点击 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

基于 PlayCanvas 引擎设置本地开发环境的完整指南可以在[这里](https://developer.playcanvas.com/user-manual/engine/standalone/)找到。

## 特点

PlayCanvas 是一款优秀的全功能游戏引擎。

- 🧊 **图形** - 基于 WebGL2 和 WebGPU 的超前 2D + 3D 图形引擎
- 💠 **高斯泼溅** - 原生支持加载和渲染 [3D 高斯泼溅](https://developer.playcanvas.com/user-manual/graphics/gaussian-splatting/)
- 🥽 **XR** - 通过 [WebXR](https://developer.playcanvas.com/user-manual/xr/) 内置支持沉浸式 AR 和 VR 体验
- ⚛️ **物理** - 一体化的 3D 刚体物理引擎 [ammo.js](https://github.com/kripken/ammo.js)
- 🏃 **动画** - 基于状态的强大动画功能，有效展现动画角色和随机场景属性
- 🎮 **输入** - 支持鼠标、键盘、触控和游戏控制器 API
- 🔊 **声音** - 基于 Web Audio API 的 3D 音效
- 📦 **资源** - 使用 [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/) 以及 [Basis](https://github.com/BinomialLLC/basis_universal) 的异步流媒体系统
- 📜 **代码** - 支持 TypeScript 以及 JavaScript

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

许多团队已经成功地使用了 PlayCanvas 引擎开发并发布了游戏和应用。以下是一些项目案例：

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

点击此链接查看更多案例： [PlayCanvas website](https://playcanvas.com/explore).

## 我们的客户

许多行业龙头公司在不同领域（广告，电子游戏以及产品可视化等）均使用了 PlayCanvas：  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

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
