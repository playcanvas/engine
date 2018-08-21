// https://github.com/bbc/unicode-bidirectional
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("UnicodeBidirectional", [], factory);
	else if(typeof exports === 'object')
		exports["UnicodeBidirectional"] = factory();
	else
		root["UnicodeBidirectional"] = factory();
})(typeof self !== 'undefined' ? self : this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 17);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* unused harmony export ALM */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return FSI; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return LRE; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return LRI; });
/* unused harmony export LRM */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return LRO; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return PDF; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return PDI; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "h", function() { return RLE; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "i", function() { return RLI; });
/* unused harmony export RLM */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "j", function() { return RLO; });
/* unused harmony export A */
/* unused harmony export B */
/* unused harmony export C */
/* unused harmony export D */
/* unused harmony export E */
/* unused harmony export F */
/* unused harmony export G */
/* unused harmony export B1 */
/* unused harmony export S1 */
/* unused harmony export L1 */
/* unused harmony export R1 */
/* unused harmony export ON1 */
/* unused harmony export AN1 */
/* unused harmony export EN1 */
/* unused harmony export BN1 */
/* unused harmony export WS1 */
/* unused harmony export LEFT_PAR */
/* unused harmony export RIGHT_PAR */
/* unused harmony export LEFT_SQUARE */
/* unused harmony export RIGHT_SQUARE */
/* unused harmony export LEFT_CURLY */
/* unused harmony export RIGHT_CURLY */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return MAX_DEPTH; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "k", function() { return isET; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "m", function() { return isNI; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "p", function() { return isR; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "l", function() { return isIsolateInitiator; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "o", function() { return isPDI; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "q", function() { return isStrong; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "r", function() { return isX9ControlCharacter; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "n", function() { return isNonFormatting; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);


// Maximum level depth
const MAX_DEPTH = 125;

// Examples of any codepoint
const A = 0x0041; // U+0041 LATIN CAPITAL LETTER A
const B = 0x0042; // U+0042 LATIN CAPITAL LETTER B
const C = 0x0043; // U+0043 LATIN CAPITAL LETTER C
const D = 0x0044; // U+0044 LATIN CAPITAL LETTER D
const E = 0x0045; // U+0044 LATIN CAPITAL LETTER E
const F = 0x0046; // U+0044 LATIN CAPITAL LETTER F
const G = 0x0047; // U+0044 LATIN CAPITAL LETTER G

const ALM = 0x061C;
const FSI = 0x2068;
const LRE = 0x202A;
const LRI = 0x2066;
const LRM = 0x200E;
const LRO = 0x202D;
const PDF = 0x202C;
const PDI = 0x2069;
const RLE = 0x202B;
const RLI = 0x2067;
const RLM = 0x200F;
const RLO = 0x202E;

// Examples of BN (Boundary Neutral)
const BN1 = 0x0000
// Examples of B (Paragraph Separator)
const B1 = 0x2029
// Examples of L (Left-to-right)
const L1  = 0x006D // U+006D LATIN SMALL LETTER M
// Examples of R (Right-to-left)
const R1  = 0x05D0 // U+05D0 HEBREW LETTER ALEF
// Examples of ON (Other Neutral)
const ON1 = 0x0022 // U+0022 QUOTATION MARK
// Examples of AN (Arabic Number)
const AN1 = 0x0661 // U+0661 ARABIC-INDIC DIGIT ONE
// Examples of AN (Arabic Letter)
const AL1 =  0x0643 // U+0643 ARABIC LETTER KAF
// Examples of EN (European Number)
const EN1 = 0x0032 // U+0032 DIGIT TWO
// Examples of WS (Whitespace)
const WS1 = 0x0020 // U+0032 SPACE
// Examples of S (Segment Separator)
const S1 = 0x0009 // U+0009 CHARACTER TABULATION

// Brackets
const LEFT_CURLY = 0x007B;
const LEFT_PAR = 0x0028;
const LEFT_SQUARE = 0x005B;
const RIGHT_CURLY = 0x007D;
const RIGHT_PAR = 0x0029;
const RIGHT_SQUARE = 0x005D;
const LEFT_POINTING_ANGLE = 0x2329;
const RIGHT_POINTING_ANGLE = 0x232A;
const LEFT_ANGLE_BRACKET = 0x3008;
const RIGHT_ANGLE_BRACKET = 0x3009;

// Testing classes, types
const isET = (t) => t === 'ET';
const isNI = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['B', 'S', 'WS', 'ON', 'FSI', 'LRI', 'RLI', 'PDI'], t);
const isR = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['R', 'AN', 'EN'], t);
const isIsolateInitiator = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['LRI', 'RLI', 'FSI'], t);
const isPDI = (point) => point === 0x2069;
const isStrong = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['L', 'R', 'AL'], t);
const isX9ControlCharacter = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['RLE', 'LRE', 'RLO', 'LRO', 'PDF', 'BN'], t);
const isNonFormatting  = (t) => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['B', 'BN', 'RLE', 'LRE', 'RLO', 'LRO', 'PDF', 'RLI', 'LRI', 'FSI', 'PDI'], t);




/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "i", function() { return increase; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "h", function() { return decrease; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return BracketPairStackEntry; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return BracketPairState; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return DirectionalStatusStackEntry; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return EmbeddingLevelState; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return Pairing; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return Run; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return Sequence; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);


const increase = c => c + 1;
const decrease = c => c - 1;

// Paragraph
// ------------------------------------------
// 3.3.2 Explicit Levels and Directions
// [1]: the "directional status stack"
// [2]: "At the start of the pass, the directional status stack is initialized to
//       an entry reflecting the paragraph embedding level, ..."
// [3]: Initial value described by X1.
const DirectionalStatusStackEntry = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({
  isolate: false,
  level: 0,
  override: 'neutral'
});

// [1]: TODO: use Immutable.Range(0, Infinity).map(n => 0)
const EmbeddingLevelState = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({
  directionalStatusStack: __WEBPACK_IMPORTED_MODULE_0_immutable__["Stack"].of(new DirectionalStatusStackEntry()), // [1,2]
  bidiTypes: __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), // [1]
  embeddingLevels: __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), // [1]
  overflowEmbeddingCount: 0,
  overflowIsolateCount: 0,
  validIsolateCount: 0
}); // [3]

const Run = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({
  level: -1,
  from: 0,
  to: 0
}, 'Run');

const Sequence = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({
  runs: __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(),
  eos: '',
  sos: '',
}, 'Sequence');

// Bracket
// ------------------------------------------
// Used for BD16. to compute bracket pairs
const BracketPairStackEntry = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({ point: 0, position: 0 });
const Pairing = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({ open: 0, close: 0 });
const BracketPairState = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({ stack: __WEBPACK_IMPORTED_MODULE_0_immutable__["Stack"].of(), pairings: __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), stackoverflow: false });




/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

