;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        try {
            var JSDOM = require("jsdom").JSDOM;
            var DOM = new JSDOM();
            var window = DOM.window;
            var navigator = window.navigator;
            module.exports = factory(window, navigator);
        } catch (error) {
            module.exports = factory();
        }
    } else {
        root.pc = factory(root, root.navigator);
  }
}(this, function (_window, _navigator) {
  window = _window || window;
  navigator = _navigator || navigator;

  %output%
  return pc;
}));
