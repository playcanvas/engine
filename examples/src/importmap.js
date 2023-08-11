window.process = {
  env: {
    NODE_ENV: "development"
  }
};
/**
 * @param {string} content 
 * @returns {string}
 */
function importFile(content) {
  return "data:text/javascript;base64," + btoa(content);
}
const playcanvasEngine = document.currentScript.src + "/../../../";
const react = {
  "prop-types"               : "/react-es6/prop-types/index.js",
  "tiny-warning"             : "/react-es6/tiny-warning.mjs",
  "tiny-invariant"           : "/react-es6/tiny-invariant.mjs",
  "mini-create-react-context": playcanvasEngine + "examples/node_modules/react-router/node_modules/mini-create-react-context/dist/esm/index.js",
  "path-to-regexp"           : "/react-es6/path-to-regexp.mjs",
  "react-is"                 : "/react-es6/react-is.mjs",
  "hoist-non-react-statics"  : "/react-es6/hoist-non-react-statics.mjs",
  "resolve-pathname"         : "/react-es6/resolve-pathname.mjs",
  "isarray"                  : "/react-es6/isarray.mjs",
}
const react_dev = {
  ...react,
  "react"                    : "/react-es6/react.mjs",
  "react-dom"                : "/react-es6/react-dom.mjs",
  "react-dom/client"         : "/react-es6/react-dom-client.mjs",
};
const react_min = {
  ...react,
  "react"                    : "/react-es6/build/react.min.mjs",
  "react-dom"                : "/react-es6/build/react-dom.min.mjs",
  "react-dom/client"         : "/react-es6/build/react-dom-client.min.mjs",
};
const { host } = document.location;
const local = host === 'localhost' || host === '127.0.0.1';
const playcanvas = local ? {
  "playcanvas"            : playcanvasEngine + "src/index.js",
  //"playcanvas"            : playcanvasEngine + "build/playcanvas.dbg.mjs/index.js",
} : {
  "playcanvas"            : playcanvasEngine + "build/playcanvas.whole.mjs",
};
const imports = {
  ...playcanvas,
  "@playcanvas/pcui"      : playcanvasEngine + "examples/node_modules/@playcanvas/pcui/dist/module/src/index.mjs",
  "@playcanvas/pcui/react": playcanvasEngine + "examples/node_modules/@playcanvas/pcui/react/dist/module/src/index.mjs",
  "@playcanvas/observer"  : playcanvasEngine + "examples/node_modules/@playcanvas/observer/dist/index.mjs",
  //"@monaco-editor/react"  : playcanvasEngine + "examples/node_modules/@monaco-editor/react/lib/es/index.js",
  "@monaco-editor/react"  : playcanvasEngine + "examples/node_modules/@monaco-editor/react/dist/index.mjs",
  "@monaco-editor/loader" : playcanvasEngine + "examples/node_modules/@monaco-editor/loader/lib/es/index.js",
  "state-local"           : playcanvasEngine + "examples/node_modules/state-local/lib/es/state-local.js",
  "react-router-dom"      : playcanvasEngine + "examples/node_modules/react-router-dom/esm/react-router-dom.js",
  "react-router"          : playcanvasEngine + "examples/node_modules/react-router/esm/react-router.js",
  "@babel/runtime/helpers/esm/inheritsLoose"               : playcanvasEngine + "examples/node_modules/@babel/runtime/helpers/esm/inheritsLoose.js",
  "@babel/runtime/helpers/esm/extends"                     : playcanvasEngine + "examples/node_modules/@babel/runtime/helpers/esm/extends.js",
  "@babel/runtime/helpers/esm/objectWithoutPropertiesLoose": playcanvasEngine + "examples/node_modules/@babel/runtime/helpers/esm/objectWithoutPropertiesLoose.js",
  "history"                  : playcanvasEngine + "examples/node_modules/history/esm/history.js",
  "value-equal"              : playcanvasEngine + "examples/node_modules/value-equal/esm/value-equal.js",
  "@playcanvas/pcui/styles"  : playcanvasEngine + "examples/node_modules/@playcanvas/pcui/styles/dist/index.mjs",
  "playcanvas-extras"        : playcanvasEngine + "extras/index.js",
  "fflate"                   : playcanvasEngine + "examples/node_modules/fflate/esm/browser.js",
  ...react_min
};
const importmap = document.createElement("script");
importmap.type = "importmap";
importmap.textContent = JSON.stringify({imports});
if (!document.body) {
  //debugger;
}
let node = document.body;
if (!node) {
  node = document.head;
}
node.appendChild(importmap);