(function (global, factory) {
   true ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Immutable = factory());
}(this, function () { 'use strict';var SLICE$0 = Array.prototype.slice;

  function createClass(ctor, superClass) {
    if (superClass) {
      ctor.prototype = Object.create(superClass.prototype);
    }
    ctor.prototype.constructor = ctor;
  }

  function Iterable(value) {
      return isIterable(value) ? value : Seq(value);
    }


  createClass(KeyedIterable, Iterable);
    function KeyedIterable(value) {
      return isKeyed(value) ? value : KeyedSeq(value);
    }


  createClass(IndexedIterable, Iterable);
    function IndexedIterable(value) {
      return isIndexed(value) ? value : IndexedSeq(value);
    }


  createClass(SetIterable, Iterable);
    function SetIterable(value) {
      return isIterable(value) && !isAssociative(value) ? value : SetSeq(value);
    }



  function isIterable(maybeIterable) {
    return !!(maybeIterable && maybeIterable[IS_ITERABLE_SENTINEL]);
  }

  function isKeyed(maybeKeyed) {
    return !!(maybeKeyed && maybeKeyed[IS_KEYED_SENTINEL]);
  }

  function isIndexed(maybeIndexed) {
    return !!(maybeIndexed && maybeIndexed[IS_INDEXED_SENTINEL]);
  }

  function isAssociative(maybeAssociative) {
    return isKeyed(maybeAssociative) || isIndexed(maybeAssociative);
  }

  function isOrdered(maybeOrdered) {
    return !!(maybeOrdered && maybeOrdered[IS_ORDERED_SENTINEL]);
  }

  Iterable.isIterable = isIterable;
  Iterable.isKeyed = isKeyed;
  Iterable.isIndexed = isIndexed;
  Iterable.isAssociative = isAssociative;
  Iterable.isOrdered = isOrdered;

  Iterable.Keyed = KeyedIterable;
  Iterable.Indexed = IndexedIterable;
  Iterable.Set = SetIterable;


  var IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@';
  var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
  var IS_INDEXED_SENTINEL = '@@__IMMUTABLE_INDEXED__@@';
  var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';

  // Used for setting prototype methods that IE8 chokes on.
  var DELETE = 'delete';

  // Constants describing the size of trie nodes.
  var SHIFT = 5; // Resulted in best performance after ______?
  var SIZE = 1 << SHIFT;
  var MASK = SIZE - 1;

  // A consistent shared value representing "not set" which equals nothing other
  // than itself, and nothing that could be provided externally.
  var NOT_SET = {};

  // Boolean references, Rough equivalent of `bool &`.
  var CHANGE_LENGTH = { value: false };
  var DID_ALTER = { value: false };

  function MakeRef(ref) {
    ref.value = false;
    return ref;
  }

  function SetRef(ref) {
    ref && (ref.value = true);
  }

  // A function which returns a value representing an "owner" for transient writes
  // to tries. The return value will only ever equal itself, and will not equal
  // the return of any subsequent call of this function.
  function OwnerID() {}

  // http://jsperf.com/copy-array-inline
  function arrCopy(arr, offset) {
    offset = offset || 0;
    var len = Math.max(0, arr.length - offset);
    var newArr = new Array(len);
    for (var ii = 0; ii < len; ii++) {
      newArr[ii] = arr[ii + offset];
    }
    return newArr;
  }

  function ensureSize(iter) {
    if (iter.size === undefined) {
      iter.size = iter.__iterate(returnTrue);
    }
    return iter.size;
  }

  function wrapIndex(iter, index) {
    // This implements "is array index" which the ECMAString spec defines as:
    //
    //     A String property name P is an array index if and only if
    //     ToString(ToUint32(P)) is equal to P and ToUint32(P) is not equal
    //     to 2^32−1.
    //
    // http://www.ecma-international.org/ecma-262/6.0/#sec-array-exotic-objects
    if (typeof index !== 'number') {
      var uint32Index = index >>> 0; // N >>> 0 is shorthand for ToUint32
      if ('' + uint32Index !== index || uint32Index === 4294967295) {
        return NaN;
      }
      index = uint32Index;
    }
    return index < 0 ? ensureSize(iter) + index : index;
  }

  function returnTrue() {
    return true;
  }

  function wholeSlice(begin, end, size) {
    return (begin === 0 || (size !== undefined && begin <= -size)) &&
      (end === undefined || (size !== undefined && end >= size));
  }

  function resolveBegin(begin, size) {
    return resolveIndex(begin, size, 0);
  }

  function resolveEnd(end, size) {
    return resolveIndex(end, size, size);
  }

  function resolveIndex(index, size, defaultIndex) {
    return index === undefined ?
      defaultIndex :
      index < 0 ?
        Math.max(0, size + index) :
        size === undefined ?
          index :
          Math.min(size, index);
  }

  /* global Symbol */

  var ITERATE_KEYS = 0;
  var ITERATE_VALUES = 1;
  var ITERATE_ENTRIES = 2;

  var REAL_ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
  var FAUX_ITERATOR_SYMBOL = '@@iterator';

  var ITERATOR_SYMBOL = REAL_ITERATOR_SYMBOL || FAUX_ITERATOR_SYMBOL;


  function Iterator(next) {
      this.next = next;
    }

    Iterator.prototype.toString = function() {
      return '[Iterator]';
    };


  Iterator.KEYS = ITERATE_KEYS;
  Iterator.VALUES = ITERATE_VALUES;
  Iterator.ENTRIES = ITERATE_ENTRIES;

  Iterator.prototype.inspect =
  Iterator.prototype.toSource = function () { return this.toString(); }
  Iterator.prototype[ITERATOR_SYMBOL] = function () {
    return this;
  };


  function iteratorValue(type, k, v, iteratorResult) {
    var value = type === 0 ? k : type === 1 ? v : [k, v];
    iteratorResult ? (iteratorResult.value = value) : (iteratorResult = {
      value: value, done: false
    });
    return iteratorResult;
  }

  function iteratorDone() {
    return { value: undefined, done: true };
  }

  function hasIterator(maybeIterable) {
    return !!getIteratorFn(maybeIterable);
  }

  function isIterator(maybeIterator) {
    return maybeIterator && typeof maybeIterator.next === 'function';
  }

  function getIterator(iterable) {
    var iteratorFn = getIteratorFn(iterable);
    return iteratorFn && iteratorFn.call(iterable);
  }

  function getIteratorFn(iterable) {
    var iteratorFn = iterable && (
      (REAL_ITERATOR_SYMBOL && iterable[REAL_ITERATOR_SYMBOL]) ||
      iterable[FAUX_ITERATOR_SYMBOL]
    );
    if (typeof iteratorFn === 'function') {
      return iteratorFn;
    }
  }

  function isArrayLike(value) {
    return value && typeof value.length === 'number';
  }

  createClass(Seq, Iterable);
    function Seq(value) {
      return value === null || value === undefined ? emptySequence() :
        isIterable(value) ? value.toSeq() : seqFromValue(value);
    }

    Seq.of = function(/*...values*/) {
      return Seq(arguments);
    };

    Seq.prototype.toSeq = function() {
      return this;
    };

    Seq.prototype.toString = function() {
      return this.__toString('Seq {', '}');
    };

    Seq.prototype.cacheResult = function() {
      if (!this._cache && this.__iterateUncached) {
        this._cache = this.entrySeq().toArray();
        this.size = this._cache.length;
      }
      return this;
    };

    // abstract __iterateUncached(fn, reverse)

    Seq.prototype.__iterate = function(fn, reverse) {
      return seqIterate(this, fn, reverse, true);
    };

    // abstract __iteratorUncached(type, reverse)

    Seq.prototype.__iterator = function(type, reverse) {
      return seqIterator(this, type, reverse, true);
    };



  createClass(KeyedSeq, Seq);
    function KeyedSeq(value) {
      return value === null || value === undefined ?
        emptySequence().toKeyedSeq() :
        isIterable(value) ?
          (isKeyed(value) ? value.toSeq() : value.fromEntrySeq()) :
          keyedSeqFromValue(value);
    }

    KeyedSeq.prototype.toKeyedSeq = function() {
      return this;
    };



  createClass(IndexedSeq, Seq);
    function IndexedSeq(value) {
      return value === null || value === undefined ? emptySequence() :
        !isIterable(value) ? indexedSeqFromValue(value) :
        isKeyed(value) ? value.entrySeq() : value.toIndexedSeq();
    }

    IndexedSeq.of = function(/*...values*/) {
      return IndexedSeq(arguments);
    };

    IndexedSeq.prototype.toIndexedSeq = function() {
      return this;
    };

    IndexedSeq.prototype.toString = function() {
      return this.__toString('Seq [', ']');
    };

    IndexedSeq.prototype.__iterate = function(fn, reverse) {
      return seqIterate(this, fn, reverse, false);
    };

    IndexedSeq.prototype.__iterator = function(type, reverse) {
      return seqIterator(this, type, reverse, false);
    };



  createClass(SetSeq, Seq);
    function SetSeq(value) {
      return (
        value === null || value === undefined ? emptySequence() :
        !isIterable(value) ? indexedSeqFromValue(value) :
        isKeyed(value) ? value.entrySeq() : value
      ).toSetSeq();
    }

    SetSeq.of = function(/*...values*/) {
      return SetSeq(arguments);
    };

    SetSeq.prototype.toSetSeq = function() {
      return this;
    };



  Seq.isSeq = isSeq;
  Seq.Keyed = KeyedSeq;
  Seq.Set = SetSeq;
  Seq.Indexed = IndexedSeq;

  var IS_SEQ_SENTINEL = '@@__IMMUTABLE_SEQ__@@';

  Seq.prototype[IS_SEQ_SENTINEL] = true;



  createClass(ArraySeq, IndexedSeq);
    function ArraySeq(array) {
      this._array = array;
      this.size = array.length;
    }

    ArraySeq.prototype.get = function(index, notSetValue) {
      return this.has(index) ? this._array[wrapIndex(this, index)] : notSetValue;
    };

    ArraySeq.prototype.__iterate = function(fn, reverse) {
      var array = this._array;
      var maxIndex = array.length - 1;
      for (var ii = 0; ii <= maxIndex; ii++) {
        if (fn(array[reverse ? maxIndex - ii : ii], ii, this) === false) {
          return ii + 1;
        }
      }
      return ii;
    };

    ArraySeq.prototype.__iterator = function(type, reverse) {
      var array = this._array;
      var maxIndex = array.length - 1;
      var ii = 0;
      return new Iterator(function()
        {return ii > maxIndex ?
          iteratorDone() :
          iteratorValue(type, ii, array[reverse ? maxIndex - ii++ : ii++])}
      );
    };



  createClass(ObjectSeq, KeyedSeq);
    function ObjectSeq(object) {
      var keys = Object.keys(object);
      this._object = object;
      this._keys = keys;
      this.size = keys.length;
    }

    ObjectSeq.prototype.get = function(key, notSetValue) {
      if (notSetValue !== undefined && !this.has(key)) {
        return notSetValue;
      }
      return this._object[key];
    };

    ObjectSeq.prototype.has = function(key) {
      return this._object.hasOwnProperty(key);
    };

    ObjectSeq.prototype.__iterate = function(fn, reverse) {
      var object = this._object;
      var keys = this._keys;
      var maxIndex = keys.length - 1;
      for (var ii = 0; ii <= maxIndex; ii++) {
        var key = keys[reverse ? maxIndex - ii : ii];
        if (fn(object[key], key, this) === false) {
          return ii + 1;
        }
      }
      return ii;
    };

    ObjectSeq.prototype.__iterator = function(type, reverse) {
      var object = this._object;
      var keys = this._keys;
      var maxIndex = keys.length - 1;
      var ii = 0;
      return new Iterator(function()  {
        var key = keys[reverse ? maxIndex - ii : ii];
        return ii++ > maxIndex ?
          iteratorDone() :
          iteratorValue(type, key, object[key]);
      });
    };

  ObjectSeq.prototype[IS_ORDERED_SENTINEL] = true;


  createClass(IterableSeq, IndexedSeq);
    function IterableSeq(iterable) {
      this._iterable = iterable;
      this.size = iterable.length || iterable.size;
    }

    IterableSeq.prototype.__iterateUncached = function(fn, reverse) {
      if (reverse) {
        return this.cacheResult().__iterate(fn, reverse);
      }
      var iterable = this._iterable;
      var iterator = getIterator(iterable);
      var iterations = 0;
      if (isIterator(iterator)) {
        var step;
        while (!(step = iterator.next()).done) {
          if (fn(step.value, iterations++, this) === false) {
            break;
          }
        }
      }
      return iterations;
    };

    IterableSeq.prototype.__iteratorUncached = function(type, reverse) {
      if (reverse) {
        return this.cacheResult().__iterator(type, reverse);
      }
      var iterable = this._iterable;
      var iterator = getIterator(iterable);
      if (!isIterator(iterator)) {
        return new Iterator(iteratorDone);
      }
      var iterations = 0;
      return new Iterator(function()  {
        var step = iterator.next();
        return step.done ? step : iteratorValue(type, iterations++, step.value);
      });
    };



  createClass(IteratorSeq, IndexedSeq);
    function IteratorSeq(iterator) {
      this._iterator = iterator;
      this._iteratorCache = [];
    }

    IteratorSeq.prototype.__iterateUncached = function(fn, reverse) {
      if (reverse) {
        return this.cacheResult().__iterate(fn, reverse);
      }
      var iterator = this._iterator;
      var cache = this._iteratorCache;
      var iterations = 0;
      while (iterations < cache.length) {
        if (fn(cache[iterations], iterations++, this) === false) {
          return iterations;
        }
      }
      var step;
      while (!(step = iterator.next()).done) {
        var val = step.value;
        cache[iterations] = val;
        if (fn(val, iterations++, this) === false) {
          break;
        }
      }
      return iterations;
    };

    IteratorSeq.prototype.__iteratorUncached = function(type, reverse) {
      if (reverse) {
        return this.cacheResult().__iterator(type, reverse);
      }
      var iterator = this._iterator;
      var cache = this._iteratorCache;
      var iterations = 0;
      return new Iterator(function()  {
        if (iterations >= cache.length) {
          var step = iterator.next();
          if (step.done) {
            return step;
          }
          cache[iterations] = step.value;
        }
        return iteratorValue(type, iterations, cache[iterations++]);
      });
    };




  // # pragma Helper functions

  function isSeq(maybeSeq) {
    return !!(maybeSeq && maybeSeq[IS_SEQ_SENTINEL]);
  }

  var EMPTY_SEQ;

  function emptySequence() {
    return EMPTY_SEQ || (EMPTY_SEQ = new ArraySeq([]));
  }

  function keyedSeqFromValue(value) {
    var seq =
      Array.isArray(value) ? new ArraySeq(value).fromEntrySeq() :
      isIterator(value) ? new IteratorSeq(value).fromEntrySeq() :
      hasIterator(value) ? new IterableSeq(value).fromEntrySeq() :
      typeof value === 'object' ? new ObjectSeq(value) :
      undefined;
    if (!seq) {
      throw new TypeError(
        'Expected Array or iterable object of [k, v] entries, '+
        'or keyed object: ' + value
      );
    }
    return seq;
  }

  function indexedSeqFromValue(value) {
    var seq = maybeIndexedSeqFromValue(value);
    if (!seq) {
      throw new TypeError(
        'Expected Array or iterable object of values: ' + value
      );
    }
    return seq;
  }

  function seqFromValue(value) {
    var seq = maybeIndexedSeqFromValue(value) ||
      (typeof value === 'object' && new ObjectSeq(value));
    if (!seq) {
      throw new TypeError(
        'Expected Array or iterable object of values, or keyed object: ' + value
      );
    }
    return seq;
  }

  function maybeIndexedSeqFromValue(value) {
    return (
      isArrayLike(value) ? new ArraySeq(value) :
      isIterator(value) ? new IteratorSeq(value) :
      hasIterator(value) ? new IterableSeq(value) :
      undefined
    );
  }

  function seqIterate(seq, fn, reverse, useKeys) {
    var cache = seq._cache;
    if (cache) {
      var maxIndex = cache.length - 1;
      for (var ii = 0; ii <= maxIndex; ii++) {
        var entry = cache[reverse ? maxIndex - ii : ii];
        if (fn(entry[1], useKeys ? entry[0] : ii, seq) === false) {
          return ii + 1;
        }
      }
      return ii;
    }
    return seq.__iterateUncached(fn, reverse);
  }

  function seqIterator(seq, type, reverse, useKeys) {
    var cache = seq._cache;
    if (cache) {
      var maxIndex = cache.length - 1;
      var ii = 0;
      return new Iterator(function()  {
        var entry = cache[reverse ? maxIndex - ii : ii];
        return ii++ > maxIndex ?
          iteratorDone() :
          iteratorValue(type, useKeys ? entry[0] : ii - 1, entry[1]);
      });
    }
    return seq.__iteratorUncached(type, reverse);
  }

  function fromJS(json, converter) {
    return converter ?
      fromJSWith(converter, json, '', {'': json}) :
      fromJSDefault(json);
  }

  function fromJSWith(converter, json, key, parentJSON) {
    if (Array.isArray(json)) {
      return converter.call(parentJSON, key, IndexedSeq(json).map(function(v, k)  {return fromJSWith(converter, v, k, json)}));
    }
    if (isPlainObj(json)) {
      return converter.call(parentJSON, key, KeyedSeq(json).map(function(v, k)  {return fromJSWith(converter, v, k, json)}));
    }
    return json;
  }

  function fromJSDefault(json) {
    if (Array.isArray(json)) {
      return IndexedSeq(json).map(fromJSDefault).toList();
    }
    if (isPlainObj(json)) {
      return KeyedSeq(json).map(fromJSDefault).toMap();
    }
    return json;
  }

  function isPlainObj(value) {
    return value && (value.constructor === Object || value.constructor === undefined);
  }

  /**
   * An extension of the "same-value" algorithm as [described for use by ES6 Map
   * and Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#Key_equality)
   *
   * NaN is considered the same as NaN, however -0 and 0 are considered the same
   * value, which is different from the algorithm described by
   * [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is).
   *
   * This is extended further to allow Objects to describe the values they
   * represent, by way of `valueOf` or `equals` (and `hashCode`).
   *
   * Note: because of this extension, the key equality of Immutable.Map and the
   * value equality of Immutable.Set will differ from ES6 Map and Set.
   *
   * ### Defining custom values
   *
   * The easiest way to describe the value an object represents is by implementing
   * `valueOf`. For example, `Date` represents a value by returning a unix
   * timestamp for `valueOf`:
   *
   *     var date1 = new Date(1234567890000); // Fri Feb 13 2009 ...
   *     var date2 = new Date(1234567890000);
   *     date1.valueOf(); // 1234567890000
   *     assert( date1 !== date2 );
   *     assert( Immutable.is( date1, date2 ) );
   *
   * Note: overriding `valueOf` may have other implications if you use this object
   * where JavaScript expects a primitive, such as implicit string coercion.
   *
   * For more complex types, especially collections, implementing `valueOf` may
   * not be performant. An alternative is to implement `equals` and `hashCode`.
   *
   * `equals` takes another object, presumably of similar type, and returns true
   * if the it is equal. Equality is symmetrical, so the same result should be
   * returned if this and the argument are flipped.
   *
   *     assert( a.equals(b) === b.equals(a) );
   *
   * `hashCode` returns a 32bit integer number representing the object which will
   * be used to determine how to store the value object in a Map or Set. You must
   * provide both or neither methods, one must not exist without the other.
   *
   * Also, an important relationship between these methods must be upheld: if two
   * values are equal, they *must* return the same hashCode. If the values are not
   * equal, they might have the same hashCode; this is called a hash collision,
   * and while undesirable for performance reasons, it is acceptable.
   *
   *     if (a.equals(b)) {
   *       assert( a.hashCode() === b.hashCode() );
   *     }
   *
   * All Immutable collections implement `equals` and `hashCode`.
   *
   */
  function is(valueA, valueB) {
    if (valueA === valueB || (valueA !== valueA && valueB !== valueB)) {
      return true;
    }
    if (!valueA || !valueB) {
      return false;
    }
    if (typeof valueA.valueOf === 'function' &&
        typeof valueB.valueOf === 'function') {
      valueA = valueA.valueOf();
      valueB = valueB.valueOf();
      if (valueA === valueB || (valueA !== valueA && valueB !== valueB)) {
        return true;
      }
      if (!valueA || !valueB) {
        return false;
      }
    }
    if (typeof valueA.equals === 'function' &&
        typeof valueB.equals === 'function' &&
        valueA.equals(valueB)) {
      return true;
    }
    return false;
  }

  function deepEqual(a, b) {
    if (a === b) {
      return true;
    }

    if (
      !isIterable(b) ||
      a.size !== undefined && b.size !== undefined && a.size !== b.size ||
      a.__hash !== undefined && b.__hash !== undefined && a.__hash !== b.__hash ||
      isKeyed(a) !== isKeyed(b) ||
      isIndexed(a) !== isIndexed(b) ||
      isOrdered(a) !== isOrdered(b)
    ) {
      return false;
    }

    if (a.size === 0 && b.size === 0) {
      return true;
    }

    var notAssociative = !isAssociative(a);

    if (isOrdered(a)) {
      var entries = a.entries();
      return b.every(function(v, k)  {
        var entry = entries.next().value;
        return entry && is(entry[1], v) && (notAssociative || is(entry[0], k));
      }) && entries.next().done;
    }

    var flipped = false;

    if (a.size === undefined) {
      if (b.size === undefined) {
        if (typeof a.cacheResult === 'function') {
          a.cacheResult();
        }
      } else {
        flipped = true;
        var _ = a;
        a = b;
        b = _;
      }
    }

    var allEqual = true;
    var bSize = b.__iterate(function(v, k)  {
      if (notAssociative ? !a.has(v) :
          flipped ? !is(v, a.get(k, NOT_SET)) : !is(a.get(k, NOT_SET), v)) {
        allEqual = false;
        return false;
      }
    });

    return allEqual && a.size === bSize;
  }

  createClass(Repeat, IndexedSeq);

    function Repeat(value, times) {
      if (!(this instanceof Repeat)) {
        return new Repeat(value, times);
      }
      this._value = value;
      this.size = times === undefined ? Infinity : Math.max(0, times);
      if (this.size === 0) {
        if (EMPTY_REPEAT) {
          return EMPTY_REPEAT;
        }
        EMPTY_REPEAT = this;
      }
    }

    Repeat.prototype.toString = function() {
      if (this.size === 0) {
        return 'Repeat []';
      }
      return 'Repeat [ ' + this._value + ' ' + this.size + ' times ]';
    };

    Repeat.prototype.get = function(index, notSetValue) {
      return this.has(index) ? this._value : notSetValue;
    };

    Repeat.prototype.includes = function(searchValue) {
      return is(this._value, searchValue);
    };

    Repeat.prototype.slice = function(begin, end) {
      var size = this.size;
      return wholeSlice(begin, end, size) ? this :
        new Repeat(this._value, resolveEnd(end, size) - resolveBegin(begin, size));
    };

    Repeat.prototype.reverse = function() {
      return this;
    };

    Repeat.prototype.indexOf = function(searchValue) {
      if (is(this._value, searchValue)) {
        return 0;
      }
      return -1;
    };

    Repeat.prototype.lastIndexOf = function(searchValue) {
      if (is(this._value, searchValue)) {
        return this.size;
      }
      return -1;
    };

    Repeat.prototype.__iterate = function(fn, reverse) {
      for (var ii = 0; ii < this.size; ii++) {
        if (fn(this._value, ii, this) === false) {
          return ii + 1;
        }
      }
      return ii;
    };

    Repeat.prototype.__iterator = function(type, reverse) {var this$0 = this;
      var ii = 0;
      return new Iterator(function()
        {return ii < this$0.size ? iteratorValue(type, ii++, this$0._value) : iteratorDone()}
      );
    };

    Repeat.prototype.equals = function(other) {
      return other instanceof Repeat ?
        is(this._value, other._value) :
        deepEqual(other);
    };


  var EMPTY_REPEAT;

  function invariant(condition, error) {
    if (!condition) throw new Error(error);
  }

  createClass(Range, IndexedSeq);

    function Range(start, end, step) {
      if (!(this instanceof Range)) {
        return new Range(start, end, step);
      }
      invariant(step !== 0, 'Cannot step a Range by 0');
      start = start || 0;
      if (end === undefined) {
        end = Infinity;
      }
      step = step === undefined ? 1 : Math.abs(step);
      if (end < start) {
        step = -step;
      }
      this._start = start;
      this._end = end;
      this._step = step;
      this.size = Math.max(0, Math.ceil((end - start) / step - 1) + 1);
      if (this.size === 0) {
        if (EMPTY_RANGE) {
          return EMPTY_RANGE;
        }
        EMPTY_RANGE = this;
      }
    }

    Range.prototype.toString = function() {
      if (this.size === 0) {
        return 'Range []';
      }
      return 'Range [ ' +
        this._start + '...' + this._end +
        (this._step !== 1 ? ' by ' + this._step : '') +
      ' ]';
    };

    Range.prototype.get = function(index, notSetValue) {
      return this.has(index) ?
        this._start + wrapIndex(this, index) * this._step :
        notSetValue;
    };

    Range.prototype.includes = function(searchValue) {
      var possibleIndex = (searchValue - this._start) / this._step;
      return possibleIndex >= 0 &&
        possibleIndex < this.size &&
        possibleIndex === Math.floor(possibleIndex);
    };

    Range.prototype.slice = function(begin, end) {
      if (wholeSlice(begin, end, this.size)) {
        return this;
      }
      begin = resolveBegin(begin, this.size);
      end = resolveEnd(end, this.size);
      if (end <= begin) {
        return new Range(0, 0);
      }
      return new Range(this.get(begin, this._end), this.get(end, this._end), this._step);
    };

    Range.prototype.indexOf = function(searchValue) {
      var offsetValue = searchValue - this._start;
      if (offsetValue % this._step === 0) {
        var index = offsetValue / this._step;
        if (index >= 0 && index < this.size) {
          return index
        }
      }
      return -1;
    };

    Range.prototype.lastIndexOf = function(searchValue) {
      return this.indexOf(searchValue);
    };

    Range.prototype.__iterate = function(fn, reverse) {
      var maxIndex = this.size - 1;
      var step = this._step;
      var value = reverse ? this._start + maxIndex * step : this._start;
      for (var ii = 0; ii <= maxIndex; ii++) {
        if (fn(value, ii, this) === false) {
          return ii + 1;
        }
        value += reverse ? -step : step;
      }
      return ii;
    };

    Range.prototype.__iterator = function(type, reverse) {
      var maxIndex = this.size - 1;
      var step = this._step;
      var value = reverse ? this._start + maxIndex * step : this._start;
      var ii = 0;
      return new Iterator(function()  {
        var v = value;
        value += reverse ? -step : step;
        return ii > maxIndex ? iteratorDone() : iteratorValue(type, ii++, v);
      });
    };

    Range.prototype.equals = function(other) {
      return other instanceof Range ?
        this._start === other._start &&
        this._end === other._end &&
        this._step === other._step :
        deepEqual(this, other);
    };


  var EMPTY_RANGE;

  createClass(Collection, Iterable);
    function Collection() {
      throw TypeError('Abstract');
    }


  createClass(KeyedCollection, Collection);function KeyedCollection() {}

  createClass(IndexedCollection, Collection);function IndexedCollection() {}

  createClass(SetCollection, Collection);function SetCollection() {}


  Collection.Keyed = KeyedCollection;
  Collection.Indexed = IndexedCollection;
  Collection.Set = SetCollection;

  var imul =
    typeof Math.imul === 'function' && Math.imul(0xffffffff, 2) === -2 ?
    Math.imul :
    function imul(a, b) {
      a = a | 0; // int
      b = b | 0; // int
      var c = a & 0xffff;
      var d = b & 0xffff;
      // Shift by 0 fixes the sign on the high part.
      return (c * d) + ((((a >>> 16) * d + c * (b >>> 16)) << 16) >>> 0) | 0; // int
    };

  // v8 has an optimization for storing 31-bit signed numbers.
  // Values which have either 00 or 11 as the high order bits qualify.
  // This function drops the highest order bit in a signed number, maintaining
  // the sign bit.
  function smi(i32) {
    return ((i32 >>> 1) & 0x40000000) | (i32 & 0xBFFFFFFF);
  }

  function hash(o) {
    if (o === false || o === null || o === undefined) {
      return 0;
    }
    if (typeof o.valueOf === 'function') {
      o = o.valueOf();
      if (o === false || o === null || o === undefined) {
        return 0;
      }
    }
    if (o === true) {
      return 1;
    }
    var type = typeof o;
    if (type === 'number') {
      if (o !== o || o === Infinity) {
        return 0;
      }
      var h = o | 0;
      if (h !== o) {
        h ^= o * 0xFFFFFFFF;
      }
      while (o > 0xFFFFFFFF) {
        o /= 0xFFFFFFFF;
        h ^= o;
      }
      return smi(h);
    }
    if (type === 'string') {
      return o.length > STRING_HASH_CACHE_MIN_STRLEN ? cachedHashString(o) : hashString(o);
    }
    if (typeof o.hashCode === 'function') {
      return o.hashCode();
    }
    if (type === 'object') {
      return hashJSObj(o);
    }
    if (typeof o.toString === 'function') {
      return hashString(o.toString());
    }
    throw new Error('Value type ' + type + ' cannot be hashed.');
  }

  function cachedHashString(string) {
    var hash = stringHashCache[string];
    if (hash === undefined) {
      hash = hashString(string);
      if (STRING_HASH_CACHE_SIZE === STRING_HASH_CACHE_MAX_SIZE) {
        STRING_HASH_CACHE_SIZE = 0;
        stringHashCache = {};
      }
      STRING_HASH_CACHE_SIZE++;
      stringHashCache[string] = hash;
    }
    return hash;
  }

  // http://jsperf.com/hashing-strings
  function hashString(string) {
    // This is the hash from JVM
    // The hash code for a string is computed as
    // s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
    // where s[i] is the ith character of the string and n is the length of
    // the string. We "mod" the result to make it between 0 (inclusive) and 2^31
    // (exclusive) by dropping high bits.
    var hash = 0;
    for (var ii = 0; ii < string.length; ii++) {
      hash = 31 * hash + string.charCodeAt(ii) | 0;
    }
    return smi(hash);
  }

  function hashJSObj(obj) {
    var hash;
    if (usingWeakMap) {
      hash = weakMap.get(obj);
      if (hash !== undefined) {
        return hash;
      }
    }

    hash = obj[UID_HASH_KEY];
    if (hash !== undefined) {
      return hash;
    }

    if (!canDefineProperty) {
      hash = obj.propertyIsEnumerable && obj.propertyIsEnumerable[UID_HASH_KEY];
      if (hash !== undefined) {
        return hash;
      }

      hash = getIENodeHash(obj);
      if (hash !== undefined) {
        return hash;
      }
    }

    hash = ++objHashUID;
    if (objHashUID & 0x40000000) {
      objHashUID = 0;
    }

    if (usingWeakMap) {
      weakMap.set(obj, hash);
    } else if (isExtensible !== undefined && isExtensible(obj) === false) {
      throw new Error('Non-extensible objects are not allowed as keys.');
    } else if (canDefineProperty) {
      Object.defineProperty(obj, UID_HASH_KEY, {
        'enumerable': false,
        'configurable': false,
        'writable': false,
        'value': hash
      });
    } else if (obj.propertyIsEnumerable !== undefined &&
               obj.propertyIsEnumerable === obj.constructor.prototype.propertyIsEnumerable) {
      // Since we can't define a non-enumerable property on the object
      // we'll hijack one of the less-used non-enumerable properties to
      // save our hash on it. Since this is a function it will not show up in
      // `JSON.stringify` which is what we want.
      obj.propertyIsEnumerable = function() {
        return this.constructor.prototype.propertyIsEnumerable.apply(this, arguments);
      };
      obj.propertyIsEnumerable[UID_HASH_KEY] = hash;
    } else if (obj.nodeType !== undefined) {
      // At this point we couldn't get the IE `uniqueID` to use as a hash
      // and we couldn't use a non-enumerable property to exploit the
      // dontEnum bug so we simply add the `UID_HASH_KEY` on the node
      // itself.
      obj[UID_HASH_KEY] = hash;
    } else {
      throw new Error('Unable to set a non-enumerable property on object.');
    }

    return hash;
  }

  // Get references to ES5 object methods.
  var isExtensible = Object.isExtensible;

  // True if Object.defineProperty works as expected. IE8 fails this test.
  var canDefineProperty = (function() {
    try {
      Object.defineProperty({}, '@', {});
      return true;
    } catch (e) {
      return false;
    }
  }());

  // IE has a `uniqueID` property on DOM nodes. We can construct the hash from it
  // and avoid memory leaks from the IE cloneNode bug.
  function getIENodeHash(node) {
    if (node && node.nodeType > 0) {
      switch (node.nodeType) {
        case 1: // Element
          return node.uniqueID;
        case 9: // Document
          return node.documentElement && node.documentElement.uniqueID;
      }
    }
  }

  // If possible, use a WeakMap.
  var usingWeakMap = typeof WeakMap === 'function';
  var weakMap;
  if (usingWeakMap) {
    weakMap = new WeakMap();
  }

  var objHashUID = 0;

  var UID_HASH_KEY = '__immutablehash__';
  if (typeof Symbol === 'function') {
    UID_HASH_KEY = Symbol(UID_HASH_KEY);
  }

  var STRING_HASH_CACHE_MIN_STRLEN = 16;
  var STRING_HASH_CACHE_MAX_SIZE = 255;
  var STRING_HASH_CACHE_SIZE = 0;
  var stringHashCache = {};

  function assertNotInfinite(size) {
    invariant(
      size !== Infinity,
      'Cannot perform this action with an infinite size.'
    );
  }

  createClass(Map, KeyedCollection);

    // @pragma Construction

    function Map(value) {
      return value === null || value === undefined ? emptyMap() :
        isMap(value) && !isOrdered(value) ? value :
        emptyMap().withMutations(function(map ) {
          var iter = KeyedIterable(value);
          assertNotInfinite(iter.size);
          iter.forEach(function(v, k)  {return map.set(k, v)});
        });
    }

    Map.of = function() {var keyValues = SLICE$0.call(arguments, 0);
      return emptyMap().withMutations(function(map ) {
        for (var i = 0; i < keyValues.length; i += 2) {
          if (i + 1 >= keyValues.length) {
            throw new Error('Missing value for key: ' + keyValues[i]);
          }
          map.set(keyValues[i], keyValues[i + 1]);
        }
      });
    };

    Map.prototype.toString = function() {
      return this.__toString('Map {', '}');
    };

    // @pragma Access

    Map.prototype.get = function(k, notSetValue) {
      return this._root ?
        this._root.get(0, undefined, k, notSetValue) :
        notSetValue;
    };

    // @pragma Modification

    Map.prototype.set = function(k, v) {
      return updateMap(this, k, v);
    };

    Map.prototype.setIn = function(keyPath, v) {
      return this.updateIn(keyPath, NOT_SET, function()  {return v});
    };

    Map.prototype.remove = function(k) {
      return updateMap(this, k, NOT_SET);
    };

    Map.prototype.deleteIn = function(keyPath) {
      return this.updateIn(keyPath, function()  {return NOT_SET});
    };

    Map.prototype.update = function(k, notSetValue, updater) {
      return arguments.length === 1 ?
        k(this) :
        this.updateIn([k], notSetValue, updater);
    };

    Map.prototype.updateIn = function(keyPath, notSetValue, updater) {
      if (!updater) {
        updater = notSetValue;
        notSetValue = undefined;
      }
      var updatedValue = updateInDeepMap(
        this,
        forceIterator(keyPath),
        notSetValue,
        updater
      );
      return updatedValue === NOT_SET ? undefined : updatedValue;
    };

    Map.prototype.clear = function() {
      if (this.size === 0) {
        return this;
      }
      if (this.__ownerID) {
        this.size = 0;
        this._root = null;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return emptyMap();
    };

    // @pragma Composition

    Map.prototype.merge = function(/*...iters*/) {
      return mergeIntoMapWith(this, undefined, arguments);
    };

    Map.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
      return mergeIntoMapWith(this, merger, iters);
    };

    Map.prototype.mergeIn = function(keyPath) {var iters = SLICE$0.call(arguments, 1);
      return this.updateIn(
        keyPath,
        emptyMap(),
        function(m ) {return typeof m.merge === 'function' ?
          m.merge.apply(m, iters) :
          iters[iters.length - 1]}
      );
    };

    Map.prototype.mergeDeep = function(/*...iters*/) {
      return mergeIntoMapWith(this, deepMerger, arguments);
    };

    Map.prototype.mergeDeepWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
      return mergeIntoMapWith(this, deepMergerWith(merger), iters);
    };

    Map.prototype.mergeDeepIn = function(keyPath) {var iters = SLICE$0.call(arguments, 1);
      return this.updateIn(
        keyPath,
        emptyMap(),
        function(m ) {return typeof m.mergeDeep === 'function' ?
          m.mergeDeep.apply(m, iters) :
          iters[iters.length - 1]}
      );
    };

    Map.prototype.sort = function(comparator) {
      // Late binding
      return OrderedMap(sortFactory(this, comparator));
    };

    Map.prototype.sortBy = function(mapper, comparator) {
      // Late binding
      return OrderedMap(sortFactory(this, comparator, mapper));
    };

    // @pragma Mutability

    Map.prototype.withMutations = function(fn) {
      var mutable = this.asMutable();
      fn(mutable);
      return mutable.wasAltered() ? mutable.__ensureOwner(this.__ownerID) : this;
    };

    Map.prototype.asMutable = function() {
      return this.__ownerID ? this : this.__ensureOwner(new OwnerID());
    };

    Map.prototype.asImmutable = function() {
      return this.__ensureOwner();
    };

    Map.prototype.wasAltered = function() {
      return this.__altered;
    };

    Map.prototype.__iterator = function(type, reverse) {
      return new MapIterator(this, type, reverse);
    };

    Map.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      var iterations = 0;
      this._root && this._root.iterate(function(entry ) {
        iterations++;
        return fn(entry[1], entry[0], this$0);
      }, reverse);
      return iterations;
    };

    Map.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      if (!ownerID) {
        this.__ownerID = ownerID;
        this.__altered = false;
        return this;
      }
      return makeMap(this.size, this._root, ownerID, this.__hash);
    };


  function isMap(maybeMap) {
    return !!(maybeMap && maybeMap[IS_MAP_SENTINEL]);
  }

  Map.isMap = isMap;

  var IS_MAP_SENTINEL = '@@__IMMUTABLE_MAP__@@';

  var MapPrototype = Map.prototype;
  MapPrototype[IS_MAP_SENTINEL] = true;
  MapPrototype[DELETE] = MapPrototype.remove;
  MapPrototype.removeIn = MapPrototype.deleteIn;


  // #pragma Trie Nodes



    function ArrayMapNode(ownerID, entries) {
      this.ownerID = ownerID;
      this.entries = entries;
    }

    ArrayMapNode.prototype.get = function(shift, keyHash, key, notSetValue) {
      var entries = this.entries;
      for (var ii = 0, len = entries.length; ii < len; ii++) {
        if (is(key, entries[ii][0])) {
          return entries[ii][1];
        }
      }
      return notSetValue;
    };

    ArrayMapNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
      var removed = value === NOT_SET;

      var entries = this.entries;
      var idx = 0;
      for (var len = entries.length; idx < len; idx++) {
        if (is(key, entries[idx][0])) {
          break;
        }
      }
      var exists = idx < len;

      if (exists ? entries[idx][1] === value : removed) {
        return this;
      }

      SetRef(didAlter);
      (removed || !exists) && SetRef(didChangeSize);

      if (removed && entries.length === 1) {
        return; // undefined
      }

      if (!exists && !removed && entries.length >= MAX_ARRAY_MAP_SIZE) {
        return createNodes(ownerID, entries, key, value);
      }

      var isEditable = ownerID && ownerID === this.ownerID;
      var newEntries = isEditable ? entries : arrCopy(entries);

      if (exists) {
        if (removed) {
          idx === len - 1 ? newEntries.pop() : (newEntries[idx] = newEntries.pop());
        } else {
          newEntries[idx] = [key, value];
        }
      } else {
        newEntries.push([key, value]);
      }

      if (isEditable) {
        this.entries = newEntries;
        return this;
      }

      return new ArrayMapNode(ownerID, newEntries);
    };




    function BitmapIndexedNode(ownerID, bitmap, nodes) {
      this.ownerID = ownerID;
      this.bitmap = bitmap;
      this.nodes = nodes;
    }

    BitmapIndexedNode.prototype.get = function(shift, keyHash, key, notSetValue) {
      if (keyHash === undefined) {
        keyHash = hash(key);
      }
      var bit = (1 << ((shift === 0 ? keyHash : keyHash >>> shift) & MASK));
      var bitmap = this.bitmap;
      return (bitmap & bit) === 0 ? notSetValue :
        this.nodes[popCount(bitmap & (bit - 1))].get(shift + SHIFT, keyHash, key, notSetValue);
    };

    BitmapIndexedNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
      if (keyHash === undefined) {
        keyHash = hash(key);
      }
      var keyHashFrag = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
      var bit = 1 << keyHashFrag;
      var bitmap = this.bitmap;
      var exists = (bitmap & bit) !== 0;

      if (!exists && value === NOT_SET) {
        return this;
      }

      var idx = popCount(bitmap & (bit - 1));
      var nodes = this.nodes;
      var node = exists ? nodes[idx] : undefined;
      var newNode = updateNode(node, ownerID, shift + SHIFT, keyHash, key, value, didChangeSize, didAlter);

      if (newNode === node) {
        return this;
      }

      if (!exists && newNode && nodes.length >= MAX_BITMAP_INDEXED_SIZE) {
        return expandNodes(ownerID, nodes, bitmap, keyHashFrag, newNode);
      }

      if (exists && !newNode && nodes.length === 2 && isLeafNode(nodes[idx ^ 1])) {
        return nodes[idx ^ 1];
      }

      if (exists && newNode && nodes.length === 1 && isLeafNode(newNode)) {
        return newNode;
      }

      var isEditable = ownerID && ownerID === this.ownerID;
      var newBitmap = exists ? newNode ? bitmap : bitmap ^ bit : bitmap | bit;
      var newNodes = exists ? newNode ?
        setIn(nodes, idx, newNode, isEditable) :
        spliceOut(nodes, idx, isEditable) :
        spliceIn(nodes, idx, newNode, isEditable);

      if (isEditable) {
        this.bitmap = newBitmap;
        this.nodes = newNodes;
        return this;
      }

      return new BitmapIndexedNode(ownerID, newBitmap, newNodes);
    };




    function HashArrayMapNode(ownerID, count, nodes) {
      this.ownerID = ownerID;
      this.count = count;
      this.nodes = nodes;
    }

    HashArrayMapNode.prototype.get = function(shift, keyHash, key, notSetValue) {
      if (keyHash === undefined) {
        keyHash = hash(key);
      }
      var idx = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
      var node = this.nodes[idx];
      return node ? node.get(shift + SHIFT, keyHash, key, notSetValue) : notSetValue;
    };

    HashArrayMapNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
      if (keyHash === undefined) {
        keyHash = hash(key);
      }
      var idx = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
      var removed = value === NOT_SET;
      var nodes = this.nodes;
      var node = nodes[idx];

      if (removed && !node) {
        return this;
      }

      var newNode = updateNode(node, ownerID, shift + SHIFT, keyHash, key, value, didChangeSize, didAlter);
      if (newNode === node) {
        return this;
      }

      var newCount = this.count;
      if (!node) {
        newCount++;
      } else if (!newNode) {
        newCount--;
        if (newCount < MIN_HASH_ARRAY_MAP_SIZE) {
          return packNodes(ownerID, nodes, newCount, idx);
        }
      }

      var isEditable = ownerID && ownerID === this.ownerID;
      var newNodes = setIn(nodes, idx, newNode, isEditable);

      if (isEditable) {
        this.count = newCount;
        this.nodes = newNodes;
        return this;
      }

      return new HashArrayMapNode(ownerID, newCount, newNodes);
    };




    function HashCollisionNode(ownerID, keyHash, entries) {
      this.ownerID = ownerID;
      this.keyHash = keyHash;
      this.entries = entries;
    }

    HashCollisionNode.prototype.get = function(shift, keyHash, key, notSetValue) {
      var entries = this.entries;
      for (var ii = 0, len = entries.length; ii < len; ii++) {
        if (is(key, entries[ii][0])) {
          return entries[ii][1];
        }
      }
      return notSetValue;
    };

    HashCollisionNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
      if (keyHash === undefined) {
        keyHash = hash(key);
      }

      var removed = value === NOT_SET;

      if (keyHash !== this.keyHash) {
        if (removed) {
          return this;
        }
        SetRef(didAlter);
        SetRef(didChangeSize);
        return mergeIntoNode(this, ownerID, shift, keyHash, [key, value]);
      }

      var entries = this.entries;
      var idx = 0;
      for (var len = entries.length; idx < len; idx++) {
        if (is(key, entries[idx][0])) {
          break;
        }
      }
      var exists = idx < len;

      if (exists ? entries[idx][1] === value : removed) {
        return this;
      }

      SetRef(didAlter);
      (removed || !exists) && SetRef(didChangeSize);

      if (removed && len === 2) {
        return new ValueNode(ownerID, this.keyHash, entries[idx ^ 1]);
      }

      var isEditable = ownerID && ownerID === this.ownerID;
      var newEntries = isEditable ? entries : arrCopy(entries);

      if (exists) {
        if (removed) {
          idx === len - 1 ? newEntries.pop() : (newEntries[idx] = newEntries.pop());
        } else {
          newEntries[idx] = [key, value];
        }
      } else {
        newEntries.push([key, value]);
      }

      if (isEditable) {
        this.entries = newEntries;
        return this;
      }

      return new HashCollisionNode(ownerID, this.keyHash, newEntries);
    };




    function ValueNode(ownerID, keyHash, entry) {
      this.ownerID = ownerID;
      this.keyHash = keyHash;
      this.entry = entry;
    }

    ValueNode.prototype.get = function(shift, keyHash, key, notSetValue) {
      return is(key, this.entry[0]) ? this.entry[1] : notSetValue;
    };

    ValueNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
      var removed = value === NOT_SET;
      var keyMatch = is(key, this.entry[0]);
      if (keyMatch ? value === this.entry[1] : removed) {
        return this;
      }

      SetRef(didAlter);

      if (removed) {
        SetRef(didChangeSize);
        return; // undefined
      }

      if (keyMatch) {
        if (ownerID && ownerID === this.ownerID) {
          this.entry[1] = value;
          return this;
        }
        return new ValueNode(ownerID, this.keyHash, [key, value]);
      }

      SetRef(didChangeSize);
      return mergeIntoNode(this, ownerID, shift, hash(key), [key, value]);
    };



  // #pragma Iterators

  ArrayMapNode.prototype.iterate =
  HashCollisionNode.prototype.iterate = function (fn, reverse) {
    var entries = this.entries;
    for (var ii = 0, maxIndex = entries.length - 1; ii <= maxIndex; ii++) {
      if (fn(entries[reverse ? maxIndex - ii : ii]) === false) {
        return false;
      }
    }
  }

  BitmapIndexedNode.prototype.iterate =
  HashArrayMapNode.prototype.iterate = function (fn, reverse) {
    var nodes = this.nodes;
    for (var ii = 0, maxIndex = nodes.length - 1; ii <= maxIndex; ii++) {
      var node = nodes[reverse ? maxIndex - ii : ii];
      if (node && node.iterate(fn, reverse) === false) {
        return false;
      }
    }
  }

  ValueNode.prototype.iterate = function (fn, reverse) {
    return fn(this.entry);
  }

  createClass(MapIterator, Iterator);

    function MapIterator(map, type, reverse) {
      this._type = type;
      this._reverse = reverse;
      this._stack = map._root && mapIteratorFrame(map._root);
    }

    MapIterator.prototype.next = function() {
      var type = this._type;
      var stack = this._stack;
      while (stack) {
        var node = stack.node;
        var index = stack.index++;
        var maxIndex;
        if (node.entry) {
          if (index === 0) {
            return mapIteratorValue(type, node.entry);
          }
        } else if (node.entries) {
          maxIndex = node.entries.length - 1;
          if (index <= maxIndex) {
            return mapIteratorValue(type, node.entries[this._reverse ? maxIndex - index : index]);
          }
        } else {
          maxIndex = node.nodes.length - 1;
          if (index <= maxIndex) {
            var subNode = node.nodes[this._reverse ? maxIndex - index : index];
            if (subNode) {
              if (subNode.entry) {
                return mapIteratorValue(type, subNode.entry);
              }
              stack = this._stack = mapIteratorFrame(subNode, stack);
            }
            continue;
          }
        }
        stack = this._stack = this._stack.__prev;
      }
      return iteratorDone();
    };


  function mapIteratorValue(type, entry) {
    return iteratorValue(type, entry[0], entry[1]);
  }

  function mapIteratorFrame(node, prev) {
    return {
      node: node,
      index: 0,
      __prev: prev
    };
  }

  function makeMap(size, root, ownerID, hash) {
    var map = Object.create(MapPrototype);
    map.size = size;
    map._root = root;
    map.__ownerID = ownerID;
    map.__hash = hash;
    map.__altered = false;
    return map;
  }

  var EMPTY_MAP;
  function emptyMap() {
    return EMPTY_MAP || (EMPTY_MAP = makeMap(0));
  }

  function updateMap(map, k, v) {
    var newRoot;
    var newSize;
    if (!map._root) {
      if (v === NOT_SET) {
        return map;
      }
      newSize = 1;
      newRoot = new ArrayMapNode(map.__ownerID, [[k, v]]);
    } else {
      var didChangeSize = MakeRef(CHANGE_LENGTH);
      var didAlter = MakeRef(DID_ALTER);
      newRoot = updateNode(map._root, map.__ownerID, 0, undefined, k, v, didChangeSize, didAlter);
      if (!didAlter.value) {
        return map;
      }
      newSize = map.size + (didChangeSize.value ? v === NOT_SET ? -1 : 1 : 0);
    }
    if (map.__ownerID) {
      map.size = newSize;
      map._root = newRoot;
      map.__hash = undefined;
      map.__altered = true;
      return map;
    }
    return newRoot ? makeMap(newSize, newRoot) : emptyMap();
  }

  function updateNode(node, ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
    if (!node) {
      if (value === NOT_SET) {
        return node;
      }
      SetRef(didAlter);
      SetRef(didChangeSize);
      return new ValueNode(ownerID, keyHash, [key, value]);
    }
    return node.update(ownerID, shift, keyHash, key, value, didChangeSize, didAlter);
  }

  function isLeafNode(node) {
    return node.constructor === ValueNode || node.constructor === HashCollisionNode;
  }

  function mergeIntoNode(node, ownerID, shift, keyHash, entry) {
    if (node.keyHash === keyHash) {
      return new HashCollisionNode(ownerID, keyHash, [node.entry, entry]);
    }

    var idx1 = (shift === 0 ? node.keyHash : node.keyHash >>> shift) & MASK;
    var idx2 = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;

    var newNode;
    var nodes = idx1 === idx2 ?
      [mergeIntoNode(node, ownerID, shift + SHIFT, keyHash, entry)] :
      ((newNode = new ValueNode(ownerID, keyHash, entry)), idx1 < idx2 ? [node, newNode] : [newNode, node]);

    return new BitmapIndexedNode(ownerID, (1 << idx1) | (1 << idx2), nodes);
  }

  function createNodes(ownerID, entries, key, value) {
    if (!ownerID) {
      ownerID = new OwnerID();
    }
    var node = new ValueNode(ownerID, hash(key), [key, value]);
    for (var ii = 0; ii < entries.length; ii++) {
      var entry = entries[ii];
      node = node.update(ownerID, 0, undefined, entry[0], entry[1]);
    }
    return node;
  }

  function packNodes(ownerID, nodes, count, excluding) {
    var bitmap = 0;
    var packedII = 0;
    var packedNodes = new Array(count);
    for (var ii = 0, bit = 1, len = nodes.length; ii < len; ii++, bit <<= 1) {
      var node = nodes[ii];
      if (node !== undefined && ii !== excluding) {
        bitmap |= bit;
        packedNodes[packedII++] = node;
      }
    }
    return new BitmapIndexedNode(ownerID, bitmap, packedNodes);
  }

  function expandNodes(ownerID, nodes, bitmap, including, node) {
    var count = 0;
    var expandedNodes = new Array(SIZE);
    for (var ii = 0; bitmap !== 0; ii++, bitmap >>>= 1) {
      expandedNodes[ii] = bitmap & 1 ? nodes[count++] : undefined;
    }
    expandedNodes[including] = node;
    return new HashArrayMapNode(ownerID, count + 1, expandedNodes);
  }

  function mergeIntoMapWith(map, merger, iterables) {
    var iters = [];
    for (var ii = 0; ii < iterables.length; ii++) {
      var value = iterables[ii];
      var iter = KeyedIterable(value);
      if (!isIterable(value)) {
        iter = iter.map(function(v ) {return fromJS(v)});
      }
      iters.push(iter);
    }
    return mergeIntoCollectionWith(map, merger, iters);
  }

  function deepMerger(existing, value, key) {
    return existing && existing.mergeDeep && isIterable(value) ?
      existing.mergeDeep(value) :
      is(existing, value) ? existing : value;
  }

  function deepMergerWith(merger) {
    return function(existing, value, key)  {
      if (existing && existing.mergeDeepWith && isIterable(value)) {
        return existing.mergeDeepWith(merger, value);
      }
      var nextValue = merger(existing, value, key);
      return is(existing, nextValue) ? existing : nextValue;
    };
  }

  function mergeIntoCollectionWith(collection, merger, iters) {
    iters = iters.filter(function(x ) {return x.size !== 0});
    if (iters.length === 0) {
      return collection;
    }
    if (collection.size === 0 && !collection.__ownerID && iters.length === 1) {
      return collection.constructor(iters[0]);
    }
    return collection.withMutations(function(collection ) {
      var mergeIntoMap = merger ?
        function(value, key)  {
          collection.update(key, NOT_SET, function(existing )
            {return existing === NOT_SET ? value : merger(existing, value, key)}
          );
        } :
        function(value, key)  {
          collection.set(key, value);
        }
      for (var ii = 0; ii < iters.length; ii++) {
        iters[ii].forEach(mergeIntoMap);
      }
    });
  }

  function updateInDeepMap(existing, keyPathIter, notSetValue, updater) {
    var isNotSet = existing === NOT_SET;
    var step = keyPathIter.next();
    if (step.done) {
      var existingValue = isNotSet ? notSetValue : existing;
      var newValue = updater(existingValue);
      return newValue === existingValue ? existing : newValue;
    }
    invariant(
      isNotSet || (existing && existing.set),
      'invalid keyPath'
    );
    var key = step.value;
    var nextExisting = isNotSet ? NOT_SET : existing.get(key, NOT_SET);
    var nextUpdated = updateInDeepMap(
      nextExisting,
      keyPathIter,
      notSetValue,
      updater
    );
    return nextUpdated === nextExisting ? existing :
      nextUpdated === NOT_SET ? existing.remove(key) :
      (isNotSet ? emptyMap() : existing).set(key, nextUpdated);
  }

  function popCount(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    x = x + (x >> 8);
    x = x + (x >> 16);
    return x & 0x7f;
  }

  function setIn(array, idx, val, canEdit) {
    var newArray = canEdit ? array : arrCopy(array);
    newArray[idx] = val;
    return newArray;
  }

  function spliceIn(array, idx, val, canEdit) {
    var newLen = array.length + 1;
    if (canEdit && idx + 1 === newLen) {
      array[idx] = val;
      return array;
    }
    var newArray = new Array(newLen);
    var after = 0;
    for (var ii = 0; ii < newLen; ii++) {
      if (ii === idx) {
        newArray[ii] = val;
        after = -1;
      } else {
        newArray[ii] = array[ii + after];
      }
    }
    return newArray;
  }

  function spliceOut(array, idx, canEdit) {
    var newLen = array.length - 1;
    if (canEdit && idx === newLen) {
      array.pop();
      return array;
    }
    var newArray = new Array(newLen);
    var after = 0;
    for (var ii = 0; ii < newLen; ii++) {
      if (ii === idx) {
        after = 1;
      }
      newArray[ii] = array[ii + after];
    }
    return newArray;
  }

  var MAX_ARRAY_MAP_SIZE = SIZE / 4;
  var MAX_BITMAP_INDEXED_SIZE = SIZE / 2;
  var MIN_HASH_ARRAY_MAP_SIZE = SIZE / 4;

  createClass(List, IndexedCollection);

    // @pragma Construction

    function List(value) {
      var empty = emptyList();
      if (value === null || value === undefined) {
        return empty;
      }
      if (isList(value)) {
        return value;
      }
      var iter = IndexedIterable(value);
      var size = iter.size;
      if (size === 0) {
        return empty;
      }
      assertNotInfinite(size);
      if (size > 0 && size < SIZE) {
        return makeList(0, size, SHIFT, null, new VNode(iter.toArray()));
      }
      return empty.withMutations(function(list ) {
        list.setSize(size);
        iter.forEach(function(v, i)  {return list.set(i, v)});
      });
    }

    List.of = function(/*...values*/) {
      return this(arguments);
    };

    List.prototype.toString = function() {
      return this.__toString('List [', ']');
    };

    // @pragma Access

    List.prototype.get = function(index, notSetValue) {
      index = wrapIndex(this, index);
      if (index >= 0 && index < this.size) {
        index += this._origin;
        var node = listNodeFor(this, index);
        return node && node.array[index & MASK];
      }
      return notSetValue;
    };

    // @pragma Modification

    List.prototype.set = function(index, value) {
      return updateList(this, index, value);
    };

    List.prototype.remove = function(index) {
      return !this.has(index) ? this :
        index === 0 ? this.shift() :
        index === this.size - 1 ? this.pop() :
        this.splice(index, 1);
    };

    List.prototype.insert = function(index, value) {
      return this.splice(index, 0, value);
    };

    List.prototype.clear = function() {
      if (this.size === 0) {
        return this;
      }
      if (this.__ownerID) {
        this.size = this._origin = this._capacity = 0;
        this._level = SHIFT;
        this._root = this._tail = null;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return emptyList();
    };

    List.prototype.push = function(/*...values*/) {
      var values = arguments;
      var oldSize = this.size;
      return this.withMutations(function(list ) {
        setListBounds(list, 0, oldSize + values.length);
        for (var ii = 0; ii < values.length; ii++) {
          list.set(oldSize + ii, values[ii]);
        }
      });
    };

    List.prototype.pop = function() {
      return setListBounds(this, 0, -1);
    };

    List.prototype.unshift = function(/*...values*/) {
      var values = arguments;
      return this.withMutations(function(list ) {
        setListBounds(list, -values.length);
        for (var ii = 0; ii < values.length; ii++) {
          list.set(ii, values[ii]);
        }
      });
    };

    List.prototype.shift = function() {
      return setListBounds(this, 1);
    };

    // @pragma Composition

    List.prototype.merge = function(/*...iters*/) {
      return mergeIntoListWith(this, undefined, arguments);
    };

    List.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
      return mergeIntoListWith(this, merger, iters);
    };

    List.prototype.mergeDeep = function(/*...iters*/) {
      return mergeIntoListWith(this, deepMerger, arguments);
    };

    List.prototype.mergeDeepWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
      return mergeIntoListWith(this, deepMergerWith(merger), iters);
    };

    List.prototype.setSize = function(size) {
      return setListBounds(this, 0, size);
    };

    // @pragma Iteration

    List.prototype.slice = function(begin, end) {
      var size = this.size;
      if (wholeSlice(begin, end, size)) {
        return this;
      }
      return setListBounds(
        this,
        resolveBegin(begin, size),
        resolveEnd(end, size)
      );
    };

    List.prototype.__iterator = function(type, reverse) {
      var index = 0;
      var values = iterateList(this, reverse);
      return new Iterator(function()  {
        var value = values();
        return value === DONE ?
          iteratorDone() :
          iteratorValue(type, index++, value);
      });
    };

    List.prototype.__iterate = function(fn, reverse) {
      var index = 0;
      var values = iterateList(this, reverse);
      var value;
      while ((value = values()) !== DONE) {
        if (fn(value, index++, this) === false) {
          break;
        }
      }
      return index;
    };

    List.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      if (!ownerID) {
        this.__ownerID = ownerID;
        return this;
      }
      return makeList(this._origin, this._capacity, this._level, this._root, this._tail, ownerID, this.__hash);
    };


  function isList(maybeList) {
    return !!(maybeList && maybeList[IS_LIST_SENTINEL]);
  }

  List.isList = isList;

  var IS_LIST_SENTINEL = '@@__IMMUTABLE_LIST__@@';

  var ListPrototype = List.prototype;
  ListPrototype[IS_LIST_SENTINEL] = true;
  ListPrototype[DELETE] = ListPrototype.remove;
  ListPrototype.setIn = MapPrototype.setIn;
  ListPrototype.deleteIn =
  ListPrototype.removeIn = MapPrototype.removeIn;
  ListPrototype.update = MapPrototype.update;
  ListPrototype.updateIn = MapPrototype.updateIn;
  ListPrototype.mergeIn = MapPrototype.mergeIn;
  ListPrototype.mergeDeepIn = MapPrototype.mergeDeepIn;
  ListPrototype.withMutations = MapPrototype.withMutations;
  ListPrototype.asMutable = MapPrototype.asMutable;
  ListPrototype.asImmutable = MapPrototype.asImmutable;
  ListPrototype.wasAltered = MapPrototype.wasAltered;



    function VNode(array, ownerID) {
      this.array = array;
      this.ownerID = ownerID;
    }

    // TODO: seems like these methods are very similar

    VNode.prototype.removeBefore = function(ownerID, level, index) {
      if (index === level ? 1 << level : 0 || this.array.length === 0) {
        return this;
      }
      var originIndex = (index >>> level) & MASK;
      if (originIndex >= this.array.length) {
        return new VNode([], ownerID);
      }
      var removingFirst = originIndex === 0;
      var newChild;
      if (level > 0) {
        var oldChild = this.array[originIndex];
        newChild = oldChild && oldChild.removeBefore(ownerID, level - SHIFT, index);
        if (newChild === oldChild && removingFirst) {
          return this;
        }
      }
      if (removingFirst && !newChild) {
        return this;
      }
      var editable = editableVNode(this, ownerID);
      if (!removingFirst) {
        for (var ii = 0; ii < originIndex; ii++) {
          editable.array[ii] = undefined;
        }
      }
      if (newChild) {
        editable.array[originIndex] = newChild;
      }
      return editable;
    };

    VNode.prototype.removeAfter = function(ownerID, level, index) {
      if (index === (level ? 1 << level : 0) || this.array.length === 0) {
        return this;
      }
      var sizeIndex = ((index - 1) >>> level) & MASK;
      if (sizeIndex >= this.array.length) {
        return this;
      }

      var newChild;
      if (level > 0) {
        var oldChild = this.array[sizeIndex];
        newChild = oldChild && oldChild.removeAfter(ownerID, level - SHIFT, index);
        if (newChild === oldChild && sizeIndex === this.array.length - 1) {
          return this;
        }
      }

      var editable = editableVNode(this, ownerID);
      editable.array.splice(sizeIndex + 1);
      if (newChild) {
        editable.array[sizeIndex] = newChild;
      }
      return editable;
    };



  var DONE = {};

  function iterateList(list, reverse) {
    var left = list._origin;
    var right = list._capacity;
    var tailPos = getTailOffset(right);
    var tail = list._tail;

    return iterateNodeOrLeaf(list._root, list._level, 0);

    function iterateNodeOrLeaf(node, level, offset) {
      return level === 0 ?
        iterateLeaf(node, offset) :
        iterateNode(node, level, offset);
    }

    function iterateLeaf(node, offset) {
      var array = offset === tailPos ? tail && tail.array : node && node.array;
      var from = offset > left ? 0 : left - offset;
      var to = right - offset;
      if (to > SIZE) {
        to = SIZE;
      }
      return function()  {
        if (from === to) {
          return DONE;
        }
        var idx = reverse ? --to : from++;
        return array && array[idx];
      };
    }

    function iterateNode(node, level, offset) {
      var values;
      var array = node && node.array;
      var from = offset > left ? 0 : (left - offset) >> level;
      var to = ((right - offset) >> level) + 1;
      if (to > SIZE) {
        to = SIZE;
      }
      return function()  {
        do {
          if (values) {
            var value = values();
            if (value !== DONE) {
              return value;
            }
            values = null;
          }
          if (from === to) {
            return DONE;
          }
          var idx = reverse ? --to : from++;
          values = iterateNodeOrLeaf(
            array && array[idx], level - SHIFT, offset + (idx << level)
          );
        } while (true);
      };
    }
  }

  function makeList(origin, capacity, level, root, tail, ownerID, hash) {
    var list = Object.create(ListPrototype);
    list.size = capacity - origin;
    list._origin = origin;
    list._capacity = capacity;
    list._level = level;
    list._root = root;
    list._tail = tail;
    list.__ownerID = ownerID;
    list.__hash = hash;
    list.__altered = false;
    return list;
  }

  var EMPTY_LIST;
  function emptyList() {
    return EMPTY_LIST || (EMPTY_LIST = makeList(0, 0, SHIFT));
  }

  function updateList(list, index, value) {
    index = wrapIndex(list, index);

    if (index !== index) {
      return list;
    }

    if (index >= list.size || index < 0) {
      return list.withMutations(function(list ) {
        index < 0 ?
          setListBounds(list, index).set(0, value) :
          setListBounds(list, 0, index + 1).set(index, value)
      });
    }

    index += list._origin;

    var newTail = list._tail;
    var newRoot = list._root;
    var didAlter = MakeRef(DID_ALTER);
    if (index >= getTailOffset(list._capacity)) {
      newTail = updateVNode(newTail, list.__ownerID, 0, index, value, didAlter);
    } else {
      newRoot = updateVNode(newRoot, list.__ownerID, list._level, index, value, didAlter);
    }

    if (!didAlter.value) {
      return list;
    }

    if (list.__ownerID) {
      list._root = newRoot;
      list._tail = newTail;
      list.__hash = undefined;
      list.__altered = true;
      return list;
    }
    return makeList(list._origin, list._capacity, list._level, newRoot, newTail);
  }

  function updateVNode(node, ownerID, level, index, value, didAlter) {
    var idx = (index >>> level) & MASK;
    var nodeHas = node && idx < node.array.length;
    if (!nodeHas && value === undefined) {
      return node;
    }

    var newNode;

    if (level > 0) {
      var lowerNode = node && node.array[idx];
      var newLowerNode = updateVNode(lowerNode, ownerID, level - SHIFT, index, value, didAlter);
      if (newLowerNode === lowerNode) {
        return node;
      }
      newNode = editableVNode(node, ownerID);
      newNode.array[idx] = newLowerNode;
      return newNode;
    }

    if (nodeHas && node.array[idx] === value) {
      return node;
    }

    SetRef(didAlter);

    newNode = editableVNode(node, ownerID);
    if (value === undefined && idx === newNode.array.length - 1) {
      newNode.array.pop();
    } else {
      newNode.array[idx] = value;
    }
    return newNode;
  }

  function editableVNode(node, ownerID) {
    if (ownerID && node && ownerID === node.ownerID) {
      return node;
    }
    return new VNode(node ? node.array.slice() : [], ownerID);
  }

  function listNodeFor(list, rawIndex) {
    if (rawIndex >= getTailOffset(list._capacity)) {
      return list._tail;
    }
    if (rawIndex < 1 << (list._level + SHIFT)) {
      var node = list._root;
      var level = list._level;
      while (node && level > 0) {
        node = node.array[(rawIndex >>> level) & MASK];
        level -= SHIFT;
      }
      return node;
    }
  }

  function setListBounds(list, begin, end) {
    // Sanitize begin & end using this shorthand for ToInt32(argument)
    // http://www.ecma-international.org/ecma-262/6.0/#sec-toint32
    if (begin !== undefined) {
      begin = begin | 0;
    }
    if (end !== undefined) {
      end = end | 0;
    }
    var owner = list.__ownerID || new OwnerID();
    var oldOrigin = list._origin;
    var oldCapacity = list._capacity;
    var newOrigin = oldOrigin + begin;
    var newCapacity = end === undefined ? oldCapacity : end < 0 ? oldCapacity + end : oldOrigin + end;
    if (newOrigin === oldOrigin && newCapacity === oldCapacity) {
      return list;
    }

    // If it's going to end after it starts, it's empty.
    if (newOrigin >= newCapacity) {
      return list.clear();
    }

    var newLevel = list._level;
    var newRoot = list._root;

    // New origin might need creating a higher root.
    var offsetShift = 0;
    while (newOrigin + offsetShift < 0) {
      newRoot = new VNode(newRoot && newRoot.array.length ? [undefined, newRoot] : [], owner);
      newLevel += SHIFT;
      offsetShift += 1 << newLevel;
    }
    if (offsetShift) {
      newOrigin += offsetShift;
      oldOrigin += offsetShift;
      newCapacity += offsetShift;
      oldCapacity += offsetShift;
    }

    var oldTailOffset = getTailOffset(oldCapacity);
    var newTailOffset = getTailOffset(newCapacity);

    // New size might need creating a higher root.
    while (newTailOffset >= 1 << (newLevel + SHIFT)) {
      newRoot = new VNode(newRoot && newRoot.array.length ? [newRoot] : [], owner);
      newLevel += SHIFT;
    }

    // Locate or create the new tail.
    var oldTail = list._tail;
    var newTail = newTailOffset < oldTailOffset ?
      listNodeFor(list, newCapacity - 1) :
      newTailOffset > oldTailOffset ? new VNode([], owner) : oldTail;

    // Merge Tail into tree.
    if (oldTail && newTailOffset > oldTailOffset && newOrigin < oldCapacity && oldTail.array.length) {
      newRoot = editableVNode(newRoot, owner);
      var node = newRoot;
      for (var level = newLevel; level > SHIFT; level -= SHIFT) {
        var idx = (oldTailOffset >>> level) & MASK;
        node = node.array[idx] = editableVNode(node.array[idx], owner);
      }
      node.array[(oldTailOffset >>> SHIFT) & MASK] = oldTail;
    }

    // If the size has been reduced, there's a chance the tail needs to be trimmed.
    if (newCapacity < oldCapacity) {
      newTail = newTail && newTail.removeAfter(owner, 0, newCapacity);
    }

    // If the new origin is within the tail, then we do not need a root.
    if (newOrigin >= newTailOffset) {
      newOrigin -= newTailOffset;
      newCapacity -= newTailOffset;
      newLevel = SHIFT;
      newRoot = null;
      newTail = newTail && newTail.removeBefore(owner, 0, newOrigin);

    // Otherwise, if the root has been trimmed, garbage collect.
    } else if (newOrigin > oldOrigin || newTailOffset < oldTailOffset) {
      offsetShift = 0;

      // Identify the new top root node of the subtree of the old root.
      while (newRoot) {
        var beginIndex = (newOrigin >>> newLevel) & MASK;
        if (beginIndex !== (newTailOffset >>> newLevel) & MASK) {
          break;
        }
        if (beginIndex) {
          offsetShift += (1 << newLevel) * beginIndex;
        }
        newLevel -= SHIFT;
        newRoot = newRoot.array[beginIndex];
      }

      // Trim the new sides of the new root.
      if (newRoot && newOrigin > oldOrigin) {
        newRoot = newRoot.removeBefore(owner, newLevel, newOrigin - offsetShift);
      }
      if (newRoot && newTailOffset < oldTailOffset) {
        newRoot = newRoot.removeAfter(owner, newLevel, newTailOffset - offsetShift);
      }
      if (offsetShift) {
        newOrigin -= offsetShift;
        newCapacity -= offsetShift;
      }
    }

    if (list.__ownerID) {
      list.size = newCapacity - newOrigin;
      list._origin = newOrigin;
      list._capacity = newCapacity;
      list._level = newLevel;
      list._root = newRoot;
      list._tail = newTail;
      list.__hash = undefined;
      list.__altered = true;
      return list;
    }
    return makeList(newOrigin, newCapacity, newLevel, newRoot, newTail);
  }

  function mergeIntoListWith(list, merger, iterables) {
    var iters = [];
    var maxSize = 0;
    for (var ii = 0; ii < iterables.length; ii++) {
      var value = iterables[ii];
      var iter = IndexedIterable(value);
      if (iter.size > maxSize) {
        maxSize = iter.size;
      }
      if (!isIterable(value)) {
        iter = iter.map(function(v ) {return fromJS(v)});
      }
      iters.push(iter);
    }
    if (maxSize > list.size) {
      list = list.setSize(maxSize);
    }
    return mergeIntoCollectionWith(list, merger, iters);
  }

  function getTailOffset(size) {
    return size < SIZE ? 0 : (((size - 1) >>> SHIFT) << SHIFT);
  }

  createClass(OrderedMap, Map);

    // @pragma Construction

    function OrderedMap(value) {
      return value === null || value === undefined ? emptyOrderedMap() :
        isOrderedMap(value) ? value :
        emptyOrderedMap().withMutations(function(map ) {
          var iter = KeyedIterable(value);
          assertNotInfinite(iter.size);
          iter.forEach(function(v, k)  {return map.set(k, v)});
        });
    }

    OrderedMap.of = function(/*...values*/) {
      return this(arguments);
    };

    OrderedMap.prototype.toString = function() {
      return this.__toString('OrderedMap {', '}');
    };

    // @pragma Access

    OrderedMap.prototype.get = function(k, notSetValue) {
      var index = this._map.get(k);
      return index !== undefined ? this._list.get(index)[1] : notSetValue;
    };

    // @pragma Modification

    OrderedMap.prototype.clear = function() {
      if (this.size === 0) {
        return this;
      }
      if (this.__ownerID) {
        this.size = 0;
        this._map.clear();
        this._list.clear();
        return this;
      }
      return emptyOrderedMap();
    };

    OrderedMap.prototype.set = function(k, v) {
      return updateOrderedMap(this, k, v);
    };

    OrderedMap.prototype.remove = function(k) {
      return updateOrderedMap(this, k, NOT_SET);
    };

    OrderedMap.prototype.wasAltered = function() {
      return this._map.wasAltered() || this._list.wasAltered();
    };

    OrderedMap.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      return this._list.__iterate(
        function(entry ) {return entry && fn(entry[1], entry[0], this$0)},
        reverse
      );
    };

    OrderedMap.prototype.__iterator = function(type, reverse) {
      return this._list.fromEntrySeq().__iterator(type, reverse);
    };

    OrderedMap.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      var newMap = this._map.__ensureOwner(ownerID);
      var newList = this._list.__ensureOwner(ownerID);
      if (!ownerID) {
        this.__ownerID = ownerID;
        this._map = newMap;
        this._list = newList;
        return this;
      }
      return makeOrderedMap(newMap, newList, ownerID, this.__hash);
    };


  function isOrderedMap(maybeOrderedMap) {
    return isMap(maybeOrderedMap) && isOrdered(maybeOrderedMap);
  }

  OrderedMap.isOrderedMap = isOrderedMap;

  OrderedMap.prototype[IS_ORDERED_SENTINEL] = true;
  OrderedMap.prototype[DELETE] = OrderedMap.prototype.remove;



  function makeOrderedMap(map, list, ownerID, hash) {
    var omap = Object.create(OrderedMap.prototype);
    omap.size = map ? map.size : 0;
    omap._map = map;
    omap._list = list;
    omap.__ownerID = ownerID;
    omap.__hash = hash;
    return omap;
  }

  var EMPTY_ORDERED_MAP;
  function emptyOrderedMap() {
    return EMPTY_ORDERED_MAP || (EMPTY_ORDERED_MAP = makeOrderedMap(emptyMap(), emptyList()));
  }

  function updateOrderedMap(omap, k, v) {
    var map = omap._map;
    var list = omap._list;
    var i = map.get(k);
    var has = i !== undefined;
    var newMap;
    var newList;
    if (v === NOT_SET) { // removed
      if (!has) {
        return omap;
      }
      if (list.size >= SIZE && list.size >= map.size * 2) {
        newList = list.filter(function(entry, idx)  {return entry !== undefined && i !== idx});
        newMap = newList.toKeyedSeq().map(function(entry ) {return entry[0]}).flip().toMap();
        if (omap.__ownerID) {
          newMap.__ownerID = newList.__ownerID = omap.__ownerID;
        }
      } else {
        newMap = map.remove(k);
        newList = i === list.size - 1 ? list.pop() : list.set(i, undefined);
      }
    } else {
      if (has) {
        if (v === list.get(i)[1]) {
          return omap;
        }
        newMap = map;
        newList = list.set(i, [k, v]);
      } else {
        newMap = map.set(k, list.size);
        newList = list.set(list.size, [k, v]);
      }
    }
    if (omap.__ownerID) {
      omap.size = newMap.size;
      omap._map = newMap;
      omap._list = newList;
      omap.__hash = undefined;
      return omap;
    }
    return makeOrderedMap(newMap, newList);
  }

  createClass(ToKeyedSequence, KeyedSeq);
    function ToKeyedSequence(indexed, useKeys) {
      this._iter = indexed;
      this._useKeys = useKeys;
      this.size = indexed.size;
    }

    ToKeyedSequence.prototype.get = function(key, notSetValue) {
      return this._iter.get(key, notSetValue);
    };

    ToKeyedSequence.prototype.has = function(key) {
      return this._iter.has(key);
    };

    ToKeyedSequence.prototype.valueSeq = function() {
      return this._iter.valueSeq();
    };

    ToKeyedSequence.prototype.reverse = function() {var this$0 = this;
      var reversedSequence = reverseFactory(this, true);
      if (!this._useKeys) {
        reversedSequence.valueSeq = function()  {return this$0._iter.toSeq().reverse()};
      }
      return reversedSequence;
    };

    ToKeyedSequence.prototype.map = function(mapper, context) {var this$0 = this;
      var mappedSequence = mapFactory(this, mapper, context);
      if (!this._useKeys) {
        mappedSequence.valueSeq = function()  {return this$0._iter.toSeq().map(mapper, context)};
      }
      return mappedSequence;
    };

    ToKeyedSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      var ii;
      return this._iter.__iterate(
        this._useKeys ?
          function(v, k)  {return fn(v, k, this$0)} :
          ((ii = reverse ? resolveSize(this) : 0),
            function(v ) {return fn(v, reverse ? --ii : ii++, this$0)}),
        reverse
      );
    };

    ToKeyedSequence.prototype.__iterator = function(type, reverse) {
      if (this._useKeys) {
        return this._iter.__iterator(type, reverse);
      }
      var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
      var ii = reverse ? resolveSize(this) : 0;
      return new Iterator(function()  {
        var step = iterator.next();
        return step.done ? step :
          iteratorValue(type, reverse ? --ii : ii++, step.value, step);
      });
    };

  ToKeyedSequence.prototype[IS_ORDERED_SENTINEL] = true;


  createClass(ToIndexedSequence, IndexedSeq);
    function ToIndexedSequence(iter) {
      this._iter = iter;
      this.size = iter.size;
    }

    ToIndexedSequence.prototype.includes = function(value) {
      return this._iter.includes(value);
    };

    ToIndexedSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      var iterations = 0;
      return this._iter.__iterate(function(v ) {return fn(v, iterations++, this$0)}, reverse);
    };

    ToIndexedSequence.prototype.__iterator = function(type, reverse) {
      var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
      var iterations = 0;
      return new Iterator(function()  {
        var step = iterator.next();
        return step.done ? step :
          iteratorValue(type, iterations++, step.value, step)
      });
    };



  createClass(ToSetSequence, SetSeq);
    function ToSetSequence(iter) {
      this._iter = iter;
      this.size = iter.size;
    }

    ToSetSequence.prototype.has = function(key) {
      return this._iter.includes(key);
    };

    ToSetSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      return this._iter.__iterate(function(v ) {return fn(v, v, this$0)}, reverse);
    };

    ToSetSequence.prototype.__iterator = function(type, reverse) {
      var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
      return new Iterator(function()  {
        var step = iterator.next();
        return step.done ? step :
          iteratorValue(type, step.value, step.value, step);
      });
    };



  createClass(FromEntriesSequence, KeyedSeq);
    function FromEntriesSequence(entries) {
      this._iter = entries;
      this.size = entries.size;
    }

    FromEntriesSequence.prototype.entrySeq = function() {
      return this._iter.toSeq();
    };

    FromEntriesSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      return this._iter.__iterate(function(entry ) {
        // Check if entry exists first so array access doesn't throw for holes
        // in the parent iteration.
        if (entry) {
          validateEntry(entry);
          var indexedIterable = isIterable(entry);
          return fn(
            indexedIterable ? entry.get(1) : entry[1],
            indexedIterable ? entry.get(0) : entry[0],
            this$0
          );
        }
      }, reverse);
    };

    FromEntriesSequence.prototype.__iterator = function(type, reverse) {
      var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
      return new Iterator(function()  {
        while (true) {
          var step = iterator.next();
          if (step.done) {
            return step;
          }
          var entry = step.value;
          // Check if entry exists first so array access doesn't throw for holes
          // in the parent iteration.
          if (entry) {
            validateEntry(entry);
            var indexedIterable = isIterable(entry);
            return iteratorValue(
              type,
              indexedIterable ? entry.get(0) : entry[0],
              indexedIterable ? entry.get(1) : entry[1],
              step
            );
          }
        }
      });
    };


  ToIndexedSequence.prototype.cacheResult =
  ToKeyedSequence.prototype.cacheResult =
  ToSetSequence.prototype.cacheResult =
  FromEntriesSequence.prototype.cacheResult =
    cacheResultThrough;


  function flipFactory(iterable) {
    var flipSequence = makeSequence(iterable);
    flipSequence._iter = iterable;
    flipSequence.size = iterable.size;
    flipSequence.flip = function()  {return iterable};
    flipSequence.reverse = function () {
      var reversedSequence = iterable.reverse.apply(this); // super.reverse()
      reversedSequence.flip = function()  {return iterable.reverse()};
      return reversedSequence;
    };
    flipSequence.has = function(key ) {return iterable.includes(key)};
    flipSequence.includes = function(key ) {return iterable.has(key)};
    flipSequence.cacheResult = cacheResultThrough;
    flipSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
      return iterable.__iterate(function(v, k)  {return fn(k, v, this$0) !== false}, reverse);
    }
    flipSequence.__iteratorUncached = function(type, reverse) {
      if (type === ITERATE_ENTRIES) {
        var iterator = iterable.__iterator(type, reverse);
        return new Iterator(function()  {
          var step = iterator.next();
          if (!step.done) {
            var k = step.value[0];
            step.value[0] = step.value[1];
            step.value[1] = k;
          }
          return step;
        });
      }
      return iterable.__iterator(
        type === ITERATE_VALUES ? ITERATE_KEYS : ITERATE_VALUES,
        reverse
      );
    }
    return flipSequence;
  }


  function mapFactory(iterable, mapper, context) {
    var mappedSequence = makeSequence(iterable);
    mappedSequence.size = iterable.size;
    mappedSequence.has = function(key ) {return iterable.has(key)};
    mappedSequence.get = function(key, notSetValue)  {
      var v = iterable.get(key, NOT_SET);
      return v === NOT_SET ?
        notSetValue :
        mapper.call(context, v, key, iterable);
    };
    mappedSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
      return iterable.__iterate(
        function(v, k, c)  {return fn(mapper.call(context, v, k, c), k, this$0) !== false},
        reverse
      );
    }
    mappedSequence.__iteratorUncached = function (type, reverse) {
      var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
      return new Iterator(function()  {
        var step = iterator.next();
        if (step.done) {
          return step;
        }
        var entry = step.value;
        var key = entry[0];
        return iteratorValue(
          type,
          key,
          mapper.call(context, entry[1], key, iterable),
          step
        );
      });
    }
    return mappedSequence;
  }


  function reverseFactory(iterable, useKeys) {
    var reversedSequence = makeSequence(iterable);
    reversedSequence._iter = iterable;
    reversedSequence.size = iterable.size;
    reversedSequence.reverse = function()  {return iterable};
    if (iterable.flip) {
      reversedSequence.flip = function () {
        var flipSequence = flipFactory(iterable);
        flipSequence.reverse = function()  {return iterable.flip()};
        return flipSequence;
      };
    }
    reversedSequence.get = function(key, notSetValue)
      {return iterable.get(useKeys ? key : -1 - key, notSetValue)};
    reversedSequence.has = function(key )
      {return iterable.has(useKeys ? key : -1 - key)};
    reversedSequence.includes = function(value ) {return iterable.includes(value)};
    reversedSequence.cacheResult = cacheResultThrough;
    reversedSequence.__iterate = function (fn, reverse) {var this$0 = this;
      return iterable.__iterate(function(v, k)  {return fn(v, k, this$0)}, !reverse);
    };
    reversedSequence.__iterator =
      function(type, reverse)  {return iterable.__iterator(type, !reverse)};
    return reversedSequence;
  }


  function filterFactory(iterable, predicate, context, useKeys) {
    var filterSequence = makeSequence(iterable);
    if (useKeys) {
      filterSequence.has = function(key ) {
        var v = iterable.get(key, NOT_SET);
        return v !== NOT_SET && !!predicate.call(context, v, key, iterable);
      };
      filterSequence.get = function(key, notSetValue)  {
        var v = iterable.get(key, NOT_SET);
        return v !== NOT_SET && predicate.call(context, v, key, iterable) ?
          v : notSetValue;
      };
    }
    filterSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
      var iterations = 0;
      iterable.__iterate(function(v, k, c)  {
        if (predicate.call(context, v, k, c)) {
          iterations++;
          return fn(v, useKeys ? k : iterations - 1, this$0);
        }
      }, reverse);
      return iterations;
    };
    filterSequence.__iteratorUncached = function (type, reverse) {
      var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
      var iterations = 0;
      return new Iterator(function()  {
        while (true) {
          var step = iterator.next();
          if (step.done) {
            return step;
          }
          var entry = step.value;
          var key = entry[0];
          var value = entry[1];
          if (predicate.call(context, value, key, iterable)) {
            return iteratorValue(type, useKeys ? key : iterations++, value, step);
          }
        }
      });
    }
    return filterSequence;
  }


  function countByFactory(iterable, grouper, context) {
    var groups = Map().asMutable();
    iterable.__iterate(function(v, k)  {
      groups.update(
        grouper.call(context, v, k, iterable),
        0,
        function(a ) {return a + 1}
      );
    });
    return groups.asImmutable();
  }


  function groupByFactory(iterable, grouper, context) {
    var isKeyedIter = isKeyed(iterable);
    var groups = (isOrdered(iterable) ? OrderedMap() : Map()).asMutable();
    iterable.__iterate(function(v, k)  {
      groups.update(
        grouper.call(context, v, k, iterable),
        function(a ) {return (a = a || [], a.push(isKeyedIter ? [k, v] : v), a)}
      );
    });
    var coerce = iterableClass(iterable);
    return groups.map(function(arr ) {return reify(iterable, coerce(arr))});
  }


  function sliceFactory(iterable, begin, end, useKeys) {
    var originalSize = iterable.size;

    // Sanitize begin & end using this shorthand for ToInt32(argument)
    // http://www.ecma-international.org/ecma-262/6.0/#sec-toint32
    if (begin !== undefined) {
      begin = begin | 0;
    }
    if (end !== undefined) {
      if (end === Infinity) {
        end = originalSize;
      } else {
        end = end | 0;
      }
    }

    if (wholeSlice(begin, end, originalSize)) {
      return iterable;
    }

    var resolvedBegin = resolveBegin(begin, originalSize);
    var resolvedEnd = resolveEnd(end, originalSize);

    // begin or end will be NaN if they were provided as negative numbers and
    // this iterable's size is unknown. In that case, cache first so there is
    // a known size and these do not resolve to NaN.
    if (resolvedBegin !== resolvedBegin || resolvedEnd !== resolvedEnd) {
      return sliceFactory(iterable.toSeq().cacheResult(), begin, end, useKeys);
    }

    // Note: resolvedEnd is undefined when the original sequence's length is
    // unknown and this slice did not supply an end and should contain all
    // elements after resolvedBegin.
    // In that case, resolvedSize will be NaN and sliceSize will remain undefined.
    var resolvedSize = resolvedEnd - resolvedBegin;
    var sliceSize;
    if (resolvedSize === resolvedSize) {
      sliceSize = resolvedSize < 0 ? 0 : resolvedSize;
    }

    var sliceSeq = makeSequence(iterable);

    // If iterable.size is undefined, the size of the realized sliceSeq is
    // unknown at this point unless the number of items to slice is 0
    sliceSeq.size = sliceSize === 0 ? sliceSize : iterable.size && sliceSize || undefined;

    if (!useKeys && isSeq(iterable) && sliceSize >= 0) {
      sliceSeq.get = function (index, notSetValue) {
        index = wrapIndex(this, index);
        return index >= 0 && index < sliceSize ?
          iterable.get(index + resolvedBegin, notSetValue) :
          notSetValue;
      }
    }

    sliceSeq.__iterateUncached = function(fn, reverse) {var this$0 = this;
      if (sliceSize === 0) {
        return 0;
      }
      if (reverse) {
        return this.cacheResult().__iterate(fn, reverse);
      }
      var skipped = 0;
      var isSkipping = true;
      var iterations = 0;
      iterable.__iterate(function(v, k)  {
        if (!(isSkipping && (isSkipping = skipped++ < resolvedBegin))) {
          iterations++;
          return fn(v, useKeys ? k : iterations - 1, this$0) !== false &&
                 iterations !== sliceSize;
        }
      });
      return iterations;
    };

    sliceSeq.__iteratorUncached = function(type, reverse) {
      if (sliceSize !== 0 && reverse) {
        return this.cacheResult().__iterator(type, reverse);
      }
      // Don't bother instantiating parent iterator if taking 0.
      var iterator = sliceSize !== 0 && iterable.__iterator(type, reverse);
      var skipped = 0;
      var iterations = 0;
      return new Iterator(function()  {
        while (skipped++ < resolvedBegin) {
          iterator.next();
        }
        if (++iterations > sliceSize) {
          return iteratorDone();
        }
        var step = iterator.next();
        if (useKeys || type === ITERATE_VALUES) {
          return step;
        } else if (type === ITERATE_KEYS) {
          return iteratorValue(type, iterations - 1, undefined, step);
        } else {
          return iteratorValue(type, iterations - 1, step.value[1], step);
        }
      });
    }

    return sliceSeq;
  }


  function takeWhileFactory(iterable, predicate, context) {
    var takeSequence = makeSequence(iterable);
    takeSequence.__iterateUncached = function(fn, reverse) {var this$0 = this;
      if (reverse) {
        return this.cacheResult().__iterate(fn, reverse);
      }
      var iterations = 0;
      iterable.__iterate(function(v, k, c)
        {return predicate.call(context, v, k, c) && ++iterations && fn(v, k, this$0)}
      );
      return iterations;
    };
    takeSequence.__iteratorUncached = function(type, reverse) {var this$0 = this;
      if (reverse) {
        return this.cacheResult().__iterator(type, reverse);
      }
      var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
      var iterating = true;
      return new Iterator(function()  {
        if (!iterating) {
          return iteratorDone();
        }
        var step = iterator.next();
        if (step.done) {
          return step;
        }
        var entry = step.value;
        var k = entry[0];
        var v = entry[1];
        if (!predicate.call(context, v, k, this$0)) {
          iterating = false;
          return iteratorDone();
        }
        return type === ITERATE_ENTRIES ? step :
          iteratorValue(type, k, v, step);
      });
    };
    return takeSequence;
  }


  function skipWhileFactory(iterable, predicate, context, useKeys) {
    var skipSequence = makeSequence(iterable);
    skipSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
      if (reverse) {
        return this.cacheResult().__iterate(fn, reverse);
      }
      var isSkipping = true;
      var iterations = 0;
      iterable.__iterate(function(v, k, c)  {
        if (!(isSkipping && (isSkipping = predicate.call(context, v, k, c)))) {
          iterations++;
          return fn(v, useKeys ? k : iterations - 1, this$0);
        }
      });
      return iterations;
    };
    skipSequence.__iteratorUncached = function(type, reverse) {var this$0 = this;
      if (reverse) {
        return this.cacheResult().__iterator(type, reverse);
      }
      var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
      var skipping = true;
      var iterations = 0;
      return new Iterator(function()  {
        var step, k, v;
        do {
          step = iterator.next();
          if (step.done) {
            if (useKeys || type === ITERATE_VALUES) {
              return step;
            } else if (type === ITERATE_KEYS) {
              return iteratorValue(type, iterations++, undefined, step);
            } else {
              return iteratorValue(type, iterations++, step.value[1], step);
            }
          }
          var entry = step.value;
          k = entry[0];
          v = entry[1];
          skipping && (skipping = predicate.call(context, v, k, this$0));
        } while (skipping);
        return type === ITERATE_ENTRIES ? step :
          iteratorValue(type, k, v, step);
      });
    };
    return skipSequence;
  }


  function concatFactory(iterable, values) {
    var isKeyedIterable = isKeyed(iterable);
    var iters = [iterable].concat(values).map(function(v ) {
      if (!isIterable(v)) {
        v = isKeyedIterable ?
          keyedSeqFromValue(v) :
          indexedSeqFromValue(Array.isArray(v) ? v : [v]);
      } else if (isKeyedIterable) {
        v = KeyedIterable(v);
      }
      return v;
    }).filter(function(v ) {return v.size !== 0});

    if (iters.length === 0) {
      return iterable;
    }

    if (iters.length === 1) {
      var singleton = iters[0];
      if (singleton === iterable ||
          isKeyedIterable && isKeyed(singleton) ||
          isIndexed(iterable) && isIndexed(singleton)) {
        return singleton;
      }
    }

    var concatSeq = new ArraySeq(iters);
    if (isKeyedIterable) {
      concatSeq = concatSeq.toKeyedSeq();
    } else if (!isIndexed(iterable)) {
      concatSeq = concatSeq.toSetSeq();
    }
    concatSeq = concatSeq.flatten(true);
    concatSeq.size = iters.reduce(
      function(sum, seq)  {
        if (sum !== undefined) {
          var size = seq.size;
          if (size !== undefined) {
            return sum + size;
          }
        }
      },
      0
    );
    return concatSeq;
  }


  function flattenFactory(iterable, depth, useKeys) {
    var flatSequence = makeSequence(iterable);
    flatSequence.__iterateUncached = function(fn, reverse) {
      var iterations = 0;
      var stopped = false;
      function flatDeep(iter, currentDepth) {var this$0 = this;
        iter.__iterate(function(v, k)  {
          if ((!depth || currentDepth < depth) && isIterable(v)) {
            flatDeep(v, currentDepth + 1);
          } else if (fn(v, useKeys ? k : iterations++, this$0) === false) {
            stopped = true;
          }
          return !stopped;
        }, reverse);
      }
      flatDeep(iterable, 0);
      return iterations;
    }
    flatSequence.__iteratorUncached = function(type, reverse) {
      var iterator = iterable.__iterator(type, reverse);
      var stack = [];
      var iterations = 0;
      return new Iterator(function()  {
        while (iterator) {
          var step = iterator.next();
          if (step.done !== false) {
            iterator = stack.pop();
            continue;
          }
          var v = step.value;
          if (type === ITERATE_ENTRIES) {
            v = v[1];
          }
          if ((!depth || stack.length < depth) && isIterable(v)) {
            stack.push(iterator);
            iterator = v.__iterator(type, reverse);
          } else {
            return useKeys ? step : iteratorValue(type, iterations++, v, step);
          }
        }
        return iteratorDone();
      });
    }
    return flatSequence;
  }


  function flatMapFactory(iterable, mapper, context) {
    var coerce = iterableClass(iterable);
    return iterable.toSeq().map(
      function(v, k)  {return coerce(mapper.call(context, v, k, iterable))}
    ).flatten(true);
  }


  function interposeFactory(iterable, separator) {
    var interposedSequence = makeSequence(iterable);
    interposedSequence.size = iterable.size && iterable.size * 2 -1;
    interposedSequence.__iterateUncached = function(fn, reverse) {var this$0 = this;
      var iterations = 0;
      iterable.__iterate(function(v, k)
        {return (!iterations || fn(separator, iterations++, this$0) !== false) &&
        fn(v, iterations++, this$0) !== false},
        reverse
      );
      return iterations;
    };
    interposedSequence.__iteratorUncached = function(type, reverse) {
      var iterator = iterable.__iterator(ITERATE_VALUES, reverse);
      var iterations = 0;
      var step;
      return new Iterator(function()  {
        if (!step || iterations % 2) {
          step = iterator.next();
          if (step.done) {
            return step;
          }
        }
        return iterations % 2 ?
          iteratorValue(type, iterations++, separator) :
          iteratorValue(type, iterations++, step.value, step);
      });
    };
    return interposedSequence;
  }


  function sortFactory(iterable, comparator, mapper) {
    if (!comparator) {
      comparator = defaultComparator;
    }
    var isKeyedIterable = isKeyed(iterable);
    var index = 0;
    var entries = iterable.toSeq().map(
      function(v, k)  {return [k, v, index++, mapper ? mapper(v, k, iterable) : v]}
    ).toArray();
    entries.sort(function(a, b)  {return comparator(a[3], b[3]) || a[2] - b[2]}).forEach(
      isKeyedIterable ?
      function(v, i)  { entries[i].length = 2; } :
      function(v, i)  { entries[i] = v[1]; }
    );
    return isKeyedIterable ? KeyedSeq(entries) :
      isIndexed(iterable) ? IndexedSeq(entries) :
      SetSeq(entries);
  }


  function maxFactory(iterable, comparator, mapper) {
    if (!comparator) {
      comparator = defaultComparator;
    }
    if (mapper) {
      var entry = iterable.toSeq()
        .map(function(v, k)  {return [v, mapper(v, k, iterable)]})
        .reduce(function(a, b)  {return maxCompare(comparator, a[1], b[1]) ? b : a});
      return entry && entry[0];
    } else {
      return iterable.reduce(function(a, b)  {return maxCompare(comparator, a, b) ? b : a});
    }
  }

  function maxCompare(comparator, a, b) {
    var comp = comparator(b, a);
    // b is considered the new max if the comparator declares them equal, but
    // they are not equal and b is in fact a nullish value.
    return (comp === 0 && b !== a && (b === undefined || b === null || b !== b)) || comp > 0;
  }


  function zipWithFactory(keyIter, zipper, iters) {
    var zipSequence = makeSequence(keyIter);
    zipSequence.size = new ArraySeq(iters).map(function(i ) {return i.size}).min();
    // Note: this a generic base implementation of __iterate in terms of
    // __iterator which may be more generically useful in the future.
    zipSequence.__iterate = function(fn, reverse) {
      /* generic:
      var iterator = this.__iterator(ITERATE_ENTRIES, reverse);
      var step;
      var iterations = 0;
      while (!(step = iterator.next()).done) {
        iterations++;
        if (fn(step.value[1], step.value[0], this) === false) {
          break;
        }
      }
      return iterations;
      */
      // indexed:
      var iterator = this.__iterator(ITERATE_VALUES, reverse);
      var step;
      var iterations = 0;
      while (!(step = iterator.next()).done) {
        if (fn(step.value, iterations++, this) === false) {
          break;
        }
      }
      return iterations;
    };
    zipSequence.__iteratorUncached = function(type, reverse) {
      var iterators = iters.map(function(i )
        {return (i = Iterable(i), getIterator(reverse ? i.reverse() : i))}
      );
      var iterations = 0;
      var isDone = false;
      return new Iterator(function()  {
        var steps;
        if (!isDone) {
          steps = iterators.map(function(i ) {return i.next()});
          isDone = steps.some(function(s ) {return s.done});
        }
        if (isDone) {
          return iteratorDone();
        }
        return iteratorValue(
          type,
          iterations++,
          zipper.apply(null, steps.map(function(s ) {return s.value}))
        );
      });
    };
    return zipSequence
  }


  // #pragma Helper Functions

  function reify(iter, seq) {
    return isSeq(iter) ? seq : iter.constructor(seq);
  }

  function validateEntry(entry) {
    if (entry !== Object(entry)) {
      throw new TypeError('Expected [K, V] tuple: ' + entry);
    }
  }

  function resolveSize(iter) {
    assertNotInfinite(iter.size);
    return ensureSize(iter);
  }

  function iterableClass(iterable) {
    return isKeyed(iterable) ? KeyedIterable :
      isIndexed(iterable) ? IndexedIterable :
      SetIterable;
  }

  function makeSequence(iterable) {
    return Object.create(
      (
        isKeyed(iterable) ? KeyedSeq :
        isIndexed(iterable) ? IndexedSeq :
        SetSeq
      ).prototype
    );
  }

  function cacheResultThrough() {
    if (this._iter.cacheResult) {
      this._iter.cacheResult();
      this.size = this._iter.size;
      return this;
    } else {
      return Seq.prototype.cacheResult.call(this);
    }
  }

  function defaultComparator(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
  }

  function forceIterator(keyPath) {
    var iter = getIterator(keyPath);
    if (!iter) {
      // Array might not be iterable in this environment, so we need a fallback
      // to our wrapped type.
      if (!isArrayLike(keyPath)) {
        throw new TypeError('Expected iterable or array-like: ' + keyPath);
      }
      iter = getIterator(Iterable(keyPath));
    }
    return iter;
  }

  createClass(Record, KeyedCollection);

    function Record(defaultValues, name) {
      var hasInitialized;

      var RecordType = function Record(values) {
        if (values instanceof RecordType) {
          return values;
        }
        if (!(this instanceof RecordType)) {
          return new RecordType(values);
        }
        if (!hasInitialized) {
          hasInitialized = true;
          var keys = Object.keys(defaultValues);
          setProps(RecordTypePrototype, keys);
          RecordTypePrototype.size = keys.length;
          RecordTypePrototype._name = name;
          RecordTypePrototype._keys = keys;
          RecordTypePrototype._defaultValues = defaultValues;
        }
        this._map = Map(values);
      };

      var RecordTypePrototype = RecordType.prototype = Object.create(RecordPrototype);
      RecordTypePrototype.constructor = RecordType;

      return RecordType;
    }

    Record.prototype.toString = function() {
      return this.__toString(recordName(this) + ' {', '}');
    };

    // @pragma Access

    Record.prototype.has = function(k) {
      return this._defaultValues.hasOwnProperty(k);
    };

    Record.prototype.get = function(k, notSetValue) {
      if (!this.has(k)) {
        return notSetValue;
      }
      var defaultVal = this._defaultValues[k];
      return this._map ? this._map.get(k, defaultVal) : defaultVal;
    };

    // @pragma Modification

    Record.prototype.clear = function() {
      if (this.__ownerID) {
        this._map && this._map.clear();
        return this;
      }
      var RecordType = this.constructor;
      return RecordType._empty || (RecordType._empty = makeRecord(this, emptyMap()));
    };

    Record.prototype.set = function(k, v) {
      if (!this.has(k)) {
        throw new Error('Cannot set unknown key "' + k + '" on ' + recordName(this));
      }
      if (this._map && !this._map.has(k)) {
        var defaultVal = this._defaultValues[k];
        if (v === defaultVal) {
          return this;
        }
      }
      var newMap = this._map && this._map.set(k, v);
      if (this.__ownerID || newMap === this._map) {
        return this;
      }
      return makeRecord(this, newMap);
    };

    Record.prototype.remove = function(k) {
      if (!this.has(k)) {
        return this;
      }
      var newMap = this._map && this._map.remove(k);
      if (this.__ownerID || newMap === this._map) {
        return this;
      }
      return makeRecord(this, newMap);
    };

    Record.prototype.wasAltered = function() {
      return this._map.wasAltered();
    };

    Record.prototype.__iterator = function(type, reverse) {var this$0 = this;
      return KeyedIterable(this._defaultValues).map(function(_, k)  {return this$0.get(k)}).__iterator(type, reverse);
    };

    Record.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      return KeyedIterable(this._defaultValues).map(function(_, k)  {return this$0.get(k)}).__iterate(fn, reverse);
    };

    Record.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      var newMap = this._map && this._map.__ensureOwner(ownerID);
      if (!ownerID) {
        this.__ownerID = ownerID;
        this._map = newMap;
        return this;
      }
      return makeRecord(this, newMap, ownerID);
    };


  var RecordPrototype = Record.prototype;
  RecordPrototype[DELETE] = RecordPrototype.remove;
  RecordPrototype.deleteIn =
  RecordPrototype.removeIn = MapPrototype.removeIn;
  RecordPrototype.merge = MapPrototype.merge;
  RecordPrototype.mergeWith = MapPrototype.mergeWith;
  RecordPrototype.mergeIn = MapPrototype.mergeIn;
  RecordPrototype.mergeDeep = MapPrototype.mergeDeep;
  RecordPrototype.mergeDeepWith = MapPrototype.mergeDeepWith;
  RecordPrototype.mergeDeepIn = MapPrototype.mergeDeepIn;
  RecordPrototype.setIn = MapPrototype.setIn;
  RecordPrototype.update = MapPrototype.update;
  RecordPrototype.updateIn = MapPrototype.updateIn;
  RecordPrototype.withMutations = MapPrototype.withMutations;
  RecordPrototype.asMutable = MapPrototype.asMutable;
  RecordPrototype.asImmutable = MapPrototype.asImmutable;


  function makeRecord(likeRecord, map, ownerID) {
    var record = Object.create(Object.getPrototypeOf(likeRecord));
    record._map = map;
    record.__ownerID = ownerID;
    return record;
  }

  function recordName(record) {
    return record._name || record.constructor.name || 'Record';
  }

  function setProps(prototype, names) {
    try {
      names.forEach(setProp.bind(undefined, prototype));
    } catch (error) {
      // Object.defineProperty failed. Probably IE8.
    }
  }

  function setProp(prototype, name) {
    Object.defineProperty(prototype, name, {
      get: function() {
        return this.get(name);
      },
      set: function(value) {
        invariant(this.__ownerID, 'Cannot set on an immutable record.');
        this.set(name, value);
      }
    });
  }

  createClass(Set, SetCollection);

    // @pragma Construction

    function Set(value) {
      return value === null || value === undefined ? emptySet() :
        isSet(value) && !isOrdered(value) ? value :
        emptySet().withMutations(function(set ) {
          var iter = SetIterable(value);
          assertNotInfinite(iter.size);
          iter.forEach(function(v ) {return set.add(v)});
        });
    }

    Set.of = function(/*...values*/) {
      return this(arguments);
    };

    Set.fromKeys = function(value) {
      return this(KeyedIterable(value).keySeq());
    };

    Set.prototype.toString = function() {
      return this.__toString('Set {', '}');
    };

    // @pragma Access

    Set.prototype.has = function(value) {
      return this._map.has(value);
    };

    // @pragma Modification

    Set.prototype.add = function(value) {
      return updateSet(this, this._map.set(value, true));
    };

    Set.prototype.remove = function(value) {
      return updateSet(this, this._map.remove(value));
    };

    Set.prototype.clear = function() {
      return updateSet(this, this._map.clear());
    };

    // @pragma Composition

    Set.prototype.union = function() {var iters = SLICE$0.call(arguments, 0);
      iters = iters.filter(function(x ) {return x.size !== 0});
      if (iters.length === 0) {
        return this;
      }
      if (this.size === 0 && !this.__ownerID && iters.length === 1) {
        return this.constructor(iters[0]);
      }
      return this.withMutations(function(set ) {
        for (var ii = 0; ii < iters.length; ii++) {
          SetIterable(iters[ii]).forEach(function(value ) {return set.add(value)});
        }
      });
    };

    Set.prototype.intersect = function() {var iters = SLICE$0.call(arguments, 0);
      if (iters.length === 0) {
        return this;
      }
      iters = iters.map(function(iter ) {return SetIterable(iter)});
      var originalSet = this;
      return this.withMutations(function(set ) {
        originalSet.forEach(function(value ) {
          if (!iters.every(function(iter ) {return iter.includes(value)})) {
            set.remove(value);
          }
        });
      });
    };

    Set.prototype.subtract = function() {var iters = SLICE$0.call(arguments, 0);
      if (iters.length === 0) {
        return this;
      }
      iters = iters.map(function(iter ) {return SetIterable(iter)});
      var originalSet = this;
      return this.withMutations(function(set ) {
        originalSet.forEach(function(value ) {
          if (iters.some(function(iter ) {return iter.includes(value)})) {
            set.remove(value);
          }
        });
      });
    };

    Set.prototype.merge = function() {
      return this.union.apply(this, arguments);
    };

    Set.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
      return this.union.apply(this, iters);
    };

    Set.prototype.sort = function(comparator) {
      // Late binding
      return OrderedSet(sortFactory(this, comparator));
    };

    Set.prototype.sortBy = function(mapper, comparator) {
      // Late binding
      return OrderedSet(sortFactory(this, comparator, mapper));
    };

    Set.prototype.wasAltered = function() {
      return this._map.wasAltered();
    };

    Set.prototype.__iterate = function(fn, reverse) {var this$0 = this;
      return this._map.__iterate(function(_, k)  {return fn(k, k, this$0)}, reverse);
    };

    Set.prototype.__iterator = function(type, reverse) {
      return this._map.map(function(_, k)  {return k}).__iterator(type, reverse);
    };

    Set.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      var newMap = this._map.__ensureOwner(ownerID);
      if (!ownerID) {
        this.__ownerID = ownerID;
        this._map = newMap;
        return this;
      }
      return this.__make(newMap, ownerID);
    };


  function isSet(maybeSet) {
    return !!(maybeSet && maybeSet[IS_SET_SENTINEL]);
  }

  Set.isSet = isSet;

  var IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@';

  var SetPrototype = Set.prototype;
  SetPrototype[IS_SET_SENTINEL] = true;
  SetPrototype[DELETE] = SetPrototype.remove;
  SetPrototype.mergeDeep = SetPrototype.merge;
  SetPrototype.mergeDeepWith = SetPrototype.mergeWith;
  SetPrototype.withMutations = MapPrototype.withMutations;
  SetPrototype.asMutable = MapPrototype.asMutable;
  SetPrototype.asImmutable = MapPrototype.asImmutable;

  SetPrototype.__empty = emptySet;
  SetPrototype.__make = makeSet;

  function updateSet(set, newMap) {
    if (set.__ownerID) {
      set.size = newMap.size;
      set._map = newMap;
      return set;
    }
    return newMap === set._map ? set :
      newMap.size === 0 ? set.__empty() :
      set.__make(newMap);
  }

  function makeSet(map, ownerID) {
    var set = Object.create(SetPrototype);
    set.size = map ? map.size : 0;
    set._map = map;
    set.__ownerID = ownerID;
    return set;
  }

  var EMPTY_SET;
  function emptySet() {
    return EMPTY_SET || (EMPTY_SET = makeSet(emptyMap()));
  }

  createClass(OrderedSet, Set);

    // @pragma Construction

    function OrderedSet(value) {
      return value === null || value === undefined ? emptyOrderedSet() :
        isOrderedSet(value) ? value :
        emptyOrderedSet().withMutations(function(set ) {
          var iter = SetIterable(value);
          assertNotInfinite(iter.size);
          iter.forEach(function(v ) {return set.add(v)});
        });
    }

    OrderedSet.of = function(/*...values*/) {
      return this(arguments);
    };

    OrderedSet.fromKeys = function(value) {
      return this(KeyedIterable(value).keySeq());
    };

    OrderedSet.prototype.toString = function() {
      return this.__toString('OrderedSet {', '}');
    };


  function isOrderedSet(maybeOrderedSet) {
    return isSet(maybeOrderedSet) && isOrdered(maybeOrderedSet);
  }

  OrderedSet.isOrderedSet = isOrderedSet;

  var OrderedSetPrototype = OrderedSet.prototype;
  OrderedSetPrototype[IS_ORDERED_SENTINEL] = true;

  OrderedSetPrototype.__empty = emptyOrderedSet;
  OrderedSetPrototype.__make = makeOrderedSet;

  function makeOrderedSet(map, ownerID) {
    var set = Object.create(OrderedSetPrototype);
    set.size = map ? map.size : 0;
    set._map = map;
    set.__ownerID = ownerID;
    return set;
  }

  var EMPTY_ORDERED_SET;
  function emptyOrderedSet() {
    return EMPTY_ORDERED_SET || (EMPTY_ORDERED_SET = makeOrderedSet(emptyOrderedMap()));
  }

  createClass(Stack, IndexedCollection);

    // @pragma Construction

    function Stack(value) {
      return value === null || value === undefined ? emptyStack() :
        isStack(value) ? value :
        emptyStack().unshiftAll(value);
    }

    Stack.of = function(/*...values*/) {
      return this(arguments);
    };

    Stack.prototype.toString = function() {
      return this.__toString('Stack [', ']');
    };

    // @pragma Access

    Stack.prototype.get = function(index, notSetValue) {
      var head = this._head;
      index = wrapIndex(this, index);
      while (head && index--) {
        head = head.next;
      }
      return head ? head.value : notSetValue;
    };

    Stack.prototype.peek = function() {
      return this._head && this._head.value;
    };

    // @pragma Modification

    Stack.prototype.push = function(/*...values*/) {
      if (arguments.length === 0) {
        return this;
      }
      var newSize = this.size + arguments.length;
      var head = this._head;
      for (var ii = arguments.length - 1; ii >= 0; ii--) {
        head = {
          value: arguments[ii],
          next: head
        };
      }
      if (this.__ownerID) {
        this.size = newSize;
        this._head = head;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return makeStack(newSize, head);
    };

    Stack.prototype.pushAll = function(iter) {
      iter = IndexedIterable(iter);
      if (iter.size === 0) {
        return this;
      }
      assertNotInfinite(iter.size);
      var newSize = this.size;
      var head = this._head;
      iter.reverse().forEach(function(value ) {
        newSize++;
        head = {
          value: value,
          next: head
        };
      });
      if (this.__ownerID) {
        this.size = newSize;
        this._head = head;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return makeStack(newSize, head);
    };

    Stack.prototype.pop = function() {
      return this.slice(1);
    };

    Stack.prototype.unshift = function(/*...values*/) {
      return this.push.apply(this, arguments);
    };

    Stack.prototype.unshiftAll = function(iter) {
      return this.pushAll(iter);
    };

    Stack.prototype.shift = function() {
      return this.pop.apply(this, arguments);
    };

    Stack.prototype.clear = function() {
      if (this.size === 0) {
        return this;
      }
      if (this.__ownerID) {
        this.size = 0;
        this._head = undefined;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return emptyStack();
    };

    Stack.prototype.slice = function(begin, end) {
      if (wholeSlice(begin, end, this.size)) {
        return this;
      }
      var resolvedBegin = resolveBegin(begin, this.size);
      var resolvedEnd = resolveEnd(end, this.size);
      if (resolvedEnd !== this.size) {
        // super.slice(begin, end);
        return IndexedCollection.prototype.slice.call(this, begin, end);
      }
      var newSize = this.size - resolvedBegin;
      var head = this._head;
      while (resolvedBegin--) {
        head = head.next;
      }
      if (this.__ownerID) {
        this.size = newSize;
        this._head = head;
        this.__hash = undefined;
        this.__altered = true;
        return this;
      }
      return makeStack(newSize, head);
    };

    // @pragma Mutability

    Stack.prototype.__ensureOwner = function(ownerID) {
      if (ownerID === this.__ownerID) {
        return this;
      }
      if (!ownerID) {
        this.__ownerID = ownerID;
        this.__altered = false;
        return this;
      }
      return makeStack(this.size, this._head, ownerID, this.__hash);
    };

    // @pragma Iteration

    Stack.prototype.__iterate = function(fn, reverse) {
      if (reverse) {
        return this.reverse().__iterate(fn);
      }
      var iterations = 0;
      var node = this._head;
      while (node) {
        if (fn(node.value, iterations++, this) === false) {
          break;
        }
        node = node.next;
      }
      return iterations;
    };

    Stack.prototype.__iterator = function(type, reverse) {
      if (reverse) {
        return this.reverse().__iterator(type);
      }
      var iterations = 0;
      var node = this._head;
      return new Iterator(function()  {
        if (node) {
          var value = node.value;
          node = node.next;
          return iteratorValue(type, iterations++, value);
        }
        return iteratorDone();
      });
    };


  function isStack(maybeStack) {
    return !!(maybeStack && maybeStack[IS_STACK_SENTINEL]);
  }

  Stack.isStack = isStack;

  var IS_STACK_SENTINEL = '@@__IMMUTABLE_STACK__@@';

  var StackPrototype = Stack.prototype;
  StackPrototype[IS_STACK_SENTINEL] = true;
  StackPrototype.withMutations = MapPrototype.withMutations;
  StackPrototype.asMutable = MapPrototype.asMutable;
  StackPrototype.asImmutable = MapPrototype.asImmutable;
  StackPrototype.wasAltered = MapPrototype.wasAltered;


  function makeStack(size, head, ownerID, hash) {
    var map = Object.create(StackPrototype);
    map.size = size;
    map._head = head;
    map.__ownerID = ownerID;
    map.__hash = hash;
    map.__altered = false;
    return map;
  }

  var EMPTY_STACK;
  function emptyStack() {
    return EMPTY_STACK || (EMPTY_STACK = makeStack(0));
  }

  /**
   * Contributes additional methods to a constructor
   */
  function mixin(ctor, methods) {
    var keyCopier = function(key ) { ctor.prototype[key] = methods[key]; };
    Object.keys(methods).forEach(keyCopier);
    Object.getOwnPropertySymbols &&
      Object.getOwnPropertySymbols(methods).forEach(keyCopier);
    return ctor;
  }

  Iterable.Iterator = Iterator;

  mixin(Iterable, {

    // ### Conversion to other types

    toArray: function() {
      assertNotInfinite(this.size);
      var array = new Array(this.size || 0);
      this.valueSeq().__iterate(function(v, i)  { array[i] = v; });
      return array;
    },

    toIndexedSeq: function() {
      return new ToIndexedSequence(this);
    },

    toJS: function() {
      return this.toSeq().map(
        function(value ) {return value && typeof value.toJS === 'function' ? value.toJS() : value}
      ).__toJS();
    },

    toJSON: function() {
      return this.toSeq().map(
        function(value ) {return value && typeof value.toJSON === 'function' ? value.toJSON() : value}
      ).__toJS();
    },

    toKeyedSeq: function() {
      return new ToKeyedSequence(this, true);
    },

    toMap: function() {
      // Use Late Binding here to solve the circular dependency.
      return Map(this.toKeyedSeq());
    },

    toObject: function() {
      assertNotInfinite(this.size);
      var object = {};
      this.__iterate(function(v, k)  { object[k] = v; });
      return object;
    },

    toOrderedMap: function() {
      // Use Late Binding here to solve the circular dependency.
      return OrderedMap(this.toKeyedSeq());
    },

    toOrderedSet: function() {
      // Use Late Binding here to solve the circular dependency.
      return OrderedSet(isKeyed(this) ? this.valueSeq() : this);
    },

    toSet: function() {
      // Use Late Binding here to solve the circular dependency.
      return Set(isKeyed(this) ? this.valueSeq() : this);
    },

    toSetSeq: function() {
      return new ToSetSequence(this);
    },

    toSeq: function() {
      return isIndexed(this) ? this.toIndexedSeq() :
        isKeyed(this) ? this.toKeyedSeq() :
        this.toSetSeq();
    },

    toStack: function() {
      // Use Late Binding here to solve the circular dependency.
      return Stack(isKeyed(this) ? this.valueSeq() : this);
    },

    toList: function() {
      // Use Late Binding here to solve the circular dependency.
      return List(isKeyed(this) ? this.valueSeq() : this);
    },


    // ### Common JavaScript methods and properties

    toString: function() {
      return '[Iterable]';
    },

    __toString: function(head, tail) {
      if (this.size === 0) {
        return head + tail;
      }
      return head + ' ' + this.toSeq().map(this.__toStringMapper).join(', ') + ' ' + tail;
    },


    // ### ES6 Collection methods (ES6 Array and Map)

    concat: function() {var values = SLICE$0.call(arguments, 0);
      return reify(this, concatFactory(this, values));
    },

    includes: function(searchValue) {
      return this.some(function(value ) {return is(value, searchValue)});
    },

    entries: function() {
      return this.__iterator(ITERATE_ENTRIES);
    },

    every: function(predicate, context) {
      assertNotInfinite(this.size);
      var returnValue = true;
      this.__iterate(function(v, k, c)  {
        if (!predicate.call(context, v, k, c)) {
          returnValue = false;
          return false;
        }
      });
      return returnValue;
    },

    filter: function(predicate, context) {
      return reify(this, filterFactory(this, predicate, context, true));
    },

    find: function(predicate, context, notSetValue) {
      var entry = this.findEntry(predicate, context);
      return entry ? entry[1] : notSetValue;
    },

    forEach: function(sideEffect, context) {
      assertNotInfinite(this.size);
      return this.__iterate(context ? sideEffect.bind(context) : sideEffect);
    },

    join: function(separator) {
      assertNotInfinite(this.size);
      separator = separator !== undefined ? '' + separator : ',';
      var joined = '';
      var isFirst = true;
      this.__iterate(function(v ) {
        isFirst ? (isFirst = false) : (joined += separator);
        joined += v !== null && v !== undefined ? v.toString() : '';
      });
      return joined;
    },

    keys: function() {
      return this.__iterator(ITERATE_KEYS);
    },

    map: function(mapper, context) {
      return reify(this, mapFactory(this, mapper, context));
    },

    reduce: function(reducer, initialReduction, context) {
      assertNotInfinite(this.size);
      var reduction;
      var useFirst;
      if (arguments.length < 2) {
        useFirst = true;
      } else {
        reduction = initialReduction;
      }
      this.__iterate(function(v, k, c)  {
        if (useFirst) {
          useFirst = false;
          reduction = v;
        } else {
          reduction = reducer.call(context, reduction, v, k, c);
        }
      });
      return reduction;
    },

    reduceRight: function(reducer, initialReduction, context) {
      var reversed = this.toKeyedSeq().reverse();
      return reversed.reduce.apply(reversed, arguments);
    },

    reverse: function() {
      return reify(this, reverseFactory(this, true));
    },

    slice: function(begin, end) {
      return reify(this, sliceFactory(this, begin, end, true));
    },

    some: function(predicate, context) {
      return !this.every(not(predicate), context);
    },

    sort: function(comparator) {
      return reify(this, sortFactory(this, comparator));
    },

    values: function() {
      return this.__iterator(ITERATE_VALUES);
    },


    // ### More sequential methods

    butLast: function() {
      return this.slice(0, -1);
    },

    isEmpty: function() {
      return this.size !== undefined ? this.size === 0 : !this.some(function()  {return true});
    },

    count: function(predicate, context) {
      return ensureSize(
        predicate ? this.toSeq().filter(predicate, context) : this
      );
    },

    countBy: function(grouper, context) {
      return countByFactory(this, grouper, context);
    },

    equals: function(other) {
      return deepEqual(this, other);
    },

    entrySeq: function() {
      var iterable = this;
      if (iterable._cache) {
        // We cache as an entries array, so we can just return the cache!
        return new ArraySeq(iterable._cache);
      }
      var entriesSequence = iterable.toSeq().map(entryMapper).toIndexedSeq();
      entriesSequence.fromEntrySeq = function()  {return iterable.toSeq()};
      return entriesSequence;
    },

    filterNot: function(predicate, context) {
      return this.filter(not(predicate), context);
    },

    findEntry: function(predicate, context, notSetValue) {
      var found = notSetValue;
      this.__iterate(function(v, k, c)  {
        if (predicate.call(context, v, k, c)) {
          found = [k, v];
          return false;
        }
      });
      return found;
    },

    findKey: function(predicate, context) {
      var entry = this.findEntry(predicate, context);
      return entry && entry[0];
    },

    findLast: function(predicate, context, notSetValue) {
      return this.toKeyedSeq().reverse().find(predicate, context, notSetValue);
    },

    findLastEntry: function(predicate, context, notSetValue) {
      return this.toKeyedSeq().reverse().findEntry(predicate, context, notSetValue);
    },

    findLastKey: function(predicate, context) {
      return this.toKeyedSeq().reverse().findKey(predicate, context);
    },

    first: function() {
      return this.find(returnTrue);
    },

    flatMap: function(mapper, context) {
      return reify(this, flatMapFactory(this, mapper, context));
    },

    flatten: function(depth) {
      return reify(this, flattenFactory(this, depth, true));
    },

    fromEntrySeq: function() {
      return new FromEntriesSequence(this);
    },

    get: function(searchKey, notSetValue) {
      return this.find(function(_, key)  {return is(key, searchKey)}, undefined, notSetValue);
    },

    getIn: function(searchKeyPath, notSetValue) {
      var nested = this;
      // Note: in an ES6 environment, we would prefer:
      // for (var key of searchKeyPath) {
      var iter = forceIterator(searchKeyPath);
      var step;
      while (!(step = iter.next()).done) {
        var key = step.value;
        nested = nested && nested.get ? nested.get(key, NOT_SET) : NOT_SET;
        if (nested === NOT_SET) {
          return notSetValue;
        }
      }
      return nested;
    },

    groupBy: function(grouper, context) {
      return groupByFactory(this, grouper, context);
    },

    has: function(searchKey) {
      return this.get(searchKey, NOT_SET) !== NOT_SET;
    },

    hasIn: function(searchKeyPath) {
      return this.getIn(searchKeyPath, NOT_SET) !== NOT_SET;
    },

    isSubset: function(iter) {
      iter = typeof iter.includes === 'function' ? iter : Iterable(iter);
      return this.every(function(value ) {return iter.includes(value)});
    },

    isSuperset: function(iter) {
      iter = typeof iter.isSubset === 'function' ? iter : Iterable(iter);
      return iter.isSubset(this);
    },

    keyOf: function(searchValue) {
      return this.findKey(function(value ) {return is(value, searchValue)});
    },

    keySeq: function() {
      return this.toSeq().map(keyMapper).toIndexedSeq();
    },

    last: function() {
      return this.toSeq().reverse().first();
    },

    lastKeyOf: function(searchValue) {
      return this.toKeyedSeq().reverse().keyOf(searchValue);
    },

    max: function(comparator) {
      return maxFactory(this, comparator);
    },

    maxBy: function(mapper, comparator) {
      return maxFactory(this, comparator, mapper);
    },

    min: function(comparator) {
      return maxFactory(this, comparator ? neg(comparator) : defaultNegComparator);
    },

    minBy: function(mapper, comparator) {
      return maxFactory(this, comparator ? neg(comparator) : defaultNegComparator, mapper);
    },

    rest: function() {
      return this.slice(1);
    },

    skip: function(amount) {
      return this.slice(Math.max(0, amount));
    },

    skipLast: function(amount) {
      return reify(this, this.toSeq().reverse().skip(amount).reverse());
    },

    skipWhile: function(predicate, context) {
      return reify(this, skipWhileFactory(this, predicate, context, true));
    },

    skipUntil: function(predicate, context) {
      return this.skipWhile(not(predicate), context);
    },

    sortBy: function(mapper, comparator) {
      return reify(this, sortFactory(this, comparator, mapper));
    },

    take: function(amount) {
      return this.slice(0, Math.max(0, amount));
    },

    takeLast: function(amount) {
      return reify(this, this.toSeq().reverse().take(amount).reverse());
    },

    takeWhile: function(predicate, context) {
      return reify(this, takeWhileFactory(this, predicate, context));
    },

    takeUntil: function(predicate, context) {
      return this.takeWhile(not(predicate), context);
    },

    valueSeq: function() {
      return this.toIndexedSeq();
    },


    // ### Hashable Object

    hashCode: function() {
      return this.__hash || (this.__hash = hashIterable(this));
    }


    // ### Internal

    // abstract __iterate(fn, reverse)

    // abstract __iterator(type, reverse)
  });

  // var IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@';
  // var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
  // var IS_INDEXED_SENTINEL = '@@__IMMUTABLE_INDEXED__@@';
  // var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';

  var IterablePrototype = Iterable.prototype;
  IterablePrototype[IS_ITERABLE_SENTINEL] = true;
  IterablePrototype[ITERATOR_SYMBOL] = IterablePrototype.values;
  IterablePrototype.__toJS = IterablePrototype.toArray;
  IterablePrototype.__toStringMapper = quoteString;
  IterablePrototype.inspect =
  IterablePrototype.toSource = function() { return this.toString(); };
  IterablePrototype.chain = IterablePrototype.flatMap;
  IterablePrototype.contains = IterablePrototype.includes;

  mixin(KeyedIterable, {

    // ### More sequential methods

    flip: function() {
      return reify(this, flipFactory(this));
    },

    mapEntries: function(mapper, context) {var this$0 = this;
      var iterations = 0;
      return reify(this,
        this.toSeq().map(
          function(v, k)  {return mapper.call(context, [k, v], iterations++, this$0)}
        ).fromEntrySeq()
      );
    },

    mapKeys: function(mapper, context) {var this$0 = this;
      return reify(this,
        this.toSeq().flip().map(
          function(k, v)  {return mapper.call(context, k, v, this$0)}
        ).flip()
      );
    }

  });

  var KeyedIterablePrototype = KeyedIterable.prototype;
  KeyedIterablePrototype[IS_KEYED_SENTINEL] = true;
  KeyedIterablePrototype[ITERATOR_SYMBOL] = IterablePrototype.entries;
  KeyedIterablePrototype.__toJS = IterablePrototype.toObject;
  KeyedIterablePrototype.__toStringMapper = function(v, k)  {return JSON.stringify(k) + ': ' + quoteString(v)};



  mixin(IndexedIterable, {

    // ### Conversion to other types

    toKeyedSeq: function() {
      return new ToKeyedSequence(this, false);
    },


    // ### ES6 Collection methods (ES6 Array and Map)

    filter: function(predicate, context) {
      return reify(this, filterFactory(this, predicate, context, false));
    },

    findIndex: function(predicate, context) {
      var entry = this.findEntry(predicate, context);
      return entry ? entry[0] : -1;
    },

    indexOf: function(searchValue) {
      var key = this.keyOf(searchValue);
      return key === undefined ? -1 : key;
    },

    lastIndexOf: function(searchValue) {
      var key = this.lastKeyOf(searchValue);
      return key === undefined ? -1 : key;
    },

    reverse: function() {
      return reify(this, reverseFactory(this, false));
    },

    slice: function(begin, end) {
      return reify(this, sliceFactory(this, begin, end, false));
    },

    splice: function(index, removeNum /*, ...values*/) {
      var numArgs = arguments.length;
      removeNum = Math.max(removeNum | 0, 0);
      if (numArgs === 0 || (numArgs === 2 && !removeNum)) {
        return this;
      }
      // If index is negative, it should resolve relative to the size of the
      // collection. However size may be expensive to compute if not cached, so
      // only call count() if the number is in fact negative.
      index = resolveBegin(index, index < 0 ? this.count() : this.size);
      var spliced = this.slice(0, index);
      return reify(
        this,
        numArgs === 1 ?
          spliced :
          spliced.concat(arrCopy(arguments, 2), this.slice(index + removeNum))
      );
    },


    // ### More collection methods

    findLastIndex: function(predicate, context) {
      var entry = this.findLastEntry(predicate, context);
      return entry ? entry[0] : -1;
    },

    first: function() {
      return this.get(0);
    },

    flatten: function(depth) {
      return reify(this, flattenFactory(this, depth, false));
    },

    get: function(index, notSetValue) {
      index = wrapIndex(this, index);
      return (index < 0 || (this.size === Infinity ||
          (this.size !== undefined && index > this.size))) ?
        notSetValue :
        this.find(function(_, key)  {return key === index}, undefined, notSetValue);
    },

    has: function(index) {
      index = wrapIndex(this, index);
      return index >= 0 && (this.size !== undefined ?
        this.size === Infinity || index < this.size :
        this.indexOf(index) !== -1
      );
    },

    interpose: function(separator) {
      return reify(this, interposeFactory(this, separator));
    },

    interleave: function(/*...iterables*/) {
      var iterables = [this].concat(arrCopy(arguments));
      var zipped = zipWithFactory(this.toSeq(), IndexedSeq.of, iterables);
      var interleaved = zipped.flatten(true);
      if (zipped.size) {
        interleaved.size = zipped.size * iterables.length;
      }
      return reify(this, interleaved);
    },

    keySeq: function() {
      return Range(0, this.size);
    },

    last: function() {
      return this.get(-1);
    },

    skipWhile: function(predicate, context) {
      return reify(this, skipWhileFactory(this, predicate, context, false));
    },

    zip: function(/*, ...iterables */) {
      var iterables = [this].concat(arrCopy(arguments));
      return reify(this, zipWithFactory(this, defaultZipper, iterables));
    },

    zipWith: function(zipper/*, ...iterables */) {
      var iterables = arrCopy(arguments);
      iterables[0] = this;
      return reify(this, zipWithFactory(this, zipper, iterables));
    }

  });

  IndexedIterable.prototype[IS_INDEXED_SENTINEL] = true;
  IndexedIterable.prototype[IS_ORDERED_SENTINEL] = true;



  mixin(SetIterable, {

    // ### ES6 Collection methods (ES6 Array and Map)

    get: function(value, notSetValue) {
      return this.has(value) ? value : notSetValue;
    },

    includes: function(value) {
      return this.has(value);
    },


    // ### More sequential methods

    keySeq: function() {
      return this.valueSeq();
    }

  });

  SetIterable.prototype.has = IterablePrototype.includes;
  SetIterable.prototype.contains = SetIterable.prototype.includes;


  // Mixin subclasses

  mixin(KeyedSeq, KeyedIterable.prototype);
  mixin(IndexedSeq, IndexedIterable.prototype);
  mixin(SetSeq, SetIterable.prototype);

  mixin(KeyedCollection, KeyedIterable.prototype);
  mixin(IndexedCollection, IndexedIterable.prototype);
  mixin(SetCollection, SetIterable.prototype);


  // #pragma Helper functions

  function keyMapper(v, k) {
    return k;
  }

  function entryMapper(v, k) {
    return [k, v];
  }

  function not(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    }
  }

  function neg(predicate) {
    return function() {
      return -predicate.apply(this, arguments);
    }
  }

  function quoteString(value) {
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
  }

  function defaultZipper() {
    return arrCopy(arguments);
  }

  function defaultNegComparator(a, b) {
    return a < b ? 1 : a > b ? -1 : 0;
  }

  function hashIterable(iterable) {
    if (iterable.size === Infinity) {
      return 0;
    }
    var ordered = isOrdered(iterable);
    var keyed = isKeyed(iterable);
    var h = ordered ? 1 : 0;
    var size = iterable.__iterate(
      keyed ?
        ordered ?
          function(v, k)  { h = 31 * h + hashMerge(hash(v), hash(k)) | 0; } :
          function(v, k)  { h = h + hashMerge(hash(v), hash(k)) | 0; } :
        ordered ?
          function(v ) { h = 31 * h + hash(v) | 0; } :
          function(v ) { h = h + hash(v) | 0; }
    );
    return murmurHashOfSize(size, h);
  }

  function murmurHashOfSize(size, h) {
    h = imul(h, 0xCC9E2D51);
    h = imul(h << 15 | h >>> -15, 0x1B873593);
    h = imul(h << 13 | h >>> -13, 5);
    h = (h + 0xE6546B64 | 0) ^ size;
    h = imul(h ^ h >>> 16, 0x85EBCA6B);
    h = imul(h ^ h >>> 13, 0xC2B2AE35);
    h = smi(h ^ h >>> 16);
    return h;
  }

  function hashMerge(a, b) {
    return a ^ b + 0x9E3779B9 + (a << 6) + (a >> 2) | 0; // int
  }

  var Immutable = {

    Iterable: Iterable,

    Seq: Seq,
    Collection: Collection,
    Map: Map,
    OrderedMap: OrderedMap,
    List: List,
    Stack: Stack,
    Set: Set,
    OrderedSet: OrderedSet,

    Record: Record,
    Range: Range,
    Repeat: Repeat,

    is: is,
    fromJS: fromJS

  };

  return Immutable;

}));

