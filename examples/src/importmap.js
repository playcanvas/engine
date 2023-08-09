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
const react = {
  "prop-types"               : "/react-es6/prop-types/index.js",
  "tiny-warning"             : "/react-es6/tiny-warning.mjs",
  "tiny-invariant"           : "/react-es6/tiny-invariant.mjs",
  "mini-create-react-context": "/playcanvas-engine/examples/node_modules/react-router/node_modules/mini-create-react-context/dist/esm/index.js",
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
}
const imports = {
  "playcanvas"            : "/playcanvas-engine/src/index.js",
  //"playcanvas"            : "/playcanvas-engine/build/playcanvas.dbg.mjs/index.js",
  "@playcanvas/pcui"      : "/playcanvas-engine/examples/node_modules/@playcanvas/pcui/dist/module/src/index.mjs",
  "@playcanvas/pcui/react": "/playcanvas-engine/examples/node_modules/@playcanvas/pcui/react/dist/module/src/index.mjs",
  "@playcanvas/observer"  : "/playcanvas-engine/examples/node_modules/@playcanvas/observer/dist/index.mjs",
  "@monaco-editor/react"  : "/playcanvas-engine/examples/node_modules/@monaco-editor/react/lib/es/index.js",
  "@monaco-editor/loader" : "/playcanvas-engine/examples/node_modules/@monaco-editor/loader/lib/es/index.js",
  "state-local"           : "/playcanvas-engine/examples/node_modules/state-local/lib/es/state-local.js",
  "react-router-dom"      : "/playcanvas-engine/examples/node_modules/react-router-dom/esm/react-router-dom.js",
  "react-router"          : "/playcanvas-engine/examples/node_modules/react-router/esm/react-router.js",
  "@babel/runtime/helpers/esm/inheritsLoose"               : "/playcanvas-engine/examples/node_modules/@babel/runtime/helpers/esm/inheritsLoose.js",
  "@babel/runtime/helpers/esm/extends"                     : "/playcanvas-engine/examples/node_modules/@babel/runtime/helpers/esm/extends.js",
  "@babel/runtime/helpers/esm/objectWithoutPropertiesLoose": "/playcanvas-engine/examples/node_modules/@babel/runtime/helpers/esm/objectWithoutPropertiesLoose.js",
  "history"                  : "/playcanvas-engine/examples/node_modules/history/esm/history.js",
  "value-equal"              : "/playcanvas-engine/examples/node_modules/value-equal/esm/value-equal.js",
  "@playcanvas/pcui/styles"  : "/playcanvas-engine/examples/node_modules/@playcanvas/pcui/styles/dist/index.mjs",
  "playcanvas-extras"        : "/playcanvas-engine/extras/index.js",
  "fflate"                   : "/playcanvas-engine/node_modules/fflate/esm/browser.js",
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
