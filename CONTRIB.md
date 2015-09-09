# CONTRIBUTING

# HOW TO CONTRIBUTE

1. Complete the [Contributor License Agreement](https://docs.google.com/a/playcanvas.com/forms/d/1Ih69zQfJG-QDLIEpHr6CsaAs6fPORNOVnMv5nuo0cjk/viewform).
1. Read the coding standards below
1. Make a pull request

#### Tips

Feel free to contribute bug fixes or documentation fixes directly into a pull request. If you are making major changes to the engine or adding significant new features. It would be best to create an github issue before starting work to begin a conversation about how best to implement it.

# CODING STANDARDS

## General

These coding standards are based on the [Google Javascript Coding Standards](https://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml). If something is not defined here, use this guide as a backup.

### Use International/American English spelling in all code

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

### Use spaces in preference to tabs

Ensure that your editor of choice is set up to insert '4 spaces' for every press of the Tab key.  Different browsers have different tab lengths and a mixture of tabs and spaces for indentation can create ugly results.

### Remove all trailing spaces

Set your text editor to remove trailing spaces on save

### Use spaces between operators

```javascript
for (var i = 0, len = list.length; i < len; i++) {
    // ...
}
```

### Leave a space after the function keyword for anonymous functions
```javascript
var fn = function () {
};
```

### No semicolon on closing function brace

Semicolons are not needed to delimit the ends of functions. Follow the convention below:

```javascript
function class() {
} // Note the lack of semicolon here
```

Semicolons *are* needed if you're function is declared as a variable

```javascript
var fn = function () {
}; // Note the semicolon here
```

### Use Object Notation where possible
```javascript
var NameSpace = function () {

    // Private variables

    // Public interface
    return {

        arrive : function () {
            console.write("Hello");
        },

        depart : function () {
            console.write("Goodbye");
        }
    }
}
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

function loop() {
    var i = 100;

    for(var i = 0; i < 100; ++i) { // Don't do this. The same i var as declared at the top
    }
}
```

## Naming

### Capitalization

```javascript
// Namespace should have short lowercase names
var namespace = {};

// Classes (or rather Constructors) should be CamelCase
var MyClass = function () {};

// Variables should be mixedCase
var mixedCase = 1;

// Function are usually variables so should be mixedCase
// ( unless they are class constructors )
var myFunction = function () {};

// Constants should be ALL_CAPITALS separated by underscores.
// Note, javascript doesn't support constants in a cross-browser fashion,
// so this is just convention.
var THIS_IS_CONSTANT = "well, kind of";

// Private variables should start with a leading underscore.
// Note, you should attempt to make private variables actually private using
// a closure.
var _private = "private";
var _privateFn = function () {};
```

### Acronyms should not be upper-case, they should follow coding standards

Treat acronyms like a normal word. e.g.

```javascript
var json = ""; // not var JSON = "";
var id = 1; // not var ID = "";

function getId() {}; // not getID()
function loadJson() {}; // not loadJSON();

new HttpObject(); // not new HTTPObject();
```

### Use common callback names: 'success', 'error', ( possibly 'callback')

```javascript
function asyncFunction( success, error ) {
  // do something
}

function asyncFunction( success ) {
  // do something
}

function asyncFunction( callback ) {
  // do something

}
```

### Cache the 'this' reference as 'self'

It is often useful to be able to cache the 'this' object to get around the scoping behavior of Javascript. If you need to do this, cache it in a variable called 'self'.

```javascript
var self = this;
```

## Privacy

### Make variables private using closures if possible

Hide variables that should not be accessible using a closure

```javascript
var Class = function () {
    var _a = "private";

    this.getA() { return a; }
}
```

## Object Member Iteration

The hasOwnProperty() function should be used when iterating over an object's members. This is to avoid accidentally picking up unintended members that may have been added to the object's prototype. For example:

```javascript
for (var key in values) {
    if (values.hasOwnProperty(key)) {
        doStuff(values[key]);
    }
}
```

## Source files

### Filenames should contain the namespace and the class name

Filenames should be all lower case with words separated by underscores.
The usual format should be {{{namespace_class.js}}}

e.g.
```javascript
math_matrix.js
scene_graphnode.js
```

## Namespaces and Classes

### Namespace with variables and functions

Create namespaces using a function so that you can expose a public interface and have private functions.

```javascript
var namespace = function () {
    // Private
    function privateFn() {
    };

    // Public interface
    return {
        publicVar: "public",
        publicFn: function () {
            privateFn();
        }
    };
}();
```

### Namespace with a class

Class constructors are declared in the same way as public functions. Use `pc.inherits` to derive from a base class and use `pc.extends` to extend the prototype with new methods.

Only declare one Class per file.

```javascript
var namespace = function () {
    var Class = function () {
            var _private = "private";
            this.accessor = function () {
                return _private;
            };
        }
    };
    Class = pc.inherits(Class, Base);

    pc.extends(Class.prototype, {
        derivedFn: function () {
        }
    });

    return {
        Class: Class
    };
}();
```

### Namespace with variables, functions and classes

Private functions and variables should be declared inside the namespace.

Public functions and variables should be returned from the function that creates the namespace.

```javascript
var namespace = function () {
    // private
    function privateFn () {}

    // public interface
    var Class = function () {
    };
    Class = pc.inherits(Class, Base);

    // public prototype functions
    pc.extends(Class.prototype, {
        derivedFn: function () {
        }
    });

    return {
        publicVar: "public",
        publicFn: function () { return "public function"; },
        Class: Class
    };
}();
```


### Adding to an existing namespace

Use library function pc.extend to add additional Classes, methods and variables on to an existing namespace

```javascript
pc.extend(namespace, function() {
    var Class = function () {
    };
    Class = pc.inherits(Class, Base);

    Class.prototype.derivedFn = function () {
    };

    return {
        Class: Class
    };
} ());
```