/***/ }),
/* 3 */
/***/ (function(module, exports) {

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} predicate The function invoked per iteration.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 1 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return baseFindIndex(array, baseIsNaN, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.isNaN` without support for number objects.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 */
function baseIsNaN(value) {
  return value !== value;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.values` and `_.valuesIn` which creates an
 * array of `object` property values corresponding to the property names
 * of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the array of property values.
 */
function baseValues(object, props) {
  return arrayMap(props, function(key) {
    return object[key];
  });
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object),
    nativeMax = Math.max;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is in `collection`. If `collection` is a string, it's
 * checked for a substring of `value`, otherwise
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * is used for equality comparisons. If `fromIndex` is negative, it's used as
 * the offset from the end of `collection`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object|string} collection The collection to inspect.
 * @param {*} value The value to search for.
 * @param {number} [fromIndex=0] The index to search from.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {boolean} Returns `true` if `value` is found, else `false`.
 * @example
 *
 * _.includes([1, 2, 3], 1);
 * // => true
 *
 * _.includes([1, 2, 3], 1, 2);
 * // => false
 *
 * _.includes({ 'a': 1, 'b': 2 }, 1);
 * // => true
 *
 * _.includes('abcd', 'bc');
 * // => true
 */
function includes(collection, value, fromIndex, guard) {
  collection = isArrayLike(collection) ? collection : values(collection);
  fromIndex = (fromIndex && !guard) ? toInteger(fromIndex) : 0;

  var length = collection.length;
  if (fromIndex < 0) {
    fromIndex = nativeMax(length + fromIndex, 0);
  }
  return isString(collection)
    ? (fromIndex <= length && collection.indexOf(value, fromIndex) > -1)
    : (!!length && baseIndexOf(collection, value, fromIndex) > -1);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This method is loosely based on
 * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3.2);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3.2');
 * // => 3
 */
function toInteger(value) {
  var result = toFinite(value),
      remainder = result % 1;

  return result === result ? (remainder ? result - remainder : result) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * Creates an array of the own enumerable string keyed property values of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property values.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.values(new Foo);
 * // => [1, 2] (iteration order is not guaranteed)
 *
 * _.values('hi');
 * // => ['h', 'i']
 */
function values(object) {
  return object ? baseValues(object, keys(object)) : [];
}

module.exports = includes;


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * The base implementation of `_.flatten` with support for restricting flattening.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {number} depth The maximum recursion depth.
 * @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
 * @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, depth, predicate, isStrict, result) {
  var index = -1,
      length = array.length;

  predicate || (predicate = isFlattenable);
  result || (result = []);

  while (++index < length) {
    var value = array[index];
    if (depth > 0 && predicate(value)) {
      if (depth > 1) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, depth - 1, predicate, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Creates a `_.flow` or `_.flowRight` function.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new flow function.
 */
function createFlow(fromRight) {
  return baseRest(function(funcs) {
    funcs = baseFlatten(funcs, 1);

    var length = funcs.length,
        index = length;

    if (fromRight) {
      funcs.reverse();
    }
    while (index--) {
      if (typeof funcs[index] != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
    }
    return function() {
      var index = 0,
          result = length ? funcs[index].apply(this, arguments) : arguments[0];

      while (++index < length) {
        result = funcs[index].call(this, result);
      }
      return result;
    };
  });
}

/**
 * Checks if `value` is a flattenable `arguments` object or array.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
 */
function isFlattenable(value) {
  return isArray(value) || isArguments(value) ||
    !!(spreadableSymbol && value && value[spreadableSymbol]);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Creates a function that returns the result of invoking the given functions
 * with the `this` binding of the created function, where each successive
 * invocation is supplied the return value of the previous.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Util
 * @param {...(Function|Function[])} [funcs] The functions to invoke.
 * @returns {Function} Returns the new composite function.
 * @see _.flowRight
 * @example
 *
 * function square(n) {
 *   return n * n;
 * }
 *
 * var addSquare = _.flow([_.add, square]);
 * addSquare(1, 2);
 * // => 9
 */
var flow = createFlow();

module.exports = flow;

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5)))

/***/ }),
/* 5 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 6 */
/***/ (function(module, exports) {

/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is `undefined`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
 * @example
 *
 * _.isUndefined(void 0);
 * // => true
 *
 * _.isUndefined(null);
 * // => false
 */
function isUndefined(value) {
  return value === undefined;
}

module.exports = isUndefined;


/***/ }),
/* 7 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__levelRuns__ = __webpack_require__(19);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__util_unzip3__ = __webpack_require__(30);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__matchingPDIs__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__levelRunFromIndex__ = __webpack_require__(31);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__type__ = __webpack_require__(1);










// BD13.
function isolatingRunSequences(paragraphCodepoints, paragraphBidiTypes, paragraphLevel = 0) {
  // [1]: By X9., we remove control characters that are not
  //      needed at this stage in bidi algorithm
  const { runs, bidiTypes, levels } = Object(__WEBPACK_IMPORTED_MODULE_2__levelRuns__["a" /* default */])(paragraphCodepoints, paragraphBidiTypes, paragraphLevel);

  const [codepoints, bidi, pbidi] = Object(__WEBPACK_IMPORTED_MODULE_3__util_unzip3__["a" /* default */])(paragraphCodepoints
    .zip(bidiTypes, paragraphBidiTypes)
    .filter(([__, t, ___]) => Object(__WEBPACK_IMPORTED_MODULE_6__util_constant__["r" /* isX9ControlCharacter */])(t) === false)); // [1]

  const { initiatorToPDI, initiatorFromPDI } = Object(__WEBPACK_IMPORTED_MODULE_4__matchingPDIs__["a" /* default */])(codepoints);

  function isolatingChainFrom(sequence) {
      // [1]: level run currently last in the sequence
      //      ends with an isolate initiator that has a matching PDI
      // [2]: level run containing the matching PDI to the sequence
      const initiator = sequence.last().get('to') - 1;
      const matchingPDI = initiatorToPDI.get(initiator, -1);

      if (matchingPDI > -1) { // [1]
        const runWithMatchingPDI = Object(__WEBPACK_IMPORTED_MODULE_5__levelRunFromIndex__["a" /* default */])(runs, matchingPDI);
        return isolatingChainFrom(sequence.push(runWithMatchingPDI));
      } else {
        return sequence;
      }
  }

  function sequencesWithSosEos(sequences) {
    return sequences.map((sequence, index) => {
      const N = codepoints.size;
      const from = sequence.get('runs').first().get('from');
      const to = sequence.get('runs').last().get('to');

      const charLevel = i => {
        if (Object(__WEBPACK_IMPORTED_MODULE_1_immutable__["Range"])(0, N).contains(i)) {
          return Object(__WEBPACK_IMPORTED_MODULE_5__levelRunFromIndex__["a" /* default */])(runs, i).get('level');
        } else {
          return paragraphLevel;
        }
      }

      // X10.
      // [1]: " If the higher level is odd, the sos or eos is R; otherwise, it is L."
      // [2]: For eos, we set nextLevel to paragraph level if the last character of the
      //      current sequence is an isolate initiator that does not have a matching pop
      const prevLevel = charLevel(from - 1);
      const currLevel = charLevel(from);
      const nextLevel = (__ => { // [2]
        const lastChar = codepoints.get(to - 1);
        const matchingPDI = initiatorToPDI.get(lastChar, -1);
        if (__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()([__WEBPACK_IMPORTED_MODULE_6__util_constant__["c" /* LRI */], __WEBPACK_IMPORTED_MODULE_6__util_constant__["i" /* RLI */], __WEBPACK_IMPORTED_MODULE_6__util_constant__["a" /* FSI */]], lastChar) && matchingPDI === -1) { return paragraphLevel }
        else return charLevel(to);
      })();
      const sos = (Math.max(prevLevel, currLevel) % 2 === 1) ? 'R' : 'L'; // [1]
      const eos = (Math.max(currLevel, nextLevel) % 2 === 1) ? 'R' : 'L'; // [1, 2]
      return sequence.set('sos', sos).set('eos', eos);
    });
  }

  const sequences = sequencesWithSosEos(runs
    .filter(run => {
      const from = run.get('from');
      const firstChar = codepoints.get(from);
      const matchingInitiator = initiatorFromPDI.get(from, -1)
      return (firstChar !== __WEBPACK_IMPORTED_MODULE_6__util_constant__["g" /* PDI */] || matchingInitiator === -1);
    })
    .reduce((sequences, run, index) => {
      const sequence = new __WEBPACK_IMPORTED_MODULE_7__type__["g" /* Sequence */]({ runs: isolatingChainFrom(__WEBPACK_IMPORTED_MODULE_1_immutable__["List"].of(run)) });
      return sequences.push(sequence);
    }, __WEBPACK_IMPORTED_MODULE_1_immutable__["List"].of())
  );

  return {
    sequences: sequences,
    codepoints: codepoints,
    bidiTypes: bidi,
    paragraphBidiTypes: pbidi,
    levels: levels
  };
}

