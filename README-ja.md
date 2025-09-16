# PlayCanvas Engine

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![Minzipped size](https://img.shields.io/bundlephobia/minzip/playcanvas)](https://bundlephobia.com/result?p=playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

| [ユーザーマニュアル](https://developer.playcanvas.com/user-manual/engine/) | [APIリファレンス](https://api.playcanvas.com/engine/) | [例](https://playcanvas.github.io) | [ブログ](https://blog.playcanvas.com) | [フォーラム](https://forum.playcanvas.com) |

PlayCanvasは、オープンソースのゲームエンジンです。

HTML5とWebGLを使用してゲームやインタラクティブな3Dコンテンツをモバイルやデスクトップのブラウザで実行できます。

[English](https://github.com/playcanvas/engine/blob/dev/README.md)
[中文](https://github.com/playcanvas/engine/blob/dev/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/dev/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/dev/README-kr.md)

## ショーケース

PlayCanvasエンジンを使って[多くのゲームやアプリ](https://github.com/playcanvas/awesome-playcanvas) 公開されています。ここではその一部をご紹介します。

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

他のゲームは[PlayCanvasのウェブサイト](https://playcanvas.com/explore)で見ることができます。

## 利用実績

PlayCanvasは、ビデオゲーム、広告、ビジュアライゼーションの分野で大手企業に採用されています。
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 機能

PlayCanvasはフル機能のゲームエンジンです。

* 🧊 **グラフィックス** -  WebGL 1.0 & 2.0で構築された高度な2D + 3Dグラフィックスエンジン
* 🏃 **アニメーション** - キャラクターやシーンに対する強力なステートベースのアニメーション
* ⚛️ **物理** - 3Dリジッドボディ物理エンジン [ammo.js](https://github.com/kripken/ammo.js)
* 🎮 **インプット** - マウス、キーボード、タッチ、ゲームパッド、VRコントローラのAPI
* 🔊 **サウンド** - Web Audio APIを利用した3D位置情報サウンド
* 📦 **アセット** - [glTF 2.0](https://www.khronos.org/gltf/)、[Draco](https://google.github.io/draco/)、[Basis](https://github.com/BinomialLLC/basis_universal) の圧縮技術を利用した非同期型ストリーミングシステム
* 📜 **スクリプト** - TypeScriptとJavaScriptをサポート

## 使用方法

シンプルなHello Worldの例です。

```js
import * as pc from 'playcanvas';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

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
  clearColor: new pc.Color(0.1, 0.2, 0.3)
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
```

このコードを自分で試すには[CodePen](https://codepen.io/playcanvas/pen/NPbxMj)をクリックします。

PlayCanvas Engine をベースにしたローカル開発環境の設定に関する完全ガイドは[こちら](https://developer.playcanvas.com/user-manual/engine/standalone/)で見つけることができます。

## ビルドの手順

[Node.js 18+](https://nodejs.org)がインストールされていることを確認します。次に、必要なNode.jsの依存関係をすべてインストールします。

```sh
npm install
```

これで、様々なオプションでビルドを実行できるようになりました。

| コマンド         | 説明                                                  | 出力先     |
| --------------- | ----------------------------------------------------- | ---------- |
| `npm run build` | すべてのエンジンビルドターゲットと型宣言をビルドする       | `build`    |
| `npm run docs`  | エンジンの[APIリファレンスドキュメント](https://api.playcanvas.com/engine/)をビルドする | `docs`     |

## PlayCanvasエディター

PlayCanvas エンジンは、HTML5 アプリやゲームを作成するためのオープンソースのエンジンです。エンジンに加えて、[PlayCanvasエディター](https://playcanvas.com/)があります。

[![Editor](https://github.com/playcanvas/editor/blob/main/images/editor.png?raw=true)](https://github.com/playcanvas/editor)

エディター関連のバグや問題については、[Editor's repo](https://github.com/playcanvas/editor)を参照してください。
