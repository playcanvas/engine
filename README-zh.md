<div align="center">

<img width="200" src="https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/platform/images/logo/playcanvas-logo-medium.png"/>

# PlayCanvas WebGL 游戏引擎

[API 参考](https://api.playcanvas.com/modules/Engine.html) | [用户手册](https://developer.playcanvas.com) | [例子](https://playcanvas.github.io) | [论坛](https://forum.playcanvas.com) | [博客](https://blog.playcanvas.com)

PlayCanvas 是一款使用 HTML5 和 WebGL 技术运行游戏以及其他 3D 内容的开源游戏引擎，PlayCanvas 以其独特的性能实现了在任何手机移动端和桌面浏览器端均可以流畅运行。

[![NPM version][npm-badge]][npm-url]
[![Minzipped size][minzip-badge]][minzip-url]
[![Average time to resolve an issue][resolution-badge]][isitmaintained-url]
[![Percentage of issues still open][open-issues-badge]][isitmaintained-url]
[![Twitter][twitter-badge]][twitter-url]

[English](https://github.com/playcanvas/engine/blob/dev/README.md)
[中文](https://github.com/playcanvas/engine/blob/dev/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/dev/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/dev/README-kr.md)

## 项目展示

许多团队已经成功地使用了 PlayCanvas 引擎开发并发布了游戏和应用。以下是一些项目案例：

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Flappy Bird](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/8/375389/23PRTL-image-25.jpg)](https://playcanv.as/p/2OlkUaxF/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

点击此链接查看更多案例： [PlayCanvas website](https://playcanvas.com/explore).

</div>

## 我们的客户

许多行业龙头公司在不同领域（广告，电子游戏以及产品可视化等）均适用了 PlayCanvas：

**Animech, Arm, Disney, Facebook, IGT, King, Miniclip, Leapfrog, Mozilla, Nickelodeon, Nordeus, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 特点

PlayCanvas 是一款优秀的全功能游戏引擎。

- 🧊 **图形** - 基于 WebGL2 的超前 2D + 3D 图形引擎
- 🏃 **动画** - 基于状态的强大动画功能，有效展现动画角色和随机场景属性
- ⚛️ **物理** - 一体化的 3D 刚体物理引擎 [ammo.js](https://github.com/kripken/ammo.js)
- 🎮 **输入** - 支持鼠标，键盘，触控，游戏控制器以及众多 VR 控制器 API
- 🔊 **声音** - 基于 Web Audio API 的 3D 音效
- 📦 **资源** - 使用 [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/) 以及 [Basis](https://github.com/BinomialLLC/basis_universal) 的异步流媒体系统
- 📜 **代码** - 支持 Typescript 以及 JavaScript

## 如何使用

以下为一个简单的使用案例 - 实现一个旋转的立方体！

```js
import * as pc from 'playcanvas';

// 创建一个PlayCanvas应用
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const app = new pc.Application(canvas);

// 在全屏模式下填满可用空间
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// 确保在窗口尺寸变化同时画布也同时改变其大小
window.addEventListener('resize', () => app.resizeCanvas());

// 创建一个立方体
const box = new pc.Entity('cube');
box.addComponent('model', {
  type: 'box'
});
app.root.addChild(box);

// 创建一个摄像头
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.1, 0.2, 0.3)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// 创建一个指向灯
const light = new pc.Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// 根据立方体的时间增量旋转立方体
app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));

app.start();
```

想要自己动手试试？点击 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

基于 PlayCanvas 引擎设置本地开发环境的完整指南可以在[这里](https://developer.playcanvas.com/user-manual/engine/standalone/)找到。

## 如何搭建项目

确保已安装 [Node.js 18+](https://nodejs.org) ，并安装 Node.js 相关依赖组件。

```sh
npm install
```

现在您就可以运行不同的搭建选项了：

| 命令            | 描述                         | 输出到     |
| --------------- | --------------------------- | ---------- |
| `npm run build` | 构建所有引擎构建目标和类型声明 | `build`    |
| `npm run docs`  | 构建引擎[API参考文档][docs]   | `docs`     |

## PlayCanvas 平台

PlayCanvas 引擎是一款可以基于浏览器的用于制作游戏以及 3D 可视化的开源引擎。除此之外，我们还开发了[PlayCanvas 开发平台](https://playcanvas.com/)， 为我们的用户提供了可视化编辑器，资源管理，代码编辑，代码托管以及发布等服务。

[![Editor](https://github.com/playcanvas/editor/blob/main/images/editor.png?raw=true)](https://github.com/playcanvas/editor)

## License

The PlayCanvas Engine is released under the [MIT](https://opensource.org/licenses/MIT) license. See LICENSE file.

[npm-badge]: https://img.shields.io/npm/v/playcanvas
[npm-url]: https://www.npmjs.com/package/playcanvas
[minzip-badge]: https://img.shields.io/bundlephobia/minzip/playcanvas
[minzip-url]: https://bundlephobia.com/result?p=playcanvas
[resolution-badge]: https://isitmaintained.com/badge/resolution/playcanvas/engine.svg
[open-issues-badge]: https://isitmaintained.com/badge/open/playcanvas/engine.svg
[isitmaintained-url]: https://isitmaintained.com/project/playcanvas/engine
[twitter-badge]: https://img.shields.io/twitter/follow/playcanvas.svg?style=social&label=Follow
[twitter-url]: https://twitter.com/intent/follow?screen_name=playcanvas
[docs]: https://api.playcanvas.com/modules/Engine.html