/* harmony default export */ __webpack_exports__["a"] = (isolatingRunSequences);


/***/ }),
/* 8 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__type__ = __webpack_require__(1);





function isCurrentlyOverflowing(state) {
  const isolate = state.get('overflowIsolateCount');
  const embedding = state.get('overflowEmbeddingCount');
  return (isolate > 0 || embedding > 0); // [2]
}

// http://unicode.org/reports/tr9/#X5a
// [1]: "Set the RLI’s embedding level to the embedding level
//      of the last entry on the directional status stack."
// [2]:
function rli(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_1__util_constant__["i" /* RLI */]) return state;
  const lastEntry = state.get('directionalStatusStack').peek();
  const lastLevel = lastEntry.get('level');

  return __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default()(
    function setEmbedding(state) { // [1]
      return state.update('embeddingLevels', ls => ls.set(index, lastLevel))
    },
    function checkOverride(state) {
      const lastOverride = lastEntry.get('override');

      if (lastOverride !== 'neutral') {
        const override = (lastOverride === 'left-to-right') ? 'L' : 'R';
        return state.update('bidiTypes', ts => ts.set(index, override));
      } else {
        return state;
      }
    },
    function increaseLevel(state) {
      const newLevel = (lastLevel + 1) + (lastLevel % 2);
      const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_1__util_constant__["e" /* MAX_DEPTH */]); // [2]
      const isOverflow = (newLevelInvalid || isCurrentlyOverflowing(state)); // [2]

      if (isOverflow) return state.update('overflowIsolateCount', __WEBPACK_IMPORTED_MODULE_2__type__["i" /* increase */]);
      return state
        .update('validIsolateCount', __WEBPACK_IMPORTED_MODULE_2__type__["i" /* increase */])
        .update('directionalStatusStack', (stack) => {
          return stack.push(new __WEBPACK_IMPORTED_MODULE_2__type__["c" /* DirectionalStatusStackEntry */]({
            isolate: true,
            level: newLevel,
          }));
        });
    }
  )(state);
}

