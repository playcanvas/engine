<div align="center">

<img width="200" src="https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/platform/images/logo/playcanvas-logo-medium.png"/>

# PlayCanvas WebGL Game Engine

[API Reference](https://api.playcanvas.com/modules/Engine.html) | [User Manual](https://developer.playcanvas.com) | [Examples](https://playcanvas.github.io) | [Forum](https://forum.playcanvas.com) | [Blog](https://blog.playcanvas.com)

PlayCanvas는 오픈소스 게임 엔진입니다.

HTML5와 WebGL을 사용하여 게임과 인터랙티브한 3D 콘텐츠를 모바일이나 데스크톱 브라우저에서 실행할 수 있습니다.

[![NPM version][npm-badge]][npm-url]
[![Minzipped size][minzip-badge]][minzip-url]
[![Average time to resolve an issue][resolution-badge]][isitmaintained-url]
[![Percentage of issues still open][open-issues-badge]][isitmaintained-url]
[![Twitter][twitter-badge]][twitter-url]

[English](https://github.com/playcanvas/engine/blob/master/README.md)
[中文](https://github.com/playcanvas/engine/blob/master/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/master/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/master/README-kr.md)

## Project Showcase

PlayCanvas 엔진을 사용하여 [많은 게임과 앱](https://github.com/playcanvas/awesome-playcanvas#awesome-playcanvas-
)이 공개되어 있습니다. 다음은 그 일부를 소개하겠습니다.

[![Seemore](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14705/319531/O4J4VU-image-25.jpg)](https://playcanv.as/p/MflWvdTW/) [![After The Flood](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/440410/98554E-image-25.jpg)](https://playcanv.as/p/44MRmJRU/) [![Casino](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/14928/349824/U88HJQ-image-25.jpg)](https://playcanv.as/p/LpmXGUe6/)  
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![dev Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Flappy Bird](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/8/375389/23PRTL-image-25.jpg)](https://playcanv.as/p/2OlkUaxF/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/)
  
다른 게임은 [Play Canvas 웹사이트](https://playcanvas.com/explore)에서 볼 수 있습니다.

</div>

## Users

PlayCanvas는 비디오 게임, 광고, 시각화 분야에서 대기업에 채용되고 있습니다.

**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

## 특징

PlayCanvas는 완전한 기능의 게임 엔진입니다.

* 🧊 **그래픽** - WebGL 1.0&2.0으로 구축된 고도의 2D+3D 그래픽 엔진.
* 🏃 **애니메이션** - 캐릭터나 장면에 대한 강력한 스테이트 기반 애니메이션
* ⚛️ **물리** - 3D 리지드 바디 물리 엔진 [ammo.js](https://github.com/kripken/ammo.js)
* 🎮 **입력** - 마우스, 키보드, 터치, 게임패드, VR 컨트롤러의 API
* 🔊 **사운드** - Web Audio API를 이용한 3D 위치정보 사운드
* 📦 **에셋** - [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/), [Basis](https://github.com/BinomialLLC/basis_universal) 압축 기술을 이용한 비동기형 스트리밍 시스템
* 📜 **스크립트** - TypeScript와 자바스크립트 지원

## 사용방법

여기에 아주 간단한 Hello World의 예가 있습니다. - 회전하는 큐브

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PlayCanvas Hello Cube</title>
    <meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no' />
    <style>
        body {
            margin: 0;
            overflow: hidden;
        }
    </style>
    <script src='https://code.playcanvas.com/playcanvas-stable.min.js'></script>
</head>
<body>
    <canvas id='application'></canvas>
    <script>
        // create a PlayCanvas application
        const canvas = document.getElementById('application');
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
            clearColor: new pc.Color(0.1, 0.1, 0.1)
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
    </script>
</body>
</html>
```

이 코드를 직접 시도하려면 [CodePen](https://codepen.io/playcanvas/pen/NPbxMj)를 클릭하세요.

## 빌드 순서

[Node.js](https://nodejs.org)가 설치 되어 있는지 확인합니다. 그 다음 필요한 Node.js 종속성을 모두 설치합니다.

    npm install

이제 다양한 빌드 옵션을 실행할 수 있습니다.

| Command               | Description                               | Outputs                          |
|-----------------------|-------------------------------------------|----------------------------------|
| `npm run build`       | 릴리스용, 디버깅용, 프로파일러용 엔진을 빌드한다 | `build\playcanvas[.min/.dbg/.prf].[mjs/js]` |
| `npm run build:es5`   | es5 전용 릴리스용, 디버깅용, 프로파일러용 엔진을 빌드한다 | `build\playcanvas[.min/.dbg/.prf].js` |
| `npm run build:release` | es5 및 es6 전용 릴리스용 엔진을 빌드한다 | `build\playcanvas.[mjs/js]` |
| `npm run build:types` | TypeScript형 정의 파일을 빌드한다          | `build\playcanvas.d.ts`          |
| `npm run docs`        | [API 레퍼런스] [docs]를 빌드한다   | `docs`                           |


이전 버전의 엔진도 이용할수 있습니다.

최신버전 빌드(master 브랜치의 HEAD 리비전)

* https://code.playcanvas.com/playcanvas-latest.js
* https://code.playcanvas.com/playcanvas-latest.min.js

안정적인 최신 빌드
* https://code.playcanvas.com/playcanvas-stable.js
* https://code.playcanvas.com/playcanvas-stable.min.js

특정 버전의 빌드
* https://code.playcanvas.com/playcanvas-1.38.4.js
* https://code.playcanvas.com/playcanvas-1.38.4.min.js

### Generate Source Maps

엔진의 디버깅이 쉽도록 소스 맵을 구축하려면 임의의 엔진 구축 명령에 `---m`을 추가합니다. 예시는 다음과 같습니다.

    npm run build -- -m

그러면  `build/playcanvas.js.map` 이 출력이 됩니다.

## PlayCanvas 에디터

PlayCanvas 엔진은 HTML5 앱 및 게임을 만들기 위한 오픈 소스 엔진입니다.엔진 외에 [PlayCanvas 에디터](https://playcanvas.com/)가 있습니다.

[![Editor](https://github.com/playcanvas/editor/blob/main/images/editor.png?raw=true)](https://github.com/playcanvas/editor)

에디터 관련 버그나 문제는 [Editor's repo](https://github.com/playcanvas/editor)를 참조하십시오.


[npm-badge]: https://img.shields.io/npm/v/playcanvas
[npm-url]: https://www.npmjs.com/package/playcanvas
[minzip-badge]: https://img.shields.io/bundlephobia/minzip/playcanvas
[minzip-url]: https://bundlephobia.com/result?p=playcanvas
[resolution-badge]: https://isitmaintained.com/badge/resolution/playcanvas/engine.svg
[open-issues-badge]: https://isitmaintained.com/badge/open/playcanvas/engine.svg
[isitmaintained-url]: https://isitmaintained.com/project/playcanvas/engine
[twitter-badge]: https://img.shields.io/twitter/follow/playcanvas.svg?style=social&label=Follow
[twitter-url]: https://twitter.com/intent/follow?screen_name=playcanvas
[docs]: https://developer.playcanvas.com/en/api/
