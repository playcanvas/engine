![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# Examples

A selection of simple examples to get you up and running

See them <a href="https://playcanvas.github.io/">running live</a>

## Local development
Ensure you have Node.js installed. Then, install all of the required Node.js dependencies:
```
npm install
```
Now run the following two commands in two separate terminals:
```
npm run build:watch
```
and
```
npm run serve
```
Visit [http://localhost:5000]() to view the examples browser.

To create the side bar thumbnails run the following script:
```
npm run thumbnails
```

### Local engine development
By default, the local build uses whichever version of PlayCanvas is listed in the package.json file. If you'd like to use the locally built version of PlayCanvas in the engines build directory you can replace the `npm run build:watch` script above with `npm run local` or `npm run local:dbg` for the debug version.

By default, example code is executed as an anonymous function in the browser (in order to support live code editing). However this limits the usefulness of debugging tools as the callstack for the example code is obscured. To run examples with a full callstack, allowing line by line debugging of an example, you can use the debug path for each example. Where `/#/misc/hello-world` becomes `/#/debug/misc/hello-world`. A full list of debug paths can be found at [http://localhost:5000/debug-directory]().

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
import { Button } from '@playcanvas/pcui/pcui-react';
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