/* harmony default export */ __webpack_exports__["a"] = (rli);


/***/ }),
/* 9 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__type__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__util_constant__ = __webpack_require__(0);





function isCurrentlyOverflowing(state) {
  const isolate = state.get('overflowIsolateCount');
  const embedding = state.get('overflowEmbeddingCount');
  return (isolate > 0 || embedding > 0); // [2]
}

// http://unicode.org/reports/tr9/#X5a
// [1]: "Set the LRI’s embedding level to the embedding level
//      of the last entry on the directional status stack."
// [2]:
function lri(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_2__util_constant__["c" /* LRI */]) return state;
  const lastEntry = state.get('directionalStatusStack').peek();
  const lastLevel = lastEntry.get('level');

  return __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default()(
    function setEmbedding(state) { // [1]
      return state.update('embeddingLevels', ls => ls.set(index, lastLevel))
    },
    function checkOverride(state) {
      const lastOverride = lastEntry.get('override');

      if (lastOverride !== 'neutral') {
        const override = (lastOverride === 'left-to-right') ? 'L' : 'R';
        return state.update('bidiTypes', ts => ts.set(index, override));
      } else {
        return state;
      }
    },
    function increaseLevel(state) {
      const newLevel = (lastLevel + 1) + ((lastLevel + 1) % 2);
      const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_2__util_constant__["e" /* MAX_DEPTH */]); // [2]
      const isOverflow = (newLevelInvalid || isCurrentlyOverflowing(state)); // [2]

      if (isOverflow) return state.update('overflowIsolateCount', __WEBPACK_IMPORTED_MODULE_1__type__["i" /* increase */]);
      return state
        .update('validIsolateCount', __WEBPACK_IMPORTED_MODULE_1__type__["i" /* increase */])
        .update('directionalStatusStack', (stack) => {
          return stack.push(new __WEBPACK_IMPORTED_MODULE_1__type__["c" /* DirectionalStatusStackEntry */]({
            isolate: true,
            level: newLevel,
          }));
        });
    }
  )(state);
}

/* harmony default export */ __webpack_exports__["a"] = (lri);


/***/ }),
/* 10 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__util_constant__ = __webpack_require__(0);





// http://unicode.org/reports/tr9/#P2
function automaticLevel(codepoints, bidiTypes) {

  const P2State = Object(__WEBPACK_IMPORTED_MODULE_2_immutable__["Record"])({ inside: false, counter: 0 }, 'P2State'); // P2.
  const betweenIsolate = codepoints
    .reduce((acc, codepoint) => {
      const counter = acc.get(-1, 0);
      return acc.push((() => {
        if (__WEBPACK_IMPORTED_MODULE_1_lodash_includes___default()([__WEBPACK_IMPORTED_MODULE_3__util_constant__["c" /* LRI */], __WEBPACK_IMPORTED_MODULE_3__util_constant__["i" /* RLI */], __WEBPACK_IMPORTED_MODULE_3__util_constant__["a" /* FSI */]], codepoint)) return counter + 1;
        else if (codepoint === __WEBPACK_IMPORTED_MODULE_3__util_constant__["g" /* PDI */] && counter > 0) return counter - 1;
        else return counter;
      })());
    }, __WEBPACK_IMPORTED_MODULE_2_immutable__["List"].of())
    .map(counter => (counter > 0) ? true : false);

  const firstStrong = codepoints.zip(bidiTypes, betweenIsolate)
    .filter(([_, __, between]) => between === false)
    .map(([_, bidiType, __]) => bidiType)
    .find(t => __WEBPACK_IMPORTED_MODULE_1_lodash_includes___default()(['L', 'R', 'AL'], t));

  if (__WEBPACK_IMPORTED_MODULE_1_lodash_includes___default()(['R', 'AL'], firstStrong)) {
    return 1;
  } else {
    return 0;
  }
}

/* harmony default export */ __webpack_exports__["a"] = (automaticLevel);


/***/ }),
/* 11 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__matchingPDIForIndex__ = __webpack_require__(26);



function matchingPDIs(codepoints) {
  // [1]: define hashmap mapping: isolate initator |-> matching PDI
  // [2]: define hashmap mapping: matching PDI |-> isolate initiator
  const N = codepoints.size;
  const tuples = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])()
    .zip(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, N)
    .map(i => Object(__WEBPACK_IMPORTED_MODULE_1__matchingPDIForIndex__["a" /* default */])(codepoints, i)))
    .filter(([x, y]) => y !== -1);
  const tuplesInverted = tuples.map(([x, y]) => [y, x]);

  const initiatorToPDI = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Map"])(tuples); // [1]
  // TODO: it is possible to use Map.flip()?
  const initiatorFromPDI = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Map"])(tuplesInverted); // [2]
  return { initiatorToPDI, initiatorFromPDI };
}

/* harmony default export */ __webpack_exports__["a"] = (matchingPDIs);


/***/ }),
/* 12 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);


// Immutable.js doesnt have unzip
// Unzips a "zipped" Immutable.js List of pairs in O(N) time
// unzip(pairs: List<Array<a,b>>): Array<List<a>, List<b>>
function unzip(pairs) {
  const unzipped = pairs
    .reduce((unzipped, [a, b]) => {
      return unzipped
        .update(0, (as) => as.push(a))
        .update(1, (bs) => bs.push(b))
    }, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of()));
  return [unzipped.get(0), unzipped.get(1)];
}

/* harmony default export */ __webpack_exports__["a"] = (unzip);


/***/ }),
/* 13 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// A map to show "opening brackets",
// for example: (, [, {, ...
// Compiled from: http://www.unicode.org/Public/UCD/latest/ucd/BidiBrackets.txt
const openingBrackets = new Set([
  0x0028, // LEFT PARENTHESIS
  0x005B, // LEFT SQUARE BRACKET
  0x007B, // LEFT CURLY BRACKET
  0x0F3A, // TIBETAN MARK GUG RTAGS GYON
  0x0F3C, // TIBETAN MARK ANG KHANG GYON
  0x169B, // OGHAM FEATHER MARK
  0x2045, // LEFT SQUARE BRACKET WITH QUILL
  0x207D, // SUPERSCRIPT LEFT PARENTHESIS
  0x208D, // SUBSCRIPT LEFT PARENTHESIS
  0x2308, // LEFT CEILING
  0x230A, // LEFT FLOOR
  0x2329, // LEFT-POINTING ANGLE BRACKET
  0x2768, // MEDIUM LEFT PARENTHESIS ORNAMENT
  0x276A, // MEDIUM FLATTENED LEFT PARENTHESIS ORNAMENT
  0x276C, // MEDIUM LEFT-POINTING ANGLE BRACKET ORNAMENT
  0x276E, // HEAVY LEFT-POINTING ANGLE QUOTATION MARK ORNAMENT
  0x2770, // HEAVY LEFT-POINTING ANGLE BRACKET ORNAMENT
  0x2772, // LIGHT LEFT TORTOISE SHELL BRACKET ORNAMENT
  0x2774, // MEDIUM LEFT CURLY BRACKET ORNAMENT
  0x27C5, // LEFT S-SHAPED BAG DELIMITER
  0x27E6, // MATHEMATICAL LEFT WHITE SQUARE BRACKET
  0x27E8, // MATHEMATICAL LEFT ANGLE BRACKET
  0x27EA, // MATHEMATICAL LEFT DOUBLE ANGLE BRACKET
  0x27EC, // MATHEMATICAL LEFT WHITE TORTOISE SHELL BRACKET
  0x27EE, // MATHEMATICAL LEFT FLATTENED PARENTHESIS
  0x2983, // LEFT WHITE CURLY BRACKET
  0x2985, // LEFT WHITE PARENTHESIS
  0x2987, // Z NOTATION LEFT IMAGE BRACKET
  0x2989, // Z NOTATION LEFT BINDING BRACKET
  0x298B, // LEFT SQUARE BRACKET WITH UNDERBAR
  0x298D, // LEFT SQUARE BRACKET WITH TICK IN TOP CORNER
  0x298F, // LEFT SQUARE BRACKET WITH TICK IN BOTTOM CORNER
  0x2991, // LEFT ANGLE BRACKET WITH DOT
  0x2993, // LEFT ARC LESS-THAN BRACKET
  0x2995, // DOUBLE LEFT ARC GREATER-THAN BRACKET
  0x2997, // LEFT BLACK TORTOISE SHELL BRACKET
  0x29D8, // LEFT WIGGLY FENCE
  0x29DA, // LEFT DOUBLE WIGGLY FENCE
  0x29FC, // LEFT-POINTING CURVED ANGLE BRACKET
  0x2E22, // TOP LEFT HALF BRACKET
  0x2E24, // BOTTOM LEFT HALF BRACKET
  0x2E26, // LEFT SIDEWAYS U BRACKET
  0x2E28, // LEFT DOUBLE PARENTHESIS
  0x3008, // LEFT ANGLE BRACKET
  0x300A, // LEFT DOUBLE ANGLE BRACKET
  0x300C, // LEFT CORNER BRACKET
  0x300E, // LEFT WHITE CORNER BRACKET
  0x3010, // LEFT BLACK LENTICULAR BRACKET
  0x3014, // LEFT TORTOISE SHELL BRACKET
  0x3016, // LEFT WHITE LENTICULAR BRACKET
  0x3018, // LEFT WHITE TORTOISE SHELL BRACKET
  0x301A, // LEFT WHITE SQUARE BRACKET
  0xFE59, // SMALL LEFT PARENTHESIS
  0xFE5B, // SMALL LEFT CURLY BRACKET
  0xFE5D, // SMALL LEFT TORTOISE SHELL BRACKET
  0xFF08, // FULLWIDTH LEFT PARENTHESIS
  0xFF3B, // FULLWIDTH LEFT SQUARE BRACKET
  0xFF5B, // FULLWIDTH LEFT CURLY BRACKET
  0xFF5F, // FULLWIDTH LEFT WHITE PARENTHESIS
  0xFF62  // HALFWIDTH LEFT CORNER BRACKET
]);

/* harmony default export */ __webpack_exports__["a"] = (openingBrackets);


