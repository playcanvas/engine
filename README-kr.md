# PlayCanvas Engine

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

| [사용자 매뉴얼](https://developer.playcanvas.com/user-manual/engine/) | [API 레퍼런스](https://api.playcanvas.com/engine/) | [예제](https://playcanvas.github.io) | [블로그](https://blog.playcanvas.com) | [포럼](https://forum.playcanvas.com) |

PlayCanvas는 WebGL2와 WebGPU 기반의 오픈소스 게임 엔진입니다. 모든 브라우저, 모든 디바이스에서 실행되는 인터랙티브 3D 앱, 게임 및 시각화를 만들 수 있습니다.

[English](https://github.com/playcanvas/engine/blob/dev/README.md)
[中文](https://github.com/playcanvas/engine/blob/dev/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/dev/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/dev/README-kr.md)

## 설치

```sh
npm install playcanvas
```

또는 [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas)로 몇 초 만에 프로젝트를 생성할 수 있습니다:

```sh
npm create playcanvas@latest
```

## 사용방법

여기에 아주 간단한 Hello World의 예가 있습니다 - 회전하는 큐브!

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

// fill the available space at full resolution
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// ensure canvas is resized when window changes size
window.addEventListener('resize', () => app.resizeCanvas());

// create box entity
const box = new Entity('cube');
box.addComponent('render', {
  type: 'box'
});
app.root.addChild(box);

// create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
  clearColor: new Color(0.1, 0.2, 0.3)
});
app.root.addChild(camera);
camera.setPosition(0, 0, 3);

// create directional light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// rotate the box according to the delta time since the last frame
app.on('update', dt => box.rotate(10 * dt, 20 * dt, 30 * dt));

app.start();
```

이 코드를 직접 시도하려면 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj)를 클릭하세요.

PlayCanvas 엔진을 기반으로 하는 로컬 개발 환경 설정에 대한 전체 가이드는 [여기](https://developer.playcanvas.com/user-manual/engine/standalone/)에서 찾을 수 있습니다.

## 특징

PlayCanvas는 완전한 기능의 게임 엔진입니다.

* 🧊 **그래픽** - WebGL2와 WebGPU로 구축된 고도의 2D+3D 그래픽 엔진
* 💠 **가우시안 스플래팅** - [3D 가우시안 스플랫](https://developer.playcanvas.com/user-manual/graphics/gaussian-splatting/) 로딩 및 렌더링 기본 지원
* 🥽 **XR** - [WebXR](https://developer.playcanvas.com/user-manual/xr/)을 통한 몰입형 AR 및 VR 경험 기본 지원
* ⚛️ **물리** - 3D 리지드 바디 물리 엔진 [ammo.js](https://github.com/kripken/ammo.js)
* 🏃 **애니메이션** - 캐릭터나 장면에 대한 강력한 스테이트 기반 애니메이션
* 🎮 **입력** - 마우스, 키보드, 터치, 게임패드 API
* 🔊 **사운드** - Web Audio API를 이용한 3D 위치정보 사운드
* 📦 **에셋** - [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/), [Basis](https://github.com/BinomialLLC/basis_universal) 압축 기술을 이용한 비동기형 스트리밍 시스템
* 📜 **스크립트** - TypeScript와 JavaScript 지원

## 에코시스템

원하는 방식으로 PlayCanvas를 사용하여 개발하세요:

| 패키지 | 설명 |
| ------ | ---- |
| [`playcanvas`](https://www.npmjs.com/package/playcanvas) | 코어 엔진 (현재 페이지) |
| [`@playcanvas/react`](https://www.npmjs.com/package/@playcanvas/react) | PlayCanvas용 React 렌더러 |
| [`@playcanvas/web-components`](https://www.npmjs.com/package/@playcanvas/web-components) | 커스텀 엘리먼트를 통한 선언적 3D |
| [`create-playcanvas`](https://www.npmjs.com/package/create-playcanvas) | 프로젝트 스캐폴딩 CLI |
| [PlayCanvas 에디터](https://github.com/playcanvas/editor) | 브라우저 기반 비주얼 에디터 |

## 프로젝트 쇼케이스

PlayCanvas 엔진을 사용하여 [많은 게임과 앱](https://github.com/playcanvas/awesome-playcanvas)이 공개되어 있습니다. 다음은 그 일부를 소개하겠습니다.

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![dev Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

다른 게임은 [PlayCanvas 웹사이트](https://playcanvas.com/explore)에서 볼 수 있습니다.

## 이용 실적

PlayCanvas는 비디오 게임, 광고, 시각화 분야에서 대기업에 채용되고 있습니다.  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 빌드 순서

[Node.js 18+](https://nodejs.org)가 설치되어 있는지 확인합니다. 그 다음 필요한 Node.js 종속성을 모두 설치합니다.

```sh
npm install
```

이제 다양한 빌드 옵션을 실행할 수 있습니다.

| 명령어 | 설명 | 출력 위치 |
| ----- | ---- | ------- |
| `npm run build` | 모든 엔진 빌드 대상과 타입 선언을 빌드합니다 | `build` |
| `npm run docs` | 엔진 [API 참조 문서](https://api.playcanvas.com/engine/)를 빌드합니다 | `docs` |
