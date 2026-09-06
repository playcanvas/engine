# PlayCanvas Engine

[![NPM Version](https://img.shields.io/npm/v/playcanvas)](https://www.npmjs.com/package/playcanvas)
[![NPM Downloads](https://img.shields.io/npm/dw/playcanvas)](https://npmtrends.com/playcanvas)
[![License](https://img.shields.io/npm/l/playcanvas)](https://github.com/playcanvas/engine/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=flat&logo=discord&logoColor=white&color=black)](https://discord.gg/RSaMRzg)
[![Reddit](https://img.shields.io/badge/Reddit-FF4500?style=flat&logo=reddit&logoColor=white&color=black)](https://www.reddit.com/r/PlayCanvas)
[![X](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white&color=black)](https://x.com/intent/follow?screen_name=playcanvas)

| [User Manual](https://developer.playcanvas.com/user-manual/engine/) | [API Reference](https://api.playcanvas.com/engine/) | [Examples](https://playcanvas.com/examples/) | [Blog](https://blog.playcanvas.com) | [Forum](https://forum.playcanvas.com) |

PlayCanvas is an open-source game engine built on WebGL2 and WebGPU. Use it to create interactive 3D apps, games and visualizations that run in any browser on any device.

[English](https://github.com/playcanvas/engine/blob/main/README.md)
[中文](https://github.com/playcanvas/engine/blob/main/README-zh.md)
[日本語](https://github.com/playcanvas/engine/blob/main/README-ja.md)
[한글](https://github.com/playcanvas/engine/blob/main/README-kr.md)

## Install

```sh
npm install playcanvas
```

Or scaffold a full project in seconds with [`create-playcanvas`](https://github.com/playcanvas/create-playcanvas):

```sh
npm create playcanvas@latest
```

## Usage

Here's a super-simple Hello World example - a spinning cube!

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

Want to play with the code yourself? Edit it on [CodePen](https://codepen.io/playcanvas/pen/NPbxMj).

A full guide to setting up a local development environment based on the PlayCanvas Engine can be found [here](https://developer.playcanvas.com/user-manual/engine/standalone/).

## Features

PlayCanvas is a fully-featured game engine.

* 🧊 **Graphics** - Advanced 2D + 3D graphics engine built on WebGL2 & WebGPU
* 💠 **Gaussian Splatting** - First-class support for loading and rendering [3D Gaussian Splats](https://developer.playcanvas.com/user-manual/graphics/gaussian-splatting/)
* 🥽 **XR** - Built-in support for immersive AR and VR experiences via [WebXR](https://developer.playcanvas.com/user-manual/xr/)
* ⚛️ **Physics** - Full integration with 3D rigid-body physics engine [ammo.js](https://github.com/kripken/ammo.js)
* 🏃 **Animation** - Powerful state-based animations for characters and arbitrary scene properties
* 🎮 **Input** - Mouse, keyboard, touch and gamepad APIs
* 🔊 **Sound** - 3D positional sounds built on the Web Audio API
* 📦 **Assets** - Asynchronous streaming system built on [glTF 2.0](https://www.khronos.org/gltf/), [Draco](https://google.github.io/draco/) and [Basis](https://github.com/BinomialLLC/basis_universal) compression
* 📜 **Scripts** - Write game behaviors in TypeScript or JavaScript

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
[![Swooop](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/4763/TKYXB8-image-25.jpg)](https://playcanv.as/p/JtL2iqIH/) [![dev Archer](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/415995/10A5A9-image-25.jpg)](https://playcanv.as/p/JERg21J8/) [![Gaussian Splat Statues](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/1224723/266D9C-image-25.jpg)](https://playcanv.as/p/cLkf99ZV/)  
[![Car](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/347824/7ULQ3Y-image-25.jpg)](https://playcanv.as/p/RqJJ9oU9/) [![Star-Lord](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/12/333626/BGQN9H-image-25.jpg)](https://playcanv.as/p/SA7hVBLt/) [![Global Illumination](https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/projects/4373/625081/6AB32D-image-25.jpg)](https://playcanv.as/p/ZV4PW6wr/ )

You can see more games on the [PlayCanvas website](https://playcanvas.com/explore).

## Users

PlayCanvas is used by leading companies in video games, advertising and visualization such as:  
**Animech, Arm, BMW, Disney, Facebook, Famobi, Funday Factory, IGT, King, Miniclip, Leapfrog, Mojiworks, Mozilla, Nickelodeon, Nordeus, NOWWA, PikPok, PlaySide Studios, Polaris, Product Madness, Samsung, Snap, Spry Fox, Zeptolab, Zynga**

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


## 🌐 Web Resources & Interactive Index
- [CATEGORY MERGE](https://studyplaying.github.io/category-merge.html)
- [SUSHI PUZZLE](https://ilearnworlds.github.io/sushi-puzzle.html)
- [PERFECT CAKE MAKER](https://themindplay.pages.dev/perfect-cake-maker.html)
- [OCTONAUTS BUBBLES](https://themindplay.pages.dev/octonauts-bubbles.html)
- [GUN CLONE](https://quizverses.github.io/gun-clone.html)
- [CRUSH IT ALL](https://themindplay.pages.dev/crush-it-all.html)
- [CATEGORY BATTLESHIP](https://studyquests.pages.dev/category-battleship.html)
- [LODE RETRO ADVENTURE](https://quizverses.github.io/lode-retro-adventure.html)
- [PROTECT MY DOG 3](https://themindplay.github.io/protect-my-dog-3.html)
- [CATEGORY ADVENTURE 4](https://quizverses.github.io/category-adventure-4.html)
- [JOIN CLASH COLOR BUTTON](https://thequizzone.pages.dev/join-clash-color-button.html)
- [HUGGY WUGGY ESCAPE](https://learnquester.pages.dev/huggy-wuggy-escape.html)
- [TONY ARCHER](https://themindplay.pages.dev/tony-archer.html)
- [HUNGRY NOOB CAFE SIMULATOR](https://thelearnquesters.pages.dev/hungry-noob-cafe-simulator.html)
- [PANDA MAHJONG CLASSIC](https://thelearnquesters.pages.dev/panda-mahjong-classic.html)
- [LARRY WORLD](https://themindplay.pages.dev/larry-world.html)
- [FOOTBALL FUN](https://thelearnquesters.pages.dev/football-fun.html)
- [ROBIN HOOD ARCHER](https://learnquesters.pages.dev/robin-hood-archer.html)
- [BATTLESHIP](https://themindplay.pages.dev/battleship.html)
- [PRISON MASTER ESCAPE JOURNEY](https://learnquesters.pages.dev/prison-master-escape-journey.html)
- [COSMO VOID](https://quizverses.github.io/cosmo-void.html)
- [CATEGORY RACING DRIVING 2](https://studyplayings.web.app/category-racing-driving-2.html)
- [SERIOUS HEAD](https://studyplaying.github.io/serious-head.html)
- [TRAIN DRIFT](https://thelearnquesters.pages.dev/train-drift.html)
- [BEAUTY PUZZLE](https://quizverses.github.io/beauty-puzzle.html)
- [CATEGORY FPS](https://studyquesthub.web.app/category-fps.html)
- [CATEGORY MOBILE2 112](https://themindplay.github.io/category-mobile2-112.html)
- [GRAFFITI TAGS SPRAY PAINTING](https://themindplay.pages.dev/graffiti-tags-spray-painting.html)
- [BFFS SPRING BREAK FASHIONISTA](https://studyplaying.github.io/bffs-spring-break-fashionista.html)
- [SANTA GO](https://learnquesters.pages.dev/santa-go.html)
- [CATEGORY STICKMAN 2](https://studyplaying.github.io/category-stickman-2.html)
- [PEG SOLITAIRE](https://themindplay.pages.dev/peg-solitaire.html)
- [COLOR RACE OBBY](https://thelearnquesters.pages.dev/color-race-obby.html)
- [CATEGORY BIKE63](https://quizverses.github.io/category-bike63.html)
- [ZOMBIE CHASE](https://thelearnquesters.pages.dev/zombie-chase.html)
- [ANIMAL BLOCKS](https://thelearnquesters.pages.dev/animal-blocks.html)
- [BATTLE TANKS FIRESTORM](https://learnquester.github.io/battle-tanks-firestorm.html)
- [DOTS MASTER](https://studyquests.github.io/dots-master.html)
- [CATEGORY UNBLOCKED](https://studyplayings.pages.dev/category-unblocked.html)
- [CATEGORY IDLE448](https://quizverses.github.io/category-idle448.html)
- [ONLINE PORTAL](https://brainquests.netlify.app/)
- [RADIANT RUSH](https://themindplay.pages.dev/radiant-rush.html)
- [KITKAT PUZZLE](https://thelearnquesters.pages.dev/kitkat-puzzle.html)
- [CHIRON CITY DRIVER](https://themindplay.pages.dev/chiron-city-driver.html)
- [CATEGORY THINKY](https://quizverses.github.io/category-thinky.html)
- [BLOX FRUITS](https://thelearnquesters.pages.dev/blox-fruits.html)
- [CATEGORY THINKY](https://thelearnquesters.pages.dev/category-thinky.html)
- [HOSPITAL GAME HAPPY CLINIC](https://learnquesters.pages.dev/hospital-game-happy-clinic.html)
- [VAMPIRIC ROULETTE ROMANCE](https://thelearnquesters.pages.dev/vampiric-roulette-romance.html)
- [CATEGORY SHOOTER 2](https://themindplay.github.io/category-shooter-2.html)
- [ZEN MASTER 3 TILES](https://theskillquest.pages.dev/zen-master-3-tiles.html)
- [ITALIAN BRAINROT FIND THE STARS](https://quizverses.github.io/italian-brainrot-find-the-stars.html)
- [CYBER MONDAY](https://quizverses.github.io/cyber-monday.html)
- [CATEGORY DIFFICULT81](https://themindplay.github.io/category-difficult81.html)
- [CATEGORY PUZZLE 9](https://themindzone.pages.dev/category-puzzle-9.html)
- [INDEX25](https://studyquests.github.io/index25.html)
- [JET FIGHTER AIRPLANE RACING](https://quizverses.github.io/jet-fighter-airplane-racing.html)
- [ZEN TILE](https://thequizzone.pages.dev/zen-tile.html)
- [1010 ELIXIR ALCHEMY](https://themindplay.pages.dev/1010-elixir-alchemy.html)
- [MOJICON GARDEN CONNECT](https://quizverses.github.io/mojicon-garden-connect.html)
- [SPACE CRAFT SHIP WAR](https://learnquester.github.io/space-craft-ship-war.html)
- [2048 MATCH BALLS](https://theskillquest.pages.dev/2048-match-balls.html)
- [HAWAII MATCH 6](https://thequizzone.pages.dev/hawaii-match-6.html)
- [NAIL QUEEN](https://studyplayings.pages.dev/nail-queen.html)
- [BLADE FORGE 3D](https://studyquests.github.io/blade-forge-3d.html)
- [JIGSORT PUZZLES](https://themindzone.pages.dev/jigsort-puzzles.html)
- [CATEGORY MISSION207](https://studyplayings.pages.dev/category-mission207.html)
- [MUSHROOM FEVER MATCH 3](https://quizverses.github.io/mushroom-fever-match-3.html)
- [CAPYBARA BLOCK BLAST](https://themindplay.pages.dev/capybara-block-blast.html)
- [CATEGORY TETRIS](https://studyplaying.github.io/category-tetris.html)
- [ASMR PET TREATMENT](https://studyplaying.github.io/asmr-pet-treatment.html)
- [MYSTERIOUS FAMILIARS ENCHANTED BESTIARY](https://thequizzone.pages.dev/mysterious-familiars-enchanted-bestiary.html)
- [LOLLIPOP STACK RUN](https://studyquests.pages.dev/lollipop-stack-run.html)
- [MAKEUP TRENDS THEN AND NOW](https://studyquests.github.io/makeup-trends-then-and-now.html)
- [SOLITAIRE KLONDIKE TREASURE ISLAND](https://studyplaying.github.io/solitaire-klondike-treasure-island.html)
- [ANTISTRESS SIMULATOR OF SEQUINS DIY](https://quizverses.github.io/antistress-simulator-of-sequins-diy.html)
- [WATER JUNK WARRIORS](https://thelearnquesters.pages.dev/water-junk-warriors.html)
- [HIDDEN OBJECT MY HOTEL](https://themindplay.pages.dev/hidden-object-my-hotel.html)
- [CAP](https://theskillquest.pages.dev/cap.html)
- [LETTERS MATCH](https://themindplay.pages.dev/letters-match.html)
- [CATEGORY TOP DOWN251](https://learnquester.github.io/category-top-down251.html)
- [PUZZLE BLOCKS](https://studyplaying.github.io/puzzle-blocks.html)
- [THE ROAD HOME GRANNY ESCAPE](https://themindzone.pages.dev/the-road-home-granny-escape.html)
- [COLOR MAZE](https://learnquesters.pages.dev/color-maze.html)
- [GRANNYS CLASSROOM NIGHTMARE](https://themindzone.pages.dev/grannys-classroom-nightmare.html)
- [CATEGORY CUTE](https://learnquester.github.io/category-cute.html)
- [TAP BLOCK PUZZLE SMASH GAME](https://studyplaying.github.io/tap-block-puzzle-smash-game.html)
- [CRAFT MAN VS GIANT TNT](https://quizverses.github.io/craft-man-vs-giant-tnt.html)
- [CATEGORY BOARDGAMES](https://learnquester.github.io/category-boardgames.html)
- [EYE ATTACK TOILET MONSTER WAR](https://learnquesters.pages.dev/eye-attack-toilet-monster-war.html)
- [CANNONS BLAST 3D](https://studyquests.pages.dev/cannons-blast-3d.html)
- [CATEGORY SOLITAIRE](https://themindplay.github.io/category-solitaire.html)
- [FARM BLOCK PUZZLE](https://themindzone.pages.dev/farm-block-puzzle.html)
- [TRIANGLES](https://themindzone.pages.dev/triangles.html)
- [UNTWIST ROAD](https://quizverses.github.io/untwist-road.html)
- [ROBLO X ZOMBIE](https://quizverses.github.io/roblo-x-zombie.html)
- [TENNIS MASTERS 2026](https://quizverses.pages.dev/tennis-masters-2026.html)
- [CATEGORY ROBOT49](https://quizverses.github.io/category-robot49.html)
- [CATEGORY SOCCER](https://theskillquest.pages.dev/category-soccer.html)
- [GLADIATOR FIGHTS](https://themindplay.pages.dev/gladiator-fights.html)
- [CATEGORY MINECRAFT81](https://quizverses.github.io/category-minecraft81.html)
- [FREECELL](https://studyquests.github.io/freecell.html)
- [BRAINROT CLICK TO HATCH](https://thequizzone.pages.dev/brainrot-click-to-hatch.html)
- [HIPPO SUPERMARKET](https://thelearnquesters.pages.dev/hippo-supermarket.html)
- [FURY OF THE STEAMPUNK PRINCESS](https://thelearnquesters.pages.dev/fury-of-the-steampunk-princess.html)
- [SUSTAINABLE](https://themindzone.pages.dev/sustainable.html)
- [MR LONG HAND](https://thequizzone.pages.dev/mr-long-hand.html)
- [SHINY JEWELS](https://studyquests.pages.dev/shiny-jewels.html)
- [TOWN RUN](https://thequizzone.pages.dev/town-run.html)
- [MAHJONG CONNECT TILES](https://quizverses.github.io/mahjong-connect-tiles.html)
- [COSMIC AVIATOR](https://iskillquest.pages.dev/cosmic-aviator.html)
- [CATEGORY FIGHTING124](https://thelearnquesters.pages.dev/category-fighting124.html)
- [CATEGORY DEEP IMMERSIVE24](https://quizverses.github.io/category-deep-immersive24.html)
- [CATEGORY MAGIC46](https://studyplayings.pages.dev/category-magic46.html)
- [MONSTER DASH](https://themindzone.pages.dev/monster-dash.html)
- [CATEGORY BIKE](https://themindzone.pages.dev/category-bike.html)
- [BRICKS BALLS BREAKER](https://quizverses.pages.dev/bricks-balls-breaker.html)
- [PRIVACY](https://brainquests.vercel.app/privacy.html)
- [PRINCESSES AT HORROR SCHOOL](https://theskillquest.pages.dev/princesses-at-horror-school.html)
- [DREAM PET HOTEL](https://quizverses.github.io/dream-pet-hotel.html)
- [DREAM MANIA HAPPY MATCH](https://themindplay.pages.dev/dream-mania-happy-match.html)
- [TIKTOK TRENDS COLORED DENIM](https://studyquests.github.io/tiktok-trends-colored-denim.html)
- [COLOR MAZE](https://theskillquest.pages.dev/color-maze.html)
- [HYPER CARS RAMP CRASH](https://iskillquest.pages.dev/hyper-cars-ramp-crash.html)
- [PIZZA MAKER COOKING GAMES FOR KIDS](https://iskillquest.pages.dev/pizza-maker-cooking-games-for-kids.html)
- [STICKMAN FOOTBALL](https://iskillquest.pages.dev/stickman-football.html)
- [SPRUNKI FIND THE DIFFERENCES](https://studyplaying.github.io/sprunki-find-the-differences.html)
- [TROPICAL MATCH 2](https://thelearnquesters.pages.dev/tropical-match-2.html)
- [TANGLE MASTER 3D](https://learnquesters.pages.dev/tangle-master-3d.html)
- [CATEGORY CASUAL 5](https://themindplay.github.io/category-casual-5.html)