/***/ }),
/* 14 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// A map to show "closing brackets",
// for example: ), ], }, ...
// Compiled from: http://www.unicode.org/Public/UCD/latest/ucd/BidiBrackets.txt
const closingBrackets = new Set([
  0x0029, // RIGHT PARENTHESIS
  0x005D, // RIGHT SQUARE BRACKET
  0x007D, // RIGHT CURLY BRACKET
  0x0F3B, // TIBETAN MARK GUG RTAGS GYAS
  0x0F3D, // TIBETAN MARK ANG KHANG GYAS
  0x169C, // OGHAM REVERSED FEATHER MARK
  0x2046, // RIGHT SQUARE BRACKET WITH QUILL
  0x207E, // SUPERSCRIPT RIGHT PARENTHESIS
  0x208E, // SUBSCRIPT RIGHT PARENTHESIS
  0x2309, // RIGHT CEILING
  0x230B, // RIGHT FLOOR
  0x232A, // RIGHT-POINTING ANGLE BRACKET
  0x2769, // MEDIUM RIGHT PARENTHESIS ORNAMENT
  0x276B, // MEDIUM FLATTENED RIGHT PARENTHESIS ORNAMENT
  0x276D, // MEDIUM RIGHT-POINTING ANGLE BRACKET ORNAMENT
  0x276F, // HEAVY RIGHT-POINTING ANGLE QUOTATION MARK ORNAMENT
  0x2771, // HEAVY RIGHT-POINTING ANGLE BRACKET ORNAMENT
  0x2773, // LIGHT RIGHT TORTOISE SHELL BRACKET ORNAMENT
  0x2775, // MEDIUM RIGHT CURLY BRACKET ORNAMENT
  0x27C6, // RIGHT S-SHAPED BAG DELIMITER
  0x27E7, // MATHEMATICAL RIGHT WHITE SQUARE BRACKET
  0x27E9, // MATHEMATICAL RIGHT ANGLE BRACKET
  0x27EB, // MATHEMATICAL RIGHT DOUBLE ANGLE BRACKET
  0x27ED, // MATHEMATICAL RIGHT WHITE TORTOISE SHELL BRACKET
  0x27EF, // MATHEMATICAL RIGHT FLATTENED PARENTHESIS
  0x2984, // RIGHT WHITE CURLY BRACKET
  0x2986, // RIGHT WHITE PARENTHESIS
  0x2988, // Z NOTATION RIGHT IMAGE BRACKET
  0x298A, // Z NOTATION RIGHT BINDING BRACKET
  0x298C, // RIGHT SQUARE BRACKET WITH UNDERBAR
  0x298E, // RIGHT SQUARE BRACKET WITH TICK IN BOTTOM CORNER
  0x2990, // RIGHT SQUARE BRACKET WITH TICK IN TOP CORNER
  0x2992, // RIGHT ANGLE BRACKET WITH DOT
  0x2994, // RIGHT ARC GREATER-THAN BRACKET
  0x2996, // DOUBLE RIGHT ARC LESS-THAN BRACKET
  0x2998, // RIGHT BLACK TORTOISE SHELL BRACKET
  0x29D9, // RIGHT WIGGLY FENCE
  0x29DB, // RIGHT DOUBLE WIGGLY FENCE
  0x29FD, // RIGHT-POINTING CURVED ANGLE BRACKET
  0x2E23, // TOP RIGHT HALF BRACKET
  0x2E25, // BOTTOM RIGHT HALF BRACKET
  0x2E27, // RIGHT SIDEWAYS U BRACKET
  0x2E29, // RIGHT DOUBLE PARENTHESIS
  0x3009, // RIGHT ANGLE BRACKET
  0x300B, // RIGHT DOUBLE ANGLE BRACKET
  0x300D, // RIGHT CORNER BRACKET
  0x300F, // RIGHT WHITE CORNER BRACKET
  0x3011, // RIGHT BLACK LENTICULAR BRACKET
  0x3015, // RIGHT TORTOISE SHELL BRACKET
  0x3017, // RIGHT WHITE LENTICULAR BRACKET
  0x3019, // RIGHT WHITE TORTOISE SHELL BRACKET
  0x301B, // RIGHT WHITE SQUARE BRACKET
  0xFE5A, // SMALL RIGHT PARENTHESIS
  0xFE5C, // SMALL RIGHT CURLY BRACKET
  0xFE5E, // SMALL RIGHT TORTOISE SHELL BRACKET
  0xFF09, // FULLWIDTH RIGHT PARENTHESIS
  0xFF3D, // FULLWIDTH RIGHT SQUARE BRACKET
  0xFF5D, // FULLWIDTH RIGHT CURLY BRACKET
  0xFF60, // FULLWIDTH RIGHT WHITE PARENTHESIS
  0xFF63  // HALFWIDTH RIGHT CORNER BRACKET
]);

/* harmony default export */ __webpack_exports__["a"] = (closingBrackets);


/***/ }),
/* 15 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// A map to give the "opposite bracket",
// for example: ( maps to ), [ maps to ], { maps to }, and so on...
// Compiled from: http://www.unicode.org/Public/UCD/latest/ucd/BidiBrackets.txt
const oppositeBracket = new Map([
  [ 0x0028, 0x0029 ], // LEFT PARENTHESIS
  [ 0x0029, 0x0028 ], // RIGHT PARENTHESIS
  [ 0x005B, 0x005D ], // LEFT SQUARE BRACKET
  [ 0x005D, 0x005B ], // RIGHT SQUARE BRACKET
  [ 0x007B, 0x007D ], // LEFT CURLY BRACKET
  [ 0x007D, 0x007B ], // RIGHT CURLY BRACKET
  [ 0x0F3A, 0x0F3B ], // TIBETAN MARK GUG RTAGS GYON
  [ 0x0F3B, 0x0F3A ], // TIBETAN MARK GUG RTAGS GYAS
  [ 0x0F3C, 0x0F3D ], // TIBETAN MARK ANG KHANG GYON
  [ 0x0F3D, 0x0F3C ], // TIBETAN MARK ANG KHANG GYAS
  [ 0x169B, 0x169C ], // OGHAM FEATHER MARK
  [ 0x169C, 0x169B ], // OGHAM REVERSED FEATHER MARK
  [ 0x2045, 0x2046 ], // LEFT SQUARE BRACKET WITH QUILL
  [ 0x2046, 0x2045 ], // RIGHT SQUARE BRACKET WITH QUILL
  [ 0x207D, 0x207E ], // SUPERSCRIPT LEFT PARENTHESIS
  [ 0x207E, 0x207D ], // SUPERSCRIPT RIGHT PARENTHESIS
  [ 0x208D, 0x208E ], // SUBSCRIPT LEFT PARENTHESIS
  [ 0x208E, 0x208D ], // SUBSCRIPT RIGHT PARENTHESIS
  [ 0x2308, 0x2309 ], // LEFT CEILING
  [ 0x2309, 0x2308 ], // RIGHT CEILING
  [ 0x230A, 0x230B ], // LEFT FLOOR
  [ 0x230B, 0x230A ], // RIGHT FLOOR
  [ 0x2329, 0x232A ], // LEFT-POINTING ANGLE BRACKET
  [ 0x232A, 0x2329 ], // RIGHT-POINTING ANGLE BRACKET
  [ 0x2768, 0x2769 ], // MEDIUM LEFT PARENTHESIS ORNAMENT
  [ 0x2769, 0x2768 ], // MEDIUM RIGHT PARENTHESIS ORNAMENT
  [ 0x276A, 0x276B ], // MEDIUM FLATTENED LEFT PARENTHESIS ORNAMENT
  [ 0x276B, 0x276A ], // MEDIUM FLATTENED RIGHT PARENTHESIS ORNAMENT
  [ 0x276C, 0x276D ], // MEDIUM LEFT-POINTING ANGLE BRACKET ORNAMENT
  [ 0x276D, 0x276C ], // MEDIUM RIGHT-POINTING ANGLE BRACKET ORNAMENT
  [ 0x276E, 0x276F ], // HEAVY LEFT-POINTING ANGLE QUOTATION MARK ORNAMENT
  [ 0x276F, 0x276E ], // HEAVY RIGHT-POINTING ANGLE QUOTATION MARK ORNAMENT
  [ 0x2770, 0x2771 ], // HEAVY LEFT-POINTING ANGLE BRACKET ORNAMENT
  [ 0x2771, 0x2770 ], // HEAVY RIGHT-POINTING ANGLE BRACKET ORNAMENT
  [ 0x2772, 0x2773 ], // LIGHT LEFT TORTOISE SHELL BRACKET ORNAMENT
  [ 0x2773, 0x2772 ], // LIGHT RIGHT TORTOISE SHELL BRACKET ORNAMENT
  [ 0x2774, 0x2775 ], // MEDIUM LEFT CURLY BRACKET ORNAMENT
  [ 0x2775, 0x2774 ], // MEDIUM RIGHT CURLY BRACKET ORNAMENT
  [ 0x27C5, 0x27C6 ], // LEFT S-SHAPED BAG DELIMITER
  [ 0x27C6, 0x27C5 ], // RIGHT S-SHAPED BAG DELIMITER
  [ 0x27E6, 0x27E7 ], // MATHEMATICAL LEFT WHITE SQUARE BRACKET
  [ 0x27E7, 0x27E6 ], // MATHEMATICAL RIGHT WHITE SQUARE BRACKET
  [ 0x27E8, 0x27E9 ], // MATHEMATICAL LEFT ANGLE BRACKET
  [ 0x27E9, 0x27E8 ], // MATHEMATICAL RIGHT ANGLE BRACKET
  [ 0x27EA, 0x27EB ], // MATHEMATICAL LEFT DOUBLE ANGLE BRACKET
  [ 0x27EB, 0x27EA ], // MATHEMATICAL RIGHT DOUBLE ANGLE BRACKET
  [ 0x27EC, 0x27ED ], // MATHEMATICAL LEFT WHITE TORTOISE SHELL BRACKET
  [ 0x27ED, 0x27EC ], // MATHEMATICAL RIGHT WHITE TORTOISE SHELL BRACKET
  [ 0x27EE, 0x27EF ], // MATHEMATICAL LEFT FLATTENED PARENTHESIS
  [ 0x27EF, 0x27EE ], // MATHEMATICAL RIGHT FLATTENED PARENTHESIS
  [ 0x2983, 0x2984 ], // LEFT WHITE CURLY BRACKET
  [ 0x2984, 0x2983 ], // RIGHT WHITE CURLY BRACKET
  [ 0x2985, 0x2986 ], // LEFT WHITE PARENTHESIS
  [ 0x2986, 0x2985 ], // RIGHT WHITE PARENTHESIS
  [ 0x2987, 0x2988 ], // Z NOTATION LEFT IMAGE BRACKET
  [ 0x2988, 0x2987 ], // Z NOTATION RIGHT IMAGE BRACKET
  [ 0x2989, 0x298A ], // Z NOTATION LEFT BINDING BRACKET
  [ 0x298A, 0x2989 ], // Z NOTATION RIGHT BINDING BRACKET
  [ 0x298B, 0x298C ], // LEFT SQUARE BRACKET WITH UNDERBAR
  [ 0x298C, 0x298B ], // RIGHT SQUARE BRACKET WITH UNDERBAR
  [ 0x298D, 0x2990 ], // LEFT SQUARE BRACKET WITH TICK IN TOP CORNER
  [ 0x298E, 0x298F ], // RIGHT SQUARE BRACKET WITH TICK IN BOTTOM CORNER
  [ 0x298F, 0x298E ], // LEFT SQUARE BRACKET WITH TICK IN BOTTOM CORNER
  [ 0x2990, 0x298D ], // RIGHT SQUARE BRACKET WITH TICK IN TOP CORNER
  [ 0x2991, 0x2992 ], // LEFT ANGLE BRACKET WITH DOT
  [ 0x2992, 0x2991 ], // RIGHT ANGLE BRACKET WITH DOT
  [ 0x2993, 0x2994 ], // LEFT ARC LESS-THAN BRACKET
  [ 0x2994, 0x2993 ], // RIGHT ARC GREATER-THAN BRACKET
  [ 0x2995, 0x2996 ], // DOUBLE LEFT ARC GREATER-THAN BRACKET
  [ 0x2996, 0x2995 ], // DOUBLE RIGHT ARC LESS-THAN BRACKET
  [ 0x2997, 0x2998 ], // LEFT BLACK TORTOISE SHELL BRACKET
  [ 0x2998, 0x2997 ], // RIGHT BLACK TORTOISE SHELL BRACKET
  [ 0x29D8, 0x29D9 ], // LEFT WIGGLY FENCE
  [ 0x29D9, 0x29D8 ], // RIGHT WIGGLY FENCE
  [ 0x29DA, 0x29DB ], // LEFT DOUBLE WIGGLY FENCE
  [ 0x29DB, 0x29DA ], // RIGHT DOUBLE WIGGLY FENCE
  [ 0x29FC, 0x29FD ], // LEFT-POINTING CURVED ANGLE BRACKET
  [ 0x29FD, 0x29FC ], // RIGHT-POINTING CURVED ANGLE BRACKET
  [ 0x2E22, 0x2E23 ], // TOP LEFT HALF BRACKET
  [ 0x2E23, 0x2E22 ], // TOP RIGHT HALF BRACKET
  [ 0x2E24, 0x2E25 ], // BOTTOM LEFT HALF BRACKET
  [ 0x2E25, 0x2E24 ], // BOTTOM RIGHT HALF BRACKET
  [ 0x2E26, 0x2E27 ], // LEFT SIDEWAYS U BRACKET
  [ 0x2E27, 0x2E26 ], // RIGHT SIDEWAYS U BRACKET
  [ 0x2E28, 0x2E29 ], // LEFT DOUBLE PARENTHESIS
  [ 0x2E29, 0x2E28 ], // RIGHT DOUBLE PARENTHESIS
  [ 0x3008, 0x3009 ], // LEFT ANGLE BRACKET
  [ 0x3009, 0x3008 ], // RIGHT ANGLE BRACKET
  [ 0x300A, 0x300B ], // LEFT DOUBLE ANGLE BRACKET
  [ 0x300B, 0x300A ], // RIGHT DOUBLE ANGLE BRACKET
  [ 0x300C, 0x300D ], // LEFT CORNER BRACKET
  [ 0x300D, 0x300C ], // RIGHT CORNER BRACKET
  [ 0x300E, 0x300F ], // LEFT WHITE CORNER BRACKET
  [ 0x300F, 0x300E ], // RIGHT WHITE CORNER BRACKET
  [ 0x3010, 0x3011 ], // LEFT BLACK LENTICULAR BRACKET
  [ 0x3011, 0x3010 ], // RIGHT BLACK LENTICULAR BRACKET
  [ 0x3014, 0x3015 ], // LEFT TORTOISE SHELL BRACKET
  [ 0x3015, 0x3014 ], // RIGHT TORTOISE SHELL BRACKET
  [ 0x3016, 0x3017 ], // LEFT WHITE LENTICULAR BRACKET
  [ 0x3017, 0x3016 ], // RIGHT WHITE LENTICULAR BRACKET
  [ 0x3018, 0x3019 ], // LEFT WHITE TORTOISE SHELL BRACKET
  [ 0x3019, 0x3018 ], // RIGHT WHITE TORTOISE SHELL BRACKET
  [ 0x301A, 0x301B ], // LEFT WHITE SQUARE BRACKET
  [ 0x301B, 0x301A ], // RIGHT WHITE SQUARE BRACKET
  [ 0xFE59, 0xFE5A ], // SMALL LEFT PARENTHESIS
  [ 0xFE5A, 0xFE59 ], // SMALL RIGHT PARENTHESIS
  [ 0xFE5B, 0xFE5C ], // SMALL LEFT CURLY BRACKET
  [ 0xFE5C, 0xFE5B ], // SMALL RIGHT CURLY BRACKET
  [ 0xFE5D, 0xFE5E ], // SMALL LEFT TORTOISE SHELL BRACKET
  [ 0xFE5E, 0xFE5D ], // SMALL RIGHT TORTOISE SHELL BRACKET
  [ 0xFF08, 0xFF09 ], // FULLWIDTH LEFT PARENTHESIS
  [ 0xFF09, 0xFF08 ], // FULLWIDTH RIGHT PARENTHESIS
  [ 0xFF3B, 0xFF3D ], // FULLWIDTH LEFT SQUARE BRACKET
  [ 0xFF3D, 0xFF3B ], // FULLWIDTH RIGHT SQUARE BRACKET
  [ 0xFF5B, 0xFF5D ], // FULLWIDTH LEFT CURLY BRACKET
  [ 0xFF5D, 0xFF5B ], // FULLWIDTH RIGHT CURLY BRACKET
  [ 0xFF5F, 0xFF60 ], // FULLWIDTH LEFT WHITE PARENTHESIS
  [ 0xFF60, 0xFF5F ], // FULLWIDTH RIGHT WHITE PARENTHESIS
  [ 0xFF62, 0xFF63 ], // HALFWIDTH LEFT CORNER BRACKET
  [ 0xFF63, 0xFF62 ]  // HALFWIDTH RIGHT CORNER BRACKET
]);

/* harmony default export */ __webpack_exports__["a"] = (oppositeBracket);


/***/ }),
/* 16 */
/***/ (function(module, exports) {

module.exports=new Map([[40,')'],[41,'('],[60,'>'],[62,'<'],[91,']'],[93,'['],[123,'}'],[125,'{'],[171,'\xBB'],[187,'\xAB'],[3898,'\u0F3B'],[3899,'\u0F3A'],[3900,'\u0F3D'],[3901,'\u0F3C'],[5787,'\u169C'],[5788,'\u169B'],[8249,'\u203A'],[8250,'\u2039'],[8261,'\u2046'],[8262,'\u2045'],[8317,'\u207E'],[8318,'\u207D'],[8333,'\u208E'],[8334,'\u208D'],[8712,'\u220B'],[8713,'\u220C'],[8714,'\u220D'],[8715,'\u2208'],[8716,'\u2209'],[8717,'\u220A'],[8725,'\u29F5'],[8764,'\u223D'],[8765,'\u223C'],[8771,'\u22CD'],[8786,'\u2253'],[8787,'\u2252'],[8788,'\u2255'],[8789,'\u2254'],[8804,'\u2265'],[8805,'\u2264'],[8806,'\u2267'],[8807,'\u2266'],[8808,'\u2269'],[8809,'\u2268'],[8810,'\u226B'],[8811,'\u226A'],[8814,'\u226F'],[8815,'\u226E'],[8816,'\u2271'],[8817,'\u2270'],[8818,'\u2273'],[8819,'\u2272'],[8820,'\u2275'],[8821,'\u2274'],[8822,'\u2277'],[8823,'\u2276'],[8824,'\u2279'],[8825,'\u2278'],[8826,'\u227B'],[8827,'\u227A'],[8828,'\u227D'],[8829,'\u227C'],[8830,'\u227F'],[8831,'\u227E'],[8832,'\u2281'],[8833,'\u2280'],[8834,'\u2283'],[8835,'\u2282'],[8836,'\u2285'],[8837,'\u2284'],[8838,'\u2287'],[8839,'\u2286'],[8840,'\u2289'],[8841,'\u2288'],[8842,'\u228B'],[8843,'\u228A'],[8847,'\u2290'],[8848,'\u228F'],[8849,'\u2292'],[8850,'\u2291'],[8856,'\u29B8'],[8866,'\u22A3'],[8867,'\u22A2'],[8870,'\u2ADE'],[8872,'\u2AE4'],[8873,'\u2AE3'],[8875,'\u2AE5'],[8880,'\u22B1'],[8881,'\u22B0'],[8882,'\u22B3'],[8883,'\u22B2'],[8884,'\u22B5'],[8885,'\u22B4'],[8886,'\u22B7'],[8887,'\u22B6'],[8905,'\u22CA'],[8906,'\u22C9'],[8907,'\u22CC'],[8908,'\u22CB'],[8909,'\u2243'],[8912,'\u22D1'],[8913,'\u22D0'],[8918,'\u22D7'],[8919,'\u22D6'],[8920,'\u22D9'],[8921,'\u22D8'],[8922,'\u22DB'],[8923,'\u22DA'],[8924,'\u22DD'],[8925,'\u22DC'],[8926,'\u22DF'],[8927,'\u22DE'],[8928,'\u22E1'],[8929,'\u22E0'],[8930,'\u22E3'],[8931,'\u22E2'],[8932,'\u22E5'],[8933,'\u22E4'],[8934,'\u22E7'],[8935,'\u22E6'],[8936,'\u22E9'],[8937,'\u22E8'],[8938,'\u22EB'],[8939,'\u22EA'],[8940,'\u22ED'],[8941,'\u22EC'],[8944,'\u22F1'],[8945,'\u22F0'],[8946,'\u22FA'],[8947,'\u22FB'],[8948,'\u22FC'],[8950,'\u22FD'],[8951,'\u22FE'],[8954,'\u22F2'],[8955,'\u22F3'],[8956,'\u22F4'],[8957,'\u22F6'],[8958,'\u22F7'],[8968,'\u2309'],[8969,'\u2308'],[8970,'\u230B'],[8971,'\u230A'],[9001,'\u232A'],[9002,'\u2329'],[10088,'\u2769'],[10089,'\u2768'],[10090,'\u276B'],[10091,'\u276A'],[10092,'\u276D'],[10093,'\u276C'],[10094,'\u276F'],[10095,'\u276E'],[10096,'\u2771'],[10097,'\u2770'],[10098,'\u2773'],[10099,'\u2772'],[10100,'\u2775'],[10101,'\u2774'],[10179,'\u27C4'],[10180,'\u27C3'],[10181,'\u27C6'],[10182,'\u27C5'],[10184,'\u27C9'],[10185,'\u27C8'],[10187,'\u27CD'],[10189,'\u27CB'],[10197,'\u27D6'],[10198,'\u27D5'],[10205,'\u27DE'],[10206,'\u27DD'],[10210,'\u27E3'],[10211,'\u27E2'],[10212,'\u27E5'],[10213,'\u27E4'],[10214,'\u27E7'],[10215,'\u27E6'],[10216,'\u27E9'],[10217,'\u27E8'],[10218,'\u27EB'],[10219,'\u27EA'],[10220,'\u27ED'],[10221,'\u27EC'],[10222,'\u27EF'],[10223,'\u27EE'],[10627,'\u2984'],[10628,'\u2983'],[10629,'\u2986'],[10630,'\u2985'],[10631,'\u2988'],[10632,'\u2987'],[10633,'\u298A'],[10634,'\u2989'],[10635,'\u298C'],[10636,'\u298B'],[10637,'\u2990'],[10638,'\u298F'],[10639,'\u298E'],[10640,'\u298D'],[10641,'\u2992'],[10642,'\u2991'],[10643,'\u2994'],[10644,'\u2993'],[10645,'\u2996'],[10646,'\u2995'],[10647,'\u2998'],[10648,'\u2997'],[10680,'\u2298'],[10688,'\u29C1'],[10689,'\u29C0'],[10692,'\u29C5'],[10693,'\u29C4'],[10703,'\u29D0'],[10704,'\u29CF'],[10705,'\u29D2'],[10706,'\u29D1'],[10708,'\u29D5'],[10709,'\u29D4'],[10712,'\u29D9'],[10713,'\u29D8'],[10714,'\u29DB'],[10715,'\u29DA'],[10741,'\u2215'],[10744,'\u29F9'],[10745,'\u29F8'],[10748,'\u29FD'],[10749,'\u29FC'],[10795,'\u2A2C'],[10796,'\u2A2B'],[10797,'\u2A2E'],[10798,'\u2A2D'],[10804,'\u2A35'],[10805,'\u2A34'],[10812,'\u2A3D'],[10813,'\u2A3C'],[10852,'\u2A65'],[10853,'\u2A64'],[10873,'\u2A7A'],[10874,'\u2A79'],[10877,'\u2A7E'],[10878,'\u2A7D'],[10879,'\u2A80'],[10880,'\u2A7F'],[10881,'\u2A82'],[10882,'\u2A81'],[10883,'\u2A84'],[10884,'\u2A83'],[10891,'\u2A8C'],[10892,'\u2A8B'],[10897,'\u2A92'],[10898,'\u2A91'],[10899,'\u2A94'],[10900,'\u2A93'],[10901,'\u2A96'],[10902,'\u2A95'],[10903,'\u2A98'],[10904,'\u2A97'],[10905,'\u2A9A'],[10906,'\u2A99'],[10907,'\u2A9C'],[10908,'\u2A9B'],[10913,'\u2AA2'],[10914,'\u2AA1'],[10918,'\u2AA7'],[10919,'\u2AA6'],[10920,'\u2AA9'],[10921,'\u2AA8'],[10922,'\u2AAB'],[10923,'\u2AAA'],[10924,'\u2AAD'],[10925,'\u2AAC'],[10927,'\u2AB0'],[10928,'\u2AAF'],[10931,'\u2AB4'],[10932,'\u2AB3'],[10939,'\u2ABC'],[10940,'\u2ABB'],[10941,'\u2ABE'],[10942,'\u2ABD'],[10943,'\u2AC0'],[10944,'\u2ABF'],[10945,'\u2AC2'],[10946,'\u2AC1'],[10947,'\u2AC4'],[10948,'\u2AC3'],[10949,'\u2AC6'],[10950,'\u2AC5'],[10957,'\u2ACE'],[10958,'\u2ACD'],[10959,'\u2AD0'],[10960,'\u2ACF'],[10961,'\u2AD2'],[10962,'\u2AD1'],[10963,'\u2AD4'],[10964,'\u2AD3'],[10965,'\u2AD6'],[10966,'\u2AD5'],[10974,'\u22A6'],[10979,'\u22A9'],[10980,'\u22A8'],[10981,'\u22AB'],[10988,'\u2AED'],[10989,'\u2AEC'],[10999,'\u2AF8'],[11000,'\u2AF7'],[11001,'\u2AFA'],[11002,'\u2AF9'],[11778,'\u2E03'],[11779,'\u2E02'],[11780,'\u2E05'],[11781,'\u2E04'],[11785,'\u2E0A'],[11786,'\u2E09'],[11788,'\u2E0D'],[11789,'\u2E0C'],[11804,'\u2E1D'],[11805,'\u2E1C'],[11808,'\u2E21'],[11809,'\u2E20'],[11810,'\u2E23'],[11811,'\u2E22'],[11812,'\u2E25'],[11813,'\u2E24'],[11814,'\u2E27'],[11815,'\u2E26'],[11816,'\u2E29'],[11817,'\u2E28'],[12296,'\u3009'],[12297,'\u3008'],[12298,'\u300B'],[12299,'\u300A'],[12300,'\u300D'],[12301,'\u300C'],[12302,'\u300F'],[12303,'\u300E'],[12304,'\u3011'],[12305,'\u3010'],[12308,'\u3015'],[12309,'\u3014'],[12310,'\u3017'],[12311,'\u3016'],[12312,'\u3019'],[12313,'\u3018'],[12314,'\u301B'],[12315,'\u301A'],[65113,'\uFE5A'],[65114,'\uFE59'],[65115,'\uFE5C'],[65116,'\uFE5B'],[65117,'\uFE5E'],[65118,'\uFE5D'],[65124,'\uFE65'],[65125,'\uFE64'],[65288,'\uFF09'],[65289,'\uFF08'],[65308,'\uFF1E'],[65310,'\uFF1C'],[65339,'\uFF3D'],[65341,'\uFF3B'],[65371,'\uFF5D'],[65373,'\uFF5B'],[65375,'\uFF60'],[65376,'\uFF5F'],[65378,'\uFF63'],[65379,'\uFF62']])

/***/ }),
/* 17 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "resolve", function() { return resolve; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "reorder", function() { return reorder; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "reorderPermutation", function() { return reorderPermutation; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "mirror", function() { return mirror; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "constants", function() { return constants; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__resolve_resolvedLevels__ = __webpack_require__(18);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__resolve_reorderedLevels__ = __webpack_require__(48);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_unicode_bidiclass__ = __webpack_require__(50);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_unicode_bidiclass___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_unicode_bidiclass__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_punycode__ = __webpack_require__(51);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_punycode___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_punycode__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_4_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__util_openingBrackets__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__util_closingBrackets__ = __webpack_require__(14);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__util_oppositeBracket__ = __webpack_require__(15);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_unicode_9_0_0_Bidi_Mirroring_Glyph__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_unicode_9_0_0_Bidi_Mirroring_Glyph___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_unicode_9_0_0_Bidi_Mirroring_Glyph__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__resolve_mirror__ = __webpack_require__(53);











// Public API
function resolve(codepoints, paragraphLevel, automaticLevel = false) {
  const encoding = __WEBPACK_IMPORTED_MODULE_3_punycode___default.a.ucs2.encode(codepoints);
  const normalForm = encoding.normalize('NFC');
  const decoding = __WEBPACK_IMPORTED_MODULE_3_punycode___default.a.ucs2.decode(normalForm);
  const points = Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(decoding);
  const bidiTypes = points.map(__WEBPACK_IMPORTED_MODULE_2_unicode_bidiclass___default.a);
  return Object(__WEBPACK_IMPORTED_MODULE_0__resolve_resolvedLevels__["a" /* resolvedLevelsWithInvisibles */])(points, bidiTypes, paragraphLevel, automaticLevel).toJS();
}

// Public API
function reorder(codepoints, levels, automaticLevel = false) {
  return Object(__WEBPACK_IMPORTED_MODULE_1__resolve_reorderedLevels__["a" /* default */])(Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(codepoints), Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(levels), automaticLevel).toJS();
}

// Public API
function reorderPermutation(levels) {
  return Object(__WEBPACK_IMPORTED_MODULE_1__resolve_reorderedLevels__["b" /* reorderPermutation */])(Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(levels)).toJS();
}

// Public API
function mirror(codepoints, levels) {
  return Object(__WEBPACK_IMPORTED_MODULE_9__resolve_mirror__["a" /* default */])(Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(codepoints), Object(__WEBPACK_IMPORTED_MODULE_4_immutable__["fromJS"])(levels)).toJS();
}

// Public API
const constants = {
  mirrorMap: __WEBPACK_IMPORTED_MODULE_8_unicode_9_0_0_Bidi_Mirroring_Glyph___default.a,
  oppositeBracket: __WEBPACK_IMPORTED_MODULE_7__util_oppositeBracket__["a" /* default */],
  openingBrackets: __WEBPACK_IMPORTED_MODULE_5__util_openingBrackets__["a" /* default */],
  closingBrackets: __WEBPACK_IMPORTED_MODULE_6__util_closingBrackets__["a" /* default */]
};

// Public API



/***/ }),
/* 18 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return resolvedLevelsWithInvisibles; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__paragraph_isolatingRunSequences__ = __webpack_require__(7);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__util_unzip__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__runOffsets__ = __webpack_require__(32);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__paragraph_automaticLevel__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__implicit_implicit__ = __webpack_require__(33);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__weak_resolvedWeaks__ = __webpack_require__(34);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_8_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__whitespacesLevelReset__ = __webpack_require__(47);











function resolvedLevelsWithInvisibles(paragraphCodepoints, paragraphBidiTypes, paragraphLevel, autoLTR = false) {
  const levels = resolvedLevels(paragraphCodepoints, paragraphBidiTypes, paragraphLevel, autoLTR);

  function merge(bidiTypes, ls, acc) {
    if (bidiTypes.size === 0) return acc;
    if (Object(__WEBPACK_IMPORTED_MODULE_2__util_constant__["r" /* isX9ControlCharacter */])(bidiTypes.first())) {
      return merge(bidiTypes.rest(), ls, acc.push('x'))
    } else {
      return merge(bidiTypes.rest(), ls.rest(), acc.push(ls.first()))
    }
  }

  return merge(paragraphBidiTypes, levels, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of())
}

