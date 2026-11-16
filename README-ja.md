# PlayCanvas Engine<a href="https://github.com/playcanvas/engine/blob/main/README-kr.md"><img align="right" src=".github/readme/lang-kr.svg" alt="한글"></a><a href="https://github.com/playcanvas/engine/blob/main/README-zh.md"><img align="right" src=".github/readme/lang-zh.svg" alt="中文"></a><a href="https://github.com/playcanvas/engine/blob/main/README.md"><img align="right" src=".github/readme/lang-en.svg" alt="English"></a>
<!-- The language labels are images so that they can float beside the title. They float right, so they are listed in reverse display order. -->

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

[ユーザーマニュアル](https://developer.playcanvas.com/user-manual/engine/) · [APIリファレンス](https://api.playcanvas.com/engine/) · [例](https://playcanvas.com/examples/) · [ブログ](https://blog.playcanvas.com) · [フォーラム](https://forum.playcanvas.com)

PlayCanvasは、WebGPUとWebGL2上に構築されたオープンソースのウェブグラフィックスエンジンです。あらゆるブラウザ、あらゆるデバイスで動作するインタラクティブな2D・3Dアプリ、ゲーム、ビジュアライゼーションを作成できます。

## インストール

```sh
npm install playcanvas
```

または、[`create-playcanvas`](https://github.com/playcanvas/create-playcanvas) で数秒でプロジェクトを作成：

```sh
npm create playcanvas@latest
```

各バージョンのリリースノートは[Releases](https://github.com/playcanvas/engine/releases)ページで確認できます。

## 使用方法

シンプルなHello Worldの例です - 回転するキューブ！

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

このコードを自分で試すには[CodePen](https://codepen.io/playcanvas/pen/NPbxMj)をクリックします。

パッケージにはTypeScriptの型宣言が含まれており、インポートマップとCDNビルドを使えばビルドステップなしでも動作します。どちらのセットアップも[Engineをスタンドアロンで使用する](https://developer.playcanvas.com/user-manual/engine/standalone/)で説明しており、アプリが登録できるコンポーネントシステムとリソースハンドラーは[バンドルサイズとツリーシェイキング](https://developer.playcanvas.com/user-manual/engine/bundle-size/)に一覧があります。

## 機能

* 🧊 **グラフィックス** - WebGL2とWebGPUで構築された高度な2D + 3Dグラフィックスエンジン。物理ベースマテリアル、クラスタードライティング、ソフトシャドウ、WebGPUコンピュートシェーダーに対応
* 💠 **ガウシアンスプラッティング** - [3Dガウシアンスプラット](https://developer.playcanvas.com/user-manual/gaussian-splatting/)のロード、ストリーミング、レンダリングをネイティブサポート
* 🎨 **ポストプロセス** - ブルーム、SSAO、TAA、被写界深度、カラーグレーディングを備えたHDRエフェクトパイプライン
* ✨ **パーティクル** - GPUアクセラレーションによるパーティクルシステム
* 🔘 **ユーザーインターフェース** - 2Dおよび3D UIのためのテキスト、画像、ボタン、レイアウト、スクロールビュー
* 🥽 **XR** - [WebXR](https://developer.playcanvas.com/user-manual/xr/)による没入型ARおよびVR体験のビルトインサポート
* ⚛️ **物理** - 3Dリジッドボディ物理エンジン [ammo.js](https://github.com/kripken/ammo.js)
* 🏃 **アニメーション** - キャラクターやシーンに対する強力なステートベースのアニメーション
* 🎮 **インプット** - マウス、キーボード、タッチ、ゲームパッドのAPI
* 🔊 **サウンド** - Web Audio APIを利用した3D位置情報サウンド
* 📦 **アセット** - [glTF 2.0](https://www.khronos.org/gltf/)、[Draco](https://google.github.io/draco/)、[Meshopt](https://meshoptimizer.org/)、[Basis](https://github.com/BinomialLLC/basis_universal) の圧縮技術を利用した非同期型ストリーミングシステム
* 📜 **スクリプト** - TypeScriptとJavaScriptをサポート

## AIを使った開発

コーディングエージェントは、[Engineガイドのインデックス](https://developer.playcanvas.com/user-manual/engine/llms.txt)と[Engine APIのインデックス](https://api.playcanvas.com/engine/llms.txt)から始めてください。どちらも各ページのMarkdown版にリンクしています。プロジェクトでエージェントを設定する方法は、[Developing with AI](https://developer.playcanvas.com/user-manual/engine/developing-with-ai/)で説明しています。また、[PlayCanvas Skills](https://github.com/playcanvas/skills)は、対応するエージェントにタスク別のワークフローを追加します。

## エコシステム

お好みの方法でPlayCanvasを使って開発：

| パッケージ | 説明 |
| --------- | ---- |
| [`playcanvas`](https://www.npmjs.com/package/playcanvas) | コアエンジン（このページ） |
| [`@playcanvas/react`](https://www.npmjs.com/package/@playcanvas/react) | PlayCanvas用Reactレンダラー |
| [`@playcanvas/web-components`](https://www.npmjs.com/package/@playcanvas/web-components) | カスタム要素による宣言的3D |
| [`create-playcanvas`](https://www.npmjs.com/package/create-playcanvas) | プロジェクトスキャフォールディングCLI |
| [PlayCanvasエディター](https://github.com/playcanvas/editor) | ブラウザベースのビジュアルエディター |

## ショーケース

PlayCanvasエンジンを使って[多くのゲームやアプリ](https://github.com/playcanvas/awesome-playcanvas)が公開されています。ここではその一部をご紹介します。

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![BMW i8](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Interior Visualization](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

他のゲームは[PlayCanvasのウェブサイト](https://playcanvas.com/explore)で見ることができます。

## 利用実績

PlayCanvasは、ビデオゲーム、広告、ビジュアライゼーションの分野で大手企業に採用されています。  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## コントリビューション

誤字の修正から新機能の追加まで、コントリビューションを歓迎します。変更のセットアップ、テスト、提出の方法は[CONTRIBUTING.md](https://github.com/playcanvas/engine/blob/main/.github/CONTRIBUTING.md)で説明しています。大きな変更の場合は、まずissueを作成して方針を相談してください。

## ビルドの手順

[Node.js 18+](https://nodejs.org)がインストールされていることを確認します。次に、必要なNode.jsの依存関係をすべてインストールします。

```sh
npm install
```

これで、様々なオプションでビルドを実行できるようになりました。

| コマンド | 説明 | 出力先 |
| ------- | ---- | ----- |
| `npm run build` | すべてのエンジンビルドターゲットと型宣言をビルドする | `build` |
| `npm run docs` | エンジンの[APIリファレンスドキュメント](https://api.playcanvas.com/engine/)をビルドする | `docs` |

ユニットテストは `npm test`、リンターは `npm run lint` で実行します。Examplesブラウザをローカルで実行する方法は、[examplesのREADME](https://github.com/playcanvas/engine/blob/main/examples/README.md)をご覧ください。

## ライセンス

PlayCanvas Engineは[MIT](https://github.com/playcanvas/engine/blob/main/LICENSE)ライセンスのもとで公開されています。
