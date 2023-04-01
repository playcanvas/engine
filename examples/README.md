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
Now run the following two commands in two separate terminals:
```
npm run watch
```
and
```
npm run serve
```
Visit [http://localhost:5000]() to view the examples browser.

To create the side bar thumbnails run the following script:
```
npm run build:thumbnails
```

Please note that the examples app requires a built version of the engine to be present in the engine repo within the `../build` folder. If you haven't already done so, run `npm install` followed by `npm run build` in the engine repo.

As the examples are written in TypeScript, you will also need to build the type definitions in the engine repo with `npm run build:types`.

## Creating an example

The available examples are written as classes in TypeScript under the paths `./src/examples/\<categoryName\>/\<exampleName>.tsx.
To create a new example you can copy any of the existing examples as a template and update its path.

Each example extends the `Example` parent class and can implement three methods to define its functionality:

### `example` function
```tsx
import * as pc from 'playcanvas/build/playcanvas.js';
example(canvas: HTMLCanvasElement) {
    const app = new pc.Application(canvas, {});
}
```
This is the only function that's required to run an example. The code defined in this function is executed each time the example play button is pressed. It takes the example's canvas element as its first argument and usually begins by creating a new PlayCanvas application using that canvas.

### `load` function
You can define a set of PlayCanvas assets to load into your application using this function. The function should return a set of Loader React components:
```tsx
import React from 'react';
import { AssetLoader } from '../../app/helpers/loader';
load() {
    return <>
        <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
        <AssetLoader name='firstPersonCamScript' type='script' url='static/scripts/camera/first-person-camera.js' />
    <>;
}
```
As assets are loaded using React, be sure to import React into any example that is loading assets.

Assets and scripts present in the `./assets` and `../scripts` directories will be available to examples under the `static/` path.
Each asset you load will be made available to the `example` function you write as the second parameter and will already be in the loaded state.
```tsx
example(canvas: HTMLCanvasElement, assets: { statue: pc.Asset, firstPersonCamScript: pc.Asset }) {
    const app = new pc.Application(canvas, {});
    // this will log true
    console.log(assets.statue.loaded);
}
```

Be sure to correctly define the type of the assets parameter to list each asset you're loading into the example.

You can also load external scripts into an example using the `ScriptLoader` React component as follows:
```tsx
import React from 'react';
import { ScriptLoader } from '../../app/helpers/loader';
load() {
    return <>
        <ScriptLoader name='TWEEN' url='https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js' />
    <>;
}
```
Each script will be made available as a parameter of the example function as an esModule using the name it was given and therefore any scripts should be defined in the examples function signature as follows:
```tsx
example(canvas: HTMLCanvasElement, TWEEN: any) {
    const app = new pc.Application(canvas, {});
    console.log(TWEEN);
}
```

### `controls` function
This function allows you to define a set of PCUI based interface which can be used to display stats from your example or provide users with a way of controlling the example.
```tsx
import Button from '@playcanvas/pcui/Button/component';
controls(data: any) {
    return <>
        <Button text='Flash' onClick={() => {
            data.set('flash', !data.get('flash'));
        }}/>
    </>;
}
```
The controls function takes a [pcui observer](https://playcanvas.github.io/pcui/data-binding/using-observers/) as its parameter and returns a set of PCUI components. Check this [link](https://playcanvas.github.io/pcui/examples/todo/) for an example of how to create and use PCUI.

The data observer used in the controls function will be made available as the third parameter in the example function:
```tsx
example(canvas: HTMLCanvasElement, assets: {}, data: any) {
    const app = new pc.Application(canvas, {});
    console.log(data.get('flash'));
}
```

### Testing your example
Ensure you have a locally built version of the examples browser by running the commands in the `Local examples browser development` section. Then run `npm run serve` to serve the examples browser.

You can view the full collection of example iframes by visiting [http://localhost:5000/iframe/]() in your browser. Viewing the iframes individually like this allows you to rebuild and test your examples without having the rebuild the full examples browser.

Example files can be rebuilt using the `npm run build:iframes` command, which only rebuilds example code rather than the full application. You can also run the `npm run watch:iframes` command to rebuild these examples any time an example file is edited or the local playcanvas engine is rebuilt.

You can also provide the category and example name of a specific example you are editing to these commands as environment variables to speed up the rebuilding process. For example if you are editing the `./src/examples/misc/hello-world.tsx` example you can run the following command:
```
CATEGORY=misc EXAMPLE=hello-world npm run watch:iframes
```

### Debug and performance engine development
By default, the examples app uses the local version of the playcanvas engine located at `../build/playcanvas.js`. If you'd like to test the examples browser with the debug or performance versions of the engine instead, you can run `npm run watch:iframes:debug` or `npm run watch:iframes:profiler` commands.

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

3) **Generate thumbnails** by first ensuring the examples browser is running on [http://localhost:5000]() then running the following command. This step will create the thumbnails directory for the browser and may take a while depending on the number of new examples or if this is first time it has been run locally.
```
npm run build:thumbnails
```

4) Copy the contents of the `./dist` directory to the root of the [playcanvas.github.io](https://github.com/playcanvas/playcanvas.github.io) repository. Be sure not to wipe the contents of the `pcui` subdirectory in that repository.

5) Run `git commit -m "Update to Engine 1.XX.X"` in the `playcanvas.github.io` repo

6) Create a PR for this new commit