function resolvedLevels(paragraphCodepoints, paragraphBidiTypes, paragraphLevel, autoLTR = false) {
  const level = (autoLTR === true) ? Object(__WEBPACK_IMPORTED_MODULE_5__paragraph_automaticLevel__["a" /* default */])(paragraphCodepoints, paragraphBidiTypes) : paragraphLevel;
  const {
    sequences, // without embeds
    codepoints, // without embeds
    bidiTypes, // without embeds, with X1-X8 applied
    paragraphBidiTypes: pbidi, // without embeds
    levels // with embeds..
  } = Object(__WEBPACK_IMPORTED_MODULE_1__paragraph_isolatingRunSequences__["a" /* default */])(paragraphCodepoints, paragraphBidiTypes, level);

  const resolvedTypes = Object(__WEBPACK_IMPORTED_MODULE_7__weak_resolvedWeaks__["a" /* default */])(codepoints, bidiTypes, sequences);
  const N = bidiTypes.size;
  const sequenceResolved = sequences.reduce(updateLevelsFromRuns, Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, N)).map(__ => 0));
  const resolvedImplicit = Object(__WEBPACK_IMPORTED_MODULE_6__implicit_implicit__["a" /* default */])(resolvedTypes, sequenceResolved);
  return Object(__WEBPACK_IMPORTED_MODULE_9__whitespacesLevelReset__["a" /* default */])(pbidi, resolvedImplicit, level);
}

function updateLevelsFromRuns(levels, sequence) {
  const runs = sequence.get('runs');
  const newLevels = runs.reduce((levels, run) => {
    const { from, to } = run.toJS();
    const size = to - from;
    const level = run.get('level');
    const levelSlice = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, size)).map(x => level);
    return levels.slice(0, from).concat(levelSlice).concat(levels.slice(to));
  }, levels);

  return newLevels;
}


/* unused harmony default export */ var _unused_webpack_default_export = (resolvedLevels);


/***/ }),
/* 19 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__type__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__rule_rules__ = __webpack_require__(20);









// BD7.
// [1]: Apply rules X1-X8 to compute the embedding levels
// [2]: Process each character iteratively, applying rules X2 through X8.
// [4]: Some rules modify the bidi types list and embedding levels
// [5]: Compute the runs by grouping adjacent characters with same the level numbers
//      with the exception of RLE, LRE and PDF which are stripped from output
function levelRuns(codepoints, bidiTypes, paragraphLevel = 0) {
  const rules = [
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["h" /* rle */],   // X2.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["b" /* lre */],   // X3.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["j" /* rlo */],   // X4.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["d" /* lro */],   // X5.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["i" /* rli */],   // X5a.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["c" /* lri */],   // X5b.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["a" /* fsi */],   // X5c.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["e" /* other */], // X6.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["g" /* pdi */],   // X6a.
    __WEBPACK_IMPORTED_MODULE_4__rule_rules__["f" /* pdf */]    // X7.
  ]; // [1][3]

  const initialStack = __WEBPACK_IMPORTED_MODULE_1_immutable__["Stack"].of(new __WEBPACK_IMPORTED_MODULE_3__type__["c" /* DirectionalStatusStackEntry */]({ level: paragraphLevel }));
  const initial = new __WEBPACK_IMPORTED_MODULE_3__type__["d" /* EmbeddingLevelState */]({ directionalStatusStack: initialStack })
    .set('bidiTypes', bidiTypes) // [4]
    .set('embeddingLevels', codepoints.map(__ => paragraphLevel)); // [4]

  const finalState = codepoints.zip(bidiTypes)
    .reduce((state, [codepoint, bidiType], index) => { // [2]
      return rules.reduce((s, rule) => rule(codepoint, bidiType, index, s, codepoints, bidiTypes), state);
    }, initial);

  const runs = codepoints // [5]
    .zip(bidiTypes, finalState.get('embeddingLevels'))
    .filter(([__, t, ___]) => Object(__WEBPACK_IMPORTED_MODULE_2__util_constant__["r" /* isX9ControlCharacter */])(t) === false) // X9.
    .reduce((runs, [codepoint, bidiTypes, level], index) => {
      const R = runs.size - 1;

      if (runs.getIn([R, 'level'], -1) === level) {
        return runs.updateIn([R, 'to'], __WEBPACK_IMPORTED_MODULE_3__type__["i" /* increase */]);
      } else {
        return runs.push(new __WEBPACK_IMPORTED_MODULE_3__type__["f" /* Run */]({ level, from: index, to: index + 1 }));
      }
    }, __WEBPACK_IMPORTED_MODULE_1_immutable__["List"].of());

  return {
    runs: runs,
    bidiTypes: finalState.get('bidiTypes'),
    levels: finalState.get('embeddingLevels')
  };

}


/* harmony default export */ __webpack_exports__["a"] = (levelRuns);


/***/ }),
/* 20 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__rle__ = __webpack_require__(21);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__lre__ = __webpack_require__(22);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__rlo__ = __webpack_require__(23);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__lro__ = __webpack_require__(24);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__rli__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__lri__ = __webpack_require__(9);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__fsi__ = __webpack_require__(25);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__other__ = __webpack_require__(27);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_8__pdi__ = __webpack_require__(28);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_9__pdf__ = __webpack_require__(29);
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "h", function() { return __WEBPACK_IMPORTED_MODULE_0__rle__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return __WEBPACK_IMPORTED_MODULE_1__lre__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "j", function() { return __WEBPACK_IMPORTED_MODULE_2__rlo__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return __WEBPACK_IMPORTED_MODULE_3__lro__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "i", function() { return __WEBPACK_IMPORTED_MODULE_4__rli__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return __WEBPACK_IMPORTED_MODULE_5__lri__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return __WEBPACK_IMPORTED_MODULE_6__fsi__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return __WEBPACK_IMPORTED_MODULE_7__other__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return __WEBPACK_IMPORTED_MODULE_8__pdi__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return __WEBPACK_IMPORTED_MODULE_9__pdf__["a"]; });















/***/ }),
/* 21 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return rle; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__type__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_lodash_flow__);




// http://unicode.org/reports/tr9/#X2
// [1]: "Compute the least odd embedding level greater than the embedding level of
//       the last entry on the directional status stack"
// [2]: at max_depth or if either overflow count is non-zero, the level remains the same (overflow RLE).
function rle(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_0__util_constant__["h" /* RLE */]) return state;

  const lastLevel = state.get('directionalStatusStack').peek().get('level');
  return __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default()(
    function(state) {
      return state.setIn(['embeddingLevels', 'levels', index], lastLevel);
    },
    function(state) {
      const newLevel = (lastLevel + 1) + (lastLevel % 2);
      const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_0__util_constant__["e" /* MAX_DEPTH */]); // [2]

      const isolate = state.get('overflowIsolateCount');
      const embedding = state.get('overflowEmbeddingCount');
      const isCurrentOverflow = (isolate > 0 || embedding > 0); // [2]
      const isOverflowRLE = (newLevelInvalid || isCurrentOverflow); // [2]

      if (isOverflowRLE) {
        if (isolate === 0) {
          return state.update('overflowEmbeddingCount', __WEBPACK_IMPORTED_MODULE_1__type__["i" /* increase */]);
        } else {
          return state;
        }
      } else {
        const newEntry = new __WEBPACK_IMPORTED_MODULE_1__type__["c" /* DirectionalStatusStackEntry */]({ level: newLevel });
        return state.update('directionalStatusStack', (stack) => stack.push(newEntry));
      }
    }
  )(state);
}




/***/ }),
/* 22 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__type__ = __webpack_require__(1);




// http://unicode.org/reports/tr9/#X3
function lre(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_1__util_constant__["b" /* LRE */]) return state;

  const lastLevel = state.get('directionalStatusStack').peek().get('level');
  return __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default()(
    function(state) {
      return state.setIn(['embeddingLevels', 'levels', index], lastLevel);
    },
    function(state) {
      const newLevel = (lastLevel + 1) + ((lastLevel + 1) % 2);
      const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_1__util_constant__["e" /* MAX_DEPTH */]); // [2]

      const isolate = state.get('overflowIsolateCount');
      const embedding = state.get('overflowEmbeddingCount');
      const isCurrentOverflow = (isolate > 0 || embedding > 0); // [2]
      const isOverflowRLE = (newLevelInvalid || isCurrentOverflow); // [2]

      if (isOverflowRLE) {
        if (isolate === 0) {
          return state.update('overflowEmbeddingCount', __WEBPACK_IMPORTED_MODULE_2__type__["i" /* increase */]);
        } else {
          return state;
        }
      } else {
        const newEntry = new __WEBPACK_IMPORTED_MODULE_2__type__["c" /* DirectionalStatusStackEntry */]({ level: newLevel });
        return state.update('directionalStatusStack', (stack) => stack.push(newEntry));
      }
    }
  )(state);
}

/* harmony default export */ __webpack_exports__["a"] = (lre);


/***/ }),
/* 23 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__type__ = __webpack_require__(1);




function rlo(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_0__util_constant__["j" /* RLO */]) return state;

  const lastLevel = state.get('directionalStatusStack').peek().get('level');
  const isolate = state.get('overflowIsolateCount');
  const embedding = state.get('overflowEmbeddingCount');

  const newLevel = (lastLevel + 1) + (lastLevel % 2); // [1]
  const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_0__util_constant__["e" /* MAX_DEPTH */]); // [2]
  const isCurrentOverflow = (isolate > 0 || embedding > 0); // [2]
  const isOverflowRLE = (newLevelInvalid || isCurrentOverflow); // [2]

  if (isOverflowRLE) {
    if (isolate === 0) {
      return state.update('overflowEmbeddingCount', __WEBPACK_IMPORTED_MODULE_1__type__["i" /* increase */]);
    } else {
      return state;
    }
  } else {
    return state.update('directionalStatusStack', (stack) => {
      return stack.push(new __WEBPACK_IMPORTED_MODULE_1__type__["c" /* DirectionalStatusStackEntry */]({
        level: newLevel,
        override: 'right-to-left'
      }));
    });
  }
}

/* harmony default export */ __webpack_exports__["a"] = (rlo);


/***/ }),
/* 24 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__type__ = __webpack_require__(1);




function lro(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_0__util_constant__["d" /* LRO */]) return state;

  const lastLevel = state.get('directionalStatusStack').peek().get('level');
  const isolate = state.get('overflowIsolateCount');
  const embedding = state.get('overflowEmbeddingCount');

  const newLevel = (lastLevel + 1) + ((lastLevel + 1) % 2);
  const newLevelInvalid = (newLevel > __WEBPACK_IMPORTED_MODULE_0__util_constant__["e" /* MAX_DEPTH */]); // [2]
  const isCurrentOverflow = (isolate > 0 || embedding > 0); // [2]
  const isOverflowRLE = (newLevelInvalid || isCurrentOverflow); // [2]

  if (isOverflowRLE) {
    if (isolate === 0) {
      return state.update('overflowEmbeddingCount', __WEBPACK_IMPORTED_MODULE_1__type__["i" /* increase */]);
    } else {
      return state;
    }
  } else {
    return state.update('directionalStatusStack', (stack) => {
      return stack.push(new __WEBPACK_IMPORTED_MODULE_1__type__["c" /* DirectionalStatusStackEntry */]({
        level: newLevel,
        override: 'left-to-right'
      }));
    });
  }
}

/* harmony default export */ __webpack_exports__["a"] = (lro);


/***/ }),
/* 25 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__rli__ = __webpack_require__(8);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__lri__ = __webpack_require__(9);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__automaticLevel__ = __webpack_require__(10);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__matchingPDIs__ = __webpack_require__(11);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__util_constant__ = __webpack_require__(0);






function fsi(codepoint, bidiType, index, state, codepoints, bidiTypes) {
  if (codepoint !== __WEBPACK_IMPORTED_MODULE_4__util_constant__["a" /* FSI */]) return state;

  const { initiatorToPDI } = Object(__WEBPACK_IMPORTED_MODULE_3__matchingPDIs__["a" /* default */])(codepoints);
  const matchingPDI = initiatorToPDI.get(index, -1);
  const from = index + 1;
  const to = (matchingPDI > -1) ? matchingPDI : codepoints.size;

  const codepointsSlice = codepoints.slice(from, to);
  const bidiTypesSlice = bidiTypes.slice(from, to);

  if (Object(__WEBPACK_IMPORTED_MODULE_2__automaticLevel__["a" /* default */])(codepointsSlice, bidiTypesSlice) === 1) {
    return Object(__WEBPACK_IMPORTED_MODULE_0__rli__["a" /* default */])(__WEBPACK_IMPORTED_MODULE_4__util_constant__["i" /* RLI */], bidiType, index, state, codepoints);
  } else {
    return Object(__WEBPACK_IMPORTED_MODULE_1__lri__["a" /* default */])(__WEBPACK_IMPORTED_MODULE_4__util_constant__["c" /* LRI */], bidiType, index, state, codepoints);
  }

}

/* harmony default export */ __webpack_exports__["a"] = (fsi);


/***/ }),
/* 26 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_immutable__);




// http://www.unicode.org/reports/tr9/#BD9
function matchingPDIForIndex(codepoints, index) {
  if (index >= codepoints.size) { return -1; }
  if (!__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()([__WEBPACK_IMPORTED_MODULE_1__util_constant__["c" /* LRI */], __WEBPACK_IMPORTED_MODULE_1__util_constant__["i" /* RLI */], __WEBPACK_IMPORTED_MODULE_1__util_constant__["a" /* FSI */]], codepoints.get(index))) { return -1; }

  const after = codepoints.slice(index + 1);
  const BD9State = Object(__WEBPACK_IMPORTED_MODULE_2_immutable__["Record"])({ counter: 1, index: -1 }, 'BD9State'); // BD9.

  const finalState = after.reduce((state, codepoint, offset) => {
    if (state.get('index') > -1) return state;

    const newCounter = (() => {
      const counter = state.get('counter');
      if (__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()([__WEBPACK_IMPORTED_MODULE_1__util_constant__["c" /* LRI */], __WEBPACK_IMPORTED_MODULE_1__util_constant__["i" /* RLI */], __WEBPACK_IMPORTED_MODULE_1__util_constant__["a" /* FSI */]], codepoint)) return counter + 1;
      else if (codepoint === __WEBPACK_IMPORTED_MODULE_1__util_constant__["g" /* PDI */]) return counter - 1;
      else return counter;
    })();

    if (codepoint === __WEBPACK_IMPORTED_MODULE_1__util_constant__["g" /* PDI */] && newCounter === 0) {
      return new BD9State({ counter: newCounter, index: index + (offset + 1) });
    } else {
      return state.set('counter', newCounter);
    }

  }, new BD9State());

  return finalState.get('index');
}

/* harmony default export */ __webpack_exports__["a"] = (matchingPDIForIndex);


/***/ }),
/* 27 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__util_constant__ = __webpack_require__(0);




// TODO: change name of this function to 'setLevel'
function other(ch, bidiType, index, state) {
  if (Object(__WEBPACK_IMPORTED_MODULE_2__util_constant__["n" /* isNonFormatting */])(bidiType)) return state;

  const lastEntry = state.get('directionalStatusStack').peek();
  const lastLevel = lastEntry.get('level');

  return __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default()(
    function setEmbedding(state) { // [1]
      return state.update('embeddingLevels', ls => ls.set(index, lastLevel))
    },
    function checkOverride(state) {
      const lastOverride = lastEntry.get('override');

      if (lastOverride !== 'neutral') {
        const override = (lastOverride === 'left-to-right') ? 'L' : 'R';
        return state.update('bidiTypes', ts => ts.set(index, override))
      } else {
        return state;
      }
    }
  )(state);
}

/* harmony default export */ __webpack_exports__["a"] = (other);


/***/ }),
/* 28 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return pdi; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__type__ = __webpack_require__(1);




// http://unicode.org/reports/tr9/#X6a
// [A]: "If the overflow isolate count is greater than zero, this PDI matches an
//      overflow isolate initiator. Decrement the overflow isolate count by one."
// [B]: "Otherwise, if the valid isolate count is zero, this PDI does not match any
//      isolate initiator, valid or overflow. Do nothing."
// [C]: "Otherwise, this PDI matches a valid isolate initiator."
// [C1]: "While the directional isolate status of the last entry on
//      the stack is false, pop the last entry from the directional status stack"
// [D]: "In all cases, look up the last entry on the directional status stack left after the steps above and:
//       - Set the PDI’s level to the entry's embedding level.
//       - If the entry's directional override status is not neutral, reset the current character type from PDI to
//       L if the override status is left-to-right, and to R if the override status is right-to-left."
function pdi(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_1__util_constant__["g" /* PDI */]) return state;
  const isolateOverflow = state.get('overflowIsolateCount');
  const validIsolateCount = state.get('validIsolateCount');

  return __WEBPACK_IMPORTED_MODULE_0_lodash_flow___default()(
    function updateCounts(state) {
      if (isolateOverflow > 0) { // [A]
        return state.update('overflowIsolateCount', __WEBPACK_IMPORTED_MODULE_2__type__["h" /* decrease */]);
      } else if (validIsolateCount === 0) { // [B]
        return state;
      } else { // [C]
        return state
          .set('overflowEmbeddingCount', 0)
          .update('directionalStatusStack', (stack) => { // [C1]
            return stack.skipWhile(entry => entry.get('isolate') === false)
          })
          .update('directionalStatusStack', (stack) => stack.pop())
          .update('validIsolateCount', __WEBPACK_IMPORTED_MODULE_2__type__["h" /* decrease */]);
      }
    },
    function(state) {
      const lastEntry = state.get('directionalStatusStack').peek();
      const lastLevel = lastEntry.get('level');
      return state.update('embeddingLevels', ls => ls.set(index, lastLevel))
    },
    function checkOverride(state) {
      const lastOverride = state.get('directionalStatusStack').peek().get('override');
      if (lastOverride !== 'neutral') {
        const override = (lastOverride === 'left-to-right') ? 'L' : 'R';
        return state.setIn(['bidiTypes', index], override);
      } else {
        return state;
      }
    }
  )(state);

}




/***/ }),
/* 29 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return pdf; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__type__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_lodash_flow__);




// http://unicode.org/reports/tr9/#X7
function pdf(ch, bidiType, index, state) {
  if (ch !== __WEBPACK_IMPORTED_MODULE_0__util_constant__["f" /* PDF */]) return state;

  return __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default()(
    function(state) {
      const lastLevel = state.get('directionalStatusStack').peek().get('level');
      return state.setIn(['embeddingLevels', 'levels', index], lastLevel);
    },
    function(state) {
      const isolateOverflow = state.get('overflowIsolateCount');
      const embeddingOverflow = state.get('overflowEmbeddingCount');
      const stack = state.get('directionalStatusStack');
      const lastIsolateStatus = stack.peek().get('isolate');

      if (isolateOverflow > 0) {
        return state;
      } else if (embeddingOverflow > 0) {
        return state.update('overflowEmbeddingCount', __WEBPACK_IMPORTED_MODULE_1__type__["h" /* decrease */]);
      } else if (lastIsolateStatus === false && stack.size >= 2) {
        return state.set('directionalStatusStack', stack.pop());
      } else {
        return state;
      }
    }
  )(state);
}




/***/ }),
/* 30 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);


// Immutable.js doesnt have unzip
// Unzips a "zipped" Immutable.js List of pairs in O(N) time
// unzip(pairs: List<Array<a,b>>): Array<List<a>, List<b>>
function unzip3(pairs) {
  const unzipped = pairs
    .reduce((unzipped, [a, b, c]) => {
      return unzipped
        .update(0, (as) => as.push(a))
        .update(1, (bs) => bs.push(b))
        .update(2, (cs) => cs.push(c))
    }, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(), __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of()));
  return [unzipped.get(0), unzipped.get(1), unzipped.get(2)];
}

/* harmony default export */ __webpack_exports__["a"] = (unzip3);


/***/ }),
/* 31 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__type__ = __webpack_require__(1);


function levelRunFromIndex(sequence, index) {
  const lookup = sequence.filter(run => index >= run.get('from') && index < run.get('to'));
  if (lookup.size > 0) return lookup.last();
  return new __WEBPACK_IMPORTED_MODULE_0__type__["f" /* Run */]();
}

/* harmony default export */ __webpack_exports__["a"] = (levelRunFromIndex);


/***/ }),
/* 32 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);


function runOffsets(runs) {
  const offsets = runs.butLast().reduce((acc, run)  => {
    const { from, to } = run.toJS();
    const size = to - from;
    const lastSize = acc.get(-1);
    return acc.push(size + lastSize);
  }, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(0));
  return offsets;
}

/* unused harmony default export */ var _unused_webpack_default_export = (runOffsets);


/***/ }),
/* 33 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
function resolveImplicit(types, levels) {
  return types.zipWith((t,level) => {
    if (t === 'L')  { return level + (level % 2) }
    if (t === 'R')  { return level + ((level + 1) % 2) }
    if (t === 'AN' || t === 'EN') { return (level + 1) + ((level + 1) % 2) }
  }, levels);
}

/* harmony default export */ __webpack_exports__["a"] = (resolveImplicit);


/***/ }),
/* 34 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__rule_rules__ = __webpack_require__(35);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__paragraph_isolatingRunSequences__ = __webpack_require__(7);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__util_unzip__ = __webpack_require__(12);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__neutral_resolveIsolates__ = __webpack_require__(43);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__neutral_resolveBrackets__ = __webpack_require__(44);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_7__neutral_resolveRemaining__ = __webpack_require__(46);









function resolvedWeaks(codepoints, bidiTypes, sequences) {
  return sequences.reduce((types, sequence) => {
    return resolvedWeaksForSequence(codepoints, types, sequence);
  }, bidiTypes);
}

// X10.
// [1]: applying one rule to all the characters in the sequence
//      in the order in which they occur in the sequence
//      before applying another rule to any part of the sequence.
function resolvedWeaksForSequence(codepoints, bidiTypes, sequence) {
  // merge together all the codepoint-slices and bidiType-slices
  // that each run in the sequence take
  const paragraph = codepoints.zip(bidiTypes);
  const [ codepointsFromSequence, bidiTypesFromSequence ] = Object(__WEBPACK_IMPORTED_MODULE_4__util_unzip__["a" /* default */])(
    sequence.get('runs').map(run => {
      const { from, to } = run.toJS();
      return paragraph.slice(from, to);
    }).flatten()
  );

  const rules = [
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["f" /* nsm */], // W1.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["b" /* en */],  // W2.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["a" /* al */],  // W3.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["d" /* es */],  // W4.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["e" /* et */],  // W5.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["g" /* on */],  // W6.
    __WEBPACK_IMPORTED_MODULE_1__rule_rules__["c" /* enToL */], // W7.
    __WEBPACK_IMPORTED_MODULE_6__neutral_resolveBrackets__["a" /* default */], // N0
    __WEBPACK_IMPORTED_MODULE_5__neutral_resolveIsolates__["a" /* default */], // N1
    __WEBPACK_IMPORTED_MODULE_7__neutral_resolveRemaining__["a" /* default */] // N2
  ]; // [1]

  const newTypesFromSequence = rules.reduce((types, rule) => {
    const level = sequence.get('runs').first().get('level');
    // console.log(rule.name, ' types = ', types, '--', codepointsFromSequence)
    const t = rule(types, codepointsFromSequence, sequence.get('sos'), sequence.get('eos'), level, bidiTypesFromSequence);
    // console.log(rule.name, ' types = ', t, '--', codepointsFromSequence)
    return t;
  }, bidiTypesFromSequence); // [1]

  const offsets = sequence.get('runs').butLast().reduce((acc, run)  => {
    const { from, to } = run.toJS();
    const size = to - from;
    const lastSize = acc.get(-1);
    return acc.push(size + lastSize);
  }, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(0));

  const slices = sequence.get('runs').zip(offsets).map(([run, offset]) => {
    const { from, to } = run.toJS();
    const size = to - from;
    return newTypesFromSequence.slice(offset, offset + size);
  });

  const newTypes = sequence.get('runs').zip(slices).reduce((types, [run, slice]) => {
    const { from, to } = run.toJS();
    return types
      .slice(0, from)
      .concat(slice)
      .concat(types.slice(to));
  }, bidiTypes);

  return newTypes;
}

/* harmony default export */ __webpack_exports__["a"] = (resolvedWeaks);


/***/ }),
/* 35 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__nsm__ = __webpack_require__(36);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__en__ = __webpack_require__(37);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__al__ = __webpack_require__(38);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__es__ = __webpack_require__(39);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__et__ = __webpack_require__(40);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__on__ = __webpack_require__(41);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__enToL__ = __webpack_require__(42);
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return __WEBPACK_IMPORTED_MODULE_0__nsm__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return __WEBPACK_IMPORTED_MODULE_1__en__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return __WEBPACK_IMPORTED_MODULE_2__al__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return __WEBPACK_IMPORTED_MODULE_3__es__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return __WEBPACK_IMPORTED_MODULE_4__et__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return __WEBPACK_IMPORTED_MODULE_5__on__["a"]; });
/* harmony reexport (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return __WEBPACK_IMPORTED_MODULE_6__enToL__["a"]; });











/***/ }),
/* 36 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__util_constant__ = __webpack_require__(0);



// http://unicode.org/reports/tr9/#W1
// [1]: if the NSM is at the start of the isolating run sequence,
//      it will get the type of sos.
// [2]: change the type of the NSM to Other Neutral if the previous
//      character is an isolate initiator or PDI,
// [3]: change to the type of the previous character otherwise
function nsm(types, points, sos, eos) {
  return types.reduce((acc, t, index) => {
    if (t !== 'NSM') return acc.push(t);

    if (index <= 0) { // [1]
      return acc.push(sos);
    } else {
      const prevType = acc.get(index - 1);
      const prevPoint = points.get(index - 1);

      if (Object(__WEBPACK_IMPORTED_MODULE_1__util_constant__["l" /* isIsolateInitiator */])(prevType) || Object(__WEBPACK_IMPORTED_MODULE_1__util_constant__["o" /* isPDI */])(prevPoint)) { // [2]
        return acc.push('ON');
      } else {
        return acc.push(prevType);
      }
    }
  }, __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of());
}

/* harmony default export */ __webpack_exports__["a"] = (nsm);


/***/ }),
/* 37 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);


// http://unicode.org/reports/tr9/#W2
// [1]: Search backward from each instance of a European number
//      until the first strong type (R, L, AL, or sos) is found.
// [2]: If an AL is found, change the type of the European number
//      to Arabic number.
function en(types, run, sos, eos, level) {
  return types.map((t, index) => {
    if (t !== 'EN') return t;

    const behind = types.slice(0, index).reverse().push(sos);
    const prevStrong = behind.find(t => Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["q" /* isStrong */])(t)); // [1]

    if (prevStrong === 'AL') { // [2]
      return 'AN';
    } else {
      return t;
    }
  });
}

/* harmony default export */ __webpack_exports__["a"] = (en);


/***/ }),
/* 38 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// http://unicode.org/reports/tr9/#W3
// [1]: Change all ALs to R.
function al(types) {
  return types.map(t => {
    if (t === 'AL') return 'R'; // [1]
    else return t;
  });
}

/* harmony default export */ __webpack_exports__["a"] = (al);


/***/ }),
/* 39 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);


// http://unicode.org/reports/tr9/#W4
// [1]: A single European separator between two European
//      numbers changes to a European number.
// [2]: A single common separator between two
//      numbers of the same type changes to that type.
// [3]: (Otherwise make no changes)
function es(types) {
  if (types.size < 3) return types;

  const isNumber = t => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['AN', 'EN'], t);
  const first = types.take(1);
  const middle = types.skip(2).zipWith((curr, prevOne, prevTwo) => {
    if (curr === 'EN' && curr === prevTwo && prevOne === 'ES') { // [1]
      return 'EN';
    } else if (prevOne === 'CS' && isNumber(curr) && curr === prevTwo) { // [2]
      return curr;
    } else { // [3]
      return prevOne;
    }
  }, types.skip(1), types);
  const last = types.last();
  return first.concat(middle).push(last);
}

/* harmony default export */ __webpack_exports__["a"] = (es);


/***/ }),
/* 40 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);


// http://unicode.org/reports/tr9/#W5
// [1]: A sequence of European terminators adjacent
//      to European numbers changes to all European numbers.
// [2]: if slice(index) is some sequence of the form ET, ET, ET, ..., EN
//      of if slice(0, index).reverse() is some sequence the form ET, ET, ET, ..., EN
//      then there is some EN adjacent to the ET sequence
function et(types) {
  return types.map((t, index) => {
    if (t !== 'ET') return t;

    const behind = types.slice(0, index).reverse();
    const ahead = types.slice(index);

    const behindAdj = (behind.skipWhile(__WEBPACK_IMPORTED_MODULE_0__util_constant__["k" /* isET */]).first() === 'EN');
    const aheadAdj = (ahead.skipWhile(__WEBPACK_IMPORTED_MODULE_0__util_constant__["k" /* isET */]).first() === 'EN');

    if (behindAdj || aheadAdj) { // [2]
      return 'EN'; // [1]
    } else {
      return t;
    }
  });
}

/* harmony default export */ __webpack_exports__["a"] = (et);


/***/ }),
/* 41 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);


// http://unicode.org/reports/tr9/#W6
// [1]: separators and terminators change to Other Neutral.
function on(types, run) {
  return types.map((t, index) => {
    if (__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['ET', 'ES', 'CS', 'B', 'S'], t)) return 'ON'; // [1]
    else return t;
  });
}

/* harmony default export */ __webpack_exports__["a"] = (on);


/***/ }),
/* 42 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);


// http://unicode.org/reports/tr9/#W7
// [1]: Search backward from each instance of a European number
//      until the first strong type (R, L, or sos) is found.
// [2]: If an L is found, then change the type of the European number to L.
function enToL(types, points, sos, eos, level) {
  return types.map((t, index) => {
    if (t !== 'EN') return t;

    const behind = types.slice(0, index).reverse().push(sos);
    const prevStrong = behind.find(t => Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["q" /* isStrong */])(t)); // [1]

    if (prevStrong === 'L') { // [2]
      return 'L';
    } else {
      return t;
    }
  });
}

/* harmony default export */ __webpack_exports__["a"] = (enToL);


/***/ }),
/* 43 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);


// http://unicode.org/reports/tr9/#N1
function resolveIsolates(types, codepoints, sos, eos, level) {
  return types.map((t, index) => {
    if (!Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["m" /* isNI */])(t)) return t;

    const behind = types.slice(0, index).reverse().push(sos);
    const ahead = types.slice(index).push(eos);

    const behindAdjacent = behind.skipWhile(__WEBPACK_IMPORTED_MODULE_0__util_constant__["m" /* isNI */]).first();
    const aheadAdjacent = ahead.skipWhile(__WEBPACK_IMPORTED_MODULE_0__util_constant__["m" /* isNI */]).first();

    if (behindAdjacent === 'L' && aheadAdjacent === 'L') {
      return 'L'; // [1]
    } else if(Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["p" /* isR */])(behindAdjacent) && Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["p" /* isR */])(aheadAdjacent)) {
      return 'R';
    } else {
      return t;
    }
  });
}

/* harmony default export */ __webpack_exports__["a"] = (resolveIsolates);


