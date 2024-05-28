# Unit Tests

PlayCanvas uses [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) for unit testing. All tests run in Node and load the engine's source modules directly. This means that building the engine is not a requirement for running the tests. Node is missing some features required by the engine so a couple of mocks are used:

* [`canvas-mock`](https://github.com/playcanvas/canvas-mock) - implements `HTMLCanvasElement` (and `WebGL 1.0`).
* [`xhr2`](https://github.com/pwnall/node-xhr2) - implements `XMLHttpRequest`.

## Running the Unit Tests

To run the tests, simply do:

```
npm run test
```

## Code Coverage

PlayCanvas uses [C8](https://github.com/bcoe/c8) to analyze and report unit test code coverage. To print a code coverage report, do:

```
npm run test:coverage
```

## Writing Tests

The PlayCanvas Engine is made up of ES Modules. Each module should have a corresponding unit test module. For example:

```
/src/core/math/vec3.js
```

...has the corresponding unit test module:

```
/test/core/math/vec3.test.mjs
```

In short, for any given engine source module:

1. Create a file in the corresponding path under `test`.
2. Replace `.js` with `.test.mjs` (the `.mjs` extension informs Node that the file is an ES Module).

Test module code should adhere to the following style:

```javascript
import { SomeClass } from '../../src/path/to/some-class.js';

import { expect } from 'chai';

describe('SomeClass', function () {

    describe('#someProperty', function () {

        it('does something', function () {
            // test code
        });

        it('does something else', function () {
            // test code
        });

    });

    describe('#constructor()', function () {

        // more tests

    });

    describe('#someFunc()', function () {

        // more tests

    });

});
```

Some tips:

* Group properties, then the constructor and then member functions in the test module.
* Alphabetize the API described in the test module (as it appears in the [API reference manual](https://developer.playcanvas.com/api/)).
* [Avoid using arrow functions](https://mochajs.org/#arrow-functions) for `describe` and `it` calls.
* Try to make the call to `it` read as a proper sentence:
  * Good: `it('returns null on failure', ...`
  * Bad: `it('null is returned', ...`

## Debugging Tests

Debugging tests is easy, convenient and fun! VS Code is the recommended IDE for debugging the tests. All you need to do is:

1. Open the root folder of your clone of the PlayCanvas Engine repo.
2. Select the Explorer panel (top icon in the left-hand vertical toolbar).
3. Navigate to the test you want to debug and set a breakpoint.
4. At the bottom of the Explorer panel, you'll find a sub-panel called NPM Scripts. Locate script `test` and click the Debug button.
   * If you don't see NPM Scripts sub-panel, right click any visible sub-panels and select NPM Scripts from the drop-down menu.

## Help Us Reach 100% Coverage

Any contributions to the unit tests are very welcome! If you can see ways to improve them, feel free to open an issue to announce what you would like to do and then submit a PR.
