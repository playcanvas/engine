# Contributing to the PlayCanvas Engine

Welcome! We're excited that you want to contribute to PlayCanvas. This guide will help you get started, whether you're fixing a typo or adding a major feature.

## Table of Contents
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Testing Your Changes](#testing-your-changes)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Need Help?](#need-help)
- [Coding Standards](#coding-standards)

## Quick Start

For **simple bug fixes or documentation updates**:

1. Fork the repository
2. Create a branch: `git checkout -b fix-issue-123`
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

For **larger changes or new features**, please read the full guidelines below and consider opening an issue first to discuss your approach.

## Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/engine.git
   cd engine
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

4. **Build the engine** (optional, for testing):
   ```bash
   npm run build
   ```

## How to Contribute

1. Looking for ideas? Check out ["good first PR"](https://github.com/playcanvas/engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+PR%22) label.
2. Or start a conversation in [Issues](https://github.com/playcanvas/engine/issues) to get help and advice from community on PR ideas.
3. Read the coding standards below.
4. Keep PR simple and focused - one PR per feature.
5. Make a Pull Request.
6. Happy Days! 🎉

#### Tips

Feel free to contribute bug fixes or documentation fixes as pull request.

If you are looking for ideas what to work on, head to [Issues](https://github.com/playcanvas/engine/issues) and checkout out open tickets or start a conversation. It is best to start conversation if you are going to make major changes to the engine or add significant features to get advice on how to approach it. [Forum](http://forum.playcanvas.com/) is good place to have a chat with community as well.

Try to keep PR focused on a single feature, small PR's are easier to review and will get merged faster. Too large PR's are better be broken into smaller ones so they can be merged and tested on its own.

## Testing Your Changes

PlayCanvas uses [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) for unit testing.

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage
```

### Writing Tests
- **Add tests for new features** - Write unit tests that prove your feature works
- **Update existing tests** - Modify tests when changing existing behavior
- **Test browser compatibility** - Ensure your changes work across target browsers
- **Test with examples** - Check that relevant examples still work

### Test Guidelines
- Place test files in the `test/` directory mirroring the source structure
- Use `.test.mjs` extension for test files
- Follow the existing test patterns and naming conventions
- See [test/README.md](test/README.md) for detailed testing documentation

## Submitting Pull Requests

1. **Create a focused PR** - One feature or fix per pull request
2. **Write a clear description** - Explain what changes and why
3. **Reference issues** - Link to related issues with "Fixes #123"
4. **Test thoroughly** - Ensure tests pass and no regressions
5. **Follow code standards** - See detailed guidelines below
6. **Be patient** - Reviews take time, especially for complex changes

### Git Workflow
- Create feature branches from `main`: `git checkout -b feature-name`
- Use clear commit messages describing what changed
- Keep commits focused and atomic when possible
- Rebase/squash if requested during review

## Need Help?

- **Questions about contributing?** Open a [Discussion](https://github.com/playcanvas/engine/discussions)
- **Found a bug?** Check existing [Issues](https://github.com/playcanvas/engine/issues) first
- **Want to chat?** Visit the [PlayCanvas Forum](http://forum.playcanvas.com/)
- **Looking for ideas?** Check ["good first PR"](https://github.com/playcanvas/engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+PR%22) issues

## Coding Standards

### General

Our coding standards are derived from established JavaScript best practices. We support modern JavaScript features (ES6+) as listed below, targeting current browser versions.

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
* [`static` keyword](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static)
* [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
* [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
* [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)

### Opening braces should be on the same line as the statement

For example:
```javascript
// Notice there is no new line before the opening brace
function inc() {
    x++;
}
```

Also use the following style for `if` statements:
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

### Naming

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
let myFunction = () => { };

// Constants should be ALL_CAPITALS separated by underscores.
// Note, ES5 doesn't support constants,
// so this is just convention.
const THIS_IS_CONSTANT = "well, kind of";

// Enum constants follow similar rules as normal constants. In general,
// the enum consists of the type, and its values.
// In other languages, this is implemented as
// enum CubeFace {
//     PosX: 0,
//     PosY: 1
// }
// Due to the lack of native enum support by JavaScript, the enums are
// represented by constants. The constant name contains the enum name without
// the underscores, followed by the values with optional underscores as
// needed to improve the readability. This is one possible implementation:
const CUBEFACE_POSX = 0;
const CUBEFACE_POSY = 1;
// and this is also acceptable
const CUBEFACE_POS_X = 0;
const CUBEFACE_POS_Y = 1;

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


### Privacy

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

### Object Member Iteration

The hasOwnProperty() function should be used when iterating over an object's members. This is to avoid accidentally picking up unintended members that may have been added to the object's prototype. For example:

```javascript
for (let key in values) {
    if (! values.hasOwnProperty(key))
        continue;

    doStuff(values[key]);
}
```

### Source files

### Filenames should contain only class name

Filenames should be all lower case with words separated by dashes.
The usual format should be {{{file-name.js}}}

e.g.
```javascript
asset-registry.js
graph-node.js
```

### Namespaces and Classes (ES6)

The entire PlayCanvas API must be declared under the `pc` namespace. This is handled by build script, so ES6 notation of `import`/`export` should be used. The vast majority of the PlayCanvas codebase is made up of `class` definitions. These have the following structure (which should be adhered to):

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
        // if method is overridden
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