/***/ }),
/* 44 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__bracketPairs__ = __webpack_require__(45);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow__ = __webpack_require__(4);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2_lodash_flow__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_3_lodash_includes__);





// http://unicode.org/reports/tr9/#N0
function resolveBrackets(bidiTypes, points, sos, eos, level, bidiTypesBeforeW1) {
  // [1]: If any strong type (either L or R) matching the embedding direction
  //      is found, set the type for both brackets in the pair to
  //      match the embedding direction.
  const pairs = Object(__WEBPACK_IMPORTED_MODULE_1__bracketPairs__["a" /* default */])(points);
  return __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default()(
      function() {
        return pairs.reduce((currTypes, pair) => {
          const open = pair.get('open');
          const close = pair.get('close');

          // "Bracket pairs within an isolating run sequence are processed as units so that
          // both the opening and the closing paired bracket in a pair resolve to the SAME DIRECTION."
          if (currTypes.get(open) !== currTypes.get(close)) return currTypes;

          // [*]: "Within this scope, bidirectional types EN and AN are treated as R"
          //       TODO: [performance]: repeatedly calling map inside reduce is O(N^2) where N is |bidiTypes|
          //                            can probably get this to O(N) if we map EN, AN to R _once_ at the start
          const enclosing = currTypes
            .slice(open, close + 1)
            .map(t => (__WEBPACK_IMPORTED_MODULE_3_lodash_includes___default()(['EN', 'AN'], t)) ? 'R' : t); // [*]

          const e = (level % 2 === 0) ? 'L' : 'R';
          const o = (level % 2 === 0) ? 'R' : 'L';
          const hasE = enclosing.find(x => x === e);
          const hasO = enclosing.find(x => x === o);

          if (hasE) { // [1]
            return currTypes.set(open, e).set(close, e); // N0.b
          } else if (hasO) {

            // search backwards from before `open` "until the first strong type (L, R, or sos) is found"
            const context = currTypes.slice(0, open)
              .map(t => (__WEBPACK_IMPORTED_MODULE_3_lodash_includes___default()(['EN', 'AN'], t)) ? 'R' : t) // [*]
              .reverse()
              .push(sos)
              .find(x => __WEBPACK_IMPORTED_MODULE_3_lodash_includes___default()(['L', 'R'], x));
            const established = context === o;

            if (established) { // N0.c.1.
              return currTypes.set(open, o).set(close, o);
            } else { // N0.c.2
              return currTypes.set(open, e).set(close, e);
            }
          } else { // N0.d
            return currTypes;
          }
        }, bidiTypes);
      },
      function (bidiTypesAfterN0) {
        // "Any number of characters that had original bidirectional character type NSM prior
        // to the application of W1 that immediately follow a paired bracket which
        // changed to L or R under N0 should change to match the type of their preceding bracket."
        return pairs.reduce((currTypes, pair) => {
          const open = pair.get('open');
          const close = pair.get('close');
          const openChangedToLorR = __WEBPACK_IMPORTED_MODULE_3_lodash_includes___default()(['L', 'R'], currTypes.get(open));
          const closeChangedToLorR = __WEBPACK_IMPORTED_MODULE_3_lodash_includes___default()(['L', 'R'], currTypes.get(close));

          // TODO: fix this so that _a SEQUENCE of NSMs_ are all changed to the strong type
          //       eg. ( NSM NSM NSM NSM ==>  ( L L L L
          //       eg. ) NSM NSM NSM NSM ==>  ) L L L L
          //       right now _ONLY ONE_ NSM that follows is changed to the strong type
          return __WEBPACK_IMPORTED_MODULE_2_lodash_flow___default()(
              function(currTypes) {
                if (bidiTypesBeforeW1.get(open + 1) === 'NSM' && openChangedToLorR) {
                  return currTypes.set(open + 1, currTypes.get(open));
                } else {
                  return currTypes;
                }
              },
              function(currTypes) {
                if (bidiTypesBeforeW1.get(close + 1) === 'NSM' && closeChangedToLorR) {
                  return currTypes.set(close + 1, currTypes.get(close));
                } else {
                  return currTypes;
                }
              }
          )(currTypes);
        }, bidiTypesAfterN0);
      }
  )();
}

/* harmony default export */ __webpack_exports__["a"] = (resolveBrackets);


/***/ }),
/* 45 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__ = __webpack_require__(6);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_isundefined___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_isundefined__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash_includes__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__type__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__util_constant__ = __webpack_require__(0);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__util_openingBrackets__ = __webpack_require__(13);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__util_closingBrackets__ = __webpack_require__(14);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__util_oppositeBracket__ = __webpack_require__(15);










// --| bracketPairs(points: List<Int>, types: List<String>): List<Pairing>
// --| Computes the bracket pairs (c.f. BD16) can that occur in an isolating run sequence.
// --| points - sequence of codepoints representing piece of text that may contain brackets
// --| bidiTypes - sequence of bidirectional character types
// --| Note: Bracket pairs can only occur in an isolating run sequence because they
// --| are processed in rule N0 after explicit level resolution

const STACK_MAX_SIZE = 63;

function bracketPairs(points, bidiTypes) {
  // [1]: Sort the list of pairs of text positions in ascending order
  //      based on the text position of the opening paired bracket.
  // [*]: "If an opening paired bracket is found and there is no room in the stack,
  //       stop processing BD16 for the remainder of the isolating run sequence."
  const initialState = new __WEBPACK_IMPORTED_MODULE_2__type__["b" /* BracketPairState */]();
  const finalState = points.reduce((state, point, position) => {
    if (state.get('stackoverflow') === true) return state; // [*]

    const stack = state.get('stack');

    if (__WEBPACK_IMPORTED_MODULE_4__util_openingBrackets__["a" /* default */].has(point)) {
      if (stack.size == 63) { // [*]
        return state.set('stackoverflow', true);
      } else {
        return state.set('stack', stack.push(new __WEBPACK_IMPORTED_MODULE_2__type__["a" /* BracketPairStackEntry */]({
          point: __WEBPACK_IMPORTED_MODULE_6__util_oppositeBracket__["a" /* default */].get(point),
          position
        })));
      }
    } else if (__WEBPACK_IMPORTED_MODULE_5__util_closingBrackets__["a" /* default */].has(point) && stack.size > 0) {
      const openIndex = stack.findKey((entry) => entry.get('point') === point)

      if (!__WEBPACK_IMPORTED_MODULE_0_lodash_isundefined___default()(openIndex)) {
        const openPosition = stack.getIn([openIndex, 'position']);
        return state
          .set('stack', stack.slice(openIndex + 1))
          .update('pairings', (pairings) => pairings.push(new __WEBPACK_IMPORTED_MODULE_2__type__["e" /* Pairing */]({
            open: openPosition,
            close: position
          })))
      } else {
        return state;
      }
    } else {
      return state;
    }
  }, initialState);

  return finalState
    .get('pairings')
    .sort((p1, p2) => p1.get('open') - p2.get('open')); // [1]
}

/* harmony default export */ __webpack_exports__["a"] = (bracketPairs);


/***/ }),
/* 46 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__util_constant__ = __webpack_require__(0);


// http://unicode.org/reports/tr9/#N2
function resolveRemaining(types, codepoints, sos, eos, level) {
  const newType = (level % 2 === 0) ? 'L' : 'R';
  return types.map((t, index) => {
    if (Object(__WEBPACK_IMPORTED_MODULE_0__util_constant__["m" /* isNI */])(t)) { return newType; }
    return t;
  });
}

/* harmony default export */ __webpack_exports__["a"] = (resolveRemaining);


/***/ }),
/* 47 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_lodash_includes__);


const isWhitespaceResettable = t => __WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['WS', 'FSI', 'LRI', 'RLI', 'PDI'], t);

// http://unicode.org/reports/tr9/#L1
function whitespacesLevelReset(types, levels, paragraphLevel) {
  return types.zip(levels).map(([type, level], index) => {
    if (__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['S', 'B'], type)) return paragraphLevel; // L1.1, L1.2
    if (!isWhitespaceResettable(type)) return level;

    const ahead = types.slice(index).push('<EOL>');
    const aheadAdj = ahead.skipWhile(isWhitespaceResettable).first();

    if (__WEBPACK_IMPORTED_MODULE_0_lodash_includes___default()(['<EOL>', 'S', 'B'], aheadAdj)) { // L1.3, L1.4
      return paragraphLevel;
    } else {
      return level;
    }
  });
}

/* harmony default export */ __webpack_exports__["a"] = (whitespacesLevelReset);


/***/ }),
/* 48 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return reorderPermutation; });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_immutable___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_immutable__);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_isnumber__ = __webpack_require__(49);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1_lodash_isnumber___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_1_lodash_isnumber__);



const ReorderPair = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({ level: -1, from: 0, to: 0 }, 'ReorderPair');

const spliceList = (list, from, to, paste) => {
  const left = list.slice(0, from);
  const right = list.slice(to);
  return left.concat(paste).concat(right);
};

// Returns the storage -> display reordering performed by UBA
// representing as a permutation on the set {0, 1, 2, ... n - 1}
// Permutation represented via "one-line notation"
// see: https://en.wikipedia.org/wiki/Permutation#Definition_and_notations
function reorderPermutation(levels, IGNORE_INVISIBLE = false, INVISIBLE_MARK = 'x') {
  const storage = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, levels.size))
    .map(i => Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Map"])({ strip: levels.get(i) === INVISIBLE_MARK, index: i }))
    .filter(x => x.get('strip') === false)
    .map(x => x.get('index'));

  const levelsWithoutInvisibles = levels.filter(x => x != INVISIBLE_MARK);
  const reorderedWithoutInvisibles = reorderedLevels(storage, levelsWithoutInvisibles);

  const Reduction = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Record"])({ remaining: Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(), result: Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])() }, 'Reduction');
  const initialReduction = new Reduction({ remaining: reorderedWithoutInvisibles, result: Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])() });
  const permutation = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, levels.size))
    .reduce((reduction, i) => {

      if (levels.get(i) == INVISIBLE_MARK) {
        const j = reduction.get('result').size;
        return reduction.setIn(['result', i], j);
      }

      const remaining = reduction.get('remaining');
      return reduction
        .setIn(['result', i], remaining.first())
        .set('remaining', remaining.shift());
    }, initialReduction)
    .get('result');

  if (IGNORE_INVISIBLE) {
    return reorderedWithoutInvisibles;
  } else {
    return permutation;
  }
}

// http://www.unicode.org/reports/tr9/#L2
// first:   reverse slices at levels:  max
// then:    reverse slices at levels:  max,max-1
// then:    reverse slices at levels:  max,max-1,max-2
// ...
// finally: reverse slices at levels:  max,max-1,max-2,...,1
function reorderedLevels(storage, levels) {
  const slicesByLevel = reorderingSlices(levels, 0)
    .groupBy(slice => slice.get('level'));

  const maxLevel = slicesByLevel.keySeq().max();
  if (!__WEBPACK_IMPORTED_MODULE_1_lodash_isnumber___default()(maxLevel) || maxLevel < 0) {
    return storage;
  }

  if (maxLevel === 0) {
    return storage;
  } else {
    const slices = slicesByLevel.get(maxLevel);

    const storageAfter = slices.reduce((curr, slice) => {
      const { from, to } = slice.toJS();
      const reversed = curr.slice(from, to).reverse();
      return spliceList(curr, from, to, reversed);
    }, storage)

    const levelsAfter = slices.reduce((curr, slice) => {
      const { from, to } = slice.toJS();
      const nextLevel = Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["List"])(Object(__WEBPACK_IMPORTED_MODULE_0_immutable__["Range"])(0, to - from)).map(__ => maxLevel - 1);
      return spliceList(curr, from, to, nextLevel);
    }, levels)

    return reorderedLevels(storageAfter, levelsAfter);
  }
}

function reorderingSlices(levels, offset) {
  const N = levels.size;
  if (N === 0) return __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of();

  const level = levels.first();
  const nextLevelIndex = levels.findKey(v => v != level);
  const size = (nextLevelIndex === undefined) ? N : nextLevelIndex;
  const slice = new ReorderPair({ level, from: offset, to: offset + size });

  return __WEBPACK_IMPORTED_MODULE_0_immutable__["List"].of(slice)
    .concat(reorderingSlices(levels.slice(size), offset + size));
}


/* harmony default export */ __webpack_exports__["a"] = (reorderedLevels);


/***/ }),
/* 49 */
/***/ (function(module, exports) {

/**
 * lodash 3.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && objectToString.call(value) == numberTag);
}

module.exports = isNumber;


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {var require;var require;(function(f){if(true){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Foo = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return require(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
module.exports=/[\u0608\u060B\u060D\u061B\u061C\u061E-\u064A\u066D-\u066F\u0671-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u070D\u070F\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u08A0-\u08B4\u08B6-\u08BD\uFB50-\uFBC1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFC\uFE70-\uFE74\uFE76-\uFEFC]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]/
},{}],3:[function(require,module,exports){
module.exports=/[\u0600-\u0605\u0660-\u0669\u066B\u066C\u06DD\u08E2]|\uD803[\uDE60-\uDE7E]/
},{}],4:[function(require,module,exports){
module.exports=/[\0-\x08\x0E-\x1B\x7F-\x84\x86-\x9F\xAD\u180E\u200B-\u200D\u2060-\u2064\u206A-\u206F\uFEFF]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/
},{}],5:[function(require,module,exports){
module.exports=/[,\./:\xA0\u060C\u202F\u2044\uFE50\uFE52\uFE55\uFF0C\uFF0E\uFF0F\uFF1A]/
},{}],6:[function(require,module,exports){
module.exports=/[0-9\xB2\xB3\xB9\u06F0-\u06F9\u2070\u2074-\u2079\u2080-\u2089\u2488-\u249B\uFF10-\uFF19]|\uD800[\uDEE1-\uDEFB]|\uD835[\uDFCE-\uDFFF]|\uD83C[\uDD00-\uDD0A]/
},{}],7:[function(require,module,exports){
module.exports=/[\+\-\u207A\u207B\u208A\u208B\u2212\uFB29\uFE62\uFE63\uFF0B\uFF0D]/
},{}],8:[function(require,module,exports){
module.exports=/[#-%\xA2-\xA5\xB0\xB1\u058F\u0609\u060A\u066A\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u2030-\u2034\u20A0-\u20BE\u212E\u2213\uA838\uA839\uFE5F\uFE69\uFE6A\uFF03-\uFF05\uFFE0\uFFE1\uFFE5\uFFE6]/
},{}],9:[function(require,module,exports){
module.exports=/\u2068/
},{}],10:[function(require,module,exports){
module.exports=/[A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u02BB-\u02C1\u02D0\u02D1\u02E0-\u02E4\u02EE\u0370-\u0373\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0482\u048A-\u052F\u0531-\u0556\u0559-\u055F\u0561-\u0587\u0589\u0903-\u0939\u093B\u093D-\u0940\u0949-\u094C\u094E-\u0950\u0958-\u0961\u0964-\u0980\u0982\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C0\u09C7\u09C8\u09CB\u09CC\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E1\u09E6-\u09F1\u09F4-\u09FA\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A40\u0A59-\u0A5C\u0A5E\u0A66-\u0A6F\u0A72-\u0A74\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC0\u0AC9\u0ACB\u0ACC\u0AD0\u0AE0\u0AE1\u0AE6-\u0AF0\u0AF9\u0B02\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B3E\u0B40\u0B47\u0B48\u0B4B\u0B4C\u0B57\u0B5C\u0B5D\u0B5F-\u0B61\u0B66-\u0B77\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE\u0BBF\u0BC1\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD0\u0BD7\u0BE6-\u0BF2\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C41-\u0C44\u0C58-\u0C5A\u0C60\u0C61\u0C66-\u0C6F\u0C7F\u0C80\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA\u0CCB\u0CD5\u0CD6\u0CDE\u0CE0\u0CE1\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D4E\u0D4F\u0D54-\u0D61\u0D66-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E4F-\u0E5B\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00-\u0F17\u0F1A-\u0F34\u0F36\u0F38\u0F3E-\u0F47\u0F49-\u0F6C\u0F7F\u0F85\u0F88-\u0F8C\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE-\u0FDA\u1000-\u102C\u1031\u1038\u103B\u103C\u103F-\u1057\u105A-\u105D\u1061-\u1070\u1075-\u1081\u1083\u1084\u1087-\u108C\u108E-\u109C\u109E-\u10C5\u10C7\u10CD\u10D0-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1360-\u137C\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u167F\u1681-\u169A\u16A0-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1735\u1736\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17B6\u17BE-\u17C5\u17C7\u17C8\u17D4-\u17DA\u17DC\u17E0-\u17E9\u1810-\u1819\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1923-\u1926\u1929-\u192B\u1930\u1931\u1933-\u1938\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A16\u1A19\u1A1A\u1A1E-\u1A55\u1A57\u1A61\u1A63\u1A64\u1A6D-\u1A72\u1A80-\u1A89\u1A90-\u1A99\u1AA0-\u1AAD\u1B04-\u1B33\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B4B\u1B50-\u1B6A\u1B74-\u1B7C\u1B82-\u1BA1\u1BA6\u1BA7\u1BAA\u1BAE-\u1BE5\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2\u1BF3\u1BFC-\u1C2B\u1C34\u1C35\u1C3B-\u1C49\u1C4D-\u1C88\u1CC0-\u1CC7\u1CD3\u1CE1\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200E\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u214F\u2160-\u2188\u2336-\u237A\u2395\u249C-\u24E9\u26AC\u2800-\u28FF\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D70\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u302E\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u3190-\u31BA\u31F0-\u321C\u3220-\u324F\u3260-\u327B\u327F-\u32B0\u32C0-\u32CB\u32D0-\u32FE\u3300-\u3376\u337B-\u33DD\u33E0-\u33FE\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA60C\uA610-\uA62B\uA640-\uA66E\uA680-\uA69D\uA6A0-\uA6EF\uA6F2-\uA6F7\uA722-\uA787\uA789-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA824\uA827\uA830-\uA837\uA840-\uA873\uA880-\uA8C3\uA8CE-\uA8D9\uA8F2-\uA8FD\uA900-\uA925\uA92E-\uA946\uA952\uA953\uA95F-\uA97C\uA983-\uA9B2\uA9B4\uA9B5\uA9BA\uA9BB\uA9BD-\uA9CD\uA9CF-\uA9D9\uA9DE-\uA9E4\uA9E6-\uA9FE\uAA00-\uAA28\uAA2F\uAA30\uAA33\uAA34\uAA40-\uAA42\uAA44-\uAA4B\uAA4D\uAA50-\uAA59\uAA5C-\uAA7B\uAA7D-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAAEB\uAAEE-\uAAF5\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB65\uAB70-\uABE4\uABE6\uABE7\uABE9-\uABEC\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uE000-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD00\uDD02\uDD07-\uDD33\uDD37-\uDD3F\uDD8D\uDD8E\uDDD0-\uDDFC\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF23\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDF9F-\uDFC3\uDFC8-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDD6F\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD804[\uDC00\uDC02-\uDC37\uDC47-\uDC4D\uDC66-\uDC6F\uDC82-\uDCB2\uDCB7\uDCB8\uDCBB-\uDCC1\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD03-\uDD26\uDD2C\uDD36-\uDD43\uDD50-\uDD72\uDD74-\uDD76\uDD82-\uDDB5\uDDBF-\uDDC9\uDDCD\uDDD0-\uDDDF\uDDE1-\uDDF4\uDE00-\uDE11\uDE13-\uDE2E\uDE32\uDE33\uDE35\uDE38-\uDE3D\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA9\uDEB0-\uDEDE\uDEE0-\uDEE2\uDEF0-\uDEF9\uDF02\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D-\uDF3F\uDF41-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63]|\uD805[\uDC00-\uDC37\uDC40\uDC41\uDC45\uDC47-\uDC59\uDC5B\uDC5D\uDC80-\uDCB2\uDCB9\uDCBB-\uDCBE\uDCC1\uDCC4-\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB1\uDDB8-\uDDBB\uDDBE\uDDC1-\uDDDB\uDE00-\uDE32\uDE3B\uDE3C\uDE3E\uDE41-\uDE44\uDE50-\uDE59\uDE80-\uDEAA\uDEAC\uDEAE\uDEAF\uDEB6\uDEC0-\uDEC9\uDF00-\uDF19\uDF20\uDF21\uDF26\uDF30-\uDF3F]|\uD806[\uDCA0-\uDCF2\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2F\uDC3E-\uDC45\uDC50-\uDC6C\uDC70-\uDC8F\uDCA9\uDCB1\uDCB4]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC70-\uDC74\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uDB80-\uDBBE\uDBC0-\uDBFE][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDE6E\uDE6F\uDED0-\uDEED\uDEF5\uDF00-\uDF2F\uDF37-\uDF45\uDF50-\uDF59\uDF5B-\uDF61\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF93-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9C\uDC9F]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD66\uDD6A-\uDD72\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDE8\uDF60-\uDF71]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEDA\uDEDC-\uDF14\uDF16-\uDF4E\uDF50-\uDF88\uDF8A-\uDFC2\uDFC4-\uDFCB]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85-\uDE8B]|\uD83C[\uDD10-\uDD2E\uDD30-\uDD69\uDD70-\uDDAC\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|[\uDBBF\uDBFF][\uDC00-\uDFFD]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/
},{}],11:[function(require,module,exports){
module.exports=/\u202A/
},{}],12:[function(require,module,exports){
module.exports=/\u2066/
},{}],13:[function(require,module,exports){
module.exports=/\u202D/
},{}],14:[function(require,module,exports){
module.exports=/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D4-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CCC\u0CCD\u0CE2\u0CE3\u0D01\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA8C4\uA8C5\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD804[\uDC01\uDC38-\uDC46\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDCA-\uDDCC\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDE3E\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC38-\uDC3F\uDC42-\uDC44\uDC46\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D-\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD807[\uDC30-\uDC36\uDC38-\uDC3D\uDC92-\uDCA7\uDCAA-\uDCB0\uDCB2\uDCB3\uDCB5\uDCB6]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF8F-\uDF92]|\uD82F[\uDC9D\uDC9E]|\uD834[\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDCD0-\uDCD6\uDD44-\uDD4A]|\uDB40[\uDD00-\uDDEF]/
},{}],15:[function(require,module,exports){
module.exports=/[!"&-\*;-@\[-`\{-~\xA1\xA6-\xA9\xAB\xAC\xAE\xAF\xB4\xB6-\xB8\xBB-\xBF\xD7\xF7\u02B9\u02BA\u02C2-\u02CF\u02D2-\u02DF\u02E5-\u02ED\u02EF-\u02FF\u0374\u0375\u037E\u0384\u0385\u0387\u03F6\u058A\u058D\u058E\u0606\u0607\u060E\u060F\u06DE\u06E9\u07F6-\u07F9\u0BF3-\u0BF8\u0BFA\u0C78-\u0C7E\u0F3A-\u0F3D\u1390-\u1399\u1400\u169B\u169C\u17F0-\u17F9\u1800-\u180A\u1940\u1944\u1945\u19DE-\u19FF\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2010-\u2027\u2035-\u2043\u2045-\u205E\u207C-\u207E\u208C-\u208E\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u213A\u213B\u2140-\u2144\u214A-\u214D\u2150-\u215F\u2189-\u218B\u2190-\u2211\u2214-\u2335\u237B-\u2394\u2396-\u23FE\u2400-\u2426\u2440-\u244A\u2460-\u2487\u24EA-\u26AB\u26AD-\u27FF\u2900-\u2B73\u2B76-\u2B95\u2B98-\u2BB9\u2BBD-\u2BC8\u2BCA-\u2BD1\u2BEC-\u2BEF\u2CE5-\u2CEA\u2CF9-\u2CFF\u2E00-\u2E44\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFB\u3001-\u3004\u3008-\u3020\u3030\u3036\u3037\u303D-\u303F\u309B\u309C\u30A0\u30FB\u31C0-\u31E3\u321D\u321E\u3250-\u325F\u327C-\u327E\u32B1-\u32BF\u32CC-\u32CF\u3377-\u337A\u33DE\u33DF\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA60D-\uA60F\uA673\uA67E\uA67F\uA700-\uA721\uA788\uA828-\uA82B\uA874-\uA877\uFD3E\uFD3F\uFDFD\uFE10-\uFE19\uFE30-\uFE4F\uFE51\uFE54\uFE56-\uFE5E\uFE60\uFE61\uFE64-\uFE66\uFE68\uFE6B\uFF01\uFF02\uFF06-\uFF0A\uFF1B-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFFE2-\uFFE4\uFFE8-\uFFEE\uFFF9-\uFFFD]|\uD800[\uDD01\uDD40-\uDD8C\uDD90-\uDD9B\uDDA0]|\uD802[\uDD1F\uDF39-\uDF3F]|\uD804[\uDC52-\uDC65]|\uD805[\uDE60-\uDE6C]|\uD834[\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEDB\uDF15\uDF4F\uDF89\uDFC3]|\uD83B[\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0B\uDD0C\uDD6A\uDD6B\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED2\uDEE0-\uDEEC\uDEF0-\uDEF6\uDF00-\uDF73\uDF80-\uDFD4]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDD10-\uDD1E\uDD20-\uDD27\uDD30\uDD33-\uDD3E\uDD40-\uDD4B\uDD50-\uDD5E\uDD80-\uDD91\uDDC0]/
},{}],16:[function(require,module,exports){
module.exports=/[\n\r\x1C-\x1E\x85\u2029]/
},{}],17:[function(require,module,exports){
module.exports=/\u202C/
},{}],18:[function(require,module,exports){
module.exports=/\u2069/
},{}],19:[function(require,module,exports){
module.exports=/[\u05BE\u05C0\u05C3\u05C6\u05D0-\u05EA\u05F0-\u05F4\u07C0-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0830-\u083E\u0840-\u0858\u085E\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFB4F]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC57-\uDC9E\uDCA7-\uDCAF\uDCE0-\uDCF2\uDCF4\uDCF5\uDCFB-\uDD1B\uDD20-\uDD39\uDD3F\uDD80-\uDDB7\uDDBC-\uDDCF\uDDD2-\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE40-\uDE47\uDE50-\uDE58\uDE60-\uDE9F\uDEC0-\uDEE4\uDEEB-\uDEF6\uDF00-\uDF35\uDF40-\uDF55\uDF58-\uDF72\uDF78-\uDF91\uDF99-\uDF9C\uDFA9-\uDFAF]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2\uDCFA-\uDCFF]|\uD83A[\uDC00-\uDCC4\uDCC7-\uDCCF\uDD00-\uDD43\uDD50-\uDD59\uDD5E\uDD5F]/
},{}],20:[function(require,module,exports){
module.exports=/\u202B/
},{}],21:[function(require,module,exports){
module.exports=/\u2067/
},{}],22:[function(require,module,exports){
module.exports=/\u202E/
},{}],23:[function(require,module,exports){
module.exports=/[\t\x0B\x1F]/
},{}],24:[function(require,module,exports){
module.exports=/[\f \u1680\u2000-\u200A\u2028\u205F\u3000]/
},{}],25:[function(require,module,exports){
'use strict';

// begin regex imports
var al = require('unicode-9.0.0/Bidi_Class/Arabic_Letter/regex');
var an = require('unicode-9.0.0/Bidi_Class/Arabic_Number/regex');
var bn = require('unicode-9.0.0/Bidi_Class/Boundary_Neutral/regex');
var cs = require('unicode-9.0.0/Bidi_Class/Common_Separator/regex');
var en = require('unicode-9.0.0/Bidi_Class/European_Number/regex');
var es = require('unicode-9.0.0/Bidi_Class/European_Separator/regex');
var et = require('unicode-9.0.0/Bidi_Class/European_Terminator/regex');
var fsi = require('unicode-9.0.0/Bidi_Class/First_Strong_Isolate/regex');
var l = require('unicode-9.0.0/Bidi_Class/Left_To_Right/regex');
var lre = require('unicode-9.0.0/Bidi_Class/Left_To_Right_Embedding/regex');
var lri = require('unicode-9.0.0/Bidi_Class/Left_To_Right_Isolate/regex');
var lro = require('unicode-9.0.0/Bidi_Class/Left_To_Right_Override/regex');
var nsm = require('unicode-9.0.0/Bidi_Class/Nonspacing_Mark/regex');
var on = require('unicode-9.0.0/Bidi_Class/Other_Neutral/regex');
var b = require('unicode-9.0.0/Bidi_Class/Paragraph_Separator/regex');
var pdf = require('unicode-9.0.0/Bidi_Class/Pop_Directional_Format/regex');
var pdi = require('unicode-9.0.0/Bidi_Class/Pop_Directional_Isolate/regex');
var r = require('unicode-9.0.0/Bidi_Class/Right_To_Left/regex');
var rle = require('unicode-9.0.0/Bidi_Class/Right_To_Left_Embedding/regex');
var rli = require('unicode-9.0.0/Bidi_Class/Right_To_Left_Isolate/regex');
var rlo = require('unicode-9.0.0/Bidi_Class/Right_To_Left_Override/regex');
var s = require('unicode-9.0.0/Bidi_Class/Segment_Separator/regex');
var ws = require('unicode-9.0.0/Bidi_Class/White_Space/regex');
// end regex imports

var punycode = require('punycode');

var regexes = {
  'AL': al,
  'AN': an,
  'BN': bn,
  'CS': cs,
  'EN': en,
  'ES': es,
  'ET': et,
  'FSI': fsi,
  'L': l,
  'LRE': lre,
  'LRI': lri,
  'LRO': lro,
  'NSM': nsm,
  'ON': on,
  'B': b,
  'PDF': pdf,
  'PDI': pdi,
  'R': r,
  'RLE': rle,
  'RLI': rli,
  'RLO': rlo,
  'S': s,
  'WS': ws
};

function lookup(codepoint) {
  var encoding = punycode.ucs2.encode([codepoint]);
  var name;
  for (name in regexes) {
    if (regexes[name].test(encoding) === true) {
      return name;
    }
  }
  return undefined;
}

module.exports = lookup;

},{"punycode":1,"unicode-9.0.0/Bidi_Class/Arabic_Letter/regex":2,"unicode-9.0.0/Bidi_Class/Arabic_Number/regex":3,"unicode-9.0.0/Bidi_Class/Boundary_Neutral/regex":4,"unicode-9.0.0/Bidi_Class/Common_Separator/regex":5,"unicode-9.0.0/Bidi_Class/European_Number/regex":6,"unicode-9.0.0/Bidi_Class/European_Separator/regex":7,"unicode-9.0.0/Bidi_Class/European_Terminator/regex":8,"unicode-9.0.0/Bidi_Class/First_Strong_Isolate/regex":9,"unicode-9.0.0/Bidi_Class/Left_To_Right/regex":10,"unicode-9.0.0/Bidi_Class/Left_To_Right_Embedding/regex":11,"unicode-9.0.0/Bidi_Class/Left_To_Right_Isolate/regex":12,"unicode-9.0.0/Bidi_Class/Left_To_Right_Override/regex":13,"unicode-9.0.0/Bidi_Class/Nonspacing_Mark/regex":14,"unicode-9.0.0/Bidi_Class/Other_Neutral/regex":15,"unicode-9.0.0/Bidi_Class/Paragraph_Separator/regex":16,"unicode-9.0.0/Bidi_Class/Pop_Directional_Format/regex":17,"unicode-9.0.0/Bidi_Class/Pop_Directional_Isolate/regex":18,"unicode-9.0.0/Bidi_Class/Right_To_Left/regex":19,"unicode-9.0.0/Bidi_Class/Right_To_Left_Embedding/regex":20,"unicode-9.0.0/Bidi_Class/Right_To_Left_Isolate/regex":21,"unicode-9.0.0/Bidi_Class/Right_To_Left_Override/regex":22,"unicode-9.0.0/Bidi_Class/Segment_Separator/regex":23,"unicode-9.0.0/Bidi_Class/White_Space/regex":24}]},{},[25])(25)
});
/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5)))

/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(module, global) {var __WEBPACK_AMD_DEFINE_RESULT__;/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		true
	) {
		!(__WEBPACK_AMD_DEFINE_RESULT__ = (function() {
			return punycode;
		}).call(exports, __webpack_require__, exports, module),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(52)(module), __webpack_require__(5)))

/***/ }),
/* 52 */
/***/ (function(module, exports) {

module.exports = function(module) {
	if(!module.webpackPolyfill) {
		module.deprecate = function() {};
		module.paths = [];
		// module.parent = undefined by default
		if(!module.children) module.children = [];
		Object.defineProperty(module, "loaded", {
			enumerable: true,
			get: function() {
				return module.l;
			}
		});
		Object.defineProperty(module, "id", {
			enumerable: true,
			get: function() {
				return module.i;
			}
		});
		module.webpackPolyfill = 1;
	}
	return module;
};


/***/ }),
/* 53 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_unicode_9_0_0_Bidi_Mirroring_Glyph__ = __webpack_require__(16);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_unicode_9_0_0_Bidi_Mirroring_Glyph___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_0_unicode_9_0_0_Bidi_Mirroring_Glyph__);


// L4. "A character is depicted by a mirrored glyph if and only if
// (a) the resolved directionality of that character is R, and
// (b) the Bidi_Mirrored property value of that character is Yes."
function mirror(codepoints, levels) {
  return codepoints.map((codepoint, index) => {
    const mirroring = __WEBPACK_IMPORTED_MODULE_0_unicode_9_0_0_Bidi_Mirroring_Glyph___default.a.get(codepoint); // (b)
    const mirroredIsYes = (mirroring !== undefined);
    const directionIsR = (levels.get(index) % 2 === 1);
    return (mirroredIsYes && directionIsR) ? mirroring.charCodeAt(0) : codepoint;
  });
}

/* harmony default export */ __webpack_exports__["a"] = (mirror);


/***/ })
/******/ ]);
});
