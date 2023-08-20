import * as observer from '@playcanvas/observer';
import * as pcx from 'playcanvas-extras';
import * as realExamples from "../examples/index.mjs";
import * as pc from "playcanvas";
import * as dirs from '../assetPath.mjs';
import '../app/polyfills.mjs';



    window.exampleFunction = window.top.localStorage.getItem(window.top.location.hash.replace('#', ''));
    if (!window.exampleFunction) {
        window.exampleFunction = Example.example;
    } else {
        window.exampleFunction = new Function('return ' + exampleFunction)();
    }
    window.files = window.top.editedFiles || Example.FILES;

    // load the engine, create the application, load the resources if necessary, then call the example
    const canvas = document.getElementById('application-canvas');
    callExample(canvas, window.files, data, window.exampleFunction)
      .catch((e) => {
        console.error("callExample>", e);
      });