import * as playcanvas     from "playcanvas";
import * as React          from "react";
import * as ReactDOM       from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as pcui           from "@playcanvas/pcui";
import * as pcuiReact      from "@playcanvas/pcui/react";
import * as obs            from "@playcanvas/observer";
import { BlendTrees1DExample          } from "./blend-trees-1d.mjs";
import { BlendTrees2DCartesianExample } from "./blend-trees-2d-cartesian.mjs";
import * as animExamples from "./index.mjs";
import { fragment, jsx, jsxTry } from "./jsx.mjs";
import * as codeEditor from "../../app/code-editor.mjs";
const headline = React.createElement("h1", {}, "Hello World");
const observer = new obs.Observer();
appendReactToBody(headline);
function getA() {
  const blendTrees1DExample = new BlendTrees1DExample();
  //const observer = new obs.Observer();
  const controls = blendTrees1DExample.controls(observer);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  appendReactToBody(controls);
  blendTrees1DExample.example(canvas, "webgl2", observer);
  return {
    blendTrees1DExample,
    observer,
    controls,
    canvas,
  }
}
function Timer() {
  const [time, setTime] = React.useState(0);
  React.useEffect(() => {
    let interval = setInterval(() => setTime(Date.now()), 100);
    return () => {
      // setInterval cleared when component unmounts
      clearInterval(interval);
    }
  }, []);
  return jsx("h1", null, `Time: ${time}`);
}
//appendReactToBody(jsx(Timer));
function getB() {
  const example = new BlendTrees2DCartesianExample();
  observer.on("blend:set", data => console.log("got blend:set", data));
  ///const controls = example.controls(observer);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  appendReactToBody(jsx(example.controls.bind(example, observer)));
  example.example(canvas, "webgl2", observer);
  return {
    example,
    observer,
    //controls,
    canvas,
  }
}
false &&
appendReactToBody(
  fragment(
    jsx("button", {onClick: jsxTry(getA)}, "getA"),
    jsx("button", {onClick: jsxTry(getB)}, "getB"),
  )
);

const files = [{
  name: 'example.js',
  text: 'const x = 1 + 2;\n' + "// test lines\n".repeat(100)
}];
const lintErrors = true;
/**
    position: absolute;
    left: 0px;
    top: 0px;
    width: 100vw;
    height: 100vh;
 */
appendReactToBody(jsx(codeEditor.CodeEditor, {
  files,
  lintErrors,
  setFiles: (...args) => console.log("setFiles", ...args),
  setLintErrors: (...args) => console.log("setLintErrors", ...args),
}));
//const a = jsxTry(getA)();
//const b = jsxTry(getB)();
//console.log({a, b});
function appendReactToBody(jsx) {
  const div = document.createElement("div");
  const root = ReactDOMClient.createRoot(div);
  root.render(jsx);
  document.body.append(div);
}
Object.assign(window, {
  playcanvas,
  pcui,
  pcuiReact,
  BlendTrees1DExample,
  //a,
  //b,
  observer,
  obs,
  React,
  ReactDOM,
  ReactDOMClient,
  headline,
  appendReactToBody,
  animExamples,
  codeEditor,
  jsx
});
