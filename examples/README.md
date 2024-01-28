![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# Examples

A selection of simple examples to get you up and running

See them <a href="https://playcanvas.github.io/">running live</a>

## Local examples browser development
This section covers how to locally develop the examples browser application. For information on how to develop individual examples please see the following section.

Ensure you have Node.js installed. Then, install all of the required Node.js dependencies:
```
npm install
```
Now run the following command:
```
npm run develop
```
Visit the url mentioned in your terminal to view the examples browser.

You can also run the examples browser with a specific version of the engine by running the following command:

```
ENGINE_PATH=../build/playcanvas.mjs/index.js npm run develop
```

Where `../build/playcanvas.mjs/index.js` is the path to the es6 version of the engine.

Or directly from the source:

```
ENGINE_PATH=../src/index.js npm run develop
```

To create the side bar thumbnails run the following script:
```
npm run build:thumbnails
```

Please note that the examples app requires a built version of the engine to be present in the engine repo within the `../build` folder. If you haven't already done so, run `npm install` followed by `npm run build` in the engine repo.

As Monaco is supporting IntelliSense via type definitions files, you will also need to build the type definitions in the engine repo with `npm run build:types`.

## Creating an example

The available examples are written as classes in JavaScript under the paths `./src/examples/\<categoryName\>/\<exampleName>.mjs.
To create a new example you can copy any of the existing examples as a template and update its path.

Each example can implement two methods to define its functionality:

### `example` function

```js
import * as pc from 'playcanvas';
/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, scriptsPath }) {
    const app = new pc.Application(canvas, {});
}
```

This is the only function that's required to run an example. The code defined in this function is executed each time the example play button is pressed. It takes the example's canvas element from the options and usually begins by creating a new PlayCanvas `Application` or `AppBase` using that canvas.

You can load external scripts into an example using the `loadES5` function as follows:

```js
import { loadES5 } from '../../loadES5.mjs';
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {
    const CORE  = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
    const DRACO = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');
    console.log({ CORE, DRACO })
}
```

However, depending on external URL's is maybe not what you want as it breaks your examples once your internet connection is gone - you can simply install a NPM package and use it instead aswell:

```js
import * as TWEEN from '@tweenjs/tween.js';
```

### `controls` function

This function allows you to define a set of PCUI based interface which can be used to display stats from your example or provide users with a way of controlling the example.

```js
/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Button } = ReactPCUI;
    return fragment(
        jsx(Button, {
            text: 'Flash',
            onClick: () => {
                observer.set('flash', !observer.get('flash'));
            }
        })
    );
}
```

The controls function takes a [pcui observer](https://playcanvas.github.io/pcui/data-binding/using-observers/) as its parameter and returns a set of PCUI components. Check this [link](https://playcanvas.github.io/pcui/examples/todo/) for an example of how to create and use PCUI.

The data observer used in the `controls` function will be made available as a property in the example function:

```js
example({ canvas, assets, data }) {
    const app = new pc.Application(canvas, {});
    console.log(data.get('flash'));
}
```

### Testing your example
Ensure you have a locally built version of the examples browser by running the commands in the `Local examples browser development` section. Then run `npm run serve` to serve the examples browser.

You can view the full collection of example iframes by visiting [http://localhost:5000/iframe/]() in your browser.

### Debug and performance engine development
By default, the examples app uses the local version of the playcanvas engine located at `../build/playcanvas.js`. If you'd like to test the examples browser with the debug or performance versions of the engine instead, you can run `npm run watch:debug` or `npm run watch:profiler` commands.

## Deployment

1) **Build the latest engine** by running the following in the `/engine` directory:
```
npm install
npm run build
npm run build:types
```

2) **Build the examples browser and launch the server** by running the following in the `/engine/examples` directory:
```
npm install
npm run build
npm run serve
```

3) **Generate thumbnails** This step will create the thumbnails directory for the browser and may take a while depending on the number of new examples or if this is first time it has been run locally.
```
npm run build:thumbnails
```

This command spawns its own `serve` instance on port 12321, so you don't need to care about that.

4) Copy the contents of the `./dist` directory to the root of the [playcanvas.github.io](https://github.com/playcanvas/playcanvas.github.io) repository. Be sure not to wipe the contents of the `pcui` subdirectory in that repository.

5) Run `git commit -m "Update to Engine 1.XX.X"` in the `playcanvas.github.io` repo

6) Create a PR for this new commit
