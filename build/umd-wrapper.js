;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        var JSDOM = require("jsdom").JSDOM;
        var DOM = new JSDOM();
        var window = DOM.window;
        var navigator = window.navigator;
        module.exports = factory(window, navigator);
    } else {
        root.pc = factory(root, root.navigator);
  }
}(this, function (window, navigator) {
  %output%
  return pc;
}));
