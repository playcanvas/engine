/* Copyright 2015-2026 PlayCanvas Ltd */

var spine = (function (pc) {
	'use strict';

	function _interopNamespaceDefault(e) {
		var n = Object.create(null);
		if (e) {
			Object.keys(e).forEach(function (k) {
				if (k !== 'default') {
					var d = Object.getOwnPropertyDescriptor(e, k);
					Object.defineProperty(n, k, d.get ? d : {
						enumerable: true,
						get: function () { return e[k]; }
					});
				}
			});
		}
		n.default = e;
		return Object.freeze(n);
	}

	var pc__namespace = /*#__PURE__*/_interopNamespaceDefault(pc);

	function _arrayLikeToArray(r, a) {
	  (null == a || a > r.length) && (a = r.length);
	  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
	  return n;
	}
	function _arrayWithHoles(r) {
	  if (Array.isArray(r)) return r;
	}
	function _arrayWithoutHoles(r) {
	  if (Array.isArray(r)) return _arrayLikeToArray(r);
	}
	function _assertThisInitialized(e) {
	  if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  return e;
	}
	function asyncGeneratorStep(n, t, e, r, o, a, c) {
	  try {
	    var i = n[a](c),
	      u = i.value;
	  } catch (n) {
	    return void e(n);
	  }
	  i.done ? t(u) : Promise.resolve(u).then(r, o);
	}
	function _asyncToGenerator(n) {
	  return function () {
	    var t = this,
	      e = arguments;
	    return new Promise(function (r, o) {
	      var a = n.apply(t, e);
	      function _next(n) {
	        asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
	      }
	      function _throw(n) {
	        asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
	      }
	      _next(void 0);
	    });
	  };
	}
	function _callSuper(t, o, e) {
	  return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e));
	}
	function _classCallCheck(a, n) {
	  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
	}
	function _defineProperties(e, r) {
	  for (var t = 0; t < r.length; t++) {
	    var o = r[t];
	    o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(e, _toPropertyKey(o.key), o);
	  }
	}
	function _createClass(e, r, t) {
	  return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
	    writable: false
	  }), e;
	}
	function _createForOfIteratorHelper(r, e) {
	  var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	  if (!t) {
	    if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e) {
	      t && (r = t);
	      var n = 0,
	        F = function () {};
	      return {
	        s: F,
	        n: function () {
	          return n >= r.length ? {
	            done: true
	          } : {
	            done: false,
	            value: r[n++]
	          };
	        },
	        e: function (r) {
	          throw r;
	        },
	        f: F
	      };
	    }
	    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	  }
	  var o,
	    a = true,
	    u = false;
	  return {
	    s: function () {
	      t = t.call(r);
	    },
	    n: function () {
	      var r = t.next();
	      return a = r.done, r;
	    },
	    e: function (r) {
	      u = true, o = r;
	    },
	    f: function () {
	      try {
	        a || null == t.return || t.return();
	      } finally {
	        if (u) throw o;
	      }
	    }
	  };
	}
	function _defineProperty(e, r, t) {
	  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
	    value: t,
	    enumerable: true,
	    configurable: true,
	    writable: true
	  }) : e[r] = t, e;
	}
	function _get() {
	  return _get = "undefined" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function (e, t, r) {
	    var p = _superPropBase(e, t);
	    if (p) {
	      var n = Object.getOwnPropertyDescriptor(p, t);
	      return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value;
	    }
	  }, _get.apply(null, arguments);
	}
	function _getPrototypeOf(t) {
	  return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) {
	    return t.__proto__ || Object.getPrototypeOf(t);
	  }, _getPrototypeOf(t);
	}
	function _inherits(t, e) {
	  if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function");
	  t.prototype = Object.create(e && e.prototype, {
	    constructor: {
	      value: t,
	      writable: true,
	      configurable: true
	    }
	  }), Object.defineProperty(t, "prototype", {
	    writable: false
	  }), e && _setPrototypeOf(t, e);
	}
	function _isNativeReflectConstruct() {
	  try {
	    var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
	  } catch (t) {}
	  return (_isNativeReflectConstruct = function () {
	    return !!t;
	  })();
	}
	function _iterableToArray(r) {
	  if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r);
	}
	function _iterableToArrayLimit(r, l) {
	  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	  if (null != t) {
	    var e,
	      n,
	      i,
	      u,
	      a = [],
	      f = true,
	      o = false;
	    try {
	      if (i = (t = t.call(r)).next, 0 === l) {
	        if (Object(t) !== t) return;
	        f = !1;
	      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
	    } catch (r) {
	      o = true, n = r;
	    } finally {
	      try {
	        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
	      } finally {
	        if (o) throw n;
	      }
	    }
	    return a;
	  }
	}
	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}
	function _possibleConstructorReturn(t, e) {
	  if (e && ("object" == typeof e || "function" == typeof e)) return e;
	  if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined");
	  return _assertThisInitialized(t);
	}
	function _regenerator() {
	  /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
	  var e,
	    t,
	    r = "function" == typeof Symbol ? Symbol : {},
	    n = r.iterator || "@@iterator",
	    o = r.toStringTag || "@@toStringTag";
	  function i(r, n, o, i) {
	    var c = n && n.prototype instanceof Generator ? n : Generator,
	      u = Object.create(c.prototype);
	    return _regeneratorDefine(u, "_invoke", function (r, n, o) {
	      var i,
	        c,
	        u,
	        f = 0,
	        p = o || [],
	        y = false,
	        G = {
	          p: 0,
	          n: 0,
	          v: e,
	          a: d,
	          f: d.bind(e, 4),
	          d: function (t, r) {
	            return i = t, c = 0, u = e, G.n = r, a;
	          }
	        };
	      function d(r, n) {
	        for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) {
	          var o,
	            i = p[t],
	            d = G.p,
	            l = i[2];
	          r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0));
	        }
	        if (o || r > 1) return a;
	        throw y = true, n;
	      }
	      return function (o, p, l) {
	        if (f > 1) throw TypeError("Generator is already running");
	        for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) {
	          i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u);
	          try {
	            if (f = 2, i) {
	              if (c || (o = "next"), t = i[o]) {
	                if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object");
	                if (!t.done) return t;
	                u = t.value, c < 2 && (c = 0);
	              } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1);
	              i = e;
	            } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break;
	          } catch (t) {
	            i = e, c = 1, u = t;
	          } finally {
	            f = 1;
	          }
	        }
	        return {
	          value: t,
	          done: y
	        };
	      };
	    }(r, o, i), true), u;
	  }
	  var a = {};
	  function Generator() {}
	  function GeneratorFunction() {}
	  function GeneratorFunctionPrototype() {}
	  t = Object.getPrototypeOf;
	  var c = [][n] ? t(t([][n]())) : (_regeneratorDefine(t = {}, n, function () {
	      return this;
	    }), t),
	    u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c);
	  function f(e) {
	    return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e;
	  }
	  return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine(u), _regeneratorDefine(u, o, "Generator"), _regeneratorDefine(u, n, function () {
	    return this;
	  }), _regeneratorDefine(u, "toString", function () {
	    return "[object Generator]";
	  }), (_regenerator = function () {
	    return {
	      w: i,
	      m: f
	    };
	  })();
	}
	function _regeneratorDefine(e, r, n, t) {
	  var i = Object.defineProperty;
	  try {
	    i({}, "", {});
	  } catch (e) {
	    i = 0;
	  }
	  _regeneratorDefine = function (e, r, n, t) {
	    function o(r, n) {
	      _regeneratorDefine(e, r, function (e) {
	        return this._invoke(r, n, e);
	      });
	    }
	    r ? i ? i(e, r, {
	      value: n,
	      enumerable: !t,
	      configurable: !t,
	      writable: !t
	    }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2));
	  }, _regeneratorDefine(e, r, n, t);
	}
	function _setPrototypeOf(t, e) {
	  return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) {
	    return t.__proto__ = e, t;
	  }, _setPrototypeOf(t, e);
	}
	function _slicedToArray(r, e) {
	  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
	}
	function _superPropBase(t, o) {
	  for (; !{}.hasOwnProperty.call(t, o) && null !== (t = _getPrototypeOf(t)););
	  return t;
	}
	function _superPropGet(t, o, e, r) {
	  var p = _get(_getPrototypeOf(t.prototype ), o, e);
	  return "function" == typeof p ? function (t) {
	    return p.apply(e, t);
	  } : p;
	}
	function _toConsumableArray(r) {
	  return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
	}
	function _toPrimitive(t, e) {
	  if ("object" != typeof t || !t) return t;
	  var r;
	  if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) {
	    var i = r.call(t, e);
	    if ("object" != typeof i) return i;
	    throw new TypeError("@@toPrimitive must return a primitive value.");
	  }
	  return ("string" === e ? String : Number)(t);
	}
	function _toPropertyKey(t) {
	  var i = _toPrimitive(t, "string");
	  return "symbol" == typeof i ? i : i + "";
	}
	function _typeof(o) {
	  "@babel/helpers - typeof";

	  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
	    return typeof o;
	  } : function (o) {
	    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	  }, _typeof(o);
	}
	function _unsupportedIterableToArray(r, a) {
	  if (r) {
	    if ("string" == typeof r) return _arrayLikeToArray(r, a);
	    var t = {}.toString.call(r).slice(8, -1);
	    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
	  }
	}

	var _Color, _MathUtils, _Interpolation;
	var IntSet = function () {
	  function IntSet() {
	    _classCallCheck(this, IntSet);
	    _defineProperty(this, "array", []);
	  }
	  return _createClass(IntSet, [{
	    key: "add",
	    value: function add(value) {
	      var contains = this.contains(value);
	      this.array[value | 0] = value | 0;
	      return !contains;
	    }
	  }, {
	    key: "contains",
	    value: function contains(value) {
	      return this.array[value | 0] !== undefined;
	    }
	  }, {
	    key: "remove",
	    value: function remove(value) {
	      this.array[value | 0] = undefined;
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.array.length = 0;
	    }
	  }]);
	}();
	var StringSet = function () {
	  function StringSet() {
	    _classCallCheck(this, StringSet);
	    _defineProperty(this, "entries", {});
	    _defineProperty(this, "size", 0);
	  }
	  return _createClass(StringSet, [{
	    key: "add",
	    value: function add(value) {
	      var contains = this.entries[value];
	      this.entries[value] = true;
	      if (!contains) {
	        this.size++;
	        return true;
	      }
	      return false;
	    }
	  }, {
	    key: "addAll",
	    value: function addAll(values) {
	      var oldSize = this.size;
	      for (var i = 0, n = values.length; i < n; i++) this.add(values[i]);
	      return oldSize !== this.size;
	    }
	  }, {
	    key: "contains",
	    value: function contains(value) {
	      return this.entries[value];
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.entries = {};
	      this.size = 0;
	    }
	  }]);
	}();
	var Color = function () {
	  function Color() {
	    var r = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	    var g = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	    var b = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	    var a = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
	    _classCallCheck(this, Color);
	    _defineProperty(this, "r", void 0);
	    _defineProperty(this, "g", void 0);
	    _defineProperty(this, "b", void 0);
	    _defineProperty(this, "a", void 0);
	    this.r = r;
	    this.g = g;
	    this.b = b;
	    this.a = a;
	  }
	  return _createClass(Color, [{
	    key: "set",
	    value: function set(r, g, b, a) {
	      this.r = r;
	      this.g = g;
	      this.b = b;
	      this.a = a;
	      return this.clamp();
	    }
	  }, {
	    key: "setFromColor",
	    value: function setFromColor(c) {
	      this.r = c.r;
	      this.g = c.g;
	      this.b = c.b;
	      this.a = c.a;
	      return this;
	    }
	  }, {
	    key: "setFromString",
	    value: function setFromString(hex) {
	      hex = hex.charAt(0) === '#' ? hex.substr(1) : hex;
	      this.r = parseInt(hex.substr(0, 2), 16) / 255;
	      this.g = parseInt(hex.substr(2, 2), 16) / 255;
	      this.b = parseInt(hex.substr(4, 2), 16) / 255;
	      this.a = hex.length !== 8 ? 1 : parseInt(hex.substr(6, 2), 16) / 255;
	      return this;
	    }
	  }, {
	    key: "add",
	    value: function add(r, g, b, a) {
	      this.r += r;
	      this.g += g;
	      this.b += b;
	      this.a += a;
	      return this.clamp();
	    }
	  }, {
	    key: "clamp",
	    value: function clamp() {
	      if (this.r < 0) this.r = 0;else if (this.r > 1) this.r = 1;
	      if (this.g < 0) this.g = 0;else if (this.g > 1) this.g = 1;
	      if (this.b < 0) this.b = 0;else if (this.b > 1) this.b = 1;
	      if (this.a < 0) this.a = 0;else if (this.a > 1) this.a = 1;
	      return this;
	    }
	  }, {
	    key: "toRgb888",
	    value: function toRgb888() {
	      var hex = function hex(x) {
	        return "0".concat((x * 255).toString(16)).slice(-2);
	      };
	      return Number("0x".concat(hex(this.r)).concat(hex(this.g)).concat(hex(this.b)));
	    }
	  }], [{
	    key: "rgba8888ToColor",
	    value: function rgba8888ToColor(color, value) {
	      color.r = ((value & 0xff000000) >>> 24) / 255;
	      color.g = ((value & 0x00ff0000) >>> 16) / 255;
	      color.b = ((value & 0x0000ff00) >>> 8) / 255;
	      color.a = (value & 0x000000ff) / 255;
	    }
	  }, {
	    key: "rgb888ToColor",
	    value: function rgb888ToColor(color, value) {
	      color.r = ((value & 0x00ff0000) >>> 16) / 255;
	      color.g = ((value & 0x0000ff00) >>> 8) / 255;
	      color.b = (value & 0x000000ff) / 255;
	    }
	  }, {
	    key: "fromString",
	    value: function fromString(hex) {
	      var color = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new Color();
	      return color.setFromString(hex);
	    }
	  }]);
	}();
	_Color = Color;
	_defineProperty(Color, "WHITE", new _Color(1, 1, 1, 1));
	_defineProperty(Color, "RED", new _Color(1, 0, 0, 1));
	_defineProperty(Color, "GREEN", new _Color(0, 1, 0, 1));
	_defineProperty(Color, "BLUE", new _Color(0, 0, 1, 1));
	_defineProperty(Color, "MAGENTA", new _Color(1, 0, 1, 1));
	var MathUtils = function () {
	  function MathUtils() {
	    _classCallCheck(this, MathUtils);
	  }
	  return _createClass(MathUtils, null, [{
	    key: "clamp",
	    value: function clamp(value, min, max) {
	      if (value < min) return min;
	      if (value > max) return max;
	      return value;
	    }
	  }, {
	    key: "cosDeg",
	    value: function cosDeg(degrees) {
	      return Math.cos(degrees * MathUtils.degRad);
	    }
	  }, {
	    key: "sinDeg",
	    value: function sinDeg(degrees) {
	      return Math.sin(degrees * MathUtils.degRad);
	    }
	  }, {
	    key: "atan2Deg",
	    value: function atan2Deg(y, x) {
	      return Math.atan2(y, x) * MathUtils.radDeg;
	    }
	  }, {
	    key: "signum",
	    value: function signum(value) {
	      return value > 0 ? 1 : value < 0 ? -1 : 0;
	    }
	  }, {
	    key: "toInt",
	    value: function toInt(x) {
	      return x > 0 ? Math.floor(x) : Math.ceil(x);
	    }
	  }, {
	    key: "cbrt",
	    value: function cbrt(x) {
	      var y = Math.pow(Math.abs(x), 1 / 3);
	      return x < 0 ? -y : y;
	    }
	  }, {
	    key: "randomTriangular",
	    value: function randomTriangular(min, max) {
	      return MathUtils.randomTriangularWith(min, max, (min + max) * 0.5);
	    }
	  }, {
	    key: "randomTriangularWith",
	    value: function randomTriangularWith(min, max, mode) {
	      var u = Math.random();
	      var d = max - min;
	      if (u <= (mode - min) / d) return min + Math.sqrt(u * d * (mode - min));
	      return max - Math.sqrt((1 - u) * d * (max - mode));
	    }
	  }, {
	    key: "isPowerOfTwo",
	    value: function isPowerOfTwo(value) {
	      return value && (value & value - 1) === 0;
	    }
	  }]);
	}();
	_MathUtils = MathUtils;
	_defineProperty(MathUtils, "epsilon", 0.00001);
	_defineProperty(MathUtils, "epsilon2", _MathUtils.epsilon * _MathUtils.epsilon);
	_defineProperty(MathUtils, "PI", 3.1415927);
	_defineProperty(MathUtils, "PI2", _MathUtils.PI * 2);
	_defineProperty(MathUtils, "invPI2", 1 / _MathUtils.PI2);
	_defineProperty(MathUtils, "radiansToDegrees", 180 / _MathUtils.PI);
	_defineProperty(MathUtils, "radDeg", _MathUtils.radiansToDegrees);
	_defineProperty(MathUtils, "degreesToRadians", _MathUtils.PI / 180);
	_defineProperty(MathUtils, "degRad", _MathUtils.degreesToRadians);
	var Interpolation = function () {
	  function Interpolation() {
	    _classCallCheck(this, Interpolation);
	  }
	  return _createClass(Interpolation, [{
	    key: "apply",
	    value: function apply(start, end, a) {
	      if (end === undefined || a === undefined) return this.applyInternal(start);
	      return start + (end - start) * this.applyInternal(a);
	    }
	  }]);
	}();
	_Interpolation = Interpolation;
	_defineProperty(Interpolation, "linear", new (function (_Interpolation3) {
	  function _class() {
	    _classCallCheck(this, _class);
	    return _callSuper(this, _class, arguments);
	  }
	  _inherits(_class, _Interpolation3);
	  return _createClass(_class, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      return a;
	    }
	  }]);
	}(_Interpolation))());
	_defineProperty(Interpolation, "smooth", new (function (_Interpolation4) {
	  function _class2() {
	    _classCallCheck(this, _class2);
	    return _callSuper(this, _class2, arguments);
	  }
	  _inherits(_class2, _Interpolation4);
	  return _createClass(_class2, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      return a * a * (3 - 2 * a);
	    }
	  }]);
	}(_Interpolation))());
	_defineProperty(Interpolation, "slowFast", new (function (_Interpolation5) {
	  function _class3() {
	    _classCallCheck(this, _class3);
	    return _callSuper(this, _class3, arguments);
	  }
	  _inherits(_class3, _Interpolation5);
	  return _createClass(_class3, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      return a * a;
	    }
	  }]);
	}(_Interpolation))());
	_defineProperty(Interpolation, "fastSlow", new (function (_Interpolation6) {
	  function _class4() {
	    _classCallCheck(this, _class4);
	    return _callSuper(this, _class4, arguments);
	  }
	  _inherits(_class4, _Interpolation6);
	  return _createClass(_class4, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      return (a - 1) * (a - 1) * -1 + 1;
	    }
	  }]);
	}(_Interpolation))());
	_defineProperty(Interpolation, "circle", new (function (_Interpolation7) {
	  function _class5() {
	    _classCallCheck(this, _class5);
	    return _callSuper(this, _class5, arguments);
	  }
	  _inherits(_class5, _Interpolation7);
	  return _createClass(_class5, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      if (a <= 0.5) {
	        a *= 2;
	        return (1 - Math.sqrt(1 - a * a)) / 2;
	      }
	      a--;
	      a *= 2;
	      return (Math.sqrt(1 - a * a) + 1) / 2;
	    }
	  }]);
	}(_Interpolation))());
	var Pow = function (_Interpolation2) {
	  function Pow(power) {
	    var _this;
	    _classCallCheck(this, Pow);
	    _this = _callSuper(this, Pow);
	    _defineProperty(_this, "power", 2);
	    _this.power = power;
	    return _this;
	  }
	  _inherits(Pow, _Interpolation2);
	  return _createClass(Pow, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      if (a <= 0.5) return Math.pow(a * 2, this.power) / 2;
	      return Math.pow((a - 1) * 2, this.power) / (this.power % 2 === 0 ? -2 : 2) + 1;
	    }
	  }]);
	}(Interpolation);
	var PowOut = function (_Pow2) {
	  function PowOut(power) {
	    _classCallCheck(this, PowOut);
	    return _callSuper(this, PowOut, [power]);
	  }
	  _inherits(PowOut, _Pow2);
	  return _createClass(PowOut, [{
	    key: "applyInternal",
	    value: function applyInternal(a) {
	      return Math.pow(a - 1, this.power) * (this.power % 2 === 0 ? -1 : 1) + 1;
	    }
	  }]);
	}(Pow);
	var Utils = function () {
	  function Utils() {
	    _classCallCheck(this, Utils);
	  }
	  return _createClass(Utils, null, [{
	    key: "arrayCopy",
	    value: function arrayCopy(source, sourceStart, dest, destStart, numElements) {
	      for (var i = sourceStart, j = destStart; i < sourceStart + numElements; i++, j++) {
	        dest[j] = source[i];
	      }
	    }
	  }, {
	    key: "arrayFill",
	    value: function arrayFill(array, fromIndex, toIndex, value) {
	      for (var i = fromIndex; i < toIndex; i++) array[i] = value;
	    }
	  }, {
	    key: "setArraySize",
	    value: function setArraySize(array, size) {
	      var value = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	      var oldSize = array.length;
	      if (oldSize === size) return array;
	      array.length = size;
	      if (oldSize < size) {
	        for (var i = oldSize; i < size; i++) array[i] = value;
	      }
	      return array;
	    }
	  }, {
	    key: "ensureArrayCapacity",
	    value: function ensureArrayCapacity(array, size) {
	      var value = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	      if (array.length >= size) return array;
	      return Utils.setArraySize(array, size, value);
	    }
	  }, {
	    key: "newArray",
	    value: function newArray(size, defaultValue) {
	      var array = [];
	      for (var i = 0; i < size; i++) array[i] = defaultValue;
	      return array;
	    }
	  }, {
	    key: "newFloatArray",
	    value: function newFloatArray(size) {
	      if (Utils.SUPPORTS_TYPED_ARRAYS) return new Float32Array(size);else {
	        var array = [];
	        for (var i = 0; i < array.length; i++) array[i] = 0;
	        return array;
	      }
	    }
	  }, {
	    key: "newShortArray",
	    value: function newShortArray(size) {
	      if (Utils.SUPPORTS_TYPED_ARRAYS) return new Int16Array(size);else {
	        var array = [];
	        for (var i = 0; i < array.length; i++) array[i] = 0;
	        return array;
	      }
	    }
	  }, {
	    key: "toFloatArray",
	    value: function toFloatArray(array) {
	      return Utils.SUPPORTS_TYPED_ARRAYS ? new Float32Array(array) : array;
	    }
	  }, {
	    key: "toSinglePrecision",
	    value: function toSinglePrecision(value) {
	      return Utils.SUPPORTS_TYPED_ARRAYS ? Math.fround(value) : value;
	    }
	  }, {
	    key: "webkit602BugfixHelper",
	    value: function webkit602BugfixHelper(alpha) {}
	  }, {
	    key: "contains",
	    value: function contains(array, element) {
	      for (var i = 0; i < array.length; i++) if (array[i] === element) return true;
	      return false;
	    }
	  }, {
	    key: "enumValue",
	    value: function enumValue(type, name) {
	      return type[name[0].toUpperCase() + name.slice(1)];
	    }
	  }]);
	}();
	_defineProperty(Utils, "SUPPORTS_TYPED_ARRAYS", typeof Float32Array !== "undefined");
	var DebugUtils = function () {
	  function DebugUtils() {
	    _classCallCheck(this, DebugUtils);
	  }
	  return _createClass(DebugUtils, null, [{
	    key: "logBones",
	    value: function logBones(skeleton) {
	      for (var i = 0; i < skeleton.bones.length; i++) {
	        var bone = skeleton.bones[i].appliedPose;
	        console.log("".concat(bone.bone.data.name, ", ").concat(bone.a, ", ").concat(bone.b, ", ").concat(bone.c, ", ").concat(bone.d, ", ").concat(bone.worldX, ", ").concat(bone.worldY));
	      }
	    }
	  }]);
	}();
	var Pool = function () {
	  function Pool(instantiator) {
	    _classCallCheck(this, Pool);
	    _defineProperty(this, "items", []);
	    _defineProperty(this, "instantiator", void 0);
	    this.instantiator = instantiator;
	  }
	  return _createClass(Pool, [{
	    key: "obtain",
	    value: function obtain() {
	      return this.items.length > 0 ? this.items.pop() : this.instantiator();
	    }
	  }, {
	    key: "free",
	    value: function free(item) {
	      var _item$reset;
	      (_item$reset = item.reset) === null || _item$reset === void 0 || _item$reset.call(item);
	      this.items.push(item);
	    }
	  }, {
	    key: "freeAll",
	    value: function freeAll(items) {
	      for (var i = 0; i < items.length; i++) this.free(items[i]);
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.items.length = 0;
	    }
	  }]);
	}();
	var Vector2 = function () {
	  function Vector2() {
	    var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	    var y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	    _classCallCheck(this, Vector2);
	    _defineProperty(this, "x", void 0);
	    _defineProperty(this, "y", void 0);
	    this.x = x;
	    this.y = y;
	  }
	  return _createClass(Vector2, [{
	    key: "set",
	    value: function set(x, y) {
	      this.x = x;
	      this.y = y;
	      return this;
	    }
	  }, {
	    key: "length",
	    value: function length() {
	      var x = this.x;
	      var y = this.y;
	      return Math.sqrt(x * x + y * y);
	    }
	  }, {
	    key: "normalize",
	    value: function normalize() {
	      var len = this.length();
	      if (len !== 0) {
	        this.x /= len;
	        this.y /= len;
	      }
	      return this;
	    }
	  }]);
	}();
	var TimeKeeper = function () {
	  function TimeKeeper() {
	    _classCallCheck(this, TimeKeeper);
	    _defineProperty(this, "maxDelta", 0.064);
	    _defineProperty(this, "framesPerSecond", 0);
	    _defineProperty(this, "delta", 0);
	    _defineProperty(this, "totalTime", 0);
	    _defineProperty(this, "lastTime", Date.now() / 1000);
	    _defineProperty(this, "frameCount", 0);
	    _defineProperty(this, "frameTime", 0);
	  }
	  return _createClass(TimeKeeper, [{
	    key: "update",
	    value: function update() {
	      var now = Date.now() / 1000;
	      this.delta = now - this.lastTime;
	      this.frameTime += this.delta;
	      this.totalTime += this.delta;
	      if (this.delta > this.maxDelta) this.delta = this.maxDelta;
	      this.lastTime = now;
	      this.frameCount++;
	      if (this.frameTime > 1) {
	        this.framesPerSecond = this.frameCount / this.frameTime;
	        this.frameTime = 0;
	        this.frameCount = 0;
	      }
	    }
	  }]);
	}();
	var WindowedMean = function () {
	  function WindowedMean() {
	    var windowSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 32;
	    _classCallCheck(this, WindowedMean);
	    _defineProperty(this, "values", void 0);
	    _defineProperty(this, "addedValues", 0);
	    _defineProperty(this, "lastValue", 0);
	    _defineProperty(this, "mean", 0);
	    _defineProperty(this, "dirty", true);
	    this.values = new Array(windowSize);
	  }
	  return _createClass(WindowedMean, [{
	    key: "hasEnoughData",
	    value: function hasEnoughData() {
	      return this.addedValues >= this.values.length;
	    }
	  }, {
	    key: "addValue",
	    value: function addValue(value) {
	      if (this.addedValues < this.values.length) this.addedValues++;
	      this.values[this.lastValue++] = value;
	      if (this.lastValue > this.values.length - 1) this.lastValue = 0;
	      this.dirty = true;
	    }
	  }, {
	    key: "getMean",
	    value: function getMean() {
	      if (this.hasEnoughData()) {
	        if (this.dirty) {
	          var mean = 0;
	          for (var i = 0; i < this.values.length; i++) mean += this.values[i];
	          this.mean = mean / this.values.length;
	          this.dirty = false;
	        }
	        return this.mean;
	      }
	      return 0;
	    }
	  }]);
	}();

	var Texture = function () {
	  function Texture(image) {
	    _classCallCheck(this, Texture);
	    _defineProperty(this, "_image", void 0);
	    this._image = image;
	  }
	  return _createClass(Texture, [{
	    key: "getImage",
	    value: function getImage() {
	      return this._image;
	    }
	  }]);
	}();
	var TextureFilter;
	(function (TextureFilter) {
	  TextureFilter[TextureFilter["Nearest"] = 9728] = "Nearest";
	  TextureFilter[TextureFilter["Linear"] = 9729] = "Linear";
	  TextureFilter[TextureFilter["MipMap"] = 9987] = "MipMap";
	  TextureFilter[TextureFilter["MipMapNearestNearest"] = 9984] = "MipMapNearestNearest";
	  TextureFilter[TextureFilter["MipMapLinearNearest"] = 9985] = "MipMapLinearNearest";
	  TextureFilter[TextureFilter["MipMapNearestLinear"] = 9986] = "MipMapNearestLinear";
	  TextureFilter[TextureFilter["MipMapLinearLinear"] = 9987] = "MipMapLinearLinear";
	})(TextureFilter || (TextureFilter = {}));
	var TextureWrap;
	(function (TextureWrap) {
	  TextureWrap[TextureWrap["MirroredRepeat"] = 33648] = "MirroredRepeat";
	  TextureWrap[TextureWrap["ClampToEdge"] = 33071] = "ClampToEdge";
	  TextureWrap[TextureWrap["Repeat"] = 10497] = "Repeat";
	})(TextureWrap || (TextureWrap = {}));
	var TextureRegion = _createClass(function TextureRegion() {
	  _classCallCheck(this, TextureRegion);
	  _defineProperty(this, "texture", void 0);
	  _defineProperty(this, "u", 0);
	  _defineProperty(this, "v", 0);
	  _defineProperty(this, "u2", 0);
	  _defineProperty(this, "v2", 0);
	  _defineProperty(this, "width", 0);
	  _defineProperty(this, "height", 0);
	  _defineProperty(this, "degrees", 0);
	  _defineProperty(this, "offsetX", 0);
	  _defineProperty(this, "offsetY", 0);
	  _defineProperty(this, "originalWidth", 0);
	  _defineProperty(this, "originalHeight", 0);
	});
	var FakeTexture = function (_Texture2) {
	  function FakeTexture() {
	    _classCallCheck(this, FakeTexture);
	    return _callSuper(this, FakeTexture, arguments);
	  }
	  _inherits(FakeTexture, _Texture2);
	  return _createClass(FakeTexture, [{
	    key: "setFilters",
	    value: function setFilters(minFilter, magFilter) {}
	  }, {
	    key: "setWraps",
	    value: function setWraps(uWrap, vWrap) {}
	  }, {
	    key: "dispose",
	    value: function dispose() {}
	  }]);
	}(Texture);

	var TextureAtlas = function () {
	  function TextureAtlas(atlasText) {
	    _classCallCheck(this, TextureAtlas);
	    _defineProperty(this, "pages", []);
	    _defineProperty(this, "regions", []);
	    var reader = new TextureAtlasReader(atlasText);
	    var entry = new Array(4);
	    var pageFields = {};
	    pageFields.size = function (page) {
	      page.width = parseInt(entry[1]);
	      page.height = parseInt(entry[2]);
	    };
	    pageFields.format = function () {};
	    pageFields.filter = function (page) {
	      page.minFilter = Utils.enumValue(TextureFilter, entry[1]);
	      page.magFilter = Utils.enumValue(TextureFilter, entry[2]);
	    };
	    pageFields.repeat = function (page) {
	      if (entry[1].indexOf('x') !== -1) page.uWrap = TextureWrap.Repeat;
	      if (entry[1].indexOf('y') !== -1) page.vWrap = TextureWrap.Repeat;
	    };
	    pageFields.pma = function (page) {
	      page.pma = entry[1] === "true";
	    };
	    var regionFields = {};
	    regionFields.xy = function (region) {
	      region.x = parseInt(entry[1]);
	      region.y = parseInt(entry[2]);
	    };
	    regionFields.size = function (region) {
	      region.width = parseInt(entry[1]);
	      region.height = parseInt(entry[2]);
	    };
	    regionFields.bounds = function (region) {
	      region.x = parseInt(entry[1]);
	      region.y = parseInt(entry[2]);
	      region.width = parseInt(entry[3]);
	      region.height = parseInt(entry[4]);
	    };
	    regionFields.offset = function (region) {
	      region.offsetX = parseInt(entry[1]);
	      region.offsetY = parseInt(entry[2]);
	    };
	    regionFields.orig = function (region) {
	      region.originalWidth = parseInt(entry[1]);
	      region.originalHeight = parseInt(entry[2]);
	    };
	    regionFields.offsets = function (region) {
	      region.offsetX = parseInt(entry[1]);
	      region.offsetY = parseInt(entry[2]);
	      region.originalWidth = parseInt(entry[3]);
	      region.originalHeight = parseInt(entry[4]);
	    };
	    regionFields.rotate = function (region) {
	      var value = entry[1];
	      if (value === "true") region.degrees = 90;else if (value !== "false") region.degrees = parseInt(value);
	    };
	    regionFields.index = function (region) {
	      region.index = parseInt(entry[1]);
	    };
	    var line = reader.readLine();
	    while (line && line.trim().length === 0) line = reader.readLine();
	    while (true) {
	      if (!line || line.trim().length === 0) break;
	      if (reader.readEntry(entry, line) === 0) break;
	      line = reader.readLine();
	    }
	    var page = null;
	    var names = null;
	    var values = null;
	    while (true) {
	      if (line === null) break;
	      if (line.trim().length === 0) {
	        page = null;
	        line = reader.readLine();
	      } else if (!page) {
	        page = new TextureAtlasPage(line.trim());
	        while (true) {
	          if (reader.readEntry(entry, line = reader.readLine()) === 0) break;
	          var field = pageFields[entry[0]];
	          if (field) field(page);
	        }
	        this.pages.push(page);
	      } else {
	        var region = new TextureAtlasRegion(page, line);
	        while (true) {
	          var count = reader.readEntry(entry, line = reader.readLine());
	          if (count === 0) break;
	          var _field = regionFields[entry[0]];
	          if (_field) _field(region);else {
	            if (!names) names = [];
	            if (!values) values = [];
	            names.push(entry[0]);
	            var entryValues = [];
	            for (var i = 0; i < count; i++) entryValues.push(parseInt(entry[i + 1]));
	            values.push(entryValues);
	          }
	        }
	        if (region.originalWidth === 0 && region.originalHeight === 0) {
	          region.originalWidth = region.width;
	          region.originalHeight = region.height;
	        }
	        if (names && names.length > 0 && values && values.length > 0) {
	          region.names = names;
	          region.values = values;
	          names = null;
	          values = null;
	        }
	        region.u = region.x / page.width;
	        region.v = region.y / page.height;
	        if (region.degrees === 90) {
	          region.u2 = (region.x + region.height) / page.width;
	          region.v2 = (region.y + region.width) / page.height;
	        } else {
	          region.u2 = (region.x + region.width) / page.width;
	          region.v2 = (region.y + region.height) / page.height;
	        }
	        this.regions.push(region);
	      }
	    }
	  }
	  return _createClass(TextureAtlas, [{
	    key: "findRegion",
	    value: function findRegion(name) {
	      for (var i = 0; i < this.regions.length; i++) {
	        if (this.regions[i].name === name) {
	          return this.regions[i];
	        }
	      }
	      return null;
	    }
	  }, {
	    key: "setTextures",
	    value: function setTextures(assetManager) {
	      var pathPrefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
	      var _iterator = _createForOfIteratorHelper(this.pages),
	        _step;
	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var page = _step.value;
	          page.setTexture(assetManager.get(pathPrefix + page.name));
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      for (var i = 0; i < this.pages.length; i++) {
	        var _this$pages$i$texture;
	        (_this$pages$i$texture = this.pages[i].texture) === null || _this$pages$i$texture === void 0 || _this$pages$i$texture.dispose();
	      }
	    }
	  }]);
	}();
	var TextureAtlasReader = function () {
	  function TextureAtlasReader(text) {
	    _classCallCheck(this, TextureAtlasReader);
	    _defineProperty(this, "lines", void 0);
	    _defineProperty(this, "index", 0);
	    this.lines = text.split(/\r\n|\r|\n/);
	  }
	  return _createClass(TextureAtlasReader, [{
	    key: "readLine",
	    value: function readLine() {
	      if (this.index >= this.lines.length) return null;
	      return this.lines[this.index++];
	    }
	  }, {
	    key: "readEntry",
	    value: function readEntry(entry, line) {
	      if (!line) return 0;
	      line = line.trim();
	      if (line.length === 0) return 0;
	      var colon = line.indexOf(':');
	      if (colon === -1) return 0;
	      entry[0] = line.substr(0, colon).trim();
	      for (var i = 1, lastMatch = colon + 1;; i++) {
	        var comma = line.indexOf(',', lastMatch);
	        if (comma === -1) {
	          entry[i] = line.substr(lastMatch).trim();
	          return i;
	        }
	        entry[i] = line.substr(lastMatch, comma - lastMatch).trim();
	        lastMatch = comma + 1;
	        if (i === 4) return 4;
	      }
	    }
	  }]);
	}();
	var TextureAtlasPage = function () {
	  function TextureAtlasPage(name) {
	    _classCallCheck(this, TextureAtlasPage);
	    _defineProperty(this, "name", void 0);
	    _defineProperty(this, "minFilter", TextureFilter.Nearest);
	    _defineProperty(this, "magFilter", TextureFilter.Nearest);
	    _defineProperty(this, "uWrap", TextureWrap.ClampToEdge);
	    _defineProperty(this, "vWrap", TextureWrap.ClampToEdge);
	    _defineProperty(this, "texture", null);
	    _defineProperty(this, "width", 0);
	    _defineProperty(this, "height", 0);
	    _defineProperty(this, "pma", false);
	    _defineProperty(this, "regions", []);
	    this.name = name;
	  }
	  return _createClass(TextureAtlasPage, [{
	    key: "setTexture",
	    value: function setTexture(texture) {
	      this.texture = texture;
	      texture.setFilters(this.minFilter, this.magFilter);
	      texture.setWraps(this.uWrap, this.vWrap);
	      var _iterator2 = _createForOfIteratorHelper(this.regions),
	        _step2;
	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var region = _step2.value;
	          region.texture = texture;
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }]);
	}();
	var TextureAtlasRegion = function (_TextureRegion) {
	  function TextureAtlasRegion(page, name) {
	    var _this;
	    _classCallCheck(this, TextureAtlasRegion);
	    _this = _callSuper(this, TextureAtlasRegion);
	    _defineProperty(_this, "page", void 0);
	    _defineProperty(_this, "name", void 0);
	    _defineProperty(_this, "x", 0);
	    _defineProperty(_this, "y", 0);
	    _defineProperty(_this, "offsetX", 0);
	    _defineProperty(_this, "offsetY", 0);
	    _defineProperty(_this, "originalWidth", 0);
	    _defineProperty(_this, "originalHeight", 0);
	    _defineProperty(_this, "index", 0);
	    _defineProperty(_this, "degrees", 0);
	    _defineProperty(_this, "names", null);
	    _defineProperty(_this, "values", null);
	    _this.page = page;
	    _this.name = name;
	    page.regions.push(_this);
	    return _this;
	  }
	  _inherits(TextureAtlasRegion, _TextureRegion);
	  return _createClass(TextureAtlasRegion);
	}(TextureRegion);

	var Attachment = function () {
	  function Attachment(name) {
	    _classCallCheck(this, Attachment);
	    _defineProperty(this, "name", void 0);
	    _defineProperty(this, "timelineAttachment", void 0);
	    _defineProperty(this, "timelineSlots", Attachment.empty);
	    if (!name) throw new Error("name cannot be null.");
	    this.name = name;
	    this.timelineAttachment = this;
	  }
	  return _createClass(Attachment, [{
	    key: "isTimelineActive",
	    value: function isTimelineActive(slots, slotIndex, appliedPose) {
	      var slot = slots[slotIndex];
	      if (slot.bone.isActive()) {
	        var other = (appliedPose ? slot.getAppliedPose() : slot.getPose()).getAttachment();
	        if (other != null && other.timelineAttachment === this) return true;
	      }
	      for (var i = 0, n = this.timelineSlots.length; i < n; i++) {
	        slot = slots[this.timelineSlots[i]];
	        if (!slot.bone.isActive()) continue;
	        var _other = (appliedPose ? slot.getAppliedPose() : slot.getPose()).getAttachment();
	        if (_other != null && _other.timelineAttachment === this) return true;
	      }
	      return false;
	    }
	  }]);
	}();
	_defineProperty(Attachment, "empty", []);
	var VertexAttachment = function (_Attachment2) {
	  function VertexAttachment(name) {
	    var _this;
	    _classCallCheck(this, VertexAttachment);
	    _this = _callSuper(this, VertexAttachment, [name]);
	    _defineProperty(_this, "id", VertexAttachment.nextID++);
	    _defineProperty(_this, "bones", null);
	    _defineProperty(_this, "vertices", []);
	    _defineProperty(_this, "worldVerticesLength", 0);
	    return _this;
	  }
	  _inherits(VertexAttachment, _Attachment2);
	  return _createClass(VertexAttachment, [{
	    key: "computeWorldVertices",
	    value: function computeWorldVertices(skeleton, slot, start, count, worldVertices, offset, stride) {
	      count = offset + (count >> 1) * stride;
	      var deformArray = slot.appliedPose.deform;
	      var vertices = this.vertices;
	      var bones = this.bones;
	      if (!bones) {
	        if (deformArray.length > 0) vertices = deformArray;
	        var bone = slot.bone.appliedPose;
	        var x = bone.worldX;
	        var y = bone.worldY;
	        var a = bone.a,
	          b = bone.b,
	          c = bone.c,
	          d = bone.d;
	        for (var _v = start, w = offset; w < count; _v += 2, w += stride) {
	          var vx = vertices[_v],
	            vy = vertices[_v + 1];
	          worldVertices[w] = vx * a + vy * b + x;
	          worldVertices[w + 1] = vx * c + vy * d + y;
	        }
	        return;
	      }
	      var v = 0,
	        skip = 0;
	      for (var i = 0; i < start; i += 2) {
	        var n = bones[v];
	        v += n + 1;
	        skip += n;
	      }
	      var skeletonBones = skeleton.bones;
	      if (deformArray.length === 0) {
	        for (var _w = offset, _b = skip * 3; _w < count; _w += stride) {
	          var wx = 0,
	            wy = 0;
	          var _n = bones[v++];
	          _n += v;
	          for (; v < _n; v++, _b += 3) {
	            var _bone = skeletonBones[bones[v]].appliedPose;
	            var _vx = vertices[_b],
	              _vy = vertices[_b + 1],
	              weight = vertices[_b + 2];
	            wx += (_vx * _bone.a + _vy * _bone.b + _bone.worldX) * weight;
	            wy += (_vx * _bone.c + _vy * _bone.d + _bone.worldY) * weight;
	          }
	          worldVertices[_w] = wx;
	          worldVertices[_w + 1] = wy;
	        }
	      } else {
	        var deform = deformArray;
	        for (var _w2 = offset, _b2 = skip * 3, f = skip << 1; _w2 < count; _w2 += stride) {
	          var _wx = 0,
	            _wy = 0;
	          var _n2 = bones[v++];
	          _n2 += v;
	          for (; v < _n2; v++, _b2 += 3, f += 2) {
	            var _bone2 = skeletonBones[bones[v]].appliedPose;
	            var _vx2 = vertices[_b2] + deform[f],
	              _vy2 = vertices[_b2 + 1] + deform[f + 1],
	              _weight = vertices[_b2 + 2];
	            _wx += (_vx2 * _bone2.a + _vy2 * _bone2.b + _bone2.worldX) * _weight;
	            _wy += (_vx2 * _bone2.c + _vy2 * _bone2.d + _bone2.worldY) * _weight;
	          }
	          worldVertices[_w2] = _wx;
	          worldVertices[_w2 + 1] = _wy;
	        }
	      }
	    }
	  }, {
	    key: "copyTo",
	    value: function copyTo(attachment) {
	      if (this.bones) {
	        attachment.bones = [];
	        Utils.arrayCopy(this.bones, 0, attachment.bones, 0, this.bones.length);
	      } else attachment.bones = null;
	      if (this.vertices) {
	        attachment.vertices = Utils.newFloatArray(this.vertices.length);
	        Utils.arrayCopy(this.vertices, 0, attachment.vertices, 0, this.vertices.length);
	      }
	      attachment.worldVerticesLength = this.worldVerticesLength;
	      attachment.timelineAttachment = this.timelineAttachment;
	      attachment.timelineSlots = this.timelineSlots;
	    }
	  }]);
	}(Attachment);
	_defineProperty(VertexAttachment, "nextID", 0);

	var MeshAttachment = function (_VertexAttachment) {
	  function MeshAttachment(name, sequence) {
	    var _this;
	    _classCallCheck(this, MeshAttachment);
	    _this = _callSuper(this, MeshAttachment, [name]);
	    _defineProperty(_this, "sequence", void 0);
	    _defineProperty(_this, "regionUVs", []);
	    _defineProperty(_this, "triangles", []);
	    _defineProperty(_this, "hullLength", 0);
	    _defineProperty(_this, "path", void 0);
	    _defineProperty(_this, "color", new Color(1, 1, 1, 1));
	    _defineProperty(_this, "sourceMesh", null);
	    _defineProperty(_this, "edges", []);
	    _defineProperty(_this, "width", 0);
	    _defineProperty(_this, "height", 0);
	    _defineProperty(_this, "tempColor", new Color(0, 0, 0, 0));
	    _this.sequence = sequence;
	    return _this;
	  }
	  _inherits(MeshAttachment, _VertexAttachment);
	  return _createClass(MeshAttachment, [{
	    key: "copy",
	    value: function copy() {
	      if (this.sourceMesh) return this.newLinkedMesh();
	      var copy = new MeshAttachment(this.name, this.sequence.copy());
	      copy.path = this.path;
	      copy.color.setFromColor(this.color);
	      this.copyTo(copy);
	      copy.regionUVs = [];
	      Utils.arrayCopy(this.regionUVs, 0, copy.regionUVs, 0, this.regionUVs.length);
	      copy.triangles = [];
	      Utils.arrayCopy(this.triangles, 0, copy.triangles, 0, this.triangles.length);
	      copy.hullLength = this.hullLength;
	      if (this.edges) {
	        copy.edges = [];
	        Utils.arrayCopy(this.edges, 0, copy.edges, 0, this.edges.length);
	      }
	      copy.width = this.width;
	      copy.height = this.height;
	      return copy;
	    }
	  }, {
	    key: "updateSequence",
	    value: function updateSequence() {
	      this.sequence.update(this);
	    }
	  }, {
	    key: "getSourceMesh",
	    value: function getSourceMesh() {
	      return this.sourceMesh;
	    }
	  }, {
	    key: "setSourceMesh",
	    value: function setSourceMesh(sourceMesh) {
	      this.sourceMesh = sourceMesh;
	      if (sourceMesh) {
	        this.bones = sourceMesh.bones;
	        this.vertices = sourceMesh.vertices;
	        this.worldVerticesLength = sourceMesh.worldVerticesLength;
	        this.regionUVs = sourceMesh.regionUVs;
	        this.triangles = sourceMesh.triangles;
	        this.hullLength = sourceMesh.hullLength;
	        this.worldVerticesLength = sourceMesh.worldVerticesLength;
	        this.edges = sourceMesh.edges;
	        this.width = sourceMesh.width;
	        this.height = sourceMesh.height;
	      }
	    }
	  }, {
	    key: "newLinkedMesh",
	    value: function newLinkedMesh() {
	      var copy = new MeshAttachment(this.name, this.sequence.copy());
	      copy.timelineAttachment = this.timelineAttachment;
	      copy.path = this.path;
	      copy.color.setFromColor(this.color);
	      copy.setSourceMesh(this.sourceMesh ? this.sourceMesh : this);
	      copy.updateSequence();
	      return copy;
	    }
	  }], [{
	    key: "computeUVs",
	    value: function computeUVs(region, regionUVs, uvs) {
	      if (!region) throw new Error("Region not set.");
	      var n = uvs.length;
	      var u = region.u,
	        v = region.v,
	        width = 0,
	        height = 0;
	      if (region instanceof TextureAtlasRegion) {
	        var page = region.page;
	        var textureWidth = page.width,
	          textureHeight = page.height;
	        switch (region.degrees) {
	          case 90:
	            u -= (region.originalHeight - region.offsetY - region.height) / textureWidth;
	            v -= (region.originalWidth - region.offsetX - region.width) / textureHeight;
	            width = region.originalHeight / textureWidth;
	            height = region.originalWidth / textureHeight;
	            for (var i = 0; i < n; i += 2) {
	              uvs[i] = u + regionUVs[i + 1] * width;
	              uvs[i + 1] = v + (1 - regionUVs[i]) * height;
	            }
	            return;
	          case 180:
	            u -= (region.originalWidth - region.offsetX - region.width) / textureWidth;
	            v -= region.offsetY / textureHeight;
	            width = region.originalWidth / textureWidth;
	            height = region.originalHeight / textureHeight;
	            for (var _i = 0; _i < n; _i += 2) {
	              uvs[_i] = u + (1 - regionUVs[_i]) * width;
	              uvs[_i + 1] = v + (1 - regionUVs[_i + 1]) * height;
	            }
	            return;
	          case 270:
	            u -= region.offsetY / textureWidth;
	            v -= region.offsetX / textureHeight;
	            width = region.originalHeight / textureWidth;
	            height = region.originalWidth / textureHeight;
	            for (var _i2 = 0; _i2 < n; _i2 += 2) {
	              uvs[_i2] = u + (1 - regionUVs[_i2 + 1]) * width;
	              uvs[_i2 + 1] = v + regionUVs[_i2] * height;
	            }
	            return;
	          default:
	            u -= region.offsetX / textureWidth;
	            v -= (region.originalHeight - region.offsetY - region.height) / textureHeight;
	            width = region.originalWidth / textureWidth;
	            height = region.originalHeight / textureHeight;
	        }
	      } else if (!region) {
	        u = v = 0;
	        width = height = 1;
	      } else {
	        width = region.u2 - u;
	        height = region.v2 - v;
	      }
	      for (var _i3 = 0; _i3 < n; _i3 += 2) {
	        uvs[_i3] = u + regionUVs[_i3] * width;
	        uvs[_i3 + 1] = v + regionUVs[_i3 + 1] * height;
	      }
	    }
	  }]);
	}(VertexAttachment);

	var RegionAttachment = function (_Attachment) {
	  function RegionAttachment(name, sequence) {
	    var _this;
	    _classCallCheck(this, RegionAttachment);
	    _this = _callSuper(this, RegionAttachment, [name]);
	    _defineProperty(_this, "sequence", void 0);
	    _defineProperty(_this, "x", 0);
	    _defineProperty(_this, "y", 0);
	    _defineProperty(_this, "scaleX", 1);
	    _defineProperty(_this, "scaleY", 1);
	    _defineProperty(_this, "rotation", 0);
	    _defineProperty(_this, "width", 0);
	    _defineProperty(_this, "height", 0);
	    _defineProperty(_this, "path", void 0);
	    _defineProperty(_this, "color", new Color(1, 1, 1, 1));
	    _defineProperty(_this, "tempColor", new Color(1, 1, 1, 1));
	    _this.sequence = sequence;
	    return _this;
	  }
	  _inherits(RegionAttachment, _Attachment);
	  return _createClass(RegionAttachment, [{
	    key: "copy",
	    value: function copy() {
	      var copy = new RegionAttachment(this.name, this.sequence.copy());
	      copy.path = this.path;
	      copy.x = this.x;
	      copy.y = this.y;
	      copy.scaleX = this.scaleX;
	      copy.scaleY = this.scaleY;
	      copy.rotation = this.rotation;
	      copy.width = this.width;
	      copy.height = this.height;
	      copy.color.setFromColor(this.color);
	      return copy;
	    }
	  }, {
	    key: "computeWorldVertices",
	    value: function computeWorldVertices(slot, vertexOffsets, worldVertices, offset, stride) {
	      var bone = slot.bone.appliedPose;
	      var x = bone.worldX,
	        y = bone.worldY;
	      var a = bone.a,
	        b = bone.b,
	        c = bone.c,
	        d = bone.d;
	      var offsetX = vertexOffsets[0];
	      var offsetY = vertexOffsets[1];
	      worldVertices[offset] = offsetX * a + offsetY * b + x;
	      worldVertices[offset + 1] = offsetX * c + offsetY * d + y;
	      offset += stride;
	      offsetX = vertexOffsets[2];
	      offsetY = vertexOffsets[3];
	      worldVertices[offset] = offsetX * a + offsetY * b + x;
	      worldVertices[offset + 1] = offsetX * c + offsetY * d + y;
	      offset += stride;
	      offsetX = vertexOffsets[4];
	      offsetY = vertexOffsets[5];
	      worldVertices[offset] = offsetX * a + offsetY * b + x;
	      worldVertices[offset + 1] = offsetX * c + offsetY * d + y;
	      offset += stride;
	      offsetX = vertexOffsets[6];
	      offsetY = vertexOffsets[7];
	      worldVertices[offset] = offsetX * a + offsetY * b + x;
	      worldVertices[offset + 1] = offsetX * c + offsetY * d + y;
	    }
	  }, {
	    key: "getOffsets",
	    value: function getOffsets(pose) {
	      return this.sequence.offsets[this.sequence.resolveIndex(pose)];
	    }
	  }, {
	    key: "updateSequence",
	    value: function updateSequence() {
	      this.sequence.update(this);
	    }
	  }], [{
	    key: "computeUVs",
	    value: function computeUVs(region, x, y, scaleX, scaleY, rotation, width, height, offset, uvs) {
	      if (!region) throw new Error("Region not set.");
	      var regionScaleX = width / region.originalWidth * scaleX;
	      var regionScaleY = height / region.originalHeight * scaleY;
	      var localX = -width / 2 * scaleX + region.offsetX * regionScaleX;
	      var localY = -height / 2 * scaleY + region.offsetY * regionScaleY;
	      var localX2 = localX + region.width * regionScaleX;
	      var localY2 = localY + region.height * regionScaleY;
	      var radians = rotation * MathUtils.degRad;
	      var cos = Math.cos(radians);
	      var sin = Math.sin(radians);
	      var localXCos = localX * cos + x;
	      var localXSin = localX * sin;
	      var localYCos = localY * cos + y;
	      var localYSin = localY * sin;
	      var localX2Cos = localX2 * cos + x;
	      var localX2Sin = localX2 * sin;
	      var localY2Cos = localY2 * cos + y;
	      var localY2Sin = localY2 * sin;
	      offset[0] = localXCos - localYSin;
	      offset[1] = localYCos + localXSin;
	      offset[2] = localXCos - localY2Sin;
	      offset[3] = localY2Cos + localXSin;
	      offset[4] = localX2Cos - localY2Sin;
	      offset[5] = localY2Cos + localX2Sin;
	      offset[6] = localX2Cos - localYSin;
	      offset[7] = localYCos + localX2Sin;
	      if (region == null) {
	        uvs[0] = 0;
	        uvs[1] = 0;
	        uvs[2] = 0;
	        uvs[3] = 1;
	        uvs[4] = 1;
	        uvs[5] = 1;
	        uvs[6] = 1;
	        uvs[7] = 0;
	      } else {
	        uvs[1] = region.v2;
	        uvs[2] = region.u;
	        uvs[5] = region.v;
	        uvs[6] = region.u2;
	        if (region.degrees === 90) {
	          uvs[0] = region.u2;
	          uvs[3] = region.v2;
	          uvs[4] = region.u;
	          uvs[7] = region.v;
	        } else {
	          uvs[0] = region.u;
	          uvs[3] = region.v;
	          uvs[4] = region.u2;
	          uvs[7] = region.v2;
	        }
	      }
	    }
	  }]);
	}(Attachment);
	_defineProperty(RegionAttachment, "X1", 0);
	_defineProperty(RegionAttachment, "Y1", 1);
	_defineProperty(RegionAttachment, "C1R", 2);
	_defineProperty(RegionAttachment, "C1G", 3);
	_defineProperty(RegionAttachment, "C1B", 4);
	_defineProperty(RegionAttachment, "C1A", 5);
	_defineProperty(RegionAttachment, "U1", 6);
	_defineProperty(RegionAttachment, "V1", 7);
	_defineProperty(RegionAttachment, "X2", 8);
	_defineProperty(RegionAttachment, "Y2", 9);
	_defineProperty(RegionAttachment, "C2R", 10);
	_defineProperty(RegionAttachment, "C2G", 11);
	_defineProperty(RegionAttachment, "C2B", 12);
	_defineProperty(RegionAttachment, "C2A", 13);
	_defineProperty(RegionAttachment, "U2", 14);
	_defineProperty(RegionAttachment, "V2", 15);
	_defineProperty(RegionAttachment, "X3", 16);
	_defineProperty(RegionAttachment, "Y3", 17);
	_defineProperty(RegionAttachment, "C3R", 18);
	_defineProperty(RegionAttachment, "C3G", 19);
	_defineProperty(RegionAttachment, "C3B", 20);
	_defineProperty(RegionAttachment, "C3A", 21);
	_defineProperty(RegionAttachment, "U3", 22);
	_defineProperty(RegionAttachment, "V3", 23);
	_defineProperty(RegionAttachment, "X4", 24);
	_defineProperty(RegionAttachment, "Y4", 25);
	_defineProperty(RegionAttachment, "C4R", 26);
	_defineProperty(RegionAttachment, "C4G", 27);
	_defineProperty(RegionAttachment, "C4B", 28);
	_defineProperty(RegionAttachment, "C4A", 29);
	_defineProperty(RegionAttachment, "U4", 30);
	_defineProperty(RegionAttachment, "V4", 31);

	var Sequence = function () {
	  function Sequence(count, pathSuffix) {
	    _classCallCheck(this, Sequence);
	    _defineProperty(this, "id", Sequence.nextID());
	    _defineProperty(this, "regions", void 0);
	    _defineProperty(this, "pathSuffix", void 0);
	    _defineProperty(this, "uvs", void 0);
	    _defineProperty(this, "offsets", void 0);
	    _defineProperty(this, "start", 0);
	    _defineProperty(this, "digits", 0);
	    _defineProperty(this, "setupIndex", 0);
	    this.regions = new Array(count);
	    this.pathSuffix = pathSuffix;
	  }
	  return _createClass(Sequence, [{
	    key: "copy",
	    value: function copy() {
	      var regionCount = this.regions.length;
	      var copy = new Sequence(regionCount, this.pathSuffix);
	      Utils.arrayCopy(this.regions, 0, copy.regions, 0, regionCount);
	      copy.start = this.start;
	      copy.digits = this.digits;
	      copy.setupIndex = this.setupIndex;
	      if (this.uvs != null) {
	        var length = this.uvs[0].length;
	        copy.uvs = [];
	        for (var i = 0; i < regionCount; i++) {
	          copy.uvs[i] = Utils.newFloatArray(length);
	          Utils.arrayCopy(this.uvs[i], 0, copy.uvs[i], 0, length);
	        }
	      }
	      if (this.offsets != null) {
	        copy.offsets = [];
	        for (var _i = 0; _i < regionCount; _i++) {
	          copy.offsets[_i] = [];
	          Utils.arrayCopy(this.offsets[_i], 0, copy.offsets[_i], 0, 8);
	        }
	      }
	      return copy;
	    }
	  }, {
	    key: "update",
	    value: function update(attachment) {
	      var regionCount = this.regions.length;
	      if (attachment instanceof RegionAttachment) {
	        this.uvs = [];
	        this.offsets = [];
	        for (var i = 0; i < regionCount; i++) {
	          this.uvs[i] = Utils.newFloatArray(8);
	          this.offsets[i] = [];
	          RegionAttachment.computeUVs(this.regions[i], attachment.x, attachment.y, attachment.scaleX, attachment.scaleY, attachment.rotation, attachment.width, attachment.height, this.offsets[i], this.uvs[i]);
	        }
	      } else if (attachment instanceof MeshAttachment) {
	        var regionUVs = attachment.regionUVs;
	        this.uvs = [];
	        this.offsets = undefined;
	        for (var _i2 = 0; _i2 < regionCount; _i2++) {
	          this.uvs[_i2] = Utils.newFloatArray(regionUVs.length);
	          MeshAttachment.computeUVs(this.regions[_i2], regionUVs, this.uvs[_i2]);
	        }
	      }
	    }
	  }, {
	    key: "resolveIndex",
	    value: function resolveIndex(pose) {
	      var index = pose.sequenceIndex;
	      if (index === -1) index = this.setupIndex;
	      if (index >= this.regions.length) index = this.regions.length - 1;
	      return index;
	    }
	  }, {
	    key: "getUVs",
	    value: function getUVs(index) {
	      return this.uvs[index];
	    }
	  }, {
	    key: "hasPathSuffix",
	    value: function hasPathSuffix() {
	      return this.pathSuffix;
	    }
	  }, {
	    key: "getPath",
	    value: function getPath(basePath, index) {
	      if (!this.pathSuffix) return basePath;
	      var result = basePath;
	      var frame = (this.start + index).toString();
	      for (var i = this.digits - frame.length; i > 0; i--) result += "0";
	      result += frame;
	      return result;
	    }
	  }], [{
	    key: "nextID",
	    value: function nextID() {
	      return Sequence._nextID++;
	    }
	  }]);
	}();
	_defineProperty(Sequence, "_nextID", 0);
	var SequenceMode;
	(function (SequenceMode) {
	  SequenceMode[SequenceMode["hold"] = 0] = "hold";
	  SequenceMode[SequenceMode["once"] = 1] = "once";
	  SequenceMode[SequenceMode["loop"] = 2] = "loop";
	  SequenceMode[SequenceMode["pingpong"] = 3] = "pingpong";
	  SequenceMode[SequenceMode["onceReverse"] = 4] = "onceReverse";
	  SequenceMode[SequenceMode["loopReverse"] = 5] = "loopReverse";
	  SequenceMode[SequenceMode["pingpongReverse"] = 6] = "pingpongReverse";
	})(SequenceMode || (SequenceMode = {}));
	var SequenceModeValues = [SequenceMode.hold, SequenceMode.once, SequenceMode.loop, SequenceMode.pingpong, SequenceMode.onceReverse, SequenceMode.loopReverse, SequenceMode.pingpongReverse];

	var _DrawOrderTimeline;
	var Animation = function () {
	  function Animation(name, timelines, duration) {
	    _classCallCheck(this, Animation);
	    _defineProperty(this, "name", void 0);
	    _defineProperty(this, "timelines", []);
	    _defineProperty(this, "timelineIds", void 0);
	    _defineProperty(this, "bones", void 0);
	    _defineProperty(this, "color", new Color(1, 1, 1, 1));
	    _defineProperty(this, "duration", void 0);
	    if (!name) throw new Error("name cannot be null.");
	    this.name = name;
	    this.duration = duration;
	    this.timelineIds = new StringSet();
	    this.bones = [];
	    this.setTimelines(timelines);
	  }
	  return _createClass(Animation, [{
	    key: "setTimelines",
	    value: function setTimelines(timelines) {
	      if (!timelines) throw new Error("timelines cannot be null.");
	      this.timelines = timelines;
	      var n = timelines.length;
	      this.timelineIds.clear();
	      this.bones.length = 0;
	      var boneSet = new Set();
	      var items = timelines;
	      for (var i = 0; i < n; i++) {
	        var timeline = items[i];
	        this.timelineIds.addAll(timeline.propertyIds);
	        if (isBoneTimeline(timeline) && boneSet.add(timeline.boneIndex)) this.bones.push(timeline.boneIndex);
	      }
	    }
	  }, {
	    key: "hasTimeline",
	    value: function hasTimeline(ids) {
	      for (var i = 0; i < ids.length; i++) if (this.timelineIds.contains(ids[i])) return true;
	      return false;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, loop, events, alpha, from, add, out, appliedPose) {
	      if (!skeleton) throw new Error("skeleton cannot be null.");
	      if (loop && this.duration !== 0) {
	        time %= this.duration;
	        if (lastTime > 0) lastTime %= this.duration;
	      }
	      var timelines = this.timelines;
	      for (var i = 0, n = timelines.length; i < n; i++) timelines[i].apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose);
	    }
	  }]);
	}();
	var MixFrom;
	(function (MixFrom) {
	  MixFrom[MixFrom["current"] = 0] = "current";
	  MixFrom[MixFrom["setup"] = 1] = "setup";
	  MixFrom[MixFrom["first"] = 2] = "first";
	})(MixFrom || (MixFrom = {}));
	var Property;
	(function (Property) {
	  Property[Property["rotate"] = 0] = "rotate";
	  Property[Property["x"] = 1] = "x";
	  Property[Property["y"] = 2] = "y";
	  Property[Property["scaleX"] = 3] = "scaleX";
	  Property[Property["scaleY"] = 4] = "scaleY";
	  Property[Property["shearX"] = 5] = "shearX";
	  Property[Property["shearY"] = 6] = "shearY";
	  Property[Property["inherit"] = 7] = "inherit";
	  Property[Property["rgb"] = 8] = "rgb";
	  Property[Property["alpha"] = 9] = "alpha";
	  Property[Property["rgb2"] = 10] = "rgb2";
	  Property[Property["attachment"] = 11] = "attachment";
	  Property[Property["deform"] = 12] = "deform";
	  Property[Property["event"] = 13] = "event";
	  Property[Property["drawOrder"] = 14] = "drawOrder";
	  Property[Property["drawOrderFolder"] = 15] = "drawOrderFolder";
	  Property[Property["ikConstraint"] = 16] = "ikConstraint";
	  Property[Property["transformConstraint"] = 17] = "transformConstraint";
	  Property[Property["pathConstraintPosition"] = 18] = "pathConstraintPosition";
	  Property[Property["pathConstraintSpacing"] = 19] = "pathConstraintSpacing";
	  Property[Property["pathConstraintMix"] = 20] = "pathConstraintMix";
	  Property[Property["physicsConstraintInertia"] = 21] = "physicsConstraintInertia";
	  Property[Property["physicsConstraintStrength"] = 22] = "physicsConstraintStrength";
	  Property[Property["physicsConstraintDamping"] = 23] = "physicsConstraintDamping";
	  Property[Property["physicsConstraintMass"] = 24] = "physicsConstraintMass";
	  Property[Property["physicsConstraintWind"] = 25] = "physicsConstraintWind";
	  Property[Property["physicsConstraintGravity"] = 26] = "physicsConstraintGravity";
	  Property[Property["physicsConstraintMix"] = 27] = "physicsConstraintMix";
	  Property[Property["physicsConstraintReset"] = 28] = "physicsConstraintReset";
	  Property[Property["sequence"] = 29] = "sequence";
	  Property[Property["sliderTime"] = 30] = "sliderTime";
	  Property[Property["sliderMix"] = 31] = "sliderMix";
	})(Property || (Property = {}));
	var Timeline = function () {
	  function Timeline(frameCount) {
	    _classCallCheck(this, Timeline);
	    _defineProperty(this, "propertyIds", void 0);
	    _defineProperty(this, "frames", void 0);
	    _defineProperty(this, "additive", false);
	    _defineProperty(this, "instant", false);
	    for (var _len = arguments.length, propertyIds = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	      propertyIds[_key - 1] = arguments[_key];
	    }
	    this.propertyIds = propertyIds;
	    this.frames = Utils.newFloatArray(frameCount * this.getFrameEntries());
	  }
	  return _createClass(Timeline, [{
	    key: "getPropertyIds",
	    value: function getPropertyIds() {
	      return this.propertyIds;
	    }
	  }, {
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 1;
	    }
	  }, {
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length / this.getFrameEntries();
	    }
	  }, {
	    key: "getDuration",
	    value: function getDuration() {
	      return this.frames[this.frames.length - this.getFrameEntries()];
	    }
	  }], [{
	    key: "search",
	    value: function search(frames, time) {
	      var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
	      var n = frames.length;
	      for (var i = step; i < n; i += step) if (frames[i] > time) return i - step;
	      return n - step;
	    }
	  }]);
	}();
	function isSlotTimeline(obj) {
	  return _typeof(obj) === 'object' && obj !== null && typeof obj.slotIndex === 'number';
	}
	var CurveTimeline = function (_Timeline2) {
	  function CurveTimeline(frameCount, bezierCount) {
	    var _this;
	    _classCallCheck(this, CurveTimeline);
	    for (var _len2 = arguments.length, propertyIds = new Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
	      propertyIds[_key2 - 2] = arguments[_key2];
	    }
	    _this = _callSuper(this, CurveTimeline, [frameCount].concat(propertyIds));
	    _defineProperty(_this, "curves", void 0);
	    _this.curves = Utils.newFloatArray(frameCount + bezierCount * 18);
	    _this.curves[frameCount - 1] = 1;
	    return _this;
	  }
	  _inherits(CurveTimeline, _Timeline2);
	  return _createClass(CurveTimeline, [{
	    key: "setLinear",
	    value: function setLinear(frame) {
	      this.curves[frame] = 0;
	    }
	  }, {
	    key: "setStepped",
	    value: function setStepped(frame) {
	      this.curves[frame] = 1;
	    }
	  }, {
	    key: "shrink",
	    value: function shrink(bezierCount) {
	      var size = this.getFrameCount() + bezierCount * 18;
	      if (this.curves.length > size) {
	        var newCurves = Utils.newFloatArray(size);
	        Utils.arrayCopy(this.curves, 0, newCurves, 0, size);
	        this.curves = newCurves;
	      }
	    }
	  }, {
	    key: "setBezier",
	    value: function setBezier(bezier, frame, value, time1, value1, cx1, cy1, cx2, cy2, time2, value2) {
	      var curves = this.curves;
	      var i = this.getFrameCount() + bezier * 18;
	      if (value === 0) curves[frame] = 2 + i;
	      var tmpx = (time1 - cx1 * 2 + cx2) * 0.03,
	        tmpy = (value1 - cy1 * 2 + cy2) * 0.03;
	      var dddx = ((cx1 - cx2) * 3 - time1 + time2) * 0.006,
	        dddy = ((cy1 - cy2) * 3 - value1 + value2) * 0.006;
	      var ddx = tmpx * 2 + dddx,
	        ddy = tmpy * 2 + dddy;
	      var dx = (cx1 - time1) * 0.3 + tmpx + dddx * 0.16666667,
	        dy = (cy1 - value1) * 0.3 + tmpy + dddy * 0.16666667;
	      var x = time1 + dx,
	        y = value1 + dy;
	      for (var n = i + 18; i < n; i += 2) {
	        curves[i] = x;
	        curves[i + 1] = y;
	        dx += ddx;
	        dy += ddy;
	        ddx += dddx;
	        ddy += dddy;
	        x += dx;
	        y += dy;
	      }
	    }
	  }, {
	    key: "getBezierValue",
	    value: function getBezierValue(time, frameIndex, valueOffset, i) {
	      var curves = this.curves;
	      if (curves[i] > time) {
	        var _x = this.frames[frameIndex],
	          _y = this.frames[frameIndex + valueOffset];
	        return _y + (time - _x) / (curves[i] - _x) * (curves[i + 1] - _y);
	      }
	      var n = i + 18;
	      for (i += 2; i < n; i += 2) {
	        if (curves[i] >= time) {
	          var _x2 = curves[i - 2],
	            _y2 = curves[i - 1];
	          return _y2 + (time - _x2) / (curves[i] - _x2) * (curves[i + 1] - _y2);
	        }
	      }
	      frameIndex += this.getFrameEntries();
	      var x = curves[n - 2],
	        y = curves[n - 1];
	      return y + (time - x) / (this.frames[frameIndex] - x) * (this.frames[frameIndex + valueOffset] - y);
	    }
	  }]);
	}(Timeline);
	var CurveTimeline1 = function (_CurveTimeline2) {
	  function CurveTimeline1(frameCount, bezierCount, propertyId) {
	    _classCallCheck(this, CurveTimeline1);
	    return _callSuper(this, CurveTimeline1, [frameCount, bezierCount, propertyId]);
	  }
	  _inherits(CurveTimeline1, _CurveTimeline2);
	  return _createClass(CurveTimeline1, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 2;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, value) {
	      frame <<= 1;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = value;
	    }
	  }, {
	    key: "getCurveValue",
	    value: function getCurveValue(time) {
	      var frames = this.frames;
	      var i = frames.length - 2;
	      for (var ii = 2; ii <= i; ii += 2) {
	        if (frames[ii] > time) {
	          i = ii - 2;
	          break;
	        }
	      }
	      var curveType = this.curves[i >> 1];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i],
	              value = frames[i + 1];
	            return value + (time - before) / (frames[i + 2] - before) * (frames[i + 2 + 1] - value);
	          }
	        case 1:
	          return frames[i + 1];
	      }
	      return this.getBezierValue(time, i, 1, curveType - 2);
	    }
	  }, {
	    key: "getRelativeValue",
	    value: function getRelativeValue(time, alpha, from, add, current, setup) {
	      if (time < this.frames[0]) return CurveTimeline1.beforeFirstKey(from, alpha, current, setup);
	      var value = this.getCurveValue(time);
	      return from === MixFrom.setup ? setup + value * alpha : current + (add ? value : value + setup - current) * alpha;
	    }
	  }, {
	    key: "getAbsoluteValue",
	    value: function getAbsoluteValue(time, alpha, from, add, current, setup, value) {
	      if (value === undefined) return this.getAbsoluteValue1(time, alpha, from, add, current, setup);else return this.getAbsoluteValue2(time, alpha, from, add, current, setup, value);
	    }
	  }, {
	    key: "getAbsoluteValue1",
	    value: function getAbsoluteValue1(time, alpha, from, add, current, setup) {
	      if (time < this.frames[0]) return CurveTimeline1.beforeFirstKey(from, alpha, current, setup);
	      var value = this.getCurveValue(time);
	      return from === MixFrom.setup ? setup + (add ? value : value - setup) * alpha : current + (add ? value : value - current) * alpha;
	    }
	  }, {
	    key: "getAbsoluteValue2",
	    value: function getAbsoluteValue2(time, alpha, from, add, current, setup, value) {
	      if (time < this.frames[0]) return CurveTimeline1.beforeFirstKey(from, alpha, current, setup);
	      return from === MixFrom.setup ? setup + (add ? value : value - setup) * alpha : current + (add ? value : value - current) * alpha;
	    }
	  }, {
	    key: "getScaleValue",
	    value: function getScaleValue(time, alpha, from, add, out, current, setup) {
	      if (time < this.frames[0]) return CurveTimeline1.beforeFirstKey(from, alpha, current, setup);
	      var value = this.getCurveValue(time) * setup;
	      if (alpha === 1 && !add) return value;
	      var base = from === MixFrom.setup ? setup : current;
	      if (add) return base + (value - setup) * alpha;
	      if (out) return base + (Math.abs(value) * Math.sign(base) - base) * alpha;
	      base = Math.abs(base) * Math.sign(value);
	      return base + (value - base) * alpha;
	    }
	  }], [{
	    key: "beforeFirstKey",
	    value: function beforeFirstKey(from, alpha, current, setup) {
	      switch (from) {
	        case MixFrom.setup:
	          return setup;
	        case MixFrom.first:
	          return current + (setup - current) * alpha;
	        case MixFrom.current:
	          return current;
	      }
	    }
	  }]);
	}(CurveTimeline);
	function isBoneTimeline(obj) {
	  return _typeof(obj) === 'object' && obj !== null && typeof obj.boneIndex === 'number';
	}
	var BoneTimeline1 = function (_CurveTimeline3) {
	  function BoneTimeline1(frameCount, bezierCount, boneIndex, property) {
	    var _this2;
	    _classCallCheck(this, BoneTimeline1);
	    _this2 = _callSuper(this, BoneTimeline1, [frameCount, bezierCount, "".concat(property, "|").concat(boneIndex)]);
	    _defineProperty(_this2, "boneIndex", void 0);
	    _this2.boneIndex = boneIndex;
	    _this2.additive = true;
	    return _this2;
	  }
	  _inherits(BoneTimeline1, _CurveTimeline3);
	  return _createClass(BoneTimeline1, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var bone = skeleton.bones[this.boneIndex];
	      if (bone.active) this.apply1(appliedPose ? bone.appliedPose : bone.pose, bone.data.setupPose, time, alpha, from, add, out);
	    }
	  }]);
	}(CurveTimeline1);
	var BoneTimeline2 = function (_CurveTimeline4) {
	  function BoneTimeline2(frameCount, bezierCount, boneIndex, property1, property2) {
	    var _this3;
	    _classCallCheck(this, BoneTimeline2);
	    _this3 = _callSuper(this, BoneTimeline2, [frameCount, bezierCount, "".concat(property1, "|").concat(boneIndex), "".concat(property2, "|").concat(boneIndex)]);
	    _defineProperty(_this3, "boneIndex", void 0);
	    _this3.boneIndex = boneIndex;
	    _this3.additive = true;
	    return _this3;
	  }
	  _inherits(BoneTimeline2, _CurveTimeline4);
	  return _createClass(BoneTimeline2, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 3;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, value1, value2) {
	      frame *= 3;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = value1;
	      this.frames[frame + 2] = value2;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var bone = skeleton.bones[this.boneIndex];
	      if (bone.active) this.apply1(appliedPose ? bone.appliedPose : bone.pose, bone.data.setupPose, time, alpha, from, add, out);
	    }
	  }]);
	}(CurveTimeline);
	var RotateTimeline = function (_BoneTimeline3) {
	  function RotateTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, RotateTimeline);
	    return _callSuper(this, RotateTimeline, [frameCount, bezierCount, boneIndex, Property.rotate]);
	  }
	  _inherits(RotateTimeline, _BoneTimeline3);
	  return _createClass(RotateTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.rotation = this.getRelativeValue(time, alpha, from, add, pose.rotation, setup.rotation);
	    }
	  }]);
	}(BoneTimeline1);
	var TranslateTimeline = function (_BoneTimeline4) {
	  function TranslateTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, TranslateTimeline);
	    return _callSuper(this, TranslateTimeline, [frameCount, bezierCount, boneIndex, Property.x, Property.y]);
	  }
	  _inherits(TranslateTimeline, _BoneTimeline4);
	  return _createClass(TranslateTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      var frames = this.frames;
	      if (time < frames[0]) {
	        switch (from) {
	          case MixFrom.setup:
	            pose.x = setup.x;
	            pose.y = setup.y;
	            break;
	          case MixFrom.first:
	            pose.x += (setup.x - pose.x) * alpha;
	            pose.y += (setup.y - pose.y) * alpha;
	            break;
	        }
	        return;
	      }
	      var x = 0,
	        y = 0;
	      var i = Timeline.search(frames, time, 3);
	      var curveType = this.curves[i / 3];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            x = frames[i + 1];
	            y = frames[i + 2];
	            var t = (time - before) / (frames[i + 3] - before);
	            x += (frames[i + 3 + 1] - x) * t;
	            y += (frames[i + 3 + 2] - y) * t;
	            break;
	          }
	        case 1:
	          x = frames[i + 1];
	          y = frames[i + 2];
	          break;
	        default:
	          x = this.getBezierValue(time, i, 1, curveType - 2);
	          y = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	      }
	      if (from === MixFrom.setup) {
	        pose.x = setup.x + x * alpha;
	        pose.y = setup.y + y * alpha;
	      } else if (add) {
	        pose.x += x * alpha;
	        pose.y += y * alpha;
	      } else {
	        pose.x += (setup.x + x - pose.x) * alpha;
	        pose.y += (setup.y + y - pose.y) * alpha;
	      }
	    }
	  }]);
	}(BoneTimeline2);
	var TranslateXTimeline = function (_BoneTimeline5) {
	  function TranslateXTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, TranslateXTimeline);
	    return _callSuper(this, TranslateXTimeline, [frameCount, bezierCount, boneIndex, Property.x]);
	  }
	  _inherits(TranslateXTimeline, _BoneTimeline5);
	  return _createClass(TranslateXTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.x = this.getRelativeValue(time, alpha, from, add, pose.x, setup.x);
	    }
	  }]);
	}(BoneTimeline1);
	var TranslateYTimeline = function (_BoneTimeline6) {
	  function TranslateYTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, TranslateYTimeline);
	    return _callSuper(this, TranslateYTimeline, [frameCount, bezierCount, boneIndex, Property.y]);
	  }
	  _inherits(TranslateYTimeline, _BoneTimeline6);
	  return _createClass(TranslateYTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.y = this.getRelativeValue(time, alpha, from, add, pose.y, setup.y);
	    }
	  }]);
	}(BoneTimeline1);
	var ScaleTimeline = function (_BoneTimeline7) {
	  function ScaleTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ScaleTimeline);
	    return _callSuper(this, ScaleTimeline, [frameCount, bezierCount, boneIndex, Property.scaleX, Property.scaleY]);
	  }
	  _inherits(ScaleTimeline, _BoneTimeline7);
	  return _createClass(ScaleTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      var frames = this.frames;
	      if (time < frames[0]) {
	        switch (from) {
	          case MixFrom.setup:
	            pose.scaleX = setup.scaleX;
	            pose.scaleY = setup.scaleY;
	            break;
	          case MixFrom.first:
	            pose.scaleX += (setup.scaleX - pose.scaleX) * alpha;
	            pose.scaleY += (setup.scaleY - pose.scaleY) * alpha;
	            break;
	        }
	        return;
	      }
	      var x, y;
	      var i = Timeline.search(frames, time, 3);
	      var curveType = this.curves[i / 3];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            x = frames[i + 1];
	            y = frames[i + 2];
	            var t = (time - before) / (frames[i + 3] - before);
	            x += (frames[i + 3 + 1] - x) * t;
	            y += (frames[i + 3 + 2] - y) * t;
	            break;
	          }
	        case 1:
	          x = frames[i + 1];
	          y = frames[i + 2];
	          break;
	        default:
	          x = this.getBezierValue(time, i, 1, curveType - 2);
	          y = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	      }
	      x *= setup.scaleX;
	      y *= setup.scaleY;
	      if (alpha === 1 && !add) {
	        pose.scaleX = x;
	        pose.scaleY = y;
	      } else {
	        var bx = 0,
	          by = 0;
	        if (from === MixFrom.setup) {
	          bx = setup.scaleX;
	          by = setup.scaleY;
	        } else {
	          bx = pose.scaleX;
	          by = pose.scaleY;
	        }
	        if (add) {
	          pose.scaleX = bx + (x - setup.scaleX) * alpha;
	          pose.scaleY = by + (y - setup.scaleY) * alpha;
	        } else if (out) {
	          pose.scaleX = bx + (Math.abs(x) * Math.sign(bx) - bx) * alpha;
	          pose.scaleY = by + (Math.abs(y) * Math.sign(by) - by) * alpha;
	        } else {
	          bx = Math.abs(bx) * Math.sign(x);
	          by = Math.abs(by) * Math.sign(y);
	          pose.scaleX = bx + (x - bx) * alpha;
	          pose.scaleY = by + (y - by) * alpha;
	        }
	      }
	    }
	  }]);
	}(BoneTimeline2);
	var ScaleXTimeline = function (_BoneTimeline8) {
	  function ScaleXTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ScaleXTimeline);
	    return _callSuper(this, ScaleXTimeline, [frameCount, bezierCount, boneIndex, Property.scaleX]);
	  }
	  _inherits(ScaleXTimeline, _BoneTimeline8);
	  return _createClass(ScaleXTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.scaleX = this.getScaleValue(time, alpha, from, add, out, pose.scaleX, setup.scaleX);
	    }
	  }]);
	}(BoneTimeline1);
	var ScaleYTimeline = function (_BoneTimeline9) {
	  function ScaleYTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ScaleYTimeline);
	    return _callSuper(this, ScaleYTimeline, [frameCount, bezierCount, boneIndex, Property.scaleY]);
	  }
	  _inherits(ScaleYTimeline, _BoneTimeline9);
	  return _createClass(ScaleYTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.scaleY = this.getScaleValue(time, alpha, from, add, out, pose.scaleY, setup.scaleY);
	    }
	  }]);
	}(BoneTimeline1);
	var ShearTimeline = function (_BoneTimeline0) {
	  function ShearTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ShearTimeline);
	    return _callSuper(this, ShearTimeline, [frameCount, bezierCount, boneIndex, Property.shearX, Property.shearY]);
	  }
	  _inherits(ShearTimeline, _BoneTimeline0);
	  return _createClass(ShearTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      var frames = this.frames;
	      if (time < frames[0]) {
	        switch (from) {
	          case MixFrom.setup:
	            pose.shearX = setup.shearX;
	            pose.shearY = setup.shearY;
	            break;
	          case MixFrom.first:
	            pose.shearX += (setup.shearX - pose.shearX) * alpha;
	            pose.shearY += (setup.shearY - pose.shearY) * alpha;
	            break;
	        }
	        return;
	      }
	      var x = 0,
	        y = 0;
	      var i = Timeline.search(frames, time, 3);
	      var curveType = this.curves[i / 3];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            x = frames[i + 1];
	            y = frames[i + 2];
	            var t = (time - before) / (frames[i + 3] - before);
	            x += (frames[i + 3 + 1] - x) * t;
	            y += (frames[i + 3 + 2] - y) * t;
	            break;
	          }
	        case 1:
	          x = frames[i + 1];
	          y = frames[i + 2];
	          break;
	        default:
	          x = this.getBezierValue(time, i, 1, curveType - 2);
	          y = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	      }
	      if (from === MixFrom.setup) {
	        pose.shearX = setup.shearX + x * alpha;
	        pose.shearY = setup.shearY + y * alpha;
	      } else if (add) {
	        pose.shearX += x * alpha;
	        pose.shearY += y * alpha;
	      } else {
	        pose.shearX += (setup.shearX + x - pose.shearX) * alpha;
	        pose.shearY += (setup.shearY + y - pose.shearY) * alpha;
	      }
	    }
	  }]);
	}(BoneTimeline2);
	var ShearXTimeline = function (_BoneTimeline1) {
	  function ShearXTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ShearXTimeline);
	    return _callSuper(this, ShearXTimeline, [frameCount, bezierCount, boneIndex, Property.shearX]);
	  }
	  _inherits(ShearXTimeline, _BoneTimeline1);
	  return _createClass(ShearXTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.shearX = this.getRelativeValue(time, alpha, from, add, pose.shearX, setup.shearX);
	    }
	  }]);
	}(BoneTimeline1);
	var ShearYTimeline = function (_BoneTimeline10) {
	  function ShearYTimeline(frameCount, bezierCount, boneIndex) {
	    _classCallCheck(this, ShearYTimeline);
	    return _callSuper(this, ShearYTimeline, [frameCount, bezierCount, boneIndex, Property.shearY]);
	  }
	  _inherits(ShearYTimeline, _BoneTimeline10);
	  return _createClass(ShearYTimeline, [{
	    key: "apply1",
	    value: function apply1(pose, setup, time, alpha, from, add, out) {
	      pose.shearY = this.getRelativeValue(time, alpha, from, add, pose.shearY, setup.shearY);
	    }
	  }]);
	}(BoneTimeline1);
	var InheritTimeline = function (_Timeline3) {
	  function InheritTimeline(frameCount, boneIndex) {
	    var _this4;
	    _classCallCheck(this, InheritTimeline);
	    _this4 = _callSuper(this, InheritTimeline, [frameCount, "".concat(Property.inherit, "|").concat(boneIndex)]);
	    _defineProperty(_this4, "boneIndex", void 0);
	    _this4.boneIndex = boneIndex;
	    _this4.instant = true;
	    return _this4;
	  }
	  _inherits(InheritTimeline, _Timeline3);
	  return _createClass(InheritTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 2;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, inherit) {
	      frame *= 2;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = inherit;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var bone = skeleton.bones[this.boneIndex];
	      if (!bone.active) return;
	      var pose = appliedPose ? bone.appliedPose : bone.pose;
	      if (out) {
	        if (from !== MixFrom.current) pose.inherit = bone.data.setupPose.inherit;
	      } else {
	        var frames = this.frames;
	        if (time < frames[0]) {
	          if (from !== MixFrom.current) pose.inherit = bone.data.setupPose.inherit;
	        } else pose.inherit = this.frames[Timeline.search(frames, time, 2) + 1];
	      }
	    }
	  }]);
	}(Timeline);
	var SlotCurveTimeline = function (_CurveTimeline5) {
	  function SlotCurveTimeline(frameCount, bezierCount, slotIndex) {
	    var _this5;
	    _classCallCheck(this, SlotCurveTimeline);
	    for (var _len3 = arguments.length, propertyIds = new Array(_len3 > 3 ? _len3 - 3 : 0), _key3 = 3; _key3 < _len3; _key3++) {
	      propertyIds[_key3 - 3] = arguments[_key3];
	    }
	    _this5 = _callSuper(this, SlotCurveTimeline, [frameCount, bezierCount].concat(propertyIds));
	    _defineProperty(_this5, "slotIndex", void 0);
	    _this5.slotIndex = slotIndex;
	    return _this5;
	  }
	  _inherits(SlotCurveTimeline, _CurveTimeline5);
	  return _createClass(SlotCurveTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var slot = skeleton.slots[this.slotIndex];
	      if (slot.bone.active) this.apply1(slot, appliedPose ? slot.appliedPose : slot.pose, time, alpha, from, add);
	    }
	  }]);
	}(CurveTimeline);
	var RGBATimeline = function (_SlotCurveTimeline2) {
	  function RGBATimeline(frameCount, bezierCount, slotIndex) {
	    _classCallCheck(this, RGBATimeline);
	    return _callSuper(this, RGBATimeline, [frameCount, bezierCount, slotIndex, "".concat(Property.rgb, "|").concat(slotIndex), "".concat(Property.alpha, "|").concat(slotIndex)]);
	  }
	  _inherits(RGBATimeline, _SlotCurveTimeline2);
	  return _createClass(RGBATimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 5;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, r, g, b, a) {
	      frame *= 5;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = r;
	      this.frames[frame + 2] = g;
	      this.frames[frame + 3] = b;
	      this.frames[frame + 4] = a;
	    }
	  }, {
	    key: "apply1",
	    value: function apply1(slot, pose, time, alpha, from, add) {
	      var color = pose.color;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = slot.data.setupPose.color;
	        switch (from) {
	          case MixFrom.setup:
	            color.setFromColor(setup);
	            break;
	          case MixFrom.first:
	            color.add((setup.r - color.r) * alpha, (setup.g - color.g) * alpha, (setup.b - color.b) * alpha, (setup.a - color.a) * alpha);
	            break;
	        }
	        return;
	      }
	      var r = 0,
	        g = 0,
	        b = 0,
	        a = 0;
	      var i = Timeline.search(frames, time, 5);
	      var curveType = this.curves[i / 5];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            r = frames[i + 1];
	            g = frames[i + 2];
	            b = frames[i + 3];
	            a = frames[i + 4];
	            var t = (time - before) / (frames[i + 5] - before);
	            r += (frames[i + 5 + 1] - r) * t;
	            g += (frames[i + 5 + 2] - g) * t;
	            b += (frames[i + 5 + 3] - b) * t;
	            a += (frames[i + 5 + 4] - a) * t;
	            break;
	          }
	        case 1:
	          r = frames[i + 1];
	          g = frames[i + 2];
	          b = frames[i + 3];
	          a = frames[i + 4];
	          break;
	        default:
	          r = this.getBezierValue(time, i, 1, curveType - 2);
	          g = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          b = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	          a = this.getBezierValue(time, i, 4, curveType + 18 * 3 - 2);
	      }
	      if (alpha === 1) color.set(r, g, b, a);else {
	        if (from === MixFrom.setup) {
	          var _setup = slot.data.setupPose.color;
	          color.set(_setup.r + (r - _setup.r) * alpha, _setup.g + (g - _setup.g) * alpha, _setup.b + (b - _setup.b) * alpha, _setup.a + (a - _setup.a) * alpha);
	        } else color.add((r - color.r) * alpha, (g - color.g) * alpha, (b - color.b) * alpha, (a - color.a) * alpha);
	      }
	    }
	  }]);
	}(SlotCurveTimeline);
	var RGBTimeline = function (_SlotCurveTimeline3) {
	  function RGBTimeline(frameCount, bezierCount, slotIndex) {
	    _classCallCheck(this, RGBTimeline);
	    return _callSuper(this, RGBTimeline, [frameCount, bezierCount, slotIndex, "".concat(Property.rgb, "|").concat(slotIndex)]);
	  }
	  _inherits(RGBTimeline, _SlotCurveTimeline3);
	  return _createClass(RGBTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 4;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, r, g, b) {
	      frame <<= 2;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = r;
	      this.frames[frame + 2] = g;
	      this.frames[frame + 3] = b;
	    }
	  }, {
	    key: "apply1",
	    value: function apply1(slot, pose, time, alpha, from, add) {
	      var color = pose.color;
	      var r = 0,
	        g = 0,
	        b = 0;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = slot.data.setupPose.color;
	        switch (from) {
	          case MixFrom.setup:
	            {
	              color.r = setup.r;
	              color.g = setup.g;
	              color.b = setup.b;
	              break;
	            }
	          case MixFrom.first:
	            {
	              color.r += (setup.r - color.r) * alpha;
	              color.g += (setup.g - color.g) * alpha;
	              color.b += (setup.b - color.b) * alpha;
	              break;
	            }
	        }
	        return;
	      }
	      var i = Timeline.search(frames, time, 4);
	      var curveType = this.curves[i >> 2];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            r = frames[i + 1];
	            g = frames[i + 2];
	            b = frames[i + 3];
	            var t = (time - before) / (frames[i + 4] - before);
	            r += (frames[i + 4 + 1] - r) * t;
	            g += (frames[i + 4 + 2] - g) * t;
	            b += (frames[i + 4 + 3] - b) * t;
	            break;
	          }
	        case 1:
	          r = frames[i + 1];
	          g = frames[i + 2];
	          b = frames[i + 3];
	          break;
	        default:
	          r = this.getBezierValue(time, i, 1, curveType - 2);
	          g = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          b = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	      }
	      if (alpha !== 1) {
	        if (from === MixFrom.setup) {
	          var _setup2 = slot.data.setupPose.color;
	          r = _setup2.r + (r - _setup2.r) * alpha;
	          g = _setup2.g + (g - _setup2.g) * alpha;
	          b = _setup2.b + (b - _setup2.b) * alpha;
	        } else {
	          r = color.r + (r - color.r) * alpha;
	          g = color.g + (g - color.g) * alpha;
	          b = color.b + (b - color.b) * alpha;
	        }
	      }
	      color.r = r < 0 ? 0 : r > 1 ? 1 : r;
	      color.g = g < 0 ? 0 : g > 1 ? 1 : g;
	      color.b = b < 0 ? 0 : b > 1 ? 1 : b;
	    }
	  }]);
	}(SlotCurveTimeline);
	var AlphaTimeline = function (_CurveTimeline6) {
	  function AlphaTimeline(frameCount, bezierCount, slotIndex) {
	    var _this6;
	    _classCallCheck(this, AlphaTimeline);
	    _this6 = _callSuper(this, AlphaTimeline, [frameCount, bezierCount, "".concat(Property.alpha, "|").concat(slotIndex)]);
	    _defineProperty(_this6, "slotIndex", 0);
	    _this6.slotIndex = slotIndex;
	    return _this6;
	  }
	  _inherits(AlphaTimeline, _CurveTimeline6);
	  return _createClass(AlphaTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var slot = skeleton.slots[this.slotIndex];
	      if (!slot.bone.active) return;
	      var color = (appliedPose ? slot.appliedPose : slot.pose).color;
	      var a = 0;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = slot.data.setupPose.color.a;
	        switch (from) {
	          case MixFrom.setup:
	            color.a = setup;
	            break;
	          case MixFrom.first:
	            color.a += (setup - color.a) * alpha;
	            break;
	        }
	        return;
	      }
	      a = this.getCurveValue(time);
	      if (alpha !== 1) {
	        if (from === MixFrom.setup) {
	          var _setup3 = slot.data.setupPose.color;
	          a = _setup3.a + (a - _setup3.a) * alpha;
	        } else a = color.a + (a - color.a) * alpha;
	      }
	      color.a = a < 0 ? 0 : a > 1 ? 1 : a;
	    }
	  }]);
	}(CurveTimeline1);
	var RGBA2Timeline = function (_SlotCurveTimeline4) {
	  function RGBA2Timeline(frameCount, bezierCount, slotIndex) {
	    _classCallCheck(this, RGBA2Timeline);
	    return _callSuper(this, RGBA2Timeline, [frameCount, bezierCount, slotIndex, "".concat(Property.rgb, "|").concat(slotIndex), "".concat(Property.alpha, "|").concat(slotIndex), "".concat(Property.rgb2, "|").concat(slotIndex)]);
	  }
	  _inherits(RGBA2Timeline, _SlotCurveTimeline4);
	  return _createClass(RGBA2Timeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 8;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, r, g, b, a, r2, g2, b2) {
	      frame <<= 3;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = r;
	      this.frames[frame + 2] = g;
	      this.frames[frame + 3] = b;
	      this.frames[frame + 4] = a;
	      this.frames[frame + 5] = r2;
	      this.frames[frame + 6] = g2;
	      this.frames[frame + 7] = b2;
	    }
	  }, {
	    key: "apply1",
	    value: function apply1(slot, pose, time, alpha, from, add) {
	      var light = pose.color,
	        dark = pose.darkColor;
	      var r2 = 0,
	        g2 = 0,
	        b2 = 0;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = slot.data.setupPose;
	        var setupLight = setup.color,
	          setupDark = setup.darkColor;
	        switch (from) {
	          case MixFrom.setup:
	            {
	              light.setFromColor(setupLight);
	              dark.r = setupDark.r;
	              dark.g = setupDark.g;
	              dark.b = setupDark.b;
	              break;
	            }
	          case MixFrom.first:
	            {
	              light.add((setupLight.r - light.r) * alpha, (setupLight.g - light.g) * alpha, (setupLight.b - light.b) * alpha, (setupLight.a - light.a) * alpha);
	              dark.r += (setupDark.r - dark.r) * alpha;
	              dark.g += (setupDark.g - dark.g) * alpha;
	              dark.b += (setupDark.b - dark.b) * alpha;
	              break;
	            }
	        }
	        return;
	      }
	      var r = 0,
	        g = 0,
	        b = 0,
	        a = 0;
	      var i = Timeline.search(frames, time, 8);
	      var curveType = this.curves[i >> 3];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            r = frames[i + 1];
	            g = frames[i + 2];
	            b = frames[i + 3];
	            a = frames[i + 4];
	            r2 = frames[i + 5];
	            g2 = frames[i + 6];
	            b2 = frames[i + 7];
	            var t = (time - before) / (frames[i + 8] - before);
	            r += (frames[i + 8 + 1] - r) * t;
	            g += (frames[i + 8 + 2] - g) * t;
	            b += (frames[i + 8 + 3] - b) * t;
	            a += (frames[i + 8 + 4] - a) * t;
	            r2 += (frames[i + 8 + 5] - r2) * t;
	            g2 += (frames[i + 8 + 6] - g2) * t;
	            b2 += (frames[i + 8 + 7] - b2) * t;
	            break;
	          }
	        case 1:
	          r = frames[i + 1];
	          g = frames[i + 2];
	          b = frames[i + 3];
	          a = frames[i + 4];
	          r2 = frames[i + 5];
	          g2 = frames[i + 6];
	          b2 = frames[i + 7];
	          break;
	        default:
	          r = this.getBezierValue(time, i, 1, curveType - 2);
	          g = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          b = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	          a = this.getBezierValue(time, i, 4, curveType + 18 * 3 - 2);
	          r2 = this.getBezierValue(time, i, 5, curveType + 18 * 4 - 2);
	          g2 = this.getBezierValue(time, i, 6, curveType + 18 * 5 - 2);
	          b2 = this.getBezierValue(time, i, 7, curveType + 18 * 6 - 2);
	      }
	      if (alpha === 1) light.set(r, g, b, a);else if (from === MixFrom.setup) {
	        var setupPose = slot.data.setupPose;
	        var _setup4 = setupPose.color;
	        light.set(_setup4.r + (r - _setup4.r) * alpha, _setup4.g + (g - _setup4.g) * alpha, _setup4.b + (b - _setup4.b) * alpha, _setup4.a + (a - _setup4.a) * alpha);
	        _setup4 = setupPose.darkColor;
	        r2 = _setup4.r + (r2 - _setup4.r) * alpha;
	        g2 = _setup4.g + (g2 - _setup4.g) * alpha;
	        b2 = _setup4.b + (b2 - _setup4.b) * alpha;
	      } else {
	        light.add((r - light.r) * alpha, (g - light.g) * alpha, (b - light.b) * alpha, (a - light.a) * alpha);
	        r2 = dark.r + (r2 - dark.r) * alpha;
	        g2 = dark.g + (g2 - dark.g) * alpha;
	        b2 = dark.b + (b2 - dark.b) * alpha;
	      }
	      dark.r = r2 < 0 ? 0 : r2 > 1 ? 1 : r2;
	      dark.g = g2 < 0 ? 0 : g2 > 1 ? 1 : g2;
	      dark.b = b2 < 0 ? 0 : b2 > 1 ? 1 : b2;
	    }
	  }]);
	}(SlotCurveTimeline);
	var RGB2Timeline = function (_SlotCurveTimeline5) {
	  function RGB2Timeline(frameCount, bezierCount, slotIndex) {
	    _classCallCheck(this, RGB2Timeline);
	    return _callSuper(this, RGB2Timeline, [frameCount, bezierCount, slotIndex, "".concat(Property.rgb, "|").concat(slotIndex), "".concat(Property.rgb2, "|").concat(slotIndex)]);
	  }
	  _inherits(RGB2Timeline, _SlotCurveTimeline5);
	  return _createClass(RGB2Timeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 7;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, r, g, b, r2, g2, b2) {
	      frame *= 7;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = r;
	      this.frames[frame + 2] = g;
	      this.frames[frame + 3] = b;
	      this.frames[frame + 4] = r2;
	      this.frames[frame + 5] = g2;
	      this.frames[frame + 6] = b2;
	    }
	  }, {
	    key: "apply1",
	    value: function apply1(slot, pose, time, alpha, from, add) {
	      var light = pose.color,
	        dark = pose.darkColor;
	      var r = 0,
	        g = 0,
	        b = 0,
	        r2 = 0,
	        g2 = 0,
	        b2 = 0;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = slot.data.setupPose;
	        var setupLight = setup.color,
	          setupDark = setup.darkColor;
	        switch (from) {
	          case MixFrom.setup:
	            light.r = setupLight.r;
	            light.g = setupLight.g;
	            light.b = setupLight.b;
	            dark.r = setupDark.r;
	            dark.g = setupDark.g;
	            dark.b = setupDark.b;
	            break;
	          case MixFrom.first:
	            light.r += (setupLight.r - light.r) * alpha;
	            light.g += (setupLight.g - light.g) * alpha;
	            light.b += (setupLight.b - light.b) * alpha;
	            dark.r += (setupDark.r - dark.r) * alpha;
	            dark.g += (setupDark.g - dark.g) * alpha;
	            dark.b += (setupDark.b - dark.b) * alpha;
	            break;
	        }
	        return;
	      }
	      var i = Timeline.search(frames, time, 7);
	      var curveType = this.curves[i / 7];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            r = frames[i + 1];
	            g = frames[i + 2];
	            b = frames[i + 3];
	            r2 = frames[i + 4];
	            g2 = frames[i + 5];
	            b2 = frames[i + 6];
	            var t = (time - before) / (frames[i + 7] - before);
	            r += (frames[i + 7 + 1] - r) * t;
	            g += (frames[i + 7 + 2] - g) * t;
	            b += (frames[i + 7 + 3] - b) * t;
	            r2 += (frames[i + 7 + 4] - r2) * t;
	            g2 += (frames[i + 7 + 5] - g2) * t;
	            b2 += (frames[i + 7 + 6] - b2) * t;
	            break;
	          }
	        case 1:
	          r = frames[i + 1];
	          g = frames[i + 2];
	          b = frames[i + 3];
	          r2 = frames[i + 4];
	          g2 = frames[i + 5];
	          b2 = frames[i + 6];
	          break;
	        default:
	          r = this.getBezierValue(time, i, 1, curveType - 2);
	          g = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          b = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	          r2 = this.getBezierValue(time, i, 4, curveType + 18 * 3 - 2);
	          g2 = this.getBezierValue(time, i, 5, curveType + 18 * 4 - 2);
	          b2 = this.getBezierValue(time, i, 6, curveType + 18 * 5 - 2);
	      }
	      if (alpha !== 1) {
	        if (from === MixFrom.setup) {
	          var setupPose = slot.data.setupPose;
	          var _setup5 = setupPose.color;
	          r = _setup5.r + (r - _setup5.r) * alpha;
	          g = _setup5.g + (g - _setup5.g) * alpha;
	          b = _setup5.b + (b - _setup5.b) * alpha;
	          _setup5 = setupPose.darkColor;
	          r2 = _setup5.r + (r2 - _setup5.r) * alpha;
	          g2 = _setup5.g + (g2 - _setup5.g) * alpha;
	          b2 = _setup5.b + (b2 - _setup5.b) * alpha;
	        } else {
	          r = light.r + (r - light.r) * alpha;
	          g = light.g + (g - light.g) * alpha;
	          b = light.b + (b - light.b) * alpha;
	          r2 = dark.r + (r2 - dark.r) * alpha;
	          g2 = dark.g + (g2 - dark.g) * alpha;
	          b2 = dark.b + (b2 - dark.b) * alpha;
	        }
	      }
	      light.r = r < 0 ? 0 : r > 1 ? 1 : r;
	      light.g = g < 0 ? 0 : g > 1 ? 1 : g;
	      light.b = b < 0 ? 0 : b > 1 ? 1 : b;
	      dark.r = r2 < 0 ? 0 : r2 > 1 ? 1 : r2;
	      dark.g = g2 < 0 ? 0 : g2 > 1 ? 1 : g2;
	      dark.b = b2 < 0 ? 0 : b2 > 1 ? 1 : b2;
	    }
	  }]);
	}(SlotCurveTimeline);
	var AttachmentTimeline = function (_Timeline4) {
	  function AttachmentTimeline(frameCount, slotIndex) {
	    var _this7;
	    _classCallCheck(this, AttachmentTimeline);
	    _this7 = _callSuper(this, AttachmentTimeline, [frameCount, "".concat(Property.attachment, "|").concat(slotIndex)]);
	    _defineProperty(_this7, "slotIndex", 0);
	    _defineProperty(_this7, "attachmentNames", void 0);
	    _this7.slotIndex = slotIndex;
	    _this7.attachmentNames = new Array(frameCount);
	    _this7.instant = true;
	    return _this7;
	  }
	  _inherits(AttachmentTimeline, _Timeline4);
	  return _createClass(AttachmentTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, attachmentName) {
	      this.frames[frame] = time;
	      this.attachmentNames[frame] = attachmentName;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var slot = skeleton.slots[this.slotIndex];
	      if (!slot.bone.active) return;
	      var pose = appliedPose ? slot.appliedPose : slot.pose;
	      if (out || time < this.frames[0]) {
	        if (from !== MixFrom.current) this.setAttachment(skeleton, pose, slot.data.attachmentName);
	      } else this.setAttachment(skeleton, pose, this.attachmentNames[Timeline.search(this.frames, time)]);
	    }
	  }, {
	    key: "setAttachment",
	    value: function setAttachment(skeleton, pose, attachmentName) {
	      pose.setAttachment(!attachmentName ? null : skeleton.getAttachment(this.slotIndex, attachmentName));
	    }
	  }]);
	}(Timeline);
	var DeformTimeline = function (_CurveTimeline7) {
	  function DeformTimeline(frameCount, bezierCount, slotIndex, attachment) {
	    var _this8;
	    _classCallCheck(this, DeformTimeline);
	    _this8 = _callSuper(this, DeformTimeline, [frameCount, bezierCount, "".concat(Property.deform, "|").concat(slotIndex, "|").concat(attachment.id)]);
	    _defineProperty(_this8, "slotIndex", void 0);
	    _defineProperty(_this8, "attachment", void 0);
	    _defineProperty(_this8, "vertices", void 0);
	    _this8.slotIndex = slotIndex;
	    _this8.attachment = attachment;
	    _this8.vertices = new Array(frameCount);
	    _this8.additive = true;
	    return _this8;
	  }
	  _inherits(DeformTimeline, _CurveTimeline7);
	  return _createClass(DeformTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, vertices) {
	      this.frames[frame] = time;
	      this.vertices[frame] = vertices;
	    }
	  }, {
	    key: "setBezier",
	    value: function setBezier(bezier, frame, value, time1, value1, cx1, cy1, cx2, cy2, time2, value2) {
	      var curves = this.curves;
	      var i = this.getFrameCount() + bezier * 18;
	      if (value === 0) curves[frame] = 2 + i;
	      var tmpx = (time1 - cx1 * 2 + cx2) * 0.03,
	        tmpy = cy2 * 0.03 - cy1 * 0.06;
	      var dddx = ((cx1 - cx2) * 3 - time1 + time2) * 0.006,
	        dddy = (cy1 - cy2 + 0.33333333) * 0.018;
	      var ddx = tmpx * 2 + dddx,
	        ddy = tmpy * 2 + dddy;
	      var dx = (cx1 - time1) * 0.3 + tmpx + dddx * 0.16666667,
	        dy = cy1 * 0.3 + tmpy + dddy * 0.16666667;
	      var x = time1 + dx,
	        y = dy;
	      for (var n = i + 18; i < n; i += 2) {
	        curves[i] = x;
	        curves[i + 1] = y;
	        dx += ddx;
	        dy += ddy;
	        ddx += dddx;
	        ddy += dddy;
	        x += dx;
	        y += dy;
	      }
	    }
	  }, {
	    key: "getCurvePercent",
	    value: function getCurvePercent(time, frame) {
	      var curves = this.curves;
	      var i = curves[frame];
	      switch (i) {
	        case 0:
	          {
	            var _x3 = this.frames[frame];
	            return (time - _x3) / (this.frames[frame + this.getFrameEntries()] - _x3);
	          }
	        case 1:
	          return 0;
	      }
	      i -= 2;
	      if (curves[i] > time) {
	        var _x4 = this.frames[frame];
	        return curves[i + 1] * (time - _x4) / (curves[i] - _x4);
	      }
	      var n = i + 18;
	      for (i += 2; i < n; i += 2) {
	        if (curves[i] >= time) {
	          var _x5 = curves[i - 2],
	            _y3 = curves[i - 1];
	          return _y3 + (time - _x5) / (curves[i] - _x5) * (curves[i + 1] - _y3);
	        }
	      }
	      var x = curves[n - 2],
	        y = curves[n - 1];
	      return y + (1 - y) * (time - x) / (this.frames[frame + this.getFrameEntries()] - x);
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var slots = skeleton.slots;
	      if (!this.attachment.isTimelineActive(slots, this.slotIndex, appliedPose)) return;
	      var timelineSlots = this.attachment.timelineSlots;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        this.applyBeforeFirst(slots[this.slotIndex], appliedPose, alpha, from);
	        var _iterator = _createForOfIteratorHelper(timelineSlots),
	          _step;
	        try {
	          for (_iterator.s(); !(_step = _iterator.n()).done;) {
	            var slotIndex = _step.value;
	            this.applyBeforeFirst(slots[slotIndex], appliedPose, alpha, from);
	          }
	        } catch (err) {
	          _iterator.e(err);
	        } finally {
	          _iterator.f();
	        }
	        return;
	      }
	      var v1, v2;
	      var percent;
	      if (time >= frames[frames.length - 1]) {
	        percent = 0;
	        v1 = this.vertices[frames.length - 1];
	        v2 = null;
	      } else {
	        var frame = Timeline.search(frames, time);
	        percent = this.getCurvePercent(time, frame);
	        v1 = this.vertices[frame];
	        v2 = this.vertices[frame + 1];
	      }
	      var vertexCount = this.vertices[0].length;
	      this.applyToSlot(slots[this.slotIndex], appliedPose, v1, v2, percent, vertexCount, alpha, from, add);
	      var _iterator2 = _createForOfIteratorHelper(timelineSlots),
	        _step2;
	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var _slotIndex = _step2.value;
	          this.applyToSlot(slots[_slotIndex], appliedPose, v1, v2, percent, vertexCount, alpha, from, add);
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	    }
	  }, {
	    key: "applyBeforeFirst",
	    value: function applyBeforeFirst(slot, appliedPose, alpha, from) {
	      if (!slot.bone.active) return;
	      var pose = appliedPose ? slot.appliedPose : slot.pose;
	      if (pose.attachment == null || pose.attachment.timelineAttachment !== this.attachment) return;
	      var deformArray = pose.deform;
	      if (deformArray.length === 0) from = MixFrom.setup;
	      switch (from) {
	        case MixFrom.setup:
	          deformArray.length = 0;
	          break;
	        case MixFrom.first:
	          {
	            if (alpha === 1) {
	              deformArray.length = 0;
	              return;
	            }
	            var vertexCount = this.vertices[0].length;
	            deformArray.length = vertexCount;
	            var deform = deformArray;
	            var vertexAttachment = pose.attachment;
	            if (vertexAttachment.bones === null) {
	              var setupVertices = vertexAttachment.vertices;
	              for (var i = 0; i < vertexCount; i++) deform[i] += (setupVertices[i] - deform[i]) * alpha;
	            } else {
	              alpha = 1 - alpha;
	              for (var _i = 0; _i < vertexCount; _i++) deform[_i] *= alpha;
	            }
	          }
	      }
	    }
	  }, {
	    key: "applyToSlot",
	    value: function applyToSlot(slot, appliedPose, v1, v2, percent, vertexCount, alpha, from, add) {
	      if (!slot.bone.active) return;
	      var pose = appliedPose ? slot.appliedPose : slot.pose;
	      if (pose.attachment === null || pose.attachment.timelineAttachment !== this.attachment) return;
	      var vertexAttachment = pose.attachment;
	      var deform = pose.deform;
	      if (deform.length === 0) from = MixFrom.setup;
	      var fromSetup = from === MixFrom.setup;
	      deform.length = vertexCount;
	      if (v2 === null) {
	        if (alpha === 1) {
	          if (add && !fromSetup) {
	            if (!vertexAttachment.bones) {
	              var setupVertices = vertexAttachment.vertices;
	              for (var i = 0; i < vertexCount; i++) deform[i] += v1[i] - setupVertices[i];
	            } else {
	              for (var _i2 = 0; _i2 < vertexCount; _i2++) deform[_i2] += v1[_i2];
	            }
	          } else Utils.arrayCopy(v1, 0, deform, 0, vertexCount);
	        } else if (fromSetup) {
	          if (!vertexAttachment.bones) {
	            var _setupVertices = vertexAttachment.vertices;
	            for (var _i3 = 0; _i3 < vertexCount; _i3++) {
	              var setup = _setupVertices[_i3];
	              deform[_i3] = setup + (v1[_i3] - setup) * alpha;
	            }
	          } else {
	            for (var _i4 = 0; _i4 < vertexCount; _i4++) deform[_i4] = v1[_i4] * alpha;
	          }
	        } else if (add) {
	          if (!vertexAttachment.bones) {
	            var _setupVertices2 = vertexAttachment.vertices;
	            for (var _i5 = 0; _i5 < vertexCount; _i5++) deform[_i5] += (v1[_i5] - _setupVertices2[_i5]) * alpha;
	          } else {
	            for (var _i6 = 0; _i6 < vertexCount; _i6++) deform[_i6] += v1[_i6] * alpha;
	          }
	        } else {
	          for (var _i7 = 0; _i7 < vertexCount; _i7++) deform[_i7] += (v1[_i7] - deform[_i7]) * alpha;
	        }
	      } else {
	        if (alpha === 1) {
	          if (add && !fromSetup) {
	            if (!vertexAttachment.bones) {
	              var _setupVertices3 = vertexAttachment.vertices;
	              for (var _i8 = 0; _i8 < vertexCount; _i8++) {
	                var prev = v1[_i8];
	                deform[_i8] += prev + (v2[_i8] - prev) * percent - _setupVertices3[_i8];
	              }
	            } else {
	              for (var _i9 = 0; _i9 < vertexCount; _i9++) {
	                var _prev = v1[_i9];
	                deform[_i9] += _prev + (v2[_i9] - _prev) * percent;
	              }
	            }
	          } else if (percent === 0) Utils.arrayCopy(v1, 0, deform, 0, vertexCount);else {
	            for (var _i0 = 0; _i0 < vertexCount; _i0++) {
	              var _prev2 = v1[_i0];
	              deform[_i0] = _prev2 + (v2[_i0] - _prev2) * percent;
	            }
	          }
	        } else if (fromSetup) {
	          if (!vertexAttachment.bones) {
	            var _setupVertices4 = vertexAttachment.vertices;
	            for (var _i1 = 0; _i1 < vertexCount; _i1++) {
	              var _prev3 = v1[_i1],
	                _setup6 = _setupVertices4[_i1];
	              deform[_i1] = _setup6 + (_prev3 + (v2[_i1] - _prev3) * percent - _setup6) * alpha;
	            }
	          } else {
	            for (var _i10 = 0; _i10 < vertexCount; _i10++) {
	              var _prev4 = v1[_i10];
	              deform[_i10] = (_prev4 + (v2[_i10] - _prev4) * percent) * alpha;
	            }
	          }
	        } else if (add) {
	          if (!vertexAttachment.bones) {
	            var _setupVertices5 = vertexAttachment.vertices;
	            for (var _i11 = 0; _i11 < vertexCount; _i11++) {
	              var _prev5 = v1[_i11];
	              deform[_i11] += (_prev5 + (v2[_i11] - _prev5) * percent - _setupVertices5[_i11]) * alpha;
	            }
	          } else {
	            for (var _i12 = 0; _i12 < vertexCount; _i12++) {
	              var _prev6 = v1[_i12];
	              deform[_i12] += (_prev6 + (v2[_i12] - _prev6) * percent) * alpha;
	            }
	          }
	        } else {
	          for (var _i13 = 0; _i13 < vertexCount; _i13++) {
	            var _prev7 = v1[_i13];
	            deform[_i13] += (_prev7 + (v2[_i13] - _prev7) * percent - deform[_i13]) * alpha;
	          }
	        }
	      }
	    }
	  }]);
	}(CurveTimeline);
	var SequenceTimeline = function (_Timeline5) {
	  function SequenceTimeline(frameCount, slotIndex, attachment) {
	    var _this9;
	    _classCallCheck(this, SequenceTimeline);
	    _this9 = _callSuper(this, SequenceTimeline, [frameCount, "".concat(Property.sequence, "|").concat(slotIndex, "|").concat(attachment.sequence.id)]);
	    _defineProperty(_this9, "slotIndex", void 0);
	    _defineProperty(_this9, "attachment", void 0);
	    _this9.slotIndex = slotIndex;
	    _this9.attachment = attachment;
	    _this9.instant = true;
	    return _this9;
	  }
	  _inherits(SequenceTimeline, _Timeline5);
	  return _createClass(SequenceTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return SequenceTimeline.ENTRIES;
	    }
	  }, {
	    key: "getSlotIndex",
	    value: function getSlotIndex() {
	      return this.slotIndex;
	    }
	  }, {
	    key: "getAttachment",
	    value: function getAttachment() {
	      return this.attachment;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, mode, index, delay) {
	      var frames = this.frames;
	      frame *= SequenceTimeline.ENTRIES;
	      frames[frame] = time;
	      frames[frame + SequenceTimeline.MODE] = mode | index << 4;
	      frames[frame + SequenceTimeline.DELAY] = delay;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var slots = skeleton.slots;
	      if (!this.attachment.isTimelineActive(slots, this.slotIndex, appliedPose)) return;
	      var timelineSlots = this.attachment.timelineSlots;
	      var frames = this.frames;
	      if (out || time < frames[0]) {
	        if (from !== MixFrom.current) {
	          this.setupPose(slots[this.slotIndex], appliedPose);
	          var _iterator3 = _createForOfIteratorHelper(timelineSlots),
	            _step3;
	          try {
	            for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	              var slotIndex = _step3.value;
	              this.setupPose(slots[slotIndex], appliedPose);
	            }
	          } catch (err) {
	            _iterator3.e(err);
	          } finally {
	            _iterator3.f();
	          }
	        }
	        return;
	      }
	      var i = Timeline.search(frames, time, SequenceTimeline.ENTRIES);
	      var before = frames[i];
	      var modeAndIndex = frames[i + SequenceTimeline.MODE];
	      var delay = frames[i + SequenceTimeline.DELAY];
	      this.applyToSlot(slots[this.slotIndex], appliedPose, time, before, modeAndIndex, delay);
	      var _iterator4 = _createForOfIteratorHelper(timelineSlots),
	        _step4;
	      try {
	        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	          var _slotIndex2 = _step4.value;
	          this.applyToSlot(slots[_slotIndex2], appliedPose, time, before, modeAndIndex, delay);
	        }
	      } catch (err) {
	        _iterator4.e(err);
	      } finally {
	        _iterator4.f();
	      }
	    }
	  }, {
	    key: "setupPose",
	    value: function setupPose(slot, appliedPose) {
	      if (!slot.bone.active) return;
	      var pose = appliedPose ? slot.appliedPose : slot.pose;
	      if (pose.attachment === null || pose.attachment.timelineAttachment !== this.attachment) return;
	      pose.sequenceIndex = -1;
	    }
	  }, {
	    key: "applyToSlot",
	    value: function applyToSlot(slot, appliedPose, time, before, modeAndIndex, delay) {
	      if (!slot.bone.active) return;
	      var pose = appliedPose ? slot.appliedPose : slot.pose;
	      if (pose.attachment === null || pose.attachment.timelineAttachment !== this.attachment) return;
	      var index = modeAndIndex >> 4,
	        count = pose.attachment.sequence.regions.length;
	      var mode = SequenceModeValues[modeAndIndex & 0xf];
	      if (mode !== SequenceMode.hold) {
	        index += (time - before) / delay + 0.00001 | 0;
	        switch (mode) {
	          case SequenceMode.once:
	            index = Math.min(count - 1, index);
	            break;
	          case SequenceMode.loop:
	            index %= count;
	            break;
	          case SequenceMode.pingpong:
	            {
	              var n = (count << 1) - 2;
	              index = n === 0 ? 0 : index % n;
	              if (index >= count) index = n - index;
	              break;
	            }
	          case SequenceMode.onceReverse:
	            index = Math.max(count - 1 - index, 0);
	            break;
	          case SequenceMode.loopReverse:
	            index = count - 1 - index % count;
	            break;
	          case SequenceMode.pingpongReverse:
	            {
	              var _n = (count << 1) - 2;
	              index = _n === 0 ? 0 : (index + count - 1) % _n;
	              if (index >= count) index = _n - index;
	            }
	        }
	      }
	      pose.sequenceIndex = index;
	    }
	  }]);
	}(Timeline);
	_defineProperty(SequenceTimeline, "ENTRIES", 3);
	_defineProperty(SequenceTimeline, "MODE", 1);
	_defineProperty(SequenceTimeline, "DELAY", 2);
	var EventTimeline = function (_Timeline6) {
	  function EventTimeline(frameCount) {
	    var _this0;
	    _classCallCheck(this, EventTimeline);
	    _this0 = _callSuper(this, EventTimeline, [frameCount].concat(_toConsumableArray(EventTimeline.propertyIds)));
	    _defineProperty(_this0, "events", void 0);
	    _this0.events = new Array(frameCount);
	    _this0.instant = true;
	    return _this0;
	  }
	  _inherits(EventTimeline, _Timeline6);
	  return _createClass(EventTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, event) {
	      this.frames[frame] = event.time;
	      this.events[frame] = event;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      if (!firedEvents) return;
	      var frames = this.frames;
	      var frameCount = this.frames.length;
	      if (lastTime > time) {
	        this.apply(null, lastTime, Number.MAX_VALUE, firedEvents, 0, from, false, false, false);
	        lastTime = -1;
	      } else if (lastTime >= frames[frameCount - 1]) return;
	      if (time < frames[0]) return;
	      var i = 0;
	      if (lastTime < frames[0]) i = 0;else {
	        i = Timeline.search(frames, lastTime) + 1;
	        var frameTime = frames[i];
	        while (i > 0) {
	          if (frames[i - 1] !== frameTime) break;
	          i--;
	        }
	      }
	      for (; i < frameCount && time >= frames[i]; i++) firedEvents.push(this.events[i]);
	    }
	  }]);
	}(Timeline);
	_defineProperty(EventTimeline, "propertyIds", ["".concat(Property.event)]);
	var DrawOrderTimeline = function (_Timeline7) {
	  function DrawOrderTimeline(frameCount) {
	    var _this1;
	    _classCallCheck(this, DrawOrderTimeline);
	    _this1 = _callSuper(this, DrawOrderTimeline, [frameCount].concat(_toConsumableArray(DrawOrderTimeline.propertyIds)));
	    _defineProperty(_this1, "drawOrders", void 0);
	    _this1.drawOrders = new Array(frameCount);
	    _this1.instant = true;
	    return _this1;
	  }
	  _inherits(DrawOrderTimeline, _Timeline7);
	  return _createClass(DrawOrderTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, drawOrder) {
	      this.frames[frame] = time;
	      this.drawOrders[frame] = drawOrder;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var pose = appliedPose ? skeleton.drawOrder.appliedPose : skeleton.drawOrder.pose;
	      var setup = skeleton.slots;
	      if (out || time < this.frames[0]) {
	        if (from !== MixFrom.current) Utils.arrayCopy(setup, 0, pose, 0, skeleton.slots.length);
	        return;
	      }
	      var order = this.drawOrders[Timeline.search(this.frames, time)];
	      if (!order) Utils.arrayCopy(setup, 0, pose, 0, skeleton.slots.length);else {
	        for (var i = 0, n = order.length; i < n; i++) pose[i] = setup[order[i]];
	      }
	    }
	  }]);
	}(Timeline);
	_DrawOrderTimeline = DrawOrderTimeline;
	_defineProperty(DrawOrderTimeline, "propertyID", "".concat(Property.drawOrder));
	_defineProperty(DrawOrderTimeline, "propertyIds", [_DrawOrderTimeline.propertyID]);
	var DrawOrderFolderTimeline = function (_Timeline8) {
	  function DrawOrderFolderTimeline(frameCount, slots, slotCount) {
	    var _this10;
	    _classCallCheck(this, DrawOrderFolderTimeline);
	    _this10 = _callSuper(this, DrawOrderFolderTimeline, [frameCount].concat(_toConsumableArray(DrawOrderFolderTimeline.propertyIds(slots))));
	    _defineProperty(_this10, "slots", void 0);
	    _defineProperty(_this10, "inFolder", void 0);
	    _defineProperty(_this10, "drawOrders", void 0);
	    _this10.slots = slots;
	    _this10.drawOrders = new Array(frameCount);
	    _this10.inFolder = new Array(slotCount);
	    var _iterator5 = _createForOfIteratorHelper(slots),
	      _step5;
	    try {
	      for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
	        var i = _step5.value;
	        _this10.inFolder[i] = true;
	      }
	    } catch (err) {
	      _iterator5.e(err);
	    } finally {
	      _iterator5.f();
	    }
	    _this10.instant = true;
	    return _this10;
	  }
	  _inherits(DrawOrderFolderTimeline, _Timeline8);
	  return _createClass(DrawOrderFolderTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "getSlots",
	    value: function getSlots() {
	      return this.slots;
	    }
	  }, {
	    key: "getDrawOrders",
	    value: function getDrawOrders() {
	      return this.drawOrders;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, drawOrder) {
	      this.frames[frame] = time;
	      this.drawOrders[frame] = drawOrder;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, events, alpha, from, add, out, appliedPose) {
	      var pose = appliedPose ? skeleton.drawOrder.appliedPose : skeleton.drawOrder.pose;
	      var setup = skeleton.slots;
	      if (out || time < this.frames[0]) {
	        if (from !== MixFrom.current) this.setup(pose, setup);
	      } else {
	        var order = this.drawOrders[Timeline.search(this.frames, time)];
	        if (!order) this.setup(pose, setup);else {
	          var inFolder = this.inFolder;
	          var slots = this.slots;
	          for (var i = 0, found = 0, done = slots.length;; i++) {
	            if (inFolder[pose[i].data.index]) {
	              pose[i] = setup[slots[order[found]]];
	              if (++found === done) break;
	            }
	          }
	        }
	      }
	    }
	  }, {
	    key: "setup",
	    value: function setup(pose, _setup7) {
	      var inFolder = this.inFolder,
	        slots = this.slots;
	      for (var i = 0, found = 0, done = slots.length;; i++) {
	        if (inFolder[pose[i].data.index]) {
	          pose[i] = _setup7[slots[found]];
	          if (++found === done) break;
	        }
	      }
	    }
	  }], [{
	    key: "propertyIds",
	    value: function propertyIds(slots) {
	      var n = slots.length;
	      var ids = new Array(n);
	      for (var i = 0; i < n; i++) ids[i] = "".concat(DrawOrderFolderTimeline.propertyID, "|").concat(slots[i]);
	      return ids;
	    }
	  }]);
	}(Timeline);
	_defineProperty(DrawOrderFolderTimeline, "propertyID", "".concat(Property.drawOrderFolder));
	function isConstraintTimeline(obj) {
	  return _typeof(obj) === 'object' && obj !== null && typeof obj.constraintIndex === 'number';
	}
	var IkConstraintTimeline = function (_CurveTimeline8) {
	  function IkConstraintTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this11;
	    _classCallCheck(this, IkConstraintTimeline);
	    _this11 = _callSuper(this, IkConstraintTimeline, [frameCount, bezierCount, "".concat(Property.ikConstraint, "|").concat(constraintIndex)]);
	    _defineProperty(_this11, "constraintIndex", 0);
	    _this11.constraintIndex = constraintIndex;
	    return _this11;
	  }
	  _inherits(IkConstraintTimeline, _CurveTimeline8);
	  return _createClass(IkConstraintTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 6;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, mix, softness, bendDirection, compress, stretch) {
	      frame *= 6;
	      this.frames[frame] = time;
	      this.frames[frame + 1] = mix;
	      this.frames[frame + 2] = softness;
	      this.frames[frame + 3] = bendDirection;
	      this.frames[frame + 4] = compress ? 1 : 0;
	      this.frames[frame + 5] = stretch ? 1 : 0;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (!constraint.active) return;
	      var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = constraint.data.setupPose;
	        switch (from) {
	          case MixFrom.setup:
	            {
	              pose.mix = setup.mix;
	              pose.softness = setup.softness;
	              pose.bendDirection = setup.bendDirection;
	              pose.compress = setup.compress;
	              pose.stretch = setup.stretch;
	              break;
	            }
	          case MixFrom.first:
	            {
	              pose.mix += (setup.mix - pose.mix) * alpha;
	              pose.softness += (setup.softness - pose.softness) * alpha;
	              pose.bendDirection = setup.bendDirection;
	              pose.compress = setup.compress;
	              pose.stretch = setup.stretch;
	              break;
	            }
	        }
	        return;
	      }
	      var mix = 0,
	        softness = 0;
	      var i = Timeline.search(frames, time, 6);
	      var curveType = this.curves[i / 6];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            mix = frames[i + 1];
	            softness = frames[i + 2];
	            var t = (time - before) / (frames[i + 6] - before);
	            mix += (frames[i + 6 + 1] - mix) * t;
	            softness += (frames[i + 6 + 2] - softness) * t;
	            break;
	          }
	        case 1:
	          mix = frames[i + 1];
	          softness = frames[i + 2];
	          break;
	        default:
	          mix = this.getBezierValue(time, i, 1, curveType - 2);
	          softness = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	      }
	      var base = from === MixFrom.setup ? constraint.data.setupPose : pose;
	      pose.mix = base.mix + (mix - base.mix) * alpha;
	      pose.softness = base.softness + (softness - base.softness) * alpha;
	      if (out) {
	        if (from === MixFrom.setup) {
	          pose.bendDirection = base.bendDirection;
	          pose.compress = base.compress;
	          pose.stretch = base.stretch;
	        }
	      } else {
	        pose.bendDirection = frames[i + 3];
	        pose.compress = frames[i + 4] !== 0;
	        pose.stretch = frames[i + 5] !== 0;
	      }
	    }
	  }]);
	}(CurveTimeline);
	var TransformConstraintTimeline = function (_CurveTimeline9) {
	  function TransformConstraintTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this12;
	    _classCallCheck(this, TransformConstraintTimeline);
	    _this12 = _callSuper(this, TransformConstraintTimeline, [frameCount, bezierCount, "".concat(Property.transformConstraint, "|").concat(constraintIndex)]);
	    _defineProperty(_this12, "constraintIndex", 0);
	    _this12.constraintIndex = constraintIndex;
	    _this12.additive = true;
	    return _this12;
	  }
	  _inherits(TransformConstraintTimeline, _CurveTimeline9);
	  return _createClass(TransformConstraintTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 7;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY) {
	      var frames = this.frames;
	      frame *= 7;
	      frames[frame] = time;
	      frames[frame + 1] = mixRotate;
	      frames[frame + 2] = mixX;
	      frames[frame + 3] = mixY;
	      frames[frame + 4] = mixScaleX;
	      frames[frame + 5] = mixScaleY;
	      frames[frame + 6] = mixShearY;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (!constraint.active) return;
	      var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = constraint.data.setupPose;
	        switch (from) {
	          case MixFrom.setup:
	            {
	              pose.mixRotate = setup.mixRotate;
	              pose.mixX = setup.mixX;
	              pose.mixY = setup.mixY;
	              pose.mixScaleX = setup.mixScaleX;
	              pose.mixScaleY = setup.mixScaleY;
	              pose.mixShearY = setup.mixShearY;
	              break;
	            }
	          case MixFrom.first:
	            {
	              pose.mixRotate += (setup.mixRotate - pose.mixRotate) * alpha;
	              pose.mixX += (setup.mixX - pose.mixX) * alpha;
	              pose.mixY += (setup.mixY - pose.mixY) * alpha;
	              pose.mixScaleX += (setup.mixScaleX - pose.mixScaleX) * alpha;
	              pose.mixScaleY += (setup.mixScaleY - pose.mixScaleY) * alpha;
	              pose.mixShearY += (setup.mixShearY - pose.mixShearY) * alpha;
	              break;
	            }
	        }
	        return;
	      }
	      var rotate, x, y, scaleX, scaleY, shearY;
	      var i = Timeline.search(frames, time, 7);
	      var curveType = this.curves[i / 7];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            rotate = frames[i + 1];
	            x = frames[i + 2];
	            y = frames[i + 3];
	            scaleX = frames[i + 4];
	            scaleY = frames[i + 5];
	            shearY = frames[i + 6];
	            var t = (time - before) / (frames[i + 7] - before);
	            rotate += (frames[i + 7 + 1] - rotate) * t;
	            x += (frames[i + 7 + 2] - x) * t;
	            y += (frames[i + 7 + 3] - y) * t;
	            scaleX += (frames[i + 7 + 4] - scaleX) * t;
	            scaleY += (frames[i + 7 + 5] - scaleY) * t;
	            shearY += (frames[i + 7 + 6] - shearY) * t;
	            break;
	          }
	        case 1:
	          rotate = frames[i + 1];
	          x = frames[i + 2];
	          y = frames[i + 3];
	          scaleX = frames[i + 4];
	          scaleY = frames[i + 5];
	          shearY = frames[i + 6];
	          break;
	        default:
	          rotate = this.getBezierValue(time, i, 1, curveType - 2);
	          x = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          y = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	          scaleX = this.getBezierValue(time, i, 4, curveType + 18 * 3 - 2);
	          scaleY = this.getBezierValue(time, i, 5, curveType + 18 * 4 - 2);
	          shearY = this.getBezierValue(time, i, 6, curveType + 18 * 5 - 2);
	      }
	      var base = from === MixFrom.setup ? constraint.data.setupPose : pose;
	      if (add) {
	        pose.mixRotate = base.mixRotate + rotate * alpha;
	        pose.mixX = base.mixX + x * alpha;
	        pose.mixY = base.mixY + y * alpha;
	        pose.mixScaleX = base.mixScaleX + scaleX * alpha;
	        pose.mixScaleY = base.mixScaleY + scaleY * alpha;
	        pose.mixShearY = base.mixShearY + shearY * alpha;
	      } else {
	        pose.mixRotate = base.mixRotate + (rotate - base.mixRotate) * alpha;
	        pose.mixX = base.mixX + (x - base.mixX) * alpha;
	        pose.mixY = base.mixY + (y - base.mixY) * alpha;
	        pose.mixScaleX = base.mixScaleX + (scaleX - base.mixScaleX) * alpha;
	        pose.mixScaleY = base.mixScaleY + (scaleY - base.mixScaleY) * alpha;
	        pose.mixShearY = base.mixShearY + (shearY - base.mixShearY) * alpha;
	      }
	    }
	  }]);
	}(CurveTimeline);
	var ConstraintTimeline1 = function (_CurveTimeline0) {
	  function ConstraintTimeline1(frameCount, bezierCount, constraintIndex, property) {
	    var _this13;
	    _classCallCheck(this, ConstraintTimeline1);
	    _this13 = _callSuper(this, ConstraintTimeline1, [frameCount, bezierCount, "".concat(property, "|").concat(constraintIndex)]);
	    _defineProperty(_this13, "constraintIndex", void 0);
	    _this13.constraintIndex = constraintIndex;
	    return _this13;
	  }
	  _inherits(ConstraintTimeline1, _CurveTimeline0);
	  return _createClass(ConstraintTimeline1);
	}(CurveTimeline1);
	var PathConstraintPositionTimeline = function (_ConstraintTimeline2) {
	  function PathConstraintPositionTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this14;
	    _classCallCheck(this, PathConstraintPositionTimeline);
	    _this14 = _callSuper(this, PathConstraintPositionTimeline, [frameCount, bezierCount, constraintIndex, Property.pathConstraintPosition]);
	    _this14.additive = true;
	    return _this14;
	  }
	  _inherits(PathConstraintPositionTimeline, _ConstraintTimeline2);
	  return _createClass(PathConstraintPositionTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (constraint.active) {
	        var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	        pose.position = this.getAbsoluteValue(time, alpha, from, add, pose.position, constraint.data.setupPose.position);
	      }
	    }
	  }]);
	}(ConstraintTimeline1);
	var PathConstraintSpacingTimeline = function (_ConstraintTimeline3) {
	  function PathConstraintSpacingTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PathConstraintSpacingTimeline);
	    return _callSuper(this, PathConstraintSpacingTimeline, [frameCount, bezierCount, constraintIndex, Property.pathConstraintSpacing]);
	  }
	  _inherits(PathConstraintSpacingTimeline, _ConstraintTimeline3);
	  return _createClass(PathConstraintSpacingTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (constraint.active) {
	        var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	        pose.spacing = this.getAbsoluteValue(time, alpha, from, false, pose.spacing, constraint.data.setupPose.spacing);
	      }
	    }
	  }]);
	}(ConstraintTimeline1);
	var PathConstraintMixTimeline = function (_CurveTimeline1) {
	  function PathConstraintMixTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this15;
	    _classCallCheck(this, PathConstraintMixTimeline);
	    _this15 = _callSuper(this, PathConstraintMixTimeline, [frameCount, bezierCount, "".concat(Property.pathConstraintMix, "|").concat(constraintIndex)]);
	    _defineProperty(_this15, "constraintIndex", void 0);
	    _this15.constraintIndex = constraintIndex;
	    return _this15;
	  }
	  _inherits(PathConstraintMixTimeline, _CurveTimeline1);
	  return _createClass(PathConstraintMixTimeline, [{
	    key: "getFrameEntries",
	    value: function getFrameEntries() {
	      return 4;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time, mixRotate, mixX, mixY) {
	      var frames = this.frames;
	      frame <<= 2;
	      frames[frame] = time;
	      frames[frame + 1] = mixRotate;
	      frames[frame + 2] = mixX;
	      frames[frame + 3] = mixY;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (!constraint.active) return;
	      var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	      var frames = this.frames;
	      if (time < frames[0]) {
	        var setup = constraint.data.setupPose;
	        switch (from) {
	          case MixFrom.setup:
	            {
	              pose.mixRotate = setup.mixRotate;
	              pose.mixX = setup.mixX;
	              pose.mixY = setup.mixY;
	              break;
	            }
	          case MixFrom.first:
	            {
	              pose.mixRotate += (setup.mixRotate - pose.mixRotate) * alpha;
	              pose.mixX += (setup.mixX - pose.mixX) * alpha;
	              pose.mixY += (setup.mixY - pose.mixY) * alpha;
	              break;
	            }
	        }
	        return;
	      }
	      var rotate, x, y;
	      var i = Timeline.search(frames, time, 4);
	      var curveType = this.curves[i >> 2];
	      switch (curveType) {
	        case 0:
	          {
	            var before = frames[i];
	            rotate = frames[i + 1];
	            x = frames[i + 2];
	            y = frames[i + 3];
	            var t = (time - before) / (frames[i + 4] - before);
	            rotate += (frames[i + 4 + 1] - rotate) * t;
	            x += (frames[i + 4 + 2] - x) * t;
	            y += (frames[i + 4 + 3] - y) * t;
	            break;
	          }
	        case 1:
	          rotate = frames[i + 1];
	          x = frames[i + 2];
	          y = frames[i + 3];
	          break;
	        default:
	          rotate = this.getBezierValue(time, i, 1, curveType - 2);
	          x = this.getBezierValue(time, i, 2, curveType + 18 - 2);
	          y = this.getBezierValue(time, i, 3, curveType + 18 * 2 - 2);
	      }
	      var base = from === MixFrom.setup ? constraint.data.setupPose : pose;
	      if (add) {
	        pose.mixRotate = base.mixRotate + rotate * alpha;
	        pose.mixX = base.mixX + x * alpha;
	        pose.mixY = base.mixY + y * alpha;
	      } else {
	        pose.mixRotate = base.mixRotate + (rotate - base.mixRotate) * alpha;
	        pose.mixX = base.mixX + (x - base.mixX) * alpha;
	        pose.mixY = base.mixY + (y - base.mixY) * alpha;
	      }
	    }
	  }]);
	}(CurveTimeline);
	var PhysicsConstraintTimeline = function (_ConstraintTimeline4) {
	  function PhysicsConstraintTimeline(frameCount, bezierCount, constraintIndex, property) {
	    _classCallCheck(this, PhysicsConstraintTimeline);
	    return _callSuper(this, PhysicsConstraintTimeline, [frameCount, bezierCount, constraintIndex, property]);
	  }
	  _inherits(PhysicsConstraintTimeline, _ConstraintTimeline4);
	  return _createClass(PhysicsConstraintTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      if (add && !this.additive) add = false;
	      if (this.constraintIndex === -1) {
	        var value = time >= this.frames[0] ? this.getCurveValue(time) : 0;
	        var constraints = skeleton.physics;
	        var _iterator6 = _createForOfIteratorHelper(constraints),
	          _step6;
	        try {
	          for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
	            var constraint = _step6.value;
	            if (constraint.active && this.global(constraint.data)) {
	              var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	              this.set(pose, this.getAbsoluteValue(time, alpha, from, add, this.get(pose), this.get(constraint.data.setupPose), value));
	            }
	          }
	        } catch (err) {
	          _iterator6.e(err);
	        } finally {
	          _iterator6.f();
	        }
	      } else {
	        var _constraint = skeleton.constraints[this.constraintIndex];
	        if (_constraint.active) {
	          var _pose = appliedPose ? _constraint.appliedPose : _constraint.pose;
	          this.set(_pose, this.getAbsoluteValue(time, alpha, from, add, this.get(_pose), this.get(_constraint.data.setupPose)));
	        }
	      }
	    }
	  }]);
	}(ConstraintTimeline1);
	var PhysicsConstraintInertiaTimeline = function (_PhysicsConstraintTim) {
	  function PhysicsConstraintInertiaTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PhysicsConstraintInertiaTimeline);
	    return _callSuper(this, PhysicsConstraintInertiaTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintInertia]);
	  }
	  _inherits(PhysicsConstraintInertiaTimeline, _PhysicsConstraintTim);
	  return _createClass(PhysicsConstraintInertiaTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.inertia;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.inertia = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.inertiaGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintStrengthTimeline = function (_PhysicsConstraintTim2) {
	  function PhysicsConstraintStrengthTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PhysicsConstraintStrengthTimeline);
	    return _callSuper(this, PhysicsConstraintStrengthTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintStrength]);
	  }
	  _inherits(PhysicsConstraintStrengthTimeline, _PhysicsConstraintTim2);
	  return _createClass(PhysicsConstraintStrengthTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.strength;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.strength = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.strengthGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintDampingTimeline = function (_PhysicsConstraintTim3) {
	  function PhysicsConstraintDampingTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PhysicsConstraintDampingTimeline);
	    return _callSuper(this, PhysicsConstraintDampingTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintDamping]);
	  }
	  _inherits(PhysicsConstraintDampingTimeline, _PhysicsConstraintTim3);
	  return _createClass(PhysicsConstraintDampingTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.damping;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.damping = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.dampingGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintMassTimeline = function (_PhysicsConstraintTim4) {
	  function PhysicsConstraintMassTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PhysicsConstraintMassTimeline);
	    return _callSuper(this, PhysicsConstraintMassTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintMass]);
	  }
	  _inherits(PhysicsConstraintMassTimeline, _PhysicsConstraintTim4);
	  return _createClass(PhysicsConstraintMassTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return 1 / pose.massInverse;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.massInverse = 1 / value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.massGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintWindTimeline = function (_PhysicsConstraintTim5) {
	  function PhysicsConstraintWindTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this16;
	    _classCallCheck(this, PhysicsConstraintWindTimeline);
	    _this16 = _callSuper(this, PhysicsConstraintWindTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintWind]);
	    _this16.additive = true;
	    return _this16;
	  }
	  _inherits(PhysicsConstraintWindTimeline, _PhysicsConstraintTim5);
	  return _createClass(PhysicsConstraintWindTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.wind;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.wind = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.windGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintGravityTimeline = function (_PhysicsConstraintTim6) {
	  function PhysicsConstraintGravityTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this17;
	    _classCallCheck(this, PhysicsConstraintGravityTimeline);
	    _this17 = _callSuper(this, PhysicsConstraintGravityTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintGravity]);
	    _this17.additive = true;
	    return _this17;
	  }
	  _inherits(PhysicsConstraintGravityTimeline, _PhysicsConstraintTim6);
	  return _createClass(PhysicsConstraintGravityTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.gravity;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.gravity = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.gravityGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintMixTimeline = function (_PhysicsConstraintTim7) {
	  function PhysicsConstraintMixTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, PhysicsConstraintMixTimeline);
	    return _callSuper(this, PhysicsConstraintMixTimeline, [frameCount, bezierCount, constraintIndex, Property.physicsConstraintMix]);
	  }
	  _inherits(PhysicsConstraintMixTimeline, _PhysicsConstraintTim7);
	  return _createClass(PhysicsConstraintMixTimeline, [{
	    key: "get",
	    value: function get(pose) {
	      return pose.mix;
	    }
	  }, {
	    key: "set",
	    value: function set(pose, value) {
	      pose.mix = value;
	    }
	  }, {
	    key: "global",
	    value: function global(constraint) {
	      return constraint.mixGlobal;
	    }
	  }]);
	}(PhysicsConstraintTimeline);
	var PhysicsConstraintResetTimeline = function (_Timeline9) {
	  function PhysicsConstraintResetTimeline(frameCount, constraintIndex) {
	    var _this18;
	    _classCallCheck(this, PhysicsConstraintResetTimeline);
	    _this18 = _callSuper(this, PhysicsConstraintResetTimeline, [frameCount].concat(_toConsumableArray(PhysicsConstraintResetTimeline.propertyIds)));
	    _defineProperty(_this18, "constraintIndex", void 0);
	    _this18.constraintIndex = constraintIndex;
	    _this18.instant = true;
	    return _this18;
	  }
	  _inherits(PhysicsConstraintResetTimeline, _Timeline9);
	  return _createClass(PhysicsConstraintResetTimeline, [{
	    key: "getFrameCount",
	    value: function getFrameCount() {
	      return this.frames.length;
	    }
	  }, {
	    key: "setFrame",
	    value: function setFrame(frame, time) {
	      this.frames[frame] = time;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint;
	      if (this.constraintIndex !== -1) {
	        constraint = skeleton.constraints[this.constraintIndex];
	        if (!constraint.active) return;
	      }
	      var frames = this.frames;
	      if (lastTime > time) {
	        this.apply(skeleton, lastTime, Number.MAX_VALUE, [], alpha, from, false, false, false);
	        lastTime = -1;
	      } else if (lastTime >= frames[frames.length - 1]) return;
	      if (time < frames[0]) return;
	      if (lastTime < frames[0] || time >= frames[Timeline.search(frames, lastTime) + 1]) {
	        if (constraint != null) constraint.reset(skeleton);else {
	          var _iterator7 = _createForOfIteratorHelper(skeleton.physics),
	            _step7;
	          try {
	            for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
	              var _constraint2 = _step7.value;
	              if (_constraint2.active) _constraint2.reset(skeleton);
	            }
	          } catch (err) {
	            _iterator7.e(err);
	          } finally {
	            _iterator7.f();
	          }
	        }
	      }
	    }
	  }]);
	}(Timeline);
	_defineProperty(PhysicsConstraintResetTimeline, "propertyIds", [Property.physicsConstraintReset.toString()]);
	var SliderTimeline = function (_ConstraintTimeline5) {
	  function SliderTimeline(frameCount, bezierCount, constraintIndex) {
	    _classCallCheck(this, SliderTimeline);
	    return _callSuper(this, SliderTimeline, [frameCount, bezierCount, constraintIndex, Property.sliderTime]);
	  }
	  _inherits(SliderTimeline, _ConstraintTimeline5);
	  return _createClass(SliderTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (constraint.active) {
	        var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	        pose.time = this.getAbsoluteValue(time, alpha, from, add, pose.time, constraint.data.setupPose.time);
	      }
	    }
	  }]);
	}(ConstraintTimeline1);
	var SliderMixTimeline = function (_ConstraintTimeline6) {
	  function SliderMixTimeline(frameCount, bezierCount, constraintIndex) {
	    var _this19;
	    _classCallCheck(this, SliderMixTimeline);
	    _this19 = _callSuper(this, SliderMixTimeline, [frameCount, bezierCount, constraintIndex, Property.sliderMix]);
	    _this19.additive = true;
	    return _this19;
	  }
	  _inherits(SliderMixTimeline, _ConstraintTimeline6);
	  return _createClass(SliderMixTimeline, [{
	    key: "apply",
	    value: function apply(skeleton, lastTime, time, firedEvents, alpha, from, add, out, appliedPose) {
	      var constraint = skeleton.constraints[this.constraintIndex];
	      if (constraint.active) {
	        var pose = appliedPose ? constraint.appliedPose : constraint.pose;
	        pose.mix = this.getAbsoluteValue(time, alpha, from, add, pose.mix, constraint.data.setupPose.mix);
	      }
	    }
	  }]);
	}(ConstraintTimeline1);

	var AnimationState = function () {
	  function AnimationState(data) {
	    _classCallCheck(this, AnimationState);
	    _defineProperty(this, "data", void 0);
	    _defineProperty(this, "tracks", []);
	    _defineProperty(this, "timeScale", 1);
	    _defineProperty(this, "unkeyedState", 0);
	    _defineProperty(this, "events", []);
	    _defineProperty(this, "listeners", []);
	    _defineProperty(this, "queue", new EventQueue(this));
	    _defineProperty(this, "propertyIds", new Map());
	    _defineProperty(this, "animationsChanged", false);
	    _defineProperty(this, "trackEntryPool", new Pool(function () {
	      return new TrackEntry();
	    }));
	    this.data = data;
	  }
	  return _createClass(AnimationState, [{
	    key: "update",
	    value: function update(delta) {
	      delta *= this.timeScale;
	      var tracks = this.tracks;
	      for (var i = 0, n = tracks.length; i < n; i++) {
	        var current = tracks[i];
	        if (!current) continue;
	        current.animationLast = current.nextAnimationLast;
	        current.trackLast = current.nextTrackLast;
	        var currentDelta = delta * current.timeScale;
	        if (current.delay > 0) {
	          current.delay -= currentDelta;
	          if (current.delay > 0) continue;
	          currentDelta = -current.delay;
	          current.delay = 0;
	        }
	        var next = current.next;
	        if (next) {
	          var nextTime = current.trackLast - next.delay;
	          if (nextTime >= 0) {
	            next.delay = 0;
	            next.trackTime += current.timeScale === 0 ? 0 : (nextTime / current.timeScale + delta) * next.timeScale;
	            current.trackTime += currentDelta;
	            this.setTrack(i, next, true);
	            while (next.mixingFrom) {
	              next.mixTime += delta;
	              next = next.mixingFrom;
	            }
	            continue;
	          }
	        } else if (current.trackLast >= current.trackEnd && !current.mixingFrom) {
	          tracks[i] = null;
	          this.queue.end(current);
	          this.clearNext(current);
	          continue;
	        }
	        if (current.mixingFrom && this.updateMixingFrom(current, delta)) {
	          var from = current.mixingFrom;
	          current.mixingFrom = null;
	          if (from) from.mixingTo = null;
	          while (from) {
	            this.queue.end(from);
	            from = from.mixingFrom;
	          }
	        }
	        current.trackTime += currentDelta;
	      }
	      this.queue.drain();
	    }
	  }, {
	    key: "updateMixingFrom",
	    value: function updateMixingFrom(to, delta) {
	      var from = to.mixingFrom;
	      if (!from) return true;
	      var finished = this.updateMixingFrom(from, delta);
	      from.animationLast = from.nextAnimationLast;
	      from.trackLast = from.nextTrackLast;
	      if (to.nextTrackLast !== -1 && to.mixTime >= to.mixDuration) {
	        if (from.totalAlpha === 0 || to.mixDuration === 0) {
	          to.mixingFrom = from.mixingFrom;
	          if (from.mixingFrom != null) from.mixingFrom.mixingTo = to;
	          if (from.totalAlpha === 0) {
	            for (var next = to; next.mixingTo != null; next = next.mixingTo) next.keepHold = true;
	          }
	          this.queue.end(from);
	        }
	        return finished;
	      }
	      from.trackTime += delta * from.timeScale;
	      to.mixTime += delta;
	      return false;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton) {
	      if (!skeleton) throw new Error("skeleton cannot be null.");
	      if (this.animationsChanged) this._animationsChanged();
	      var events = this.events;
	      var tracks = this.tracks;
	      var applied = false;
	      for (var i = 0, n = tracks.length; i < n; i++) {
	        var current = tracks[i];
	        if (!current || current.delay > 0) continue;
	        applied = true;
	        var alpha = current.alpha;
	        if (current.mixingFrom) alpha *= this.applyMixingFrom(current, skeleton);else if (current.trackTime >= current.trackEnd && !current.next) alpha = 0;
	        var animationLast = current.animationLast,
	          animationTime = current.getAnimationTime(),
	          applyTime = animationTime;
	        var applyEvents = events;
	        if (current.reverse) {
	          applyTime = current.animation.duration - applyTime;
	          applyEvents = null;
	        }
	        var timelines = current.animation.timelines;
	        var timelineCount = timelines.length;
	        if (i === 0 && alpha === 1) {
	          for (var ii = 0; ii < timelineCount; ii++) {
	            Utils.webkit602BugfixHelper(alpha);
	            var timeline = timelines[ii];
	            if (timeline instanceof AttachmentTimeline) this.applyAttachmentTimeline(timeline, skeleton, applyTime, MixFrom.setup, true);else timeline.apply(skeleton, animationLast, applyTime, applyEvents, alpha, MixFrom.setup, false, false, false);
	          }
	        } else {
	          var timelineMode = current.timelineMode;
	          var retainAttachments = alpha >= current.alphaAttachmentThreshold;
	          var add = current.additive,
	            shortestRotation = add || current.shortestRotation;
	          var firstFrame = !shortestRotation && current.timelinesRotation.length !== timelineCount << 1;
	          if (firstFrame) current.timelinesRotation.length = timelineCount << 1;
	          for (var _ii = 0; _ii < timelineCount; _ii++) {
	            var _timeline = timelines[_ii];
	            var from = timelineMode[_ii] & MODE;
	            if (!shortestRotation && _timeline instanceof RotateTimeline) {
	              this.applyRotateTimeline(_timeline, skeleton, applyTime, alpha, from, current.timelinesRotation, _ii << 1, firstFrame);
	            } else if (_timeline instanceof AttachmentTimeline) {
	              this.applyAttachmentTimeline(_timeline, skeleton, applyTime, from, retainAttachments);
	            } else {
	              Utils.webkit602BugfixHelper(alpha);
	              _timeline.apply(skeleton, animationLast, applyTime, applyEvents, alpha, from, add, false, false);
	            }
	          }
	        }
	        if (current.reverse) this.eventsReverse(current, animationLast, animationTime);
	        this.queueEvents(current, animationTime);
	        events.length = 0;
	        current.nextAnimationLast = animationTime;
	        current.nextTrackLast = current.trackTime;
	      }
	      var setupState = this.unkeyedState + ATTACH_SETUP;
	      var slots = skeleton.slots;
	      for (var _i = 0, _n = skeleton.slots.length; _i < _n; _i++) {
	        var slot = slots[_i];
	        if (slot.attachmentState === setupState) {
	          var attachmentName = slot.data.attachmentName;
	          slot.pose.setAttachment(!attachmentName ? null : skeleton.getAttachment(slot.data.index, attachmentName));
	        }
	      }
	      this.unkeyedState += 2;
	      this.queue.drain();
	      return applied;
	    }
	  }, {
	    key: "applyMixingFrom",
	    value: function applyMixingFrom(to, skeleton) {
	      var from = to.mixingFrom;
	      var fromMix = from.mixingFrom !== null ? this.applyMixingFrom(from, skeleton) : 1;
	      var mix = to.mix();
	      var a = from.alpha * fromMix,
	        keep = 1 - mix * to.alpha;
	      var alphaMix = a * (1 - mix),
	        alphaHold = keep > 0 ? alphaMix / keep : a;
	      var timelines = from.animation.timelines;
	      var timelineCount = timelines.length;
	      var timelineMode = from.timelineMode;
	      var timelineHoldMix = from.timelineHoldMix;
	      var retainAttachments = mix < from.mixAttachmentThreshold,
	        drawOrder = mix < from.mixDrawOrderThreshold;
	      var add = from.additive,
	        shortestRotation = add || from.shortestRotation;
	      var firstFrame = !shortestRotation && from.timelinesRotation.length !== timelineCount << 1;
	      if (firstFrame) from.timelinesRotation.length = timelineCount << 1;
	      var timelinesRotation = from.timelinesRotation;
	      var animationLast = from.animationLast,
	        animationTime = from.getAnimationTime(),
	        applyTime = animationTime;
	      var events = null;
	      if (from.reverse) applyTime = from.animation.duration - applyTime;else if (mix < from.eventThreshold) events = this.events;
	      from.totalAlpha = 0;
	      for (var i = 0; i < timelineCount; i++) {
	        var timeline = timelines[i];
	        var mode = timelineMode[i];
	        var mixFrom = mode & MODE;
	        var alpha = 0;
	        if ((mode & HOLD) !== 0) {
	          var holdMix = timelineHoldMix[i];
	          alpha = holdMix == null ? alphaHold : alphaHold * (1 - holdMix.mix());
	        } else {
	          if (!drawOrder && timeline instanceof DrawOrderTimeline && mixFrom === MixFrom.current) continue;
	          alpha = alphaMix;
	        }
	        from.totalAlpha += alpha;
	        if (!shortestRotation && timeline instanceof RotateTimeline) {
	          this.applyRotateTimeline(timeline, skeleton, applyTime, alpha, mixFrom, timelinesRotation, i << 1, firstFrame);
	        } else if (timeline instanceof AttachmentTimeline) this.applyAttachmentTimeline(timeline, skeleton, applyTime, mixFrom, retainAttachments && alpha >= from.alphaAttachmentThreshold);else {
	          var out = !drawOrder || !(timeline instanceof DrawOrderTimeline) || mixFrom === MixFrom.current;
	          timeline.apply(skeleton, animationLast, applyTime, events, alpha, mixFrom, add, out, false);
	        }
	      }
	      if (from.reverse && mix < from.eventThreshold) this.eventsReverse(from, animationLast, animationTime);
	      if (to.mixDuration > 0) this.queueEvents(from, animationTime);
	      this.events.length = 0;
	      from.nextAnimationLast = animationTime;
	      from.nextTrackLast = from.trackTime;
	      return mix;
	    }
	  }, {
	    key: "applyAttachmentTimeline",
	    value: function applyAttachmentTimeline(timeline, skeleton, time, from, retain) {
	      var slot = skeleton.slots[timeline.slotIndex];
	      if (!slot.bone.active) return;
	      if (!retain && slot.attachmentState === this.unkeyedState + ATTACH_RETAIN) return;
	      var setup = time < timeline.frames[0];
	      var name = null;
	      if (!setup) {
	        name = timeline.attachmentNames[Timeline.search(timeline.frames, time)];
	        setup = !retain && name == null;
	      }
	      if (setup) {
	        if (from === MixFrom.current) return;
	        name = slot.data.attachmentName;
	      }
	      slot.pose.setAttachment(name == null ? null : skeleton.getAttachment(slot.data.index, name));
	      if (retain) slot.attachmentState = this.unkeyedState + ATTACH_RETAIN;else if (!setup) slot.attachmentState = this.unkeyedState + ATTACH_SETUP;
	    }
	  }, {
	    key: "applyRotateTimeline",
	    value: function applyRotateTimeline(timeline, skeleton, time, alpha, from, timelinesRotation, i, firstFrame) {
	      if (firstFrame) timelinesRotation[i] = 0;
	      if (alpha === 1) {
	        timeline.apply(skeleton, 0, time, null, 1, from, false, false, false);
	        return;
	      }
	      var bone = skeleton.bones[timeline.boneIndex];
	      if (!bone.active) return;
	      var pose = bone.pose,
	        setup = bone.data.setupPose;
	      var frames = timeline.frames;
	      var r1, r2;
	      if (time < frames[0]) {
	        switch (from) {
	          case MixFrom.setup:
	            {
	              pose.rotation = setup.rotation;
	              return;
	            }
	          case MixFrom.current:
	            {
	              return;
	            }
	        }
	        r1 = pose.rotation;
	        r2 = setup.rotation;
	      } else {
	        r1 = from === MixFrom.setup ? setup.rotation : pose.rotation;
	        r2 = setup.rotation + timeline.getCurveValue(time);
	      }
	      var total = 0,
	        diff = r2 - r1;
	      diff -= Math.ceil(diff / 360 - 0.5) * 360;
	      if (diff === 0) {
	        total = timelinesRotation[i];
	      } else {
	        var lastTotal = 0,
	          lastDiff = 0;
	        if (firstFrame) {
	          lastTotal = 0;
	          lastDiff = diff;
	        } else {
	          lastTotal = timelinesRotation[i];
	          lastDiff = timelinesRotation[i + 1];
	        }
	        var loops = lastTotal - lastTotal % 360;
	        total = diff + loops;
	        var current = diff >= 0,
	          dir = lastTotal >= 0;
	        if (Math.abs(lastDiff) <= 90 && MathUtils.signum(lastDiff) !== MathUtils.signum(diff)) {
	          if (Math.abs(lastTotal - loops) > 180) {
	            total += 360 * MathUtils.signum(lastTotal);
	            dir = current;
	          } else if (loops !== 0) total -= 360 * MathUtils.signum(lastTotal);else dir = current;
	        }
	        if (dir !== current) total += 360 * MathUtils.signum(lastTotal);
	        timelinesRotation[i] = total;
	      }
	      timelinesRotation[i + 1] = diff;
	      pose.rotation = r1 + total * alpha;
	    }
	  }, {
	    key: "queueEvents",
	    value: function queueEvents(entry, animationTime) {
	      var animationStart = entry.animationStart,
	        animationEnd = entry.animationEnd,
	        duration = animationEnd - animationStart;
	      var reverse = entry.reverse;
	      var split = entry.trackLast % duration;
	      if (reverse) split = duration - split;
	      var events = this.events;
	      var i = 0,
	        n = events.length;
	      for (; i < n; i++) {
	        var event = events[i];
	        if (event.time < split !== reverse) break;
	        if (event.time >= animationStart && event.time <= animationEnd) this.queue.event(entry, event);
	      }
	      var complete = false;
	      if (entry.loop) {
	        if (duration === 0) complete = true;else {
	          var cycles = Math.floor(entry.trackTime / duration);
	          complete = cycles > 0 && cycles > Math.floor(entry.trackLast / duration);
	        }
	      } else complete = animationTime >= animationEnd && entry.animationLast < animationEnd;
	      if (complete) this.queue.complete(entry);
	      for (; i < n; i++) {
	        var _event = events[i];
	        if (_event.time >= animationStart && _event.time <= animationEnd) this.queue.event(entry, _event);
	      }
	    }
	  }, {
	    key: "eventsReverse",
	    value: function eventsReverse(entry, animationLast, animationTime) {
	      var duration = entry.animation.duration,
	        from = duration - animationLast,
	        to = duration - animationTime;
	      var timelines = entry.animation.timelines;
	      for (var i = 0, n = entry.animation.timelines.length; i < n; i++) {
	        var eventTimeline = timelines[i];
	        if (!(eventTimeline instanceof EventTimeline)) continue;
	        var timelineEvents = eventTimeline.events;
	        var frames = eventTimeline.frames;
	        var frameCount = frames.length;
	        if (from >= to) {
	          for (var ii = 0; ii < frameCount; ii++) {
	            if (frames[ii] < to) continue;
	            if (frames[ii] >= from) break;
	            this.events.push(timelineEvents[ii]);
	          }
	        } else {
	          for (var _ii2 = 0; _ii2 < frameCount; _ii2++) {
	            if (frames[_ii2] >= from) break;
	            this.events.push(timelineEvents[_ii2]);
	          }
	          var _ii3 = 0;
	          for (; _ii3 < frameCount; _ii3++) if (frames[_ii3] >= to) break;
	          for (; _ii3 < frameCount; _ii3++) this.events.push(timelineEvents[_ii3]);
	        }
	      }
	    }
	  }, {
	    key: "clearTracks",
	    value: function clearTracks() {
	      var oldDrainDisabled = this.queue.drainDisabled;
	      this.queue.drainDisabled = true;
	      for (var i = 0, n = this.tracks.length; i < n; i++) this.clearTrack(i);
	      this.tracks.length = 0;
	      this.queue.drainDisabled = oldDrainDisabled;
	      this.queue.drain();
	    }
	  }, {
	    key: "clearTrack",
	    value: function clearTrack(trackIndex) {
	      if (trackIndex < 0) throw new Error("trackIndex must be >= 0.");
	      if (trackIndex >= this.tracks.length) return;
	      var current = this.tracks[trackIndex];
	      if (!current) return;
	      this.queue.end(current);
	      this.clearNext(current);
	      var entry = current;
	      while (true) {
	        var from = entry.mixingFrom;
	        if (!from) break;
	        this.queue.end(from);
	        entry.mixingFrom = null;
	        entry.mixingTo = null;
	        entry = from;
	      }
	      this.tracks[current.trackIndex] = null;
	      this.queue.drain();
	    }
	  }, {
	    key: "setTrack",
	    value: function setTrack(index, current, interrupt) {
	      var from = this.expandToIndex(index);
	      this.tracks[index] = current;
	      current.previous = null;
	      if (from) {
	        from.next = null;
	        if (interrupt) this.queue.interrupt(from);
	        current.mixingFrom = from;
	        from.mixingTo = current;
	        current.mixTime = 0;
	        from.timelinesRotation.length = 0;
	      }
	      this.queue.start(current);
	    }
	  }, {
	    key: "setAnimation",
	    value: function setAnimation(trackIndex, animationNameOrAnimation) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      if (typeof animationNameOrAnimation === "string") return this.setAnimation1(trackIndex, animationNameOrAnimation, loop);
	      return this.setAnimation2(trackIndex, animationNameOrAnimation, loop);
	    }
	  }, {
	    key: "setAnimation1",
	    value: function setAnimation1(trackIndex, animationName) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      var animation = this.data.skeletonData.findAnimation(animationName);
	      if (!animation) throw new Error("Animation not found: ".concat(animationName));
	      return this.setAnimation2(trackIndex, animation, loop);
	    }
	  }, {
	    key: "setAnimation2",
	    value: function setAnimation2(trackIndex, animation) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      if (trackIndex < 0) throw new Error("trackIndex must be >= 0.");
	      if (!animation) throw new Error("animation cannot be null.");
	      var interrupt = true;
	      var current = this.expandToIndex(trackIndex);
	      if (current) {
	        if (current.nextTrackLast === -1 && current.animation === animation) {
	          this.tracks[trackIndex] = current.mixingFrom;
	          this.queue.interrupt(current);
	          this.queue.end(current);
	          this.clearNext(current);
	          current = current.mixingFrom;
	          interrupt = false;
	        } else this.clearNext(current);
	      }
	      var entry = this.trackEntry(trackIndex, animation, loop, current);
	      this.setTrack(trackIndex, entry, interrupt);
	      this.queue.drain();
	      return entry;
	    }
	  }, {
	    key: "addAnimation",
	    value: function addAnimation(trackIndex, animationNameOrAnimation) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      var delay = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
	      if (typeof animationNameOrAnimation === "string") return this.addAnimation1(trackIndex, animationNameOrAnimation, loop, delay);
	      return this.addAnimation2(trackIndex, animationNameOrAnimation, loop, delay);
	    }
	  }, {
	    key: "addAnimation1",
	    value: function addAnimation1(trackIndex, animationName) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      var delay = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
	      var animation = this.data.skeletonData.findAnimation(animationName);
	      if (!animation) throw new Error("Animation not found: ".concat(animationName));
	      return this.addAnimation2(trackIndex, animation, loop, delay);
	    }
	  }, {
	    key: "addAnimation2",
	    value: function addAnimation2(trackIndex, animation) {
	      var loop = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	      var delay = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
	      if (trackIndex < 0) throw new Error("trackIndex must be >= 0.");
	      if (!animation) throw new Error("animation cannot be null.");
	      var last = this.expandToIndex(trackIndex);
	      if (last) {
	        while (last.next) last = last.next;
	      }
	      var entry = this.trackEntry(trackIndex, animation, loop, last);
	      if (!last) {
	        this.setTrack(trackIndex, entry, true);
	        this.queue.drain();
	        if (delay < 0) delay = 0;
	      } else {
	        last.next = entry;
	        entry.previous = last;
	        if (delay <= 0) delay = Math.max(delay + last.getTrackComplete() - entry.mixDuration, 0);
	      }
	      entry.delay = delay;
	      return entry;
	    }
	  }, {
	    key: "setEmptyAnimation",
	    value: function setEmptyAnimation(trackIndex) {
	      var mixDuration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	      var entry = this.setAnimation(trackIndex, AnimationState.emptyAnimation, false);
	      entry.mixDuration = mixDuration;
	      entry.trackEnd = mixDuration;
	      return entry;
	    }
	  }, {
	    key: "addEmptyAnimation",
	    value: function addEmptyAnimation(trackIndex) {
	      var mixDuration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	      var delay = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	      var entry = this.addAnimation(trackIndex, AnimationState.emptyAnimation, false, delay);
	      if (delay <= 0) entry.delay = Math.max(entry.delay + entry.mixDuration - mixDuration, 0);
	      entry.mixDuration = mixDuration;
	      entry.trackEnd = mixDuration;
	      return entry;
	    }
	  }, {
	    key: "setEmptyAnimations",
	    value: function setEmptyAnimations() {
	      var mixDuration = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	      var oldDrainDisabled = this.queue.drainDisabled;
	      this.queue.drainDisabled = true;
	      for (var i = 0, n = this.tracks.length; i < n; i++) {
	        var current = this.tracks[i];
	        if (current) this.setEmptyAnimation(current.trackIndex, mixDuration);
	      }
	      this.queue.drainDisabled = oldDrainDisabled;
	      this.queue.drain();
	    }
	  }, {
	    key: "expandToIndex",
	    value: function expandToIndex(index) {
	      if (index < this.tracks.length) return this.tracks[index];
	      Utils.ensureArrayCapacity(this.tracks, index + 1, null);
	      this.tracks.length = index + 1;
	      return null;
	    }
	  }, {
	    key: "trackEntry",
	    value: function trackEntry(trackIndex, animation, loop, last) {
	      var entry = this.trackEntryPool.obtain();
	      entry.reset();
	      entry.trackIndex = trackIndex;
	      entry.animation = animation;
	      entry.loop = loop;
	      entry.additive = false;
	      entry.reverse = false;
	      entry.shortestRotation = false;
	      entry.eventThreshold = 0;
	      entry.alphaAttachmentThreshold = 0;
	      entry.mixAttachmentThreshold = 0;
	      entry.mixDrawOrderThreshold = 0;
	      entry.animationStart = 0;
	      entry.animationEnd = animation.duration;
	      entry.animationLast = -1;
	      entry.nextAnimationLast = -1;
	      entry.delay = 0;
	      entry.trackTime = 0;
	      entry.trackLast = -1;
	      entry.nextTrackLast = -1;
	      entry.trackEnd = Number.MAX_VALUE;
	      entry.timeScale = 1;
	      entry.alpha = 1;
	      entry.mixTime = 0;
	      entry.mixDuration = !last ? 0 : this.data.getMix(last.animation, animation);
	      entry.totalAlpha = 0;
	      entry.keepHold = false;
	      return entry;
	    }
	  }, {
	    key: "clearNext",
	    value: function clearNext(entry) {
	      var next = entry.next;
	      while (next) {
	        this.queue.dispose(next);
	        next = next.next;
	      }
	      entry.next = null;
	    }
	  }, {
	    key: "_animationsChanged",
	    value: function _animationsChanged() {
	      this.animationsChanged = false;
	      var tracks = this.tracks;
	      for (var i = 0, n = tracks.length; i < n; i++) {
	        var track = tracks[i];
	        if (!track) continue;
	        var entry = track;
	        while (entry.mixingFrom) entry = entry.mixingFrom;
	        do {
	          this.computeHold(entry, track);
	          entry = entry.mixingTo;
	        } while (entry);
	      }
	      this.propertyIds.clear();
	    }
	  }, {
	    key: "computeHold",
	    value: function computeHold(entry, track) {
	      var timelines = entry.animation.timelines;
	      var timelinesCount = entry.animation.timelines.length;
	      var timelineMode = entry.timelineMode;
	      timelineMode.length = timelinesCount;
	      var timelineHoldMix = entry.timelineHoldMix;
	      timelineHoldMix.length = 0;
	      var add = entry.additive,
	        keepHold = entry.keepHold;
	      var to = entry.mixingTo;
	      for (var i = 0; i < timelinesCount; i++) {
	        var _to$animation;
	        var timeline = timelines[i];
	        var ids = timeline.propertyIds;
	        var from = this.from(track, timeline, ids);
	        if (add && timeline.additive) {
	          timelineMode[i] = from;
	          continue;
	        }
	        var mode = void 0;
	        if (to === null || timeline.instant || to.additive && timeline.additive || !((_to$animation = to.animation) !== null && _to$animation !== void 0 && _to$animation.hasTimeline(ids))) mode = from;else {
	          mode = from | HOLD;
	          for (var next = to.mixingTo; next != null; next = next.mixingTo) {
	            var _next$animation;
	            if (next.additive && timeline.additive || !((_next$animation = next.animation) !== null && _next$animation !== void 0 && _next$animation.hasTimeline(ids))) {
	              if (next.mixDuration > 0) timelineHoldMix[i] = next;
	              break;
	            }
	          }
	        }
	        if (keepHold) mode = mode & ~HOLD | timelineMode[i] & HOLD;
	        timelineMode[i] = mode;
	      }
	    }
	  }, {
	    key: "from",
	    value: function from(track, timeline, ids) {
	      var propertyIds = this.propertyIds;
	      var from = SETUP;
	      for (var i = 0, n = ids.length; i < n; i++) {
	        var owner = propertyIds.get(ids[i]);
	        if (owner === undefined) {
	          propertyIds.set(ids[i], track);
	        } else {
	          if (owner !== track) {
	            while (++i < n) if (!propertyIds.has(ids[i])) propertyIds.set(ids[i], track);
	            return CURRENT;
	          }
	          from = FIRST;
	        }
	      }
	      if (timeline instanceof DrawOrderFolderTimeline) {
	        var first = propertyIds.get(DrawOrderTimeline.propertyID);
	        if (first != null) return first !== track ? CURRENT : FIRST;
	      }
	      return from;
	    }
	  }, {
	    key: "getTrack",
	    value: function getTrack(trackIndex) {
	      if (trackIndex < 0) throw new Error("trackIndex must be >= 0.");
	      if (trackIndex >= this.tracks.length) return null;
	      return this.tracks[trackIndex];
	    }
	  }, {
	    key: "addListener",
	    value: function addListener(listener) {
	      if (!listener) throw new Error("listener cannot be null.");
	      this.listeners.push(listener);
	    }
	  }, {
	    key: "removeListener",
	    value: function removeListener(listener) {
	      var index = this.listeners.indexOf(listener);
	      if (index >= 0) this.listeners.splice(index, 1);
	    }
	  }, {
	    key: "clearListeners",
	    value: function clearListeners() {
	      this.listeners.length = 0;
	    }
	  }, {
	    key: "clearListenerNotifications",
	    value: function clearListenerNotifications() {
	      this.queue.clear();
	    }
	  }]);
	}();
	_defineProperty(AnimationState, "emptyAnimation", new Animation("<empty>", [], 0));
	var TrackEntry = function () {
	  function TrackEntry() {
	    _classCallCheck(this, TrackEntry);
	    _defineProperty(this, "animation", null);
	    _defineProperty(this, "previous", null);
	    _defineProperty(this, "next", null);
	    _defineProperty(this, "mixingFrom", null);
	    _defineProperty(this, "mixingTo", null);
	    _defineProperty(this, "listener", null);
	    _defineProperty(this, "trackIndex", 0);
	    _defineProperty(this, "loop", false);
	    _defineProperty(this, "additive", false);
	    _defineProperty(this, "reverse", false);
	    _defineProperty(this, "shortestRotation", false);
	    _defineProperty(this, "keepHold", false);
	    _defineProperty(this, "eventThreshold", 0);
	    _defineProperty(this, "mixAttachmentThreshold", 0);
	    _defineProperty(this, "alphaAttachmentThreshold", 0);
	    _defineProperty(this, "mixDrawOrderThreshold", 0);
	    _defineProperty(this, "animationStart", 0);
	    _defineProperty(this, "animationEnd", 0);
	    _defineProperty(this, "animationLast", 0);
	    _defineProperty(this, "nextAnimationLast", 0);
	    _defineProperty(this, "delay", 0);
	    _defineProperty(this, "trackTime", 0);
	    _defineProperty(this, "trackLast", 0);
	    _defineProperty(this, "nextTrackLast", 0);
	    _defineProperty(this, "trackEnd", 0);
	    _defineProperty(this, "timeScale", 0);
	    _defineProperty(this, "alpha", 0);
	    _defineProperty(this, "mixTime", 0);
	    _defineProperty(this, "mixDuration", 0);
	    _defineProperty(this, "totalAlpha", 0);
	    _defineProperty(this, "mixInterpolation", Interpolation.linear);
	    _defineProperty(this, "timelineMode", []);
	    _defineProperty(this, "timelineHoldMix", []);
	    _defineProperty(this, "timelinesRotation", []);
	  }
	  return _createClass(TrackEntry, [{
	    key: "setMixDuration",
	    value: function setMixDuration(mixDuration, delay) {
	      this.mixDuration = mixDuration;
	      if (delay !== undefined) {
	        if (delay <= 0) delay = this.previous == null ? 0 : Math.max(delay + this.previous.getTrackComplete() - mixDuration, 0);
	        this.delay = delay;
	      }
	    }
	  }, {
	    key: "setMixInterpolation",
	    value: function setMixInterpolation(mixInterpolation) {
	      if (!mixInterpolation) throw new Error("mixInterpolation cannot be null.");
	      this.mixInterpolation = mixInterpolation;
	    }
	  }, {
	    key: "mix",
	    value: function mix() {
	      if (this.mixDuration === 0) return 1;
	      var mix = this.mixTime / this.mixDuration;
	      if (mix >= 1) return 1;
	      if (this.mixInterpolation === Interpolation.linear) return mix;
	      mix = this.mixInterpolation.apply(mix);
	      if (mix < 0) return 0;
	      if (mix > 1) return 1;
	      return mix;
	    }
	  }, {
	    key: "reset",
	    value: function reset() {
	      this.next = null;
	      this.previous = null;
	      this.mixingFrom = null;
	      this.mixingTo = null;
	      this.mixInterpolation = Interpolation.linear;
	      this.animation = null;
	      this.listener = null;
	      this.timelineMode.length = 0;
	      this.timelineHoldMix.length = 0;
	      this.timelinesRotation.length = 0;
	    }
	  }, {
	    key: "getAnimationTime",
	    value: function getAnimationTime() {
	      if (!this.loop) return Math.min(this.trackTime + this.animationStart, this.animationEnd);
	      var duration = this.animationEnd - this.animationStart;
	      if (duration === 0) return this.animationStart;
	      return this.trackTime % duration + this.animationStart;
	    }
	  }, {
	    key: "setAnimationLast",
	    value: function setAnimationLast(animationLast) {
	      this.animationLast = animationLast;
	      this.nextAnimationLast = animationLast;
	    }
	  }, {
	    key: "isComplete",
	    value: function isComplete() {
	      return this.trackTime >= this.animationEnd - this.animationStart;
	    }
	  }, {
	    key: "resetRotationDirections",
	    value: function resetRotationDirections() {
	      this.timelinesRotation.length = 0;
	    }
	  }, {
	    key: "getTrackComplete",
	    value: function getTrackComplete() {
	      var duration = this.animationEnd - this.animationStart;
	      if (duration !== 0) {
	        if (this.loop) return duration * (1 + (this.trackTime / duration | 0));
	        if (this.trackTime < duration) return duration;
	      }
	      return this.trackTime;
	    }
	  }, {
	    key: "wasApplied",
	    value: function wasApplied() {
	      return this.nextTrackLast !== -1;
	    }
	  }, {
	    key: "isNextReady",
	    value: function isNextReady() {
	      return this.next != null && this.nextTrackLast - this.next.delay >= 0;
	    }
	  }]);
	}();
	var EventQueue = function () {
	  function EventQueue(animState) {
	    _classCallCheck(this, EventQueue);
	    _defineProperty(this, "objects", []);
	    _defineProperty(this, "drainDisabled", false);
	    _defineProperty(this, "animState", void 0);
	    this.animState = animState;
	  }
	  return _createClass(EventQueue, [{
	    key: "start",
	    value: function start(entry) {
	      this.objects.push(EventType.start);
	      this.objects.push(entry);
	      this.animState.animationsChanged = true;
	    }
	  }, {
	    key: "interrupt",
	    value: function interrupt(entry) {
	      this.objects.push(EventType.interrupt);
	      this.objects.push(entry);
	    }
	  }, {
	    key: "end",
	    value: function end(entry) {
	      this.objects.push(EventType.end);
	      this.objects.push(entry);
	      this.animState.animationsChanged = true;
	    }
	  }, {
	    key: "dispose",
	    value: function dispose(entry) {
	      this.objects.push(EventType.dispose);
	      this.objects.push(entry);
	    }
	  }, {
	    key: "complete",
	    value: function complete(entry) {
	      this.objects.push(EventType.complete);
	      this.objects.push(entry);
	    }
	  }, {
	    key: "event",
	    value: function event(entry, _event2) {
	      this.objects.push(EventType.event);
	      this.objects.push(entry);
	      this.objects.push(_event2);
	    }
	  }, {
	    key: "drain",
	    value: function drain() {
	      var _entry$listener, _entry$listener2, _entry$listener3, _entry$listener4, _entry$listener5;
	      if (this.drainDisabled) return;
	      this.drainDisabled = true;
	      for (var i = 0; i < this.objects.length; i += 2) {
	        var objects = this.objects;
	        var type = objects[i];
	        var entry = objects[i + 1];
	        var listeners = this.animState.listeners.slice();
	        switch (type) {
	          case EventType.start:
	            if ((_entry$listener = entry.listener) !== null && _entry$listener !== void 0 && _entry$listener.start) entry.listener.start(entry);
	            for (var ii = 0; ii < listeners.length; ii++) {
	              var listener = listeners[ii];
	              if (listener.start) listener.start(entry);
	            }
	            break;
	          case EventType.interrupt:
	            if ((_entry$listener2 = entry.listener) !== null && _entry$listener2 !== void 0 && _entry$listener2.interrupt) entry.listener.interrupt(entry);
	            for (var _ii4 = 0; _ii4 < listeners.length; _ii4++) {
	              var _listener = listeners[_ii4];
	              if (_listener.interrupt) _listener.interrupt(entry);
	            }
	            break;
	          case EventType.end:
	            if ((_entry$listener3 = entry.listener) !== null && _entry$listener3 !== void 0 && _entry$listener3.end) entry.listener.end(entry);
	            for (var _ii5 = 0; _ii5 < listeners.length; _ii5++) {
	              var _listener2 = listeners[_ii5];
	              if (_listener2.end) _listener2.end(entry);
	            }
	          case EventType.dispose:
	            if ((_entry$listener4 = entry.listener) !== null && _entry$listener4 !== void 0 && _entry$listener4.dispose) entry.listener.dispose(entry);
	            for (var _ii6 = 0; _ii6 < listeners.length; _ii6++) {
	              var _listener3 = listeners[_ii6];
	              if (_listener3.dispose) _listener3.dispose(entry);
	            }
	            this.animState.trackEntryPool.free(entry);
	            break;
	          case EventType.complete:
	            if ((_entry$listener5 = entry.listener) !== null && _entry$listener5 !== void 0 && _entry$listener5.complete) entry.listener.complete(entry);
	            for (var _ii7 = 0; _ii7 < listeners.length; _ii7++) {
	              var _listener4 = listeners[_ii7];
	              if (_listener4.complete) _listener4.complete(entry);
	            }
	            break;
	          case EventType.event:
	            {
	              var _entry$listener6;
	              var event = objects[i++ + 2];
	              if ((_entry$listener6 = entry.listener) !== null && _entry$listener6 !== void 0 && _entry$listener6.event) entry.listener.event(entry, event);
	              for (var _ii8 = 0; _ii8 < listeners.length; _ii8++) {
	                var _listener5 = listeners[_ii8];
	                if (_listener5.event) _listener5.event(entry, event);
	              }
	              break;
	            }
	        }
	      }
	      this.clear();
	      this.drainDisabled = false;
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.objects.length = 0;
	    }
	  }]);
	}();
	var EventType;
	(function (EventType) {
	  EventType[EventType["start"] = 0] = "start";
	  EventType[EventType["interrupt"] = 1] = "interrupt";
	  EventType[EventType["end"] = 2] = "end";
	  EventType[EventType["dispose"] = 3] = "dispose";
	  EventType[EventType["complete"] = 4] = "complete";
	  EventType[EventType["event"] = 5] = "event";
	})(EventType || (EventType = {}));
	var AnimationStateAdapter = function () {
	  function AnimationStateAdapter() {
	    _classCallCheck(this, AnimationStateAdapter);
	  }
	  return _createClass(AnimationStateAdapter, [{
	    key: "start",
	    value: function start(entry) {}
	  }, {
	    key: "interrupt",
	    value: function interrupt(entry) {}
	  }, {
	    key: "end",
	    value: function end(entry) {}
	  }, {
	    key: "dispose",
	    value: function dispose(entry) {}
	  }, {
	    key: "complete",
	    value: function complete(entry) {}
	  }, {
	    key: "event",
	    value: function event(entry, _event3) {}
	  }]);
	}();
	var CURRENT = 0;
	var SETUP = 1;
	var FIRST = 2;
	var MODE = 3;
	var HOLD = 4;
	var ATTACH_SETUP = 1;
	var ATTACH_RETAIN = 2;

	var AnimationStateData = function () {
	  function AnimationStateData(skeletonData) {
	    _classCallCheck(this, AnimationStateData);
	    _defineProperty(this, "skeletonData", void 0);
	    _defineProperty(this, "animationToMixTime", {});
	    _defineProperty(this, "defaultMix", 0);
	    if (!skeletonData) throw new Error("skeletonData cannot be null.");
	    this.skeletonData = skeletonData;
	  }
	  return _createClass(AnimationStateData, [{
	    key: "setMix",
	    value: function setMix(from, to, duration) {
	      if (typeof from === "string") return this.setMix1(from, to, duration);
	      return this.setMix2(from, to, duration);
	    }
	  }, {
	    key: "setMix1",
	    value: function setMix1(fromName, toName, duration) {
	      var from = this.skeletonData.findAnimation(fromName);
	      if (!from) throw new Error("Animation not found: ".concat(fromName));
	      var to = this.skeletonData.findAnimation(toName);
	      if (!to) throw new Error("Animation not found: ".concat(toName));
	      this.setMix2(from, to, duration);
	    }
	  }, {
	    key: "setMix2",
	    value: function setMix2(from, to, duration) {
	      if (!from) throw new Error("from cannot be null.");
	      if (!to) throw new Error("to cannot be null.");
	      var key = "".concat(from.name, ".").concat(to.name);
	      this.animationToMixTime[key] = duration;
	    }
	  }, {
	    key: "getMix",
	    value: function getMix(from, to) {
	      var key = "".concat(from.name, ".").concat(to.name);
	      var value = this.animationToMixTime[key];
	      return value === undefined ? this.defaultMix : value;
	    }
	  }]);
	}();

	var AssetManagerBase = function () {
	  function AssetManagerBase(textureLoader) {
	    var pathPrefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
	    var downloader = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Downloader();
	    var cache = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : new AssetCache();
	    _classCallCheck(this, AssetManagerBase);
	    _defineProperty(this, "textureLoader", void 0);
	    _defineProperty(this, "pathPrefix", void 0);
	    _defineProperty(this, "downloader", void 0);
	    _defineProperty(this, "cache", void 0);
	    _defineProperty(this, "errors", {});
	    _defineProperty(this, "toLoad", 0);
	    _defineProperty(this, "loaded", 0);
	    _defineProperty(this, "texturePmaInfo", {});
	    this.textureLoader = textureLoader;
	    this.pathPrefix = pathPrefix;
	    this.downloader = downloader;
	    this.cache = cache;
	  }
	  return _createClass(AssetManagerBase, [{
	    key: "start",
	    value: function start(path) {
	      this.toLoad++;
	      return this.pathPrefix + path;
	    }
	  }, {
	    key: "success",
	    value: function success(callback, path, asset) {
	      this.toLoad--;
	      this.loaded++;
	      this.cache.assets[path] = asset;
	      this.cache.assetsRefCount[path] = (this.cache.assetsRefCount[path] || 0) + 1;
	      if (callback) callback(path, asset);
	    }
	  }, {
	    key: "error",
	    value: function error(callback, path, message) {
	      this.toLoad--;
	      this.loaded++;
	      this.errors[path] = message;
	      if (callback) callback(path, message);
	    }
	  }, {
	    key: "loadAll",
	    value: function loadAll() {
	      var _this = this;
	      var promise = new Promise(function (resolve, reject) {
	        var _check = function check() {
	          if (_this.isLoadingComplete()) {
	            if (_this.hasErrors()) reject(_this.errors);else resolve(_this);
	            return;
	          }
	          requestAnimationFrame(_check);
	        };
	        requestAnimationFrame(_check);
	      });
	      return promise;
	    }
	  }, {
	    key: "setRawDataURI",
	    value: function setRawDataURI(path, data) {
	      this.downloader.rawDataUris[this.pathPrefix + path] = data;
	    }
	  }, {
	    key: "loadBinary",
	    value: function loadBinary(path) {
	      var _this2 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      path = this.start(path);
	      if (this.reuseAssets(path, success, error)) return;
	      this.cache.assetsLoaded[path] = new Promise(function (resolve, reject) {
	        _this2.downloader.downloadBinary(path, function (data) {
	          _this2.success(success, path, data);
	          resolve(data);
	        }, function (status, responseText) {
	          var errorMsg = "Couldn't load binary ".concat(path, ": status ").concat(status, ", ").concat(responseText);
	          _this2.error(error, path, errorMsg);
	          reject(errorMsg);
	        });
	      });
	    }
	  }, {
	    key: "loadText",
	    value: function loadText(path) {
	      var _this3 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      path = this.start(path);
	      this.downloader.downloadText(path, function (data) {
	        _this3.success(success, path, data);
	      }, function (status, responseText) {
	        _this3.error(error, path, "Couldn't load text ".concat(path, ": status ").concat(status, ", ").concat(responseText));
	      });
	    }
	  }, {
	    key: "loadJson",
	    value: function loadJson(path) {
	      var _this4 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      path = this.start(path);
	      if (this.reuseAssets(path, success, error)) return;
	      this.cache.assetsLoaded[path] = new Promise(function (resolve, reject) {
	        _this4.downloader.downloadJson(path, function (data) {
	          _this4.success(success, path, data);
	          resolve(data);
	        }, function (status, responseText) {
	          var errorMsg = "Couldn't load JSON ".concat(path, ": status ").concat(status, ", ").concat(responseText);
	          _this4.error(error, path, errorMsg);
	          reject(errorMsg);
	        });
	      });
	    }
	  }, {
	    key: "reuseAssets",
	    value: function reuseAssets(path) {
	      var _this5 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      var loadedStatus = this.cache.getAsset(path);
	      var alreadyExistsOrLoading = loadedStatus !== undefined;
	      if (alreadyExistsOrLoading) {
	        this.cache.assetsLoaded[path] = loadedStatus.then(function (data) {
	          data = data instanceof Image || data instanceof ImageBitmap ? _this5.textureLoader(data) : data;
	          _this5.success(success, path, data);
	          return data;
	        }).catch(function (errorMsg) {
	          _this5.error(error, path, errorMsg);
	          return undefined;
	        });
	      }
	      return alreadyExistsOrLoading;
	    }
	  }, {
	    key: "loadTexture",
	    value: function loadTexture(path) {
	      var _this6 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      path = this.start(path);
	      if (this.reuseAssets(path, success, error)) return;
	      var pma = this.texturePmaInfo[path];
	      this.cache.assetsLoaded[path] = new Promise(function (resolve, reject) {
	        var isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document);
	        var isWebWorker = !isBrowser;
	        if (isWebWorker) {
	          fetch(path, {
	            mode: "cors"
	          }).then(function (response) {
	            if (response.ok) return response.blob();
	            var errorMsg = "Couldn't load image: ".concat(path);
	            _this6.error(error, path, "Couldn't load image: ".concat(path));
	            reject(errorMsg);
	          }).then(function (blob) {
	            return blob ? createImageBitmap(blob, {
	              premultiplyAlpha: "none",
	              colorSpaceConversion: "none"
	            }) : null;
	          }).then(function (bitmap) {
	            if (bitmap) {
	              var texture = _this6.createTexture(path, pma, bitmap);
	              _this6.success(success, path, texture);
	              resolve(texture);
	            }
	          });
	        } else {
	          var image = new Image();
	          image.crossOrigin = "anonymous";
	          image.onload = function () {
	            var texture = _this6.createTexture(path, pma, image);
	            _this6.success(success, path, texture);
	            resolve(texture);
	          };
	          image.onerror = function () {
	            var errorMsg = "Couldn't load image: ".concat(path);
	            _this6.error(error, path, errorMsg);
	            reject(errorMsg);
	          };
	          if (_this6.downloader.rawDataUris[path]) path = _this6.downloader.rawDataUris[path];
	          image.src = path;
	        }
	      });
	    }
	  }, {
	    key: "loadTextureAtlas",
	    value: function loadTextureAtlas(path) {
	      var _this7 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      var fileAlias = arguments.length > 3 ? arguments[3] : undefined;
	      var index = path.lastIndexOf("/");
	      var parent = index >= 0 ? path.substring(0, index + 1) : "";
	      path = this.start(path);
	      if (this.reuseAssets(path, success, error)) return;
	      this.cache.assetsLoaded[path] = new Promise(function (resolve, reject) {
	        _this7.downloader.downloadText(path, function (atlasText) {
	          try {
	            var atlas = _this7.createTextureAtlas(atlasText, parent, path, fileAlias);
	            var toLoad = atlas.pages.length,
	              abort = false;
	            if (toLoad === 0) {
	              _this7.success(success, path, atlas);
	              resolve(atlas);
	              return;
	            }
	            var _iterator = _createForOfIteratorHelper(atlas.pages),
	              _step;
	            try {
	              var _loop = function _loop() {
	                var page = _step.value;
	                _this7.loadTexture(_this7.texturePath(parent, page.name, fileAlias), function (imagePath, texture) {
	                  if (!abort) {
	                    page.setTexture(texture);
	                    if (--toLoad === 0) {
	                      _this7.success(success, path, atlas);
	                      resolve(atlas);
	                    }
	                  }
	                }, function (imagePath, message) {
	                  if (!abort) {
	                    var errorMsg = "Couldn't load texture ".concat(path, " page image: ").concat(imagePath);
	                    _this7.error(error, path, errorMsg);
	                    reject(errorMsg);
	                  }
	                  abort = true;
	                });
	              };
	              for (_iterator.s(); !(_step = _iterator.n()).done;) {
	                _loop();
	              }
	            } catch (err) {
	              _iterator.e(err);
	            } finally {
	              _iterator.f();
	            }
	          } catch (e) {
	            var errorMsg = "Couldn't parse texture atlas ".concat(path, ": ").concat(e.message);
	            _this7.error(error, path, errorMsg);
	            reject(errorMsg);
	          }
	        }, function (status, responseText) {
	          var errorMsg = "Couldn't load texture atlas ".concat(path, ": status ").concat(status, ", ").concat(responseText);
	          _this7.error(error, path, errorMsg);
	          reject(errorMsg);
	        });
	      });
	    }
	  }, {
	    key: "loadTextureAtlasButNoTextures",
	    value: function loadTextureAtlasButNoTextures(path) {
	      var _this8 = this;
	      var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
	      var error = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
	      var index = path.lastIndexOf("/");
	      var parent = index >= 0 ? path.substring(0, index + 1) : "";
	      path = this.start(path);
	      if (this.reuseAssets(path, success, error)) return;
	      this.cache.assetsLoaded[path] = new Promise(function (resolve, reject) {
	        _this8.downloader.downloadText(path, function (atlasText) {
	          try {
	            var atlas = _this8.createTextureAtlas(atlasText, parent, path);
	            _this8.success(success, path, atlas);
	            resolve(atlas);
	          } catch (e) {
	            var errorMsg = "Couldn't parse texture atlas ".concat(path, ": ").concat(e.message);
	            _this8.error(error, path, errorMsg);
	            reject(errorMsg);
	          }
	        }, function (status, responseText) {
	          var errorMsg = "Couldn't load texture atlas ".concat(path, ": status ").concat(status, ", ").concat(responseText);
	          _this8.error(error, path, errorMsg);
	          reject(errorMsg);
	        });
	      });
	    }
	  }, {
	    key: "loadBinaryAsync",
	    value: function () {
	      var _loadBinaryAsync = _asyncToGenerator(_regenerator().m(function _callee(path) {
	        var _this9 = this;
	        return _regenerator().w(function (_context) {
	          while (1) switch (_context.n) {
	            case 0:
	              return _context.a(2, new Promise(function (resolve, reject) {
	                _this9.loadBinary(path, function (_, binary) {
	                  return resolve(binary);
	                }, function (_, message) {
	                  return reject(message);
	                });
	              }));
	          }
	        }, _callee);
	      }));
	      function loadBinaryAsync(_x) {
	        return _loadBinaryAsync.apply(this, arguments);
	      }
	      return loadBinaryAsync;
	    }()
	  }, {
	    key: "loadJsonAsync",
	    value: function () {
	      var _loadJsonAsync = _asyncToGenerator(_regenerator().m(function _callee2(path) {
	        var _this0 = this;
	        return _regenerator().w(function (_context2) {
	          while (1) switch (_context2.n) {
	            case 0:
	              return _context2.a(2, new Promise(function (resolve, reject) {
	                _this0.loadJson(path, function (_, object) {
	                  return resolve(object);
	                }, function (_, message) {
	                  return reject(message);
	                });
	              }));
	          }
	        }, _callee2);
	      }));
	      function loadJsonAsync(_x2) {
	        return _loadJsonAsync.apply(this, arguments);
	      }
	      return loadJsonAsync;
	    }()
	  }, {
	    key: "loadTextureAsync",
	    value: function () {
	      var _loadTextureAsync = _asyncToGenerator(_regenerator().m(function _callee3(path) {
	        var _this1 = this;
	        return _regenerator().w(function (_context3) {
	          while (1) switch (_context3.n) {
	            case 0:
	              return _context3.a(2, new Promise(function (resolve, reject) {
	                _this1.loadTexture(path, function (_, texture) {
	                  return resolve(texture);
	                }, function (_, message) {
	                  return reject(message);
	                });
	              }));
	          }
	        }, _callee3);
	      }));
	      function loadTextureAsync(_x3) {
	        return _loadTextureAsync.apply(this, arguments);
	      }
	      return loadTextureAsync;
	    }()
	  }, {
	    key: "loadTextureAtlasAsync",
	    value: function () {
	      var _loadTextureAtlasAsync = _asyncToGenerator(_regenerator().m(function _callee4(path) {
	        var _this10 = this;
	        return _regenerator().w(function (_context4) {
	          while (1) switch (_context4.n) {
	            case 0:
	              return _context4.a(2, new Promise(function (resolve, reject) {
	                _this10.loadTextureAtlas(path, function (_, atlas) {
	                  return resolve(atlas);
	                }, function (_, message) {
	                  return reject(message);
	                });
	              }));
	          }
	        }, _callee4);
	      }));
	      function loadTextureAtlasAsync(_x4) {
	        return _loadTextureAtlasAsync.apply(this, arguments);
	      }
	      return loadTextureAtlasAsync;
	    }()
	  }, {
	    key: "loadTextureAtlasButNoTexturesAsync",
	    value: function () {
	      var _loadTextureAtlasButNoTexturesAsync = _asyncToGenerator(_regenerator().m(function _callee5(path) {
	        var _this11 = this;
	        return _regenerator().w(function (_context5) {
	          while (1) switch (_context5.n) {
	            case 0:
	              return _context5.a(2, new Promise(function (resolve, reject) {
	                _this11.loadTextureAtlasButNoTextures(path, function (_, atlas) {
	                  return resolve(atlas);
	                }, function (_, message) {
	                  return reject(message);
	                });
	              }));
	          }
	        }, _callee5);
	      }));
	      function loadTextureAtlasButNoTexturesAsync(_x5) {
	        return _loadTextureAtlasButNoTexturesAsync.apply(this, arguments);
	      }
	      return loadTextureAtlasButNoTexturesAsync;
	    }()
	  }, {
	    key: "setCache",
	    value: function setCache(cache) {
	      this.cache = cache;
	    }
	  }, {
	    key: "get",
	    value: function get(path) {
	      return this.cache.assets[this.pathPrefix + path];
	    }
	  }, {
	    key: "require",
	    value: function require(path) {
	      path = this.pathPrefix + path;
	      var asset = this.cache.assets[path];
	      if (asset) return asset;
	      var error = this.errors[path];
	      throw Error("Asset not found: ".concat(path).concat(error ? "\n".concat(error) : ""));
	    }
	  }, {
	    key: "remove",
	    value: function remove(path) {
	      path = this.pathPrefix + path;
	      var asset = this.cache.assets[path];
	      if (asset.dispose) asset.dispose();
	      delete this.cache.assets[path];
	      delete this.cache.assetsRefCount[path];
	      delete this.cache.assetsLoaded[path];
	      return asset;
	    }
	  }, {
	    key: "removeAll",
	    value: function removeAll() {
	      for (var path in this.cache.assets) {
	        var asset = this.cache.assets[path];
	        if (asset.dispose) asset.dispose();
	      }
	      this.cache.assets = {};
	      this.cache.assetsLoaded = {};
	      this.cache.assetsRefCount = {};
	    }
	  }, {
	    key: "isLoadingComplete",
	    value: function isLoadingComplete() {
	      return this.toLoad === 0;
	    }
	  }, {
	    key: "getToLoad",
	    value: function getToLoad() {
	      return this.toLoad;
	    }
	  }, {
	    key: "getLoaded",
	    value: function getLoaded() {
	      return this.loaded;
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      this.removeAll();
	    }
	  }, {
	    key: "disposeAsset",
	    value: function disposeAsset(path) {
	      var asset = this.cache.assets[path];
	      if (asset instanceof TextureAtlas) {
	        asset.dispose();
	        return;
	      }
	      this.disposeAssetInternal(path);
	    }
	  }, {
	    key: "hasErrors",
	    value: function hasErrors() {
	      return Object.keys(this.errors).length > 0;
	    }
	  }, {
	    key: "getErrors",
	    value: function getErrors() {
	      return this.errors;
	    }
	  }, {
	    key: "disposeAssetInternal",
	    value: function disposeAssetInternal(path) {
	      if (this.cache.assetsRefCount[path] > 0 && --this.cache.assetsRefCount[path] === 0) {
	        return this.remove(path);
	      }
	    }
	  }, {
	    key: "createTextureAtlas",
	    value: function createTextureAtlas(atlasText, parentPath, path, fileAlias) {
	      var _this12 = this;
	      var atlas = new TextureAtlas(atlasText);
	      atlas.dispose = function () {
	        if (_this12.cache.assetsRefCount[path] <= 0) return;
	        _this12.disposeAssetInternal(path);
	        var _iterator2 = _createForOfIteratorHelper(atlas.pages),
	          _step2;
	        try {
	          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	            var _page$texture;
	            var page = _step2.value;
	            (_page$texture = page.texture) === null || _page$texture === void 0 || _page$texture.dispose();
	          }
	        } catch (err) {
	          _iterator2.e(err);
	        } finally {
	          _iterator2.f();
	        }
	      };
	      var _iterator3 = _createForOfIteratorHelper(atlas.pages),
	        _step3;
	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var page = _step3.value;
	          var texturePath = this.texturePath(parentPath, page.name, fileAlias);
	          this.texturePmaInfo[this.pathPrefix + texturePath] = page.pma;
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	      return atlas;
	    }
	  }, {
	    key: "createTexture",
	    value: function createTexture(path, pma, image) {
	      var _this13 = this;
	      var texture = this.textureLoader(image, pma);
	      var textureDispose = texture.dispose.bind(texture);
	      texture.dispose = function () {
	        if (_this13.disposeAssetInternal(path)) textureDispose();
	      };
	      return texture;
	    }
	  }, {
	    key: "texturePath",
	    value: function texturePath(parentPath, pageName, fileAlias) {
	      if (!fileAlias) return parentPath + pageName;
	      return fileAlias[pageName];
	    }
	  }]);
	}();
	var AssetCache = function () {
	  function AssetCache() {
	    _classCallCheck(this, AssetCache);
	    _defineProperty(this, "assets", {});
	    _defineProperty(this, "assetsRefCount", {});
	    _defineProperty(this, "assetsLoaded", {});
	  }
	  return _createClass(AssetCache, [{
	    key: "addAsset",
	    value: function () {
	      var _addAsset = _asyncToGenerator(_regenerator().m(function _callee6(path, asset) {
	        return _regenerator().w(function (_context6) {
	          while (1) switch (_context6.n) {
	            case 0:
	              this.assetsLoaded[path] = Promise.resolve(asset);
	              this.assets[path] = asset;
	              return _context6.a(2, asset);
	          }
	        }, _callee6, this);
	      }));
	      function addAsset(_x6, _x7) {
	        return _addAsset.apply(this, arguments);
	      }
	      return addAsset;
	    }()
	  }, {
	    key: "getAsset",
	    value: function getAsset(path) {
	      return this.assetsLoaded[path];
	    }
	  }], [{
	    key: "getCache",
	    value: function getCache(id) {
	      var cache = AssetCache.AVAILABLE_CACHES.get(id);
	      if (cache) return cache;
	      var newCache = new AssetCache();
	      AssetCache.AVAILABLE_CACHES.set(id, newCache);
	      return newCache;
	    }
	  }]);
	}();
	_defineProperty(AssetCache, "AVAILABLE_CACHES", new Map());
	var Downloader = function () {
	  function Downloader() {
	    _classCallCheck(this, Downloader);
	    _defineProperty(this, "callbacks", {});
	    _defineProperty(this, "rawDataUris", {});
	  }
	  return _createClass(Downloader, [{
	    key: "dataUriToString",
	    value: function dataUriToString(dataUri) {
	      if (!dataUri.startsWith("data:")) {
	        throw new Error("Not a data URI.");
	      }
	      var base64Idx = dataUri.indexOf("base64,");
	      if (base64Idx !== -1) {
	        base64Idx += "base64,".length;
	        return atob(dataUri.substr(base64Idx));
	      } else {
	        return dataUri.substr(dataUri.indexOf(",") + 1);
	      }
	    }
	  }, {
	    key: "base64ToUint8Array",
	    value: function base64ToUint8Array(base64) {
	      var binary_string = window.atob(base64);
	      var len = binary_string.length;
	      var bytes = new Uint8Array(len);
	      for (var i = 0; i < len; i++) {
	        bytes[i] = binary_string.charCodeAt(i);
	      }
	      return bytes;
	    }
	  }, {
	    key: "dataUriToUint8Array",
	    value: function dataUriToUint8Array(dataUri) {
	      if (!dataUri.startsWith("data:")) {
	        throw new Error("Not a data URI.");
	      }
	      var base64Idx = dataUri.indexOf("base64,");
	      if (base64Idx === -1) throw new Error("Not a binary data URI.");
	      base64Idx += "base64,".length;
	      return this.base64ToUint8Array(dataUri.substr(base64Idx));
	    }
	  }, {
	    key: "downloadText",
	    value: function downloadText(url, success, error) {
	      var _this14 = this;
	      if (this.start(url, success, error)) return;
	      var rawDataUri = this.rawDataUris[url];
	      if (rawDataUri && !rawDataUri.includes(".")) {
	        try {
	          this.finish(url, 200, this.dataUriToString(rawDataUri));
	        } catch (e) {
	          this.finish(url, 400, JSON.stringify(e));
	        }
	        return;
	      }
	      var request = new XMLHttpRequest();
	      request.overrideMimeType("text/html");
	      request.open("GET", rawDataUri ? rawDataUri : url, true);
	      var done = function done() {
	        _this14.finish(url, request.status, request.responseText);
	      };
	      request.onload = done;
	      request.onerror = done;
	      request.send();
	    }
	  }, {
	    key: "downloadJson",
	    value: function downloadJson(url, success, error) {
	      this.downloadText(url, function (data) {
	        success(JSON.parse(data));
	      }, error);
	    }
	  }, {
	    key: "downloadBinary",
	    value: function downloadBinary(url, success, error) {
	      var _this15 = this;
	      if (this.start(url, success, error)) return;
	      var rawDataUri = this.rawDataUris[url];
	      if (rawDataUri && !rawDataUri.includes(".")) {
	        try {
	          this.finish(url, 200, this.dataUriToUint8Array(rawDataUri));
	        } catch (e) {
	          this.finish(url, 400, JSON.stringify(e));
	        }
	        return;
	      }
	      var request = new XMLHttpRequest();
	      request.open("GET", rawDataUri ? rawDataUri : url, true);
	      request.responseType = "arraybuffer";
	      var onerror = function onerror() {
	        _this15.finish(url, request.status, request.response);
	      };
	      request.onload = function () {
	        if (request.status === 200 || request.status === 0) _this15.finish(url, 200, new Uint8Array(request.response));else onerror();
	      };
	      request.onerror = onerror;
	      request.send();
	    }
	  }, {
	    key: "start",
	    value: function start(url, success, error) {
	      var callbacks = this.callbacks[url];
	      try {
	        if (callbacks) return true;
	        this.callbacks[url] = callbacks = [];
	      } finally {
	        callbacks.push(success, error);
	      }
	    }
	  }, {
	    key: "finish",
	    value: function finish(url, status, data) {
	      var callbacks = this.callbacks[url];
	      delete this.callbacks[url];
	      if (status === 200 || status === 0) {
	        for (var i = 0, n = callbacks.length; i < n; i += 2) callbacks[i](data);
	      } else {
	        for (var _i = 1, _n = callbacks.length; _i < _n; _i += 2) callbacks[_i](status, data);
	      }
	    }
	  }]);
	}();

	var BoundingBoxAttachment = function (_VertexAttachment) {
	  function BoundingBoxAttachment(name) {
	    var _this;
	    _classCallCheck(this, BoundingBoxAttachment);
	    _this = _callSuper(this, BoundingBoxAttachment, [name]);
	    _defineProperty(_this, "color", new Color(1, 1, 1, 1));
	    return _this;
	  }
	  _inherits(BoundingBoxAttachment, _VertexAttachment);
	  return _createClass(BoundingBoxAttachment, [{
	    key: "copy",
	    value: function copy() {
	      var copy = new BoundingBoxAttachment(this.name);
	      this.copyTo(copy);
	      copy.color.setFromColor(this.color);
	      return copy;
	    }
	  }]);
	}(VertexAttachment);

	var ClippingAttachment = function (_VertexAttachment) {
	  function ClippingAttachment(name) {
	    var _this;
	    _classCallCheck(this, ClippingAttachment);
	    _this = _callSuper(this, ClippingAttachment, [name]);
	    _defineProperty(_this, "endSlot", null);
	    _defineProperty(_this, "convex", false);
	    _defineProperty(_this, "inverse", false);
	    _defineProperty(_this, "color", new Color(0.2275, 0.2275, 0.8078, 1));
	    return _this;
	  }
	  _inherits(ClippingAttachment, _VertexAttachment);
	  return _createClass(ClippingAttachment, [{
	    key: "copy",
	    value: function copy() {
	      var copy = new ClippingAttachment(this.name);
	      this.copyTo(copy);
	      copy.endSlot = this.endSlot;
	      copy.convex = this.convex;
	      copy.inverse = this.inverse;
	      copy.color.setFromColor(this.color);
	      return copy;
	    }
	  }]);
	}(VertexAttachment);

	var PathAttachment = function (_VertexAttachment) {
	  function PathAttachment(name) {
	    var _this;
	    _classCallCheck(this, PathAttachment);
	    _this = _callSuper(this, PathAttachment, [name]);
	    _defineProperty(_this, "lengths", []);
	    _defineProperty(_this, "closed", false);
	    _defineProperty(_this, "constantSpeed", false);
	    _defineProperty(_this, "color", new Color(1, 1, 1, 1));
	    return _this;
	  }
	  _inherits(PathAttachment, _VertexAttachment);
	  return _createClass(PathAttachment, [{
	    key: "copy",
	    value: function copy() {
	      var copy = new PathAttachment(this.name);
	      this.copyTo(copy);
	      copy.lengths = [];
	      Utils.arrayCopy(this.lengths, 0, copy.lengths, 0, this.lengths.length);
	      copy.closed = this.closed;
	      copy.constantSpeed = this.constantSpeed;
	      copy.color.setFromColor(this.color);
	      return copy;
	    }
	  }]);
	}(VertexAttachment);

	var PointAttachment = function (_VertexAttachment) {
	  function PointAttachment(name) {
	    var _this;
	    _classCallCheck(this, PointAttachment);
	    _this = _callSuper(this, PointAttachment, [name]);
	    _defineProperty(_this, "x", 0);
	    _defineProperty(_this, "y", 0);
	    _defineProperty(_this, "rotation", 0);
	    _defineProperty(_this, "color", new Color(0.38, 0.94, 0, 1));
	    return _this;
	  }
	  _inherits(PointAttachment, _VertexAttachment);
	  return _createClass(PointAttachment, [{
	    key: "computeWorldPosition",
	    value: function computeWorldPosition(bone, point) {
	      point.x = this.x * bone.a + this.y * bone.b + bone.worldX;
	      point.y = this.x * bone.c + this.y * bone.d + bone.worldY;
	      return point;
	    }
	  }, {
	    key: "computeWorldRotation",
	    value: function computeWorldRotation(bone) {
	      var r = this.rotation * MathUtils.degRad,
	        cos = Math.cos(r),
	        sin = Math.sin(r);
	      var x = cos * bone.a + sin * bone.b;
	      var y = cos * bone.c + sin * bone.d;
	      return MathUtils.atan2Deg(y, x);
	    }
	  }, {
	    key: "copy",
	    value: function copy() {
	      var copy = new PointAttachment(this.name);
	      copy.x = this.x;
	      copy.y = this.y;
	      copy.rotation = this.rotation;
	      copy.color.setFromColor(this.color);
	      return copy;
	    }
	  }]);
	}(VertexAttachment);

	var AtlasAttachmentLoader = function () {
	  function AtlasAttachmentLoader(atlas) {
	    var allowMissingRegions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
	    _classCallCheck(this, AtlasAttachmentLoader);
	    _defineProperty(this, "atlas", void 0);
	    _defineProperty(this, "allowMissingRegions", void 0);
	    this.atlas = atlas;
	    this.allowMissingRegions = allowMissingRegions;
	  }
	  return _createClass(AtlasAttachmentLoader, [{
	    key: "findRegions",
	    value: function findRegions(name, basePath, sequence) {
	      var regions = sequence.regions;
	      for (var i = 0, n = regions.length; i < n; i++) regions[i] = this.findRegion(name, sequence.getPath(basePath, i));
	    }
	  }, {
	    key: "findRegion",
	    value: function findRegion(name, path) {
	      var region = this.atlas.findRegion(path);
	      if (!region && !this.allowMissingRegions) throw new Error("Region not found in atlas: ".concat(path, " (attachment: ").concat(name, ")"));
	      return region;
	    }
	  }, {
	    key: "newRegionAttachment",
	    value: function newRegionAttachment(skin, placeholder, name, path, sequence) {
	      this.findRegions(name, path, sequence);
	      return new RegionAttachment(name, sequence);
	    }
	  }, {
	    key: "newMeshAttachment",
	    value: function newMeshAttachment(skin, placeholder, name, path, sequence) {
	      this.findRegions(name, path, sequence);
	      return new MeshAttachment(name, sequence);
	    }
	  }, {
	    key: "newBoundingBoxAttachment",
	    value: function newBoundingBoxAttachment(skin, placeholder, name) {
	      return new BoundingBoxAttachment(name);
	    }
	  }, {
	    key: "newPathAttachment",
	    value: function newPathAttachment(skin, placeholder, name) {
	      return new PathAttachment(name);
	    }
	  }, {
	    key: "newPointAttachment",
	    value: function newPointAttachment(skin, placeholder, name) {
	      return new PointAttachment(name);
	    }
	  }, {
	    key: "newClippingAttachment",
	    value: function newClippingAttachment(skin, placeholder, name) {
	      return new ClippingAttachment(name);
	    }
	  }]);
	}();

	var PosedData = _createClass(function PosedData(name, setupPose) {
	  _classCallCheck(this, PosedData);
	  _defineProperty(this, "name", void 0);
	  _defineProperty(this, "setupPose", void 0);
	  _defineProperty(this, "skinRequired", false);
	  if (name == null) throw new Error("name cannot be null.");
	  this.name = name;
	  this.setupPose = setupPose;
	});

	var BoneData = function (_PosedData) {
	  function BoneData(index, name, parent) {
	    var _this;
	    _classCallCheck(this, BoneData);
	    _this = _callSuper(this, BoneData, [name, new BonePose()]);
	    _defineProperty(_this, "index", 0);
	    _defineProperty(_this, "parent", null);
	    _defineProperty(_this, "length", 0);
	    _defineProperty(_this, "color", new Color());
	    _defineProperty(_this, "icon", void 0);
	    _defineProperty(_this, "iconSize", 1);
	    _defineProperty(_this, "iconRotation", 0);
	    _defineProperty(_this, "visible", false);
	    if (index < 0) throw new Error("index must be >= 0.");
	    if (!name) throw new Error("name cannot be null.");
	    _this.index = index;
	    _this.parent = parent;
	    return _this;
	  }
	  _inherits(BoneData, _PosedData);
	  return _createClass(BoneData, [{
	    key: "copy",
	    value: function copy(parent) {
	      var copy = new BoneData(this.index, this.name, parent);
	      copy.length = this.length;
	      copy.setupPose.set(this.setupPose);
	      return copy;
	    }
	  }]);
	}(PosedData);
	var Inherit;
	(function (Inherit) {
	  Inherit[Inherit["Normal"] = 0] = "Normal";
	  Inherit[Inherit["OnlyTranslation"] = 1] = "OnlyTranslation";
	  Inherit[Inherit["NoRotationOrReflection"] = 2] = "NoRotationOrReflection";
	  Inherit[Inherit["NoScale"] = 3] = "NoScale";
	  Inherit[Inherit["NoScaleOrReflection"] = 4] = "NoScaleOrReflection";
	})(Inherit || (Inherit = {}));

	var BonePose = function () {
	  function BonePose() {
	    _classCallCheck(this, BonePose);
	    _defineProperty(this, "bone", void 0);
	    _defineProperty(this, "x", 0);
	    _defineProperty(this, "y", 0);
	    _defineProperty(this, "rotation", 0);
	    _defineProperty(this, "scaleX", 0);
	    _defineProperty(this, "scaleY", 0);
	    _defineProperty(this, "shearX", 0);
	    _defineProperty(this, "shearY", 0);
	    _defineProperty(this, "inherit", Inherit.Normal);
	    _defineProperty(this, "a", 0);
	    _defineProperty(this, "b", 0);
	    _defineProperty(this, "c", 0);
	    _defineProperty(this, "d", 0);
	    _defineProperty(this, "worldY", 0);
	    _defineProperty(this, "worldX", 0);
	    _defineProperty(this, "world", 0);
	    _defineProperty(this, "local", 0);
	  }
	  return _createClass(BonePose, [{
	    key: "set",
	    value: function set(pose) {
	      if (pose == null) throw new Error("pose cannot be null.");
	      this.x = pose.x;
	      this.y = pose.y;
	      this.rotation = pose.rotation;
	      this.scaleX = pose.scaleX;
	      this.scaleY = pose.scaleY;
	      this.shearX = pose.shearX;
	      this.shearY = pose.shearY;
	      this.inherit = pose.inherit;
	    }
	  }, {
	    key: "setPosition",
	    value: function setPosition(x, y) {
	      this.x = x;
	      this.y = y;
	    }
	  }, {
	    key: "setScale",
	    value: function setScale(scaleOrX, scaleY) {
	      this.scaleX = scaleOrX;
	      this.scaleY = scaleY === undefined ? scaleOrX : scaleY;
	    }
	  }, {
	    key: "getInherit",
	    value: function getInherit() {
	      return this.inherit;
	    }
	  }, {
	    key: "setInherit",
	    value: function setInherit(inherit) {
	      if (inherit == null) throw new Error("inherit cannot be null.");
	      this.inherit = inherit;
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      if (this.world !== skeleton._update) this.updateWorldTransform(skeleton);
	    }
	  }, {
	    key: "updateWorldTransform",
	    value: function updateWorldTransform(skeleton) {
	      if (this.local === skeleton._update) this.updateLocalTransform(skeleton);else this.world = skeleton._update;
	      var rotation = this.rotation;
	      var scaleX = this.scaleX;
	      var scaleY = this.scaleY;
	      var shearX = this.shearX;
	      var shearY = this.shearY;
	      if (!this.bone.parent) {
	        var sx = skeleton.scaleX,
	          sy = skeleton.scaleY;
	        var rx = (rotation + shearX) * MathUtils.degRad;
	        var ry = (rotation + 90 + shearY) * MathUtils.degRad;
	        this.a = Math.cos(rx) * scaleX * sx;
	        this.b = Math.cos(ry) * scaleY * sx;
	        this.c = Math.sin(rx) * scaleX * sy;
	        this.d = Math.sin(ry) * scaleY * sy;
	        this.worldX = this.x * sx + skeleton.x;
	        this.worldY = this.y * sy + skeleton.y;
	        return;
	      }
	      var parent = this.bone.parent.appliedPose;
	      var pa = parent.a,
	        pb = parent.b,
	        pc = parent.c,
	        pd = parent.d;
	      this.worldX = pa * this.x + pb * this.y + parent.worldX;
	      this.worldY = pc * this.x + pd * this.y + parent.worldY;
	      switch (this.inherit) {
	        case Inherit.Normal:
	          {
	            var _rx = (rotation + shearX) * MathUtils.degRad;
	            var _ry = (rotation + 90 + shearY) * MathUtils.degRad;
	            var la = Math.cos(_rx) * scaleX;
	            var lb = Math.cos(_ry) * scaleY;
	            var lc = Math.sin(_rx) * scaleX;
	            var ld = Math.sin(_ry) * scaleY;
	            this.a = pa * la + pb * lc;
	            this.b = pa * lb + pb * ld;
	            this.c = pc * la + pd * lc;
	            this.d = pc * lb + pd * ld;
	            return;
	          }
	        case Inherit.OnlyTranslation:
	          {
	            var _sx = skeleton.scaleX,
	              _sy = skeleton.scaleY;
	            var _rx2 = (rotation + shearX) * MathUtils.degRad;
	            var _ry2 = (rotation + 90 + shearY) * MathUtils.degRad;
	            this.a = Math.cos(_rx2) * scaleX * _sx;
	            this.b = Math.cos(_ry2) * scaleY * _sx;
	            this.c = Math.sin(_rx2) * scaleX * _sy;
	            this.d = Math.sin(_ry2) * scaleY * _sy;
	            break;
	          }
	        case Inherit.NoRotationOrReflection:
	          {
	            var _sx2 = skeleton.scaleX,
	              _sy2 = skeleton.scaleY,
	              sxi = 1 / _sx2,
	              syi = 1 / _sy2;
	            pa *= sxi;
	            pc *= syi;
	            var s = pa * pa + pc * pc;
	            var r = 0;
	            if (s > MathUtils.epsilon2) {
	              s = Math.abs(pa * pd * syi - pb * sxi * pc) / s;
	              pb = pc * s;
	              pd = pa * s;
	              r = rotation - MathUtils.atan2Deg(pc, pa);
	            } else {
	              pa = 0;
	              pc = 0;
	              r = rotation - 90 + MathUtils.atan2Deg(pd, pb);
	            }
	            var _rx3 = (r + shearX) * MathUtils.degRad;
	            var _ry3 = (r + shearY + 90) * MathUtils.degRad;
	            var _la = Math.cos(_rx3) * scaleX;
	            var _lb = Math.cos(_ry3) * scaleY;
	            var _lc = Math.sin(_rx3) * scaleX;
	            var _ld = Math.sin(_ry3) * scaleY;
	            this.a = (pa * _la - pb * _lc) * _sx2;
	            this.b = (pa * _lb - pb * _ld) * _sx2;
	            this.c = (pc * _la + pd * _lc) * _sy2;
	            this.d = (pc * _lb + pd * _ld) * _sy2;
	            break;
	          }
	        case Inherit.NoScale:
	        case Inherit.NoScaleOrReflection:
	          {
	            var _sx3 = skeleton.scaleX,
	              _sy3 = skeleton.scaleY,
	              _sxi = 1 / _sx3,
	              _syi = 1 / _sy3;
	            var _r = rotation * MathUtils.degRad,
	              cos = Math.cos(_r),
	              sin = Math.sin(_r);
	            var za = (pa * cos + pb * sin) * _sxi;
	            var zc = (pc * cos + pd * sin) * _syi;
	            var _s = 1 / Math.sqrt(za * za + zc * zc);
	            za *= _s;
	            zc *= _s;
	            var zb = -zc,
	              zd = za;
	            if (this.inherit === Inherit.NoScale && pa * pd - pb * pc < 0 !== (_sx3 < 0 !== _sy3 < 0)) {
	              zb = -zb;
	              zd = -zd;
	            }
	            var _rx4 = shearX * MathUtils.degRad;
	            var _ry4 = (90 + shearY) * MathUtils.degRad;
	            var _la2 = Math.cos(_rx4) * scaleX;
	            var _lb2 = Math.cos(_ry4) * scaleY;
	            var _lc2 = Math.sin(_rx4) * scaleX;
	            var _ld2 = Math.sin(_ry4) * scaleY;
	            this.a = (za * _la2 + zb * _lc2) * _sx3;
	            this.b = (za * _lb2 + zb * _ld2) * _sx3;
	            this.c = (zc * _la2 + zd * _lc2) * _sy3;
	            this.d = (zc * _lb2 + zd * _ld2) * _sy3;
	            break;
	          }
	      }
	    }
	  }, {
	    key: "updateLocalTransform",
	    value: function updateLocalTransform(skeleton) {
	      this.local = 0;
	      this.world = skeleton._update;
	      var sx = skeleton.scaleX,
	        sy = skeleton.scaleY;
	      if (!this.bone.parent) {
	        var sxi = 1 / sx,
	          syi = 1 / sy;
	        this.x = (this.worldX - skeleton.x) * sxi;
	        this.y = (this.worldY - skeleton.y) * syi;
	        this.set5(this.a * sxi, this.b * sxi, this.c * syi, this.d * syi, 0);
	        return;
	      }
	      var parent = this.bone.parent.appliedPose;
	      var pa = parent.a,
	        pb = parent.b,
	        pc = parent.c,
	        pd = parent.d;
	      var pad = pa * pd - pb * pc,
	        pid = 1 / (pa * pd - pb * pc);
	      var ia = pd * pid,
	        ib = pb * pid,
	        ic = pc * pid,
	        id = pa * pid;
	      var dx = this.worldX - parent.worldX,
	        dy = this.worldY - parent.worldY;
	      this.x = dx * ia - dy * ib;
	      this.y = dy * id - dx * ic;
	      switch (this.inherit) {
	        case Inherit.Normal:
	          this.set5(ia * this.a - ib * this.c, ia * this.b - ib * this.d, id * this.c - ic * this.a, id * this.d - ic * this.b, 0);
	          break;
	        case Inherit.OnlyTranslation:
	          {
	            var _sxi2 = 1 / sx,
	              _syi2 = 1 / sy;
	            this.set5(this.a * _sxi2, this.b * _sxi2, this.c * _syi2, this.d * _syi2, 0);
	            break;
	          }
	        case Inherit.NoRotationOrReflection:
	          {
	            var _sxi3 = 1 / sx,
	              _syi3 = 1 / sy;
	            pa *= _sxi3;
	            pc *= _syi3;
	            var wa = this.a * _sxi3,
	              wb = this.b * _sxi3,
	              wc = this.c * _syi3,
	              wd = this.d * _syi3;
	            var s = 1 / (pa * pa + pc * pc),
	              det = 1 / Math.abs(pad * _sxi3 * _syi3);
	            this.set5((pa * wa + pc * wc) * s, (pa * wb + pc * wd) * s, (pa * wc - pc * wa) * det, (pa * wd - pc * wb) * det, MathUtils.atan2Deg(pc, pa));
	            break;
	          }
	        case Inherit.NoScale:
	        case Inherit.NoScaleOrReflection:
	          {
	            var _sxi4 = 1 / sx,
	              _syi4 = 1 / sy;
	            var _wa = this.a * _sxi4,
	              _wb = this.b * _sxi4,
	              _wc = this.c * _syi4,
	              _wd = this.d * _syi4;
	            var tx = pd * this.a - pb * this.c,
	              ty = pa * this.c - pc * this.a;
	            if (pad < 0) {
	              tx = -tx;
	              ty = -ty;
	            }
	            var r = MathUtils.atan2Deg(ty, tx);
	            this.rotation = r;
	            r *= MathUtils.degRad;
	            var cos = Math.cos(r),
	              sin = Math.sin(r);
	            var za = (pa * cos + pb * sin) * _sxi4;
	            var zc = (pc * cos + pd * sin) * _syi4;
	            var _s2 = 1 / Math.sqrt(za * za + zc * zc);
	            za *= _s2;
	            zc *= _s2;
	            var si = this.inherit === Inherit.NoScale && pad < 0 !== (sx < 0 !== sy < 0) ? -1 : 1;
	            this.set4(za * _wa + zc * _wc, za * _wb + zc * _wd, (za * _wc - zc * _wa) * si, (za * _wd - zc * _wb) * si);
	          }
	      }
	    }
	  }, {
	    key: "set4",
	    value: function set4(ra, rb, rc, rd) {
	      var x = ra * ra + rc * rc,
	        y = rb * rb + rd * rd;
	      if (x > MathUtils.epsilon2) {
	        this.shearX = MathUtils.atan2Deg(rc, ra);
	        this.scaleX = Math.sqrt(x);
	      } else {
	        this.shearX = 0;
	        this.scaleX = 0;
	      }
	      this.scaleY = Math.sqrt(y);
	      if (y > MathUtils.epsilon2) {
	        this.shearY = MathUtils.atan2Deg(rd, rb);
	        if (ra * rd - rb * rc < 0) {
	          this.scaleY = -this.scaleY;
	          this.shearY += 90;
	        } else this.shearY -= 90;
	        if (this.shearY > 180) this.shearY -= 360;else if (this.shearY <= -180) this.shearY += 360;
	      } else this.shearY = 0;
	    }
	  }, {
	    key: "set5",
	    value: function set5(ra, rb, rc, rd, ro) {
	      this.shearX = 0;
	      var x = ra * ra + rc * rc,
	        y = rb * rb + rd * rd;
	      if (x > MathUtils.epsilon2) {
	        var r = MathUtils.atan2Deg(rc, ra);
	        this.rotation = r + ro;
	        this.scaleX = Math.sqrt(x);
	        this.scaleY = Math.sqrt(y);
	        if (y > MathUtils.epsilon2) {
	          this.shearY = MathUtils.atan2Deg(rd, rb);
	          if (ra * rd - rb * rc < 0) {
	            this.scaleY = -this.scaleY;
	            this.shearY += 90 - r;
	          } else this.shearY -= 90 + r;
	          if (this.shearY > 180) this.shearY -= 360;else if (this.shearY <= -180) this.shearY += 360;
	        } else this.shearY = 0;
	      } else {
	        this.scaleX = 0;
	        this.scaleY = Math.sqrt(y);
	        this.shearY = 0;
	        this.rotation = y > MathUtils.epsilon2 ? MathUtils.atan2Deg(rd, rb) - 90 + ro : ro;
	      }
	    }
	  }, {
	    key: "validateLocalTransform",
	    value: function validateLocalTransform(skeleton) {
	      if (this.local === skeleton._update) this.updateLocalTransform(skeleton);
	    }
	  }, {
	    key: "modifyLocal",
	    value: function modifyLocal(skeleton) {
	      if (this.local === skeleton._update) this.updateLocalTransform(skeleton);
	      this.world = 0;
	      this.resetWorld(skeleton, skeleton._update);
	    }
	  }, {
	    key: "modifyWorld",
	    value: function modifyWorld(skeleton) {
	      var update = skeleton._update;
	      this.local = update;
	      this.world = update;
	      this.resetWorld(skeleton, update);
	    }
	  }, {
	    key: "resetWorld",
	    value: function resetWorld(skeleton, update) {
	      var children = this.bone.children;
	      for (var i = 0, n = children.length; i < n; i++) {
	        var child = children[i].appliedPose;
	        if (child.world === update) {
	          if (child.local === update) child.updateLocalTransform(skeleton);
	          child.world = 0;
	          child.resetWorld(skeleton, update);
	        }
	      }
	    }
	  }, {
	    key: "getWorldRotationX",
	    value: function getWorldRotationX() {
	      return MathUtils.atan2Deg(this.c, this.a);
	    }
	  }, {
	    key: "getWorldRotationY",
	    value: function getWorldRotationY() {
	      return MathUtils.atan2Deg(this.d, this.b);
	    }
	  }, {
	    key: "getWorldScaleX",
	    value: function getWorldScaleX() {
	      return Math.sqrt(this.a * this.a + this.c * this.c);
	    }
	  }, {
	    key: "getWorldScaleY",
	    value: function getWorldScaleY() {
	      return Math.sqrt(this.b * this.b + this.d * this.d);
	    }
	  }, {
	    key: "worldToLocal",
	    value: function worldToLocal(world) {
	      if (world == null) throw new Error("world cannot be null.");
	      var det = this.a * this.d - this.b * this.c;
	      var x = world.x - this.worldX,
	        y = world.y - this.worldY;
	      world.x = (x * this.d - y * this.b) / det;
	      world.y = (y * this.a - x * this.c) / det;
	      return world;
	    }
	  }, {
	    key: "localToWorld",
	    value: function localToWorld(local) {
	      if (local == null) throw new Error("local cannot be null.");
	      var x = local.x,
	        y = local.y;
	      local.x = x * this.a + y * this.b + this.worldX;
	      local.y = x * this.c + y * this.d + this.worldY;
	      return local;
	    }
	  }, {
	    key: "worldToParent",
	    value: function worldToParent(world) {
	      if (world == null) throw new Error("world cannot be null.");
	      return this.bone.parent == null ? world : this.bone.parent.appliedPose.worldToLocal(world);
	    }
	  }, {
	    key: "parentToWorld",
	    value: function parentToWorld(world) {
	      if (world == null) throw new Error("world cannot be null.");
	      return this.bone.parent == null ? world : this.bone.parent.appliedPose.localToWorld(world);
	    }
	  }, {
	    key: "worldToLocalRotation",
	    value: function worldToLocalRotation(worldRotation) {
	      worldRotation *= MathUtils.degRad;
	      var sin = Math.sin(worldRotation),
	        cos = Math.cos(worldRotation);
	      return MathUtils.atan2Deg(this.a * sin - this.c * cos, this.d * cos - this.b * sin) + this.rotation - this.shearX;
	    }
	  }, {
	    key: "localToWorldRotation",
	    value: function localToWorldRotation(localRotation) {
	      localRotation = (localRotation - this.rotation - this.shearX) * MathUtils.degRad;
	      var sin = Math.sin(localRotation),
	        cos = Math.cos(localRotation);
	      return MathUtils.atan2Deg(cos * this.c + sin * this.d, cos * this.a + sin * this.b);
	    }
	  }, {
	    key: "rotateWorld",
	    value: function rotateWorld(degrees) {
	      degrees *= MathUtils.degRad;
	      var sin = Math.sin(degrees),
	        cos = Math.cos(degrees);
	      var ra = this.a,
	        rb = this.b;
	      this.a = cos * ra - sin * this.c;
	      this.b = cos * rb - sin * this.d;
	      this.c = sin * ra + cos * this.c;
	      this.d = sin * rb + cos * this.d;
	    }
	  }]);
	}();

	var Posed = function () {
	  function Posed(data, pose, constrainedPose) {
	    _classCallCheck(this, Posed);
	    _defineProperty(this, "data", void 0);
	    _defineProperty(this, "pose", void 0);
	    _defineProperty(this, "constrainedPose", void 0);
	    _defineProperty(this, "appliedPose", void 0);
	    if (data == null) throw new Error("data cannot be null.");
	    this.data = data;
	    this.pose = pose;
	    this.constrainedPose = constrainedPose;
	    this.appliedPose = pose;
	  }
	  return _createClass(Posed, [{
	    key: "setupPose",
	    value: function setupPose() {
	      this.pose.set(this.data.setupPose);
	    }
	  }, {
	    key: "getData",
	    value: function getData() {
	      return this.data;
	    }
	  }, {
	    key: "getPose",
	    value: function getPose() {
	      return this.pose;
	    }
	  }, {
	    key: "getAppliedPose",
	    value: function getAppliedPose() {
	      return this.appliedPose;
	    }
	  }, {
	    key: "unconstrained",
	    value: function unconstrained() {
	      this.appliedPose = this.pose;
	    }
	  }, {
	    key: "constrained",
	    value: function constrained() {
	      this.appliedPose = this.constrainedPose;
	    }
	  }, {
	    key: "resetConstrained",
	    value: function resetConstrained() {
	      this.constrainedPose.set(this.pose);
	    }
	  }]);
	}();

	var PosedActive = function (_Posed) {
	  function PosedActive(data, pose, constrained) {
	    var _this;
	    _classCallCheck(this, PosedActive);
	    _this = _callSuper(this, PosedActive, [data, pose, constrained]);
	    _defineProperty(_this, "active", false);
	    _this.setupPose();
	    return _this;
	  }
	  _inherits(PosedActive, _Posed);
	  return _createClass(PosedActive, [{
	    key: "isActive",
	    value: function isActive() {
	      return this.active;
	    }
	  }]);
	}(Posed);

	var Bone = function (_PosedActive) {
	  function Bone(data, parent) {
	    var _this;
	    _classCallCheck(this, Bone);
	    _this = _callSuper(this, Bone, [data, new BonePose(), new BonePose()]);
	    _defineProperty(_this, "parent", null);
	    _defineProperty(_this, "children", []);
	    _defineProperty(_this, "sorted", false);
	    _this.parent = parent;
	    _this.appliedPose.bone = _this;
	    _this.constrainedPose.bone = _this;
	    return _this;
	  }
	  _inherits(Bone, _PosedActive);
	  return _createClass(Bone, [{
	    key: "copy",
	    value: function copy(parent) {
	      var copy = new Bone(this.data, parent);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }]);
	}(PosedActive);

	var Constraint = function (_PosedActive) {
	  function Constraint(data, pose, constrained) {
	    _classCallCheck(this, Constraint);
	    return _callSuper(this, Constraint, [data, pose, constrained]);
	  }
	  _inherits(Constraint, _PosedActive);
	  return _createClass(Constraint, [{
	    key: "isSourceActive",
	    value: function isSourceActive() {
	      return true;
	    }
	  }]);
	}(PosedActive);

	var DrawOrder = function () {
	  function DrawOrder(setupPose) {
	    _classCallCheck(this, DrawOrder);
	    _defineProperty(this, "_setupPose", void 0);
	    _defineProperty(this, "pose", void 0);
	    _defineProperty(this, "constrainedPose", void 0);
	    _defineProperty(this, "appliedPose", void 0);
	    this._setupPose = setupPose;
	    this.pose = _toConsumableArray(setupPose);
	    this.constrainedPose = [];
	    this.appliedPose = this.pose;
	  }
	  return _createClass(DrawOrder, [{
	    key: "setupPose",
	    value: function setupPose() {
	      this.pose.length = this._setupPose.length;
	      Utils.arrayCopy(this._setupPose, 0, this.pose, 0, this._setupPose.length);
	    }
	  }, {
	    key: "unconstrained",
	    value: function unconstrained() {
	      this.appliedPose = this.pose;
	    }
	  }, {
	    key: "constrained",
	    value: function constrained() {
	      this.appliedPose = this.constrainedPose;
	    }
	  }, {
	    key: "resetConstrained",
	    value: function resetConstrained() {
	      this.constrainedPose.length = this.pose.length;
	      Utils.arrayCopy(this.pose, 0, this.constrainedPose, 0, this.pose.length);
	    }
	  }]);
	}();

	var ConstraintData = function (_PosedData) {
	  function ConstraintData(name, setup) {
	    _classCallCheck(this, ConstraintData);
	    return _callSuper(this, ConstraintData, [name, setup]);
	  }
	  _inherits(ConstraintData, _PosedData);
	  return _createClass(ConstraintData);
	}(PosedData);
	var ScaleYMode;
	(function (ScaleYMode) {
	  ScaleYMode[ScaleYMode["None"] = 0] = "None";
	  ScaleYMode[ScaleYMode["Uniform"] = 1] = "Uniform";
	  ScaleYMode[ScaleYMode["Volume"] = 2] = "Volume";
	})(ScaleYMode || (ScaleYMode = {}));

	var Event = _createClass(function Event(time, data) {
	  _classCallCheck(this, Event);
	  _defineProperty(this, "time", 0);
	  _defineProperty(this, "data", void 0);
	  _defineProperty(this, "intValue", 0);
	  _defineProperty(this, "floatValue", 0);
	  _defineProperty(this, "stringValue", null);
	  _defineProperty(this, "volume", 0);
	  _defineProperty(this, "balance", 0);
	  if (!data) throw new Error("data cannot be null.");
	  this.time = time;
	  this.data = data;
	});

	var EventData = function () {
	  function EventData(name) {
	    _classCallCheck(this, EventData);
	    _defineProperty(this, "name", void 0);
	    _defineProperty(this, "_audioPath", null);
	    _defineProperty(this, "setupPose", new Event(-1, this));
	    this.name = name;
	  }
	  return _createClass(EventData, [{
	    key: "audioPath",
	    get: function get() {
	      return this._audioPath;
	    },
	    set: function set(audioPath) {
	      if (audioPath == null) throw new Error("audioPath cannot be null.");
	      this._audioPath = audioPath;
	    }
	  }]);
	}();

	var IkConstraintPose = function () {
	  function IkConstraintPose() {
	    _classCallCheck(this, IkConstraintPose);
	    _defineProperty(this, "bendDirection", 0);
	    _defineProperty(this, "compress", false);
	    _defineProperty(this, "stretch", false);
	    _defineProperty(this, "mix", 0);
	    _defineProperty(this, "softness", 0);
	  }
	  return _createClass(IkConstraintPose, [{
	    key: "set",
	    value: function set(pose) {
	      this.mix = pose.mix;
	      this.softness = pose.softness;
	      this.bendDirection = pose.bendDirection;
	      this.compress = pose.compress;
	      this.stretch = pose.stretch;
	    }
	  }]);
	}();

	var IkConstraint = function (_Constraint) {
	  function IkConstraint(data, skeleton) {
	    var _this;
	    _classCallCheck(this, IkConstraint);
	    _this = _callSuper(this, IkConstraint, [data, new IkConstraintPose(), new IkConstraintPose()]);
	    _defineProperty(_this, "bones", void 0);
	    _defineProperty(_this, "target", void 0);
	    if (!skeleton) throw new Error("skeleton cannot be null.");
	    _this.bones = [];
	    var _iterator = _createForOfIteratorHelper(data.bones),
	      _step;
	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var boneData = _step.value;
	        _this.bones.push(skeleton.bones[boneData.index].constrainedPose);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	    _this.target = skeleton.bones[data.target.index];
	    return _this;
	  }
	  _inherits(IkConstraint, _Constraint);
	  return _createClass(IkConstraint, [{
	    key: "copy",
	    value: function copy(skeleton) {
	      var copy = new IkConstraint(this.data, skeleton);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      var p = this.appliedPose;
	      if (p.mix === 0) return;
	      var target = this.target.appliedPose;
	      var bones = this.bones;
	      switch (bones.length) {
	        case 1:
	          IkConstraint.apply(skeleton, bones[0], target.worldX, target.worldY, p.compress, p.stretch, this.data.scaleYMode, p.mix);
	          break;
	        case 2:
	          IkConstraint.apply(skeleton, bones[0], bones[1], target.worldX, target.worldY, p.bendDirection, p.stretch, this.data.scaleYMode, p.softness, p.mix);
	          break;
	      }
	    }
	  }, {
	    key: "sort",
	    value: function sort(skeleton) {
	      skeleton.sortBone(this.target);
	      var parent = this.bones[0].bone;
	      skeleton.sortBone(parent);
	      skeleton._updateCache.push(this);
	      parent.sorted = false;
	      skeleton.sortReset(parent.children);
	      skeleton.constrained(parent);
	      if (this.bones.length > 1) skeleton.constrained(this.bones[1].bone);
	    }
	  }, {
	    key: "isSourceActive",
	    value: function isSourceActive() {
	      return this.target.active;
	    }
	  }], [{
	    key: "apply",
	    value: function apply(skeleton, boneOrParent, targetXorChild, targetYOrTargetX, compressOrTargetY, stretchOrBendDir, scaleYModeOrStretch, mixOrScaleYMode, softness, mix) {
	      if (typeof targetXorChild === "number") IkConstraint.apply1(skeleton, boneOrParent, targetXorChild, targetYOrTargetX, compressOrTargetY, stretchOrBendDir, scaleYModeOrStretch, mixOrScaleYMode);else IkConstraint.apply2(skeleton, boneOrParent, targetXorChild, targetYOrTargetX, compressOrTargetY, stretchOrBendDir, scaleYModeOrStretch, mixOrScaleYMode, softness, mix);
	    }
	  }, {
	    key: "apply1",
	    value: function apply1(skeleton, bone, targetX, targetY, compress, stretch, scaleYMode, mix) {
	      bone.modifyLocal(skeleton);
	      var p = bone.bone.parent.appliedPose;
	      var pa = p.a,
	        pb = p.b,
	        pc = p.c,
	        pd = p.d;
	      var rotationIK = -bone.shearX - bone.rotation,
	        tx = 0,
	        ty = 0;
	      switch (bone.inherit) {
	        case Inherit.OnlyTranslation:
	          tx = (targetX - bone.worldX) * MathUtils.signum(skeleton.scaleX);
	          ty = (targetY - bone.worldY) * MathUtils.signum(skeleton.scaleY);
	          break;
	        case Inherit.NoRotationOrReflection:
	          {
	            var s = Math.abs(pa * pd - pb * pc) / Math.max(MathUtils.epsilon, pa * pa + pc * pc);
	            var sa = pa / skeleton.scaleX;
	            var sc = pc / skeleton.scaleY;
	            pb = -sc * s * skeleton.scaleX;
	            pd = sa * s * skeleton.scaleY;
	            rotationIK += MathUtils.atan2Deg(sc, sa);
	          }
	        default:
	          {
	            var x = targetX - p.worldX,
	              y = targetY - p.worldY;
	            var d = pa * pd - pb * pc;
	            if (Math.abs(d) <= MathUtils.epsilon) {
	              tx = 0;
	              ty = 0;
	            } else {
	              tx = (x * pd - y * pb) / d - bone.x;
	              ty = (y * pa - x * pc) / d - bone.y;
	            }
	          }
	      }
	      rotationIK += MathUtils.atan2Deg(ty, tx);
	      if (bone.scaleX < 0) rotationIK += 180;
	      if (rotationIK > 180) rotationIK -= 360;else if (rotationIK <= -180) rotationIK += 360;
	      bone.rotation += rotationIK * mix;
	      if (compress || stretch) {
	        switch (bone.inherit) {
	          case Inherit.NoScale:
	          case Inherit.NoScaleOrReflection:
	            tx = targetX - bone.worldX;
	            ty = targetY - bone.worldY;
	        }
	        var b = bone.bone.data.length * bone.scaleX;
	        if (b > MathUtils.epsilon) {
	          var dd = tx * tx + ty * ty;
	          if (compress && dd < b * b || stretch && dd > b * b) {
	            var _s = (Math.sqrt(dd) / b - 1) * mix + 1;
	            bone.scaleX *= _s;
	            switch (scaleYMode) {
	              case ScaleYMode.Uniform:
	                bone.scaleY *= _s;
	                break;
	              case ScaleYMode.Volume:
	                bone.scaleY /= _s < 0.7 ? 0.25 + 0.642857 * _s : _s;
	            }
	          }
	        }
	      }
	    }
	  }, {
	    key: "apply2",
	    value: function apply2(skeleton, parent, child, targetX, targetY, bendDir, stretch, scaleYMode, softness, mix) {
	      if (parent.inherit !== Inherit.Normal || child.inherit !== Inherit.Normal) return;
	      parent.modifyLocal(skeleton);
	      child.modifyLocal(skeleton);
	      var px = parent.x,
	        py = parent.y,
	        psx = parent.scaleX,
	        psy = parent.scaleY,
	        csx = child.scaleX;
	      var os1 = 0,
	        os2 = 0,
	        s2 = 0;
	      if (psx < 0) {
	        psx = -psx;
	        os1 = 180;
	        s2 = -1;
	      } else {
	        os1 = 0;
	        s2 = 1;
	      }
	      if (psy < 0) {
	        psy = -psy;
	        s2 = -s2;
	      }
	      if (csx < 0) {
	        csx = -csx;
	        os2 = 180;
	      } else os2 = 0;
	      var cwx = 0,
	        cwy = 0,
	        a = parent.a,
	        b = parent.b,
	        c = parent.c,
	        d = parent.d;
	      var u = Math.abs(psx - psy) <= MathUtils.epsilon;
	      if (!u || stretch) {
	        child.y = 0;
	        cwx = a * child.x + parent.worldX;
	        cwy = c * child.x + parent.worldY;
	      } else {
	        cwx = a * child.x + b * child.y + parent.worldX;
	        cwy = c * child.x + d * child.y + parent.worldY;
	      }
	      var pp = parent.bone.parent.appliedPose;
	      a = pp.a;
	      b = pp.b;
	      c = pp.c;
	      d = pp.d;
	      var id = a * d - b * c,
	        x = cwx - pp.worldX,
	        y = cwy - pp.worldY;
	      id = Math.abs(id) <= MathUtils.epsilon ? 0 : 1 / id;
	      var dx = (x * d - y * b) * id - px,
	        dy = (y * a - x * c) * id - py;
	      var l1 = Math.sqrt(dx * dx + dy * dy),
	        l2 = child.bone.data.length * csx,
	        a1,
	        a2;
	      if (l1 < MathUtils.epsilon) {
	        IkConstraint.apply(skeleton, parent, targetX, targetY, false, stretch, ScaleYMode.None, mix);
	        child.rotation = 0;
	        return;
	      }
	      x = targetX - pp.worldX;
	      y = targetY - pp.worldY;
	      var tx = (x * d - y * b) * id - px,
	        ty = (y * a - x * c) * id - py;
	      var dd = tx * tx + ty * ty;
	      if (softness !== 0) {
	        softness *= psx * (csx + 1) * 0.5;
	        var td = Math.sqrt(dd),
	          sd = td - l1 - l2 * psx + softness;
	        if (sd > 0) {
	          var p = Math.min(1, sd / (softness * 2)) - 1;
	          p = (sd - softness * (1 - p * p)) / td;
	          tx -= p * tx;
	          ty -= p * ty;
	          dd = tx * tx + ty * ty;
	        }
	      }
	      outer: if (u) {
	        l2 *= psx;
	        var cos = (dd - l1 * l1 - l2 * l2) / (2 * l1 * l2);
	        if (cos < -1) {
	          cos = -1;
	          a2 = Math.PI * bendDir;
	        } else if (cos > 1) {
	          cos = 1;
	          a2 = 0;
	          if (stretch) {
	            a = (Math.sqrt(dd) / (l1 + l2) - 1) * mix + 1;
	            parent.scaleX *= a;
	            switch (scaleYMode) {
	              case ScaleYMode.Uniform:
	                parent.scaleY *= a;
	                break;
	              case ScaleYMode.Volume:
	                parent.scaleY /= a < 0.7 ? 0.25 + 0.642857 * a : a;
	            }
	          }
	        } else a2 = Math.acos(cos) * bendDir;
	        a = l1 + l2 * cos;
	        b = l2 * Math.sin(a2);
	        a1 = Math.atan2(ty * a - tx * b, tx * a + ty * b);
	      } else {
	        a = psx * l2;
	        b = psy * l2;
	        var aa = a * a,
	          bb = b * b,
	          ta = Math.atan2(ty, tx);
	        c = bb * l1 * l1 + aa * dd - aa * bb;
	        var c1 = -2 * bb * l1,
	          c2 = bb - aa;
	        d = c1 * c1 - 4 * c2 * c;
	        if (d >= 0) {
	          var q = Math.sqrt(d);
	          if (c1 < 0) q = -q;
	          q = -(c1 + q) * 0.5;
	          var r0 = q / c2,
	            r1 = c / q;
	          var r = Math.abs(r0) < Math.abs(r1) ? r0 : r1;
	          r0 = dd - r * r;
	          if (r0 >= 0) {
	            y = Math.sqrt(r0) * bendDir;
	            a1 = ta - Math.atan2(y, r);
	            a2 = Math.atan2(y / psy, (r - l1) / psx);
	            break outer;
	          }
	        }
	        var minAngle = MathUtils.PI,
	          minX = l1 - a,
	          minDist = minX * minX,
	          minY = 0;
	        var maxAngle = 0,
	          maxX = l1 + a,
	          maxDist = maxX * maxX,
	          maxY = 0;
	        c = -a * l1 / (aa - bb);
	        if (c >= -1 && c <= 1) {
	          c = Math.acos(c);
	          x = a * Math.cos(c) + l1;
	          y = b * Math.sin(c);
	          d = x * x + y * y;
	          if (d < minDist) {
	            minAngle = c;
	            minDist = d;
	            minX = x;
	            minY = y;
	          }
	          if (d > maxDist) {
	            maxAngle = c;
	            maxDist = d;
	            maxX = x;
	            maxY = y;
	          }
	        }
	        if (dd <= (minDist + maxDist) * 0.5) {
	          a1 = ta - Math.atan2(minY * bendDir, minX);
	          a2 = minAngle * bendDir;
	        } else {
	          a1 = ta - Math.atan2(maxY * bendDir, maxX);
	          a2 = maxAngle * bendDir;
	        }
	      }
	      var os = Math.atan2(child.y, child.x) * s2;
	      a1 = (a1 - os) * MathUtils.radDeg + os1 - parent.rotation;
	      if (a1 > 180) a1 -= 360;else if (a1 <= -180) a1 += 360;
	      parent.rotation += a1 * mix;
	      a2 = ((a2 + os) * MathUtils.radDeg - child.shearX) * s2 + os2 - child.rotation;
	      if (a2 > 180) a2 -= 360;else if (a2 <= -180) a2 += 360;
	      child.rotation += a2 * mix;
	    }
	  }]);
	}(Constraint);

	var IkConstraintData = function (_ConstraintData) {
	  function IkConstraintData(name) {
	    var _this;
	    _classCallCheck(this, IkConstraintData);
	    _this = _callSuper(this, IkConstraintData, [name, new IkConstraintPose()]);
	    _defineProperty(_this, "bones", []);
	    _defineProperty(_this, "_target", null);
	    _defineProperty(_this, "_scaleYMode", ScaleYMode.None);
	    return _this;
	  }
	  _inherits(IkConstraintData, _ConstraintData);
	  return _createClass(IkConstraintData, [{
	    key: "target",
	    get: function get() {
	      if (!this._target) throw new Error("target cannot be null.");
	      return this._target;
	    },
	    set: function set(boneData) {
	      this._target = boneData;
	    }
	  }, {
	    key: "scaleYMode",
	    get: function get() {
	      if (this._scaleYMode == null) throw new Error("scaleYMode cannot be null.");
	      return this._scaleYMode;
	    },
	    set: function set(scaleYMode) {
	      this._scaleYMode = scaleYMode;
	    }
	  }, {
	    key: "create",
	    value: function create(skeleton) {
	      return new IkConstraint(this, skeleton);
	    }
	  }]);
	}(ConstraintData);

	var PathConstraintPose = function () {
	  function PathConstraintPose() {
	    _classCallCheck(this, PathConstraintPose);
	    _defineProperty(this, "position", 0);
	    _defineProperty(this, "spacing", 0);
	    _defineProperty(this, "mixRotate", 0);
	    _defineProperty(this, "mixX", 0);
	    _defineProperty(this, "mixY", 0);
	  }
	  return _createClass(PathConstraintPose, [{
	    key: "set",
	    value: function set(pose) {
	      this.position = pose.position;
	      this.spacing = pose.spacing;
	      this.mixRotate = pose.mixRotate;
	      this.mixX = pose.mixX;
	      this.mixY = pose.mixY;
	    }
	  }]);
	}();

	var PathConstraintData = function (_ConstraintData) {
	  function PathConstraintData(name) {
	    var _this;
	    _classCallCheck(this, PathConstraintData);
	    _this = _callSuper(this, PathConstraintData, [name, new PathConstraintPose()]);
	    _defineProperty(_this, "bones", []);
	    _defineProperty(_this, "_slot", null);
	    _defineProperty(_this, "positionMode", PositionMode.Fixed);
	    _defineProperty(_this, "spacingMode", SpacingMode.Fixed);
	    _defineProperty(_this, "rotateMode", RotateMode.Chain);
	    _defineProperty(_this, "offsetRotation", 0);
	    return _this;
	  }
	  _inherits(PathConstraintData, _ConstraintData);
	  return _createClass(PathConstraintData, [{
	    key: "slot",
	    get: function get() {
	      if (!this._slot) throw new Error("SlotData not set.");else return this._slot;
	    },
	    set: function set(slotData) {
	      this._slot = slotData;
	    }
	  }, {
	    key: "create",
	    value: function create(skeleton) {
	      return new PathConstraint(this, skeleton);
	    }
	  }]);
	}(ConstraintData);
	var PositionMode;
	(function (PositionMode) {
	  PositionMode[PositionMode["Fixed"] = 0] = "Fixed";
	  PositionMode[PositionMode["Percent"] = 1] = "Percent";
	})(PositionMode || (PositionMode = {}));
	var SpacingMode;
	(function (SpacingMode) {
	  SpacingMode[SpacingMode["Length"] = 0] = "Length";
	  SpacingMode[SpacingMode["Fixed"] = 1] = "Fixed";
	  SpacingMode[SpacingMode["Percent"] = 2] = "Percent";
	  SpacingMode[SpacingMode["Proportional"] = 3] = "Proportional";
	})(SpacingMode || (SpacingMode = {}));
	var RotateMode;
	(function (RotateMode) {
	  RotateMode[RotateMode["Tangent"] = 0] = "Tangent";
	  RotateMode[RotateMode["Chain"] = 1] = "Chain";
	  RotateMode[RotateMode["ChainScale"] = 2] = "ChainScale";
	})(RotateMode || (RotateMode = {}));

	var PathConstraint = function (_Constraint) {
	  function PathConstraint(data, skeleton) {
	    var _this;
	    _classCallCheck(this, PathConstraint);
	    _this = _callSuper(this, PathConstraint, [data, new PathConstraintPose(), new PathConstraintPose()]);
	    _defineProperty(_this, "data", void 0);
	    _defineProperty(_this, "bones", void 0);
	    _defineProperty(_this, "slot", void 0);
	    _defineProperty(_this, "spaces", []);
	    _defineProperty(_this, "positions", []);
	    _defineProperty(_this, "world", []);
	    _defineProperty(_this, "curves", []);
	    _defineProperty(_this, "lengths", []);
	    _defineProperty(_this, "segments", []);
	    if (!skeleton) throw new Error("skeleton cannot be null.");
	    _this.data = data;
	    _this.bones = [];
	    var _iterator = _createForOfIteratorHelper(_this.data.bones),
	      _step;
	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var boneData = _step.value;
	        _this.bones.push(skeleton.bones[boneData.index].constrainedPose);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	    _this.slot = skeleton.slots[data.slot.index];
	    return _this;
	  }
	  _inherits(PathConstraint, _Constraint);
	  return _createClass(PathConstraint, [{
	    key: "copy",
	    value: function copy(skeleton) {
	      var copy = new PathConstraint(this.data, skeleton);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      var attachment = this.slot.appliedPose.attachment;
	      if (!(attachment instanceof PathAttachment)) return;
	      var p = this.appliedPose;
	      var mixRotate = p.mixRotate,
	        mixX = p.mixX,
	        mixY = p.mixY;
	      if (mixRotate === 0 && mixX === 0 && mixY === 0) return;
	      var data = this.data;
	      var tangents = data.rotateMode === RotateMode.Tangent,
	        scale = data.rotateMode === RotateMode.ChainScale;
	      var bones = this.bones;
	      var boneCount = bones.length,
	        spacesCount = tangents ? boneCount : boneCount + 1;
	      var spaces = Utils.setArraySize(this.spaces, spacesCount),
	        lengths = scale ? this.lengths = Utils.setArraySize(this.lengths, boneCount) : [];
	      var spacing = p.spacing;
	      switch (data.spacingMode) {
	        case SpacingMode.Percent:
	          if (scale) {
	            for (var i = 0, n = spacesCount - 1; i < n; i++) {
	              var bone = bones[i];
	              var setupLength = bone.bone.data.length;
	              var x = setupLength * bone.a,
	                y = setupLength * bone.c;
	              lengths[i] = Math.sqrt(x * x + y * y);
	            }
	          }
	          Utils.arrayFill(spaces, 1, spacesCount, spacing);
	          break;
	        case SpacingMode.Proportional:
	          {
	            var sum = 0;
	            for (var _i = 0, _n = spacesCount - 1; _i < _n;) {
	              var _bone = bones[_i];
	              var _setupLength = _bone.bone.data.length;
	              if (_setupLength < MathUtils.epsilon) {
	                if (scale) lengths[_i] = 0;
	                spaces[++_i] = spacing;
	              } else {
	                var _x = _setupLength * _bone.a,
	                  _y = _setupLength * _bone.c;
	                var length = Math.sqrt(_x * _x + _y * _y);
	                if (scale) lengths[_i] = length;
	                spaces[++_i] = length;
	                sum += length;
	              }
	            }
	            if (sum > 0) {
	              sum = spacesCount / sum * spacing;
	              for (var _i2 = 1; _i2 < spacesCount; _i2++) spaces[_i2] *= sum;
	            }
	            break;
	          }
	        default:
	          {
	            var lengthSpacing = data.spacingMode === SpacingMode.Length;
	            for (var _i3 = 0, _n2 = spacesCount - 1; _i3 < _n2;) {
	              var _bone2 = bones[_i3];
	              var _setupLength2 = _bone2.bone.data.length;
	              if (_setupLength2 < MathUtils.epsilon) {
	                if (scale) lengths[_i3] = 0;
	                spaces[++_i3] = spacing;
	              } else {
	                var _x2 = _setupLength2 * _bone2.a,
	                  _y2 = _setupLength2 * _bone2.c;
	                var _length = Math.sqrt(_x2 * _x2 + _y2 * _y2);
	                if (scale) lengths[_i3] = _length;
	                spaces[++_i3] = (lengthSpacing ? Math.max(0, _setupLength2 + spacing) : spacing) * _length / _setupLength2;
	              }
	            }
	          }
	      }
	      var positions = this.computeWorldPositions(skeleton, attachment, spacesCount, tangents);
	      var boneX = positions[0],
	        boneY = positions[1],
	        offsetRotation = data.offsetRotation;
	      var tip = false;
	      if (offsetRotation === 0) tip = data.rotateMode === RotateMode.Chain;else {
	        tip = false;
	        var _bone3 = this.slot.bone.appliedPose;
	        offsetRotation *= _bone3.a * _bone3.d - _bone3.b * _bone3.c > 0 ? MathUtils.degRad : -MathUtils.degRad;
	      }
	      for (var _i4 = 0, ip = 3; _i4 < boneCount; _i4++, ip += 3) {
	        var _bone4 = bones[_i4];
	        _bone4.modifyWorld(skeleton);
	        _bone4.worldX += (boneX - _bone4.worldX) * mixX;
	        _bone4.worldY += (boneY - _bone4.worldY) * mixY;
	        var _x3 = positions[ip],
	          _y3 = positions[ip + 1],
	          dx = _x3 - boneX,
	          dy = _y3 - boneY;
	        if (scale) {
	          var _length2 = lengths[_i4];
	          if (_length2 !== 0) {
	            var s = (Math.sqrt(dx * dx + dy * dy) / _length2 - 1) * mixRotate + 1;
	            _bone4.a *= s;
	            _bone4.c *= s;
	          }
	        }
	        boneX = _x3;
	        boneY = _y3;
	        if (mixRotate > 0) {
	          var a = _bone4.a,
	            b = _bone4.b,
	            c = _bone4.c,
	            d = _bone4.d,
	            r = 0,
	            cos = 0,
	            sin = 0;
	          if (tangents) r = positions[ip - 1];else if (spaces[_i4 + 1] === 0) r = positions[ip + 2];else r = Math.atan2(dy, dx);
	          r -= Math.atan2(c, a);
	          if (tip) {
	            cos = Math.cos(r);
	            sin = Math.sin(r);
	            var _length3 = _bone4.bone.data.length;
	            boneX += (_length3 * (cos * a - sin * c) - dx) * mixRotate;
	            boneY += (_length3 * (sin * a + cos * c) - dy) * mixRotate;
	          } else {
	            r += offsetRotation;
	          }
	          if (r > MathUtils.PI) r -= MathUtils.PI2;else if (r < -MathUtils.PI) r += MathUtils.PI2;
	          r *= mixRotate;
	          cos = Math.cos(r);
	          sin = Math.sin(r);
	          _bone4.a = cos * a - sin * c;
	          _bone4.b = cos * b - sin * d;
	          _bone4.c = sin * a + cos * c;
	          _bone4.d = sin * b + cos * d;
	        }
	      }
	    }
	  }, {
	    key: "computeWorldPositions",
	    value: function computeWorldPositions(skeleton, path, spacesCount, tangents) {
	      var slot = this.slot;
	      var position = this.appliedPose.position;
	      var spaces = this.spaces,
	        out = Utils.setArraySize(this.positions, spacesCount * 3 + 2),
	        world = this.world;
	      var closed = path.closed;
	      var verticesLength = path.worldVerticesLength,
	        curveCount = verticesLength / 6,
	        prevCurve = PathConstraint.NONE;
	      if (!path.constantSpeed) {
	        var lengths = path.lengths;
	        curveCount -= closed ? 1 : 2;
	        var _pathLength = lengths[curveCount];
	        if (this.data.positionMode === PositionMode.Percent) position *= _pathLength;
	        var _multiplier;
	        switch (this.data.spacingMode) {
	          case SpacingMode.Percent:
	            _multiplier = _pathLength;
	            break;
	          case SpacingMode.Proportional:
	            _multiplier = _pathLength / spacesCount;
	            break;
	          default:
	            _multiplier = 1;
	        }
	        world = Utils.setArraySize(this.world, 8);
	        for (var i = 0, o = 0, curve = 0; i < spacesCount; i++, o += 3) {
	          var space = spaces[i] * _multiplier;
	          position += space;
	          var p = position;
	          if (closed) {
	            p %= _pathLength;
	            if (p < 0) p += _pathLength;
	            curve = 0;
	          } else if (p < 0) {
	            if (prevCurve !== PathConstraint.BEFORE) {
	              prevCurve = PathConstraint.BEFORE;
	              path.computeWorldVertices(skeleton, slot, 2, 4, world, 0, 2);
	            }
	            this.addBeforePosition(p, world, 0, out, o);
	            continue;
	          } else if (p > _pathLength) {
	            if (prevCurve !== PathConstraint.AFTER) {
	              prevCurve = PathConstraint.AFTER;
	              path.computeWorldVertices(skeleton, slot, verticesLength - 6, 4, world, 0, 2);
	            }
	            this.addAfterPosition(p - _pathLength, world, 0, out, o);
	            continue;
	          }
	          for (;; curve++) {
	            var length = lengths[curve];
	            if (p > length) continue;
	            if (curve === 0) p /= length;else {
	              var prev = lengths[curve - 1];
	              p = (p - prev) / (length - prev);
	            }
	            break;
	          }
	          if (curve !== prevCurve) {
	            prevCurve = curve;
	            if (closed && curve === curveCount) {
	              path.computeWorldVertices(skeleton, slot, verticesLength - 4, 4, world, 0, 2);
	              path.computeWorldVertices(skeleton, slot, 0, 4, world, 4, 2);
	            } else path.computeWorldVertices(skeleton, slot, curve * 6 + 2, 8, world, 0, 2);
	          }
	          this.addCurvePosition(p, world[0], world[1], world[2], world[3], world[4], world[5], world[6], world[7], out, o, tangents || i > 0 && space === 0);
	        }
	        return out;
	      }
	      if (closed) {
	        verticesLength += 2;
	        world = Utils.setArraySize(this.world, verticesLength);
	        path.computeWorldVertices(skeleton, slot, 2, verticesLength - 4, world, 0, 2);
	        path.computeWorldVertices(skeleton, slot, 0, 2, world, verticesLength - 4, 2);
	        world[verticesLength - 2] = world[0];
	        world[verticesLength - 1] = world[1];
	      } else {
	        curveCount--;
	        verticesLength -= 4;
	        world = Utils.setArraySize(this.world, verticesLength);
	        path.computeWorldVertices(skeleton, slot, 2, verticesLength, world, 0, 2);
	      }
	      var curves = Utils.setArraySize(this.curves, curveCount);
	      var pathLength = 0;
	      var x1 = world[0],
	        y1 = world[1],
	        cx1 = 0,
	        cy1 = 0,
	        cx2 = 0,
	        cy2 = 0,
	        x2 = 0,
	        y2 = 0;
	      var tmpx = 0,
	        tmpy = 0,
	        dddfx = 0,
	        dddfy = 0,
	        ddfx = 0,
	        ddfy = 0,
	        dfx = 0,
	        dfy = 0;
	      for (var _i5 = 0, w = 2; _i5 < curveCount; _i5++, w += 6) {
	        cx1 = world[w];
	        cy1 = world[w + 1];
	        cx2 = world[w + 2];
	        cy2 = world[w + 3];
	        x2 = world[w + 4];
	        y2 = world[w + 5];
	        tmpx = (x1 - cx1 * 2 + cx2) * 0.1875;
	        tmpy = (y1 - cy1 * 2 + cy2) * 0.1875;
	        dddfx = ((cx1 - cx2) * 3 - x1 + x2) * 0.09375;
	        dddfy = ((cy1 - cy2) * 3 - y1 + y2) * 0.09375;
	        ddfx = tmpx * 2 + dddfx;
	        ddfy = tmpy * 2 + dddfy;
	        dfx = (cx1 - x1) * 0.75 + tmpx + dddfx * 0.16666667;
	        dfy = (cy1 - y1) * 0.75 + tmpy + dddfy * 0.16666667;
	        pathLength += Math.sqrt(dfx * dfx + dfy * dfy);
	        dfx += ddfx;
	        dfy += ddfy;
	        ddfx += dddfx;
	        ddfy += dddfy;
	        pathLength += Math.sqrt(dfx * dfx + dfy * dfy);
	        dfx += ddfx;
	        dfy += ddfy;
	        pathLength += Math.sqrt(dfx * dfx + dfy * dfy);
	        dfx += ddfx + dddfx;
	        dfy += ddfy + dddfy;
	        pathLength += Math.sqrt(dfx * dfx + dfy * dfy);
	        curves[_i5] = pathLength;
	        x1 = x2;
	        y1 = y2;
	      }
	      if (this.data.positionMode === PositionMode.Percent) position *= pathLength;
	      var multiplier;
	      switch (this.data.spacingMode) {
	        case SpacingMode.Percent:
	          multiplier = pathLength;
	          break;
	        case SpacingMode.Proportional:
	          multiplier = pathLength / spacesCount;
	          break;
	        default:
	          multiplier = 1;
	      }
	      var segments = this.segments;
	      var curveLength = 0;
	      for (var _i6 = 0, _o = 0, _curve = 0, segment = 0; _i6 < spacesCount; _i6++, _o += 3) {
	        var _space = spaces[_i6] * multiplier;
	        position += _space;
	        var _p = position;
	        if (closed) {
	          _p %= pathLength;
	          if (_p < 0) _p += pathLength;
	          _curve = 0;
	          segment = 0;
	        } else if (_p < 0) {
	          this.addBeforePosition(_p, world, 0, out, _o);
	          continue;
	        } else if (_p > pathLength) {
	          this.addAfterPosition(_p - pathLength, world, verticesLength - 4, out, _o);
	          continue;
	        }
	        for (;; _curve++) {
	          var _length4 = curves[_curve];
	          if (_p > _length4) continue;
	          if (_curve === 0) _p /= _length4;else {
	            var _prev = curves[_curve - 1];
	            _p = (_p - _prev) / (_length4 - _prev);
	          }
	          break;
	        }
	        if (_curve !== prevCurve) {
	          prevCurve = _curve;
	          var ii = _curve * 6;
	          x1 = world[ii];
	          y1 = world[ii + 1];
	          cx1 = world[ii + 2];
	          cy1 = world[ii + 3];
	          cx2 = world[ii + 4];
	          cy2 = world[ii + 5];
	          x2 = world[ii + 6];
	          y2 = world[ii + 7];
	          tmpx = (x1 - cx1 * 2 + cx2) * 0.03;
	          tmpy = (y1 - cy1 * 2 + cy2) * 0.03;
	          dddfx = ((cx1 - cx2) * 3 - x1 + x2) * 0.006;
	          dddfy = ((cy1 - cy2) * 3 - y1 + y2) * 0.006;
	          ddfx = tmpx * 2 + dddfx;
	          ddfy = tmpy * 2 + dddfy;
	          dfx = (cx1 - x1) * 0.3 + tmpx + dddfx * 0.16666667;
	          dfy = (cy1 - y1) * 0.3 + tmpy + dddfy * 0.16666667;
	          curveLength = Math.sqrt(dfx * dfx + dfy * dfy);
	          segments[0] = curveLength;
	          for (ii = 1; ii < 8; ii++) {
	            dfx += ddfx;
	            dfy += ddfy;
	            ddfx += dddfx;
	            ddfy += dddfy;
	            curveLength += Math.sqrt(dfx * dfx + dfy * dfy);
	            segments[ii] = curveLength;
	          }
	          dfx += ddfx;
	          dfy += ddfy;
	          curveLength += Math.sqrt(dfx * dfx + dfy * dfy);
	          segments[8] = curveLength;
	          dfx += ddfx + dddfx;
	          dfy += ddfy + dddfy;
	          curveLength += Math.sqrt(dfx * dfx + dfy * dfy);
	          segments[9] = curveLength;
	          segment = 0;
	        }
	        _p *= curveLength;
	        for (;; segment++) {
	          var _length5 = segments[segment];
	          if (_p > _length5) continue;
	          if (segment === 0) _p /= _length5;else {
	            var _prev2 = segments[segment - 1];
	            _p = segment + (_p - _prev2) / (_length5 - _prev2);
	          }
	          break;
	        }
	        this.addCurvePosition(_p * 0.1, x1, y1, cx1, cy1, cx2, cy2, x2, y2, out, _o, tangents || _i6 > 0 && _space === 0);
	      }
	      return out;
	    }
	  }, {
	    key: "addBeforePosition",
	    value: function addBeforePosition(p, temp, i, out, o) {
	      var x1 = temp[i],
	        y1 = temp[i + 1],
	        dx = temp[i + 2] - x1,
	        dy = temp[i + 3] - y1,
	        r = Math.atan2(dy, dx);
	      out[o] = x1 + p * Math.cos(r);
	      out[o + 1] = y1 + p * Math.sin(r);
	      out[o + 2] = r;
	    }
	  }, {
	    key: "addAfterPosition",
	    value: function addAfterPosition(p, temp, i, out, o) {
	      var x1 = temp[i + 2],
	        y1 = temp[i + 3],
	        dx = x1 - temp[i],
	        dy = y1 - temp[i + 1],
	        r = Math.atan2(dy, dx);
	      out[o] = x1 + p * Math.cos(r);
	      out[o + 1] = y1 + p * Math.sin(r);
	      out[o + 2] = r;
	    }
	  }, {
	    key: "addCurvePosition",
	    value: function addCurvePosition(p, x1, y1, cx1, cy1, cx2, cy2, x2, y2, out, o, tangents) {
	      if (p === 0 || Number.isNaN(p)) {
	        out[o] = x1;
	        out[o + 1] = y1;
	        out[o + 2] = Math.atan2(cy1 - y1, cx1 - x1);
	        return;
	      }
	      var tt = p * p,
	        ttt = tt * p,
	        u = 1 - p,
	        uu = u * u,
	        uuu = uu * u;
	      var ut = u * p,
	        ut3 = ut * 3,
	        uut3 = u * ut3,
	        utt3 = ut3 * p;
	      var x = x1 * uuu + cx1 * uut3 + cx2 * utt3 + x2 * ttt,
	        y = y1 * uuu + cy1 * uut3 + cy2 * utt3 + y2 * ttt;
	      out[o] = x;
	      out[o + 1] = y;
	      if (tangents) {
	        if (p < 0.001) out[o + 2] = Math.atan2(cy1 - y1, cx1 - x1);else out[o + 2] = Math.atan2(y - (y1 * uu + cy1 * ut * 2 + cy2 * tt), x - (x1 * uu + cx1 * ut * 2 + cx2 * tt));
	      }
	    }
	  }, {
	    key: "sort",
	    value: function sort(skeleton) {
	      var slotIndex = this.slot.data.index;
	      var slotBone = this.slot.bone;
	      if (skeleton.skin != null) this.sortPathSlot(skeleton, skeleton.skin, slotIndex, slotBone);
	      if (skeleton.data.defaultSkin != null && skeleton.data.defaultSkin !== skeleton.skin) this.sortPathSlot(skeleton, skeleton.data.defaultSkin, slotIndex, slotBone);
	      this.sortPath(skeleton, this.slot.pose.attachment, slotBone);
	      var bones = this.bones;
	      var boneCount = this.bones.length;
	      for (var i = 0; i < boneCount; i++) {
	        var bone = bones[i].bone;
	        skeleton.sortBone(bone);
	        skeleton.constrained(bone);
	      }
	      skeleton._updateCache.push(this);
	      for (var _i7 = 0; _i7 < boneCount; _i7++) skeleton.sortReset(bones[_i7].bone.children);
	      for (var _i8 = 0; _i8 < boneCount; _i8++) bones[_i8].bone.sorted = true;
	    }
	  }, {
	    key: "sortPathSlot",
	    value: function sortPathSlot(skeleton, skin, slotIndex, slotBone) {
	      var entries = skin.getAttachments();
	      for (var i = 0, n = entries.length; i < n; i++) {
	        var entry = entries[i];
	        if (entry.slotIndex === slotIndex) this.sortPath(skeleton, entry.attachment, slotBone);
	      }
	    }
	  }, {
	    key: "sortPath",
	    value: function sortPath(skeleton, attachment, slotBone) {
	      if (!(attachment instanceof PathAttachment)) return;
	      var pathBones = attachment.bones;
	      if (pathBones == null) skeleton.sortBone(slotBone);else {
	        var bones = skeleton.bones;
	        for (var i = 0, n = pathBones.length; i < n;) {
	          var nn = pathBones[i++];
	          nn += i;
	          while (i < nn) skeleton.sortBone(bones[pathBones[i++]]);
	        }
	      }
	    }
	  }, {
	    key: "isSourceActive",
	    value: function isSourceActive() {
	      return this.slot.bone.active;
	    }
	  }]);
	}(Constraint);
	_defineProperty(PathConstraint, "NONE", -1);
	_defineProperty(PathConstraint, "BEFORE", -2);
	_defineProperty(PathConstraint, "AFTER", -3);

	var Physics;
	(function (Physics) {
	  Physics[Physics["none"] = 0] = "none";
	  Physics[Physics["reset"] = 1] = "reset";
	  Physics[Physics["update"] = 2] = "update";
	  Physics[Physics["pose"] = 3] = "pose";
	})(Physics || (Physics = {}));

	var PhysicsConstraintPose = function () {
	  function PhysicsConstraintPose() {
	    _classCallCheck(this, PhysicsConstraintPose);
	    _defineProperty(this, "inertia", 0);
	    _defineProperty(this, "strength", 0);
	    _defineProperty(this, "damping", 0);
	    _defineProperty(this, "massInverse", 0);
	    _defineProperty(this, "wind", 0);
	    _defineProperty(this, "gravity", 0);
	    _defineProperty(this, "mix", 0);
	  }
	  return _createClass(PhysicsConstraintPose, [{
	    key: "set",
	    value: function set(pose) {
	      this.inertia = pose.inertia;
	      this.strength = pose.strength;
	      this.damping = pose.damping;
	      this.massInverse = pose.massInverse;
	      this.wind = pose.wind;
	      this.gravity = pose.gravity;
	      this.mix = pose.mix;
	    }
	  }]);
	}();

	var SlotPose = function () {
	  function SlotPose() {
	    _classCallCheck(this, SlotPose);
	    _defineProperty(this, "color", new Color(1, 1, 1, 1));
	    _defineProperty(this, "darkColor", null);
	    _defineProperty(this, "attachment", null);
	    _defineProperty(this, "sequenceIndex", 0);
	    _defineProperty(this, "deform", []);
	  }
	  return _createClass(SlotPose, [{
	    key: "SlotPose",
	    value: function SlotPose() {}
	  }, {
	    key: "set",
	    value: function set(pose) {
	      var _this$deform;
	      if (pose == null) throw new Error("pose cannot be null.");
	      this.color.setFromColor(pose.color);
	      if (this.darkColor != null && pose.darkColor != null) this.darkColor.setFromColor(pose.darkColor);
	      this.attachment = pose.attachment;
	      this.sequenceIndex = pose.sequenceIndex;
	      this.deform.length = 0;
	      (_this$deform = this.deform).push.apply(_this$deform, _toConsumableArray(pose.deform));
	    }
	  }, {
	    key: "getAttachment",
	    value: function getAttachment() {
	      return this.attachment;
	    }
	  }, {
	    key: "setAttachment",
	    value: function setAttachment(attachment) {
	      if (this.attachment === attachment) return;
	      if (!(attachment instanceof VertexAttachment) || !(this.attachment instanceof VertexAttachment) || attachment.timelineAttachment !== this.attachment.timelineAttachment) {
	        this.deform.length = 0;
	      }
	      this.attachment = attachment;
	      this.sequenceIndex = -1;
	    }
	  }]);
	}();

	var Slot = function (_Posed) {
	  function Slot(data, skeleton) {
	    var _this;
	    _classCallCheck(this, Slot);
	    _this = _callSuper(this, Slot, [data, new SlotPose(), new SlotPose()]);
	    _defineProperty(_this, "skeleton", void 0);
	    _defineProperty(_this, "bone", void 0);
	    _defineProperty(_this, "attachmentState", 0);
	    if (!skeleton) throw new Error("skeleton cannot be null.");
	    _this.skeleton = skeleton;
	    _this.bone = skeleton.bones[data.boneData.index];
	    if (data.setupPose.darkColor != null) {
	      _this.pose.darkColor = new Color();
	      _this.constrainedPose.darkColor = new Color();
	    }
	    _this.setupPose();
	    return _this;
	  }
	  _inherits(Slot, _Posed);
	  return _createClass(Slot, [{
	    key: "copy",
	    value: function copy(slot, bone, skeleton) {
	      var copy = new Slot(slot.data, this.skeleton);
	      if (this.data.setupPose.darkColor != null) {
	        copy.pose.darkColor = new Color();
	        copy.constrainedPose.darkColor = new Color();
	      }
	      copy.pose.set(slot.pose);
	      return copy;
	    }
	  }, {
	    key: "setupPose",
	    value: function setupPose() {
	      this.pose.color.setFromColor(this.data.setupPose.color);
	      if (this.pose.darkColor) this.pose.darkColor.setFromColor(this.data.setupPose.darkColor);
	      this.pose.sequenceIndex = this.data.setupPose.sequenceIndex;
	      if (!this.data.attachmentName) this.pose.setAttachment(null);else {
	        this.pose.attachment = null;
	        this.pose.setAttachment(this.skeleton.getAttachment(this.data.index, this.data.attachmentName));
	      }
	    }
	  }]);
	}(Posed);

	var Skeleton = function () {
	  function Skeleton(data) {
	    _classCallCheck(this, Skeleton);
	    _defineProperty(this, "data", void 0);
	    _defineProperty(this, "bones", void 0);
	    _defineProperty(this, "slots", void 0);
	    _defineProperty(this, "drawOrder", void 0);
	    _defineProperty(this, "constraints", void 0);
	    _defineProperty(this, "physics", void 0);
	    _defineProperty(this, "_updateCache", []);
	    _defineProperty(this, "resetCache", []);
	    _defineProperty(this, "skin", null);
	    _defineProperty(this, "color", void 0);
	    _defineProperty(this, "scaleX", 1);
	    _defineProperty(this, "_scaleY", 1);
	    _defineProperty(this, "x", 0);
	    _defineProperty(this, "y", 0);
	    _defineProperty(this, "time", 0);
	    _defineProperty(this, "windX", 1);
	    _defineProperty(this, "windY", 0);
	    _defineProperty(this, "gravityX", 0);
	    _defineProperty(this, "gravityY", 1);
	    _defineProperty(this, "_update", 0);
	    if (!data) throw new Error("data cannot be null.");
	    this.data = data;
	    this.bones = [];
	    for (var i = 0; i < data.bones.length; i++) {
	      var boneData = data.bones[i];
	      var bone = void 0;
	      if (!boneData.parent) bone = new Bone(boneData, null);else {
	        var parent = this.bones[boneData.parent.index];
	        bone = new Bone(boneData, parent);
	        parent.children.push(bone);
	      }
	      this.bones.push(bone);
	    }
	    this.slots = [];
	    var _iterator = _createForOfIteratorHelper(this.data.slots),
	      _step;
	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var slotData = _step.value;
	        this.slots.push(new Slot(slotData, this));
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	    this.drawOrder = new DrawOrder(this.slots);
	    this.physics = [];
	    this.constraints = [];
	    var _iterator2 = _createForOfIteratorHelper(this.data.constraints),
	      _step2;
	    try {
	      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	        var constraintData = _step2.value;
	        var constraint = constraintData.create(this);
	        if (constraint instanceof PhysicsConstraint) this.physics.push(constraint);
	        this.constraints.push(constraint);
	      }
	    } catch (err) {
	      _iterator2.e(err);
	    } finally {
	      _iterator2.f();
	    }
	    this.color = new Color(1, 1, 1, 1);
	    this.updateCache();
	  }
	  return _createClass(Skeleton, [{
	    key: "scaleY",
	    get: function get() {
	      return this._scaleY * Skeleton.yDir;
	    },
	    set: function set(scaleY) {
	      this._scaleY = scaleY;
	    }
	  }, {
	    key: "updateCache",
	    value: function updateCache() {
	      this._updateCache.length = 0;
	      this.resetCache.length = 0;
	      this.drawOrder.unconstrained();
	      var slots = this.slots;
	      for (var i = 0, _n = slots.length; i < _n; i++) slots[i].unconstrained();
	      var bones = this.bones;
	      var boneCount = bones.length;
	      for (var _i = 0, _n2 = boneCount; _i < _n2; _i++) {
	        var bone = bones[_i];
	        bone.sorted = bone.data.skinRequired;
	        bone.active = !bone.sorted;
	        bone.unconstrained();
	      }
	      if (this.skin) {
	        var skinBones = this.skin.bones;
	        for (var _i2 = 0, _n3 = this.skin.bones.length; _i2 < _n3; _i2++) {
	          var _bone = this.bones[skinBones[_i2].index];
	          do {
	            _bone.sorted = false;
	            _bone.active = true;
	            _bone = _bone.parent;
	          } while (_bone);
	        }
	      }
	      var constraints = this.constraints;
	      var n = this.constraints.length;
	      for (var _i3 = 0; _i3 < n; _i3++) constraints[_i3].unconstrained();
	      for (var _i4 = 0; _i4 < n; _i4++) {
	        var constraint = constraints[_i4];
	        constraint.active = constraint.isSourceActive() && (!constraint.data.skinRequired || this.skin != null && this.skin.constraints.includes(constraint.data));
	        if (constraint.active) constraint.sort(this);
	      }
	      for (var _i5 = 0; _i5 < boneCount; _i5++) this.sortBone(bones[_i5]);
	      n = this._updateCache.length;
	      for (var _i6 = 0; _i6 < n; _i6++) {
	        var updateable = this._updateCache[_i6];
	        if (updateable instanceof Bone) this._updateCache[_i6] = updateable.appliedPose;
	      }
	    }
	  }, {
	    key: "constrained",
	    value: function constrained(object) {
	      if (object.pose === object.appliedPose) {
	        object.constrained();
	        this.resetCache.push(object);
	      }
	    }
	  }, {
	    key: "sortBone",
	    value: function sortBone(bone) {
	      if (bone.sorted || !bone.active) return;
	      var parent = bone.parent;
	      if (parent) this.sortBone(parent);
	      bone.sorted = true;
	      this._updateCache.push(bone);
	    }
	  }, {
	    key: "sortReset",
	    value: function sortReset(bones) {
	      for (var i = 0, n = bones.length; i < n; i++) {
	        var bone = bones[i];
	        if (bone.active) {
	          if (bone.sorted) this.sortReset(bone.children);
	          bone.sorted = false;
	        }
	      }
	    }
	  }, {
	    key: "updateWorldTransform",
	    value: function updateWorldTransform(physics) {
	      this._update++;
	      if (this.drawOrder.appliedPose === this.drawOrder.constrainedPose) this.drawOrder.resetConstrained();
	      var resetCache = this.resetCache;
	      for (var i = 0, n = this.resetCache.length; i < n; i++) resetCache[i].resetConstrained();
	      var updateCache = this._updateCache;
	      for (var _i7 = 0, _n4 = this._updateCache.length; _i7 < _n4; _i7++) updateCache[_i7].update(this, physics);
	    }
	  }, {
	    key: "setupPose",
	    value: function setupPose() {
	      this.setupPoseBones();
	      this.setupPoseSlots();
	    }
	  }, {
	    key: "setupPoseBones",
	    value: function setupPoseBones() {
	      var bones = this.bones;
	      for (var i = 0, n = bones.length; i < n; i++) bones[i].setupPose();
	      var constraints = this.constraints;
	      for (var _i8 = 0, _n5 = constraints.length; _i8 < _n5; _i8++) constraints[_i8].setupPose();
	    }
	  }, {
	    key: "setupPoseSlots",
	    value: function setupPoseSlots() {
	      this.drawOrder.setupPose();
	      var slots = this.slots;
	      for (var i = 0, n = slots.length; i < n; i++) slots[i].setupPose();
	    }
	  }, {
	    key: "getRootBone",
	    value: function getRootBone() {
	      if (this.bones.length === 0) return null;
	      return this.bones[0];
	    }
	  }, {
	    key: "findBone",
	    value: function findBone(boneName) {
	      if (!boneName) throw new Error("boneName cannot be null.");
	      var bones = this.bones;
	      for (var i = 0, n = bones.length; i < n; i++) if (bones[i].data.name === boneName) return bones[i];
	      return null;
	    }
	  }, {
	    key: "findSlot",
	    value: function findSlot(slotName) {
	      if (!slotName) throw new Error("slotName cannot be null.");
	      var slots = this.slots;
	      for (var i = 0, n = slots.length; i < n; i++) if (slots[i].data.name === slotName) return slots[i];
	      return null;
	    }
	  }, {
	    key: "setSkin",
	    value: function setSkin(newSkin) {
	      if (typeof newSkin === "string") this.setSkinByName(newSkin);else this.setSkinBySkin(newSkin);
	    }
	  }, {
	    key: "setSkinByName",
	    value: function setSkinByName(skinName) {
	      var skin = this.data.findSkin(skinName);
	      if (!skin) throw new Error("Skin not found: ".concat(skinName));
	      this.setSkin(skin);
	    }
	  }, {
	    key: "setSkinBySkin",
	    value: function setSkinBySkin(newSkin) {
	      if (newSkin === this.skin) return;
	      if (newSkin) {
	        if (this.skin) newSkin.attachAll(this, this.skin);else {
	          var slots = this.slots;
	          for (var i = 0, n = slots.length; i < n; i++) {
	            var slot = slots[i];
	            var name = slot.data.attachmentName;
	            if (name) {
	              var attachment = newSkin.getAttachment(i, name);
	              if (attachment) slot.pose.setAttachment(attachment);
	            }
	          }
	        }
	      }
	      this.skin = newSkin;
	      this.updateCache();
	    }
	  }, {
	    key: "getAttachment",
	    value: function getAttachment(slotNameOrIndex, placeholder) {
	      if (typeof slotNameOrIndex === 'string') return this.getAttachmentByName(slotNameOrIndex, placeholder);
	      return this.getAttachmentByIndex(slotNameOrIndex, placeholder);
	    }
	  }, {
	    key: "getAttachmentByName",
	    value: function getAttachmentByName(slotName, placeholder) {
	      var slot = this.data.findSlot(slotName);
	      if (!slot) throw new Error("Can't find slot with name ".concat(slotName));
	      return this.getAttachment(slot.index, placeholder);
	    }
	  }, {
	    key: "getAttachmentByIndex",
	    value: function getAttachmentByIndex(slotIndex, placeholder) {
	      if (!placeholder) throw new Error("placeholder cannot be null.");
	      if (this.skin) {
	        var attachment = this.skin.getAttachment(slotIndex, placeholder);
	        if (attachment) return attachment;
	      }
	      if (this.data.defaultSkin) return this.data.defaultSkin.getAttachment(slotIndex, placeholder);
	      return null;
	    }
	  }, {
	    key: "setAttachment",
	    value: function setAttachment(slotName, placeholder) {
	      if (!slotName) throw new Error("slotName cannot be null.");
	      var slot = this.findSlot(slotName);
	      if (!slot) throw new Error("Slot not found: ".concat(slotName));
	      var attachment = null;
	      if (placeholder) {
	        attachment = this.getAttachment(slot.data.index, placeholder);
	        if (!attachment) throw new Error("Attachment not found: ".concat(placeholder, ", for slot: ").concat(slotName));
	      }
	      slot.pose.setAttachment(attachment);
	    }
	  }, {
	    key: "findConstraint",
	    value: function findConstraint(constraintName, type) {
	      if (constraintName == null) throw new Error("constraintName cannot be null.");
	      if (type == null) throw new Error("type cannot be null.");
	      var constraints = this.constraints;
	      for (var i = 0, n = constraints.length; i < n; i++) {
	        var constraint = constraints[i];
	        if (constraint instanceof type && constraint.data.name === constraintName) return constraint;
	      }
	      return null;
	    }
	  }, {
	    key: "getBoundsRect",
	    value: function getBoundsRect(clipper) {
	      var offset = new Vector2();
	      var size = new Vector2();
	      this.getBounds(offset, size, undefined, clipper);
	      return {
	        x: offset.x,
	        y: offset.y,
	        width: size.x,
	        height: size.y
	      };
	    }
	  }, {
	    key: "getBounds",
	    value: function getBounds(offset, size) {
	      var temp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Array(2);
	      var clipper = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
	      if (!offset) throw new Error("offset cannot be null.");
	      if (!size) throw new Error("size cannot be null.");
	      var drawOrder = this.drawOrder.appliedPose;
	      var slots = drawOrder;
	      var minX = Number.POSITIVE_INFINITY,
	        minY = Number.POSITIVE_INFINITY,
	        maxX = Number.NEGATIVE_INFINITY,
	        maxY = Number.NEGATIVE_INFINITY;
	      for (var i = 0, n = drawOrder.length; i < n; i++) {
	        var slot = slots[i];
	        if (!slot.bone.active) continue;
	        var verticesLength = 0;
	        var vertices = null;
	        var triangles = null;
	        var attachment = slot.appliedPose.attachment;
	        if (attachment) {
	          if (attachment instanceof RegionAttachment) {
	            verticesLength = 8;
	            vertices = Utils.setArraySize(temp, verticesLength, 0);
	            attachment.computeWorldVertices(slot, attachment.getOffsets(slot.appliedPose), vertices, 0, 2);
	            triangles = Skeleton.quadTriangles;
	          } else if (attachment instanceof MeshAttachment) {
	            verticesLength = attachment.worldVerticesLength;
	            vertices = Utils.setArraySize(temp, verticesLength, 0);
	            attachment.computeWorldVertices(this, slot, 0, verticesLength, vertices, 0, 2);
	            triangles = attachment.triangles;
	          } else if (attachment instanceof ClippingAttachment && clipper) {
	            clipper.clipEnd(slot);
	            clipper.clipStart(this, slot, attachment);
	            continue;
	          }
	          if (vertices && triangles) {
	            if (clipper !== null && clipper !== void 0 && clipper.isClipping() && clipper.clipTriangles(vertices, triangles, triangles.length)) {
	              vertices = clipper.clippedVertices;
	              verticesLength = clipper.clippedVertices.length;
	            }
	            for (var ii = 0, nn = vertices.length; ii < nn; ii += 2) {
	              var x = vertices[ii],
	                y = vertices[ii + 1];
	              minX = Math.min(minX, x);
	              minY = Math.min(minY, y);
	              maxX = Math.max(maxX, x);
	              maxY = Math.max(maxY, y);
	            }
	          }
	        }
	        if (clipper) clipper.clipEnd(slot);
	      }
	      if (clipper) clipper.clipEnd();
	      offset.set(minX, minY);
	      size.set(maxX - minX, maxY - minY);
	    }
	  }, {
	    key: "setScale",
	    value: function setScale(scaleX, scaleY) {
	      this.scaleX = scaleX;
	      this.scaleY = scaleY;
	    }
	  }, {
	    key: "setPosition",
	    value: function setPosition(x, y) {
	      this.x = x;
	      this.y = y;
	    }
	  }, {
	    key: "update",
	    value: function update(delta) {
	      this.time += delta;
	    }
	  }, {
	    key: "physicsTranslate",
	    value: function physicsTranslate(x, y) {
	      var constraints = this.physics;
	      for (var i = 0, n = constraints.length; i < n; i++) constraints[i].translate(x, y);
	    }
	  }, {
	    key: "physicsRotate",
	    value: function physicsRotate(x, y, degrees) {
	      var constraints = this.physics;
	      for (var i = 0, n = constraints.length; i < n; i++) constraints[i].rotate(x, y, degrees);
	    }
	  }], [{
	    key: "yDir",
	    get: function get() {
	      return Skeleton.yDown ? -1 : 1;
	    }
	  }]);
	}();
	_defineProperty(Skeleton, "quadTriangles", [0, 1, 2, 2, 3, 0]);
	_defineProperty(Skeleton, "yDown", false);

	var PhysicsConstraint = function (_Constraint) {
	  function PhysicsConstraint(data, skeleton) {
	    var _this;
	    _classCallCheck(this, PhysicsConstraint);
	    _this = _callSuper(this, PhysicsConstraint, [data, new PhysicsConstraintPose(), new PhysicsConstraintPose()]);
	    _defineProperty(_this, "bone", void 0);
	    _defineProperty(_this, "_reset", true);
	    _defineProperty(_this, "ux", 0);
	    _defineProperty(_this, "uy", 0);
	    _defineProperty(_this, "cx", 0);
	    _defineProperty(_this, "cy", 0);
	    _defineProperty(_this, "tx", 0);
	    _defineProperty(_this, "ty", 0);
	    _defineProperty(_this, "xOffset", 0);
	    _defineProperty(_this, "xLag", 0);
	    _defineProperty(_this, "xVelocity", 0);
	    _defineProperty(_this, "yOffset", 0);
	    _defineProperty(_this, "yLag", 0);
	    _defineProperty(_this, "yVelocity", 0);
	    _defineProperty(_this, "rotateOffset", 0);
	    _defineProperty(_this, "rotateLag", 0);
	    _defineProperty(_this, "rotateVelocity", 0);
	    _defineProperty(_this, "scaleOffset", 0);
	    _defineProperty(_this, "scaleLag", 0);
	    _defineProperty(_this, "scaleVelocity", 0);
	    _defineProperty(_this, "remaining", 0);
	    _defineProperty(_this, "lastTime", 0);
	    if (skeleton == null) throw new Error("skeleton cannot be null.");
	    _this.bone = skeleton.bones[data.bone.index].constrainedPose;
	    return _this;
	  }
	  _inherits(PhysicsConstraint, _Constraint);
	  return _createClass(PhysicsConstraint, [{
	    key: "copy",
	    value: function copy(skeleton) {
	      var copy = new PhysicsConstraint(this.data, skeleton);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }, {
	    key: "reset",
	    value: function reset(skeleton) {
	      this.remaining = 0;
	      this.lastTime = skeleton.time;
	      this._reset = true;
	      this.xOffset = 0;
	      this.xLag = 0;
	      this.xVelocity = 0;
	      this.yOffset = 0;
	      this.yLag = 0;
	      this.yVelocity = 0;
	      this.rotateOffset = 0;
	      this.rotateLag = 0;
	      this.rotateVelocity = 0;
	      this.scaleOffset = 0;
	      this.scaleLag = 0;
	      this.scaleVelocity = 0;
	    }
	  }, {
	    key: "translate",
	    value: function translate(x, y) {
	      this.ux -= x;
	      this.uy -= y;
	      this.cx -= x;
	      this.cy -= y;
	    }
	  }, {
	    key: "rotate",
	    value: function rotate(x, y, degrees) {
	      var r = degrees * MathUtils.degRad,
	        cos = Math.cos(r),
	        sin = Math.sin(r);
	      var dx = this.cx - x,
	        dy = this.cy - y;
	      this.translate(dx * cos - dy * sin - dx, dx * sin + dy * cos - dy);
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      var p = this.appliedPose;
	      var mix = p.mix;
	      if (mix === 0) return;
	      var x = this.data.x > 0,
	        y = this.data.y > 0,
	        rotateOrShearX = this.data.rotate > 0 || this.data.shearX > 0,
	        scaleX = this.data.scaleX > 0;
	      var bone = this.bone;
	      var l = bone.bone.data.length,
	        t = this.data.step,
	        z = 0;
	      if (physics === Physics.none) return;
	      bone.modifyWorld(skeleton);
	      switch (physics) {
	        case Physics.reset:
	          this.reset(skeleton);
	        case Physics.update:
	          {
	            var delta = Math.max(skeleton.time - this.lastTime, 0),
	              aa = this.remaining;
	            this.remaining += delta;
	            this.lastTime = skeleton.time;
	            var bx = bone.worldX,
	              by = bone.worldY;
	            if (this._reset) {
	              this._reset = false;
	              this.ux = bx;
	              this.uy = by;
	            } else {
	              var a = this.remaining,
	                i = p.inertia,
	                f = skeleton.data.referenceScale,
	                d = -1,
	                m = 0,
	                e = 0,
	                qx = this.data.limit * delta,
	                qy = qx * Math.abs(skeleton.scaleY);
	              qx *= Math.abs(skeleton.scaleX);
	              if (x || y) {
	                if (x) {
	                  var u = (this.ux - bx) * i;
	                  this.xOffset += u > qx ? qx : u < -qx ? -qx : u;
	                  this.ux = bx;
	                }
	                if (y) {
	                  var _u = (this.uy - by) * i;
	                  this.yOffset += _u > qy ? qy : _u < -qy ? -qy : _u;
	                  this.uy = by;
	                }
	                if (a >= t) {
	                  var xs = this.xOffset,
	                    ys = this.yOffset;
	                  d = Math.pow(p.damping, 60 * t);
	                  m = t * p.massInverse;
	                  e = p.strength;
	                  var w = f * p.wind,
	                    g = f * p.gravity;
	                  var ax = (w * skeleton.windX + g * skeleton.gravityX) * skeleton.scaleX;
	                  var ay = (w * skeleton.windY + g * skeleton.gravityY) * skeleton.scaleY;
	                  do {
	                    if (x) {
	                      this.xVelocity += (ax - this.xOffset * e) * m;
	                      this.xOffset += this.xVelocity * t;
	                      this.xVelocity *= d;
	                    }
	                    if (y) {
	                      this.yVelocity -= (ay + this.yOffset * e) * m;
	                      this.yOffset += this.yVelocity * t;
	                      this.yVelocity *= d;
	                    }
	                    a -= t;
	                  } while (a >= t);
	                  this.xLag = this.xOffset - xs;
	                  this.yLag = this.yOffset - ys;
	                }
	                z = Math.max(0, 1 - a / t);
	                if (x) bone.worldX += (this.xOffset - this.xLag * z) * mix * this.data.x;
	                if (y) bone.worldY += (this.yOffset - this.yLag * z) * mix * this.data.y;
	              }
	              if (rotateOrShearX || scaleX) {
	                var ca = Math.atan2(bone.c, bone.a),
	                  c = 0,
	                  s = 0,
	                  mr = 0,
	                  dx = this.cx - bone.worldX,
	                  dy = this.cy - bone.worldY;
	                if (dx > qx) dx = qx;else if (dx < -qx) dx = -qx;
	                if (dy > qy) dy = qy;else if (dy < -qy) dy = -qy;
	                a = this.remaining;
	                if (rotateOrShearX) {
	                  mr = (this.data.rotate + this.data.shearX) * mix;
	                  z = this.rotateLag * Math.max(0, 1 - aa / t);
	                  var r = Math.atan2(dy + this.ty, dx + this.tx) - ca - (this.rotateOffset - z) * mr;
	                  this.rotateOffset += (r - Math.ceil(r * MathUtils.invPI2 - 0.5) * MathUtils.PI2) * i;
	                  r = (this.rotateOffset - z) * mr + ca;
	                  c = Math.cos(r);
	                  s = Math.sin(r);
	                  if (scaleX) {
	                    r = l * bone.getWorldScaleX();
	                    if (r > 0) this.scaleOffset += (dx * c + dy * s) * i / r;
	                  }
	                } else {
	                  c = Math.cos(ca);
	                  s = Math.sin(ca);
	                  var _r = l * bone.getWorldScaleX() - this.scaleLag * Math.max(0, 1 - aa / t);
	                  if (_r > 0) this.scaleOffset += (dx * c + dy * s) * i / _r;
	                }
	                if (a >= t) {
	                  if (d === -1) {
	                    d = Math.pow(p.damping, 60 * t);
	                    m = t * p.massInverse;
	                    e = p.strength;
	                  }
	                  var _ax = p.wind * skeleton.windX + p.gravity * skeleton.gravityX;
	                  var _ay = (p.wind * skeleton.windY + p.gravity * skeleton.gravityY) * Skeleton.yDir;
	                  var rs = this.rotateOffset,
	                    ss = this.scaleOffset,
	                    h = l / f;
	                  while (true) {
	                    a -= t;
	                    if (scaleX) {
	                      this.scaleVelocity += (_ax * c - _ay * s - this.scaleOffset * e) * m;
	                      this.scaleOffset += this.scaleVelocity * t;
	                      this.scaleVelocity *= d;
	                    }
	                    if (rotateOrShearX) {
	                      this.rotateVelocity -= ((_ax * s + _ay * c) * h + this.rotateOffset * e) * m;
	                      this.rotateOffset += this.rotateVelocity * t;
	                      this.rotateVelocity *= d;
	                      if (a < t) break;
	                      var _r2 = this.rotateOffset * mr + ca;
	                      c = Math.cos(_r2);
	                      s = Math.sin(_r2);
	                    } else if (a < t) break;
	                  }
	                  this.rotateLag = this.rotateOffset - rs;
	                  this.scaleLag = this.scaleOffset - ss;
	                }
	                z = Math.max(0, 1 - a / t);
	              }
	              this.remaining = a;
	            }
	            this.cx = bone.worldX;
	            this.cy = bone.worldY;
	            break;
	          }
	        case Physics.pose:
	          z = Math.max(0, 1 - this.remaining / t);
	          if (x) bone.worldX += (this.xOffset - this.xLag * z) * mix * this.data.x;
	          if (y) bone.worldY += (this.yOffset - this.yLag * z) * mix * this.data.y;
	      }
	      if (rotateOrShearX) {
	        var o = (this.rotateOffset - this.rotateLag * z) * mix,
	          _s = 0,
	          _c = 0,
	          _a = 0;
	        if (this.data.shearX > 0) {
	          var _r3 = 0;
	          if (this.data.rotate > 0) {
	            _r3 = o * this.data.rotate;
	            _s = Math.sin(_r3);
	            _c = Math.cos(_r3);
	            _a = bone.b;
	            bone.b = _c * _a - _s * bone.d;
	            bone.d = _s * _a + _c * bone.d;
	          }
	          _r3 += o * this.data.shearX;
	          _s = Math.sin(_r3);
	          _c = Math.cos(_r3);
	          _a = bone.a;
	          bone.a = _c * _a - _s * bone.c;
	          bone.c = _s * _a + _c * bone.c;
	        } else {
	          o *= this.data.rotate;
	          _s = Math.sin(o);
	          _c = Math.cos(o);
	          _a = bone.a;
	          bone.a = _c * _a - _s * bone.c;
	          bone.c = _s * _a + _c * bone.c;
	          _a = bone.b;
	          bone.b = _c * _a - _s * bone.d;
	          bone.d = _s * _a + _c * bone.d;
	        }
	      }
	      if (scaleX) {
	        var _s2 = 1 + (this.scaleOffset - this.scaleLag * z) * mix * this.data.scaleX;
	        bone.a *= _s2;
	        bone.c *= _s2;
	        switch (this.data.scaleYMode) {
	          case ScaleYMode.Uniform:
	            bone.b *= _s2;
	            bone.d *= _s2;
	            break;
	          case ScaleYMode.Volume:
	            _s2 = Math.abs(_s2);
	            _s2 = _s2 >= 0.7 ? 1 / _s2 : 4 - 3.67347 * _s2;
	            bone.b *= _s2;
	            bone.d *= _s2;
	        }
	      }
	      if (physics !== Physics.pose) {
	        this.tx = l * bone.a;
	        this.ty = l * bone.c;
	      }
	    }
	  }, {
	    key: "sort",
	    value: function sort(skeleton) {
	      var bone = this.bone.bone;
	      skeleton.sortBone(bone);
	      skeleton._updateCache.push(this);
	      skeleton.sortReset(bone.children);
	      skeleton.constrained(bone);
	    }
	  }, {
	    key: "isSourceActive",
	    value: function isSourceActive() {
	      return this.bone.bone.active;
	    }
	  }]);
	}(Constraint);

	var PhysicsConstraintData = function (_ConstraintData) {
	  function PhysicsConstraintData(name) {
	    var _this;
	    _classCallCheck(this, PhysicsConstraintData);
	    _this = _callSuper(this, PhysicsConstraintData, [name, new PhysicsConstraintPose()]);
	    _defineProperty(_this, "_bone", null);
	    _defineProperty(_this, "x", 0);
	    _defineProperty(_this, "y", 0);
	    _defineProperty(_this, "rotate", 0);
	    _defineProperty(_this, "scaleX", 0);
	    _defineProperty(_this, "shearX", 0);
	    _defineProperty(_this, "limit", 0);
	    _defineProperty(_this, "step", 0);
	    _defineProperty(_this, "inertiaGlobal", false);
	    _defineProperty(_this, "strengthGlobal", false);
	    _defineProperty(_this, "dampingGlobal", false);
	    _defineProperty(_this, "massGlobal", false);
	    _defineProperty(_this, "windGlobal", false);
	    _defineProperty(_this, "gravityGlobal", false);
	    _defineProperty(_this, "mixGlobal", false);
	    _defineProperty(_this, "_scaleYMode", ScaleYMode.None);
	    return _this;
	  }
	  _inherits(PhysicsConstraintData, _ConstraintData);
	  return _createClass(PhysicsConstraintData, [{
	    key: "bone",
	    get: function get() {
	      if (!this._bone) throw new Error("BoneData not set.");else return this._bone;
	    },
	    set: function set(boneData) {
	      this._bone = boneData;
	    }
	  }, {
	    key: "scaleYMode",
	    get: function get() {
	      return this._scaleYMode;
	    },
	    set: function set(scaleYMode) {
	      if (scaleYMode == null) throw new Error("scaleYMode cannot be null.");
	      this._scaleYMode = scaleYMode;
	    }
	  }, {
	    key: "create",
	    value: function create(skeleton) {
	      return new PhysicsConstraint(this, skeleton);
	    }
	  }]);
	}(ConstraintData);

	(function () {
	  if (typeof Math.fround === "undefined") {
	    Math.fround = function (array) {
	      return function (x) {
	        array[0] = x;
	        return array[0];
	      };
	    }(new Float32Array(1));
	  }
	})();

	var SliderPose = function () {
	  function SliderPose() {
	    _classCallCheck(this, SliderPose);
	    _defineProperty(this, "time", 0);
	    _defineProperty(this, "mix", 0);
	  }
	  return _createClass(SliderPose, [{
	    key: "set",
	    value: function set(pose) {
	      this.time = pose.time;
	      this.mix = pose.mix;
	    }
	  }]);
	}();

	var Slider = function (_Constraint) {
	  function Slider(data, skeleton) {
	    var _this;
	    _classCallCheck(this, Slider);
	    _this = _callSuper(this, Slider, [data, new SliderPose(), new SliderPose()]);
	    _defineProperty(_this, "bone", null);
	    if (!skeleton) throw new Error("skeleton cannot be null.");
	    if (data.bone != null) _this.bone = skeleton.bones[data.bone.index];
	    return _this;
	  }
	  _inherits(Slider, _Constraint);
	  return _createClass(Slider, [{
	    key: "copy",
	    value: function copy(skeleton) {
	      var copy = new Slider(this.data, skeleton);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      var p = this.appliedPose;
	      if (p.mix === 0) return;
	      var data = this.data,
	        animation = data.animation,
	        bone = this.bone;
	      if (bone !== null) {
	        if (!bone.active) return;
	        if (data.local) bone.appliedPose.validateLocalTransform(skeleton);
	        p.time = data.offset + (data.property.value(skeleton, bone.appliedPose, data.local, Slider.offsets) - data.property.offset) * data.scale;
	        if (data.loop) p.time = animation.duration + p.time % animation.duration;else p.time = Math.max(0, p.time);
	      }
	      var bones = skeleton.bones;
	      var indices = animation.bones;
	      for (var i = 0, n = animation.bones.length; i < n; i++) bones[indices[i]].appliedPose.modifyLocal(skeleton);
	      animation.apply(skeleton, p.time, p.time, data.loop, null, p.mix, MixFrom.current, data.additive, false, true);
	    }
	  }, {
	    key: "sort",
	    value: function sort(skeleton) {
	      var bone = this.bone;
	      var data = this.data;
	      if (bone && !data.local) skeleton.sortBone(bone);
	      skeleton._updateCache.push(this);
	      var bones = skeleton.bones;
	      var indices = data.animation.bones;
	      for (var i = 0, n = data.animation.bones.length; i < n; i++) {
	        var _bone = bones[indices[i]];
	        _bone.sorted = false;
	        skeleton.sortReset(_bone.children);
	        skeleton.constrained(_bone);
	      }
	      var timelines = data.animation.timelines;
	      var slots = skeleton.slots;
	      var constraints = skeleton.constraints;
	      var physics = skeleton.physics;
	      var physicsCount = skeleton.physics.length;
	      for (var _i = 0, _n = data.animation.timelines.length; _i < _n; _i++) {
	        var t = timelines[_i];
	        if (isSlotTimeline(t)) skeleton.constrained(slots[t.slotIndex]);else if (t instanceof DrawOrderTimeline || t instanceof DrawOrderFolderTimeline) skeleton.drawOrder.constrained();else if (t instanceof PhysicsConstraintTimeline) {
	          if (t.constraintIndex === -1) {
	            for (var ii = 0; ii < physicsCount; ii++) skeleton.constrained(physics[ii]);
	          } else skeleton.constrained(constraints[t.constraintIndex]);
	        } else if (isConstraintTimeline(t)) {
	          var constraintIndex = t.constraintIndex;
	          if (constraintIndex !== -1) skeleton.constrained(constraints[constraintIndex]);
	        }
	      }
	    }
	  }]);
	}(Constraint);
	_defineProperty(Slider, "offsets", [0, 0, 0, 0, 0, 0]);

	var SliderData = function (_ConstraintData) {
	  function SliderData(name) {
	    var _this;
	    _classCallCheck(this, SliderData);
	    _this = _callSuper(this, SliderData, [name, new SliderPose()]);
	    _defineProperty(_this, "animation", void 0);
	    _defineProperty(_this, "additive", false);
	    _defineProperty(_this, "loop", false);
	    _defineProperty(_this, "bone", null);
	    _defineProperty(_this, "property", void 0);
	    _defineProperty(_this, "scale", 0);
	    _defineProperty(_this, "offset", 0);
	    _defineProperty(_this, "local", false);
	    _defineProperty(_this, "max", 0);
	    return _this;
	  }
	  _inherits(SliderData, _ConstraintData);
	  return _createClass(SliderData, [{
	    key: "create",
	    value: function create(skeleton) {
	      return new Slider(this, skeleton);
	    }
	  }]);
	}(ConstraintData);

	var SkeletonData = function () {
	  function SkeletonData() {
	    _classCallCheck(this, SkeletonData);
	    _defineProperty(this, "name", null);
	    _defineProperty(this, "bones", []);
	    _defineProperty(this, "slots", []);
	    _defineProperty(this, "skins", []);
	    _defineProperty(this, "defaultSkin", null);
	    _defineProperty(this, "events", []);
	    _defineProperty(this, "animations", []);
	    _defineProperty(this, "constraints", []);
	    _defineProperty(this, "x", 0);
	    _defineProperty(this, "y", 0);
	    _defineProperty(this, "width", 0);
	    _defineProperty(this, "height", 0);
	    _defineProperty(this, "referenceScale", 100);
	    _defineProperty(this, "version", null);
	    _defineProperty(this, "hash", null);
	    _defineProperty(this, "fps", 30);
	    _defineProperty(this, "imagesPath", null);
	    _defineProperty(this, "audioPath", null);
	  }
	  return _createClass(SkeletonData, [{
	    key: "findBone",
	    value: function findBone(boneName) {
	      if (!boneName) throw new Error("boneName cannot be null.");
	      var bones = this.bones;
	      for (var i = 0, n = bones.length; i < n; i++) if (bones[i].name === boneName) return bones[i];
	      return null;
	    }
	  }, {
	    key: "findSlot",
	    value: function findSlot(slotName) {
	      if (!slotName) throw new Error("slotName cannot be null.");
	      var slots = this.slots;
	      for (var i = 0, n = slots.length; i < n; i++) if (slots[i].name === slotName) return slots[i];
	      return null;
	    }
	  }, {
	    key: "findSkin",
	    value: function findSkin(skinName) {
	      if (!skinName) throw new Error("skinName cannot be null.");
	      var skins = this.skins;
	      for (var i = 0, n = skins.length; i < n; i++) if (skins[i].name === skinName) return skins[i];
	      return null;
	    }
	  }, {
	    key: "findEvent",
	    value: function findEvent(eventDataName) {
	      if (!eventDataName) throw new Error("eventDataName cannot be null.");
	      var events = this.events;
	      for (var i = 0, n = events.length; i < n; i++) if (events[i].name === eventDataName) return events[i];
	      return null;
	    }
	  }, {
	    key: "findSliderAnimations",
	    value: function findSliderAnimations(animations) {
	      var constraints = this.constraints;
	      for (var i = 0, n = this.constraints.length; i < n; i++) {
	        var data = constraints[i];
	        if (data instanceof SliderData && data.animation != null) animations.push(data.animation);
	      }
	      return animations;
	    }
	  }, {
	    key: "findAnimation",
	    value: function findAnimation(animationName) {
	      if (!animationName) throw new Error("animationName cannot be null.");
	      var animations = this.animations;
	      for (var i = 0, n = animations.length; i < n; i++) if (animations[i].name === animationName) return animations[i];
	      return null;
	    }
	  }, {
	    key: "findConstraint",
	    value: function findConstraint(constraintName, type) {
	      if (!constraintName) throw new Error("constraintName cannot be null.");
	      if (type == null) throw new Error("type cannot be null.");
	      var constraints = this.constraints;
	      for (var i = 0, n = this.constraints.length; i < n; i++) {
	        var constraint = constraints[i];
	        if (constraint instanceof type && constraint.name === constraintName) return constraint;
	      }
	      return null;
	    }
	  }]);
	}();

	var SkinEntry = _createClass(function SkinEntry() {
	  var slotIndex = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
	  var placeholder = arguments.length > 1 ? arguments[1] : undefined;
	  var attachment = arguments.length > 2 ? arguments[2] : undefined;
	  _classCallCheck(this, SkinEntry);
	  _defineProperty(this, "slotIndex", 0);
	  _defineProperty(this, "placeholder", void 0);
	  _defineProperty(this, "attachment", void 0);
	  this.slotIndex = slotIndex;
	  this.placeholder = placeholder;
	  this.attachment = attachment;
	});
	var Skin = function () {
	  function Skin(name) {
	    _classCallCheck(this, Skin);
	    _defineProperty(this, "name", void 0);
	    _defineProperty(this, "attachments", []);
	    _defineProperty(this, "bones", []);
	    _defineProperty(this, "constraints", []);
	    _defineProperty(this, "color", new Color(0.99607843, 0.61960787, 0.30980393, 1));
	    if (!name) throw new Error("name cannot be null.");
	    this.name = name;
	  }
	  return _createClass(Skin, [{
	    key: "setAttachment",
	    value: function setAttachment(slotIndex, placeholder, attachment) {
	      if (!attachment) throw new Error("attachment cannot be null.");
	      var attachments = this.attachments;
	      if (slotIndex >= attachments.length) attachments.length = slotIndex + 1;
	      if (!attachments[slotIndex]) attachments[slotIndex] = {};
	      attachments[slotIndex][placeholder] = attachment;
	    }
	  }, {
	    key: "addSkin",
	    value: function addSkin(skin) {
	      for (var i = 0; i < skin.bones.length; i++) {
	        var bone = skin.bones[i];
	        var contained = false;
	        for (var ii = 0; ii < this.bones.length; ii++) {
	          if (this.bones[ii] === bone) {
	            contained = true;
	            break;
	          }
	        }
	        if (!contained) this.bones.push(bone);
	      }
	      for (var _i = 0; _i < skin.constraints.length; _i++) {
	        var constraint = skin.constraints[_i];
	        var _contained = false;
	        for (var _ii = 0; _ii < this.constraints.length; _ii++) {
	          if (this.constraints[_ii] === constraint) {
	            _contained = true;
	            break;
	          }
	        }
	        if (!_contained) this.constraints.push(constraint);
	      }
	      var attachments = skin.getAttachments();
	      for (var _i2 = 0; _i2 < attachments.length; _i2++) {
	        var attachment = attachments[_i2];
	        this.setAttachment(attachment.slotIndex, attachment.placeholder, attachment.attachment);
	      }
	    }
	  }, {
	    key: "copySkin",
	    value: function copySkin(skin) {
	      for (var i = 0; i < skin.bones.length; i++) {
	        var bone = skin.bones[i];
	        var contained = false;
	        for (var ii = 0; ii < this.bones.length; ii++) {
	          if (this.bones[ii] === bone) {
	            contained = true;
	            break;
	          }
	        }
	        if (!contained) this.bones.push(bone);
	      }
	      for (var _i3 = 0; _i3 < skin.constraints.length; _i3++) {
	        var constraint = skin.constraints[_i3];
	        var _contained2 = false;
	        for (var _ii2 = 0; _ii2 < this.constraints.length; _ii2++) {
	          if (this.constraints[_ii2] === constraint) {
	            _contained2 = true;
	            break;
	          }
	        }
	        if (!_contained2) this.constraints.push(constraint);
	      }
	      var attachments = skin.getAttachments();
	      for (var _i4 = 0; _i4 < attachments.length; _i4++) {
	        var attachment = attachments[_i4];
	        if (!attachment.attachment) continue;
	        if (attachment.attachment instanceof MeshAttachment) {
	          attachment.attachment = attachment.attachment.newLinkedMesh();
	          this.setAttachment(attachment.slotIndex, attachment.placeholder, attachment.attachment);
	        } else {
	          attachment.attachment = attachment.attachment.copy();
	          this.setAttachment(attachment.slotIndex, attachment.placeholder, attachment.attachment);
	        }
	      }
	    }
	  }, {
	    key: "getAttachment",
	    value: function getAttachment(slotIndex, placeholder) {
	      var dictionary = this.attachments[slotIndex];
	      return dictionary ? dictionary[placeholder] : null;
	    }
	  }, {
	    key: "removeAttachment",
	    value: function removeAttachment(slotIndex, placeholder) {
	      var dictionary = this.attachments[slotIndex];
	      if (dictionary) delete dictionary[placeholder];
	    }
	  }, {
	    key: "getAttachments",
	    value: function getAttachments() {
	      var entries = [];
	      for (var i = 0; i < this.attachments.length; i++) {
	        var slotAttachments = this.attachments[i];
	        if (slotAttachments) {
	          for (var name in slotAttachments) {
	            var attachment = slotAttachments[name];
	            if (attachment) entries.push(new SkinEntry(i, name, attachment));
	          }
	        }
	      }
	      return entries;
	    }
	  }, {
	    key: "getAttachmentsForSlot",
	    value: function getAttachmentsForSlot(slotIndex, attachments) {
	      var slotAttachments = this.attachments[slotIndex];
	      if (slotAttachments) {
	        for (var name in slotAttachments) {
	          var attachment = slotAttachments[name];
	          if (attachment) attachments.push(new SkinEntry(slotIndex, name, attachment));
	        }
	      }
	    }
	  }, {
	    key: "clear",
	    value: function clear() {
	      this.attachments.length = 0;
	      this.bones.length = 0;
	      this.constraints.length = 0;
	    }
	  }, {
	    key: "attachAll",
	    value: function attachAll(skeleton, oldSkin) {
	      var slotIndex = 0;
	      for (var i = 0; i < skeleton.slots.length; i++) {
	        var slot = skeleton.slots[i];
	        var slotAttachment = slot.pose.getAttachment();
	        if (slotAttachment && slotIndex < oldSkin.attachments.length) {
	          var dictionary = oldSkin.attachments[slotIndex];
	          for (var placeholder in dictionary) {
	            var skinAttachment = dictionary[placeholder];
	            if (slotAttachment === skinAttachment) {
	              var attachment = this.getAttachment(slotIndex, placeholder);
	              if (attachment) slot.pose.setAttachment(attachment);
	              break;
	            }
	          }
	        }
	        slotIndex++;
	      }
	    }
	  }]);
	}();

	var SlotData = function (_PosedData) {
	  function SlotData(index, name, boneData) {
	    var _this;
	    _classCallCheck(this, SlotData);
	    _this = _callSuper(this, SlotData, [name, new SlotPose()]);
	    _defineProperty(_this, "index", 0);
	    _defineProperty(_this, "boneData", void 0);
	    _defineProperty(_this, "attachmentName", null);
	    _defineProperty(_this, "blendMode", BlendMode.Normal);
	    _defineProperty(_this, "visible", true);
	    if (index < 0) throw new Error("index must be >= 0.");
	    if (!boneData) throw new Error("boneData cannot be null.");
	    _this.index = index;
	    _this.boneData = boneData;
	    return _this;
	  }
	  _inherits(SlotData, _PosedData);
	  return _createClass(SlotData);
	}(PosedData);
	var BlendMode;
	(function (BlendMode) {
	  BlendMode[BlendMode["Normal"] = 0] = "Normal";
	  BlendMode[BlendMode["Additive"] = 1] = "Additive";
	  BlendMode[BlendMode["Multiply"] = 2] = "Multiply";
	  BlendMode[BlendMode["Screen"] = 3] = "Screen";
	})(BlendMode || (BlendMode = {}));

	var TransformConstraintPose = function () {
	  function TransformConstraintPose() {
	    _classCallCheck(this, TransformConstraintPose);
	    _defineProperty(this, "mixRotate", 0);
	    _defineProperty(this, "mixX", 0);
	    _defineProperty(this, "mixY", 0);
	    _defineProperty(this, "mixScaleX", 0);
	    _defineProperty(this, "mixScaleY", 0);
	    _defineProperty(this, "mixShearY", 0);
	  }
	  return _createClass(TransformConstraintPose, [{
	    key: "set",
	    value: function set(pose) {
	      this.mixRotate = pose.mixRotate;
	      this.mixX = pose.mixX;
	      this.mixY = pose.mixY;
	      this.mixScaleX = pose.mixScaleX;
	      this.mixScaleY = pose.mixScaleY;
	      this.mixShearY = pose.mixShearY;
	    }
	  }]);
	}();

	var TransformConstraint = function (_Constraint) {
	  function TransformConstraint(data, skeleton) {
	    var _this;
	    _classCallCheck(this, TransformConstraint);
	    _this = _callSuper(this, TransformConstraint, [data, new TransformConstraintPose(), new TransformConstraintPose()]);
	    _defineProperty(_this, "bones", void 0);
	    _defineProperty(_this, "source", void 0);
	    if (!skeleton) throw new Error("skeleton cannot be null.");
	    _this.bones = [];
	    var _iterator = _createForOfIteratorHelper(data.bones),
	      _step;
	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var boneData = _step.value;
	        _this.bones.push(skeleton.bones[boneData.index].constrainedPose);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	    var source = skeleton.bones[data.source.index];
	    if (source == null) throw new Error("source cannot be null.");
	    _this.source = source;
	    return _this;
	  }
	  _inherits(TransformConstraint, _Constraint);
	  return _createClass(TransformConstraint, [{
	    key: "copy",
	    value: function copy(skeleton) {
	      var copy = new TransformConstraint(this.data, skeleton);
	      copy.pose.set(this.pose);
	      return copy;
	    }
	  }, {
	    key: "update",
	    value: function update(skeleton, physics) {
	      var p = this.appliedPose;
	      if (p.mixRotate === 0 && p.mixX === 0 && p.mixY === 0 && p.mixScaleX === 0 && p.mixScaleY === 0 && p.mixShearY === 0) return;
	      var data = this.data;
	      var localSource = data.localSource,
	        localTarget = data.localTarget,
	        additive = data.additive,
	        clamp = data.clamp;
	      var offsets = data.offsets;
	      var source = this.source.appliedPose;
	      if (localSource) source.validateLocalTransform(skeleton);
	      var fromItems = data.properties;
	      var fn = data.properties.length;
	      var bones = this.bones;
	      for (var i = 0, n = this.bones.length; i < n; i++) {
	        var bone = bones[i];
	        if (localTarget) bone.modifyLocal(skeleton);else bone.modifyWorld(skeleton);
	        for (var f = 0; f < fn; f++) {
	          var from = fromItems[f];
	          var value = from.value(skeleton, source, localSource, offsets) - from.offset;
	          var toItems = from.to;
	          for (var t = 0, tn = from.to.length; t < tn; t++) {
	            var to = toItems[t];
	            if (to.mix(p) !== 0) {
	              var clamped = to.offset + value * to.scale;
	              if (clamp) {
	                if (to.offset < to.max) clamped = MathUtils.clamp(clamped, to.offset, to.max);else clamped = MathUtils.clamp(clamped, to.max, to.offset);
	              }
	              to.apply(skeleton, p, bone, clamped, localTarget, additive);
	            }
	          }
	        }
	      }
	    }
	  }, {
	    key: "sort",
	    value: function sort(skeleton) {
	      if (!this.data.localSource) skeleton.sortBone(this.source);
	      var bones = this.bones;
	      var boneCount = this.bones.length;
	      var worldTarget = !this.data.localTarget;
	      if (worldTarget) {
	        for (var i = 0; i < boneCount; i++) skeleton.sortBone(bones[i].bone);
	      }
	      skeleton._updateCache.push(this);
	      for (var _i = 0; _i < boneCount; _i++) {
	        var bone = bones[_i].bone;
	        skeleton.sortReset(bone.children);
	        skeleton.constrained(bone);
	      }
	      for (var _i2 = 0; _i2 < boneCount; _i2++) bones[_i2].bone.sorted = worldTarget;
	    }
	  }, {
	    key: "isSourceActive",
	    value: function isSourceActive() {
	      return this.source.active;
	    }
	  }]);
	}(Constraint);

	var TransformConstraintData = function (_ConstraintData) {
	  function TransformConstraintData(name) {
	    var _this;
	    _classCallCheck(this, TransformConstraintData);
	    _this = _callSuper(this, TransformConstraintData, [name, new TransformConstraintPose()]);
	    _defineProperty(_this, "bones", []);
	    _defineProperty(_this, "_source", null);
	    _defineProperty(_this, "offsets", [0, 0, 0, 0, 0, 0]);
	    _defineProperty(_this, "offsetX", 0);
	    _defineProperty(_this, "offsetY", 0);
	    _defineProperty(_this, "localSource", false);
	    _defineProperty(_this, "localTarget", false);
	    _defineProperty(_this, "additive", false);
	    _defineProperty(_this, "clamp", false);
	    _defineProperty(_this, "properties", []);
	    return _this;
	  }
	  _inherits(TransformConstraintData, _ConstraintData);
	  return _createClass(TransformConstraintData, [{
	    key: "source",
	    get: function get() {
	      if (!this._source) throw new Error("BoneData not set.");else return this._source;
	    },
	    set: function set(source) {
	      this._source = source;
	    }
	  }, {
	    key: "create",
	    value: function create(skeleton) {
	      return new TransformConstraint(this, skeleton);
	    }
	  }, {
	    key: "getOffsetRotation",
	    value: function getOffsetRotation() {
	      return this.offsets[TransformConstraintData.ROTATION];
	    }
	  }, {
	    key: "setOffsetRotation",
	    value: function setOffsetRotation(offsetRotation) {
	      this.offsets[TransformConstraintData.ROTATION] = offsetRotation;
	    }
	  }, {
	    key: "getOffsetX",
	    value: function getOffsetX() {
	      return this.offsets[TransformConstraintData.X];
	    }
	  }, {
	    key: "setOffsetX",
	    value: function setOffsetX(offsetX) {
	      this.offsets[TransformConstraintData.X] = offsetX;
	    }
	  }, {
	    key: "getOffsetY",
	    value: function getOffsetY() {
	      return this.offsets[TransformConstraintData.Y];
	    }
	  }, {
	    key: "setOffsetY",
	    value: function setOffsetY(offsetY) {
	      this.offsets[TransformConstraintData.Y] = offsetY;
	    }
	  }, {
	    key: "getOffsetScaleX",
	    value: function getOffsetScaleX() {
	      return this.offsets[TransformConstraintData.SCALEX];
	    }
	  }, {
	    key: "setOffsetScaleX",
	    value: function setOffsetScaleX(offsetScaleX) {
	      this.offsets[TransformConstraintData.SCALEX] = offsetScaleX;
	    }
	  }, {
	    key: "getOffsetScaleY",
	    value: function getOffsetScaleY() {
	      return this.offsets[TransformConstraintData.SCALEY];
	    }
	  }, {
	    key: "setOffsetScaleY",
	    value: function setOffsetScaleY(offsetScaleY) {
	      this.offsets[TransformConstraintData.SCALEY] = offsetScaleY;
	    }
	  }, {
	    key: "getOffsetShearY",
	    value: function getOffsetShearY() {
	      return this.offsets[TransformConstraintData.SHEARY];
	    }
	  }, {
	    key: "setOffsetShearY",
	    value: function setOffsetShearY(offsetShearY) {
	      this.offsets[TransformConstraintData.SHEARY] = offsetShearY;
	    }
	  }]);
	}(ConstraintData);
	_defineProperty(TransformConstraintData, "ROTATION", 0);
	_defineProperty(TransformConstraintData, "X", 1);
	_defineProperty(TransformConstraintData, "Y", 2);
	_defineProperty(TransformConstraintData, "SCALEX", 3);
	_defineProperty(TransformConstraintData, "SCALEY", 4);
	_defineProperty(TransformConstraintData, "SHEARY", 5);
	var FromProperty = _createClass(function FromProperty() {
	  _classCallCheck(this, FromProperty);
	  _defineProperty(this, "offset", 0);
	  _defineProperty(this, "to", []);
	});
	var ToProperty = _createClass(function ToProperty() {
	  _classCallCheck(this, ToProperty);
	  _defineProperty(this, "offset", 0);
	  _defineProperty(this, "max", 0);
	  _defineProperty(this, "scale", 0);
	});
	var FromRotate = function (_FromProperty2) {
	  function FromRotate() {
	    _classCallCheck(this, FromRotate);
	    return _callSuper(this, FromRotate, arguments);
	  }
	  _inherits(FromRotate, _FromProperty2);
	  return _createClass(FromRotate, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      if (local) return source.rotation + offsets[TransformConstraintData.ROTATION];
	      var sx = skeleton.scaleX,
	        sy = skeleton.scaleY;
	      var value = Math.atan2(source.c / sy, source.a / sx) * MathUtils.radDeg + ((source.a * source.d - source.b * source.c) * sx * sy > 0 ? offsets[TransformConstraintData.ROTATION] : -offsets[TransformConstraintData.ROTATION]);
	      if (value < 0) value += 360;
	      return value;
	    }
	  }]);
	}(FromProperty);
	var ToRotate = function (_ToProperty2) {
	  function ToRotate() {
	    _classCallCheck(this, ToRotate);
	    return _callSuper(this, ToRotate, arguments);
	  }
	  _inherits(ToRotate, _ToProperty2);
	  return _createClass(ToRotate, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixRotate;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) bone.rotation += (additive ? value : value - bone.rotation) * pose.mixRotate;else {
	        var sx = skeleton.scaleX,
	          sy = skeleton.scaleY,
	          ix = 1 / sx,
	          iy = 1 / sy;
	        var a = bone.a * ix,
	          b = bone.b * ix,
	          c = bone.c * iy,
	          d = bone.d * iy;
	        value *= MathUtils.degRad;
	        if (!additive) value -= Math.atan2(c, a);
	        if (value > MathUtils.PI) value -= MathUtils.PI2;else if (value < -MathUtils.PI) value += MathUtils.PI2;
	        value *= pose.mixRotate;
	        var cos = Math.cos(value),
	          sin = Math.sin(value);
	        bone.a = (cos * a - sin * c) * sx;
	        bone.b = (cos * b - sin * d) * sx;
	        bone.c = (sin * a + cos * c) * sy;
	        bone.d = (sin * b + cos * d) * sy;
	      }
	    }
	  }]);
	}(ToProperty);
	var FromX = function (_FromProperty3) {
	  function FromX() {
	    _classCallCheck(this, FromX);
	    return _callSuper(this, FromX, arguments);
	  }
	  _inherits(FromX, _FromProperty3);
	  return _createClass(FromX, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      return local ? source.x + offsets[TransformConstraintData.X] : (offsets[TransformConstraintData.X] * source.a + offsets[TransformConstraintData.Y] * source.b + source.worldX) / skeleton.scaleX;
	    }
	  }]);
	}(FromProperty);
	var ToX = function (_ToProperty3) {
	  function ToX() {
	    _classCallCheck(this, ToX);
	    return _callSuper(this, ToX, arguments);
	  }
	  _inherits(ToX, _ToProperty3);
	  return _createClass(ToX, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixX;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) bone.x += (additive ? value : value - bone.x) * pose.mixX;else {
	        if (!additive) value -= bone.worldX / skeleton.scaleX;
	        bone.worldX += value * pose.mixX * skeleton.scaleX;
	      }
	    }
	  }]);
	}(ToProperty);
	var FromY = function (_FromProperty4) {
	  function FromY() {
	    _classCallCheck(this, FromY);
	    return _callSuper(this, FromY, arguments);
	  }
	  _inherits(FromY, _FromProperty4);
	  return _createClass(FromY, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      return local ? source.y + offsets[TransformConstraintData.Y] : (offsets[TransformConstraintData.X] * source.c + offsets[TransformConstraintData.Y] * source.d + source.worldY) / skeleton.scaleY;
	    }
	  }]);
	}(FromProperty);
	var ToY = function (_ToProperty4) {
	  function ToY() {
	    _classCallCheck(this, ToY);
	    return _callSuper(this, ToY, arguments);
	  }
	  _inherits(ToY, _ToProperty4);
	  return _createClass(ToY, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixY;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) bone.y += (additive ? value : value - bone.y) * pose.mixY;else {
	        if (!additive) value -= bone.worldY / skeleton.scaleY;
	        bone.worldY += value * pose.mixY * skeleton.scaleY;
	      }
	    }
	  }]);
	}(ToProperty);
	var FromScaleX = function (_FromProperty5) {
	  function FromScaleX() {
	    _classCallCheck(this, FromScaleX);
	    return _callSuper(this, FromScaleX, arguments);
	  }
	  _inherits(FromScaleX, _FromProperty5);
	  return _createClass(FromScaleX, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      if (local) return source.scaleX + offsets[TransformConstraintData.SCALEX];
	      var a = source.a / skeleton.scaleX,
	        c = source.c / skeleton.scaleY;
	      return Math.sqrt(a * a + c * c) + offsets[TransformConstraintData.SCALEX];
	    }
	  }]);
	}(FromProperty);
	var ToScaleX = function (_ToProperty5) {
	  function ToScaleX() {
	    _classCallCheck(this, ToScaleX);
	    return _callSuper(this, ToScaleX, arguments);
	  }
	  _inherits(ToScaleX, _ToProperty5);
	  return _createClass(ToScaleX, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixScaleX;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) {
	        if (additive) bone.scaleX *= 1 + (value - 1) * pose.mixScaleX;else if (bone.scaleX !== 0) bone.scaleX += (value - bone.scaleX) * pose.mixScaleX;
	      } else if (additive) {
	        var s = 1 + (value - 1) * pose.mixScaleX;
	        bone.a *= s;
	        bone.c *= s;
	      } else {
	        var a = bone.a / skeleton.scaleX,
	          c = bone.c / skeleton.scaleY,
	          _s = Math.sqrt(a * a + c * c);
	        if (_s !== 0) {
	          _s = 1 + (value - _s) * pose.mixScaleX / _s;
	          bone.a *= _s;
	          bone.c *= _s;
	        }
	      }
	    }
	  }]);
	}(ToProperty);
	var FromScaleY = function (_FromProperty6) {
	  function FromScaleY() {
	    _classCallCheck(this, FromScaleY);
	    return _callSuper(this, FromScaleY, arguments);
	  }
	  _inherits(FromScaleY, _FromProperty6);
	  return _createClass(FromScaleY, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      if (local) return source.scaleY + offsets[TransformConstraintData.SCALEY];
	      var b = source.b / skeleton.scaleX,
	        d = source.d / skeleton.scaleY;
	      return Math.sqrt(b * b + d * d) + offsets[TransformConstraintData.SCALEY];
	    }
	  }]);
	}(FromProperty);
	var ToScaleY = function (_ToProperty6) {
	  function ToScaleY() {
	    _classCallCheck(this, ToScaleY);
	    return _callSuper(this, ToScaleY, arguments);
	  }
	  _inherits(ToScaleY, _ToProperty6);
	  return _createClass(ToScaleY, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixScaleY;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) {
	        if (additive) bone.scaleY *= 1 + (value - 1) * pose.mixScaleY;else if (bone.scaleY !== 0) bone.scaleY += (value - bone.scaleY) * pose.mixScaleY;
	      } else if (additive) {
	        var s = 1 + (value - 1) * pose.mixScaleY;
	        bone.b *= s;
	        bone.d *= s;
	      } else {
	        var b = bone.b / skeleton.scaleX,
	          d = bone.d / skeleton.scaleY,
	          _s2 = Math.sqrt(b * b + d * d);
	        if (_s2 !== 0) {
	          _s2 = 1 + (value - _s2) * pose.mixScaleY / _s2;
	          bone.b *= _s2;
	          bone.d *= _s2;
	        }
	      }
	    }
	  }]);
	}(ToProperty);
	var FromShearY = function (_FromProperty7) {
	  function FromShearY() {
	    _classCallCheck(this, FromShearY);
	    return _callSuper(this, FromShearY, arguments);
	  }
	  _inherits(FromShearY, _FromProperty7);
	  return _createClass(FromShearY, [{
	    key: "value",
	    value: function value(skeleton, source, local, offsets) {
	      if (local) return source.shearY + offsets[TransformConstraintData.SHEARY];
	      var ix = 1 / skeleton.scaleX,
	        iy = 1 / skeleton.scaleY;
	      return (Math.atan2(source.d * iy, source.b * ix) - Math.atan2(source.c * iy, source.a * ix)) * MathUtils.radDeg - 90 + offsets[TransformConstraintData.SHEARY];
	    }
	  }]);
	}(FromProperty);
	var ToShearY = function (_ToProperty7) {
	  function ToShearY() {
	    _classCallCheck(this, ToShearY);
	    return _callSuper(this, ToShearY, arguments);
	  }
	  _inherits(ToShearY, _ToProperty7);
	  return _createClass(ToShearY, [{
	    key: "mix",
	    value: function mix(pose) {
	      return pose.mixShearY;
	    }
	  }, {
	    key: "apply",
	    value: function apply(skeleton, pose, bone, value, local, additive) {
	      if (local) {
	        if (!additive) value -= bone.shearY;
	        bone.shearY += value * pose.mixShearY;
	      } else {
	        var sx = skeleton.scaleX,
	          sy = skeleton.scaleY,
	          b = bone.b / sx,
	          d = bone.d / sy,
	          by = Math.atan2(d, b);
	        value = (value + 90) * MathUtils.degRad;
	        if (additive) value -= MathUtils.PI / 2;else {
	          value -= by - Math.atan2(bone.c / sy, bone.a / sx);
	          if (value > MathUtils.PI) value -= MathUtils.PI2;else if (value < -MathUtils.PI) value += MathUtils.PI2;
	        }
	        value = by + value * pose.mixShearY;
	        var s = Math.sqrt(b * b + d * d);
	        bone.b = Math.cos(value) * s * sx;
	        bone.d = Math.sin(value) * s * sy;
	      }
	    }
	  }]);
	}(ToProperty);

	var SkeletonBinary = function () {
	  function SkeletonBinary(attachmentLoader) {
	    _classCallCheck(this, SkeletonBinary);
	    _defineProperty(this, "scale", 1);
	    _defineProperty(this, "attachmentLoader", void 0);
	    _defineProperty(this, "linkedMeshes", []);
	    this.attachmentLoader = attachmentLoader;
	  }
	  return _createClass(SkeletonBinary, [{
	    key: "readSkeletonData",
	    value: function readSkeletonData(binary) {
	      var scale = this.scale;
	      var skeletonData = new SkeletonData();
	      skeletonData.name = "";
	      var input = new BinaryInput(binary);
	      var lowHash = input.readInt32();
	      var highHash = input.readInt32();
	      skeletonData.hash = highHash === 0 && lowHash === 0 ? null : highHash.toString(16) + lowHash.toString(16);
	      skeletonData.version = input.readString();
	      skeletonData.x = input.readFloat();
	      skeletonData.y = input.readFloat();
	      skeletonData.width = input.readFloat();
	      skeletonData.height = input.readFloat();
	      skeletonData.referenceScale = input.readFloat() * scale;
	      var nonessential = input.readBoolean();
	      if (nonessential) {
	        skeletonData.fps = input.readFloat();
	        skeletonData.imagesPath = input.readString();
	        skeletonData.audioPath = input.readString();
	      }
	      var n = 0;
	      n = input.readInt(true);
	      for (var i = 0; i < n; i++) {
	        var str = input.readString();
	        if (!str) throw new Error("String in string table must not be null.");
	        input.strings.push(str);
	      }
	      var bones = skeletonData.bones;
	      n = input.readInt(true);
	      for (var _i = 0; _i < n; _i++) {
	        var name = input.readString();
	        if (!name) throw new Error("Bone name must not be null.");
	        var parent = _i === 0 ? null : bones[input.readInt(true)];
	        var data = new BoneData(_i, name, parent);
	        var setup = data.setupPose;
	        setup.rotation = input.readFloat();
	        setup.x = input.readFloat() * scale;
	        setup.y = input.readFloat() * scale;
	        setup.scaleX = input.readFloat();
	        setup.scaleY = input.readFloat();
	        setup.shearX = input.readFloat();
	        setup.shearY = input.readFloat();
	        setup.inherit = input.readByte();
	        data.length = input.readFloat() * scale;
	        data.skinRequired = input.readBoolean();
	        if (nonessential) {
	          var _input$readString;
	          Color.rgba8888ToColor(data.color, input.readInt32());
	          data.icon = (_input$readString = input.readString()) !== null && _input$readString !== void 0 ? _input$readString : undefined;
	          data.iconSize = input.readFloat();
	          data.iconRotation = input.readFloat();
	          data.visible = input.readBoolean();
	        }
	        bones.push(data);
	      }
	      n = input.readInt(true);
	      for (var _i2 = 0; _i2 < n; _i2++) {
	        var slotName = input.readString();
	        if (!slotName) throw new Error("Slot name must not be null.");
	        var boneData = bones[input.readInt(true)];
	        var _data = new SlotData(_i2, slotName, boneData);
	        Color.rgba8888ToColor(_data.setupPose.color, input.readInt32());
	        var darkColor = input.readInt32();
	        if (darkColor !== -1) Color.rgb888ToColor(_data.setupPose.darkColor = new Color(), darkColor);
	        _data.attachmentName = input.readStringRef();
	        _data.blendMode = input.readInt(true);
	        if (nonessential) _data.visible = input.readBoolean();
	        skeletonData.slots.push(_data);
	      }
	      var constraints = skeletonData.constraints;
	      var constraintCount = input.readInt(true);
	      for (var _i3 = 0; _i3 < constraintCount; _i3++) {
	        var _name = input.readString();
	        if (!_name) throw new Error("Constraint data name must not be null.");
	        var nn = void 0;
	        switch (input.readByte()) {
	          case CONSTRAINT_IK:
	            {
	              var _data2 = new IkConstraintData(_name);
	              nn = input.readInt(true);
	              for (var ii = 0; ii < nn; ii++) _data2.bones.push(bones[input.readInt(true)]);
	              _data2.target = bones[input.readInt(true)];
	              var flags = input.readByte();
	              _data2.skinRequired = (flags & 1) !== 0;
	              if ((flags & 2) !== 0) _data2.scaleYMode = input.readUnsignedByte();
	              var _setup = _data2.setupPose;
	              _setup.bendDirection = (flags & 4) !== 0 ? -1 : 1;
	              _setup.compress = (flags & 8) !== 0;
	              _setup.stretch = (flags & 16) !== 0;
	              if ((flags & 32) !== 0) _setup.mix = (flags & 64) !== 0 ? input.readFloat() : 1;
	              if ((flags & 128) !== 0) _setup.softness = input.readFloat() * scale;
	              constraints.push(_data2);
	              break;
	            }
	          case CONSTRAINT_TRANSFORM:
	            {
	              var _data3 = new TransformConstraintData(_name);
	              nn = input.readInt(true);
	              for (var _ii = 0; _ii < nn; _ii++) _data3.bones.push(bones[input.readInt(true)]);
	              _data3.source = bones[input.readInt(true)];
	              var _flags = input.readUnsignedByte();
	              _data3.skinRequired = (_flags & 1) !== 0;
	              _data3.localSource = (_flags & 2) !== 0;
	              _data3.localTarget = (_flags & 4) !== 0;
	              _data3.additive = (_flags & 8) !== 0;
	              _data3.clamp = (_flags & 16) !== 0;
	              nn = _flags >> 5;
	              for (var _ii2 = 0, tn; _ii2 < nn; _ii2++) {
	                var fromScale = 1;
	                var from = void 0;
	                switch (input.readByte()) {
	                  case 0:
	                    from = new FromRotate();
	                    break;
	                  case 1:
	                    {
	                      fromScale = scale;
	                      from = new FromX();
	                      break;
	                    }
	                  case 2:
	                    {
	                      fromScale = scale;
	                      from = new FromY();
	                      break;
	                    }
	                  case 3:
	                    from = new FromScaleX();
	                    break;
	                  case 4:
	                    from = new FromScaleY();
	                    break;
	                  case 5:
	                    from = new FromShearY();
	                    break;
	                  default:
	                    from = null;
	                }
	                if (!from) continue;
	                from.offset = input.readFloat() * fromScale;
	                tn = input.readByte();
	                for (var t = 0; t < tn; t++) {
	                  var toScale = 1;
	                  var to = void 0;
	                  switch (input.readByte()) {
	                    case 0:
	                      to = new ToRotate();
	                      break;
	                    case 1:
	                      {
	                        toScale = scale;
	                        to = new ToX();
	                        break;
	                      }
	                    case 2:
	                      {
	                        toScale = scale;
	                        to = new ToY();
	                        break;
	                      }
	                    case 3:
	                      to = new ToScaleX();
	                      break;
	                    case 4:
	                      to = new ToScaleY();
	                      break;
	                    case 5:
	                      to = new ToShearY();
	                      break;
	                    default:
	                      to = null;
	                  }
	                  if (!to) continue;
	                  to.offset = input.readFloat() * toScale;
	                  to.max = input.readFloat() * toScale;
	                  to.scale = input.readFloat() * toScale / fromScale;
	                  from.to[t] = to;
	                }
	                _data3.properties[_ii2] = from;
	              }
	              _flags = input.readByte();
	              if ((_flags & 1) !== 0) _data3.offsets[TransformConstraintData.ROTATION] = input.readFloat();
	              if ((_flags & 2) !== 0) _data3.offsets[TransformConstraintData.X] = input.readFloat() * scale;
	              if ((_flags & 4) !== 0) _data3.offsets[TransformConstraintData.Y] = input.readFloat() * scale;
	              if ((_flags & 8) !== 0) _data3.offsets[TransformConstraintData.SCALEX] = input.readFloat();
	              if ((_flags & 16) !== 0) _data3.offsets[TransformConstraintData.SCALEY] = input.readFloat();
	              if ((_flags & 32) !== 0) _data3.offsets[TransformConstraintData.SHEARY] = input.readFloat();
	              _flags = input.readByte();
	              var _setup2 = _data3.setupPose;
	              if ((_flags & 1) !== 0) _setup2.mixRotate = input.readFloat();
	              if ((_flags & 2) !== 0) _setup2.mixX = input.readFloat();
	              if ((_flags & 4) !== 0) _setup2.mixY = input.readFloat();
	              if ((_flags & 8) !== 0) _setup2.mixScaleX = input.readFloat();
	              if ((_flags & 16) !== 0) _setup2.mixScaleY = input.readFloat();
	              if ((_flags & 32) !== 0) _setup2.mixShearY = input.readFloat();
	              constraints.push(_data3);
	              break;
	            }
	          case CONSTRAINT_PATH:
	            {
	              var _data4 = new PathConstraintData(_name);
	              nn = input.readInt(true);
	              for (var _ii3 = 0; _ii3 < nn; _ii3++) _data4.bones.push(bones[input.readInt(true)]);
	              _data4.slot = skeletonData.slots[input.readInt(true)];
	              var _flags2 = input.readByte();
	              _data4.skinRequired = (_flags2 & 1) !== 0;
	              _data4.positionMode = _flags2 >> 1 & 1;
	              _data4.spacingMode = _flags2 >> 2 & 3;
	              _data4.rotateMode = _flags2 >> 4 & 3;
	              if ((_flags2 & 128) !== 0) _data4.offsetRotation = input.readFloat();
	              var _setup3 = _data4.setupPose;
	              _setup3.position = input.readFloat();
	              if (_data4.positionMode === PositionMode.Fixed) _setup3.position *= scale;
	              _setup3.spacing = input.readFloat();
	              if (_data4.spacingMode === SpacingMode.Length || _data4.spacingMode === SpacingMode.Fixed) _setup3.spacing *= scale;
	              _setup3.mixRotate = input.readFloat();
	              _setup3.mixX = input.readFloat();
	              _setup3.mixY = input.readFloat();
	              constraints.push(_data4);
	              break;
	            }
	          case CONSTRAINT_PHYSICS:
	            {
	              var _data5 = new PhysicsConstraintData(_name);
	              _data5.bone = bones[input.readInt(true)];
	              var _flags3 = input.readByte();
	              _data5.skinRequired = (_flags3 & 1) !== 0;
	              if ((_flags3 & 2) !== 0) _data5.x = input.readFloat();
	              if ((_flags3 & 4) !== 0) _data5.y = input.readFloat();
	              if ((_flags3 & 8) !== 0) _data5.rotate = input.readFloat();
	              if ((_flags3 & 16) !== 0) {
	                var scaleX = input.readFloat();
	                if (scaleX < -2) {
	                  _data5.scaleYMode = ScaleYMode.Volume;
	                  scaleX = -2 - scaleX;
	                } else if (scaleX < 0) {
	                  _data5.scaleYMode = ScaleYMode.Uniform;
	                  scaleX = -1 - scaleX;
	                }
	                _data5.scaleX = scaleX;
	              }
	              if ((_flags3 & 32) !== 0) _data5.shearX = input.readFloat();
	              _data5.limit = ((_flags3 & 64) !== 0 ? input.readFloat() : 5000) * scale;
	              _data5.step = 1 / input.readUnsignedByte();
	              var _setup4 = _data5.setupPose;
	              _setup4.inertia = input.readFloat();
	              _setup4.strength = input.readFloat();
	              _setup4.damping = input.readFloat();
	              _setup4.massInverse = (_flags3 & 128) !== 0 ? input.readFloat() : 1;
	              _setup4.wind = input.readFloat();
	              _setup4.gravity = input.readFloat();
	              _flags3 = input.readByte();
	              if ((_flags3 & 1) !== 0) _data5.inertiaGlobal = true;
	              if ((_flags3 & 2) !== 0) _data5.strengthGlobal = true;
	              if ((_flags3 & 4) !== 0) _data5.dampingGlobal = true;
	              if ((_flags3 & 8) !== 0) _data5.massGlobal = true;
	              if ((_flags3 & 16) !== 0) _data5.windGlobal = true;
	              if ((_flags3 & 32) !== 0) _data5.gravityGlobal = true;
	              if ((_flags3 & 64) !== 0) _data5.mixGlobal = true;
	              _setup4.mix = (_flags3 & 128) !== 0 ? input.readFloat() : 1;
	              constraints.push(_data5);
	              break;
	            }
	          case CONSTRAINT_SLIDER:
	            {
	              var _data6 = new SliderData(_name);
	              var _flags4 = input.readByte();
	              _data6.skinRequired = (_flags4 & 1) !== 0;
	              _data6.loop = (_flags4 & 2) !== 0;
	              _data6.additive = (_flags4 & 4) !== 0;
	              if ((_flags4 & 8) !== 0) {
	                var value = input.readFloat();
	                if (nonessential && (_flags4 & 64) !== 0) _data6.max = value;else _data6.setupPose.time = value;
	              }
	              if ((_flags4 & 16) !== 0) _data6.setupPose.mix = (_flags4 & 32) !== 0 ? input.readFloat() : 1;
	              if ((_flags4 & 64) !== 0) {
	                _data6.local = (_flags4 & 128) !== 0;
	                _data6.bone = bones[input.readInt(true)];
	                var offset = input.readFloat();
	                var propertyScale = 1;
	                switch (input.readByte()) {
	                  case 0:
	                    _data6.property = new FromRotate();
	                    break;
	                  case 1:
	                    {
	                      propertyScale = scale;
	                      _data6.property = new FromX();
	                      break;
	                    }
	                  case 2:
	                    {
	                      propertyScale = scale;
	                      _data6.property = new FromY();
	                      break;
	                    }
	                  case 3:
	                    _data6.property = new FromScaleX();
	                    break;
	                  case 4:
	                    _data6.property = new FromScaleY();
	                    break;
	                  case 5:
	                    _data6.property = new FromShearY();
	                    break;
	                  default:
	                    continue;
	                }
	                _data6.property.offset = offset * propertyScale;
	                _data6.offset = input.readFloat();
	                _data6.scale = input.readFloat() / propertyScale;
	              }
	              constraints.push(_data6);
	              break;
	            }
	        }
	      }
	      var defaultSkin = this.readSkin(input, skeletonData, true, nonessential);
	      if (defaultSkin) {
	        skeletonData.defaultSkin = defaultSkin;
	        skeletonData.skins.push(defaultSkin);
	      }
	      {
	        var _i4 = skeletonData.skins.length;
	        Utils.setArraySize(skeletonData.skins, n = _i4 + input.readInt(true));
	        for (; _i4 < n; _i4++) {
	          var skin = this.readSkin(input, skeletonData, false, nonessential);
	          if (!skin) throw new Error("readSkin() should not have returned null.");
	          skeletonData.skins[_i4] = skin;
	        }
	      }
	      n = this.linkedMeshes.length;
	      for (var _i5 = 0; _i5 < n; _i5++) {
	        var linkedMesh = this.linkedMeshes[_i5];
	        var _skin = skeletonData.skins[linkedMesh.skinIndex];
	        if (!linkedMesh.source) throw new Error("Linked mesh parent must not be null");
	        var source = _skin.getAttachment(linkedMesh.sourceIndex, linkedMesh.source);
	        if (!source) throw new Error("Source mesh not found: ".concat(linkedMesh.source));
	        linkedMesh.mesh.timelineAttachment = linkedMesh.inheritTimelines ? source : linkedMesh.mesh;
	        linkedMesh.mesh.setSourceMesh(source);
	        linkedMesh.mesh.updateSequence();
	      }
	      this.linkedMeshes.length = 0;
	      n = input.readInt(true);
	      for (var _i6 = 0; _i6 < n; _i6++) {
	        var eventName = input.readString();
	        if (!eventName) throw new Error("Event data name must not be null");
	        var _data7 = new EventData(eventName);
	        var _setup5 = _data7.setupPose;
	        _setup5.intValue = input.readInt(false);
	        _setup5.floatValue = input.readFloat();
	        _setup5.stringValue = input.readString();
	        _data7._audioPath = input.readString();
	        if (_data7.audioPath) {
	          _setup5.volume = input.readFloat();
	          _setup5.balance = input.readFloat();
	        }
	        skeletonData.events.push(_data7);
	      }
	      var animations = skeletonData.animations;
	      n = input.readInt(true);
	      for (var _i7 = 0; _i7 < n; _i7++) {
	        var animationName = input.readString();
	        if (!animationName) throw new Error("Animation name must not be null.");
	        animations.push(this.readAnimation(input, animationName, skeletonData, nonessential));
	      }
	      for (var _i8 = 0; _i8 < constraintCount; _i8++) {
	        var constraint = constraints[_i8];
	        if (constraint instanceof SliderData) constraint.animation = animations[input.readInt(true)];
	      }
	      return skeletonData;
	    }
	  }, {
	    key: "readSkin",
	    value: function readSkin(input, skeletonData, defaultSkin, nonessential) {
	      var skin = null;
	      var slotCount = 0;
	      if (defaultSkin) {
	        slotCount = input.readInt(true);
	        if (slotCount === 0) return null;
	        skin = new Skin("default");
	      } else {
	        var skinName = input.readString();
	        if (!skinName) throw new Error("Skin name must not be null.");
	        skin = new Skin(skinName);
	        if (nonessential) Color.rgba8888ToColor(skin.color, input.readInt32());
	        var n = input.readInt(true);
	        var from = skeletonData.bones,
	          to = skin.bones;
	        for (var i = 0; i < n; i++) to[i] = from[input.readInt(true)];
	        n = input.readInt(true);
	        from = skeletonData.constraints;
	        to = skin.constraints;
	        for (var _i9 = 0; _i9 < n; _i9++) to[_i9] = from[input.readInt(true)];
	        slotCount = input.readInt(true);
	      }
	      for (var _i0 = 0; _i0 < slotCount; _i0++) {
	        var slotIndex = input.readInt(true);
	        for (var ii = 0, nn = input.readInt(true); ii < nn; ii++) {
	          var placeholder = input.readStringRef();
	          if (!placeholder) throw new Error("Attachment name must not be null");
	          var attachment = this.readAttachment(input, skeletonData, skin, slotIndex, placeholder, nonessential);
	          if (attachment) skin.setAttachment(slotIndex, placeholder, attachment);
	        }
	      }
	      return skin;
	    }
	  }, {
	    key: "readAttachment",
	    value: function readAttachment(input, skeletonData, skin, slotIndex, placeholder, nonessential) {
	      var scale = this.scale;
	      var flags = input.readByte();
	      var name = (flags & 8) !== 0 ? input.readStringRef() : placeholder;
	      if (!name) throw new Error("Attachment name must not be null");
	      switch (flags & 7) {
	        case AttachmentType.Region:
	          {
	            var path = (flags & 16) !== 0 ? input.readStringRef() : null;
	            var color = (flags & 32) !== 0 ? input.readInt32() : 0xffffffff;
	            var sequence = this.readSequence(input, (flags & 64) !== 0);
	            var rotation = (flags & 128) !== 0 ? input.readFloat() : 0;
	            var x = input.readFloat();
	            var y = input.readFloat();
	            var scaleX = input.readFloat();
	            var scaleY = input.readFloat();
	            var width = input.readFloat();
	            var height = input.readFloat();
	            if (!path) path = name;
	            var region = this.attachmentLoader.newRegionAttachment(skin, placeholder, name, path, sequence);
	            if (!region) return null;
	            region.path = path;
	            region.x = x * scale;
	            region.y = y * scale;
	            region.scaleX = scaleX;
	            region.scaleY = scaleY;
	            region.rotation = rotation;
	            region.width = width * scale;
	            region.height = height * scale;
	            Color.rgba8888ToColor(region.color, color);
	            region.updateSequence();
	            return region;
	          }
	        case AttachmentType.BoundingBox:
	          {
	            var vertices = this.readVertices(input, (flags & 16) !== 0);
	            var _color = nonessential ? input.readInt32() : 0;
	            var box = this.attachmentLoader.newBoundingBoxAttachment(skin, placeholder, name);
	            if (!box) return null;
	            box.worldVerticesLength = vertices.length;
	            box.vertices = vertices.vertices;
	            box.bones = vertices.bones;
	            if (nonessential) Color.rgba8888ToColor(box.color, _color);
	            return box;
	          }
	        case AttachmentType.Mesh:
	          {
	            var _path = (flags & 16) !== 0 ? input.readStringRef() : name;
	            var _color2 = (flags & 32) !== 0 ? input.readInt32() : 0xffffffff;
	            var _sequence = this.readSequence(input, (flags & 64) !== 0);
	            var hullLength = input.readInt(true);
	            var _vertices = this.readVertices(input, (flags & 128) !== 0);
	            var uvs = this.readFloatArray(input, _vertices.length, 1);
	            var triangles = this.readShortArray(input, (_vertices.length - hullLength - 2) * 3);
	            var slotCount = input.readInt(true);
	            var timelineSlots = null;
	            if (slotCount > 0) {
	              timelineSlots = [];
	              for (var i = 0; i < slotCount; i++) timelineSlots[i] = input.readInt(true);
	            }
	            var edges = [];
	            var _width = 0,
	              _height = 0;
	            if (nonessential) {
	              edges = this.readShortArray(input, input.readInt(true));
	              _width = input.readFloat();
	              _height = input.readFloat();
	            }
	            if (!_path) _path = name;
	            var mesh = this.attachmentLoader.newMeshAttachment(skin, placeholder, name, _path, _sequence);
	            if (!mesh) return null;
	            mesh.path = _path;
	            Color.rgba8888ToColor(mesh.color, _color2);
	            mesh.hullLength = hullLength << 1;
	            mesh.bones = _vertices.bones;
	            mesh.vertices = _vertices.vertices;
	            mesh.worldVerticesLength = _vertices.length;
	            mesh.regionUVs = uvs;
	            mesh.triangles = triangles;
	            if (timelineSlots) mesh.timelineSlots = timelineSlots;
	            if (nonessential) {
	              mesh.edges = edges;
	              mesh.width = _width * scale;
	              mesh.height = _height * scale;
	            }
	            mesh.updateSequence();
	            return mesh;
	          }
	        case AttachmentType.LinkedMesh:
	          {
	            var _path2 = (flags & 16) !== 0 ? input.readStringRef() : name;
	            if (_path2 == null) throw new Error("Path of linked mesh must not be null");
	            var _color3 = (flags & 32) !== 0 ? input.readInt32() : 0xffffffff;
	            var _sequence2 = this.readSequence(input, (flags & 64) !== 0);
	            var inheritTimelines = (flags & 128) !== 0;
	            var sourceIndex = input.readInt(true);
	            var skinIndex = input.readInt(true);
	            var source = input.readStringRef();
	            var _width2 = 0,
	              _height2 = 0;
	            if (nonessential) {
	              _width2 = input.readFloat();
	              _height2 = input.readFloat();
	            }
	            var _mesh = this.attachmentLoader.newMeshAttachment(skin, placeholder, name, _path2, _sequence2);
	            if (!_mesh) return null;
	            _mesh.path = _path2;
	            Color.rgba8888ToColor(_mesh.color, _color3);
	            if (nonessential) {
	              _mesh.width = _width2 * scale;
	              _mesh.height = _height2 * scale;
	            }
	            this.linkedMeshes.push(new LinkedMesh$1(_mesh, skinIndex, slotIndex, sourceIndex, source, inheritTimelines));
	            return _mesh;
	          }
	        case AttachmentType.Path:
	          {
	            var closed = (flags & 16) !== 0;
	            var constantSpeed = (flags & 32) !== 0;
	            var _vertices2 = this.readVertices(input, (flags & 64) !== 0);
	            var lengths = this.readFloatArray(input, _vertices2.length / 6, scale);
	            var _color4 = nonessential ? input.readInt32() : 0;
	            var _path3 = this.attachmentLoader.newPathAttachment(skin, placeholder, name);
	            if (!_path3) return null;
	            _path3.closed = closed;
	            _path3.constantSpeed = constantSpeed;
	            _path3.worldVerticesLength = _vertices2.length;
	            _path3.vertices = _vertices2.vertices;
	            _path3.bones = _vertices2.bones;
	            _path3.lengths = lengths;
	            if (nonessential) Color.rgba8888ToColor(_path3.color, _color4);
	            return _path3;
	          }
	        case AttachmentType.Point:
	          {
	            var _rotation = input.readFloat();
	            var _x = input.readFloat();
	            var _y = input.readFloat();
	            var _color5 = nonessential ? input.readInt32() : 0;
	            var point = this.attachmentLoader.newPointAttachment(skin, placeholder, name);
	            if (!point) return null;
	            point.x = _x * scale;
	            point.y = _y * scale;
	            point.rotation = _rotation;
	            if (nonessential) Color.rgba8888ToColor(point.color, _color5);
	            return point;
	          }
	        case AttachmentType.Clipping:
	          {
	            var endSlotIndex = input.readInt(true);
	            var _vertices3 = this.readVertices(input, (flags & 16) !== 0);
	            var _color6 = nonessential ? input.readInt32() : 0;
	            var clip = this.attachmentLoader.newClippingAttachment(skin, placeholder, name);
	            if (!clip) return null;
	            clip.endSlot = skeletonData.slots[endSlotIndex];
	            clip.convex = (flags & 32) !== 0;
	            clip.inverse = (flags & 64) !== 0;
	            clip.worldVerticesLength = _vertices3.length;
	            clip.vertices = _vertices3.vertices;
	            clip.bones = _vertices3.bones;
	            if (nonessential) Color.rgba8888ToColor(clip.color, _color6);
	            return clip;
	          }
	      }
	    }
	  }, {
	    key: "readSequence",
	    value: function readSequence(input, hasPathSuffix) {
	      if (!hasPathSuffix) return new Sequence(1, false);
	      var sequence = new Sequence(input.readInt(true), true);
	      sequence.start = input.readInt(true);
	      sequence.digits = input.readInt(true);
	      sequence.setupIndex = input.readInt(true);
	      return sequence;
	    }
	  }, {
	    key: "readVertices",
	    value: function readVertices(input, weighted) {
	      var scale = this.scale;
	      var vertexCount = input.readInt(true);
	      var length = vertexCount << 1;
	      if (!weighted) return new Vertices(null, this.readFloatArray(input, length, scale), length);
	      var n = input.readInt(true);
	      var bones = [];
	      var weights = [];
	      for (var b = 0, w = 0; b < n;) {
	        var boneCount = input.readInt(true);
	        bones[b++] = boneCount;
	        for (var ii = 0; ii < boneCount; ii++, w += 3) {
	          bones[b++] = input.readInt(true);
	          weights[w] = input.readFloat() * scale;
	          weights[w + 1] = input.readFloat() * scale;
	          weights[w + 2] = input.readFloat();
	        }
	      }
	      return new Vertices(bones, Utils.toFloatArray(weights), length);
	    }
	  }, {
	    key: "readFloatArray",
	    value: function readFloatArray(input, n, scale) {
	      var array = [];
	      if (scale === 1) {
	        for (var i = 0; i < n; i++) array[i] = input.readFloat();
	      } else {
	        for (var _i1 = 0; _i1 < n; _i1++) array[_i1] = input.readFloat() * scale;
	      }
	      return array;
	    }
	  }, {
	    key: "readShortArray",
	    value: function readShortArray(input, n) {
	      var array = [];
	      for (var i = 0; i < n; i++) array[i] = input.readInt(true);
	      return array;
	    }
	  }, {
	    key: "readAnimation",
	    value: function readAnimation(input, name, skeletonData, nonessential) {
	      input.readInt(true);
	      var timelines = [];
	      var scale = this.scale;
	      for (var i = 0, n = input.readInt(true); i < n; i++) {
	        var slotIndex = input.readInt(true);
	        for (var ii = 0, nn = input.readInt(true); ii < nn; ii++) {
	          var timelineType = input.readByte();
	          var frameCount = input.readInt(true);
	          var frameLast = frameCount - 1;
	          switch (timelineType) {
	            case SLOT_ATTACHMENT:
	              {
	                var timeline = new AttachmentTimeline(frameCount, slotIndex);
	                for (var frame = 0; frame < frameCount; frame++) timeline.setFrame(frame, input.readFloat(), input.readStringRef());
	                timelines.push(timeline);
	                break;
	              }
	            case SLOT_RGBA:
	              {
	                var bezierCount = input.readInt(true);
	                var _timeline = new RGBATimeline(frameCount, bezierCount, slotIndex);
	                var time = input.readFloat();
	                var r = input.readUnsignedByte() / 255.0;
	                var g = input.readUnsignedByte() / 255.0;
	                var b = input.readUnsignedByte() / 255.0;
	                var a = input.readUnsignedByte() / 255.0;
	                for (var _frame = 0, bezier = 0;; _frame++) {
	                  _timeline.setFrame(_frame, time, r, g, b, a);
	                  if (_frame === frameLast) break;
	                  var time2 = input.readFloat();
	                  var r2 = input.readUnsignedByte() / 255.0;
	                  var g2 = input.readUnsignedByte() / 255.0;
	                  var b2 = input.readUnsignedByte() / 255.0;
	                  var a2 = input.readUnsignedByte() / 255.0;
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline.setStepped(_frame);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline, bezier++, _frame, 0, time, time2, r, r2, 1);
	                      setBezier(input, _timeline, bezier++, _frame, 1, time, time2, g, g2, 1);
	                      setBezier(input, _timeline, bezier++, _frame, 2, time, time2, b, b2, 1);
	                      setBezier(input, _timeline, bezier++, _frame, 3, time, time2, a, a2, 1);
	                  }
	                  time = time2;
	                  r = r2;
	                  g = g2;
	                  b = b2;
	                  a = a2;
	                }
	                timelines.push(_timeline);
	                break;
	              }
	            case SLOT_RGB:
	              {
	                var _bezierCount = input.readInt(true);
	                var _timeline2 = new RGBTimeline(frameCount, _bezierCount, slotIndex);
	                var _time = input.readFloat();
	                var _r = input.readUnsignedByte() / 255.0;
	                var _g = input.readUnsignedByte() / 255.0;
	                var _b = input.readUnsignedByte() / 255.0;
	                for (var _frame2 = 0, _bezier = 0;; _frame2++) {
	                  _timeline2.setFrame(_frame2, _time, _r, _g, _b);
	                  if (_frame2 === frameLast) break;
	                  var _time2 = input.readFloat();
	                  var _r2 = input.readUnsignedByte() / 255.0;
	                  var _g2 = input.readUnsignedByte() / 255.0;
	                  var _b2 = input.readUnsignedByte() / 255.0;
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline2.setStepped(_frame2);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline2, _bezier++, _frame2, 0, _time, _time2, _r, _r2, 1);
	                      setBezier(input, _timeline2, _bezier++, _frame2, 1, _time, _time2, _g, _g2, 1);
	                      setBezier(input, _timeline2, _bezier++, _frame2, 2, _time, _time2, _b, _b2, 1);
	                  }
	                  _time = _time2;
	                  _r = _r2;
	                  _g = _g2;
	                  _b = _b2;
	                }
	                timelines.push(_timeline2);
	                break;
	              }
	            case SLOT_RGBA2:
	              {
	                var _bezierCount2 = input.readInt(true);
	                var _timeline3 = new RGBA2Timeline(frameCount, _bezierCount2, slotIndex);
	                var _time3 = input.readFloat();
	                var _r3 = input.readUnsignedByte() / 255.0;
	                var _g3 = input.readUnsignedByte() / 255.0;
	                var _b3 = input.readUnsignedByte() / 255.0;
	                var _a = input.readUnsignedByte() / 255.0;
	                var _r4 = input.readUnsignedByte() / 255.0;
	                var _g4 = input.readUnsignedByte() / 255.0;
	                var _b4 = input.readUnsignedByte() / 255.0;
	                for (var _frame3 = 0, _bezier2 = 0;; _frame3++) {
	                  _timeline3.setFrame(_frame3, _time3, _r3, _g3, _b3, _a, _r4, _g4, _b4);
	                  if (_frame3 === frameLast) break;
	                  var _time4 = input.readFloat();
	                  var nr = input.readUnsignedByte() / 255.0;
	                  var ng = input.readUnsignedByte() / 255.0;
	                  var nb = input.readUnsignedByte() / 255.0;
	                  var na = input.readUnsignedByte() / 255.0;
	                  var nr2 = input.readUnsignedByte() / 255.0;
	                  var ng2 = input.readUnsignedByte() / 255.0;
	                  var nb2 = input.readUnsignedByte() / 255.0;
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline3.setStepped(_frame3);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 0, _time3, _time4, _r3, nr, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 1, _time3, _time4, _g3, ng, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 2, _time3, _time4, _b3, nb, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 3, _time3, _time4, _a, na, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 4, _time3, _time4, _r4, nr2, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 5, _time3, _time4, _g4, ng2, 1);
	                      setBezier(input, _timeline3, _bezier2++, _frame3, 6, _time3, _time4, _b4, nb2, 1);
	                  }
	                  _time3 = _time4;
	                  _r3 = nr;
	                  _g3 = ng;
	                  _b3 = nb;
	                  _a = na;
	                  _r4 = nr2;
	                  _g4 = ng2;
	                  _b4 = nb2;
	                }
	                timelines.push(_timeline3);
	                break;
	              }
	            case SLOT_RGB2:
	              {
	                var _bezierCount3 = input.readInt(true);
	                var _timeline4 = new RGB2Timeline(frameCount, _bezierCount3, slotIndex);
	                var _time5 = input.readFloat();
	                var _r5 = input.readUnsignedByte() / 255.0;
	                var _g5 = input.readUnsignedByte() / 255.0;
	                var _b5 = input.readUnsignedByte() / 255.0;
	                var _r6 = input.readUnsignedByte() / 255.0;
	                var _g6 = input.readUnsignedByte() / 255.0;
	                var _b6 = input.readUnsignedByte() / 255.0;
	                for (var _frame4 = 0, _bezier3 = 0;; _frame4++) {
	                  _timeline4.setFrame(_frame4, _time5, _r5, _g5, _b5, _r6, _g6, _b6);
	                  if (_frame4 === frameLast) break;
	                  var _time6 = input.readFloat();
	                  var _nr = input.readUnsignedByte() / 255.0;
	                  var _ng = input.readUnsignedByte() / 255.0;
	                  var _nb = input.readUnsignedByte() / 255.0;
	                  var _nr2 = input.readUnsignedByte() / 255.0;
	                  var _ng2 = input.readUnsignedByte() / 255.0;
	                  var _nb2 = input.readUnsignedByte() / 255.0;
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline4.setStepped(_frame4);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 0, _time5, _time6, _r5, _nr, 1);
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 1, _time5, _time6, _g5, _ng, 1);
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 2, _time5, _time6, _b5, _nb, 1);
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 3, _time5, _time6, _r6, _nr2, 1);
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 4, _time5, _time6, _g6, _ng2, 1);
	                      setBezier(input, _timeline4, _bezier3++, _frame4, 5, _time5, _time6, _b6, _nb2, 1);
	                  }
	                  _time5 = _time6;
	                  _r5 = _nr;
	                  _g5 = _ng;
	                  _b5 = _nb;
	                  _r6 = _nr2;
	                  _g6 = _ng2;
	                  _b6 = _nb2;
	                }
	                timelines.push(_timeline4);
	                break;
	              }
	            case SLOT_ALPHA:
	              {
	                var _timeline5 = new AlphaTimeline(frameCount, input.readInt(true), slotIndex);
	                var _time7 = input.readFloat(),
	                  _a2 = input.readUnsignedByte() / 255;
	                for (var _frame5 = 0, _bezier4 = 0;; _frame5++) {
	                  _timeline5.setFrame(_frame5, _time7, _a2);
	                  if (_frame5 === frameLast) break;
	                  var _time8 = input.readFloat();
	                  var _a3 = input.readUnsignedByte() / 255;
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline5.setStepped(_frame5);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline5, _bezier4++, _frame5, 0, _time7, _time8, _a2, _a3, 1);
	                  }
	                  _time7 = _time8;
	                  _a2 = _a3;
	                }
	                timelines.push(_timeline5);
	              }
	          }
	        }
	      }
	      for (var _i10 = 0, _n = input.readInt(true); _i10 < _n; _i10++) {
	        var boneIndex = input.readInt(true);
	        for (var _ii4 = 0, _nn = input.readInt(true); _ii4 < _nn; _ii4++) {
	          var type = input.readByte(),
	            _frameCount = input.readInt(true);
	          if (type === BONE_INHERIT) {
	            var _timeline6 = new InheritTimeline(_frameCount, boneIndex);
	            for (var _frame6 = 0; _frame6 < _frameCount; _frame6++) {
	              _timeline6.setFrame(_frame6, input.readFloat(), input.readByte());
	            }
	            timelines.push(_timeline6);
	            continue;
	          }
	          var _bezierCount4 = input.readInt(true);
	          switch (type) {
	            case BONE_ROTATE:
	              readTimeline(input, timelines, new RotateTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_TRANSLATE:
	              readTimeline(input, timelines, new TranslateTimeline(_frameCount, _bezierCount4, boneIndex), scale);
	              break;
	            case BONE_TRANSLATEX:
	              readTimeline(input, timelines, new TranslateXTimeline(_frameCount, _bezierCount4, boneIndex), scale);
	              break;
	            case BONE_TRANSLATEY:
	              readTimeline(input, timelines, new TranslateYTimeline(_frameCount, _bezierCount4, boneIndex), scale);
	              break;
	            case BONE_SCALE:
	              readTimeline(input, timelines, new ScaleTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_SCALEX:
	              readTimeline(input, timelines, new ScaleXTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_SCALEY:
	              readTimeline(input, timelines, new ScaleYTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_SHEAR:
	              readTimeline(input, timelines, new ShearTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_SHEARX:
	              readTimeline(input, timelines, new ShearXTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	            case BONE_SHEARY:
	              readTimeline(input, timelines, new ShearYTimeline(_frameCount, _bezierCount4, boneIndex), 1);
	              break;
	          }
	        }
	      }
	      for (var _i11 = 0, _n2 = input.readInt(true); _i11 < _n2; _i11++) {
	        var index = input.readInt(true),
	          _frameCount2 = input.readInt(true),
	          _frameLast = _frameCount2 - 1;
	        var _timeline7 = new IkConstraintTimeline(_frameCount2, input.readInt(true), index);
	        var flags = input.readByte();
	        var _time9 = input.readFloat(),
	          mix = (flags & 1) !== 0 ? (flags & 2) !== 0 ? input.readFloat() : 1 : 0;
	        var softness = (flags & 4) !== 0 ? input.readFloat() * scale : 0;
	        for (var _frame7 = 0, _bezier5 = 0;; _frame7++) {
	          _timeline7.setFrame(_frame7, _time9, mix, softness, (flags & 8) !== 0 ? 1 : -1, (flags & 16) !== 0, (flags & 32) !== 0);
	          if (_frame7 === _frameLast) break;
	          flags = input.readByte();
	          var _time0 = input.readFloat(),
	            mix2 = (flags & 1) !== 0 ? (flags & 2) !== 0 ? input.readFloat() : 1 : 0;
	          var softness2 = (flags & 4) !== 0 ? input.readFloat() * scale : 0;
	          if ((flags & 64) !== 0) {
	            _timeline7.setStepped(_frame7);
	          } else if ((flags & 128) !== 0) {
	            setBezier(input, _timeline7, _bezier5++, _frame7, 0, _time9, _time0, mix, mix2, 1);
	            setBezier(input, _timeline7, _bezier5++, _frame7, 1, _time9, _time0, softness, softness2, scale);
	          }
	          _time9 = _time0;
	          mix = mix2;
	          softness = softness2;
	        }
	        timelines.push(_timeline7);
	      }
	      for (var _i12 = 0, _n3 = input.readInt(true); _i12 < _n3; _i12++) {
	        var _index = input.readInt(true),
	          _frameCount3 = input.readInt(true),
	          _frameLast2 = _frameCount3 - 1;
	        var _timeline8 = new TransformConstraintTimeline(_frameCount3, input.readInt(true), _index);
	        var _time1 = input.readFloat(),
	          mixRotate = input.readFloat(),
	          mixX = input.readFloat(),
	          mixY = input.readFloat(),
	          mixScaleX = input.readFloat(),
	          mixScaleY = input.readFloat(),
	          mixShearY = input.readFloat();
	        for (var _frame8 = 0, _bezier6 = 0;; _frame8++) {
	          _timeline8.setFrame(_frame8, _time1, mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY);
	          if (_frame8 === _frameLast2) break;
	          var _time10 = input.readFloat(),
	            mixRotate2 = input.readFloat(),
	            mixX2 = input.readFloat(),
	            mixY2 = input.readFloat(),
	            mixScaleX2 = input.readFloat(),
	            mixScaleY2 = input.readFloat(),
	            mixShearY2 = input.readFloat();
	          switch (input.readByte()) {
	            case CURVE_STEPPED:
	              _timeline8.setStepped(_frame8);
	              break;
	            case CURVE_BEZIER:
	              setBezier(input, _timeline8, _bezier6++, _frame8, 0, _time1, _time10, mixRotate, mixRotate2, 1);
	              setBezier(input, _timeline8, _bezier6++, _frame8, 1, _time1, _time10, mixX, mixX2, 1);
	              setBezier(input, _timeline8, _bezier6++, _frame8, 2, _time1, _time10, mixY, mixY2, 1);
	              setBezier(input, _timeline8, _bezier6++, _frame8, 3, _time1, _time10, mixScaleX, mixScaleX2, 1);
	              setBezier(input, _timeline8, _bezier6++, _frame8, 4, _time1, _time10, mixScaleY, mixScaleY2, 1);
	              setBezier(input, _timeline8, _bezier6++, _frame8, 5, _time1, _time10, mixShearY, mixShearY2, 1);
	          }
	          _time1 = _time10;
	          mixRotate = mixRotate2;
	          mixX = mixX2;
	          mixY = mixY2;
	          mixScaleX = mixScaleX2;
	          mixScaleY = mixScaleY2;
	          mixShearY = mixShearY2;
	        }
	        timelines.push(_timeline8);
	      }
	      for (var _i13 = 0, _n4 = input.readInt(true); _i13 < _n4; _i13++) {
	        var _index2 = input.readInt(true);
	        var data = skeletonData.constraints[_index2];
	        for (var _ii5 = 0, _nn2 = input.readInt(true); _ii5 < _nn2; _ii5++) {
	          var _type = input.readByte(),
	            _frameCount4 = input.readInt(true),
	            _bezierCount5 = input.readInt(true);
	          switch (_type) {
	            case PATH_POSITION:
	              readTimeline(input, timelines, new PathConstraintPositionTimeline(_frameCount4, _bezierCount5, _index2), data.positionMode === PositionMode.Fixed ? scale : 1);
	              break;
	            case PATH_SPACING:
	              readTimeline(input, timelines, new PathConstraintSpacingTimeline(_frameCount4, _bezierCount5, _index2), data.spacingMode === SpacingMode.Length || data.spacingMode === SpacingMode.Fixed ? scale : 1);
	              break;
	            case PATH_MIX:
	              {
	                var _timeline9 = new PathConstraintMixTimeline(_frameCount4, _bezierCount5, _index2);
	                var _time11 = input.readFloat(),
	                  _mixRotate = input.readFloat(),
	                  _mixX = input.readFloat(),
	                  _mixY = input.readFloat();
	                for (var _frame9 = 0, _bezier7 = 0, _frameLast3 = _timeline9.getFrameCount() - 1;; _frame9++) {
	                  _timeline9.setFrame(_frame9, _time11, _mixRotate, _mixX, _mixY);
	                  if (_frame9 === _frameLast3) break;
	                  var _time12 = input.readFloat(),
	                    _mixRotate2 = input.readFloat(),
	                    _mixX2 = input.readFloat(),
	                    _mixY2 = input.readFloat();
	                  switch (input.readByte()) {
	                    case CURVE_STEPPED:
	                      _timeline9.setStepped(_frame9);
	                      break;
	                    case CURVE_BEZIER:
	                      setBezier(input, _timeline9, _bezier7++, _frame9, 0, _time11, _time12, _mixRotate, _mixRotate2, 1);
	                      setBezier(input, _timeline9, _bezier7++, _frame9, 1, _time11, _time12, _mixX, _mixX2, 1);
	                      setBezier(input, _timeline9, _bezier7++, _frame9, 2, _time11, _time12, _mixY, _mixY2, 1);
	                  }
	                  _time11 = _time12;
	                  _mixRotate = _mixRotate2;
	                  _mixX = _mixX2;
	                  _mixY = _mixY2;
	                }
	                timelines.push(_timeline9);
	              }
	          }
	        }
	      }
	      for (var _i14 = 0, _n5 = input.readInt(true); _i14 < _n5; _i14++) {
	        var _index3 = input.readInt(true) - 1;
	        for (var _ii6 = 0, _nn3 = input.readInt(true); _ii6 < _nn3; _ii6++) {
	          var _type2 = input.readByte(),
	            _frameCount5 = input.readInt(true);
	          if (_type2 === PHYSICS_RESET) {
	            var _timeline0 = new PhysicsConstraintResetTimeline(_frameCount5, _index3);
	            for (var _frame0 = 0; _frame0 < _frameCount5; _frame0++) _timeline0.setFrame(_frame0, input.readFloat());
	            timelines.push(_timeline0);
	            continue;
	          }
	          var _bezierCount6 = input.readInt(true);
	          switch (_type2) {
	            case PHYSICS_INERTIA:
	              readTimeline(input, timelines, new PhysicsConstraintInertiaTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_STRENGTH:
	              readTimeline(input, timelines, new PhysicsConstraintStrengthTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_DAMPING:
	              readTimeline(input, timelines, new PhysicsConstraintDampingTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_MASS:
	              readTimeline(input, timelines, new PhysicsConstraintMassTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_WIND:
	              readTimeline(input, timelines, new PhysicsConstraintWindTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_GRAVITY:
	              readTimeline(input, timelines, new PhysicsConstraintGravityTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            case PHYSICS_MIX:
	              readTimeline(input, timelines, new PhysicsConstraintMixTimeline(_frameCount5, _bezierCount6, _index3), 1);
	              break;
	            default:
	              throw new Error("Unknown physics timeline type.");
	          }
	        }
	      }
	      for (var _i15 = 0, _n6 = input.readInt(true); _i15 < _n6; _i15++) {
	        var _index4 = input.readInt(true);
	        for (var _ii7 = 0, _nn4 = input.readInt(true); _ii7 < _nn4; _ii7++) {
	          var _type3 = input.readByte(),
	            _frameCount6 = input.readInt(true),
	            _bezierCount7 = input.readInt(true);
	          switch (_type3) {
	            case SLIDER_TIME:
	              readTimeline(input, timelines, new SliderTimeline(_frameCount6, _bezierCount7, _index4), 1);
	              break;
	            case SLIDER_MIX:
	              readTimeline(input, timelines, new SliderMixTimeline(_frameCount6, _bezierCount7, _index4), 1);
	              break;
	            default:
	              throw new Error("Uknown slider type: ".concat(_type3));
	          }
	        }
	      }
	      for (var _i16 = 0, _n7 = input.readInt(true); _i16 < _n7; _i16++) {
	        var skin = skeletonData.skins[input.readInt(true)];
	        for (var _ii8 = 0, _nn5 = input.readInt(true); _ii8 < _nn5; _ii8++) {
	          var _slotIndex = input.readInt(true);
	          for (var iii = 0, nnn = input.readInt(true); iii < nnn; iii++) {
	            var attachmentName = input.readStringRef();
	            if (!attachmentName) throw new Error("attachmentName must not be null.");
	            var attachment = skin.getAttachment(_slotIndex, attachmentName);
	            var _timelineType = input.readByte();
	            var _frameCount7 = input.readInt(true);
	            var _frameLast4 = _frameCount7 - 1;
	            switch (_timelineType) {
	              case ATTACHMENT_DEFORM:
	                {
	                  var vertexAttachment = attachment;
	                  var weighted = vertexAttachment.bones;
	                  var vertices = vertexAttachment.vertices;
	                  var deformLength = weighted ? vertices.length / 3 * 2 : vertices.length;
	                  var _bezierCount8 = input.readInt(true);
	                  var _timeline1 = new DeformTimeline(_frameCount7, _bezierCount8, _slotIndex, vertexAttachment);
	                  var _time13 = input.readFloat();
	                  for (var _frame1 = 0, _bezier8 = 0;; _frame1++) {
	                    var deform = void 0;
	                    var end = input.readInt(true);
	                    if (end === 0) deform = weighted ? Utils.newFloatArray(deformLength) : vertices;else {
	                      deform = Utils.newFloatArray(deformLength);
	                      var start = input.readInt(true);
	                      end += start;
	                      if (scale === 1) {
	                        for (var v = start; v < end; v++) deform[v] = input.readFloat();
	                      } else {
	                        for (var _v = start; _v < end; _v++) deform[_v] = input.readFloat() * scale;
	                      }
	                      if (!weighted) {
	                        for (var _v2 = 0, vn = deform.length; _v2 < vn; _v2++) deform[_v2] += vertices[_v2];
	                      }
	                    }
	                    _timeline1.setFrame(_frame1, _time13, deform);
	                    if (_frame1 === _frameLast4) break;
	                    var _time14 = input.readFloat();
	                    switch (input.readByte()) {
	                      case CURVE_STEPPED:
	                        _timeline1.setStepped(_frame1);
	                        break;
	                      case CURVE_BEZIER:
	                        setBezier(input, _timeline1, _bezier8++, _frame1, 0, _time13, _time14, 0, 1, 1);
	                    }
	                    _time13 = _time14;
	                  }
	                  timelines.push(_timeline1);
	                  break;
	                }
	              case ATTACHMENT_SEQUENCE:
	                {
	                  var _timeline10 = new SequenceTimeline(_frameCount7, _slotIndex, attachment);
	                  for (var _frame10 = 0; _frame10 < _frameCount7; _frame10++) {
	                    var _time15 = input.readFloat();
	                    var modeAndIndex = input.readInt32();
	                    _timeline10.setFrame(_frame10, _time15, SequenceModeValues[modeAndIndex & 0xf], modeAndIndex >> 4, input.readFloat());
	                  }
	                  timelines.push(_timeline10);
	                  break;
	                }
	            }
	          }
	        }
	      }
	      var slotCount = skeletonData.slots.length;
	      var drawOrderCount = input.readInt(true);
	      if (drawOrderCount > 0) {
	        var _timeline11 = new DrawOrderTimeline(drawOrderCount);
	        for (var _i17 = 0; _i17 < drawOrderCount; _i17++) _timeline11.setFrame(_i17, input.readFloat(), readDrawOrder$1(input, slotCount));
	        timelines.push(_timeline11);
	      }
	      var folderCount = input.readInt(true);
	      for (var _i18 = 0; _i18 < folderCount; _i18++) {
	        var folderSlotCount = input.readInt(true);
	        var folderSlots = new Array(folderSlotCount);
	        for (var _ii9 = 0; _ii9 < folderSlotCount; _ii9++) folderSlots[_ii9] = input.readInt(true);
	        var keyCount = input.readInt(true);
	        var _timeline12 = new DrawOrderFolderTimeline(keyCount, folderSlots, slotCount);
	        for (var _ii0 = 0; _ii0 < keyCount; _ii0++) _timeline12.setFrame(_ii0, input.readFloat(), readDrawOrder$1(input, folderSlotCount));
	        timelines.push(_timeline12);
	      }
	      var eventCount = input.readInt(true);
	      if (eventCount > 0) {
	        var _timeline13 = new EventTimeline(eventCount);
	        for (var _i19 = 0; _i19 < eventCount; _i19++) {
	          var _time16 = input.readFloat();
	          var eventData = skeletonData.events[input.readInt(true)];
	          var event = new Event(_time16, eventData);
	          event.intValue = input.readInt(false);
	          event.floatValue = input.readFloat();
	          event.stringValue = input.readString();
	          if (event.stringValue == null) event.stringValue = eventData.setupPose.stringValue;
	          if (event.data.audioPath) {
	            event.volume = input.readFloat();
	            event.balance = input.readFloat();
	          }
	          _timeline13.setFrame(_i19, event);
	        }
	        timelines.push(_timeline13);
	      }
	      var duration = 0;
	      for (var _i20 = 0, _n8 = timelines.length; _i20 < _n8; _i20++) duration = Math.max(duration, timelines[_i20].getDuration());
	      var animation = new Animation(name, timelines, duration);
	      if (nonessential) Color.rgba8888ToColor(animation.color, input.readInt32());
	      return animation;
	    }
	  }]);
	}();
	var BinaryInput = function () {
	  function BinaryInput(data) {
	    var strings = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
	    var index = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	    var buffer = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : new DataView(data instanceof ArrayBuffer ? data : data.buffer);
	    _classCallCheck(this, BinaryInput);
	    _defineProperty(this, "strings", void 0);
	    _defineProperty(this, "index", void 0);
	    _defineProperty(this, "buffer", void 0);
	    this.strings = strings;
	    this.index = index;
	    this.buffer = buffer;
	  }
	  return _createClass(BinaryInput, [{
	    key: "readByte",
	    value: function readByte() {
	      return this.buffer.getInt8(this.index++);
	    }
	  }, {
	    key: "readUnsignedByte",
	    value: function readUnsignedByte() {
	      return this.buffer.getUint8(this.index++);
	    }
	  }, {
	    key: "readShort",
	    value: function readShort() {
	      var value = this.buffer.getInt16(this.index);
	      this.index += 2;
	      return value;
	    }
	  }, {
	    key: "readInt32",
	    value: function readInt32() {
	      var value = this.buffer.getInt32(this.index);
	      this.index += 4;
	      return value;
	    }
	  }, {
	    key: "readInt",
	    value: function readInt(optimizePositive) {
	      var b = this.readByte();
	      var result = b & 0x7F;
	      if ((b & 0x80) !== 0) {
	        b = this.readByte();
	        result |= (b & 0x7F) << 7;
	        if ((b & 0x80) !== 0) {
	          b = this.readByte();
	          result |= (b & 0x7F) << 14;
	          if ((b & 0x80) !== 0) {
	            b = this.readByte();
	            result |= (b & 0x7F) << 21;
	            if ((b & 0x80) !== 0) {
	              b = this.readByte();
	              result |= (b & 0x7F) << 28;
	            }
	          }
	        }
	      }
	      return optimizePositive ? result : result >>> 1 ^ -(result & 1);
	    }
	  }, {
	    key: "readStringRef",
	    value: function readStringRef() {
	      var index = this.readInt(true);
	      return index === 0 ? null : this.strings[index - 1];
	    }
	  }, {
	    key: "readString",
	    value: function readString() {
	      var byteCount = this.readInt(true);
	      switch (byteCount) {
	        case 0:
	          return null;
	        case 1:
	          return "";
	      }
	      byteCount--;
	      var chars = "";
	      for (var i = 0; i < byteCount;) {
	        var b = this.readUnsignedByte();
	        switch (b >> 4) {
	          case 12:
	          case 13:
	            chars += String.fromCharCode((b & 0x1F) << 6 | this.readByte() & 0x3F);
	            i += 2;
	            break;
	          case 14:
	            chars += String.fromCharCode((b & 0x0F) << 12 | (this.readByte() & 0x3F) << 6 | this.readByte() & 0x3F);
	            i += 3;
	            break;
	          default:
	            chars += String.fromCharCode(b);
	            i++;
	        }
	      }
	      return chars;
	    }
	  }, {
	    key: "readFloat",
	    value: function readFloat() {
	      var value = this.buffer.getFloat32(this.index);
	      this.index += 4;
	      return value;
	    }
	  }, {
	    key: "readBoolean",
	    value: function readBoolean() {
	      return this.readByte() !== 0;
	    }
	  }]);
	}();
	var LinkedMesh$1 = _createClass(function LinkedMesh(mesh, skinIndex, slotIndex, sourceIndex, source, inheritTimelines) {
	  _classCallCheck(this, LinkedMesh);
	  _defineProperty(this, "source", void 0);
	  _defineProperty(this, "skinIndex", void 0);
	  _defineProperty(this, "slotIndex", void 0);
	  _defineProperty(this, "sourceIndex", void 0);
	  _defineProperty(this, "mesh", void 0);
	  _defineProperty(this, "inheritTimelines", void 0);
	  this.mesh = mesh;
	  this.skinIndex = skinIndex;
	  this.slotIndex = slotIndex;
	  this.sourceIndex = sourceIndex;
	  this.source = source;
	  this.inheritTimelines = inheritTimelines;
	});
	var Vertices = _createClass(function Vertices() {
	  var bones = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
	  var vertices = arguments.length > 1 ? arguments[1] : undefined;
	  var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	  _classCallCheck(this, Vertices);
	  _defineProperty(this, "bones", void 0);
	  _defineProperty(this, "vertices", void 0);
	  _defineProperty(this, "length", void 0);
	  this.bones = bones;
	  this.vertices = vertices;
	  this.length = length;
	});
	var AttachmentType;
	(function (AttachmentType) {
	  AttachmentType[AttachmentType["Region"] = 0] = "Region";
	  AttachmentType[AttachmentType["BoundingBox"] = 1] = "BoundingBox";
	  AttachmentType[AttachmentType["Mesh"] = 2] = "Mesh";
	  AttachmentType[AttachmentType["LinkedMesh"] = 3] = "LinkedMesh";
	  AttachmentType[AttachmentType["Path"] = 4] = "Path";
	  AttachmentType[AttachmentType["Point"] = 5] = "Point";
	  AttachmentType[AttachmentType["Clipping"] = 6] = "Clipping";
	})(AttachmentType || (AttachmentType = {}));
	function readTimeline(input, timelines, timeline, scale) {
	  if (timeline instanceof CurveTimeline1) readTimeline1$1(input, timelines, timeline, scale);else readTimeline2$1(input, timelines, timeline, scale);
	}
	function readTimeline1$1(input, timelines, timeline, scale) {
	  var time = input.readFloat(),
	    value = input.readFloat() * scale;
	  for (var frame = 0, bezier = 0, frameLast = timeline.getFrameCount() - 1;; frame++) {
	    timeline.setFrame(frame, time, value);
	    if (frame === frameLast) break;
	    var time2 = input.readFloat(),
	      value2 = input.readFloat() * scale;
	    switch (input.readByte()) {
	      case CURVE_STEPPED:
	        timeline.setStepped(frame);
	        break;
	      case CURVE_BEZIER:
	        setBezier(input, timeline, bezier++, frame, 0, time, time2, value, value2, scale);
	    }
	    time = time2;
	    value = value2;
	  }
	  timelines.push(timeline);
	}
	function readTimeline2$1(input, timelines, timeline, scale) {
	  var time = input.readFloat(),
	    value1 = input.readFloat() * scale,
	    value2 = input.readFloat() * scale;
	  for (var frame = 0, bezier = 0, frameLast = timeline.getFrameCount() - 1;; frame++) {
	    timeline.setFrame(frame, time, value1, value2);
	    if (frame === frameLast) break;
	    var time2 = input.readFloat(),
	      nvalue1 = input.readFloat() * scale,
	      nvalue2 = input.readFloat() * scale;
	    switch (input.readByte()) {
	      case CURVE_STEPPED:
	        timeline.setStepped(frame);
	        break;
	      case CURVE_BEZIER:
	        setBezier(input, timeline, bezier++, frame, 0, time, time2, value1, nvalue1, scale);
	        setBezier(input, timeline, bezier++, frame, 1, time, time2, value2, nvalue2, scale);
	    }
	    time = time2;
	    value1 = nvalue1;
	    value2 = nvalue2;
	  }
	  timelines.push(timeline);
	}
	function readDrawOrder$1(input, slotCount) {
	  var changeCount = input.readInt(true);
	  if (changeCount === 0) return null;
	  var drawOrder = new Array(slotCount).fill(-1);
	  var unchanged = new Array(slotCount - changeCount);
	  var originalIndex = 0,
	    unchangedIndex = 0;
	  for (var i = 0; i < changeCount; i++) {
	    var slotIndex = input.readInt(true);
	    while (originalIndex !== slotIndex) unchanged[unchangedIndex++] = originalIndex++;
	    drawOrder[originalIndex + input.readInt(true)] = originalIndex++;
	  }
	  while (originalIndex < slotCount) unchanged[unchangedIndex++] = originalIndex++;
	  for (var _i21 = slotCount - 1; _i21 >= 0; _i21--) if (drawOrder[_i21] === -1) drawOrder[_i21] = unchanged[--unchangedIndex];
	  return drawOrder;
	}
	function setBezier(input, timeline, bezier, frame, value, time1, time2, value1, value2, scale) {
	  timeline.setBezier(bezier, frame, value, time1, value1, input.readFloat(), input.readFloat() * scale, input.readFloat(), input.readFloat() * scale, time2, value2);
	}
	var BONE_ROTATE = 0;
	var BONE_TRANSLATE = 1;
	var BONE_TRANSLATEX = 2;
	var BONE_TRANSLATEY = 3;
	var BONE_SCALE = 4;
	var BONE_SCALEX = 5;
	var BONE_SCALEY = 6;
	var BONE_SHEAR = 7;
	var BONE_SHEARX = 8;
	var BONE_SHEARY = 9;
	var BONE_INHERIT = 10;
	var SLOT_ATTACHMENT = 0;
	var SLOT_RGBA = 1;
	var SLOT_RGB = 2;
	var SLOT_RGBA2 = 3;
	var SLOT_RGB2 = 4;
	var SLOT_ALPHA = 5;
	var CONSTRAINT_IK = 0;
	var CONSTRAINT_PATH = 1;
	var CONSTRAINT_TRANSFORM = 2;
	var CONSTRAINT_PHYSICS = 3;
	var CONSTRAINT_SLIDER = 4;
	var ATTACHMENT_DEFORM = 0;
	var ATTACHMENT_SEQUENCE = 1;
	var PATH_POSITION = 0;
	var PATH_SPACING = 1;
	var PATH_MIX = 2;
	var PHYSICS_INERTIA = 0;
	var PHYSICS_STRENGTH = 1;
	var PHYSICS_DAMPING = 2;
	var PHYSICS_MASS = 4;
	var PHYSICS_WIND = 5;
	var PHYSICS_GRAVITY = 6;
	var PHYSICS_MIX = 7;
	var PHYSICS_RESET = 8;
	var SLIDER_TIME = 0;
	var SLIDER_MIX = 1;
	var CURVE_STEPPED = 1;
	var CURVE_BEZIER = 2;

	var SkeletonBounds = function () {
	  function SkeletonBounds() {
	    _classCallCheck(this, SkeletonBounds);
	    _defineProperty(this, "minX", 0);
	    _defineProperty(this, "minY", 0);
	    _defineProperty(this, "maxX", 0);
	    _defineProperty(this, "maxY", 0);
	    _defineProperty(this, "boundingBoxes", []);
	    _defineProperty(this, "polygons", []);
	    _defineProperty(this, "polygonPool", new Pool(function () {
	      return Utils.newFloatArray(16);
	    }));
	  }
	  return _createClass(SkeletonBounds, [{
	    key: "update",
	    value: function update(skeleton, updateAabb) {
	      if (!skeleton) throw new Error("skeleton cannot be null.");
	      var boundingBoxes = this.boundingBoxes;
	      var polygons = this.polygons;
	      var polygonPool = this.polygonPool;
	      var slots = skeleton.slots;
	      var slotCount = slots.length;
	      boundingBoxes.length = 0;
	      polygonPool.freeAll(polygons);
	      polygons.length = 0;
	      for (var i = 0; i < slotCount; i++) {
	        var slot = slots[i];
	        if (!slot.bone.active) continue;
	        var attachment = slot.appliedPose.attachment;
	        if (attachment instanceof BoundingBoxAttachment) {
	          boundingBoxes.push(attachment);
	          var polygon = polygonPool.obtain();
	          if (polygon.length !== attachment.worldVerticesLength) {
	            polygon = Utils.newFloatArray(attachment.worldVerticesLength);
	          }
	          polygons.push(polygon);
	          attachment.computeWorldVertices(skeleton, slot, 0, attachment.worldVerticesLength, polygon, 0, 2);
	        }
	      }
	      if (updateAabb) {
	        this.aabbCompute();
	      } else {
	        this.minX = Number.POSITIVE_INFINITY;
	        this.minY = Number.POSITIVE_INFINITY;
	        this.maxX = Number.NEGATIVE_INFINITY;
	        this.maxY = Number.NEGATIVE_INFINITY;
	      }
	    }
	  }, {
	    key: "aabbCompute",
	    value: function aabbCompute() {
	      var minX = Number.POSITIVE_INFINITY,
	        minY = Number.POSITIVE_INFINITY,
	        maxX = Number.NEGATIVE_INFINITY,
	        maxY = Number.NEGATIVE_INFINITY;
	      var polygons = this.polygons;
	      for (var i = 0, n = polygons.length; i < n; i++) {
	        var polygon = polygons[i];
	        var vertices = polygon;
	        for (var ii = 0, nn = polygon.length; ii < nn; ii += 2) {
	          var x = vertices[ii];
	          var y = vertices[ii + 1];
	          minX = Math.min(minX, x);
	          minY = Math.min(minY, y);
	          maxX = Math.max(maxX, x);
	          maxY = Math.max(maxY, y);
	        }
	      }
	      this.minX = minX;
	      this.minY = minY;
	      this.maxX = maxX;
	      this.maxY = maxY;
	    }
	  }, {
	    key: "aabbContainsPoint",
	    value: function aabbContainsPoint(x, y) {
	      return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
	    }
	  }, {
	    key: "aabbIntersectsSegment",
	    value: function aabbIntersectsSegment(x1, y1, x2, y2) {
	      var minX = this.minX;
	      var minY = this.minY;
	      var maxX = this.maxX;
	      var maxY = this.maxY;
	      if (x1 <= minX && x2 <= minX || y1 <= minY && y2 <= minY || x1 >= maxX && x2 >= maxX || y1 >= maxY && y2 >= maxY) return false;
	      var m = (y2 - y1) / (x2 - x1);
	      var y = m * (minX - x1) + y1;
	      if (y > minY && y < maxY) return true;
	      y = m * (maxX - x1) + y1;
	      if (y > minY && y < maxY) return true;
	      var x = (minY - y1) / m + x1;
	      if (x > minX && x < maxX) return true;
	      x = (maxY - y1) / m + x1;
	      if (x > minX && x < maxX) return true;
	      return false;
	    }
	  }, {
	    key: "aabbIntersectsSkeleton",
	    value: function aabbIntersectsSkeleton(bounds) {
	      return this.minX < bounds.maxX && this.maxX > bounds.minX && this.minY < bounds.maxY && this.maxY > bounds.minY;
	    }
	  }, {
	    key: "containsPoint",
	    value: function containsPoint(x, y) {
	      var polygons = this.polygons;
	      for (var i = 0, n = polygons.length; i < n; i++) if (this.containsPointPolygon(polygons[i], x, y)) return this.boundingBoxes[i];
	      return null;
	    }
	  }, {
	    key: "containsPointPolygon",
	    value: function containsPointPolygon(polygon, x, y) {
	      var vertices = polygon;
	      var nn = polygon.length;
	      var prevIndex = nn - 2;
	      var inside = false;
	      for (var ii = 0; ii < nn; ii += 2) {
	        var vertexY = vertices[ii + 1];
	        var prevY = vertices[prevIndex + 1];
	        if (vertexY < y && prevY >= y || prevY < y && vertexY >= y) {
	          var vertexX = vertices[ii];
	          if (vertexX + (y - vertexY) / (prevY - vertexY) * (vertices[prevIndex] - vertexX) < x) inside = !inside;
	        }
	        prevIndex = ii;
	      }
	      return inside;
	    }
	  }, {
	    key: "intersectsSegment",
	    value: function intersectsSegment(x1, y1, x2, y2) {
	      var polygons = this.polygons;
	      for (var i = 0, n = polygons.length; i < n; i++) if (this.intersectsSegmentPolygon(polygons[i], x1, y1, x2, y2)) return this.boundingBoxes[i];
	      return null;
	    }
	  }, {
	    key: "intersectsSegmentPolygon",
	    value: function intersectsSegmentPolygon(polygon, x1, y1, x2, y2) {
	      var vertices = polygon;
	      var nn = polygon.length;
	      var width12 = x1 - x2,
	        height12 = y1 - y2;
	      var det1 = x1 * y2 - y1 * x2;
	      var x3 = vertices[nn - 2],
	        y3 = vertices[nn - 1];
	      for (var ii = 0; ii < nn; ii += 2) {
	        var x4 = vertices[ii],
	          y4 = vertices[ii + 1];
	        var det2 = x3 * y4 - y3 * x4;
	        var width34 = x3 - x4,
	          height34 = y3 - y4;
	        var det3 = width12 * height34 - height12 * width34;
	        var x = (det1 * width34 - width12 * det2) / det3;
	        if ((x >= x3 && x <= x4 || x >= x4 && x <= x3) && (x >= x1 && x <= x2 || x >= x2 && x <= x1)) {
	          var y = (det1 * height34 - height12 * det2) / det3;
	          if ((y >= y3 && y <= y4 || y >= y4 && y <= y3) && (y >= y1 && y <= y2 || y >= y2 && y <= y1)) return true;
	        }
	        x3 = x4;
	        y3 = y4;
	      }
	      return false;
	    }
	  }, {
	    key: "getPolygon",
	    value: function getPolygon(boundingBox) {
	      if (!boundingBox) throw new Error("boundingBox cannot be null.");
	      var index = this.boundingBoxes.indexOf(boundingBox);
	      return index === -1 ? null : this.polygons[index];
	    }
	  }, {
	    key: "getWidth",
	    value: function getWidth() {
	      return this.maxX - this.minX;
	    }
	  }, {
	    key: "getHeight",
	    value: function getHeight() {
	      return this.maxY - this.minY;
	    }
	  }]);
	}();

	var Triangulator = function () {
	  function Triangulator() {
	    _classCallCheck(this, Triangulator);
	    _defineProperty(this, "convexPolygons", []);
	    _defineProperty(this, "convexPolygonsIndices", []);
	    _defineProperty(this, "indicesArray", []);
	    _defineProperty(this, "isConcaveArray", []);
	    _defineProperty(this, "triangles", []);
	    _defineProperty(this, "polygonPool", new Pool(function () {
	      return [];
	    }));
	    _defineProperty(this, "polygonIndicesPool", new Pool(function () {
	      return [];
	    }));
	  }
	  return _createClass(Triangulator, [{
	    key: "triangulate",
	    value: function triangulate(verticesArray) {
	      var vertices = verticesArray;
	      var vertexCount = verticesArray.length >> 1;
	      var indices = this.indicesArray;
	      indices.length = 0;
	      for (var i = 0; i < vertexCount; i++) indices[i] = i;
	      var isConcave = this.isConcaveArray;
	      isConcave.length = 0;
	      for (var _i = 0; _i < vertexCount; _i++) isConcave[_i] = Triangulator.isConcave(_i, vertexCount, vertices, indices);
	      var triangles = this.triangles;
	      triangles.length = 0;
	      while (vertexCount > 3) {
	        var previous = vertexCount - 1,
	          _i2 = 0,
	          next = 1;
	        while (true) {
	          outer: if (!isConcave[_i2]) {
	            var p1 = indices[previous] << 1,
	              p2 = indices[_i2] << 1,
	              p3 = indices[next] << 1;
	            var p1x = vertices[p1],
	              p1y = vertices[p1 + 1];
	            var p2x = vertices[p2],
	              p2y = vertices[p2 + 1];
	            var p3x = vertices[p3],
	              p3y = vertices[p3 + 1];
	            for (var ii = next + 1 < vertexCount ? next + 1 : 0; ii !== previous;) {
	              if (isConcave[ii]) {
	                var v = indices[ii] << 1;
	                var vx = vertices[v],
	                  vy = vertices[v + 1];
	                if (Triangulator.positiveArea(p3x, p3y, p1x, p1y, vx, vy) && Triangulator.positiveArea(p1x, p1y, p2x, p2y, vx, vy) && Triangulator.positiveArea(p2x, p2y, p3x, p3y, vx, vy)) break outer;
	              }
	              if (++ii === vertexCount) ii = 0;
	            }
	            break;
	          }
	          if (next === 0) {
	            do {
	              if (!isConcave[_i2]) break;
	              _i2--;
	            } while (_i2 > 0);
	            previous = _i2 > 0 ? _i2 - 1 : vertexCount - 1;
	            next = _i2 + 1 < vertexCount ? _i2 + 1 : 0;
	            break;
	          }
	          previous = _i2;
	          _i2 = next;
	          if (++next === vertexCount) next = 0;
	        }
	        triangles.push(indices[previous], indices[_i2], indices[next]);
	        indices.splice(_i2, 1);
	        isConcave.splice(_i2, 1);
	        vertexCount--;
	        var previousIndex = _i2 > 0 ? _i2 - 1 : vertexCount - 1;
	        var nextIndex = _i2 < vertexCount ? _i2 : 0;
	        isConcave[previousIndex] = Triangulator.isConcave(previousIndex, vertexCount, vertices, indices);
	        isConcave[nextIndex] = Triangulator.isConcave(nextIndex, vertexCount, vertices, indices);
	      }
	      if (vertexCount === 3) triangles.push(indices[2], indices[0], indices[1]);
	      return triangles;
	    }
	  }, {
	    key: "decompose",
	    value: function decompose(verticesArray, triangles) {
	      var vertices = verticesArray;
	      var convexPolygons = this.convexPolygons;
	      this.polygonPool.freeAll(convexPolygons);
	      convexPolygons.length = 0;
	      var convexPolygonsIndices = this.convexPolygonsIndices;
	      this.polygonIndicesPool.freeAll(convexPolygonsIndices);
	      convexPolygonsIndices.length = 0;
	      var polygonIndices = this.polygonIndicesPool.obtain();
	      polygonIndices.length = 0;
	      var polygon = this.polygonPool.obtain();
	      polygon.length = 0;
	      var fanBaseIndex = -1,
	        lastWinding = 0;
	      for (var i = 0, n = triangles.length; i < n; i += 3) {
	        var t1 = triangles[i] << 1,
	          t2 = triangles[i + 1] << 1,
	          t3 = triangles[i + 2] << 1;
	        var x1 = vertices[t1],
	          y1 = vertices[t1 + 1];
	        var x2 = vertices[t2],
	          y2 = vertices[t2 + 1];
	        var x3 = vertices[t3],
	          y3 = vertices[t3 + 1];
	        if (fanBaseIndex === t1) {
	          var o = polygon.length - 4;
	          if (Triangulator.winding(polygon[o], polygon[o + 1], polygon[o + 2], polygon[o + 3], x3, y3) === lastWinding && Triangulator.winding(x3, y3, polygon[0], polygon[1], polygon[2], polygon[3]) === lastWinding) {
	            polygon.push(x3, y3);
	            polygonIndices.push(t3);
	            continue;
	          }
	        }
	        if (polygon.length > 0) {
	          convexPolygons.push(polygon);
	          convexPolygonsIndices.push(polygonIndices);
	          polygon = this.polygonPool.obtain();
	          polygonIndices = this.polygonIndicesPool.obtain();
	        }
	        polygon.length = 0;
	        polygon.push(x1, y1, x2, y2);
	        polygon.push(x3, y3);
	        polygonIndices.length = 0;
	        polygonIndices.push(t1, t2, t3);
	        lastWinding = Triangulator.winding(x1, y1, x2, y2, x3, y3);
	        fanBaseIndex = t1;
	      }
	      if (polygon.length > 0) {
	        convexPolygons.push(polygon);
	        convexPolygonsIndices.push(polygonIndices);
	      }
	      for (var _i3 = 0, _n = convexPolygons.length; _i3 < _n; _i3++) {
	        polygonIndices = convexPolygonsIndices[_i3];
	        if (polygonIndices.length === 0) continue;
	        var firstIndex = polygonIndices[0];
	        var lastIndex = polygonIndices[polygonIndices.length - 1];
	        polygon = convexPolygons[_i3];
	        var _o = polygon.length - 4;
	        var prevPrevX = polygon[_o],
	          prevPrevY = polygon[_o + 1];
	        var prevX = polygon[_o + 2],
	          prevY = polygon[_o + 3];
	        var firstX = polygon[0],
	          firstY = polygon[1];
	        var secondX = polygon[2],
	          secondY = polygon[3];
	        var winding = Triangulator.winding(prevPrevX, prevPrevY, prevX, prevY, firstX, firstY);
	        for (var ii = 0; ii < _n; ii++) {
	          if (ii === _i3) continue;
	          var otherIndices = convexPolygonsIndices[ii];
	          if (otherIndices.length !== 3) continue;
	          var otherFirstIndex = otherIndices[0];
	          var otherSecondIndex = otherIndices[1];
	          var otherLastIndex = otherIndices[2];
	          var otherPoly = convexPolygons[ii];
	          var _x = otherPoly[otherPoly.length - 2],
	            _y = otherPoly[otherPoly.length - 1];
	          if (otherFirstIndex !== firstIndex || otherSecondIndex !== lastIndex) continue;
	          if (Triangulator.winding(prevPrevX, prevPrevY, prevX, prevY, _x, _y) === winding && Triangulator.winding(_x, _y, firstX, firstY, secondX, secondY) === winding) {
	            otherPoly.length = 0;
	            otherIndices.length = 0;
	            polygon.push(_x, _y);
	            polygonIndices.push(otherLastIndex);
	            lastIndex = otherLastIndex;
	            prevPrevX = prevX;
	            prevPrevY = prevY;
	            prevX = _x;
	            prevY = _y;
	            ii = -1;
	          }
	        }
	      }
	      for (var _i4 = convexPolygons.length - 1; _i4 >= 0; _i4--) {
	        polygon = convexPolygons[_i4];
	        if (polygon.length === 0) {
	          convexPolygons.splice(_i4, 1);
	          this.polygonPool.free(polygon);
	          polygonIndices = convexPolygonsIndices[_i4];
	          convexPolygonsIndices.splice(_i4, 1);
	          this.polygonIndicesPool.free(polygonIndices);
	        } else polygon.push(polygon[0], polygon[1]);
	      }
	      return convexPolygons;
	    }
	  }], [{
	    key: "isConcave",
	    value: function isConcave(index, vertexCount, vertices, indices) {
	      var previous = indices[index > 0 ? index - 1 : vertexCount - 1] << 1;
	      var current = indices[index] << 1;
	      var next = indices[index + 1 < vertexCount ? index + 1 : 0] << 1;
	      return !Triangulator.positiveArea(vertices[previous], vertices[previous + 1], vertices[current], vertices[current + 1], vertices[next], vertices[next + 1]);
	    }
	  }, {
	    key: "positiveArea",
	    value: function positiveArea(p1x, p1y, p2x, p2y, p3x, p3y) {
	      return p1x * (p3y - p2y) + p2x * (p1y - p3y) + p3x * (p2y - p1y) >= 0;
	    }
	  }, {
	    key: "winding",
	    value: function winding(p1x, p1y, p2x, p2y, p3x, p3y) {
	      return p1x * (p3y - p2y) + p2x * (p1y - p3y) + p3x * (p2y - p1y) >= 0 ? 1 : -1;
	    }
	  }]);
	}();

	var SkeletonClipping = function () {
	  function SkeletonClipping() {
	    _classCallCheck(this, SkeletonClipping);
	    _defineProperty(this, "triangulator", null);
	    _defineProperty(this, "clippingPolygon", []);
	    _defineProperty(this, "clippingPolygons", []);
	    _defineProperty(this, "clipOutput", []);
	    _defineProperty(this, "clippedVertices", []);
	    _defineProperty(this, "clippedUVs", []);
	    _defineProperty(this, "clippedTriangles", []);
	    _defineProperty(this, "inverseVertices", []);
	    _defineProperty(this, "_clippedVerticesTyped", new Float32Array(1024));
	    _defineProperty(this, "_clippedUVsTyped", new Float32Array(1024));
	    _defineProperty(this, "_clippedTrianglesTyped", new Uint16Array(1024));
	    _defineProperty(this, "clippedVerticesTyped", new Float32Array(0));
	    _defineProperty(this, "clippedUVsTyped", new Float32Array(0));
	    _defineProperty(this, "clippedTrianglesTyped", new Uint16Array(0));
	    _defineProperty(this, "clippedVerticesLength", 0);
	    _defineProperty(this, "clippedUVsLength", 0);
	    _defineProperty(this, "clippedTrianglesLength", 0);
	    _defineProperty(this, "scratch", []);
	    _defineProperty(this, "inverse", false);
	    _defineProperty(this, "clipAttachment", null);
	  }
	  return _createClass(SkeletonClipping, [{
	    key: "clipStart",
	    value: function clipStart(skeleton, slot, clip) {
	      if (this.clipAttachment) return;
	      var n = clip.worldVerticesLength;
	      this.clipAttachment = clip;
	      this.inverse = clip.inverse;
	      var vertices = Utils.setArraySize(this.clippingPolygon, n);
	      clip.computeWorldVertices(skeleton, slot, 0, n, vertices, 0, 2);
	      var clippingPolygon = this.clippingPolygon;
	      var convex = this.makeClockwise(clippingPolygon);
	      if (convex || this.inverse || clip.convex) {
	        if (!convex) this.makeConvex(clippingPolygon);
	        this.clippingPolygon.push(clippingPolygon[0], clippingPolygon[1]);
	        this.clippingPolygons.push(clippingPolygon);
	      } else {
	        var _this$clippingPolygon;
	        if (this.triangulator === null) this.triangulator = new Triangulator();
	        (_this$clippingPolygon = this.clippingPolygons).push.apply(_this$clippingPolygon, _toConsumableArray(this.triangulator.decompose(clippingPolygon, this.triangulator.triangulate(clippingPolygon))));
	      }
	    }
	  }, {
	    key: "clipEnd",
	    value: function clipEnd(slot) {
	      if (!this.clipAttachment) return;
	      if (slot && this.clipAttachment.endSlot !== slot.data) return;
	      this.clipAttachment = null;
	      this.clippingPolygons.length = 0;
	    }
	  }, {
	    key: "isClipping",
	    value: function isClipping() {
	      return this.clipAttachment != null;
	    }
	  }, {
	    key: "clipTriangles",
	    value: function clipTriangles(vertices, triangles, trianglesLength, uvs, light, dark, twoColor, stride) {
	      return uvs && light && dark && typeof twoColor === 'boolean' && typeof stride === 'number' ? this.clipTrianglesRender(vertices, triangles, trianglesLength, uvs, light, dark, twoColor, stride) : this.clipTrianglesNoRender(vertices, triangles, trianglesLength);
	    }
	  }, {
	    key: "clipTrianglesNoRender",
	    value: function clipTrianglesNoRender(vertices, triangles, trianglesLength) {
	      var clippedVertices = this.clippedVertices;
	      clippedVertices.length = 0;
	      var clippedTriangles = this.clippedTriangles;
	      clippedTriangles.length = 0;
	      var index = 0;
	      if (this.inverse) {
	        var polygon = this.clippingPolygons[0];
	        for (var i = 0; i < trianglesLength; i += 3) {
	          var t = triangles[i] << 1;
	          var x1 = vertices[t],
	            y1 = vertices[t + 1];
	          t = triangles[i + 1] << 1;
	          var x2 = vertices[t],
	            y2 = vertices[t + 1];
	          t = triangles[i + 2] << 1;
	          var x3 = vertices[t],
	            y3 = vertices[t + 1];
	          this.clipInverse(x1, y1, x2, y2, x3, y3, polygon);
	          var iv = this.inverseVertices;
	          for (var offset = 0, nn = this.inverseVertices.length; offset < nn;) {
	            var polygonSize = iv[offset++];
	            var vertexCount = polygonSize >> 1,
	              s = clippedVertices.length;
	            var cv = Utils.setArraySize(clippedVertices, s + polygonSize);
	            Utils.arrayCopy(iv, offset, cv, s, polygonSize);
	            s = clippedTriangles.length;
	            var ct = Utils.setArraySize(clippedTriangles, s + 3 * (vertexCount - 2));
	            for (var ii = 1; ii < vertexCount - 1; ii++, s += 3) {
	              ct[s] = index;
	              ct[s + 1] = index + ii;
	              ct[s + 2] = index + ii + 1;
	            }
	            index += vertexCount;
	            offset += polygonSize;
	          }
	        }
	        return true;
	      }
	      var clipOutput = this.clipOutput;
	      var polygons = this.clippingPolygons;
	      var polygonsCount = polygons.length;
	      var clipOutputItems = null;
	      for (var _i = 0; _i < trianglesLength; _i += 3) {
	        var _t = triangles[_i] << 1;
	        var _x = vertices[_t],
	          _y = vertices[_t + 1];
	        _t = triangles[_i + 1] << 1;
	        var _x2 = vertices[_t],
	          _y2 = vertices[_t + 1];
	        _t = triangles[_i + 2] << 1;
	        var _x3 = vertices[_t],
	          _y3 = vertices[_t + 1];
	        for (var p = 0; p < polygonsCount; p++) {
	          var _s = clippedVertices.length;
	          if (this.clip(_x, _y, _x2, _y2, _x3, _y3, polygons[p])) {
	            clipOutputItems = this.clipOutput;
	            var clipOutputLength = clipOutput.length;
	            if (clipOutputLength === 0) continue;
	            var clipOutputCount = clipOutputLength >> 1;
	            var _cv = Utils.setArraySize(clippedVertices, _s + clipOutputLength);
	            Utils.arrayCopy(clipOutputItems, 0, _cv, _s, clipOutputLength);
	            _s = clippedTriangles.length;
	            var _ct = Utils.setArraySize(clippedTriangles, _s + 3 * (clipOutputCount - 2));
	            clipOutputCount--;
	            for (var _ii = 1; _ii < clipOutputCount; _ii++, _s += 3) {
	              _ct[_s] = index;
	              _ct[_s + 1] = index + _ii;
	              _ct[_s + 2] = index + _ii + 1;
	            }
	            index += clipOutputCount;
	          } else {
	            var _cv2 = Utils.setArraySize(clippedVertices, _s + 3 * 2);
	            _cv2[_s] = _x;
	            _cv2[_s + 1] = _y;
	            _cv2[_s + 2] = _x2;
	            _cv2[_s + 3] = _y2;
	            _cv2[_s + 4] = _x3;
	            _cv2[_s + 5] = _y3;
	            _s = clippedTriangles.length;
	            var _ct2 = Utils.setArraySize(clippedTriangles, _s + 3);
	            _ct2[_s] = index;
	            _ct2[_s + 1] = index + 1;
	            _ct2[_s + 2] = index + 2;
	            index += 3;
	            break;
	          }
	        }
	      }
	      return clipOutputItems != null;
	    }
	  }, {
	    key: "clipTrianglesRender",
	    value: function clipTrianglesRender(vertices, triangles, trianglesLength, uvs, light, dark, twoColor, stride) {
	      var clippedVertices = this.clippedVertices;
	      clippedVertices.length = 0;
	      var clippedTriangles = this.clippedTriangles;
	      clippedTriangles.length = 0;
	      var index = 0;
	      if (this.inverse) {
	        var polygon = this.clippingPolygons[0];
	        for (var i = 0; i < trianglesLength; i += 3) {
	          var t0 = triangles[i],
	            t1 = triangles[i + 1],
	            t2 = triangles[i + 2];
	          var x1 = vertices[t0 * stride],
	            y1 = vertices[t0 * stride + 1];
	          var x2 = vertices[t1 * stride],
	            y2 = vertices[t1 * stride + 1];
	          var x3 = vertices[t2 * stride],
	            y3 = vertices[t2 * stride + 1];
	          this.clipInverse(x1, y1, x2, y2, x3, y3, polygon);
	          var nn = this.inverseVertices.length;
	          if (nn === 0) continue;
	          var u1 = uvs[t0 <<= 1],
	            v1 = uvs[t0 + 1];
	          var u2 = uvs[t1 <<= 1],
	            v2 = uvs[t1 + 1];
	          var u3 = uvs[t2 <<= 1],
	            v3 = uvs[t2 + 1];
	          var d0 = y2 - y3,
	            d1 = x3 - x2,
	            d2 = x1 - x3,
	            d4 = y3 - y1,
	            d = 1 / (d0 * d2 + d1 * (y1 - y3));
	          var iv = this.inverseVertices;
	          for (var offset = 0; offset < nn;) {
	            var polygonSize = iv[offset++];
	            var vertexCount = polygonSize >> 1;
	            var s = clippedVertices.length;
	            var cv = Utils.setArraySize(clippedVertices, s + vertexCount * stride);
	            for (var ii = 0; ii < polygonSize; ii += 2, s += stride) {
	              var x = iv[offset + ii],
	                y = iv[offset + ii + 1];
	              cv[s] = x;
	              cv[s + 1] = y;
	              cv[s + 2] = light.r;
	              cv[s + 3] = light.g;
	              cv[s + 4] = light.b;
	              cv[s + 5] = light.a;
	              var c0 = x - x3,
	                c1 = y - y3,
	                a = (d0 * c0 + d1 * c1) * d,
	                b = (d4 * c0 + d2 * c1) * d,
	                c = 1 - a - b;
	              cv[s + 6] = u1 * a + u2 * b + u3 * c;
	              cv[s + 7] = v1 * a + v2 * b + v3 * c;
	              if (twoColor) {
	                cv[s + 8] = dark.r;
	                cv[s + 9] = dark.g;
	                cv[s + 10] = dark.b;
	                cv[s + 11] = dark.a;
	              }
	            }
	            s = clippedTriangles.length;
	            var ct = Utils.setArraySize(clippedTriangles, s + 3 * (vertexCount - 2));
	            for (var _ii2 = 1; _ii2 < vertexCount - 1; _ii2++, s += 3) {
	              ct[s] = index;
	              ct[s + 1] = index + _ii2;
	              ct[s + 2] = index + _ii2 + 1;
	            }
	            index += vertexCount;
	            offset += polygonSize;
	          }
	        }
	        return true;
	      }
	      var clipOutput = this.clipOutput;
	      var polygons = this.clippingPolygons;
	      var polygonsCount = this.clippingPolygons.length;
	      var clipOutputItems = null;
	      for (var _i2 = 0; _i2 < trianglesLength; _i2 += 3) {
	        var t = triangles[_i2];
	        var _x4 = vertices[t * stride],
	          _y4 = vertices[t * stride + 1];
	        var _u = uvs[t << 1],
	          _v = uvs[(t << 1) + 1];
	        t = triangles[_i2 + 1];
	        var _x5 = vertices[t * stride],
	          _y5 = vertices[t * stride + 1];
	        var _u2 = uvs[t << 1],
	          _v2 = uvs[(t << 1) + 1];
	        t = triangles[_i2 + 2];
	        var _x6 = vertices[t * stride],
	          _y6 = vertices[t * stride + 1];
	        var _u3 = uvs[t << 1],
	          _v3 = uvs[(t << 1) + 1];
	        var _d = 0,
	          _d2 = 0,
	          _d3 = 0,
	          _d4 = 0,
	          _d5 = 0;
	        for (var p = 0; p < polygonsCount; p++) {
	          var _s2 = clippedVertices.length;
	          if (this.clip(_x4, _y4, _x5, _y5, _x6, _y6, polygons[p])) {
	            clipOutputItems = this.clipOutput;
	            var clipOutputLength = clipOutput.length;
	            if (clipOutputLength === 0) continue;
	            var clipOutputCount = clipOutputLength >> 1;
	            if (_d5 === 0) {
	              _d = _y5 - _y6;
	              _d2 = _x6 - _x5;
	              _d3 = _x4 - _x6;
	              _d4 = _y6 - _y4;
	              _d5 = 1 / (_d * _d3 - _d2 * _d4);
	            }
	            var _cv3 = Utils.setArraySize(clippedVertices, _s2 + clipOutputCount * stride);
	            for (var _ii3 = 0; _ii3 < clipOutputLength; _ii3 += 2, _s2 += stride) {
	              var _x7 = clipOutputItems[_ii3],
	                _y7 = clipOutputItems[_ii3 + 1];
	              _cv3[_s2] = _x7;
	              _cv3[_s2 + 1] = _y7;
	              _cv3[_s2 + 2] = light.r;
	              _cv3[_s2 + 3] = light.g;
	              _cv3[_s2 + 4] = light.b;
	              _cv3[_s2 + 5] = light.a;
	              var _c = _x7 - _x6,
	                _c2 = _y7 - _y6,
	                _a = (_d * _c + _d2 * _c2) * _d5,
	                _b = (_d4 * _c + _d3 * _c2) * _d5,
	                _c3 = 1 - _a - _b;
	              _cv3[_s2 + 6] = _u * _a + _u2 * _b + _u3 * _c3;
	              _cv3[_s2 + 7] = _v * _a + _v2 * _b + _v3 * _c3;
	              if (twoColor) {
	                _cv3[_s2 + 8] = dark.r;
	                _cv3[_s2 + 9] = dark.g;
	                _cv3[_s2 + 10] = dark.b;
	                _cv3[_s2 + 11] = dark.a;
	              }
	            }
	            _s2 = clippedTriangles.length;
	            var _ct3 = Utils.setArraySize(clippedTriangles, _s2 + 3 * (clipOutputCount - 2));
	            clipOutputCount--;
	            for (var _ii4 = 1; _ii4 < clipOutputCount; _ii4++, _s2 += 3) {
	              _ct3[_s2] = index;
	              _ct3[_s2 + 1] = index + _ii4;
	              _ct3[_s2 + 2] = index + _ii4 + 1;
	            }
	            index += clipOutputCount + 1;
	          } else {
	            var _cv4 = Utils.setArraySize(clippedVertices, _s2 + 3 * stride);
	            _cv4[_s2] = _x4;
	            _cv4[_s2 + 1] = _y4;
	            _cv4[_s2 + 2] = light.r;
	            _cv4[_s2 + 3] = light.g;
	            _cv4[_s2 + 4] = light.b;
	            _cv4[_s2 + 5] = light.a;
	            if (!twoColor) {
	              _cv4[_s2 + 6] = _u;
	              _cv4[_s2 + 7] = _v;
	              _cv4[_s2 + 8] = _x5;
	              _cv4[_s2 + 9] = _y5;
	              _cv4[_s2 + 10] = light.r;
	              _cv4[_s2 + 11] = light.g;
	              _cv4[_s2 + 12] = light.b;
	              _cv4[_s2 + 13] = light.a;
	              _cv4[_s2 + 14] = _u2;
	              _cv4[_s2 + 15] = _v2;
	              _cv4[_s2 + 16] = _x6;
	              _cv4[_s2 + 17] = _y6;
	              _cv4[_s2 + 18] = light.r;
	              _cv4[_s2 + 19] = light.g;
	              _cv4[_s2 + 20] = light.b;
	              _cv4[_s2 + 21] = light.a;
	              _cv4[_s2 + 22] = _u3;
	              _cv4[_s2 + 23] = _v3;
	            } else {
	              _cv4[_s2 + 6] = _u;
	              _cv4[_s2 + 7] = _v;
	              _cv4[_s2 + 8] = dark.r;
	              _cv4[_s2 + 9] = dark.g;
	              _cv4[_s2 + 10] = dark.b;
	              _cv4[_s2 + 11] = dark.a;
	              _cv4[_s2 + 12] = _x5;
	              _cv4[_s2 + 13] = _y5;
	              _cv4[_s2 + 14] = light.r;
	              _cv4[_s2 + 15] = light.g;
	              _cv4[_s2 + 16] = light.b;
	              _cv4[_s2 + 17] = light.a;
	              _cv4[_s2 + 18] = _u2;
	              _cv4[_s2 + 19] = _v2;
	              _cv4[_s2 + 20] = dark.r;
	              _cv4[_s2 + 21] = dark.g;
	              _cv4[_s2 + 22] = dark.b;
	              _cv4[_s2 + 23] = dark.a;
	              _cv4[_s2 + 24] = _x6;
	              _cv4[_s2 + 25] = _y6;
	              _cv4[_s2 + 26] = light.r;
	              _cv4[_s2 + 27] = light.g;
	              _cv4[_s2 + 28] = light.b;
	              _cv4[_s2 + 29] = light.a;
	              _cv4[_s2 + 30] = _u3;
	              _cv4[_s2 + 31] = _v3;
	              _cv4[_s2 + 32] = dark.r;
	              _cv4[_s2 + 33] = dark.g;
	              _cv4[_s2 + 34] = dark.b;
	              _cv4[_s2 + 35] = dark.a;
	            }
	            _s2 = clippedTriangles.length;
	            var _ct4 = Utils.setArraySize(clippedTriangles, _s2 + 3);
	            _ct4[_s2] = index;
	            _ct4[_s2 + 1] = index + 1;
	            _ct4[_s2 + 2] = index + 2;
	            index += 3;
	            break;
	          }
	        }
	      }
	      return clipOutputItems != null;
	    }
	  }, {
	    key: "clipTrianglesUnpacked",
	    value: function clipTrianglesUnpacked(vertices, vertexStart, triangles, trianglesLength, uvs) {
	      var stride = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 2;
	      var clippedVertices = this._clippedVerticesTyped;
	      var clippedUVs = this._clippedUVsTyped;
	      var clippedTriangles = this._clippedTrianglesTyped;
	      var index = 0;
	      this.clippedVerticesLength = 0;
	      this.clippedUVsLength = 0;
	      this.clippedTrianglesLength = 0;
	      if (this.inverse) {
	        var polygon = this.clippingPolygons[0];
	        for (var i = 0; i < trianglesLength; i += 3) {
	          var v = triangles[i] * stride;
	          var x1 = vertices[vertexStart + v],
	            y1 = vertices[vertexStart + v + 1];
	          var uv = triangles[i] << 1;
	          var u1 = uvs[uv],
	            v1 = uvs[uv + 1];
	          v = triangles[i + 1] * stride;
	          var x2 = vertices[vertexStart + v],
	            y2 = vertices[vertexStart + v + 1];
	          uv = triangles[i + 1] << 1;
	          var u2 = uvs[uv],
	            v2 = uvs[uv + 1];
	          v = triangles[i + 2] * stride;
	          var x3 = vertices[vertexStart + v],
	            y3 = vertices[vertexStart + v + 1];
	          uv = triangles[i + 2] << 1;
	          var u3 = uvs[uv],
	            v3 = uvs[uv + 1];
	          this.clipInverse(x1, y1, x2, y2, x3, y3, polygon);
	          var nn = this.inverseVertices.length;
	          if (nn === 0) continue;
	          var d0 = y2 - y3,
	            d1 = x3 - x2,
	            d2 = x1 - x3,
	            d4 = y3 - y1,
	            d = 1 / (d0 * d2 + d1 * (y1 - y3));
	          var iv = this.inverseVertices;
	          for (var offset = 0; offset < nn;) {
	            var polygonSize = iv[offset++];
	            var vertexCount = polygonSize >> 1;
	            var s = this.clippedVerticesLength;
	            var newLength = s + vertexCount * stride;
	            var newUVLength = this.clippedUVsLength + vertexCount * 2;
	            if (clippedVertices.length < newLength) {
	              this._clippedVerticesTyped = new Float32Array(newLength * 2);
	              this._clippedVerticesTyped.set(clippedVertices.subarray(0, s));
	              clippedVertices = this._clippedVerticesTyped;
	            }
	            if (clippedUVs.length < newUVLength) {
	              this._clippedUVsTyped = new Float32Array(newUVLength * 2);
	              this._clippedUVsTyped.set(clippedUVs.subarray(0, this.clippedUVsLength));
	              clippedUVs = this._clippedUVsTyped;
	            }
	            this.clippedVerticesLength = newLength;
	            this.clippedUVsLength = newUVLength;
	            var cv = this._clippedVerticesTyped;
	            var cu = this._clippedUVsTyped;
	            var uvIndex = newUVLength - vertexCount * 2;
	            for (var ii = 0; ii < polygonSize; ii += 2, s += stride, uvIndex += 2) {
	              var x = iv[offset + ii],
	                y = iv[offset + ii + 1];
	              cv[s] = x;
	              cv[s + 1] = y;
	              var c0 = x - x3,
	                c1 = y - y3,
	                a = (d0 * c0 + d1 * c1) * d,
	                b = (d4 * c0 + d2 * c1) * d,
	                c = 1 - a - b;
	              cu[uvIndex] = u1 * a + u2 * b + u3 * c;
	              cu[uvIndex + 1] = v1 * a + v2 * b + v3 * c;
	            }
	            s = this.clippedTrianglesLength;
	            var newLengthTriangles = s + 3 * (vertexCount - 2);
	            if (clippedTriangles.length < newLengthTriangles) {
	              this._clippedTrianglesTyped = new Uint16Array(newLengthTriangles * 2);
	              this._clippedTrianglesTyped.set(clippedTriangles.subarray(0, s));
	              clippedTriangles = this._clippedTrianglesTyped;
	            }
	            this.clippedTrianglesLength = newLengthTriangles;
	            var ct = clippedTriangles;
	            for (var _ii5 = 1; _ii5 < vertexCount - 1; _ii5++, s += 3) {
	              ct[s] = index;
	              ct[s + 1] = index + _ii5;
	              ct[s + 2] = index + _ii5 + 1;
	            }
	            index += vertexCount;
	            offset += polygonSize;
	          }
	        }
	        this.clippedVerticesTyped = this._clippedVerticesTyped.subarray(0, this.clippedVerticesLength);
	        this.clippedUVsTyped = this._clippedUVsTyped.subarray(0, this.clippedUVsLength);
	        this.clippedTrianglesTyped = this._clippedTrianglesTyped.subarray(0, this.clippedTrianglesLength);
	        return true;
	      }
	      var clipOutput = this.clipOutput;
	      var polygons = this.clippingPolygons;
	      var polygonsCount = this.clippingPolygons.length;
	      var clipOutputItems = null;
	      for (var _i3 = 0; _i3 < trianglesLength; _i3 += 3) {
	        var t = triangles[_i3];
	        var _v4 = t * stride;
	        var _x8 = vertices[vertexStart + _v4],
	          _y8 = vertices[vertexStart + _v4 + 1];
	        var _uv = t << 1;
	        var _u4 = uvs[_uv],
	          _v5 = uvs[_uv + 1];
	        t = triangles[_i3 + 1];
	        _v4 = t * stride;
	        var _x9 = vertices[vertexStart + _v4],
	          _y9 = vertices[vertexStart + _v4 + 1];
	        _uv = t << 1;
	        var _u5 = uvs[_uv],
	          _v6 = uvs[_uv + 1];
	        t = triangles[_i3 + 2];
	        _v4 = t * stride;
	        var _x0 = vertices[vertexStart + _v4],
	          _y0 = vertices[vertexStart + _v4 + 1];
	        _uv = t << 1;
	        var _u6 = uvs[_uv],
	          _v7 = uvs[_uv + 1];
	        var _d6 = 0,
	          _d7 = 0,
	          _d8 = 0,
	          _d9 = 0,
	          _d0 = 0;
	        for (var p = 0; p < polygonsCount; p++) {
	          var _s3 = this.clippedVerticesLength;
	          if (this.clip(_x8, _y8, _x9, _y9, _x0, _y0, polygons[p])) {
	            clipOutputItems = clipOutput;
	            var clipOutputLength = clipOutput.length;
	            if (clipOutputLength === 0) continue;
	            var clipOutputCount = clipOutputLength >> 1;
	            if (_d0 === 0) {
	              _d6 = _y9 - _y0;
	              _d7 = _x0 - _x9;
	              _d8 = _x8 - _x0;
	              _d9 = _y0 - _y8;
	              _d0 = 1 / (_d6 * _d8 - _d7 * _d9);
	            }
	            var _newLength = _s3 + clipOutputCount * stride;
	            if (clippedVertices.length < _newLength) {
	              this._clippedVerticesTyped = new Float32Array(_newLength * 2);
	              this._clippedVerticesTyped.set(clippedVertices.subarray(0, _s3));
	              this._clippedUVsTyped = new Float32Array((this.clippedUVsLength + clipOutputCount * 2) * 2);
	              this._clippedUVsTyped.set(clippedUVs.subarray(0, this.clippedUVsLength));
	              clippedVertices = this._clippedVerticesTyped;
	              clippedUVs = this._clippedUVsTyped;
	            }
	            var _cv5 = clippedVertices;
	            var _cu = clippedUVs;
	            this.clippedVerticesLength = _newLength;
	            var _uvIndex = this.clippedUVsLength;
	            this.clippedUVsLength = _uvIndex + clipOutputCount * 2;
	            for (var _ii6 = 0; _ii6 < clipOutputLength; _ii6 += 2, _s3 += stride, _uvIndex += 2) {
	              var _x1 = clipOutputItems[_ii6],
	                _y1 = clipOutputItems[_ii6 + 1];
	              _cv5[_s3] = _x1;
	              _cv5[_s3 + 1] = _y1;
	              var _c4 = _x1 - _x0,
	                _c5 = _y1 - _y0,
	                _a2 = (_d6 * _c4 + _d7 * _c5) * _d0,
	                _b2 = (_d9 * _c4 + _d8 * _c5) * _d0,
	                _c6 = 1 - _a2 - _b2;
	              _cu[_uvIndex] = _u4 * _a2 + _u5 * _b2 + _u6 * _c6;
	              _cu[_uvIndex + 1] = _v5 * _a2 + _v6 * _b2 + _v7 * _c6;
	            }
	            _s3 = this.clippedTrianglesLength;
	            var _newLengthTriangles = _s3 + 3 * (clipOutputCount - 2);
	            if (clippedTriangles.length < _newLengthTriangles) {
	              this._clippedTrianglesTyped = new Uint16Array(_newLengthTriangles * 2);
	              this._clippedTrianglesTyped.set(clippedTriangles.subarray(0, _s3));
	              clippedTriangles = this._clippedTrianglesTyped;
	            }
	            this.clippedTrianglesLength = _newLengthTriangles;
	            var _ct5 = clippedTriangles;
	            clipOutputCount--;
	            for (var _ii7 = 1; _ii7 < clipOutputCount; _ii7++, _s3 += 3) {
	              _ct5[_s3] = index;
	              _ct5[_s3 + 1] = index + _ii7;
	              _ct5[_s3 + 2] = index + _ii7 + 1;
	            }
	            index += clipOutputCount + 1;
	          } else {
	            var _newLength2 = _s3 + 3 * stride;
	            if (clippedVertices.length < _newLength2) {
	              this._clippedVerticesTyped = new Float32Array(_newLength2 * 2);
	              this._clippedVerticesTyped.set(clippedVertices.subarray(0, _s3));
	              clippedVertices = this._clippedVerticesTyped;
	            }
	            clippedVertices[_s3] = _x8;
	            clippedVertices[_s3 + 1] = _y8;
	            clippedVertices[_s3 + stride] = _x9;
	            clippedVertices[_s3 + stride + 1] = _y9;
	            clippedVertices[_s3 + stride * 2] = _x0;
	            clippedVertices[_s3 + stride * 2 + 1] = _y0;
	            var uvLength = this.clippedUVsLength + 3 * 2;
	            if (clippedUVs.length < uvLength) {
	              this._clippedUVsTyped = new Float32Array(uvLength * 2);
	              this._clippedUVsTyped.set(clippedUVs.subarray(0, this.clippedUVsLength));
	              clippedUVs = this._clippedUVsTyped;
	            }
	            var _uvIndex2 = this.clippedUVsLength;
	            clippedUVs[_uvIndex2] = _u4;
	            clippedUVs[_uvIndex2 + 1] = _v5;
	            clippedUVs[_uvIndex2 + 2] = _u5;
	            clippedUVs[_uvIndex2 + 3] = _v6;
	            clippedUVs[_uvIndex2 + 4] = _u6;
	            clippedUVs[_uvIndex2 + 5] = _v7;
	            this.clippedVerticesLength = _newLength2;
	            this.clippedUVsLength = uvLength;
	            _s3 = this.clippedTrianglesLength;
	            _newLength2 = _s3 + 3;
	            if (clippedTriangles.length < _newLength2) {
	              this._clippedTrianglesTyped = new Uint16Array(_newLength2 * 2);
	              this._clippedTrianglesTyped.set(clippedTriangles.subarray(0, _s3));
	              clippedTriangles = this._clippedTrianglesTyped;
	            }
	            var _ct6 = clippedTriangles;
	            _ct6[_s3] = index;
	            _ct6[_s3 + 1] = index + 1;
	            _ct6[_s3 + 2] = index + 2;
	            index += 3;
	            this.clippedTrianglesLength = _newLength2;
	            break;
	          }
	        }
	      }
	      this.clippedVerticesTyped = this._clippedVerticesTyped.subarray(0, this.clippedVerticesLength);
	      this.clippedUVsTyped = this._clippedUVsTyped.subarray(0, this.clippedUVsLength);
	      this.clippedTrianglesTyped = this._clippedTrianglesTyped.subarray(0, this.clippedTrianglesLength);
	      return clipOutputItems !== null;
	    }
	  }, {
	    key: "clip",
	    value: function clip(x1, y1, x2, y2, x3, y3, polygon) {
	      var originalOutput = this.clipOutput;
	      var clipped = false;
	      var input, output;
	      if (polygon.length % 4 >= 2) {
	        input = this.clipOutput;
	        output = this.scratch;
	      } else {
	        input = this.scratch;
	        output = this.clipOutput;
	      }
	      var v = polygon;
	      input.length = 8;
	      var iv = input;
	      iv[0] = x1;
	      iv[1] = y1;
	      iv[2] = x2;
	      iv[3] = y2;
	      iv[4] = x3;
	      iv[5] = y3;
	      iv[6] = x1;
	      iv[7] = y1;
	      output.length = 0;
	      var last = polygon.length - 4;
	      for (var i = 0;; i += 2) {
	        var edgeX = v[i],
	          edgeY = v[i + 1],
	          ex = edgeX - v[i + 2],
	          ey = edgeY - v[i + 3];
	        var outputStart = output.length;
	        var _iv = input;
	        x1 = _iv[0];
	        y1 = _iv[1];
	        var s1 = ey * (edgeX - x1) - ex * (edgeY - y1);
	        for (var ii = 2, nn = input.length - 2; ii <= nn; ii += 2) {
	          x2 = _iv[ii];
	          y2 = _iv[ii + 1];
	          var s2 = ey * (edgeX - x2) - ex * (edgeY - y2);
	          if (s1 > 0) {
	            if (s2 > 0) output.push(x2, y2);else {
	              var ix = x2 - x1,
	                iy = y2 - y1,
	                t = s1 / (ix * ey - iy * ex);
	              if (t >= 0 && t <= 1) {
	                output.push(x1 + ix * t, y1 + iy * t);
	                clipped = true;
	              } else output.push(x2, y2);
	            }
	          } else if (s2 > 0) {
	            var _ix = x2 - x1,
	              _iy = y2 - y1,
	              _t2 = s1 / (_ix * ey - _iy * ex);
	            if (_t2 >= 0 && _t2 <= 1) {
	              output.push(x1 + _ix * _t2, y1 + _iy * _t2, x2, y2);
	              clipped = true;
	            } else output.push(x2, y2);
	          } else clipped = true;
	          x1 = x2;
	          y1 = y2;
	          s1 = s2;
	        }
	        if (outputStart === output.length) {
	          originalOutput.length = 0;
	          return true;
	        }
	        output.push(output[0], output[1]);
	        if (i === last) break;
	        var temp = output;
	        output = input;
	        output.length = 0;
	        input = temp;
	      }
	      if (originalOutput !== output) {
	        originalOutput.length = 0;
	        for (var _i4 = 0, n = output.length - 2; _i4 < n; _i4++) originalOutput[_i4] = output[_i4];
	      } else originalOutput.length = originalOutput.length - 2;
	      return clipped;
	    }
	  }, {
	    key: "clipInverse",
	    value: function clipInverse(x1, y1, x2, y2, x3, y3, polygon) {
	      this.inverseVertices.length = 0;
	      var vLast = polygon.length - 4;
	      var input, output;
	      if (polygon.length % 4 >= 2) {
	        input = this.clipOutput;
	        output = this.scratch;
	      } else {
	        input = this.scratch;
	        output = this.clipOutput;
	      }
	      input.length = 8;
	      var v = polygon,
	        iv = input;
	      iv[0] = x1;
	      iv[1] = y1;
	      iv[2] = x2;
	      iv[3] = y2;
	      iv[4] = x3;
	      iv[5] = y3;
	      iv[6] = x1;
	      iv[7] = y1;
	      output.length = 0;
	      for (var i = 0;; i += 2) {
	        var edgeX = v[i],
	          edgeY = v[i + 1],
	          ex = edgeX - v[i + 2],
	          ey = edgeY - v[i + 3];
	        var outputStart = output.length,
	          fragmentStart = this.inverseVertices.length;
	        this.inverseVertices.push(0);
	        iv = input;
	        x1 = iv[0];
	        y1 = iv[1];
	        var s1 = ey * (edgeX - x1) - ex * (edgeY - y1);
	        for (var ii = 2, nn = input.length - 2; ii <= nn; ii += 2) {
	          x2 = iv[ii];
	          y2 = iv[ii + 1];
	          var s2 = ey * (edgeX - x2) - ex * (edgeY - y2);
	          if (s1 > 0) {
	            if (s2 > 0) output.push(x2, y2);else {
	              var ix = x2 - x1,
	                iy = y2 - y1,
	                t = s1 / (ix * ey - iy * ex);
	              if (t >= 0 && t <= 1) {
	                var cx = x1 + ix * t,
	                  cy = y1 + iy * t;
	                output.push(cx, cy);
	                this.inverseVertices.push(cx, cy, x2, y2);
	              } else output.push(x2, y2);
	            }
	          } else if (s2 > 0) {
	            var _ix2 = x2 - x1,
	              _iy2 = y2 - y1,
	              _t3 = s1 / (_ix2 * ey - _iy2 * ex);
	            if (_t3 >= 0 && _t3 <= 1) {
	              var _cx = x1 + _ix2 * _t3,
	                _cy = y1 + _iy2 * _t3;
	              this.inverseVertices.push(_cx, _cy);
	              output.push(_cx, _cy, x2, y2);
	            } else output.push(x2, y2);
	          } else this.inverseVertices.push(x2, y2);
	          x1 = x2;
	          y1 = y2;
	          s1 = s2;
	        }
	        var fragmentSize = this.inverseVertices.length - fragmentStart - 1;
	        if (fragmentSize >= 6) this.inverseVertices[fragmentStart] = fragmentSize;else this.inverseVertices.length = fragmentStart;
	        if (outputStart === output.length) break;
	        output.push(output[0], output[1]);
	        if (i === vLast) break;
	        var temp = output;
	        output = input;
	        output.length = 0;
	        input = temp;
	      }
	    }
	  }, {
	    key: "makeClockwise",
	    value: function makeClockwise(polygon) {
	      var v = polygon;
	      var n = polygon.length;
	      var noCW = true,
	        noCCW = true;
	      var area = 0,
	        prevX = v[n - 2],
	        prevY = v[n - 1],
	        currX = v[0],
	        currY = v[1];
	      for (var i = 2; i < n; i += 2) {
	        var nextX = v[i],
	          nextY = v[i + 1];
	        area += currX * nextY - nextX * currY;
	        var _cross = (currX - prevX) * (nextY - currY) - (currY - prevY) * (nextX - currX);
	        noCCW = noCCW && _cross <= 0;
	        noCW = noCW && _cross >= 0;
	        prevX = currX;
	        prevY = currY;
	        currX = nextX;
	        currY = nextY;
	      }
	      area += currX * v[1] - v[0] * currY;
	      var cross = (currX - prevX) * (v[1] - currY) - (currY - prevY) * (v[0] - currX);
	      noCCW = noCCW && cross <= 0;
	      noCW = noCW && cross >= 0;
	      if (area >= 0) {
	        for (var _i5 = 0, lastX = n - 2, half = n >> 1; _i5 < half; _i5 += 2) {
	          var x = v[_i5],
	            y = v[_i5 + 1];
	          var other = lastX - _i5;
	          v[_i5] = v[other];
	          v[_i5 + 1] = v[other + 1];
	          v[other] = x;
	          v[other + 1] = y;
	        }
	        return noCW;
	      }
	      return noCCW;
	    }
	  }, {
	    key: "makeConvex",
	    value: function makeConvex(polygon) {
	      var n = polygon.length;
	      var v = polygon;
	      this.clipOutput.length = n;
	      var sorted = this.clipOutput;
	      sorted[0] = v[0];
	      sorted[1] = v[1];
	      for (var i = 2; i < n; i += 2) {
	        var x = v[i],
	          y = v[i + 1];
	        var p = i - 2;
	        for (; p >= 0 && (sorted[p] > x || sorted[p] === x && sorted[p + 1] > y); p -= 2) {
	          sorted[p + 2] = sorted[p];
	          sorted[p + 3] = sorted[p + 1];
	        }
	        sorted[p + 2] = x;
	        sorted[p + 3] = y;
	      }
	      v[0] = sorted[0];
	      v[1] = sorted[1];
	      v[2] = sorted[2];
	      v[3] = sorted[3];
	      var s = 4;
	      for (var _i6 = 4; _i6 < n; _i6 += 2, s += 2) {
	        var _x10 = sorted[_i6],
	          _y10 = sorted[_i6 + 1];
	        while ((v[s - 2] - v[s - 4]) * (_y10 - v[s - 3]) - (v[s - 1] - v[s - 3]) * (_x10 - v[s - 4]) >= 0) {
	          s -= 2;
	          if (s === 2) break;
	        }
	        v[s] = _x10;
	        v[s + 1] = _y10;
	      }
	      v[s] = sorted[n - 4];
	      v[s + 1] = sorted[n - 3];
	      var t = s;
	      s += 2;
	      for (var _i7 = n - 6; _i7 >= 0; _i7 -= 2, s += 2) {
	        var _x11 = sorted[_i7],
	          _y11 = sorted[_i7 + 1];
	        while ((v[s - 2] - v[s - 4]) * (_y11 - v[s - 3]) - (v[s - 1] - v[s - 3]) * (_x11 - v[s - 4]) >= 0) {
	          s -= 2;
	          if (s === t) break;
	        }
	        v[s] = _x11;
	        v[s + 1] = _y11;
	      }
	      polygon.length = s - 2;
	    }
	  }]);
	}();

	var SkeletonJson = function () {
	  function SkeletonJson(attachmentLoader) {
	    _classCallCheck(this, SkeletonJson);
	    _defineProperty(this, "attachmentLoader", void 0);
	    _defineProperty(this, "scale", 1);
	    _defineProperty(this, "linkedMeshes", []);
	    this.attachmentLoader = attachmentLoader;
	  }
	  return _createClass(SkeletonJson, [{
	    key: "readSkeletonData",
	    value: function readSkeletonData(json) {
	      var scale = this.scale;
	      var skeletonData = new SkeletonData();
	      var root = typeof json === "string" ? JSON.parse(json) : json;
	      var skeletonMap = root.skeleton;
	      if (skeletonMap) {
	        var _skeletonMap$images, _skeletonMap$audio;
	        skeletonData.hash = skeletonMap.hash;
	        skeletonData.version = skeletonMap.spine;
	        skeletonData.x = skeletonMap.x;
	        skeletonData.y = skeletonMap.y;
	        skeletonData.width = skeletonMap.width;
	        skeletonData.height = skeletonMap.height;
	        skeletonData.referenceScale = getValue(skeletonMap, "referenceScale", 100) * scale;
	        skeletonData.fps = skeletonMap.fps;
	        skeletonData.imagesPath = (_skeletonMap$images = skeletonMap.images) !== null && _skeletonMap$images !== void 0 ? _skeletonMap$images : null;
	        skeletonData.audioPath = (_skeletonMap$audio = skeletonMap.audio) !== null && _skeletonMap$audio !== void 0 ? _skeletonMap$audio : null;
	      }
	      if (root.bones) {
	        for (var i = 0; i < root.bones.length; i++) {
	          var boneMap = root.bones[i];
	          var parent = null;
	          var parentName = getValue(boneMap, "parent", null);
	          if (parentName) parent = skeletonData.findBone(parentName);
	          var data = new BoneData(skeletonData.bones.length, boneMap.name, parent);
	          data.length = getValue(boneMap, "length", 0) * scale;
	          var setup = data.setupPose;
	          setup.x = getValue(boneMap, "x", 0) * scale;
	          setup.y = getValue(boneMap, "y", 0) * scale;
	          setup.rotation = getValue(boneMap, "rotation", 0);
	          setup.scaleX = getValue(boneMap, "scaleX", 1);
	          setup.scaleY = getValue(boneMap, "scaleY", 1);
	          setup.shearX = getValue(boneMap, "shearX", 0);
	          setup.shearY = getValue(boneMap, "shearY", 0);
	          setup.inherit = Utils.enumValue(Inherit, getValue(boneMap, "inherit", "Normal"));
	          data.skinRequired = getValue(boneMap, "skin", false);
	          var color = getValue(boneMap, "color", null);
	          if (color) data.color.setFromString(color);
	          data.icon = getValue(boneMap, "icon", undefined);
	          data.iconSize = getValue(boneMap, "iconSize", 1);
	          data.iconRotation = getValue(boneMap, "iconRotation", 0);
	          skeletonData.bones.push(data);
	        }
	      }
	      if (root.slots) {
	        for (var _i = 0; _i < root.slots.length; _i++) {
	          var slotMap = root.slots[_i];
	          var slotName = slotMap.name;
	          var boneData = skeletonData.findBone(slotMap.bone);
	          if (!boneData) throw new Error("Couldn't find bone ".concat(slotMap.bone, " for slot ").concat(slotName));
	          var _data = new SlotData(skeletonData.slots.length, slotName, boneData);
	          var _color = getValue(slotMap, "color", null);
	          if (_color) _data.setupPose.color.setFromString(_color);
	          var dark = getValue(slotMap, "dark", null);
	          if (dark) _data.setupPose.darkColor = Color.fromString(dark);
	          _data.attachmentName = getValue(slotMap, "attachment", null);
	          _data.blendMode = Utils.enumValue(BlendMode, getValue(slotMap, "blend", "normal"));
	          _data.visible = getValue(slotMap, "visible", true);
	          skeletonData.slots.push(_data);
	        }
	      }
	      if (root.constraints) {
	        var _iterator = _createForOfIteratorHelper(root.constraints),
	          _step;
	        try {
	          for (_iterator.s(); !(_step = _iterator.n()).done;) {
	            var constraintMap = _step.value;
	            var name = constraintMap.name;
	            var skinRequired = getValue(constraintMap, "skin", false);
	            switch (getValue(constraintMap, "type", false)) {
	              case "ik":
	                {
	                  var _data2 = new IkConstraintData(name);
	                  _data2.skinRequired = skinRequired;
	                  for (var ii = 0; ii < constraintMap.bones.length; ii++) {
	                    var bone = skeletonData.findBone(constraintMap.bones[ii]);
	                    if (!bone) throw new Error("Couldn't find bone ".concat(constraintMap.bones[ii], " for IK constraint ").concat(name, "."));
	                    _data2.bones.push(bone);
	                  }
	                  var targetName = constraintMap.target;
	                  var target = skeletonData.findBone(targetName);
	                  if (!target) throw new Error("Couldn't find target bone ".concat(targetName, " for IK constraint ").concat(name, "."));
	                  _data2.target = target;
	                  var scaleY = getValue(constraintMap, "scaleY", null);
	                  if (scaleY != null) _data2.scaleYMode = Utils.enumValue(ScaleYMode, scaleY);
	                  var _setup = _data2.setupPose;
	                  _setup.mix = getValue(constraintMap, "mix", 1);
	                  _setup.softness = getValue(constraintMap, "softness", 0) * scale;
	                  _setup.bendDirection = getValue(constraintMap, "bendPositive", true) ? 1 : -1;
	                  _setup.compress = getValue(constraintMap, "compress", false);
	                  _setup.stretch = getValue(constraintMap, "stretch", false);
	                  skeletonData.constraints.push(_data2);
	                  break;
	                }
	              case "transform":
	                {
	                  var _data3 = new TransformConstraintData(name);
	                  _data3.skinRequired = skinRequired;
	                  for (var _ii = 0; _ii < constraintMap.bones.length; _ii++) {
	                    var boneName = constraintMap.bones[_ii];
	                    var _bone = skeletonData.findBone(boneName);
	                    if (!_bone) throw new Error("Couldn't find bone ".concat(boneName, " for transform constraint ").concat(constraintMap.name, "."));
	                    _data3.bones.push(_bone);
	                  }
	                  var sourceName = constraintMap.source;
	                  var source = skeletonData.findBone(sourceName);
	                  if (!source) throw new Error("Couldn't find source bone ".concat(sourceName, " for transform constraint ").concat(constraintMap.name, "."));
	                  _data3.source = source;
	                  _data3.localSource = getValue(constraintMap, "localSource", false);
	                  _data3.localTarget = getValue(constraintMap, "localTarget", false);
	                  _data3.additive = getValue(constraintMap, "additive", false);
	                  _data3.clamp = getValue(constraintMap, "clamp", false);
	                  var rotate = false,
	                    x = false,
	                    y = false,
	                    scaleX = false,
	                    _scaleY = false,
	                    shearY = false;
	                  var fromEntries = Object.entries(getValue(constraintMap, "properties", {}));
	                  for (var _i2 = 0, _fromEntries = fromEntries; _i2 < _fromEntries.length; _i2++) {
	                    var _fromEntries$_i = _slicedToArray(_fromEntries[_i2], 2),
	                      _name = _fromEntries$_i[0],
	                      fromEntry = _fromEntries$_i[1];
	                    var from = this.fromProperty(_name);
	                    var fromScale = this.propertyScale(_name, scale);
	                    from.offset = getValue(fromEntry, "offset", 0) * fromScale;
	                    var toEntries = Object.entries(getValue(fromEntry, "to", {}));
	                    for (var _i3 = 0, _toEntries = toEntries; _i3 < _toEntries.length; _i3++) {
	                      var _toEntries$_i = _slicedToArray(_toEntries[_i3], 2),
	                        _name2 = _toEntries$_i[0],
	                        toEntry = _toEntries$_i[1];
	                      var toScale = 1;
	                      var to = void 0;
	                      switch (_name2) {
	                        case "rotate":
	                          {
	                            rotate = true;
	                            to = new ToRotate();
	                            break;
	                          }
	                        case "x":
	                          {
	                            x = true;
	                            to = new ToX();
	                            toScale = scale;
	                            break;
	                          }
	                        case "y":
	                          {
	                            y = true;
	                            to = new ToY();
	                            toScale = scale;
	                            break;
	                          }
	                        case "scaleX":
	                          {
	                            scaleX = true;
	                            to = new ToScaleX();
	                            break;
	                          }
	                        case "scaleY":
	                          {
	                            _scaleY = true;
	                            to = new ToScaleY();
	                            break;
	                          }
	                        case "shearY":
	                          {
	                            shearY = true;
	                            to = new ToShearY();
	                            break;
	                          }
	                        default:
	                          throw new Error("Invalid transform constraint to property: ".concat(_name2));
	                      }
	                      to.offset = getValue(toEntry, "offset", 0) * toScale;
	                      to.max = getValue(toEntry, "max", 1) * toScale;
	                      to.scale = getValue(toEntry, "scale", 1) * toScale / fromScale;
	                      from.to.push(to);
	                    }
	                    if (from.to.length > 0) _data3.properties.push(from);
	                  }
	                  _data3.offsets[TransformConstraintData.ROTATION] = getValue(constraintMap, "rotation", 0);
	                  _data3.offsets[TransformConstraintData.X] = getValue(constraintMap, "x", 0) * scale;
	                  _data3.offsets[TransformConstraintData.Y] = getValue(constraintMap, "y", 0) * scale;
	                  _data3.offsets[TransformConstraintData.SCALEX] = getValue(constraintMap, "scaleX", 0);
	                  _data3.offsets[TransformConstraintData.SCALEY] = getValue(constraintMap, "scaleY", 0);
	                  _data3.offsets[TransformConstraintData.SHEARY] = getValue(constraintMap, "shearY", 0);
	                  var _setup2 = _data3.setupPose;
	                  if (rotate) _setup2.mixRotate = getValue(constraintMap, "mixRotate", 1);
	                  if (x) _setup2.mixX = getValue(constraintMap, "mixX", 1);
	                  if (y) _setup2.mixY = getValue(constraintMap, "mixY", _setup2.mixX);
	                  if (scaleX) _setup2.mixScaleX = getValue(constraintMap, "mixScaleX", 1);
	                  if (_scaleY) _setup2.mixScaleY = getValue(constraintMap, "mixScaleY", _setup2.mixScaleX);
	                  if (shearY) _setup2.mixShearY = getValue(constraintMap, "mixShearY", 1);
	                  skeletonData.constraints.push(_data3);
	                  break;
	                }
	              case "path":
	                {
	                  var _data4 = new PathConstraintData(name);
	                  _data4.skinRequired = skinRequired;
	                  for (var _ii2 = 0; _ii2 < constraintMap.bones.length; _ii2++) {
	                    var _boneName = constraintMap.bones[_ii2];
	                    var _bone2 = skeletonData.findBone(_boneName);
	                    if (!_bone2) throw new Error("Couldn't find bone ".concat(_boneName, " for path constraint ").concat(constraintMap.name, "."));
	                    _data4.bones.push(_bone2);
	                  }
	                  var _slotName = constraintMap.slot;
	                  var slot = skeletonData.findSlot(_slotName);
	                  if (!slot) throw new Error("Couldn't find slot ".concat(_slotName, " for path constraint ").concat(constraintMap.name, "."));
	                  _data4.slot = slot;
	                  _data4.positionMode = Utils.enumValue(PositionMode, getValue(constraintMap, "positionMode", "Percent"));
	                  _data4.spacingMode = Utils.enumValue(SpacingMode, getValue(constraintMap, "spacingMode", "Length"));
	                  _data4.rotateMode = Utils.enumValue(RotateMode, getValue(constraintMap, "rotateMode", "Tangent"));
	                  _data4.offsetRotation = getValue(constraintMap, "rotation", 0);
	                  var _setup3 = _data4.setupPose;
	                  _setup3.position = getValue(constraintMap, "position", 0);
	                  if (_data4.positionMode === PositionMode.Fixed) _setup3.position *= scale;
	                  _setup3.spacing = getValue(constraintMap, "spacing", 0);
	                  if (_data4.spacingMode === SpacingMode.Length || _data4.spacingMode === SpacingMode.Fixed) _setup3.spacing *= scale;
	                  _setup3.mixRotate = getValue(constraintMap, "mixRotate", 1);
	                  _setup3.mixX = getValue(constraintMap, "mixX", 1);
	                  _setup3.mixY = getValue(constraintMap, "mixY", _setup3.mixX);
	                  skeletonData.constraints.push(_data4);
	                  break;
	                }
	              case "physics":
	                {
	                  var _data5 = new PhysicsConstraintData(name);
	                  _data5.skinRequired = skinRequired;
	                  var _boneName2 = constraintMap.bone;
	                  var _bone3 = skeletonData.findBone(_boneName2);
	                  if (_bone3 == null) throw new Error("Physics bone not found: ".concat(_boneName2));
	                  _data5.bone = _bone3;
	                  _data5.x = getValue(constraintMap, "x", 0);
	                  _data5.y = getValue(constraintMap, "y", 0);
	                  _data5.rotate = getValue(constraintMap, "rotate", 0);
	                  _data5.scaleX = getValue(constraintMap, "scaleX", 0);
	                  var _scaleY2 = getValue(constraintMap, "scaleY", null);
	                  if (_scaleY2 != null) _data5.scaleYMode = Utils.enumValue(ScaleYMode, _scaleY2);
	                  _data5.shearX = getValue(constraintMap, "shearX", 0);
	                  _data5.limit = getValue(constraintMap, "limit", 5000) * scale;
	                  _data5.step = 1 / getValue(constraintMap, "fps", 60);
	                  var _setup4 = _data5.setupPose;
	                  _setup4.inertia = getValue(constraintMap, "inertia", 0.5);
	                  _setup4.strength = getValue(constraintMap, "strength", 100);
	                  _setup4.damping = getValue(constraintMap, "damping", 0.85);
	                  _setup4.massInverse = 1 / getValue(constraintMap, "mass", 1);
	                  _setup4.wind = getValue(constraintMap, "wind", 0);
	                  _setup4.gravity = getValue(constraintMap, "gravity", 0);
	                  _setup4.mix = getValue(constraintMap, "mix", 1);
	                  _data5.inertiaGlobal = getValue(constraintMap, "inertiaGlobal", false);
	                  _data5.strengthGlobal = getValue(constraintMap, "strengthGlobal", false);
	                  _data5.dampingGlobal = getValue(constraintMap, "dampingGlobal", false);
	                  _data5.massGlobal = getValue(constraintMap, "massGlobal", false);
	                  _data5.windGlobal = getValue(constraintMap, "windGlobal", false);
	                  _data5.gravityGlobal = getValue(constraintMap, "gravityGlobal", false);
	                  _data5.mixGlobal = getValue(constraintMap, "mixGlobal", false);
	                  skeletonData.constraints.push(_data5);
	                  break;
	                }
	              case "slider":
	                {
	                  var _data6 = new SliderData(name);
	                  _data6.skinRequired = skinRequired;
	                  _data6.additive = getValue(constraintMap, "additive", false);
	                  _data6.loop = getValue(constraintMap, "loop", false);
	                  _data6.setupPose.mix = getValue(constraintMap, "mix", 1);
	                  var _boneName3 = constraintMap.bone;
	                  if (_boneName3) {
	                    _data6.bone = skeletonData.findBone(_boneName3);
	                    if (!_data6.bone) throw new Error("Slider bone not found: ".concat(_boneName3));
	                    var property = constraintMap.property;
	                    _data6.property = this.fromProperty(property);
	                    var propertyScale = this.propertyScale(property, scale);
	                    _data6.property.offset = getValue(constraintMap, "from", 0) * propertyScale;
	                    _data6.offset = getValue(constraintMap, "to", 0);
	                    _data6.scale = getValue(constraintMap, "scale", 1) / propertyScale;
	                    _data6.max = getValue(constraintMap, "max", 0);
	                    _data6.local = getValue(constraintMap, "local", false);
	                  } else _data6.setupPose.time = getValue(constraintMap, "time", 0);
	                  skeletonData.constraints.push(_data6);
	                  break;
	                }
	            }
	          }
	        } catch (err) {
	          _iterator.e(err);
	        } finally {
	          _iterator.f();
	        }
	      }
	      if (root.skins) {
	        for (var _i4 = 0; _i4 < root.skins.length; _i4++) {
	          var skinMap = root.skins[_i4];
	          var skin = new Skin(skinMap.name);
	          if (skinMap.bones) {
	            for (var _ii3 = 0; _ii3 < skinMap.bones.length; _ii3++) {
	              var _boneName4 = skinMap.bones[_ii3];
	              var _bone4 = skeletonData.findBone(_boneName4);
	              if (!_bone4) throw new Error("Couldn't find bone ".concat(_boneName4, " for skin ").concat(skinMap.name, "."));
	              skin.bones.push(_bone4);
	            }
	          }
	          if (skinMap.ik) {
	            for (var _ii4 = 0; _ii4 < skinMap.ik.length; _ii4++) {
	              var constraintName = skinMap.ik[_ii4];
	              var constraint = skeletonData.findConstraint(constraintName, IkConstraintData);
	              if (!constraint) throw new Error("Couldn't find IK constraint ".concat(constraintName, " for skin ").concat(skinMap.name, "."));
	              skin.constraints.push(constraint);
	            }
	          }
	          if (skinMap.transform) {
	            for (var _ii5 = 0; _ii5 < skinMap.transform.length; _ii5++) {
	              var _constraintName = skinMap.transform[_ii5];
	              var _constraint = skeletonData.findConstraint(_constraintName, TransformConstraintData);
	              if (!_constraint) throw new Error("Couldn't find transform constraint ".concat(_constraintName, " for skin ").concat(skinMap.name, "."));
	              skin.constraints.push(_constraint);
	            }
	          }
	          if (skinMap.path) {
	            for (var _ii6 = 0; _ii6 < skinMap.path.length; _ii6++) {
	              var _constraintName2 = skinMap.path[_ii6];
	              var _constraint2 = skeletonData.findConstraint(_constraintName2, PathConstraintData);
	              if (!_constraint2) throw new Error("Couldn't find path constraint ".concat(_constraintName2, " for skin ").concat(skinMap.name, "."));
	              skin.constraints.push(_constraint2);
	            }
	          }
	          if (skinMap.physics) {
	            for (var _ii7 = 0; _ii7 < skinMap.physics.length; _ii7++) {
	              var _constraintName3 = skinMap.physics[_ii7];
	              var _constraint3 = skeletonData.findConstraint(_constraintName3, PhysicsConstraintData);
	              if (!_constraint3) throw new Error("Couldn't find physics constraint ".concat(_constraintName3, " for skin ").concat(skinMap.name, "."));
	              skin.constraints.push(_constraint3);
	            }
	          }
	          if (skinMap.slider) {
	            for (var _ii8 = 0; _ii8 < skinMap.slider.length; _ii8++) {
	              var _constraintName4 = skinMap.slider[_ii8];
	              var _constraint4 = skeletonData.findConstraint(_constraintName4, SliderData);
	              if (!_constraint4) throw new Error("Couldn't find slider constraint ".concat(_constraintName4, " for skin ").concat(skinMap.name, "."));
	              skin.constraints.push(_constraint4);
	            }
	          }
	          for (var _slotName2 in skinMap.attachments) {
	            var _slot = skeletonData.findSlot(_slotName2);
	            if (!_slot) throw new Error("Couldn't find skin slot ".concat(_slotName2, " for skin ").concat(skinMap.name, "."));
	            var _slotMap = skinMap.attachments[_slotName2];
	            for (var entryName in _slotMap) {
	              var attachment = this.readAttachment(_slotMap[entryName], skin, _slot.index, entryName, skeletonData);
	              if (attachment) skin.setAttachment(_slot.index, entryName, attachment);
	            }
	          }
	          skeletonData.skins.push(skin);
	          if (skin.name === "default") skeletonData.defaultSkin = skin;
	        }
	      }
	      for (var _i5 = 0, n = this.linkedMeshes.length; _i5 < n; _i5++) {
	        var linkedMesh = this.linkedMeshes[_i5];
	        var _skin = !linkedMesh.skin ? skeletonData.defaultSkin : skeletonData.findSkin(linkedMesh.skin);
	        if (!_skin) throw new Error("Skin not found: ".concat(linkedMesh.skin));
	        var _source = _skin.getAttachment(linkedMesh.sourceIndex, linkedMesh.source);
	        if (!_source) throw new Error("Source mesh not found: ".concat(linkedMesh.source));
	        linkedMesh.mesh.timelineAttachment = linkedMesh.inheritTimelines ? _source : linkedMesh.mesh;
	        linkedMesh.mesh.setSourceMesh(_source);
	        linkedMesh.mesh.updateSequence();
	        outer: if (linkedMesh.inheritTimelines && linkedMesh.slotIndex !== linkedMesh.sourceIndex) {
	          var slots = _source.timelineSlots;
	          var _iterator2 = _createForOfIteratorHelper(slots),
	            _step2;
	          try {
	            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	              var existing = _step2.value;
	              if (existing === linkedMesh.slotIndex) break outer;
	            }
	          } catch (err) {
	            _iterator2.e(err);
	          } finally {
	            _iterator2.f();
	          }
	          var newSlots = _toConsumableArray(slots);
	          newSlots[slots.length] = linkedMesh.slotIndex;
	          _source.timelineSlots = newSlots;
	        }
	      }
	      this.linkedMeshes.length = 0;
	      if (root.events) {
	        for (var eventName in root.events) {
	          var eventMap = root.events[eventName];
	          var _data7 = new EventData(eventName);
	          var _setup5 = _data7.setupPose;
	          _setup5.intValue = getValue(eventMap, "int", 0);
	          _setup5.floatValue = getValue(eventMap, "float", 0);
	          _setup5.stringValue = getValue(eventMap, "string", "");
	          _data7._audioPath = getValue(eventMap, "audio", null);
	          if (_data7.audioPath) {
	            _setup5.volume = getValue(eventMap, "volume", _setup5.volume);
	            _setup5.balance = getValue(eventMap, "balance", _setup5.balance);
	          }
	          skeletonData.events.push(_data7);
	        }
	      }
	      if (root.animations) {
	        for (var animationName in root.animations) {
	          var animationMap = root.animations[animationName];
	          this.readAnimation(animationMap, animationName, skeletonData);
	        }
	      }
	      if (root.constraints) {
	        for (var _animationName in root.constraints) {
	          var _animationMap = root.constraints[_animationName];
	          if (_animationMap.type === "slider") {
	            var _data8 = skeletonData.findConstraint(_animationMap.name, SliderData);
	            var _animationName2 = _animationMap.animation;
	            var animation = skeletonData.findAnimation(_animationName2);
	            if (!animation) throw new Error("Slider animation not found: ".concat(_animationName2));
	            _data8.animation = animation;
	          }
	        }
	      }
	      return skeletonData;
	    }
	  }, {
	    key: "fromProperty",
	    value: function fromProperty(type) {
	      var from;
	      switch (type) {
	        case "rotate":
	          from = new FromRotate();
	          break;
	        case "x":
	          from = new FromX();
	          break;
	        case "y":
	          from = new FromY();
	          break;
	        case "scaleX":
	          from = new FromScaleX();
	          break;
	        case "scaleY":
	          from = new FromScaleY();
	          break;
	        case "shearY":
	          from = new FromShearY();
	          break;
	        default:
	          throw new Error("Invalid transform constraint from property: ".concat(type));
	      }
	      return from;
	    }
	  }, {
	    key: "propertyScale",
	    value: function propertyScale(type, scale) {
	      switch (type) {
	        case "x":
	        case "y":
	          return scale;
	        default:
	          return 1;
	      }
	    }
	  }, {
	    key: "readAttachment",
	    value: function readAttachment(map, skin, slotIndex, placeholder, skeletonData) {
	      var scale = this.scale;
	      var name = getValue(map, "name", placeholder);
	      switch (getValue(map, "type", "region")) {
	        case "region":
	          {
	            var path = getValue(map, "path", name);
	            var sequence = this.readSequence(getValue(map, "sequence", null));
	            var region = this.attachmentLoader.newRegionAttachment(skin, placeholder, name, path, sequence);
	            if (!region) return null;
	            region.path = path;
	            region.x = getValue(map, "x", 0) * scale;
	            region.y = getValue(map, "y", 0) * scale;
	            region.scaleX = getValue(map, "scaleX", 1);
	            region.scaleY = getValue(map, "scaleY", 1);
	            region.rotation = getValue(map, "rotation", 0);
	            region.width = map.width * scale;
	            region.height = map.height * scale;
	            var color = getValue(map, "color", null);
	            if (color) region.color.setFromString(color);
	            region.updateSequence();
	            return region;
	          }
	        case "boundingbox":
	          {
	            var box = this.attachmentLoader.newBoundingBoxAttachment(skin, placeholder, name);
	            if (!box) return null;
	            this.readVertices(map, box, map.vertexCount << 1);
	            var _color2 = getValue(map, "color", null);
	            if (_color2) box.color.setFromString(_color2);
	            return box;
	          }
	        case "mesh":
	        case "linkedmesh":
	          {
	            var _path = getValue(map, "path", name);
	            var _sequence = this.readSequence(getValue(map, "sequence", null));
	            var mesh = this.attachmentLoader.newMeshAttachment(skin, placeholder, name, _path, _sequence);
	            if (!mesh) return null;
	            mesh.path = _path;
	            var _color3 = getValue(map, "color", null);
	            if (_color3) mesh.color.setFromString(_color3);
	            mesh.width = getValue(map, "width", 0) * scale;
	            mesh.height = getValue(map, "height", 0) * scale;
	            var source = getValue(map, "source", null);
	            if (source) {
	              var sourceIndex = slotIndex;
	              var slot = getValue(map, "slot", null);
	              if (slot) {
	                var sourceSlot = skeletonData.findSlot(slot);
	                if (!sourceSlot) throw new Error("Source mesh slot not found: ".concat(slot));
	                sourceIndex = sourceSlot.index;
	              }
	              this.linkedMeshes.push(new LinkedMesh(mesh, getValue(map, "skin", null), slotIndex, sourceIndex, source, getValue(map, "timelines", true)));
	              return mesh;
	            }
	            var uvs = map.uvs;
	            this.readVertices(map, mesh, uvs.length);
	            mesh.triangles = map.triangles;
	            mesh.regionUVs = uvs;
	            mesh.edges = getValue(map, "edges", null);
	            mesh.hullLength = getValue(map, "hull", 0) * 2;
	            mesh.updateSequence();
	            return mesh;
	          }
	        case "path":
	          {
	            var _path2 = this.attachmentLoader.newPathAttachment(skin, placeholder, name);
	            if (!_path2) return null;
	            _path2.closed = getValue(map, "closed", false);
	            _path2.constantSpeed = getValue(map, "constantSpeed", true);
	            var vertexCount = map.vertexCount;
	            this.readVertices(map, _path2, vertexCount << 1);
	            var lengths = Utils.newArray(vertexCount / 3, 0);
	            for (var i = 0; i < map.lengths.length; i++) lengths[i] = map.lengths[i] * scale;
	            _path2.lengths = lengths;
	            var _color4 = getValue(map, "color", null);
	            if (_color4) _path2.color.setFromString(_color4);
	            return _path2;
	          }
	        case "point":
	          {
	            var point = this.attachmentLoader.newPointAttachment(skin, placeholder, name);
	            if (!point) return null;
	            point.x = getValue(map, "x", 0) * scale;
	            point.y = getValue(map, "y", 0) * scale;
	            point.rotation = getValue(map, "rotation", 0);
	            var _color5 = getValue(map, "color", null);
	            if (_color5) point.color.setFromString(_color5);
	            return point;
	          }
	        case "clipping":
	          {
	            var clip = this.attachmentLoader.newClippingAttachment(skin, placeholder, name);
	            if (!clip) return null;
	            var end = getValue(map, "end", null);
	            if (end) clip.endSlot = skeletonData.findSlot(end);
	            clip.convex = getValue(map, "convex", false);
	            clip.inverse = getValue(map, "inverse", false);
	            var _vertexCount = map.vertexCount;
	            this.readVertices(map, clip, _vertexCount << 1);
	            var _color6 = getValue(map, "color", null);
	            if (_color6) clip.color.setFromString(_color6);
	            return clip;
	          }
	      }
	      return null;
	    }
	  }, {
	    key: "readSequence",
	    value: function readSequence(map) {
	      if (map == null) return new Sequence(1, false);
	      var sequence = new Sequence(getValue(map, "count", 0), true);
	      sequence.start = getValue(map, "start", 1);
	      sequence.digits = getValue(map, "digits", 0);
	      sequence.setupIndex = getValue(map, "setup", 0);
	      return sequence;
	    }
	  }, {
	    key: "readVertices",
	    value: function readVertices(map, attachment, verticesLength) {
	      var scale = this.scale;
	      attachment.worldVerticesLength = verticesLength;
	      var vertices = map.vertices;
	      if (verticesLength === vertices.length) {
	        var scaledVertices = Utils.toFloatArray(vertices);
	        if (scale !== 1) {
	          for (var i = 0, n = vertices.length; i < n; i++) scaledVertices[i] *= scale;
	        }
	        attachment.vertices = scaledVertices;
	        return;
	      }
	      var weights = [];
	      var bones = [];
	      for (var _i6 = 0, _n = vertices.length; _i6 < _n;) {
	        var boneCount = vertices[_i6++];
	        bones.push(boneCount);
	        for (var nn = _i6 + boneCount * 4; _i6 < nn; _i6 += 4) {
	          bones.push(vertices[_i6]);
	          weights.push(vertices[_i6 + 1] * scale);
	          weights.push(vertices[_i6 + 2] * scale);
	          weights.push(vertices[_i6 + 3]);
	        }
	      }
	      attachment.bones = bones;
	      attachment.vertices = Utils.toFloatArray(weights);
	    }
	  }, {
	    key: "readAnimation",
	    value: function readAnimation(map, name, skeletonData) {
	      var scale = this.scale;
	      var timelines = [];
	      if (map.slots) {
	        for (var slotName in map.slots) {
	          var slotMap = map.slots[slotName];
	          var slot = skeletonData.findSlot(slotName);
	          if (!slot) throw new Error("Slot not found: ".concat(slotName));
	          var slotIndex = slot.index;
	          for (var timelineName in slotMap) {
	            var timelineMap = slotMap[timelineName];
	            if (!timelineMap) continue;
	            var frames = timelineMap.length;
	            switch (timelineName) {
	              case "attachment":
	                {
	                  var timeline = new AttachmentTimeline(frames, slotIndex);
	                  for (var frame = 0; frame < frames; frame++) {
	                    var keyMap = timelineMap[frame];
	                    timeline.setFrame(frame, getValue(keyMap, "time", 0), getValue(keyMap, "name", null));
	                  }
	                  timelines.push(timeline);
	                  break;
	                }
	              case "rgba":
	                {
	                  var _timeline = new RGBATimeline(frames, frames << 2, slotIndex);
	                  var _keyMap = timelineMap[0];
	                  var time = getValue(_keyMap, "time", 0);
	                  var _color7 = Color.fromString(_keyMap.color);
	                  for (var _frame = 0, bezier = 0;; _frame++) {
	                    _timeline.setFrame(_frame, time, _color7.r, _color7.g, _color7.b, _color7.a);
	                    var nextMap = timelineMap[_frame + 1];
	                    if (!nextMap) {
	                      _timeline.shrink(bezier);
	                      break;
	                    }
	                    var time2 = getValue(nextMap, "time", 0);
	                    var newColor = Color.fromString(nextMap.color);
	                    var curve = _keyMap.curve;
	                    if (curve) {
	                      bezier = readCurve(curve, _timeline, bezier, _frame, 0, time, time2, _color7.r, newColor.r, 1);
	                      bezier = readCurve(curve, _timeline, bezier, _frame, 1, time, time2, _color7.g, newColor.g, 1);
	                      bezier = readCurve(curve, _timeline, bezier, _frame, 2, time, time2, _color7.b, newColor.b, 1);
	                      bezier = readCurve(curve, _timeline, bezier, _frame, 3, time, time2, _color7.a, newColor.a, 1);
	                    }
	                    time = time2;
	                    _color7 = newColor;
	                    _keyMap = nextMap;
	                  }
	                  timelines.push(_timeline);
	                  break;
	                }
	              case "rgb":
	                {
	                  var _timeline2 = new RGBTimeline(frames, frames * 3, slotIndex);
	                  var _keyMap2 = timelineMap[0];
	                  var _time = getValue(_keyMap2, "time", 0);
	                  var _color8 = Color.fromString(_keyMap2.color);
	                  for (var _frame2 = 0, _bezier = 0;; _frame2++) {
	                    _timeline2.setFrame(_frame2, _time, _color8.r, _color8.g, _color8.b);
	                    var _nextMap = timelineMap[_frame2 + 1];
	                    if (!_nextMap) {
	                      _timeline2.shrink(_bezier);
	                      break;
	                    }
	                    var _time2 = getValue(_nextMap, "time", 0);
	                    var _newColor = Color.fromString(_nextMap.color);
	                    var _curve = _keyMap2.curve;
	                    if (_curve) {
	                      _bezier = readCurve(_curve, _timeline2, _bezier, _frame2, 0, _time, _time2, _color8.r, _newColor.r, 1);
	                      _bezier = readCurve(_curve, _timeline2, _bezier, _frame2, 1, _time, _time2, _color8.g, _newColor.g, 1);
	                      _bezier = readCurve(_curve, _timeline2, _bezier, _frame2, 2, _time, _time2, _color8.b, _newColor.b, 1);
	                    }
	                    _time = _time2;
	                    _color8 = _newColor;
	                    _keyMap2 = _nextMap;
	                  }
	                  timelines.push(_timeline2);
	                  break;
	                }
	              case "alpha":
	                {
	                  readTimeline1(timelines, timelineMap, new AlphaTimeline(frames, frames, slotIndex), 0, 1);
	                  break;
	                }
	              case "rgba2":
	                {
	                  var _timeline3 = new RGBA2Timeline(frames, frames * 7, slotIndex);
	                  var _keyMap3 = timelineMap[0];
	                  var _time3 = getValue(_keyMap3, "time", 0);
	                  var _color9 = Color.fromString(_keyMap3.light);
	                  var color2 = Color.fromString(_keyMap3.dark);
	                  for (var _frame3 = 0, _bezier2 = 0;; _frame3++) {
	                    _timeline3.setFrame(_frame3, _time3, _color9.r, _color9.g, _color9.b, _color9.a, color2.r, color2.g, color2.b);
	                    var _nextMap2 = timelineMap[_frame3 + 1];
	                    if (!_nextMap2) {
	                      _timeline3.shrink(_bezier2);
	                      break;
	                    }
	                    var _time4 = getValue(_nextMap2, "time", 0);
	                    var _newColor2 = Color.fromString(_nextMap2.light);
	                    var newColor2 = Color.fromString(_nextMap2.dark);
	                    var _curve2 = _keyMap3.curve;
	                    if (_curve2) {
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 0, _time3, _time4, _color9.r, _newColor2.r, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 1, _time3, _time4, _color9.g, _newColor2.g, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 2, _time3, _time4, _color9.b, _newColor2.b, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 3, _time3, _time4, _color9.a, _newColor2.a, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 4, _time3, _time4, color2.r, newColor2.r, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 5, _time3, _time4, color2.g, newColor2.g, 1);
	                      _bezier2 = readCurve(_curve2, _timeline3, _bezier2, _frame3, 6, _time3, _time4, color2.b, newColor2.b, 1);
	                    }
	                    _time3 = _time4;
	                    _color9 = _newColor2;
	                    color2 = newColor2;
	                    _keyMap3 = _nextMap2;
	                  }
	                  timelines.push(_timeline3);
	                  break;
	                }
	              case "rgb2":
	                {
	                  var _timeline4 = new RGB2Timeline(frames, frames * 6, slotIndex);
	                  var _keyMap4 = timelineMap[0];
	                  var _time5 = getValue(_keyMap4, "time", 0);
	                  var _color0 = Color.fromString(_keyMap4.light);
	                  var _color1 = Color.fromString(_keyMap4.dark);
	                  for (var _frame4 = 0, _bezier3 = 0;; _frame4++) {
	                    _timeline4.setFrame(_frame4, _time5, _color0.r, _color0.g, _color0.b, _color1.r, _color1.g, _color1.b);
	                    var _nextMap3 = timelineMap[_frame4 + 1];
	                    if (!_nextMap3) {
	                      _timeline4.shrink(_bezier3);
	                      break;
	                    }
	                    var _time6 = getValue(_nextMap3, "time", 0);
	                    var _newColor3 = Color.fromString(_nextMap3.light);
	                    var _newColor4 = Color.fromString(_nextMap3.dark);
	                    var _curve3 = _keyMap4.curve;
	                    if (_curve3) {
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 0, _time5, _time6, _color0.r, _newColor3.r, 1);
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 1, _time5, _time6, _color0.g, _newColor3.g, 1);
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 2, _time5, _time6, _color0.b, _newColor3.b, 1);
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 3, _time5, _time6, _color1.r, _newColor4.r, 1);
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 4, _time5, _time6, _color1.g, _newColor4.g, 1);
	                      _bezier3 = readCurve(_curve3, _timeline4, _bezier3, _frame4, 5, _time5, _time6, _color1.b, _newColor4.b, 1);
	                    }
	                    _time5 = _time6;
	                    _color0 = _newColor3;
	                    _color1 = _newColor4;
	                    _keyMap4 = _nextMap3;
	                  }
	                  timelines.push(_timeline4);
	                  break;
	                }
	              default:
	                throw new Error("Invalid timeline type for a slot: ".concat(timelineMap.name, " (").concat(slotMap.name, ")"));
	            }
	          }
	        }
	      }
	      if (map.bones) {
	        for (var boneName in map.bones) {
	          var boneMap = map.bones[boneName];
	          var bone = skeletonData.findBone(boneName);
	          if (!bone) throw new Error("Bone not found: ".concat(boneName));
	          var boneIndex = bone.index;
	          for (var _timelineName in boneMap) {
	            var _timelineMap = boneMap[_timelineName];
	            var _frames = _timelineMap.length;
	            if (_frames === 0) continue;
	            switch (_timelineName) {
	              case "rotate":
	                readTimeline1(timelines, _timelineMap, new RotateTimeline(_frames, _frames, boneIndex), 0, 1);
	                break;
	              case "translate":
	                readTimeline2(timelines, _timelineMap, new TranslateTimeline(_frames, _frames << 1, boneIndex), "x", "y", 0, scale);
	                break;
	              case "translatex":
	                readTimeline1(timelines, _timelineMap, new TranslateXTimeline(_frames, _frames, boneIndex), 0, scale);
	                break;
	              case "translatey":
	                readTimeline1(timelines, _timelineMap, new TranslateYTimeline(_frames, _frames, boneIndex), 0, scale);
	                break;
	              case "scale":
	                readTimeline2(timelines, _timelineMap, new ScaleTimeline(_frames, _frames << 1, boneIndex), "x", "y", 1, 1);
	                break;
	              case "scalex":
	                readTimeline1(timelines, _timelineMap, new ScaleXTimeline(_frames, _frames, boneIndex), 1, 1);
	                break;
	              case "scaley":
	                readTimeline1(timelines, _timelineMap, new ScaleYTimeline(_frames, _frames, boneIndex), 1, 1);
	                break;
	              case "shear":
	                readTimeline2(timelines, _timelineMap, new ShearTimeline(_frames, _frames << 1, boneIndex), "x", "y", 0, 1);
	                break;
	              case "shearx":
	                readTimeline1(timelines, _timelineMap, new ShearXTimeline(_frames, _frames, boneIndex), 0, 1);
	                break;
	              case "sheary":
	                readTimeline1(timelines, _timelineMap, new ShearYTimeline(_frames, _frames, boneIndex), 0, 1);
	                break;
	              case "inherit":
	                {
	                  var _timeline5 = new InheritTimeline(_frames, bone.index);
	                  for (var _frame5 = 0; _frame5 < _timelineMap.length; _frame5++) {
	                    var aFrame = _timelineMap[_frame5];
	                    _timeline5.setFrame(_frame5, getValue(aFrame, "time", 0), Utils.enumValue(Inherit, getValue(aFrame, "inherit", "Normal")));
	                  }
	                  timelines.push(_timeline5);
	                  break;
	                }
	              default:
	                throw new Error("Invalid timeline type for a bone: ".concat(_timelineMap.name, " (").concat(boneMap.name, ")"));
	            }
	          }
	        }
	      }
	      if (map.ik) {
	        for (var constraintName in map.ik) {
	          var constraintMap = map.ik[constraintName];
	          var _keyMap5 = constraintMap[0];
	          if (!_keyMap5) continue;
	          var constraint = skeletonData.findConstraint(constraintName, IkConstraintData);
	          if (!constraint) throw new Error("IK Constraint not found: ".concat(constraintName));
	          var _timeline6 = new IkConstraintTimeline(constraintMap.length, constraintMap.length << 1, skeletonData.constraints.indexOf(constraint));
	          var _time7 = getValue(_keyMap5, "time", 0);
	          var mix = getValue(_keyMap5, "mix", 1);
	          var softness = getValue(_keyMap5, "softness", 0) * scale;
	          for (var _frame6 = 0, _bezier4 = 0;; _frame6++) {
	            _timeline6.setFrame(_frame6, _time7, mix, softness, getValue(_keyMap5, "bendPositive", true) ? 1 : -1, getValue(_keyMap5, "compress", false), getValue(_keyMap5, "stretch", false));
	            var _nextMap4 = constraintMap[_frame6 + 1];
	            if (!_nextMap4) {
	              _timeline6.shrink(_bezier4);
	              break;
	            }
	            var _time8 = getValue(_nextMap4, "time", 0);
	            var mix2 = getValue(_nextMap4, "mix", 1);
	            var softness2 = getValue(_nextMap4, "softness", 0) * scale;
	            var _curve4 = _keyMap5.curve;
	            if (_curve4) {
	              _bezier4 = readCurve(_curve4, _timeline6, _bezier4, _frame6, 0, _time7, _time8, mix, mix2, 1);
	              _bezier4 = readCurve(_curve4, _timeline6, _bezier4, _frame6, 1, _time7, _time8, softness, softness2, scale);
	            }
	            _time7 = _time8;
	            mix = mix2;
	            softness = softness2;
	            _keyMap5 = _nextMap4;
	          }
	          timelines.push(_timeline6);
	        }
	      }
	      if (map.transform) {
	        for (var _constraintName5 in map.transform) {
	          var _timelineMap2 = map.transform[_constraintName5];
	          var _keyMap6 = _timelineMap2[0];
	          if (!_keyMap6) continue;
	          var _constraint5 = skeletonData.findConstraint(_constraintName5, TransformConstraintData);
	          if (!_constraint5) throw new Error("Transform constraint not found: ".concat(_constraintName5));
	          var _timeline7 = new TransformConstraintTimeline(_timelineMap2.length, _timelineMap2.length * 6, skeletonData.constraints.indexOf(_constraint5));
	          var _time9 = getValue(_keyMap6, "time", 0);
	          var mixRotate = getValue(_keyMap6, "mixRotate", 1);
	          var mixX = getValue(_keyMap6, "mixX", 1),
	            mixY = getValue(_keyMap6, "mixY", mixX);
	          var mixScaleX = getValue(_keyMap6, "mixScaleX", 1),
	            mixScaleY = getValue(_keyMap6, "mixScaleY", 1);
	          var mixShearY = getValue(_keyMap6, "mixShearY", 1);
	          for (var _frame7 = 0, _bezier5 = 0;; _frame7++) {
	            _timeline7.setFrame(_frame7, _time9, mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY);
	            var _nextMap5 = _timelineMap2[_frame7 + 1];
	            if (!_nextMap5) {
	              _timeline7.shrink(_bezier5);
	              break;
	            }
	            var _time0 = getValue(_nextMap5, "time", 0);
	            var mixRotate2 = getValue(_nextMap5, "mixRotate", 1);
	            var mixX2 = getValue(_nextMap5, "mixX", 1),
	              mixY2 = getValue(_nextMap5, "mixY", mixX2);
	            var mixScaleX2 = getValue(_nextMap5, "mixScaleX", 1),
	              mixScaleY2 = getValue(_nextMap5, "mixScaleY", 1);
	            var mixShearY2 = getValue(_nextMap5, "mixShearY", 1);
	            var _curve5 = _keyMap6.curve;
	            if (_curve5) {
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 0, _time9, _time0, mixRotate, mixRotate2, 1);
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 1, _time9, _time0, mixX, mixX2, 1);
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 2, _time9, _time0, mixY, mixY2, 1);
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 3, _time9, _time0, mixScaleX, mixScaleX2, 1);
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 4, _time9, _time0, mixScaleY, mixScaleY2, 1);
	              _bezier5 = readCurve(_curve5, _timeline7, _bezier5, _frame7, 5, _time9, _time0, mixShearY, mixShearY2, 1);
	            }
	            _time9 = _time0;
	            mixRotate = mixRotate2;
	            mixX = mixX2;
	            mixY = mixY2;
	            mixScaleX = mixScaleX2;
	            mixScaleY = mixScaleY2;
	            mixShearY = mixShearY2;
	            _keyMap6 = _nextMap5;
	          }
	          timelines.push(_timeline7);
	        }
	      }
	      if (map.path) {
	        for (var _constraintName6 in map.path) {
	          var _constraintMap = map.path[_constraintName6];
	          var _constraint6 = skeletonData.findConstraint(_constraintName6, PathConstraintData);
	          if (!_constraint6) throw new Error("Path constraint not found: ".concat(_constraintName6));
	          var index = skeletonData.constraints.indexOf(_constraint6);
	          for (var _timelineName2 in _constraintMap) {
	            var _timelineMap3 = _constraintMap[_timelineName2];
	            var _keyMap7 = _timelineMap3[0];
	            if (!_keyMap7) continue;
	            var _frames2 = _timelineMap3.length;
	            switch (_timelineName2) {
	              case "position":
	                {
	                  var _timeline8 = new PathConstraintPositionTimeline(_frames2, _frames2, index);
	                  readTimeline1(timelines, _timelineMap3, _timeline8, 0, _constraint6.positionMode === PositionMode.Fixed ? scale : 1);
	                  break;
	                }
	              case "spacing":
	                {
	                  var _timeline9 = new PathConstraintSpacingTimeline(_frames2, _frames2, index);
	                  readTimeline1(timelines, _timelineMap3, _timeline9, 0, _constraint6.spacingMode === SpacingMode.Length || _constraint6.spacingMode === SpacingMode.Fixed ? scale : 1);
	                  break;
	                }
	              case "mix":
	                {
	                  var _timeline0 = new PathConstraintMixTimeline(_frames2, _frames2 * 3, index);
	                  var _time1 = getValue(_keyMap7, "time", 0);
	                  var _mixRotate = getValue(_keyMap7, "mixRotate", 1);
	                  var _mixX = getValue(_keyMap7, "mixX", 1);
	                  var _mixY = getValue(_keyMap7, "mixY", _mixX);
	                  for (var _frame8 = 0, _bezier6 = 0;; _frame8++) {
	                    _timeline0.setFrame(_frame8, _time1, _mixRotate, _mixX, _mixY);
	                    var _nextMap6 = _timelineMap3[_frame8 + 1];
	                    if (!_nextMap6) {
	                      _timeline0.shrink(_bezier6);
	                      break;
	                    }
	                    var _time10 = getValue(_nextMap6, "time", 0);
	                    var _mixRotate2 = getValue(_nextMap6, "mixRotate", 1);
	                    var _mixX2 = getValue(_nextMap6, "mixX", 1);
	                    var _mixY2 = getValue(_nextMap6, "mixY", _mixX2);
	                    var _curve6 = _keyMap7.curve;
	                    if (_curve6) {
	                      _bezier6 = readCurve(_curve6, _timeline0, _bezier6, _frame8, 0, _time1, _time10, _mixRotate, _mixRotate2, 1);
	                      _bezier6 = readCurve(_curve6, _timeline0, _bezier6, _frame8, 1, _time1, _time10, _mixX, _mixX2, 1);
	                      _bezier6 = readCurve(_curve6, _timeline0, _bezier6, _frame8, 2, _time1, _time10, _mixY, _mixY2, 1);
	                    }
	                    _time1 = _time10;
	                    _mixRotate = _mixRotate2;
	                    _mixX = _mixX2;
	                    _mixY = _mixY2;
	                    _keyMap7 = _nextMap6;
	                  }
	                  timelines.push(_timeline0);
	                  break;
	                }
	            }
	          }
	        }
	      }
	      if (map.physics) {
	        for (var _constraintName7 in map.physics) {
	          var _constraintMap2 = map.physics[_constraintName7];
	          var _index = -1;
	          if (_constraintName7.length > 0) {
	            var _constraint7 = skeletonData.findConstraint(_constraintName7, PhysicsConstraintData);
	            if (!_constraint7) throw new Error("Physics constraint not found: ".concat(_constraintName7));
	            _index = skeletonData.constraints.indexOf(_constraint7);
	          }
	          for (var _timelineName3 in _constraintMap2) {
	            var _timelineMap4 = _constraintMap2[_timelineName3];
	            var _keyMap8 = _timelineMap4[0];
	            if (!_keyMap8) continue;
	            var _frames3 = _timelineMap4.length;
	            var _timeline1 = void 0;
	            var defaultValue = 0;
	            if (_timelineName3 === "reset") {
	              var resetTimeline = new PhysicsConstraintResetTimeline(_frames3, _index);
	              for (var _frame9 = 0; _keyMap8 != null; _keyMap8 = _timelineMap4[_frame9 + 1], _frame9++) resetTimeline.setFrame(_frame9, getValue(_keyMap8, "time", 0));
	              timelines.push(resetTimeline);
	              continue;
	            }
	            switch (_timelineName3) {
	              case "inertia":
	                _timeline1 = new PhysicsConstraintInertiaTimeline(_frames3, _frames3, _index);
	                break;
	              case "strength":
	                _timeline1 = new PhysicsConstraintStrengthTimeline(_frames3, _frames3, _index);
	                break;
	              case "damping":
	                _timeline1 = new PhysicsConstraintDampingTimeline(_frames3, _frames3, _index);
	                break;
	              case "mass":
	                _timeline1 = new PhysicsConstraintMassTimeline(_frames3, _frames3, _index);
	                break;
	              case "wind":
	                _timeline1 = new PhysicsConstraintWindTimeline(_frames3, _frames3, _index);
	                break;
	              case "gravity":
	                _timeline1 = new PhysicsConstraintGravityTimeline(_frames3, _frames3, _index);
	                break;
	              case "mix":
	                {
	                  defaultValue = 1;
	                  _timeline1 = new PhysicsConstraintMixTimeline(_frames3, _frames3, _index);
	                  break;
	                }
	              default:
	                continue;
	            }
	            readTimeline1(timelines, _timelineMap4, _timeline1, defaultValue, 1);
	          }
	        }
	      }
	      if (map.slider) {
	        for (var _constraintName8 in map.slider) {
	          var _constraintMap3 = map.slider[_constraintName8];
	          var _constraint8 = skeletonData.findConstraint(_constraintName8, SliderData);
	          if (!_constraint8) throw new Error("Slider not found: ".concat(_constraintName8));
	          var _index2 = skeletonData.constraints.indexOf(_constraint8);
	          for (var _timelineName4 in _constraintMap3) {
	            var _timelineMap5 = _constraintMap3[_timelineName4];
	            var _keyMap9 = _timelineMap5[0];
	            if (!_keyMap9) continue;
	            var _frames4 = _timelineMap5.length;
	            switch (_timelineName4) {
	              case "time":
	                readTimeline1(timelines, _timelineMap5, new SliderTimeline(_frames4, _frames4, _index2), 1, 1);
	                break;
	              case "mix":
	                readTimeline1(timelines, _timelineMap5, new SliderMixTimeline(_frames4, _frames4, _index2), 1, 1);
	                break;
	            }
	          }
	        }
	      }
	      if (map.attachments) {
	        for (var attachmentsName in map.attachments) {
	          var attachmentsMap = map.attachments[attachmentsName];
	          var skin = skeletonData.findSkin(attachmentsName);
	          if (!skin) throw new Error("Skin not found: ".concat(attachmentsName));
	          for (var slotMapName in attachmentsMap) {
	            var _slotMap2 = attachmentsMap[slotMapName];
	            var _slot2 = skeletonData.findSlot(slotMapName);
	            if (!_slot2) throw new Error("Attachment slot not found: ".concat(slotMapName));
	            var _slotIndex = _slot2.index;
	            for (var attachmentMapName in _slotMap2) {
	              var attachmentMap = _slotMap2[attachmentMapName];
	              var attachment = skin.getAttachment(_slotIndex, attachmentMapName);
	              if (!attachment) throw new Error("Timeline attachment not found: ".concat(attachmentMapName));
	              for (var timelineMapName in attachmentMap) {
	                var _timelineMap6 = attachmentMap[timelineMapName];
	                var _keyMap0 = _timelineMap6[0];
	                if (!_keyMap0) continue;
	                if (timelineMapName === "deform") {
	                  var weighted = attachment.bones;
	                  var vertices = attachment.vertices;
	                  var deformLength = weighted ? vertices.length / 3 * 2 : vertices.length;
	                  var _timeline10 = new DeformTimeline(_timelineMap6.length, _timelineMap6.length, _slotIndex, attachment);
	                  var _time11 = getValue(_keyMap0, "time", 0);
	                  for (var _frame0 = 0, _bezier7 = 0;; _frame0++) {
	                    var deform = void 0;
	                    var verticesValue = getValue(_keyMap0, "vertices", null);
	                    if (!verticesValue) deform = weighted ? Utils.newFloatArray(deformLength) : vertices;else {
	                      deform = Utils.newFloatArray(deformLength);
	                      var start = getValue(_keyMap0, "offset", 0);
	                      Utils.arrayCopy(verticesValue, 0, deform, start, verticesValue.length);
	                      if (scale !== 1) {
	                        for (var i = start, n = i + verticesValue.length; i < n; i++) deform[i] *= scale;
	                      }
	                      if (!weighted) {
	                        for (var _i7 = 0; _i7 < deformLength; _i7++) deform[_i7] += vertices[_i7];
	                      }
	                    }
	                    _timeline10.setFrame(_frame0, _time11, deform);
	                    var _nextMap7 = _timelineMap6[_frame0 + 1];
	                    if (!_nextMap7) {
	                      _timeline10.shrink(_bezier7);
	                      break;
	                    }
	                    var _time12 = getValue(_nextMap7, "time", 0);
	                    var _curve7 = _keyMap0.curve;
	                    if (_curve7) _bezier7 = readCurve(_curve7, _timeline10, _bezier7, _frame0, 0, _time11, _time12, 0, 1, 1);
	                    _time11 = _time12;
	                    _keyMap0 = _nextMap7;
	                  }
	                  timelines.push(_timeline10);
	                } else if (timelineMapName === "sequence") {
	                  var _timeline11 = new SequenceTimeline(_timelineMap6.length, _slotIndex, attachment);
	                  var lastDelay = 0;
	                  for (var _frame1 = 0; _frame1 < _timelineMap6.length; _frame1++) {
	                    var delay = getValue(_keyMap0, "delay", lastDelay);
	                    var _time13 = getValue(_keyMap0, "time", 0);
	                    var mode = SequenceMode[getValue(_keyMap0, "mode", "hold")];
	                    var _index3 = getValue(_keyMap0, "index", 0);
	                    _timeline11.setFrame(_frame1, _time13, mode, _index3, delay);
	                    lastDelay = delay;
	                    _keyMap0 = _timelineMap6[_frame1 + 1];
	                  }
	                  timelines.push(_timeline11);
	                }
	              }
	            }
	          }
	        }
	      }
	      if (map.drawOrder) {
	        var _timeline12 = new DrawOrderTimeline(map.drawOrder.length);
	        var slotCount = skeletonData.slots.length;
	        var _frame10 = 0;
	        var _iterator3 = _createForOfIteratorHelper(map.drawOrder),
	          _step3;
	        try {
	          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	            var drawOrderMap = _step3.value;
	            _timeline12.setFrame(_frame10++, getValue(drawOrderMap, "time", 0), readDrawOrder(skeletonData, drawOrderMap, slotCount, null));
	          }
	        } catch (err) {
	          _iterator3.e(err);
	        } finally {
	          _iterator3.f();
	        }
	        timelines.push(_timeline12);
	      }
	      if (map.drawOrderFolder) {
	        var _iterator4 = _createForOfIteratorHelper(map.drawOrderFolder),
	          _step4;
	        try {
	          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	            var _timelineMap7 = _step4.value;
	            var slotEntries = getValue(_timelineMap7, "slots", []);
	            var folderSlots = new Array(slotEntries.length);
	            var ii = 0;
	            var _iterator5 = _createForOfIteratorHelper(slotEntries),
	              _step5;
	            try {
	              for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
	                var slotEntry = _step5.value;
	                var _slot3 = skeletonData.findSlot(slotEntry);
	                if (!_slot3) throw new Error("Draw order folder slot not found: ".concat(slotEntry));
	                folderSlots[ii++] = _slot3.index;
	              }
	            } catch (err) {
	              _iterator5.e(err);
	            } finally {
	              _iterator5.f();
	            }
	            var drawOrderFolderEntries = getValue(_timelineMap7, "keys", []);
	            var _timeline13 = new DrawOrderFolderTimeline(drawOrderFolderEntries.length, folderSlots, skeletonData.slots.length);
	            var _frame11 = 0;
	            var _iterator6 = _createForOfIteratorHelper(drawOrderFolderEntries),
	              _step6;
	            try {
	              for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
	                var drawOrderFolderMap = _step6.value;
	                _timeline13.setFrame(_frame11++, getValue(drawOrderFolderMap, "time", 0), readDrawOrder(skeletonData, drawOrderFolderMap, folderSlots.length, folderSlots));
	              }
	            } catch (err) {
	              _iterator6.e(err);
	            } finally {
	              _iterator6.f();
	            }
	            timelines.push(_timeline13);
	          }
	        } catch (err) {
	          _iterator4.e(err);
	        } finally {
	          _iterator4.f();
	        }
	      }
	      if (map.events) {
	        var _timeline14 = new EventTimeline(map.events.length);
	        var _frame12 = 0;
	        for (var _i8 = 0; _i8 < map.events.length; _i8++, _frame12++) {
	          var eventMap = map.events[_i8];
	          var data = skeletonData.findEvent(eventMap.name);
	          if (!data) throw new Error("Event not found: ".concat(eventMap.name));
	          var setup = data.setupPose;
	          var event = new Event(Utils.toSinglePrecision(getValue(eventMap, "time", 0)), data);
	          event.intValue = getValue(eventMap, "int", setup.intValue);
	          event.floatValue = getValue(eventMap, "float", setup.floatValue);
	          event.stringValue = getValue(eventMap, "string", setup.stringValue);
	          if (event.data.audioPath) {
	            event.volume = getValue(eventMap, "volume", setup.volume);
	            event.balance = getValue(eventMap, "balance", setup.volume);
	          }
	          _timeline14.setFrame(_frame12, event);
	        }
	        timelines.push(_timeline14);
	      }
	      var duration = 0;
	      for (var _i9 = 0, _n2 = timelines.length; _i9 < _n2; _i9++) duration = Math.max(duration, timelines[_i9].getDuration());
	      var animation = new Animation(name, timelines, duration);
	      var color = getValue(map, "color", null);
	      if (color !== null) animation.color.setFromString(color);
	      skeletonData.animations.push(animation);
	    }
	  }]);
	}();
	var LinkedMesh = _createClass(function LinkedMesh(mesh, skin, slotIndex, sourceIndex, source, inheritTimelines) {
	  _classCallCheck(this, LinkedMesh);
	  _defineProperty(this, "source", void 0);
	  _defineProperty(this, "skin", void 0);
	  _defineProperty(this, "slotIndex", void 0);
	  _defineProperty(this, "sourceIndex", void 0);
	  _defineProperty(this, "mesh", void 0);
	  _defineProperty(this, "inheritTimelines", void 0);
	  this.mesh = mesh;
	  this.skin = skin;
	  this.slotIndex = slotIndex;
	  this.sourceIndex = sourceIndex;
	  this.source = source;
	  this.inheritTimelines = inheritTimelines;
	});
	function readTimeline1(timelines, keys, timeline, defaultValue, scale) {
	  var _keyMap$time, _keyMap$value;
	  var keyMap = keys[0];
	  var time = (_keyMap$time = keyMap.time) !== null && _keyMap$time !== void 0 ? _keyMap$time : 0;
	  var value = ((_keyMap$value = keyMap.value) !== null && _keyMap$value !== void 0 ? _keyMap$value : defaultValue) * scale;
	  var bezier = 0;
	  for (var frame = 0;; frame++) {
	    var _nextMap$time, _nextMap$value;
	    timeline.setFrame(frame, time, value);
	    var nextMap = keys[frame + 1];
	    if (!nextMap) {
	      timeline.shrink(bezier);
	      timelines.push(timeline);
	      return;
	    }
	    var time2 = (_nextMap$time = nextMap.time) !== null && _nextMap$time !== void 0 ? _nextMap$time : 0;
	    var value2 = ((_nextMap$value = nextMap.value) !== null && _nextMap$value !== void 0 ? _nextMap$value : defaultValue) * scale;
	    if (keyMap.curve) bezier = readCurve(keyMap.curve, timeline, bezier, frame, 0, time, time2, value, value2, scale);
	    time = time2;
	    value = value2;
	    keyMap = nextMap;
	  }
	}
	function readTimeline2(timelines, keys, timeline, name1, name2, defaultValue, scale) {
	  var _keyMap$time2, _keyMap$name, _keyMap$name2;
	  var keyMap = keys[0];
	  var time = (_keyMap$time2 = keyMap.time) !== null && _keyMap$time2 !== void 0 ? _keyMap$time2 : 0;
	  var value1 = ((_keyMap$name = keyMap[name1]) !== null && _keyMap$name !== void 0 ? _keyMap$name : defaultValue) * scale;
	  var value2 = ((_keyMap$name2 = keyMap[name2]) !== null && _keyMap$name2 !== void 0 ? _keyMap$name2 : defaultValue) * scale;
	  var bezier = 0;
	  for (var frame = 0;; frame++) {
	    var _nextMap$time2, _nextMap$name, _nextMap$name2;
	    timeline.setFrame(frame, time, value1, value2);
	    var nextMap = keys[frame + 1];
	    if (!nextMap) {
	      timeline.shrink(bezier);
	      timelines.push(timeline);
	      return;
	    }
	    var time2 = (_nextMap$time2 = nextMap.time) !== null && _nextMap$time2 !== void 0 ? _nextMap$time2 : 0;
	    var nvalue1 = ((_nextMap$name = nextMap[name1]) !== null && _nextMap$name !== void 0 ? _nextMap$name : defaultValue) * scale;
	    var nvalue2 = ((_nextMap$name2 = nextMap[name2]) !== null && _nextMap$name2 !== void 0 ? _nextMap$name2 : defaultValue) * scale;
	    var curve = keyMap.curve;
	    if (curve) {
	      bezier = readCurve(curve, timeline, bezier, frame, 0, time, time2, value1, nvalue1, scale);
	      bezier = readCurve(curve, timeline, bezier, frame, 1, time, time2, value2, nvalue2, scale);
	    }
	    time = time2;
	    value1 = nvalue1;
	    value2 = nvalue2;
	    keyMap = nextMap;
	  }
	}
	function readDrawOrder(skeletonData, keys, slotCount, folderSlots) {
	  var changes = keys.offsets;
	  if (!changes) return null;
	  var drawOrder = new Array(slotCount).fill(-1);
	  var unchanged = new Array(slotCount - changes.length);
	  var originalIndex = 0,
	    unchangedIndex = 0;
	  var _iterator7 = _createForOfIteratorHelper(changes),
	    _step7;
	  try {
	    for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
	      var offsetMap = _step7.value;
	      var slot = skeletonData.findSlot(offsetMap.slot);
	      if (slot == null) throw new Error("Draw order slot not found: ".concat(offsetMap.slot));
	      var index = 0;
	      if (!folderSlots) index = slot.index;else {
	        index = -1;
	        for (var _i0 = 0; _i0 < slotCount; _i0++) {
	          if (folderSlots[_i0] === slot.index) {
	            index = _i0;
	            break;
	          }
	        }
	        if (index === -1) throw new Error("Slot not in folder: ".concat(offsetMap.slot));
	      }
	      while (originalIndex !== index) unchanged[unchangedIndex++] = originalIndex++;
	      drawOrder[originalIndex + offsetMap.offset] = originalIndex++;
	    }
	  } catch (err) {
	    _iterator7.e(err);
	  } finally {
	    _iterator7.f();
	  }
	  while (originalIndex < slotCount) unchanged[unchangedIndex++] = originalIndex++;
	  for (var i = slotCount - 1; i >= 0; i--) if (drawOrder[i] === -1) drawOrder[i] = unchanged[--unchangedIndex];
	  return drawOrder;
	}
	function readCurve(curve, timeline, bezier, frame, value, time1, time2, value1, value2, scale) {
	  if (curve === "stepped") {
	    timeline.setStepped(frame);
	    return bezier;
	  }
	  var i = value << 2;
	  var cx1 = curve[i];
	  var cy1 = curve[i + 1] * scale;
	  var cx2 = curve[i + 2];
	  var cy2 = curve[i + 3] * scale;
	  timeline.setBezier(bezier, frame, value, time1, value1, cx1, cy1, cx2, cy2, time2, value2);
	  return bezier + 1;
	}
	function getValue(map, property, defaultValue) {
	  return map[property] !== undefined ? map[property] : defaultValue;
	}

	var SkeletonPhysicsMovement = function () {
	  function SkeletonPhysicsMovement(skeleton, adapter) {
	    var _options$positionInhe, _options$positionInhe2, _options$rotationInhe;
	    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
	    _classCallCheck(this, SkeletonPhysicsMovement);
	    _defineProperty(this, "skeleton", void 0);
	    _defineProperty(this, "adapter", void 0);
	    _defineProperty(this, "positionInheritanceFactorX", 0);
	    _defineProperty(this, "positionInheritanceFactorY", 0);
	    _defineProperty(this, "rotationInheritanceFactor", 0);
	    _defineProperty(this, "hasLastTransform", false);
	    _defineProperty(this, "lastX", 0);
	    _defineProperty(this, "lastY", 0);
	    _defineProperty(this, "lastZ", 0);
	    _defineProperty(this, "lastRotation", 0);
	    _defineProperty(this, "currentTransform", {
	      x: 0,
	      y: 0,
	      z: 0,
	      rotation: 0
	    });
	    _defineProperty(this, "currentPosition", {
	      x: 0,
	      y: 0,
	      z: 0
	    });
	    _defineProperty(this, "lastPosition", {
	      x: 0,
	      y: 0,
	      z: 0
	    });
	    this.skeleton = skeleton;
	    this.adapter = adapter;
	    this.positionInheritanceFactorX = (_options$positionInhe = options.positionInheritanceX) !== null && _options$positionInhe !== void 0 ? _options$positionInhe : 0;
	    this.positionInheritanceFactorY = (_options$positionInhe2 = options.positionInheritanceY) !== null && _options$positionInhe2 !== void 0 ? _options$positionInhe2 : 0;
	    this.rotationInheritanceFactor = (_options$rotationInhe = options.rotationInheritance) !== null && _options$rotationInhe !== void 0 ? _options$rotationInhe : 0;
	  }
	  return _createClass(SkeletonPhysicsMovement, [{
	    key: "positionInheritanceX",
	    get: function get() {
	      return this.positionInheritanceFactorX;
	    }
	  }, {
	    key: "positionInheritanceY",
	    get: function get() {
	      return this.positionInheritanceFactorY;
	    }
	  }, {
	    key: "setPositionInheritance",
	    value: function setPositionInheritance(x, y) {
	      var wasDisabled = this.positionInheritanceFactorX === 0 && this.positionInheritanceFactorY === 0;
	      var isEnabled = x !== 0 || y !== 0;
	      this.positionInheritanceFactorX = x;
	      this.positionInheritanceFactorY = y;
	      if (wasDisabled && isEnabled) this.resetPosition();
	    }
	  }, {
	    key: "rotationInheritance",
	    get: function get() {
	      return this.rotationInheritanceFactor;
	    },
	    set: function set(value) {
	      var wasDisabled = this.rotationInheritanceFactor === 0;
	      this.rotationInheritanceFactor = value;
	      if (wasDisabled && value !== 0) this.resetRotation();
	    }
	  }, {
	    key: "resetPosition",
	    value: function resetPosition() {
	      var transform = this.currentTransform;
	      var readRotation = !this.hasLastTransform && this.rotationInheritanceFactor !== 0;
	      this.adapter.readTransform(transform, readRotation);
	      this.lastX = transform.x;
	      this.lastY = transform.y;
	      this.lastZ = transform.z;
	      if (readRotation) this.lastRotation = transform.rotation;
	      this.hasLastTransform = true;
	    }
	  }, {
	    key: "resetRotation",
	    value: function resetRotation() {
	      var transform = this.currentTransform;
	      this.adapter.readTransform(transform, true);
	      this.lastRotation = transform.rotation;
	      if (!this.hasLastTransform) {
	        this.lastX = transform.x;
	        this.lastY = transform.y;
	        this.lastZ = transform.z;
	      }
	      this.hasLastTransform = true;
	    }
	  }, {
	    key: "resetTransform",
	    value: function resetTransform() {
	      var transform = this.currentTransform;
	      this.adapter.readTransform(transform, true);
	      this.setLastTransform(transform.x, transform.y, transform.z, transform.rotation);
	    }
	  }, {
	    key: "applyTransformMovement",
	    value: function applyTransformMovement() {
	      var inheritPosition = this.positionInheritanceFactorX !== 0 || this.positionInheritanceFactorY !== 0;
	      var inheritRotation = this.rotationInheritanceFactor !== 0;
	      if (!inheritPosition && !inheritRotation) return;
	      var transform = this.currentTransform;
	      this.adapter.readTransform(transform, inheritRotation);
	      var x = transform.x,
	        y = transform.y,
	        z = transform.z;
	      var currentRotation = inheritRotation ? transform.rotation : this.lastRotation;
	      var positionChanged = x !== this.lastX || y !== this.lastY || z !== this.lastZ;
	      if (this.hasLastTransform) {
	        if (!positionChanged && currentRotation === this.lastRotation) return;
	        if (inheritPosition && positionChanged) this.applyPositionMovement(x, y, z);
	        if (inheritRotation && currentRotation !== this.lastRotation) this.applyRotationMovement(currentRotation);
	      }
	      this.setLastTransform(x, y, z, currentRotation);
	    }
	  }, {
	    key: "applyPositionMovement",
	    value: function applyPositionMovement(currentX, currentY, currentZ) {
	      var currentPosition = this.currentPosition;
	      currentPosition.x = currentX;
	      currentPosition.y = currentY;
	      currentPosition.z = currentZ;
	      this.adapter.worldToSkeleton(currentPosition);
	      var lastPosition = this.lastPosition;
	      lastPosition.x = this.lastX;
	      lastPosition.y = this.lastY;
	      lastPosition.z = this.lastZ;
	      this.adapter.worldToSkeleton(lastPosition);
	      this.skeleton.physicsTranslate((currentPosition.x - lastPosition.x) * this.positionInheritanceFactorX, (currentPosition.y - lastPosition.y) * this.positionInheritanceFactorY);
	    }
	  }, {
	    key: "applyRotationMovement",
	    value: function applyRotationMovement(currentRotation) {
	      var rotationFactor = this.rotationInheritanceFactor;
	      if (rotationFactor === 0) return;
	      this.skeleton.physicsRotate(0, 0, this.getRotationDelta(currentRotation, this.lastRotation) * rotationFactor);
	    }
	  }, {
	    key: "setLastTransform",
	    value: function setLastTransform(x, y, z, rotation) {
	      this.lastX = x;
	      this.lastY = y;
	      this.lastZ = z;
	      this.lastRotation = rotation;
	      this.hasLastTransform = true;
	    }
	  }, {
	    key: "getRotationDelta",
	    value: function getRotationDelta(current, previous) {
	      var delta = current - previous;
	      delta = (delta + 180) % 360 - 180;
	      return delta < -180 ? delta + 360 : delta;
	    }
	  }]);
	}();

	var SkeletonRendererCore = function () {
	  function SkeletonRendererCore() {
	    _classCallCheck(this, SkeletonRendererCore);
	    _defineProperty(this, "commandPool", new CommandPool());
	    _defineProperty(this, "worldVertices", new Float32Array(12 * 1024));
	    _defineProperty(this, "quadIndices", new Uint16Array([0, 1, 2, 2, 3, 0]));
	    _defineProperty(this, "clipping", new SkeletonClipping());
	    _defineProperty(this, "renderCommands", []);
	  }
	  return _createClass(SkeletonRendererCore, [{
	    key: "render",
	    value: function render(skeleton) {
	      var pma = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
	      var inColor = arguments.length > 2 ? arguments[2] : undefined;
	      var stride = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 2;
	      var slotZOffset = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
	      this.commandPool.reset();
	      this.renderCommands.length = 0;
	      var clipper = this.clipping;
	      var z = 0;
	      var drawOrder = skeleton.drawOrder.appliedPose;
	      for (var i = 0, n = drawOrder.length; i < n; i++) {
	        var slot = drawOrder[i];
	        if (!slot.bone.active) {
	          clipper.clipEnd(slot);
	          continue;
	        }
	        var pose = slot.appliedPose;
	        var attachment = pose.attachment;
	        if (!attachment) {
	          clipper.clipEnd(slot);
	          continue;
	        }
	        var slotColor = pose.color;
	        var alpha = slotColor.a;
	        if (alpha === 0 && !(attachment instanceof ClippingAttachment)) {
	          clipper.clipEnd(slot);
	          continue;
	        }
	        var vertices = void 0;
	        var verticesCount = void 0;
	        var uvs = void 0;
	        var indices = void 0;
	        var indicesCount = void 0;
	        var attachmentColor = void 0;
	        var texture = void 0;
	        if (attachment instanceof RegionAttachment) {
	          var _sequence$regions$seq;
	          attachmentColor = attachment.color;
	          if (attachmentColor.a === 0) {
	            clipper.clipEnd(slot);
	            continue;
	          }
	          var sequence = attachment.sequence;
	          var sequenceIndex = sequence.resolveIndex(pose);
	          attachment.computeWorldVertices(slot, attachment.getOffsets(pose), this.worldVertices, 0, stride);
	          vertices = this.worldVertices;
	          verticesCount = 4;
	          uvs = sequence.getUVs(sequenceIndex);
	          indices = this.quadIndices;
	          indicesCount = 6;
	          texture = (_sequence$regions$seq = sequence.regions[sequenceIndex]) === null || _sequence$regions$seq === void 0 ? void 0 : _sequence$regions$seq.texture;
	        } else if (attachment instanceof MeshAttachment) {
	          var _sequence$regions$_se;
	          attachmentColor = attachment.color;
	          if (attachmentColor.a === 0) {
	            clipper.clipEnd(slot);
	            continue;
	          }
	          if (this.worldVertices.length < attachment.worldVerticesLength) this.worldVertices = new Float32Array(attachment.worldVerticesLength);
	          attachment.computeWorldVertices(skeleton, slot, 0, attachment.worldVerticesLength, this.worldVertices, 0, stride);
	          vertices = this.worldVertices;
	          verticesCount = attachment.worldVerticesLength >> 1;
	          var _sequence = attachment.sequence;
	          var _sequenceIndex = _sequence.resolveIndex(pose);
	          uvs = _sequence.getUVs(_sequenceIndex);
	          indices = attachment.triangles;
	          indicesCount = indices.length;
	          texture = (_sequence$regions$_se = _sequence.regions[_sequenceIndex]) === null || _sequence$regions$_se === void 0 ? void 0 : _sequence$regions$_se.texture;
	        } else if (attachment instanceof ClippingAttachment) {
	          clipper.clipEnd(slot);
	          clipper.clipStart(skeleton, slot, attachment);
	          continue;
	        } else {
	          clipper.clipEnd(slot);
	          continue;
	        }
	        if (!texture) {
	          clipper.clipEnd(slot);
	          continue;
	        }
	        var skelColor = skeleton.color;
	        var color = void 0,
	          darkColor = void 0;
	        if (pma) {
	          var a = void 0;
	          if (inColor) {
	            a = Math.floor(inColor[3] * skelColor.a * slotColor.a * attachmentColor.a * 255);
	            var r = Math.floor(a * inColor[0] * skelColor.r * slotColor.r * attachmentColor.r);
	            var g = Math.floor(a * inColor[1] * skelColor.g * slotColor.g * attachmentColor.g);
	            var b = Math.floor(a * inColor[2] * skelColor.b * slotColor.b * attachmentColor.b);
	            color = a << 24 | r << 16 | g << 8 | b;
	          } else {
	            a = Math.floor(skelColor.a * slotColor.a * attachmentColor.a * 255);
	            var _r = Math.floor(a * skelColor.r * slotColor.r * attachmentColor.r);
	            var _g = Math.floor(a * skelColor.g * slotColor.g * attachmentColor.g);
	            var _b = Math.floor(a * skelColor.b * slotColor.b * attachmentColor.b);
	            color = a << 24 | _r << 16 | _g << 8 | _b;
	          }
	          darkColor = 0xff000000;
	          if (pose.darkColor) {
	            var _pose$darkColor = pose.darkColor,
	              _r2 = _pose$darkColor.r,
	              _g2 = _pose$darkColor.g,
	              _b2 = _pose$darkColor.b;
	            darkColor = 0xff000000 | Math.floor(_r2 * a) << 16 | Math.floor(_g2 * a) << 8 | Math.floor(_b2 * a);
	          }
	        } else {
	          if (inColor) {
	            var _a = Math.floor(inColor[3] * skelColor.a * slotColor.a * attachmentColor.a * 255);
	            var _r3 = Math.floor(inColor[0] * skelColor.r * slotColor.r * attachmentColor.r * 255);
	            var _g3 = Math.floor(inColor[1] * skelColor.g * slotColor.g * attachmentColor.g * 255);
	            var _b3 = Math.floor(inColor[2] * skelColor.b * slotColor.b * attachmentColor.b * 255);
	            color = _a << 24 | _r3 << 16 | _g3 << 8 | _b3;
	          } else {
	            var _a2 = Math.floor(skelColor.a * slotColor.a * attachmentColor.a * 255);
	            var _r4 = Math.floor(skelColor.r * slotColor.r * attachmentColor.r * 255);
	            var _g4 = Math.floor(skelColor.g * slotColor.g * attachmentColor.g * 255);
	            var _b4 = Math.floor(skelColor.b * slotColor.b * attachmentColor.b * 255);
	            color = _a2 << 24 | _r4 << 16 | _g4 << 8 | _b4;
	          }
	          darkColor = 0;
	          if (pose.darkColor) {
	            var _pose$darkColor2 = pose.darkColor,
	              _r5 = _pose$darkColor2.r,
	              _g5 = _pose$darkColor2.g,
	              _b5 = _pose$darkColor2.b;
	            darkColor = Math.floor(_r5 * 255) << 16 | Math.floor(_g5 * 255) << 8 | Math.floor(_b5 * 255);
	          }
	        }
	        if (clipper.isClipping()) {
	          clipper.clipTrianglesUnpacked(vertices, 0, indices, indicesCount, uvs, stride);
	          vertices = clipper.clippedVerticesTyped;
	          verticesCount = clipper.clippedVerticesLength / stride;
	          uvs = clipper.clippedUVsTyped;
	          indices = clipper.clippedTrianglesTyped;
	          indicesCount = clipper.clippedTrianglesLength;
	        }
	        var cmd = this.commandPool.getCommand(verticesCount, indicesCount, stride);
	        cmd.blendMode = slot.data.blendMode;
	        cmd.texture = texture;
	        cmd.positions.set(vertices.subarray(0, verticesCount * stride));
	        if (stride >= 3) {
	          for (var j = 2, _n = verticesCount * stride; j < _n; j += stride) cmd.positions[j] = z;
	        }
	        cmd.uvs.set(uvs.subarray(0, verticesCount << 1));
	        for (var _j = 0; _j < verticesCount; _j++) {
	          cmd.colors[_j] = color;
	          cmd.darkColors[_j] = darkColor;
	        }
	        if (indices instanceof Uint16Array) {
	          cmd.indices.set(indices.subarray(0, indicesCount));
	        } else {
	          cmd.indices.set(indices.slice(0, indicesCount));
	        }
	        this.renderCommands.push(cmd);
	        z += slotZOffset;
	        clipper.clipEnd(slot);
	      }
	      clipper.clipEnd();
	      return this.batchCommands(stride);
	    }
	  }, {
	    key: "batchSubCommands",
	    value: function batchSubCommands(commands, first, last, numVertices, numIndices, stride) {
	      var firstCmd = commands[first];
	      var batched = this.commandPool.getCommand(numVertices, numIndices, stride);
	      batched.blendMode = firstCmd.blendMode;
	      batched.texture = firstCmd.texture;
	      var positionsOffset = 0;
	      var uvsOffset = 0;
	      var colorsOffset = 0;
	      var indicesOffset = 0;
	      var vertexOffset = 0;
	      for (var i = first; i <= last; i++) {
	        var cmd = commands[i];
	        batched.positions.set(cmd.positions, positionsOffset);
	        positionsOffset += cmd.numVertices * stride;
	        batched.uvs.set(cmd.uvs, uvsOffset);
	        uvsOffset += cmd.numVertices << 1;
	        batched.colors.set(cmd.colors, colorsOffset);
	        batched.darkColors.set(cmd.darkColors, colorsOffset);
	        colorsOffset += cmd.numVertices;
	        for (var j = 0; j < cmd.numIndices; j++) batched.indices[indicesOffset + j] = cmd.indices[j] + vertexOffset;
	        indicesOffset += cmd.numIndices;
	        vertexOffset += cmd.numVertices;
	      }
	      return batched;
	    }
	  }, {
	    key: "batchCommands",
	    value: function batchCommands(stride) {
	      if (this.renderCommands.length === 0) return undefined;
	      var root;
	      var last;
	      var first = this.renderCommands[0];
	      var startIndex = 0;
	      var i = 1;
	      var numVertices = first.numVertices;
	      var numIndices = first.numIndices;
	      while (i <= this.renderCommands.length) {
	        var cmd = i < this.renderCommands.length ? this.renderCommands[i] : null;
	        if (cmd && cmd.numVertices === 0 && cmd.numIndices === 0) {
	          i++;
	          continue;
	        }
	        var canBatch = cmd !== null && cmd.texture === first.texture && cmd.blendMode === first.blendMode && cmd.colors[0] === first.colors[0] && cmd.darkColors[0] === first.darkColors[0] && numIndices + cmd.numIndices < 0xffff;
	        if (canBatch) {
	          numVertices += cmd.numVertices;
	          numIndices += cmd.numIndices;
	        } else {
	          var batched = this.batchSubCommands(this.renderCommands, startIndex, i - 1, numVertices, numIndices, stride);
	          if (!last) {
	            root = last = batched;
	          } else {
	            last.next = batched;
	            last = batched;
	          }
	          if (i === this.renderCommands.length) break;
	          first = this.renderCommands[i];
	          startIndex = i;
	          numVertices = first.numVertices;
	          numIndices = first.numIndices;
	        }
	        i++;
	      }
	      return root;
	    }
	  }]);
	}();
	var CommandPool = function () {
	  function CommandPool() {
	    _classCallCheck(this, CommandPool);
	    _defineProperty(this, "pool", []);
	    _defineProperty(this, "inUse", []);
	  }
	  return _createClass(CommandPool, [{
	    key: "getCommand",
	    value: function getCommand(numVertices, numIndices, stride) {
	      var cmd;
	      var _iterator = _createForOfIteratorHelper(this.pool),
	        _step;
	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var c = _step.value;
	          if (c._positions.length >= numVertices * stride && c._indices.length >= numIndices) {
	            cmd = c;
	            break;
	          }
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	      if (!cmd) {
	        var _positions = new Float32Array(numVertices * stride);
	        var _uvs = new Float32Array(numVertices << 1);
	        var _colors = new Uint32Array(numVertices);
	        var _darkColors = new Uint32Array(numVertices);
	        var _indices = new Uint16Array(numIndices);
	        cmd = {
	          positions: _positions,
	          uvs: _uvs,
	          colors: _colors,
	          darkColors: _darkColors,
	          indices: _indices,
	          _positions: _positions,
	          _uvs: _uvs,
	          _colors: _colors,
	          _darkColors: _darkColors,
	          _indices: _indices,
	          numVertices: numVertices,
	          numIndices: numIndices,
	          blendMode: BlendMode.Normal,
	          texture: null
	        };
	      } else {
	        this.pool.splice(this.pool.indexOf(cmd), 1);
	        cmd.next = undefined;
	        cmd.numVertices = numVertices;
	        cmd.numIndices = numIndices;
	        cmd.positions = cmd._positions.subarray(0, numVertices * stride);
	        cmd.uvs = cmd._uvs.subarray(0, numVertices << 1);
	        cmd.colors = cmd._colors.subarray(0, numVertices);
	        cmd.darkColors = cmd._darkColors.subarray(0, numVertices);
	        cmd.indices = cmd._indices.subarray(0, numIndices);
	      }
	      this.inUse.push(cmd);
	      return cmd;
	    }
	  }, {
	    key: "reset",
	    value: function reset() {
	      var _this$pool;
	      (_this$pool = this.pool).push.apply(_this$pool, _toConsumableArray(this.inUse));
	      this.inUse.length = 0;
	    }
	  }]);
	}();

	var spine = /*#__PURE__*/Object.freeze({
		__proto__: null,
		ATTACH_RETAIN: ATTACH_RETAIN,
		ATTACH_SETUP: ATTACH_SETUP,
		AlphaTimeline: AlphaTimeline,
		Animation: Animation,
		AnimationState: AnimationState,
		AnimationStateAdapter: AnimationStateAdapter,
		AnimationStateData: AnimationStateData,
		AssetCache: AssetCache,
		AssetManagerBase: AssetManagerBase,
		AtlasAttachmentLoader: AtlasAttachmentLoader,
		Attachment: Attachment,
		AttachmentTimeline: AttachmentTimeline,
		BinaryInput: BinaryInput,
		get BlendMode () { return BlendMode; },
		Bone: Bone,
		BoneData: BoneData,
		BonePose: BonePose,
		BoneTimeline1: BoneTimeline1,
		BoneTimeline2: BoneTimeline2,
		BoundingBoxAttachment: BoundingBoxAttachment,
		CURRENT: CURRENT,
		ClippingAttachment: ClippingAttachment,
		Color: Color,
		Constraint: Constraint,
		ConstraintData: ConstraintData,
		ConstraintTimeline1: ConstraintTimeline1,
		CurveTimeline: CurveTimeline,
		CurveTimeline1: CurveTimeline1,
		DebugUtils: DebugUtils,
		DeformTimeline: DeformTimeline,
		Downloader: Downloader,
		DrawOrder: DrawOrder,
		DrawOrderFolderTimeline: DrawOrderFolderTimeline,
		DrawOrderTimeline: DrawOrderTimeline,
		Event: Event,
		EventData: EventData,
		EventQueue: EventQueue,
		EventTimeline: EventTimeline,
		get EventType () { return EventType; },
		FIRST: FIRST,
		FakeTexture: FakeTexture,
		FromProperty: FromProperty,
		FromRotate: FromRotate,
		FromScaleX: FromScaleX,
		FromScaleY: FromScaleY,
		FromShearY: FromShearY,
		FromX: FromX,
		FromY: FromY,
		HOLD: HOLD,
		IkConstraint: IkConstraint,
		IkConstraintData: IkConstraintData,
		IkConstraintPose: IkConstraintPose,
		IkConstraintTimeline: IkConstraintTimeline,
		get Inherit () { return Inherit; },
		InheritTimeline: InheritTimeline,
		IntSet: IntSet,
		Interpolation: Interpolation,
		MODE: MODE,
		MathUtils: MathUtils,
		MeshAttachment: MeshAttachment,
		get MixFrom () { return MixFrom; },
		PathAttachment: PathAttachment,
		PathConstraint: PathConstraint,
		PathConstraintData: PathConstraintData,
		PathConstraintMixTimeline: PathConstraintMixTimeline,
		PathConstraintPose: PathConstraintPose,
		PathConstraintPositionTimeline: PathConstraintPositionTimeline,
		PathConstraintSpacingTimeline: PathConstraintSpacingTimeline,
		get Physics () { return Physics; },
		PhysicsConstraint: PhysicsConstraint,
		PhysicsConstraintDampingTimeline: PhysicsConstraintDampingTimeline,
		PhysicsConstraintData: PhysicsConstraintData,
		PhysicsConstraintGravityTimeline: PhysicsConstraintGravityTimeline,
		PhysicsConstraintInertiaTimeline: PhysicsConstraintInertiaTimeline,
		PhysicsConstraintMassTimeline: PhysicsConstraintMassTimeline,
		PhysicsConstraintMixTimeline: PhysicsConstraintMixTimeline,
		PhysicsConstraintPose: PhysicsConstraintPose,
		PhysicsConstraintResetTimeline: PhysicsConstraintResetTimeline,
		PhysicsConstraintStrengthTimeline: PhysicsConstraintStrengthTimeline,
		PhysicsConstraintTimeline: PhysicsConstraintTimeline,
		PhysicsConstraintWindTimeline: PhysicsConstraintWindTimeline,
		PointAttachment: PointAttachment,
		Pool: Pool,
		Posed: Posed,
		PosedActive: PosedActive,
		PosedData: PosedData,
		get PositionMode () { return PositionMode; },
		Pow: Pow,
		PowOut: PowOut,
		get Property () { return Property; },
		RGB2Timeline: RGB2Timeline,
		RGBA2Timeline: RGBA2Timeline,
		RGBATimeline: RGBATimeline,
		RGBTimeline: RGBTimeline,
		RegionAttachment: RegionAttachment,
		get RotateMode () { return RotateMode; },
		RotateTimeline: RotateTimeline,
		SETUP: SETUP,
		ScaleTimeline: ScaleTimeline,
		ScaleXTimeline: ScaleXTimeline,
		get ScaleYMode () { return ScaleYMode; },
		ScaleYTimeline: ScaleYTimeline,
		Sequence: Sequence,
		get SequenceMode () { return SequenceMode; },
		SequenceModeValues: SequenceModeValues,
		SequenceTimeline: SequenceTimeline,
		ShearTimeline: ShearTimeline,
		ShearXTimeline: ShearXTimeline,
		ShearYTimeline: ShearYTimeline,
		Skeleton: Skeleton,
		SkeletonBinary: SkeletonBinary,
		SkeletonBounds: SkeletonBounds,
		SkeletonClipping: SkeletonClipping,
		SkeletonData: SkeletonData,
		SkeletonJson: SkeletonJson,
		SkeletonPhysicsMovement: SkeletonPhysicsMovement,
		SkeletonRendererCore: SkeletonRendererCore,
		Skin: Skin,
		SkinEntry: SkinEntry,
		Slider: Slider,
		SliderData: SliderData,
		SliderMixTimeline: SliderMixTimeline,
		SliderPose: SliderPose,
		SliderTimeline: SliderTimeline,
		Slot: Slot,
		SlotCurveTimeline: SlotCurveTimeline,
		SlotData: SlotData,
		SlotPose: SlotPose,
		get SpacingMode () { return SpacingMode; },
		StringSet: StringSet,
		Texture: Texture,
		TextureAtlas: TextureAtlas,
		TextureAtlasPage: TextureAtlasPage,
		TextureAtlasRegion: TextureAtlasRegion,
		get TextureFilter () { return TextureFilter; },
		TextureRegion: TextureRegion,
		get TextureWrap () { return TextureWrap; },
		TimeKeeper: TimeKeeper,
		Timeline: Timeline,
		ToProperty: ToProperty,
		ToRotate: ToRotate,
		ToScaleX: ToScaleX,
		ToScaleY: ToScaleY,
		ToShearY: ToShearY,
		ToX: ToX,
		ToY: ToY,
		TrackEntry: TrackEntry,
		TransformConstraint: TransformConstraint,
		TransformConstraintData: TransformConstraintData,
		TransformConstraintPose: TransformConstraintPose,
		TransformConstraintTimeline: TransformConstraintTimeline,
		TranslateTimeline: TranslateTimeline,
		TranslateXTimeline: TranslateXTimeline,
		TranslateYTimeline: TranslateYTimeline,
		Triangulator: Triangulator,
		Utils: Utils,
		Vector2: Vector2,
		VertexAttachment: VertexAttachment,
		WindowedMean: WindowedMean,
		isBoneTimeline: isBoneTimeline,
		isConstraintTimeline: isConstraintTimeline,
		isSlotTimeline: isSlotTimeline
	});

	var TO_TEXTURE_FILTER = {
	  9728: pc.FILTER_NEAREST,
	  9729: pc.FILTER_LINEAR,
	  9984: pc.FILTER_NEAREST_MIPMAP_NEAREST,
	  9985: pc.FILTER_LINEAR_MIPMAP_NEAREST,
	  9986: pc.FILTER_NEAREST_MIPMAP_LINEAR,
	  9987: pc.FILTER_LINEAR_MIPMAP_LINEAR
	};
	var TO_UV_WRAP_MODE = {
	  33648: pc.ADDRESS_MIRRORED_REPEAT,
	  33071: pc.ADDRESS_CLAMP_TO_EDGE,
	  10487: pc.ADDRESS_REPEAT
	};
	var SpineTextureWrapper = function () {
	  function SpineTextureWrapper(texture) {
	    _classCallCheck(this, SpineTextureWrapper);
	    this._image = {
	      width: texture.width,
	      height: texture.height
	    };
	    this.pcTexture = texture;
	  }
	  return _createClass(SpineTextureWrapper, [{
	    key: "setFilters",
	    value: function setFilters(minFilter, magFilter) {
	      this.pcTexture.minFilter = TO_TEXTURE_FILTER[minFilter];
	      this.pcTexture.magFilter = TO_TEXTURE_FILTER[magFilter];
	    }
	  }, {
	    key: "setWraps",
	    value: function setWraps(uWrap, vWrap) {
	      this.pcTexture.addressU = TO_UV_WRAP_MODE[uWrap];
	      this.pcTexture.addressV = TO_UV_WRAP_MODE[vWrap];
	    }
	  }, {
	    key: "getImage",
	    value: function getImage() {
	      return this._image;
	    }
	  }, {
	    key: "dispose",
	    value: function dispose() {
	      this.pcTexture.destroy();
	    }
	  }]);
	}();

	var vertexGLSL = "\nattribute vec2 vertex_position;\nattribute vec2 vertex_texCoord0;\nattribute vec4 vertex_color;\nattribute vec4 vertex_darkColor;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\n\nvarying vec2 vUv0;\nvarying vec4 vLight;\nvarying vec4 vDark;\n\nvoid main(void) {\n    vUv0 = vertex_texCoord0;\n    vLight = vertex_color;\n    vDark = vertex_darkColor;\n    gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 0.0, 1.0);\n}\n";
	var fragmentGLSL = "\n#include \"gammaPS\"\n#include \"tonemappingPS\"\n\nvarying vec2 vUv0;\nvarying vec4 vLight;\nvarying vec4 vDark;\n\nuniform sampler2D uTexture;\n\n// 1 when the texture alpha is not premultiplied\nuniform float uPremultiply;\n\nvoid main(void) {\n    // the texture is not sRGB, so it is sampled in gamma space\n    vec4 texColor = texture2D(uTexture, vUv0);\n    texColor.rgb *= mix(1.0, texColor.a, uPremultiply);\n\n    // the two color tint, light and dark colors are premultiplied by alpha\n    float alpha = texColor.a * vLight.a;\n    vec3 color = ((texColor.a - 1.0) * vDark.a + 1.0 - texColor.rgb) * vDark.rgb + texColor.rgb * vLight.rgb;\n\n    // tone map and gamma correct the color without premultiplied alpha\n    vec3 linearColor = decodeGamma(color / max(alpha, 0.0001));\n    gl_FragColor = vec4(gammaCorrectOutput(toneMap(linearColor)) * alpha, alpha);\n}\n";
	var vertexWGSL = "\nattribute vertex_position: vec2f;\nattribute vertex_texCoord0: vec2f;\nattribute vertex_color: vec4f;\nattribute vertex_darkColor: vec4f;\n\nuniform matrix_model: mat4x4f;\nuniform matrix_viewProjection: mat4x4f;\n\nvarying vUv0: vec2f;\nvarying vLight: vec4f;\nvarying vDark: vec4f;\n\n@vertex\nfn vertexMain(input: VertexInput) -> VertexOutput {\n    var output: VertexOutput;\n    output.vUv0 = input.vertex_texCoord0;\n    output.vLight = input.vertex_color;\n    output.vDark = input.vertex_darkColor;\n    output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.vertex_position, 0.0, 1.0);\n    return output;\n}\n";
	var fragmentWGSL = "\n#include \"gammaPS\"\n#include \"tonemappingPS\"\n\nvarying vUv0: vec2f;\nvarying vLight: vec4f;\nvarying vDark: vec4f;\n\nvar uTexture: texture_2d<f32>;\nvar uTextureSampler: sampler;\n\n// 1 when the texture alpha is not premultiplied\nuniform uPremultiply: f32;\n\n@fragment\nfn fragmentMain(input: FragmentInput) -> FragmentOutput {\n    var output: FragmentOutput;\n    // the texture is not sRGB, so it is sampled in gamma space\n    var texColor = textureSample(uTexture, uTextureSampler, input.vUv0);\n    texColor = vec4f(texColor.rgb * mix(1.0, texColor.a, uniform.uPremultiply), texColor.a);\n\n    // the two color tint, light and dark colors are premultiplied by alpha\n    let alpha = texColor.a * input.vLight.a;\n    let color = ((texColor.a - 1.0) * input.vDark.a + 1.0 - texColor.rgb) * input.vDark.rgb + texColor.rgb * input.vLight.rgb;\n\n    // tone map and gamma correct the color without premultiplied alpha\n    let linearColor = decodeGamma3(color / max(alpha, 0.0001));\n    output.color = vec4f(gammaCorrectOutput(toneMap(linearColor)) * alpha, alpha);\n    return output;\n}\n";

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var constants$1;
	var hasRequiredConstants;
	function requireConstants() {
	  if (hasRequiredConstants) return constants$1;
	  hasRequiredConstants = 1;
	  var SEMVER_SPEC_VERSION = '2.0.0';
	  var MAX_LENGTH = 256;
	  var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
	  var MAX_SAFE_COMPONENT_LENGTH = 16;
	  var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
	  var RELEASE_TYPES = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];
	  constants$1 = {
	    MAX_LENGTH: MAX_LENGTH,
	    MAX_SAFE_COMPONENT_LENGTH: MAX_SAFE_COMPONENT_LENGTH,
	    MAX_SAFE_BUILD_LENGTH: MAX_SAFE_BUILD_LENGTH,
	    MAX_SAFE_INTEGER: MAX_SAFE_INTEGER,
	    RELEASE_TYPES: RELEASE_TYPES,
	    SEMVER_SPEC_VERSION: SEMVER_SPEC_VERSION,
	    FLAG_INCLUDE_PRERELEASE: 1,
	    FLAG_LOOSE: 2
	  };
	  return constants$1;
	}

	var constantsExports = requireConstants();
	var constants = /*@__PURE__*/getDefaultExportFromCjs(constantsExports);

	var debug_1;
	var hasRequiredDebug;
	function requireDebug() {
	  if (hasRequiredDebug) return debug_1;
	  hasRequiredDebug = 1;
	  var debug = (typeof process === "undefined" ? "undefined" : _typeof(process)) === 'object' && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? function () {
	    var _console;
	    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }
	    return (_console = console).error.apply(_console, ['SEMVER'].concat(args));
	  } : function () {};
	  debug_1 = debug;
	  return debug_1;
	}

	var re = {exports: {}};

	var hasRequiredRe;
	function requireRe() {
	  if (hasRequiredRe) return re.exports;
	  hasRequiredRe = 1;
	  (function (module, exports) {

	    var _require$$ = requireConstants(),
	      MAX_SAFE_COMPONENT_LENGTH = _require$$.MAX_SAFE_COMPONENT_LENGTH,
	      MAX_SAFE_BUILD_LENGTH = _require$$.MAX_SAFE_BUILD_LENGTH,
	      MAX_LENGTH = _require$$.MAX_LENGTH;
	    var debug = requireDebug();
	    exports = module.exports = {};
	    var re = exports.re = [];
	    var safeRe = exports.safeRe = [];
	    var src = exports.src = [];
	    var safeSrc = exports.safeSrc = [];
	    var t = exports.t = {};
	    var R = 0;
	    var LETTERDASHNUMBER = '[a-zA-Z0-9-]';
	    var safeRegexReplacements = [['\\s', 1], ['\\d', MAX_LENGTH], [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]];
	    var makeSafeRegex = function makeSafeRegex(value) {
	      for (var _i = 0, _safeRegexReplacement = safeRegexReplacements; _i < _safeRegexReplacement.length; _i++) {
	        var _safeRegexReplacement2 = _slicedToArray(_safeRegexReplacement[_i], 2),
	          token = _safeRegexReplacement2[0],
	          max = _safeRegexReplacement2[1];
	        value = value.split("".concat(token, "*")).join("".concat(token, "{0,").concat(max, "}")).split("".concat(token, "+")).join("".concat(token, "{1,").concat(max, "}"));
	      }
	      return value;
	    };
	    var createToken = function createToken(name, value, isGlobal) {
	      var safe = makeSafeRegex(value);
	      var index = R++;
	      debug(name, index, value);
	      t[name] = index;
	      src[index] = value;
	      safeSrc[index] = safe;
	      re[index] = new RegExp(value, isGlobal ? 'g' : undefined);
	      safeRe[index] = new RegExp(safe, isGlobal ? 'g' : undefined);
	    };
	    createToken('NUMERICIDENTIFIER', '0|[1-9]\\d*');
	    createToken('NUMERICIDENTIFIERLOOSE', '\\d+');
	    createToken('NONNUMERICIDENTIFIER', "\\d*[a-zA-Z-]".concat(LETTERDASHNUMBER, "*"));
	    createToken('MAINVERSION', "(".concat(src[t.NUMERICIDENTIFIER], ")\\.") + "(".concat(src[t.NUMERICIDENTIFIER], ")\\.") + "(".concat(src[t.NUMERICIDENTIFIER], ")"));
	    createToken('MAINVERSIONLOOSE', "(".concat(src[t.NUMERICIDENTIFIERLOOSE], ")\\.") + "(".concat(src[t.NUMERICIDENTIFIERLOOSE], ")\\.") + "(".concat(src[t.NUMERICIDENTIFIERLOOSE], ")"));
	    createToken('PRERELEASEIDENTIFIER', "(?:".concat(src[t.NONNUMERICIDENTIFIER], "|").concat(src[t.NUMERICIDENTIFIER], ")"));
	    createToken('PRERELEASEIDENTIFIERLOOSE', "(?:".concat(src[t.NONNUMERICIDENTIFIER], "|").concat(src[t.NUMERICIDENTIFIERLOOSE], ")"));
	    createToken('PRERELEASE', "(?:-(".concat(src[t.PRERELEASEIDENTIFIER], "(?:\\.").concat(src[t.PRERELEASEIDENTIFIER], ")*))"));
	    createToken('PRERELEASELOOSE', "(?:-?(".concat(src[t.PRERELEASEIDENTIFIERLOOSE], "(?:\\.").concat(src[t.PRERELEASEIDENTIFIERLOOSE], ")*))"));
	    createToken('BUILDIDENTIFIER', "".concat(LETTERDASHNUMBER, "+"));
	    createToken('BUILD', "(?:\\+(".concat(src[t.BUILDIDENTIFIER], "(?:\\.").concat(src[t.BUILDIDENTIFIER], ")*))"));
	    createToken('FULLPLAIN', "v?".concat(src[t.MAINVERSION]).concat(src[t.PRERELEASE], "?").concat(src[t.BUILD], "?"));
	    createToken('FULL', "^".concat(src[t.FULLPLAIN], "$"));
	    createToken('LOOSEPLAIN', "[v=\\s]*".concat(src[t.MAINVERSIONLOOSE]).concat(src[t.PRERELEASELOOSE], "?").concat(src[t.BUILD], "?"));
	    createToken('LOOSE', "^".concat(src[t.LOOSEPLAIN], "$"));
	    createToken('GTLT', '((?:<|>)?=?)');
	    createToken('XRANGEIDENTIFIERLOOSE', "".concat(src[t.NUMERICIDENTIFIERLOOSE], "|x|X|\\*"));
	    createToken('XRANGEIDENTIFIER', "".concat(src[t.NUMERICIDENTIFIER], "|x|X|\\*"));
	    createToken('XRANGEPLAIN', "[v=\\s]*(".concat(src[t.XRANGEIDENTIFIER], ")") + "(?:\\.(".concat(src[t.XRANGEIDENTIFIER], ")") + "(?:\\.(".concat(src[t.XRANGEIDENTIFIER], ")") + "(?:".concat(src[t.PRERELEASE], ")?").concat(src[t.BUILD], "?") + ")?)?");
	    createToken('XRANGEPLAINLOOSE', "[v=\\s]*(".concat(src[t.XRANGEIDENTIFIERLOOSE], ")") + "(?:\\.(".concat(src[t.XRANGEIDENTIFIERLOOSE], ")") + "(?:\\.(".concat(src[t.XRANGEIDENTIFIERLOOSE], ")") + "(?:".concat(src[t.PRERELEASELOOSE], ")?").concat(src[t.BUILD], "?") + ")?)?");
	    createToken('XRANGE', "^".concat(src[t.GTLT], "\\s*").concat(src[t.XRANGEPLAIN], "$"));
	    createToken('XRANGELOOSE', "^".concat(src[t.GTLT], "\\s*").concat(src[t.XRANGEPLAINLOOSE], "$"));
	    createToken('COERCEPLAIN', "".concat('(^|[^\\d])' + '(\\d{1,').concat(MAX_SAFE_COMPONENT_LENGTH, "})") + "(?:\\.(\\d{1,".concat(MAX_SAFE_COMPONENT_LENGTH, "}))?") + "(?:\\.(\\d{1,".concat(MAX_SAFE_COMPONENT_LENGTH, "}))?"));
	    createToken('COERCE', "".concat(src[t.COERCEPLAIN], "(?:$|[^\\d])"));
	    createToken('COERCEFULL', src[t.COERCEPLAIN] + "(?:".concat(src[t.PRERELEASE], ")?") + "(?:".concat(src[t.BUILD], ")?") + "(?:$|[^\\d])");
	    createToken('COERCERTL', src[t.COERCE], true);
	    createToken('COERCERTLFULL', src[t.COERCEFULL], true);
	    createToken('LONETILDE', '(?:~>?)');
	    createToken('TILDETRIM', "(\\s*)".concat(src[t.LONETILDE], "\\s+"), true);
	    exports.tildeTrimReplace = '$1~';
	    createToken('TILDE', "^".concat(src[t.LONETILDE]).concat(src[t.XRANGEPLAIN], "$"));
	    createToken('TILDELOOSE', "^".concat(src[t.LONETILDE]).concat(src[t.XRANGEPLAINLOOSE], "$"));
	    createToken('LONECARET', '(?:\\^)');
	    createToken('CARETTRIM', "(\\s*)".concat(src[t.LONECARET], "\\s+"), true);
	    exports.caretTrimReplace = '$1^';
	    createToken('CARET', "^".concat(src[t.LONECARET]).concat(src[t.XRANGEPLAIN], "$"));
	    createToken('CARETLOOSE', "^".concat(src[t.LONECARET]).concat(src[t.XRANGEPLAINLOOSE], "$"));
	    createToken('COMPARATORLOOSE', "^".concat(src[t.GTLT], "\\s*(").concat(src[t.LOOSEPLAIN], ")$|^$"));
	    createToken('COMPARATOR', "^".concat(src[t.GTLT], "\\s*(").concat(src[t.FULLPLAIN], ")$|^$"));
	    createToken('COMPARATORTRIM', "(\\s*)".concat(src[t.GTLT], "\\s*(").concat(src[t.LOOSEPLAIN], "|").concat(src[t.XRANGEPLAIN], ")"), true);
	    exports.comparatorTrimReplace = '$1$2$3';
	    createToken('HYPHENRANGE', "^\\s*(".concat(src[t.XRANGEPLAIN], ")") + "\\s+-\\s+" + "(".concat(src[t.XRANGEPLAIN], ")") + "\\s*$");
	    createToken('HYPHENRANGELOOSE', "^\\s*(".concat(src[t.XRANGEPLAINLOOSE], ")") + "\\s+-\\s+" + "(".concat(src[t.XRANGEPLAINLOOSE], ")") + "\\s*$");
	    createToken('STAR', '(<|>)?=?\\s*\\*');
	    createToken('GTE0', '^\\s*>=\\s*0\\.0\\.0\\s*$');
	    createToken('GTE0PRE', '^\\s*>=\\s*0\\.0\\.0-0\\s*$');
	  })(re, re.exports);
	  return re.exports;
	}

	var parseOptions_1;
	var hasRequiredParseOptions;
	function requireParseOptions() {
	  if (hasRequiredParseOptions) return parseOptions_1;
	  hasRequiredParseOptions = 1;
	  var looseOption = Object.freeze({
	    loose: true
	  });
	  var emptyOpts = Object.freeze({});
	  var parseOptions = function parseOptions(options) {
	    if (!options) {
	      return emptyOpts;
	    }
	    if (_typeof(options) !== 'object') {
	      return looseOption;
	    }
	    return options;
	  };
	  parseOptions_1 = parseOptions;
	  return parseOptions_1;
	}

	var identifiers;
	var hasRequiredIdentifiers;
	function requireIdentifiers() {
	  if (hasRequiredIdentifiers) return identifiers;
	  hasRequiredIdentifiers = 1;
	  var numeric = /^[0-9]+$/;
	  var compareIdentifiers = function compareIdentifiers(a, b) {
	    if (typeof a === 'number' && typeof b === 'number') {
	      return a === b ? 0 : a < b ? -1 : 1;
	    }
	    var anum = numeric.test(a);
	    var bnum = numeric.test(b);
	    if (anum && bnum) {
	      a = +a;
	      b = +b;
	    }
	    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	  };
	  var rcompareIdentifiers = function rcompareIdentifiers(a, b) {
	    return compareIdentifiers(b, a);
	  };
	  identifiers = {
	    compareIdentifiers: compareIdentifiers,
	    rcompareIdentifiers: rcompareIdentifiers
	  };
	  return identifiers;
	}

	var semver$1;
	var hasRequiredSemver;
	function requireSemver() {
	  if (hasRequiredSemver) return semver$1;
	  hasRequiredSemver = 1;
	  var debug = requireDebug();
	  var _require$$ = requireConstants(),
	    MAX_LENGTH = _require$$.MAX_LENGTH,
	    MAX_SAFE_INTEGER = _require$$.MAX_SAFE_INTEGER;
	  var _require$$2 = requireRe(),
	    re = _require$$2.safeRe,
	    t = _require$$2.t;
	  var parseOptions = requireParseOptions();
	  var _require$$3 = requireIdentifiers(),
	    compareIdentifiers = _require$$3.compareIdentifiers;
	  var isPrereleaseIdentifier = function isPrereleaseIdentifier(prerelease, identifier) {
	    var identifiers = identifier.split('.');
	    if (identifiers.length > prerelease.length) {
	      return false;
	    }
	    for (var i = 0; i < identifiers.length; i++) {
	      if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
	        return false;
	      }
	    }
	    return true;
	  };
	  var SemVer = function () {
	    function SemVer(version, options) {
	      _classCallCheck(this, SemVer);
	      options = parseOptions(options);
	      if (version instanceof SemVer) {
	        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
	          return version;
	        } else {
	          version = version.version;
	        }
	      } else if (typeof version !== 'string') {
	        throw new TypeError("Invalid version. Must be a string. Got type \"".concat(_typeof(version), "\"."));
	      }
	      if (version.length > MAX_LENGTH) {
	        throw new TypeError("version is longer than ".concat(MAX_LENGTH, " characters"));
	      }
	      debug('SemVer', version, options);
	      this.options = options;
	      this.loose = !!options.loose;
	      this.includePrerelease = !!options.includePrerelease;
	      var m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
	      if (!m) {
	        throw new TypeError("Invalid Version: ".concat(version));
	      }
	      this.raw = version;
	      this.major = +m[1];
	      this.minor = +m[2];
	      this.patch = +m[3];
	      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
	        throw new TypeError('Invalid major version');
	      }
	      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
	        throw new TypeError('Invalid minor version');
	      }
	      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
	        throw new TypeError('Invalid patch version');
	      }
	      if (!m[4]) {
	        this.prerelease = [];
	      } else {
	        this.prerelease = m[4].split('.').map(function (id) {
	          if (/^[0-9]+$/.test(id)) {
	            var num = +id;
	            if (num >= 0 && num < MAX_SAFE_INTEGER) {
	              return num;
	            }
	          }
	          return id;
	        });
	      }
	      this.build = m[5] ? m[5].split('.') : [];
	      this.format();
	    }
	    return _createClass(SemVer, [{
	      key: "format",
	      value: function format() {
	        this.version = "".concat(this.major, ".").concat(this.minor, ".").concat(this.patch);
	        if (this.prerelease.length) {
	          this.version += "-".concat(this.prerelease.join('.'));
	        }
	        return this.version;
	      }
	    }, {
	      key: "toString",
	      value: function toString() {
	        return this.version;
	      }
	    }, {
	      key: "compare",
	      value: function compare(other) {
	        debug('SemVer.compare', this.version, this.options, other);
	        if (!(other instanceof SemVer)) {
	          if (typeof other === 'string' && other === this.version) {
	            return 0;
	          }
	          other = new SemVer(other, this.options);
	        }
	        if (other.version === this.version) {
	          return 0;
	        }
	        return this.compareMain(other) || this.comparePre(other);
	      }
	    }, {
	      key: "compareMain",
	      value: function compareMain(other) {
	        if (!(other instanceof SemVer)) {
	          other = new SemVer(other, this.options);
	        }
	        if (this.major < other.major) {
	          return -1;
	        }
	        if (this.major > other.major) {
	          return 1;
	        }
	        if (this.minor < other.minor) {
	          return -1;
	        }
	        if (this.minor > other.minor) {
	          return 1;
	        }
	        if (this.patch < other.patch) {
	          return -1;
	        }
	        if (this.patch > other.patch) {
	          return 1;
	        }
	        return 0;
	      }
	    }, {
	      key: "comparePre",
	      value: function comparePre(other) {
	        if (!(other instanceof SemVer)) {
	          other = new SemVer(other, this.options);
	        }
	        if (this.prerelease.length && !other.prerelease.length) {
	          return -1;
	        } else if (!this.prerelease.length && other.prerelease.length) {
	          return 1;
	        } else if (!this.prerelease.length && !other.prerelease.length) {
	          return 0;
	        }
	        var i = 0;
	        do {
	          var a = this.prerelease[i];
	          var b = other.prerelease[i];
	          debug('prerelease compare', i, a, b);
	          if (a === undefined && b === undefined) {
	            return 0;
	          } else if (b === undefined) {
	            return 1;
	          } else if (a === undefined) {
	            return -1;
	          } else if (a === b) {
	            continue;
	          } else {
	            return compareIdentifiers(a, b);
	          }
	        } while (++i);
	      }
	    }, {
	      key: "compareBuild",
	      value: function compareBuild(other) {
	        if (!(other instanceof SemVer)) {
	          other = new SemVer(other, this.options);
	        }
	        var i = 0;
	        do {
	          var a = this.build[i];
	          var b = other.build[i];
	          debug('build compare', i, a, b);
	          if (a === undefined && b === undefined) {
	            return 0;
	          } else if (b === undefined) {
	            return 1;
	          } else if (a === undefined) {
	            return -1;
	          } else if (a === b) {
	            continue;
	          } else {
	            return compareIdentifiers(a, b);
	          }
	        } while (++i);
	      }
	    }, {
	      key: "inc",
	      value: function inc(release, identifier, identifierBase) {
	        if (release.startsWith('pre')) {
	          if (!identifier && identifierBase === false) {
	            throw new Error('invalid increment argument: identifier is empty');
	          }
	          if (identifier) {
	            var match = "-".concat(identifier).match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
	            if (!match || match[1] !== identifier) {
	              throw new Error("invalid identifier: ".concat(identifier));
	            }
	          }
	        }
	        switch (release) {
	          case 'premajor':
	            this.prerelease.length = 0;
	            this.patch = 0;
	            this.minor = 0;
	            this.major++;
	            this.inc('pre', identifier, identifierBase);
	            break;
	          case 'preminor':
	            this.prerelease.length = 0;
	            this.patch = 0;
	            this.minor++;
	            this.inc('pre', identifier, identifierBase);
	            break;
	          case 'prepatch':
	            this.prerelease.length = 0;
	            this.inc('patch', identifier, identifierBase);
	            this.inc('pre', identifier, identifierBase);
	            break;
	          case 'prerelease':
	            if (this.prerelease.length === 0) {
	              this.inc('patch', identifier, identifierBase);
	            }
	            this.inc('pre', identifier, identifierBase);
	            break;
	          case 'release':
	            if (this.prerelease.length === 0) {
	              throw new Error("version ".concat(this.raw, " is not a prerelease"));
	            }
	            this.prerelease.length = 0;
	            break;
	          case 'major':
	            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
	              this.major++;
	            }
	            this.minor = 0;
	            this.patch = 0;
	            this.prerelease = [];
	            break;
	          case 'minor':
	            if (this.patch !== 0 || this.prerelease.length === 0) {
	              this.minor++;
	            }
	            this.patch = 0;
	            this.prerelease = [];
	            break;
	          case 'patch':
	            if (this.prerelease.length === 0) {
	              this.patch++;
	            }
	            this.prerelease = [];
	            break;
	          case 'pre':
	            {
	              var base = Number(identifierBase) ? 1 : 0;
	              if (this.prerelease.length === 0) {
	                this.prerelease = [base];
	              } else {
	                var i = this.prerelease.length;
	                while (--i >= 0) {
	                  if (typeof this.prerelease[i] === 'number') {
	                    this.prerelease[i]++;
	                    i = -2;
	                  }
	                }
	                if (i === -1) {
	                  if (identifier === this.prerelease.join('.') && identifierBase === false) {
	                    throw new Error('invalid increment argument: identifier already exists');
	                  }
	                  this.prerelease.push(base);
	                }
	              }
	              if (identifier) {
	                var prerelease = [identifier, base];
	                if (identifierBase === false) {
	                  prerelease = [identifier];
	                }
	                if (isPrereleaseIdentifier(this.prerelease, identifier)) {
	                  var prereleaseBase = this.prerelease[identifier.split('.').length];
	                  if (isNaN(prereleaseBase)) {
	                    this.prerelease = prerelease;
	                  }
	                } else {
	                  this.prerelease = prerelease;
	                }
	              }
	              break;
	            }
	          default:
	            throw new Error("invalid increment argument: ".concat(release));
	        }
	        this.raw = this.format();
	        if (this.build.length) {
	          this.raw += "+".concat(this.build.join('.'));
	        }
	        return this;
	      }
	    }]);
	  }();
	  semver$1 = SemVer;
	  return semver$1;
	}

	var parse_1;
	var hasRequiredParse;
	function requireParse() {
	  if (hasRequiredParse) return parse_1;
	  hasRequiredParse = 1;
	  var SemVer = requireSemver();
	  var parse = function parse(version, options) {
	    var throwErrors = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	    if (version instanceof SemVer) {
	      return version;
	    }
	    try {
	      return new SemVer(version, options);
	    } catch (er) {
	      if (!throwErrors) {
	        return null;
	      }
	      throw er;
	    }
	  };
	  parse_1 = parse;
	  return parse_1;
	}

	var valid_1;
	var hasRequiredValid;
	function requireValid() {
	  if (hasRequiredValid) return valid_1;
	  hasRequiredValid = 1;
	  var parse = requireParse();
	  var valid = function valid(version, options) {
	    var v = parse(version, options);
	    return v ? v.version : null;
	  };
	  valid_1 = valid;
	  return valid_1;
	}

	var validExports = requireValid();
	var valid = /*@__PURE__*/getDefaultExportFromCjs(validExports);

	var coerce_1;
	var hasRequiredCoerce;
	function requireCoerce() {
	  if (hasRequiredCoerce) return coerce_1;
	  hasRequiredCoerce = 1;
	  var SemVer = requireSemver();
	  var parse = requireParse();
	  var _require$$ = requireRe(),
	    re = _require$$.safeRe,
	    t = _require$$.t;
	  var coerce = function coerce(version, options) {
	    if (version instanceof SemVer) {
	      return version;
	    }
	    if (typeof version === 'number') {
	      version = String(version);
	    }
	    if (typeof version !== 'string') {
	      return null;
	    }
	    options = options || {};
	    var match = null;
	    if (!options.rtl) {
	      match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
	    } else {
	      var coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
	      var next;
	      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
	        if (!match || next.index + next[0].length !== match.index + match[0].length) {
	          match = next;
	        }
	        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
	      }
	      coerceRtlRegex.lastIndex = -1;
	    }
	    if (match === null) {
	      return null;
	    }
	    var major = match[2];
	    var minor = match[3] || '0';
	    var patch = match[4] || '0';
	    var prerelease = options.includePrerelease && match[5] ? "-".concat(match[5]) : '';
	    var build = options.includePrerelease && match[6] ? "+".concat(match[6]) : '';
	    return parse("".concat(major, ".").concat(minor, ".").concat(patch).concat(prerelease).concat(build), options);
	  };
	  coerce_1 = coerce;
	  return coerce_1;
	}

	var coerceExports = requireCoerce();
	var coerce = /*@__PURE__*/getDefaultExportFromCjs(coerceExports);

	var lrucache;
	var hasRequiredLrucache;
	function requireLrucache() {
	  if (hasRequiredLrucache) return lrucache;
	  hasRequiredLrucache = 1;
	  var LRUCache = function () {
	    function LRUCache() {
	      _classCallCheck(this, LRUCache);
	      this.max = 1000;
	      this.map = new Map();
	    }
	    return _createClass(LRUCache, [{
	      key: "get",
	      value: function get(key) {
	        var value = this.map.get(key);
	        if (value === undefined) {
	          return undefined;
	        } else {
	          this.map.delete(key);
	          this.map.set(key, value);
	          return value;
	        }
	      }
	    }, {
	      key: "delete",
	      value: function _delete(key) {
	        return this.map.delete(key);
	      }
	    }, {
	      key: "set",
	      value: function set(key, value) {
	        var deleted = this.delete(key);
	        if (!deleted && value !== undefined) {
	          if (this.map.size >= this.max) {
	            var firstKey = this.map.keys().next().value;
	            this.delete(firstKey);
	          }
	          this.map.set(key, value);
	        }
	        return this;
	      }
	    }]);
	  }();
	  lrucache = LRUCache;
	  return lrucache;
	}

	var compare_1;
	var hasRequiredCompare;
	function requireCompare() {
	  if (hasRequiredCompare) return compare_1;
	  hasRequiredCompare = 1;
	  var SemVer = requireSemver();
	  var compare = function compare(a, b, loose) {
	    return new SemVer(a, loose).compare(new SemVer(b, loose));
	  };
	  compare_1 = compare;
	  return compare_1;
	}

	var eq_1;
	var hasRequiredEq;
	function requireEq() {
	  if (hasRequiredEq) return eq_1;
	  hasRequiredEq = 1;
	  var compare = requireCompare();
	  var eq = function eq(a, b, loose) {
	    return compare(a, b, loose) === 0;
	  };
	  eq_1 = eq;
	  return eq_1;
	}

	var neq_1;
	var hasRequiredNeq;
	function requireNeq() {
	  if (hasRequiredNeq) return neq_1;
	  hasRequiredNeq = 1;
	  var compare = requireCompare();
	  var neq = function neq(a, b, loose) {
	    return compare(a, b, loose) !== 0;
	  };
	  neq_1 = neq;
	  return neq_1;
	}

	var gt_1;
	var hasRequiredGt;
	function requireGt() {
	  if (hasRequiredGt) return gt_1;
	  hasRequiredGt = 1;
	  var compare = requireCompare();
	  var gt = function gt(a, b, loose) {
	    return compare(a, b, loose) > 0;
	  };
	  gt_1 = gt;
	  return gt_1;
	}

	var gte_1;
	var hasRequiredGte;
	function requireGte() {
	  if (hasRequiredGte) return gte_1;
	  hasRequiredGte = 1;
	  var compare = requireCompare();
	  var gte = function gte(a, b, loose) {
	    return compare(a, b, loose) >= 0;
	  };
	  gte_1 = gte;
	  return gte_1;
	}

	var lt_1;
	var hasRequiredLt;
	function requireLt() {
	  if (hasRequiredLt) return lt_1;
	  hasRequiredLt = 1;
	  var compare = requireCompare();
	  var lt = function lt(a, b, loose) {
	    return compare(a, b, loose) < 0;
	  };
	  lt_1 = lt;
	  return lt_1;
	}

	var lte_1;
	var hasRequiredLte;
	function requireLte() {
	  if (hasRequiredLte) return lte_1;
	  hasRequiredLte = 1;
	  var compare = requireCompare();
	  var lte = function lte(a, b, loose) {
	    return compare(a, b, loose) <= 0;
	  };
	  lte_1 = lte;
	  return lte_1;
	}

	var cmp_1;
	var hasRequiredCmp;
	function requireCmp() {
	  if (hasRequiredCmp) return cmp_1;
	  hasRequiredCmp = 1;
	  var eq = requireEq();
	  var neq = requireNeq();
	  var gt = requireGt();
	  var gte = requireGte();
	  var lt = requireLt();
	  var lte = requireLte();
	  var cmp = function cmp(a, op, b, loose) {
	    switch (op) {
	      case '===':
	        if (_typeof(a) === 'object') {
	          a = a.version;
	        }
	        if (_typeof(b) === 'object') {
	          b = b.version;
	        }
	        return a === b;
	      case '!==':
	        if (_typeof(a) === 'object') {
	          a = a.version;
	        }
	        if (_typeof(b) === 'object') {
	          b = b.version;
	        }
	        return a !== b;
	      case '':
	      case '=':
	      case '==':
	        return eq(a, b, loose);
	      case '!=':
	        return neq(a, b, loose);
	      case '>':
	        return gt(a, b, loose);
	      case '>=':
	        return gte(a, b, loose);
	      case '<':
	        return lt(a, b, loose);
	      case '<=':
	        return lte(a, b, loose);
	      default:
	        throw new TypeError("Invalid operator: ".concat(op));
	    }
	  };
	  cmp_1 = cmp;
	  return cmp_1;
	}

	var comparator;
	var hasRequiredComparator;
	function requireComparator() {
	  if (hasRequiredComparator) return comparator;
	  hasRequiredComparator = 1;
	  var ANY = Symbol('SemVer ANY');
	  var Comparator = function () {
	    function Comparator(comp, options) {
	      _classCallCheck(this, Comparator);
	      options = parseOptions(options);
	      if (comp instanceof Comparator) {
	        if (comp.loose === !!options.loose) {
	          return comp;
	        } else {
	          comp = comp.value;
	        }
	      }
	      comp = comp.trim().split(/\s+/).join(' ');
	      debug('comparator', comp, options);
	      this.options = options;
	      this.loose = !!options.loose;
	      this.parse(comp);
	      if (this.semver === ANY) {
	        this.value = '';
	      } else {
	        this.value = this.operator + this.semver.version;
	      }
	      debug('comp', this);
	    }
	    return _createClass(Comparator, [{
	      key: "parse",
	      value: function parse(comp) {
	        var r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
	        var m = comp.match(r);
	        if (!m) {
	          throw new TypeError("Invalid comparator: ".concat(comp));
	        }
	        this.operator = m[1] !== undefined ? m[1] : '';
	        if (this.operator === '=') {
	          this.operator = '';
	        }
	        if (!m[2]) {
	          this.semver = ANY;
	        } else {
	          this.semver = new SemVer(m[2], this.options.loose);
	        }
	      }
	    }, {
	      key: "toString",
	      value: function toString() {
	        return this.value;
	      }
	    }, {
	      key: "test",
	      value: function test(version) {
	        debug('Comparator.test', version, this.options.loose);
	        if (this.semver === ANY || version === ANY) {
	          return true;
	        }
	        if (typeof version === 'string') {
	          try {
	            version = new SemVer(version, this.options);
	          } catch (er) {
	            return false;
	          }
	        }
	        return cmp(version, this.operator, this.semver, this.options);
	      }
	    }, {
	      key: "intersects",
	      value: function intersects(comp, options) {
	        if (!(comp instanceof Comparator)) {
	          throw new TypeError('a Comparator is required');
	        }
	        if (this.operator === '') {
	          if (this.value === '') {
	            return true;
	          }
	          return new Range(comp.value, options).test(this.value);
	        } else if (comp.operator === '') {
	          if (comp.value === '') {
	            return true;
	          }
	          return new Range(this.value, options).test(comp.semver);
	        }
	        options = parseOptions(options);
	        if (options.includePrerelease && (this.value === '<0.0.0-0' || comp.value === '<0.0.0-0')) {
	          return false;
	        }
	        if (!options.includePrerelease && (this.value.startsWith('<0.0.0') || comp.value.startsWith('<0.0.0'))) {
	          return false;
	        }
	        if (this.operator.startsWith('>') && comp.operator.startsWith('>')) {
	          return true;
	        }
	        if (this.operator.startsWith('<') && comp.operator.startsWith('<')) {
	          return true;
	        }
	        if (this.semver.version === comp.semver.version && this.operator.includes('=') && comp.operator.includes('=')) {
	          return true;
	        }
	        if (cmp(this.semver, '<', comp.semver, options) && this.operator.startsWith('>') && comp.operator.startsWith('<')) {
	          return true;
	        }
	        if (cmp(this.semver, '>', comp.semver, options) && this.operator.startsWith('<') && comp.operator.startsWith('>')) {
	          return true;
	        }
	        return false;
	      }
	    }], [{
	      key: "ANY",
	      get: function get() {
	        return ANY;
	      }
	    }]);
	  }();
	  comparator = Comparator;
	  var parseOptions = requireParseOptions();
	  var _require$$ = requireRe(),
	    re = _require$$.safeRe,
	    t = _require$$.t;
	  var cmp = requireCmp();
	  var debug = requireDebug();
	  var SemVer = requireSemver();
	  var Range = requireRange();
	  return comparator;
	}

	var range;
	var hasRequiredRange;
	function requireRange() {
	  if (hasRequiredRange) return range;
	  hasRequiredRange = 1;
	  var SPACE_CHARACTERS = /\s+/g;
	  var Range = function () {
	    function Range(range, options) {
	      var _this = this;
	      _classCallCheck(this, Range);
	      options = parseOptions(options);
	      if (range instanceof Range) {
	        if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
	          return range;
	        } else {
	          return new Range(range.raw, options);
	        }
	      }
	      if (range instanceof Comparator) {
	        this.raw = range.value;
	        this.set = [[range]];
	        this.formatted = undefined;
	        return this;
	      }
	      this.options = options;
	      this.loose = !!options.loose;
	      this.includePrerelease = !!options.includePrerelease;
	      this.raw = range.trim().replace(SPACE_CHARACTERS, ' ');
	      this.set = this.raw.split('||').map(function (r) {
	        return _this.parseRange(r.trim());
	      }).filter(function (c) {
	        return c.length;
	      });
	      if (!this.set.length) {
	        throw new TypeError("Invalid SemVer Range: ".concat(this.raw));
	      }
	      if (this.set.length > 1) {
	        var first = this.set[0];
	        this.set = this.set.filter(function (c) {
	          return !isNullSet(c[0]);
	        });
	        if (this.set.length === 0) {
	          this.set = [first];
	        } else if (this.set.length > 1) {
	          var _iterator = _createForOfIteratorHelper(this.set),
	            _step;
	          try {
	            for (_iterator.s(); !(_step = _iterator.n()).done;) {
	              var c = _step.value;
	              if (c.length === 1 && isAny(c[0])) {
	                this.set = [c];
	                break;
	              }
	            }
	          } catch (err) {
	            _iterator.e(err);
	          } finally {
	            _iterator.f();
	          }
	        }
	      }
	      this.formatted = undefined;
	    }
	    return _createClass(Range, [{
	      key: "range",
	      get: function get() {
	        if (this.formatted === undefined) {
	          this.formatted = '';
	          for (var i = 0; i < this.set.length; i++) {
	            if (i > 0) {
	              this.formatted += '||';
	            }
	            var comps = this.set[i];
	            for (var k = 0; k < comps.length; k++) {
	              if (k > 0) {
	                this.formatted += ' ';
	              }
	              this.formatted += comps[k].toString().trim();
	            }
	          }
	        }
	        return this.formatted;
	      }
	    }, {
	      key: "format",
	      value: function format() {
	        return this.range;
	      }
	    }, {
	      key: "toString",
	      value: function toString() {
	        return this.range;
	      }
	    }, {
	      key: "parseRange",
	      value: function parseRange(range) {
	        var _this2 = this;
	        range = range.replace(BUILDSTRIPRE, '');
	        var memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
	        var memoKey = memoOpts + ':' + range;
	        var cached = cache.get(memoKey);
	        if (cached) {
	          return cached;
	        }
	        var loose = this.options.loose;
	        var hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
	        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
	        debug('hyphen replace', range);
	        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
	        debug('comparator trim', range);
	        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
	        debug('tilde trim', range);
	        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
	        debug('caret trim', range);
	        var rangeList = range.split(' ').map(function (comp) {
	          return parseComparator(comp, _this2.options);
	        }).join(' ').split(/\s+/).map(function (comp) {
	          return replaceGTE0(comp, _this2.options);
	        });
	        if (loose) {
	          rangeList = rangeList.filter(function (comp) {
	            debug('loose invalid filter', comp, _this2.options);
	            return !!comp.match(re[t.COMPARATORLOOSE]);
	          });
	        }
	        debug('range list', rangeList);
	        var rangeMap = new Map();
	        var comparators = rangeList.map(function (comp) {
	          return new Comparator(comp, _this2.options);
	        });
	        var _iterator2 = _createForOfIteratorHelper(comparators),
	          _step2;
	        try {
	          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	            var comp = _step2.value;
	            if (isNullSet(comp)) {
	              return [comp];
	            }
	            rangeMap.set(comp.value, comp);
	          }
	        } catch (err) {
	          _iterator2.e(err);
	        } finally {
	          _iterator2.f();
	        }
	        if (rangeMap.size > 1 && rangeMap.has('')) {
	          rangeMap.delete('');
	        }
	        var result = _toConsumableArray(rangeMap.values());
	        cache.set(memoKey, result);
	        return result;
	      }
	    }, {
	      key: "intersects",
	      value: function intersects(range, options) {
	        if (!(range instanceof Range)) {
	          throw new TypeError('a Range is required');
	        }
	        return this.set.some(function (thisComparators) {
	          return isSatisfiable(thisComparators, options) && range.set.some(function (rangeComparators) {
	            return isSatisfiable(rangeComparators, options) && thisComparators.every(function (thisComparator) {
	              return rangeComparators.every(function (rangeComparator) {
	                return thisComparator.intersects(rangeComparator, options);
	              });
	            });
	          });
	        });
	      }
	    }, {
	      key: "test",
	      value: function test(version) {
	        if (!version) {
	          return false;
	        }
	        if (typeof version === 'string') {
	          try {
	            version = new SemVer(version, this.options);
	          } catch (er) {
	            return false;
	          }
	        }
	        for (var i = 0; i < this.set.length; i++) {
	          if (testSet(this.set[i], version, this.options)) {
	            return true;
	          }
	        }
	        return false;
	      }
	    }]);
	  }();
	  range = Range;
	  var LRU = requireLrucache();
	  var cache = new LRU();
	  var parseOptions = requireParseOptions();
	  var Comparator = requireComparator();
	  var debug = requireDebug();
	  var SemVer = requireSemver();
	  var _require$$ = requireRe(),
	    re = _require$$.safeRe,
	    src = _require$$.src,
	    t = _require$$.t,
	    comparatorTrimReplace = _require$$.comparatorTrimReplace,
	    tildeTrimReplace = _require$$.tildeTrimReplace,
	    caretTrimReplace = _require$$.caretTrimReplace;
	  var _require$$2 = requireConstants(),
	    FLAG_INCLUDE_PRERELEASE = _require$$2.FLAG_INCLUDE_PRERELEASE,
	    FLAG_LOOSE = _require$$2.FLAG_LOOSE;
	  var BUILDSTRIPRE = new RegExp(src[t.BUILD], 'g');
	  var isNullSet = function isNullSet(c) {
	    return c.value === '<0.0.0-0';
	  };
	  var isAny = function isAny(c) {
	    return c.value === '';
	  };
	  var isSatisfiable = function isSatisfiable(comparators, options) {
	    var result = true;
	    var remainingComparators = comparators.slice();
	    var testComparator = remainingComparators.pop();
	    while (result && remainingComparators.length) {
	      result = remainingComparators.every(function (otherComparator) {
	        return testComparator.intersects(otherComparator, options);
	      });
	      testComparator = remainingComparators.pop();
	    }
	    return result;
	  };
	  var parseComparator = function parseComparator(comp, options) {
	    comp = comp.replace(re[t.BUILD], '');
	    debug('comp', comp, options);
	    comp = replaceCarets(comp, options);
	    debug('caret', comp);
	    comp = replaceTildes(comp, options);
	    debug('tildes', comp);
	    comp = replaceXRanges(comp, options);
	    debug('xrange', comp);
	    comp = replaceStars(comp, options);
	    debug('stars', comp);
	    return comp;
	  };
	  var isX = function isX(id) {
	    return !id || id.toLowerCase() === 'x' || id === '*';
	  };
	  var invalidXRangeOrder = function invalidXRangeOrder(M, m, p) {
	    return isX(M) && !isX(m) || isX(m) && p && !isX(p);
	  };
	  var replaceTildes = function replaceTildes(comp, options) {
	    return comp.trim().split(/\s+/).map(function (c) {
	      return replaceTilde(c, options);
	    }).join(' ');
	  };
	  var replaceTilde = function replaceTilde(comp, options) {
	    var r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
	    var z = options.includePrerelease ? '-0' : '';
	    return comp.replace(r, function (_, M, m, p, pr) {
	      debug('tilde', comp, _, M, m, p, pr);
	      var ret;
	      if (isX(M)) {
	        ret = '';
	      } else if (isX(m)) {
	        ret = ">=".concat(M, ".0.0").concat(z, " <").concat(+M + 1, ".0.0-0");
	      } else if (isX(p)) {
	        ret = ">=".concat(M, ".").concat(m, ".0").concat(z, " <").concat(M, ".").concat(+m + 1, ".0-0");
	      } else if (pr) {
	        debug('replaceTilde pr', pr);
	        ret = ">=".concat(M, ".").concat(m, ".").concat(p, "-").concat(pr, " <").concat(M, ".").concat(+m + 1, ".0-0");
	      } else {
	        ret = ">=".concat(M, ".").concat(m, ".").concat(p, " <").concat(M, ".").concat(+m + 1, ".0-0");
	      }
	      debug('tilde return', ret);
	      return ret;
	    });
	  };
	  var replaceCarets = function replaceCarets(comp, options) {
	    return comp.trim().split(/\s+/).map(function (c) {
	      return replaceCaret(c, options);
	    }).join(' ');
	  };
	  var replaceCaret = function replaceCaret(comp, options) {
	    debug('caret', comp, options);
	    var r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
	    var z = options.includePrerelease ? '-0' : '';
	    return comp.replace(r, function (_, M, m, p, pr) {
	      debug('caret', comp, _, M, m, p, pr);
	      var ret;
	      if (isX(M)) {
	        ret = '';
	      } else if (isX(m)) {
	        ret = ">=".concat(M, ".0.0").concat(z, " <").concat(+M + 1, ".0.0-0");
	      } else if (isX(p)) {
	        if (M === '0') {
	          ret = ">=".concat(M, ".").concat(m, ".0").concat(z, " <").concat(M, ".").concat(+m + 1, ".0-0");
	        } else {
	          ret = ">=".concat(M, ".").concat(m, ".0").concat(z, " <").concat(+M + 1, ".0.0-0");
	        }
	      } else if (pr) {
	        debug('replaceCaret pr', pr);
	        if (M === '0') {
	          if (m === '0') {
	            ret = ">=".concat(M, ".").concat(m, ".").concat(p, "-").concat(pr, " <").concat(M, ".").concat(m, ".").concat(+p + 1, "-0");
	          } else {
	            ret = ">=".concat(M, ".").concat(m, ".").concat(p, "-").concat(pr, " <").concat(M, ".").concat(+m + 1, ".0-0");
	          }
	        } else {
	          ret = ">=".concat(M, ".").concat(m, ".").concat(p, "-").concat(pr, " <").concat(+M + 1, ".0.0-0");
	        }
	      } else {
	        debug('no pr');
	        if (M === '0') {
	          if (m === '0') {
	            ret = ">=".concat(M, ".").concat(m, ".").concat(p, " <").concat(M, ".").concat(m, ".").concat(+p + 1, "-0");
	          } else {
	            ret = ">=".concat(M, ".").concat(m, ".").concat(p, " <").concat(M, ".").concat(+m + 1, ".0-0");
	          }
	        } else {
	          ret = ">=".concat(M, ".").concat(m, ".").concat(p, " <").concat(+M + 1, ".0.0-0");
	        }
	      }
	      debug('caret return', ret);
	      return ret;
	    });
	  };
	  var replaceXRanges = function replaceXRanges(comp, options) {
	    debug('replaceXRanges', comp, options);
	    return comp.split(/\s+/).map(function (c) {
	      return replaceXRange(c, options);
	    }).join(' ');
	  };
	  var replaceXRange = function replaceXRange(comp, options) {
	    comp = comp.trim();
	    var r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
	    return comp.replace(r, function (ret, gtlt, M, m, p, pr) {
	      debug('xRange', comp, ret, gtlt, M, m, p, pr);
	      if (invalidXRangeOrder(M, m, p)) {
	        return comp;
	      }
	      var xM = isX(M);
	      var xm = xM || isX(m);
	      var xp = xm || isX(p);
	      var anyX = xp;
	      if (gtlt === '=' && anyX) {
	        gtlt = '';
	      }
	      pr = options.includePrerelease ? '-0' : '';
	      if (xM) {
	        if (gtlt === '>' || gtlt === '<') {
	          ret = '<0.0.0-0';
	        } else {
	          ret = '*';
	        }
	      } else if (gtlt && anyX) {
	        if (xm) {
	          m = 0;
	        }
	        p = 0;
	        if (gtlt === '>') {
	          gtlt = '>=';
	          if (xm) {
	            M = +M + 1;
	            m = 0;
	            p = 0;
	          } else {
	            m = +m + 1;
	            p = 0;
	          }
	        } else if (gtlt === '<=') {
	          gtlt = '<';
	          if (xm) {
	            M = +M + 1;
	          } else {
	            m = +m + 1;
	          }
	        }
	        if (gtlt === '<') {
	          pr = '-0';
	        }
	        ret = "".concat(gtlt + M, ".").concat(m, ".").concat(p).concat(pr);
	      } else if (xm) {
	        ret = ">=".concat(M, ".0.0").concat(pr, " <").concat(+M + 1, ".0.0-0");
	      } else if (xp) {
	        ret = ">=".concat(M, ".").concat(m, ".0").concat(pr, " <").concat(M, ".").concat(+m + 1, ".0-0");
	      }
	      debug('xRange return', ret);
	      return ret;
	    });
	  };
	  var replaceStars = function replaceStars(comp, options) {
	    debug('replaceStars', comp, options);
	    return comp.trim().replace(re[t.STAR], '');
	  };
	  var replaceGTE0 = function replaceGTE0(comp, options) {
	    debug('replaceGTE0', comp, options);
	    return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], '');
	  };
	  var hyphenReplace = function hyphenReplace(incPr) {
	    return function ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) {
	      if (isX(fM)) {
	        from = '';
	      } else if (isX(fm)) {
	        from = ">=".concat(fM, ".0.0").concat(incPr ? '-0' : '');
	      } else if (isX(fp)) {
	        from = ">=".concat(fM, ".").concat(fm, ".0").concat(incPr ? '-0' : '');
	      } else if (fpr) {
	        from = ">=".concat(from);
	      } else {
	        from = ">=".concat(from).concat(incPr ? '-0' : '');
	      }
	      if (isX(tM)) {
	        to = '';
	      } else if (isX(tm)) {
	        to = "<".concat(+tM + 1, ".0.0-0");
	      } else if (isX(tp)) {
	        to = "<".concat(tM, ".").concat(+tm + 1, ".0-0");
	      } else if (tpr) {
	        to = "<=".concat(tM, ".").concat(tm, ".").concat(tp, "-").concat(tpr);
	      } else if (incPr) {
	        to = "<".concat(tM, ".").concat(tm, ".").concat(+tp + 1, "-0");
	      } else {
	        to = "<=".concat(to);
	      }
	      return "".concat(from, " ").concat(to).trim();
	    };
	  };
	  var testSet = function testSet(set, version, options) {
	    for (var i = 0; i < set.length; i++) {
	      if (!set[i].test(version)) {
	        return false;
	      }
	    }
	    if (version.prerelease.length && !options.includePrerelease) {
	      for (var _i = 0; _i < set.length; _i++) {
	        debug(set[_i].semver);
	        if (set[_i].semver === Comparator.ANY) {
	          continue;
	        }
	        if (set[_i].semver.prerelease.length > 0) {
	          var allowed = set[_i].semver;
	          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
	            return true;
	          }
	        }
	      }
	      return false;
	    }
	    return true;
	  };
	  return range;
	}

	var satisfies_1;
	var hasRequiredSatisfies;
	function requireSatisfies() {
	  if (hasRequiredSatisfies) return satisfies_1;
	  hasRequiredSatisfies = 1;
	  var Range = requireRange();
	  var satisfies = function satisfies(version, range, options) {
	    try {
	      range = new Range(range, options);
	    } catch (er) {
	      return false;
	    }
	    return range.test(version);
	  };
	  satisfies_1 = satisfies;
	  return satisfies_1;
	}

	var satisfiesExports = requireSatisfies();
	var satisfies = /*@__PURE__*/getDefaultExportFromCjs(satisfiesExports);

	var semver = {
	  valid: valid,
	  coerce: coerce,
	  satisfies: satisfies,
	  SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION
	};

	var VERTEX_SIZE = 6;
	var BLEND_STATES = [[pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE_MINUS_SRC_ALPHA, pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE_MINUS_SRC_ALPHA], [pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE], [pc__namespace.BLENDMODE_DST_COLOR, pc__namespace.BLENDMODE_ONE_MINUS_SRC_ALPHA, pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE_MINUS_SRC_ALPHA], [pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE_MINUS_SRC_COLOR, pc__namespace.BLENDMODE_ONE, pc__namespace.BLENDMODE_ONE_MINUS_SRC_COLOR]].map(function (_ref) {
	  var _ref2 = _slicedToArray(_ref, 4),
	    colorSrc = _ref2[0],
	    colorDst = _ref2[1],
	    alphaSrc = _ref2[2],
	    alphaDst = _ref2[3];
	  return new pc__namespace.BlendState(true, pc__namespace.BLENDEQUATION_ADD, colorSrc, colorDst, pc__namespace.BLENDEQUATION_ADD, alphaSrc, alphaDst);
	});
	var SHADER_DESC = {
	  uniqueName: 'spine43',
	  vertexGLSL: vertexGLSL,
	  fragmentGLSL: fragmentGLSL,
	  vertexWGSL: vertexWGSL,
	  fragmentWGSL: fragmentWGSL,
	  attributes: {
	    vertex_position: pc__namespace.SEMANTIC_POSITION,
	    vertex_texCoord0: pc__namespace.SEMANTIC_TEXCOORD0,
	    vertex_color: pc__namespace.SEMANTIC_COLOR,
	    vertex_darkColor: pc__namespace.SEMANTIC_ATTR8
	  }
	};
	var toRGBA = function toRGBA(color) {
	  return (color & 0xff00ff00 | color >> 16 & 0xff | (color & 0xff) << 16) >>> 0;
	};
	var warnings = new Set();
	var warnOnce = function warnOnce(message) {
	  if (!warnings.has(message)) {
	    warnings.add(message);
	    console.warn(message);
	  }
	};
	var Spine = function () {
	  function Spine(app, atlasData, skeletonData, textureData) {
	    _classCallCheck(this, Spine);
	    _defineProperty(this, "autoUpdate", true);
	    _defineProperty(this, "skeleton", void 0);
	    _defineProperty(this, "states", void 0);
	    this._app = app;
	    this._position = new pc__namespace.Vec3();
	    var atlas = new TextureAtlas(atlasData);
	    var _iterator = _createForOfIteratorHelper(atlas.pages),
	      _step;
	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var page = _step.value;
	        var texture = new SpineTextureWrapper(textureData[page.name]);
	        page.setTexture(texture);
	        texture.premultipliedAlpha = page.pma;
	        if (texture.pcTexture.srgb) {
	          warnOnce("playcanvas-spine: the texture '".concat(page.name, "' is sRGB, so the skeleton will not render with the right colors. Load Spine atlas textures with sRGB disabled."));
	        }
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	    var json = new SkeletonJson(new AtlasAttachmentLoader(atlas));
	    json.scale *= 0.01;
	    var _skeletonData = json.readSkeletonData(skeletonData);
	    this.skeletonVersion = semver.valid(semver.coerce(_skeletonData.version));
	    this.skeleton = new Skeleton(_skeletonData);
	    this.skeleton.updateWorldTransform(Physics.update);
	    this.stateData = new AnimationStateData(this.skeleton.data);
	    this.states = [new AnimationState(this.stateData)];
	    this._renderer = new SkeletonRendererCore();
	    this._node = new pc__namespace.GraphNode();
	    this._aabb = new pc__namespace.BoundingBox();
	    this._aabbMin = new pc__namespace.Vec3();
	    this._aabbMax = new pc__namespace.Vec3();
	    this._renderCounts = {
	      vertexCount: 0,
	      indexCount: 0
	    };
	    this._vertexFormat = new pc__namespace.VertexFormat(app.graphicsDevice, [{
	      semantic: pc__namespace.SEMANTIC_POSITION,
	      components: 2,
	      type: pc__namespace.TYPE_FLOAT32
	    }, {
	      semantic: pc__namespace.SEMANTIC_TEXCOORD0,
	      components: 2,
	      type: pc__namespace.TYPE_FLOAT32
	    }, {
	      semantic: pc__namespace.SEMANTIC_COLOR,
	      components: 4,
	      type: pc__namespace.TYPE_UINT8,
	      normalize: true
	    }, {
	      semantic: pc__namespace.SEMANTIC_ATTR8,
	      components: 4,
	      type: pc__namespace.TYPE_UINT8,
	      normalize: true
	    }]);
	    this._vertexBuffer = null;
	    this._indexBuffer = null;
	    this._floats = null;
	    this._uints = null;
	    this._indices = null;
	    this._meshInstances = [];
	    this._meshInstancePool = [];
	    this._materials = new Map();
	    this._priority = 0;
	    this._timeScale = 1;
	    this._layers = [pc__namespace.LAYERID_UI];
	    this._hidden = false;
	  }
	  return _createClass(Spine, [{
	    key: "destroy",
	    value: function destroy() {
	      var _this$_vertexBuffer, _this$_indexBuffer;
	      this.removeFromLayers();
	      var _iterator2 = _createForOfIteratorHelper(this._meshInstancePool),
	        _step2;
	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var meshInstance = _step2.value;
	          var mesh = meshInstance.mesh;
	          mesh.vertexBuffer = null;
	          mesh.indexBuffer[0] = null;
	          meshInstance.destroy();
	          mesh.destroy();
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }
	      this._meshInstancePool.length = 0;
	      this._meshInstances.length = 0;
	      (_this$_vertexBuffer = this._vertexBuffer) === null || _this$_vertexBuffer === void 0 || _this$_vertexBuffer.destroy();
	      this._vertexBuffer = null;
	      (_this$_indexBuffer = this._indexBuffer) === null || _this$_indexBuffer === void 0 || _this$_indexBuffer.destroy();
	      this._indexBuffer = null;
	      var _iterator3 = _createForOfIteratorHelper(this._materials.values()),
	        _step3;
	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var materials = _step3.value;
	          materials.forEach(function (material) {
	            return material === null || material === void 0 ? void 0 : material.destroy();
	          });
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	      this._materials.clear();
	      this.skeleton = null;
	      this.stateData = null;
	      this._node = null;
	    }
	  }, {
	    key: "hide",
	    value: function hide() {
	      if (this._hidden) return;
	      this._hidden = true;
	      this._meshInstancePool.forEach(function (meshInstance) {
	        meshInstance.visible = false;
	      });
	    }
	  }, {
	    key: "show",
	    value: function show() {
	      if (!this._hidden) return;
	      this._hidden = false;
	      this._meshInstancePool.forEach(function (meshInstance) {
	        meshInstance.visible = true;
	      });
	    }
	  }, {
	    key: "_getMaterial",
	    value: function _getMaterial(texture, blendMode) {
	      var materials = this._materials.get(texture);
	      if (!materials) {
	        materials = [];
	        this._materials.set(texture, materials);
	      }
	      var material = materials[blendMode];
	      if (!material) {
	        var pcTexture = texture.pcTexture;
	        material = new pc__namespace.ShaderMaterial(SHADER_DESC);
	        material.setParameter('uTexture', pcTexture);
	        material.setParameter('uPremultiply', texture.premultipliedAlpha ? 0 : 1);
	        material.blendState = BLEND_STATES[blendMode];
	        material.depthWrite = false;
	        material.cull = pc__namespace.CULLFACE_NONE;
	        material.update();
	        materials[blendMode] = material;
	      }
	      return material;
	    }
	  }, {
	    key: "_allocateBuffers",
	    value: function _allocateBuffers(numVertices, numIndices) {
	      var device = this._app.graphicsDevice;
	      if (!this._vertexBuffer || this._vertexBuffer.getNumVertices() < numVertices) {
	        var _this$_vertexBuffer2;
	        (_this$_vertexBuffer2 = this._vertexBuffer) === null || _this$_vertexBuffer2 === void 0 || _this$_vertexBuffer2.destroy();
	        this._vertexBuffer = new pc__namespace.VertexBuffer(device, this._vertexFormat, Math.ceil(numVertices * 1.5), {
	          usage: pc__namespace.BUFFER_DYNAMIC
	        });
	        var storage = this._vertexBuffer.lock();
	        this._floats = new Float32Array(storage);
	        this._uints = new Uint32Array(storage);
	      }
	      var capacity = this._vertexBuffer.getNumVertices();
	      var format = capacity > 0x10000 ? pc__namespace.INDEXFORMAT_UINT32 : pc__namespace.INDEXFORMAT_UINT16;
	      if (!this._indexBuffer || this._indexBuffer.getNumIndices() < numIndices || this._indexBuffer.getFormat() !== format) {
	        var _this$_indexBuffer2;
	        (_this$_indexBuffer2 = this._indexBuffer) === null || _this$_indexBuffer2 === void 0 || _this$_indexBuffer2.destroy();
	        this._indexBuffer = new pc__namespace.IndexBuffer(device, format, Math.ceil(numIndices * 1.5), pc__namespace.BUFFER_DYNAMIC);
	        var _storage = this._indexBuffer.lock();
	        this._indices = format === pc__namespace.INDEXFORMAT_UINT32 ? new Uint32Array(_storage) : new Uint16Array(_storage);
	      }
	      var _iterator4 = _createForOfIteratorHelper(this._meshInstancePool),
	        _step4;
	      try {
	        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	          var meshInstance = _step4.value;
	          meshInstance.mesh.vertexBuffer = this._vertexBuffer;
	          meshInstance.mesh.indexBuffer[0] = this._indexBuffer;
	        }
	      } catch (err) {
	        _iterator4.e(err);
	      } finally {
	        _iterator4.f();
	      }
	    }
	  }, {
	    key: "_getMeshInstance",
	    value: function _getMeshInstance(index, material) {
	      var meshInstance = this._meshInstancePool[index];
	      if (meshInstance) {
	        meshInstance.material = material;
	      } else {
	        var mesh = new pc__namespace.Mesh(this._app.graphicsDevice);
	        mesh.vertexBuffer = this._vertexBuffer;
	        mesh.indexBuffer[0] = this._indexBuffer;
	        mesh.primitive[0].type = pc__namespace.PRIMITIVE_TRIANGLES;
	        mesh.primitive[0].indexed = true;
	        meshInstance = new pc__namespace.MeshInstance(mesh, material, this._node);
	        meshInstance.visible = !this._hidden;
	        this._meshInstancePool.push(meshInstance);
	      }
	      return meshInstance;
	    }
	  }, {
	    key: "_setDrawCount",
	    value: function _setDrawCount(count) {
	      if (count !== this._meshInstances.length) {
	        this.removeFromLayers();
	        this._meshInstances = this._meshInstancePool.slice(0, count);
	        this.addToLayers();
	      }
	    }
	  }, {
	    key: "_render",
	    value: function _render() {
	      var firstCommand = this._renderer.render(this.skeleton, true);
	      var numVertices = 0;
	      var numIndices = 0;
	      for (var command = firstCommand; command; command = command.next) {
	        numVertices += command.numVertices;
	        numIndices += command.numIndices;
	      }
	      this._renderCounts.vertexCount = numVertices;
	      this._renderCounts.indexCount = numIndices;
	      if (numIndices === 0) {
	        this._setDrawCount(0);
	        return;
	      }
	      if (!this._vertexBuffer || this._vertexBuffer.getNumVertices() < numVertices || this._indexBuffer.getNumIndices() < numIndices) {
	        this._allocateBuffers(numVertices, numIndices);
	      }
	      var floats = this._floats;
	      var uints = this._uints;
	      var indices = this._indices;
	      var minX = Infinity;
	      var minY = Infinity;
	      var maxX = -Infinity;
	      var maxY = -Infinity;
	      var vertexOffset = 0;
	      var indexOffset = 0;
	      var drawCount = 0;
	      var lastTexture = null;
	      var lastBlendMode = -1;
	      var meshInstance = null;
	      for (var _command = firstCommand; _command; _command = _command.next) {
	        var _command2 = _command,
	          positions = _command2.positions,
	          uvs = _command2.uvs,
	          colors = _command2.colors,
	          darkColors = _command2.darkColors;
	        for (var i = 0, v = vertexOffset * VERTEX_SIZE; i < _command.numVertices; i++, v += VERTEX_SIZE) {
	          var x = positions[i * 2];
	          var y = positions[i * 2 + 1];
	          floats[v] = x;
	          floats[v + 1] = y;
	          floats[v + 2] = uvs[i * 2];
	          floats[v + 3] = uvs[i * 2 + 1];
	          uints[v + 4] = toRGBA(colors[i]);
	          uints[v + 5] = toRGBA(darkColors[i]);
	          if (x < minX) minX = x;
	          if (x > maxX) maxX = x;
	          if (y < minY) minY = y;
	          if (y > maxY) maxY = y;
	        }
	        var commandIndices = _command.indices;
	        for (var _i = 0; _i < _command.numIndices; _i++) {
	          indices[indexOffset + _i] = commandIndices[_i] + vertexOffset;
	        }
	        if (_command.texture === lastTexture && _command.blendMode === lastBlendMode) {
	          meshInstance.mesh.primitive[0].count += _command.numIndices;
	        } else {
	          meshInstance = this._getMeshInstance(drawCount, this._getMaterial(_command.texture, _command.blendMode));
	          meshInstance.drawOrder = this._priority + drawCount;
	          meshInstance.mesh.primitive[0].base = indexOffset;
	          meshInstance.mesh.primitive[0].count = _command.numIndices;
	          lastTexture = _command.texture;
	          lastBlendMode = _command.blendMode;
	          drawCount++;
	        }
	        vertexOffset += _command.numVertices;
	        indexOffset += _command.numIndices;
	      }
	      this._vertexBuffer.lock();
	      this._vertexBuffer.unlock();
	      this._indexBuffer.lock();
	      this._indexBuffer.unlock();
	      this._aabbMin.set(minX, minY, 0);
	      this._aabbMax.set(maxX, maxY, 0);
	      this._aabb.setMinMax(this._aabbMin, this._aabbMax);
	      for (var _i2 = 0; _i2 < drawCount; _i2++) {
	        this._meshInstancePool[_i2].mesh.aabb = this._aabb;
	      }
	      this._setDrawCount(drawCount);
	    }
	  }, {
	    key: "update",
	    value: function update(dt) {
	      if (this._hidden) return;
	      dt *= this._timeScale;
	      var states = this.states;
	      for (var i = 0; i < states.length; i++) {
	        states[i].update(dt);
	      }
	      for (var _i3 = 0; _i3 < states.length; _i3++) {
	        states[_i3].apply(this.skeleton);
	      }
	      this.skeleton.update(dt);
	      if (this.autoUpdate) {
	        this.skeleton.updateWorldTransform(Physics.update);
	      }
	      this._render();
	    }
	  }, {
	    key: "setPosition",
	    value: function setPosition(p) {
	      this._position.copy(p);
	    }
	  }, {
	    key: "setTint",
	    value: function setTint() {
	      warnOnce('playcanvas-spine: setTint is not supported by the Spine 4.3 plugin. Use the colors of the skeleton, slots or attachments instead, for example skeleton.color or skeleton.findSlot(name).getPose().color.');
	    }
	  }, {
	    key: "removeFromLayers",
	    value: function removeFromLayers() {
	      if (this._meshInstances.length) {
	        for (var i = 0; i < this._layers.length; i++) {
	          var layer = this._app.scene.layers.getLayerById(this._layers[i]);
	          if (layer) layer.removeMeshInstances(this._meshInstances);
	        }
	      }
	    }
	  }, {
	    key: "addToLayers",
	    value: function addToLayers() {
	      if (this._meshInstances.length) {
	        for (var i = 0; i < this._layers.length; i++) {
	          var layer = this._app.scene.layers.getLayerById(this._layers[i]);
	          if (layer) layer.addMeshInstances(this._meshInstances);
	        }
	      }
	    }
	  }, {
	    key: "state",
	    get: function get() {
	      return this.states[0];
	    }
	  }, {
	    key: "priority",
	    get: function get() {
	      return this._priority;
	    },
	    set: function set(value) {
	      this._priority = value;
	    }
	  }, {
	    key: "timeScale",
	    get: function get() {
	      return this._timeScale;
	    },
	    set: function set(value) {
	      this._timeScale = value;
	    }
	  }, {
	    key: "layers",
	    get: function get() {
	      return this._layers;
	    },
	    set: function set(value) {
	      this.removeFromLayers();
	      this._layers = value || [];
	      this.addToLayers();
	    }
	  }]);
	}();

	var SpineComponent = function (_Component) {
	  function SpineComponent(system, entity) {
	    var _this;
	    _classCallCheck(this, SpineComponent);
	    _this = _callSuper(this, SpineComponent, [system, entity]);
	    _this.on('set_atlasAsset', _this.onSetAsset, _this);
	    _this.on('set_textureAssets', _this.onSetAssets, _this);
	    _this.on('set_skeletonAsset', _this.onSetAsset, _this);
	    _this.on('set_atlasData', _this.onSetResource, _this);
	    _this.on('set_textures', _this.onSetResource, _this);
	    _this.on('set_skeletonData', _this.onSetResource, _this);
	    return _this;
	  }
	  _inherits(SpineComponent, _Component);
	  return _createClass(SpineComponent, [{
	    key: "_createSpine",
	    value: function _createSpine() {
	      if (this.data.spine) {
	        this.data.spine.destroy();
	        this.data.spine = null;
	      }
	      var textureData = {};
	      for (var i = 0, n = this.textureAssets.length; i < n; i++) {
	        var asset = this.system.app.assets.get(this.textureAssets[i]);
	        var path = asset.name ? asset.name : asset.file ? asset.file.filename : null;
	        if (!path) {
	          path = pc.path.getBasename(asset.file.url);
	        }
	        var query = path.indexOf('?');
	        if (query !== -1) path = path.substring(0, query);
	        textureData[path] = asset.resource;
	      }
	      this.data.spine = new Spine(this.system.app, this.atlasData, this.skeletonData, textureData);
	      this.state = this.data.spine.state;
	      this.states = this.data.spine.states;
	      this.skeleton = this.data.spine.skeleton;
	      this.entity.addChild(this.data.spine._node);
	    }
	  }, {
	    key: "_onAssetReady",
	    value: function _onAssetReady(_ref) {
	      var type = _ref.type,
	        resource = _ref.resource;
	      if (type === 'texture') {
	        this.textures.push(resource);
	      }
	      if (type === 'json') {
	        this.skeletonData = resource;
	      }
	      if (type === 'text') {
	        this.atlasData = resource;
	      }
	    }
	  }, {
	    key: "_onAssetAdd",
	    value: function _onAssetAdd(asset) {
	      asset.off('change', this.onAssetChanged, this);
	      asset.on('change', this.onAssetChanged, this);
	      asset.off('remove', this.onAssetRemoved, this);
	      asset.on('remove', this.onAssetRemoved, this);
	      asset.ready(this._onAssetReady, this);
	      this.system.app.assets.load(asset);
	    }
	  }, {
	    key: "onSetResource",
	    value: function onSetResource() {
	      if (this.data.atlasData && this.data.textures.length && this.data.skeletonData) {
	        this._createSpine();
	      }
	    }
	  }, {
	    key: "onSetAsset",
	    value: function onSetAsset(name, oldValue, newValue) {
	      var registry = this.system.app.assets;
	      var asset = null;
	      if (oldValue) {
	        asset = registry.get(oldValue);
	        if (asset) {
	          asset.off('change', this.onAssetChanged);
	          asset.off('remove', this.onAssetRemoved);
	        }
	      }
	      if (newValue) {
	        var id = newValue;
	        if (newValue instanceof pc.Asset) {
	          id = newValue.id;
	          this.data[name] = id;
	        }
	        asset = registry.get(id);
	        if (asset) {
	          this._onAssetAdd(asset);
	        } else {
	          registry.on("add:".concat(id));
	        }
	      }
	    }
	  }, {
	    key: "onSetAssets",
	    value: function onSetAssets(name, oldValue, newValue) {
	      var registry = this.system.app.assets;
	      var asset = null;
	      var i;
	      var n;
	      if (oldValue.length) {
	        for (i = 0, n = oldValue.length; i < n; i++) {
	          asset = registry.get(oldValue[i]);
	          if (asset) {
	            asset.off('change', this.onAssetChanged);
	            asset.off('remove', this.onAssetRemoved);
	          }
	        }
	      }
	      if (newValue && newValue.length) {
	        var ids = newValue.map(function (v) {
	          if (v instanceof pc.Asset) {
	            return v.id;
	          }
	          return v;
	        });
	        for (i = 0, n = newValue.length; i < n; i++) {
	          asset = registry.get(ids[i]);
	          if (asset) {
	            this._onAssetAdd(asset);
	          } else {
	            registry.on("add:".concat(ids[i]));
	          }
	        }
	      }
	    }
	  }, {
	    key: "onAssetChanged",
	    value: function onAssetChanged(asset, attribute, newValue, oldValue) {}
	  }, {
	    key: "onAssetRemoved",
	    value: function onAssetRemoved(asset) {}
	  }, {
	    key: "onEnable",
	    value: function onEnable() {
	      pc.Component.prototype.onEnable.call(this);
	      var spine = this.data.spine;
	      if (spine) {
	        spine.addToLayers();
	      }
	    }
	  }, {
	    key: "onDisable",
	    value: function onDisable() {
	      pc.Component.prototype.onDisable.call(this);
	      var spine = this.data.spine;
	      if (spine) {
	        spine.removeFromLayers();
	      }
	    }
	  }, {
	    key: "hide",
	    value: function hide() {
	      if (this.data.spine) {
	        this.data.spine.hide();
	      }
	    }
	  }, {
	    key: "show",
	    value: function show() {
	      if (this.data.spine) {
	        this.data.spine.show();
	      }
	    }
	  }, {
	    key: "removeComponent",
	    value: function removeComponent() {
	      var asset;
	      if (this.atlasAsset) {
	        asset = this.system.app.assets.get(this.atlasAsset);
	        if (asset) {
	          asset.off('change', this.onAssetChanged);
	          asset.off('remove', this.onAssetRemoved);
	        }
	      }
	      if (this.skeletonAsset) {
	        asset = this.system.app.assets.get(this.skeletonAsset);
	        if (asset) {
	          asset.off('change', this.onAssetChanged);
	          asset.off('remove', this.onAssetRemoved);
	        }
	      }
	      if (this.textureAssets && this.textureAssets.length) {
	        for (var i = 0; i < this.textureAssets.length; i++) {
	          asset = this.system.app.assets.get(this.textureAssets[i]);
	          if (asset) {
	            asset.off('change', this.onAssetChanged);
	            asset.off('remove', this.onAssetRemoved);
	          }
	        }
	      }
	    }
	  }]);
	}(pc.Component);

	var SpineComponentData = _createClass(function SpineComponentData() {
	  _classCallCheck(this, SpineComponentData);
	  this.enabled = true;
	  this.atlasAsset = null;
	  this.textureAssets = [];
	  this.skeletonAsset = null;
	  this.speed = 1;
	  this.spine = null;
	  this.atlasData = null;
	  this.textures = [];
	  this.skeletonData = null;
	});

	var SpineComponentSystem = function (_ComponentSystem) {
	  function SpineComponentSystem(app) {
	    var _this;
	    _classCallCheck(this, SpineComponentSystem);
	    _this = _callSuper(this, SpineComponentSystem, [app]);
	    _this.id = 'spine';
	    _this.ComponentType = SpineComponent;
	    _this.DataType = SpineComponentData;
	    _this.schema = ['enabled', 'atlasAsset', 'textureAssets', 'skeletonAsset', 'atlasData', 'textures', 'skeletonData', 'speed', 'spine'];
	    _this.on('beforeremove', _this.onBeforeRemove, _this);
	    _this.app.systems.on('update', _this.onUpdate, _this);
	    return _this;
	  }
	  _inherits(SpineComponentSystem, _ComponentSystem);
	  return _createClass(SpineComponentSystem, [{
	    key: "initializeComponentData",
	    value: function initializeComponentData(component, data, properties) {
	      properties = ['enabled', 'atlasAsset', 'textureAssets', 'skeletonAsset', 'atlasData', 'textures', 'skeletonData', 'spine'];
	      _superPropGet(SpineComponentSystem, "initializeComponentData", this)([component, data, properties]);
	    }
	  }, {
	    key: "onBeforeRemove",
	    value: function onBeforeRemove(entity, component) {
	      var data = entity.spine.data;
	      if (data.spine) {
	        data.spine.destroy();
	      }
	      entity.spine.removeComponent();
	    }
	  }, {
	    key: "onUpdate",
	    value: function onUpdate(dt) {
	      var components = this.store;
	      for (var id in components) {
	        if (components.hasOwnProperty(id)) {
	          var component = components[id];
	          var componentData = component.data;
	          if (componentData.enabled && component.entity.enabled) {
	            if (componentData.spine) {
	              componentData.spine.setPosition(component.entity.getPosition());
	              componentData.spine.update(componentData.speed * dt);
	            }
	          }
	        }
	      }
	    }
	  }]);
	}(pc.ComponentSystem);

	(function () {
	  var app = pc__namespace.Application.getApplication();
	  if (!app) {
	    if (typeof document !== 'undefined') {
	      console.warn('No Application found. An Application or AppBase must be instantiated before `playcanvas-spine`.');
	    }
	    return;
	  }
	  var system = new SpineComponentSystem(app);
	  app.systems.add(system);
	})();

	return spine;

})(pc);
