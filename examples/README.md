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
ENGINE_PATH=../build/playcanvas.mjs npm run develop
```

Where `../build/playcanvas.mjs` is the path to the ESM version of the engine.

Or directly from the source:

```
ENGINE_PATH=../src/index.js npm run develop
```

Please note that the examples app requires a built version of the engine to be present in the engine repo within the `../build` folder. If you haven't already done so, run `npm install` followed by `npm run build` in the engine repo.

As Monaco is supporting IntelliSense via type definitions files, you will also need to build the type definitions in the engine repo with `npm run build:types`.

## Creating an example

The available examples are written as classes in JavaScript under the paths `./src/examples/<category>/<exampleName>`.
To create a new example you can copy any of the existing examples as a template.

Each example consists of three modules to define its behavior:

### `example.mjs`

```js
import * as pc from 'playcanvas';

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}

const app = new pc.Application(canvas, {});

export { app };
```

This is the only file that's required to run an example. The code defined in this function is executed each time the example play button is pressed. It takes the example's canvas element from the DOM and usually begins by creating a new PlayCanvas `Application` or `AppBase` using that canvas.

You can load external scripts into an example using the `loadES5` function as follows:

```js
import { loadES5 } from '@examples/utils';

const CORE  = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
const DRACO = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');
```

However, depending on external URL's is maybe not what you want as it breaks your examples once your internet connection is gone - you can simply import modules directly as follows:

```js
import confetti from "https://esm.sh/canvas-confetti@1.6.0"
```

### `controls.mjs`

This file allows you to define a set of PCUI based interface which can be used to display stats from your example or provide users with a way of controlling the example.

```js
/**
 * @param {import('../../../app/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
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

The data observer used in the `controls` function will be made available as an import `@examples/observer` to use in the example file:

```js
import { data } from '@examples/observer';

console.log(data.get('flash'));
```

### `config.mjs`

This file allows you to define the default configuration for your examples as well as overrides to particular settings such as `deviceType` and additional files (e.g. vertex and fragment shaders). Check the config options `ExampleConfig` in `types.mjs` file.

```js
/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_ENABLED: true,
    FILES: {
        "shader.vert": /* glsl */`
            // vertex shader
        `
        "shader.frag": /* glsl */`
            // fragment shader
        `
    }
};
```

### Testing your example
Ensure you have a locally built version of the examples browser by running the commands in the `Local examples browser development` section. Then run `npm run serve` to serve the examples browser.

You can view the full collection of example iframes by visiting [http://localhost:5000/iframe/]() in your browser.

### Debug and performance engine development
By default, the examples app uses the local version of the playcanvas engine located at `../build/playcanvas.js`. If you'd like to test the examples browser with the debug or performance versions of the engine instead, you can run `npm run watch:debug` or `npm run watch:profiler` commands.

## Example Modules

The example script allows you to import examples only modules that interact with the environment such as the device selector and controls. These are listed below:

- `@examples/config` - The example config defined in `./src/examples/<category>/<exampleName>/config.mjs`.
- `@examples/utils` - Contains utilities functions such as `loadES5`. The full list of functions can be found in `./iframe/utils.mjs`.
- `@examples/observer` - The observer object `data`.
- `@examples/files` - The reatime file contents of all files used in the example (includes `FILES` property from `config.mjs`).

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

3) **Generate thumbnails (Case-by-case basis)** This step will create the thumbnails directory for the browser. This only needs to be run if the examples thumbnails are updated or new examples are added.
```
npm run build:thumbnails
```

This command spawns its own `serve` instance on port 12321, so you don't need to care about that.

4) Copy the contents of the `./dist` directory to the root of the [playcanvas.github.io](https://github.com/playcanvas/playcanvas.github.io) repository. Be sure not to wipe the contents of the `pcui` subdirectory in that repository.

5) Run `git commit -m "Update to Engine 1.XX.X"` in the `playcanvas.github.io` repo

6) Create a PR for this new commit
