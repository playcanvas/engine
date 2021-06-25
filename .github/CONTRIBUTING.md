# CONTRIBUTING

# HOW TO CONTRIBUTE

1. Looking for ideas? Check out ["good first PR"](https://github.com/playcanvas/engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+PR%22) label.
2. Or start a conversation in [Issues](https://github.com/playcanvas/engine/issues) to get help and advice from community on PR ideas.
3. Read the coding standards below.
4. Keep PR simple and focused - one PR per feature.
5. Make a Pull Request.
6. Complete the [Contributor License Agreement](https://docs.google.com/a/playcanvas.com/forms/d/1Ih69zQfJG-QDLIEpHr6CsaAs6fPORNOVnMv5nuo0cjk/viewform).
7. Happy Days! 🎉

#### Tips

Feel free to contribute bug fixes or documentation fixes as pull request.

If you are looking for ideas what to work on, head to [Issues](https://github.com/playcanvas/engine/issues) and checkout out open tickets or start a conversation. It is best to start conversation if you are going to make major changes to the engine or add significant features to get advice on how to approach it. [Forum](http://forum.playcanvas.com/) is good place to have a chat with community as well.

Try to keep PR focused on a single feature, small PR's are easier to review and will get merged faster. Too large PR's are better be broken into smaller ones so they can be merged and tested on its own.

# CODING STANDARDS

## General

Our coding standards are derived from the [Google JavaScript Coding Standards](https://google.github.io/styleguide/javascriptguide.xml) which are based on ES5 (ECMA2009). Also we have a whitelist of modern JavaScript features (ES6+), explicitly listed below.

### Keep it simple

Simple code is always better. Modular (horizontal dependencies) code is easier to extend and work with, than with vertical dependencies.

### Use International/American English spelling

For example, use "Initialize" instead of "Initialise", and "color" instead of "colour".

### Permitted ES6+ features:

You may use the following JavaScript language features in the engine codebase:

* [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)
* [`const`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)
* [`for of` loops](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of)
* [Arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
* [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)
* [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters)
* [Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
* [Optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
* [Static keyword](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static)
* [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)

### Opening braces should be on the same line as the statement

For example:
```javascript
// Notice there is no new line before the opening brace
function inc() {
    x++;
}
```

Also use the following style for 'if' statements:
```javascript
if (test) {
    // do something
} else {
    // do something else
}
```

If condition with body is small and is two-liner, can avoid using braces:
```javascript
if (test === 0)
    then();
```

### Use spaces in preference to tabs

Ensure that your IDE of choice is set up to insert '4 spaces' for every press of the Tab key and replaces tabs with spaces on save. Different browsers have different tab lengths and a mixture of tabs and spaces for indentation can create funky results.

### Remove all trailing spaces and ending line

On save, set your text editor to remove trailing spaces and ensure there is an empty line at the end of the file.

### Use spaces between operators

```javascript
let foo = 16 + 32 / 4;

for (let i = 0; i < list.length; i++) {
    // ...
}
```

### Leave a space after the function keyword for anonymous functions
```javascript
let fn = function () {

};
```

### No spaces between () brackets
```javascript
foo();
bar(1, 2);
```

### Use spaces between [ ] and { } brackets, unless they are empty
```javascript
let a = {};
let b = { key: 'value' };
let c = [];
let d = [ 32, 64 ];
```

### `let` and `const` instead of `var` (ES6)

```javascript
for (let i = 0; i < items.length; i++) {
    const item = items[i];
}

var a = 10; // not good
```

### For of loop (ES6)
```javascript
// ok
for (let i = 0; i < items.length; i++) {
    const item = items[i];
}

// more readable but generally slower
for (const item of items) {

}
```

### Exit logic early

In functions exit early to simplify logic flow and avoid building indention-hell:
```javascript
let foo = function (bar) {
    if (! bar)
        return;

    return bar + 32;
};
```

Same for iterators:
```javascript
for (let i = 0; i < items.length; i++) {
    if (! items[i].test)
        continue;

    items[i].bar();
}
```

## Naming

### Capitalization

```javascript
// Namespace should have short lowercase names
let namespace = { };

// Classes should be CamelCase
class MyClass { }

// Variables should be mixedCase
let mixedCase = 1;

// Function are usually variables so should be mixedCase
// (unless they are class constructors)
let myFunction = function () { };

// Constants should be ALL_CAPITALS separated by underscores.
// Note, ES5 doesn't support constants,
// so this is just convention.
const THIS_IS_CONSTANT = "well, kind of";

// Private variables should start with a leading underscore.
// Note, you should attempt to make private variables actually private using
// a closure.
let _private = "private";
let _privateFn = function () { };
```

### Acronyms should not be upper-case, they should follow coding standards

Treat acronyms like a normal word. e.g.
```javascript
let json = ""; // not "JSON";
let id = 1; // not "ID";

function getId() { }; // not "getID"
function loadJson() { }; // not "loadJSON"

new HttpObject(); // not "HTTPObject";
```

### Use common callback names: 'success', 'error', (possibly 'callback')
```javascript
function asyncFunction(success, error) {
  // do something
}
```
```javascript
function asyncFunction(success) {
  // do something
}
```
```javascript
function asyncFunction(callback) {
  // do something
}
```

### Cache the 'this' reference as 'self'

It is often useful to be able to cache the 'this' object to get around the scoping behavior of JavaScript. If you need to do this, cache it in a variable called 'self'.

```javascript
let self = this;
```

### Avoid using function.bind(scope)

```javascript
setTimeout(function() {
    this.foo();
}.bind(this)); // don't do this
```

Instead use `self` reference in upper scope:
```javascript
let self = this;
setTimeout(function() {
    self.foo();
});
```

### Default function parameters (ES6)

Use this notation for function default parameters:
```javascript
// good
function foo(a, b = 10) {
    return a + b;
}

// not good
function foo(a, b) {
    if (b === undefined)
        b = 10;
    return a + b;
}
```


## Privacy

### Make variables private if used only internally

Variables that should be accessible only within class should start with `_`:
```javascript
class Item {
    constructor() {
        this._a = "private";
    }

    bar() {
        this._a += "!";
    }
}

let foo = new Item();
foo._a += "?"; // not good
```

## Object Member Iteration

The hasOwnProperty() function should be used when iterating over an object's members. This is to avoid accidentally picking up unintended members that may have been added to the object's prototype. For example:

```javascript
for (let key in values) {
    if (! values.hasOwnProperty(key))
        continue;

    doStuff(values[key]);
}
```

## Source files

### Filenames should contain only class name

Filenames should be all lower case with words separated by dashes.
The usual format should be {{{file-name.js}}}

e.g.
```javascript
asset-registry.js
graph-node.js
```

## Namespaces and Classes (ES6)

The entire PlayCanvas API must be declared under the ```pc``` namespace. This is handled by build script, so ES6 notation of `import`/`export` should be used. The vast majority of the PlayCanvas codebase is made up of `class` definitions. These have the following structure (which should be adhered to):

```javascript
class Class {
    someFunc(x) { }
}

export { Class };
```

You can also extend existing classes:

```javascript
import { Class } from './class.js';

class SubClass extends Class {
    constructor() {
        // call parent class constructor
        super();
    }

    someFunc(x) {
        // if method is overriden
        // this is the way to call parent class method
        super.someFunc(x);
    }
}

export { SubClass };
```

Use `class` instead of `prototype` for defining Classes:

```javascript
// good
class Class {
    someFunc() { }
}

// not good
function Class() { }
Class.prototype.someFunc = function() { };
```
