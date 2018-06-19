# CONTRIBUTING

# HOW TO CONTRIBUTE

1. Looking for ideas? Check out ["good first PR"](https://github.com/playcanvas/engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+PR%22) label.
2. Or start a conversation in [Issues](https://github.com/playcanvas/engine/issues) to get help and advice from community on PR ideas.
3. Read the coding standards below.
4. Keep PR simple and focused - one PR per feature.
5. Make a Pull Request.
6. Complete the [Contributor License Agreement](https://docs.google.com/a/playcanvas.com/forms/d/1Ih69zQfJG-QDLIEpHr6CsaAs6fPORNOVnMv5nuo0cjk/viewform).
7. Happy Days! :)

#### Tips

Feel free to contribute bug fixes or documentation fixes as pull request.

If you are looking for ideas what to work on, head to [Issues](https://github.com/playcanvas/engine/issues) and checkout out open tickets or start a conversation. It is best to start conversation if you are going to make major changes to the engine or add significant features to get advice on how to approach it. [Forum](http://forum.playcanvas.com/) is good place to have a chat with community as well.

Try to keep PR focused on a single feature, small PR's are easier to review and will get merged faster. Too large PR's are better be broken into smaller ones so they can be merged and tested on its own.

# CODING STANDARDS

## General

These coding standards are based on the [Google JavaScript Coding Standards](https://google.github.io/styleguide/javascriptguide.xml). If something is not defined here, use this guide as a backup.

### Keep it simple

Simple code is always better. Modular (horizontal dependencies) code is easier to extend and work with, than with vertical dependencies.

### Use International/American English spelling

For example, use "Initialize" instead of "Initialise", and "color" instead of "colour".

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
var foo = 16 + 32 / 4;

for (var i = 0, len = list.length; i < len; i++) {
    // ...
}
```

### Leave a space after the function keyword for anonymous functions
```javascript
var fn = function () {

};
```

### No spaces between () brackets
```javascript
foo();
bar(1, 2);
```

### Use spaces between [ ] and { } brackets
```javascript
var a = { };
var b = { key: 'value' };
var c = [ ];
var d = [ 32, 64 ];
```

### No semicolon on closing function brace

Semicolons are not needed to delimit the ends of functions. Follow the convention below:
```javascript
function class() {
} // Note the lack of semicolon here
```

Semicolons **are** needed if you're function is declared as a variable
```javascript
var fn = function () {
}; // Note the semicolon here
```

### Put all variable declarations at the top of functions

Variable declarations should all be placed first or close to the top of functions. This is because variables have a function-level scope.

Variables should be declared one per line.

```javascript
function fn() {
    var a = 0;
    var b = 1;
    var c = 2;
}
```
```javascript
function fn() {
    var i;
    var bar = 0;

    for(i = 0; i < 32; ++i) {
        bar += i;
    }

    for(var i = 0; i < 32; i++) { } // don't do this, as i is already defined
}
```

### Exit logic early

In functions exit early to simplify logic flow and avoid building indention-hell:
```javascript
var foo = function (bar) {
    if (! bar)
        return;

    return bar + 32;
};
```

Same for iterators:
```javascript
for(var i = 0; i < items.length; i++) {
    if (! items[i].test)
        continue;

    items[i].bar();
}
```

## Naming

### Capitalization

```javascript
// Namespace should have short lowercase names
var namespace = { };

// Classes (or rather Constructors) should be CamelCase
var MyClass = function () { };

// Variables should be mixedCase
var mixedCase = 1;

// Function are usually variables so should be mixedCase
// (unless they are class constructors)
var myFunction = function () { };

// Constants should be ALL_CAPITALS separated by underscores.
// Note, ES5 doesn't support constants,
// so this is just convention.
var THIS_IS_CONSTANT = "well, kind of";

// Private variables should start with a leading underscore.
// Note, you should attempt to make private variables actually private using
// a closure.
var _private = "private";
var _privateFn = function () { };
```

### Acronyms should not be upper-case, they should follow coding standards

Treat acronyms like a normal word. e.g.
```javascript
var json = ""; // not "JSON";
var id = 1; // not "ID";

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
var self = this;
```

### Avoid using function.bind(scope)

```javascript
setTimeout(function() {
    this.foo();
}.bind(this)); // don't do this
```

Instead use `self` reference in upper scope:
```javascript
var self = this;
setTimeout(function() {
    self.foo();
});
```

## Privacy

### Make variables private if used only internally

Variables that should be accessible only within class should start with `_`:
```javascript
var Item = function () {
    this._a = "private";
};
Item.prototype.bar = function() {
    this._a += "!";
};

var foo = new Item();
foo._a += "?"; // not good
```

## Object Member Iteration

The hasOwnProperty() function should be used when iterating over an object's members. This is to avoid accidentally picking up unintended members that may have been added to the object's prototype. For example:

```javascript
for (var key in values) {
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

## Namespaces and Classes

The entire PlayCanvas API must be declared under the ```pc``` namespace. The vast majority of the PlayCanvas codebase is made up of 'class' definitions. These have the following structure (which should be adhered to):

```javascript
Object.assign(pc, function() {
    // Closure to define new class

    var Class = function () {
    };

    Object.assign(Class.prototype, {
        someFunc: function () {

        }
    });

    return {
        Class: Class
    };
}());
```

You can also subclass existing classes:

```javascript
Object.assign(pc, function() {
    // Closure to define new class

    var SubClass = function () {
        pc.SuperClass.call(this);
    };

    // optionally can inherit
    SubClass.prototype = Object.create(pc.SuperClass.prototype);
    SubClass.prototype.constructor = SubClass;

    Object.assign(SubClass.prototype, {
        someFunc: function () {
            SuperClass.prototype.someFunc.call(this);
        }
    });

    return {
        SubClass: SubClass
    };
}());
```
