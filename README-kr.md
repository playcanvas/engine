# PlayCanvas Engine<a href="https://github.com/playcanvas/engine/blob/main/README-ja.md"><img align="right" src=".github/readme/lang-ja.svg" alt="日本語"></a><a href="https://github.com/playcanvas/engine/blob/main/README-zh.md"><img align="right" src=".github/readme/lang-zh.svg" alt="中文"></a><a href="https://github.com/playcanvas/engine/blob/main/README.md"><img align="right" src=".github/readme/lang-en.svg" alt="English"></a>
<!-- The language labels are images so that they can float beside the title. They float right, so they are listed in reverse display order. -->

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

[사용자 매뉴얼](https://developer.playcanvas.com/user-manual/engine/) · [API 레퍼런스](https://api.playcanvas.com/engine/) · [예제](https://playcanvas.com/examples/) · [블로그](https://blog.playcanvas.com) · [포럼](https://forum.playcanvas.com)

PlayCanvas는 WebGPU와 WebGL2 기반의 오픈소스 웹 그래픽 엔진입니다. 모든 브라우저, 모든 디바이스에서 실행되는 인터랙티브 2D·3D 앱, 게임 및 시각화를 만들 수 있습니다.

## 설치

```sh
npm install playcanvas
```

또는 [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas)로 몇 초 만에 프로젝트를 생성할 수 있습니다:

```sh
npm create playcanvas@latest
```

모든 버전의 릴리스 노트는 [Releases](https://github.com/playcanvas/engine/releases) 페이지에서 확인할 수 있습니다.

## 사용방법

여기에 아주 간단한 Hello World의 예가 있습니다 - 회전하는 큐브!

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

이 코드를 직접 시도하려면 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj)를 클릭하세요.

패키지에는 TypeScript 타입 선언이 포함되어 있으며, 임포트 맵과 CDN 빌드를 사용하면 빌드 단계 없이도 실행할 수 있습니다. 두 가지 설정 방법은 [엔진 단독으로 사용하기](https://developer.playcanvas.com/user-manual/engine/standalone/)에서 설명하며, 앱이 등록할 수 있는 컴포넌트 시스템과 리소스 핸들러는 [번들 크기와 트리 셰이킹](https://developer.playcanvas.com/user-manual/engine/bundle-size/)에 정리되어 있습니다.

## 특징

* 🧊 **그래픽** - WebGL2와 WebGPU로 구축된 고도의 2D+3D 그래픽 엔진. 물리 기반 머티리얼, 클러스터드 라이팅, 소프트 섀도, WebGPU 컴퓨트 셰이더 지원
* 💠 **가우시안 스플래팅** - [3D 가우시안 스플랫](https://developer.playcanvas.com/user-manual/gaussian-splatting/) 로딩, 스트리밍 및 렌더링 기본 지원
* 🎨 **포스트 프로세싱** - 블룸, SSAO, TAA, 피사계 심도, 컬러 그레이딩을 갖춘 HDR 이펙트 파이프라인
* ✨ **파티클** - GPU 가속 파티클 시스템
* 🔘 **사용자 인터페이스** - 2D 및 3D UI를 위한 텍스트, 이미지, 버튼, 레이아웃, 스크롤 뷰
* 🥽 **XR** - [WebXR](https://developer.playcanvas.com/user-manual/xr/)을 통한 몰입형 AR 및 VR 경험 기본 지원
* ⚛️ **물리** - 3D 리지드 바디 물리 엔진 [ammo.js](https://github.com/kripken/ammo.js)
* 🏃 **애니메이션** - 캐릭터나 장면에 대한 강력한 스테이트 기반 애니메이션
* 🎮 **입력** - 마우스, 키보드, 터치, 게임패드 API
* 🔊 **사운드** - Web Audio API를 이용한 3D 위치정보 사운드
* 📦 **에셋** - [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/), [Meshopt](https://meshoptimizer.org/), [Basis](https://github.com/BinomialLLC/basis_universal) 압축 기술을 이용한 비동기형 스트리밍 시스템
* 📜 **스크립트** - TypeScript와 JavaScript 지원

## AI를 활용한 개발

코딩 에이전트는 [엔진 가이드 인덱스](https://developer.playcanvas.com/user-manual/engine/llms.txt)와 [엔진 API 인덱스](https://api.playcanvas.com/engine/llms.txt)에서 시작하세요. 두 인덱스 모두 각 페이지의 Markdown 버전으로 연결됩니다. 프로젝트에서 에이전트를 설정하는 방법은 [Developing with AI](https://developer.playcanvas.com/user-manual/engine/developing-with-ai/)에서 설명합니다. 또한 [PlayCanvas Skills](https://github.com/playcanvas/skills)는 호환되는 에이전트에 작업별 워크플로를 추가합니다.

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
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![Master Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![BMW i8](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Interior Visualization](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)

다른 게임은 [PlayCanvas 웹사이트](https://playcanvas.com/explore)에서 볼 수 있습니다.

## 이용 실적

PlayCanvas는 비디오 게임, 광고, 시각화 분야에서 대기업에 채용되고 있습니다.  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 기여하기

오타 수정부터 새로운 기능 추가까지, 모든 기여를 환영합니다. 변경 사항을 설정하고 테스트하고 제출하는 방법은 [CONTRIBUTING.md](https://github.com/playcanvas/engine/blob/main/.github/CONTRIBUTING.md)에 설명되어 있습니다. 규모가 큰 변경은 먼저 이슈를 열어 접근 방식을 논의해 주세요.

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

단위 테스트는 `npm test`, 린터는 `npm run lint`로 실행합니다. 예제 브라우저를 로컬에서 실행하려면 [examples README](https://github.com/playcanvas/engine/blob/main/examples/README.md)를 참조하세요.

## 라이선스

PlayCanvas 엔진은 [MIT](https://github.com/playcanvas/engine/blob/main/LICENSE) 라이선스로 배포됩니다.
