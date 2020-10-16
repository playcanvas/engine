var chai = require("chai");
var path = require("path");
var fs = require("fs");
require("../examples/assemblyscript/Loader");

function describe(name, func) {
    console.log(name);
    func()
}

var counter = 0;
var success = 0;
var error = 0;

function it(name, func) {
    //console.log(name);
    counter++;
    try {
        func();
        success++;
    } catch (e) {
        console.log(name, "failed: ", e)
        error++;
    }
}

global.describe = describe;
global.it = it;

global.expect = chai.expect;

global.strictEqual = function (a, b) {
    expect(a).to.equal(b);
};

global.equal = function (a, b) {
    expect(a).to.equal(b);
}

global.notEqual = function (a, b) {
    expect(a).to.not.equal(b);
}

global.deepEqual = function (a, b) {
    expect(a).to.deep.equal(b);
}

global.ok = function (a) {
    expect(a).to.exist;
}

global.close = function (a, b, e) {
    expect(a).to.be.closeTo(b, e);
}

global.beforeEach = function() {
    
}

global.afterEach = function() {
    
}

global.window = {
    navigator: {
        userAgent: "node"
    }
};

// In scene/test_graphnode:
// var PRODUCTION = __karma__.config.args.includes('--release');
global.__karma__ = {
    config: {
        args: "--release"
    }
}
function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}

async function load_wasm(filename) {
    var wasmFile = fs.readFileSync(path.join(__dirname, filename));
    imports = {};
    //var module = await Loader.instantiateBuffer(wasmFile, imports);
    var module = await Loader.instantiate(wasmFile, imports);
    window.module = module;
    global.assemblyscript = {
        module: module,
        instance: window.instance
    }
    //console.log(module.I8.length);
    // next three lines just test the auto-generated demangled class, which isn't so useful currently
    // this PR might change it: https://github.com/AssemblyScript/assemblyscript/pull/437
    // a = new module.Vec3(1,2,3)
    // b = new module.Vec3(11,22,33)
    // console.log("a.add(b)", a.add(b)); // returns no class but a raw pointer
}

async function main() {
    await load_wasm("../build/optimized_32.wasm");
    window.module.exports.memory.grow((20 * 1024 * 1024 ) / 65536) // can use up to 20mb without regrowth (which invalidates all dataviews)
    //window.module.updateDataViews();
    global.instance = window.instance;
    global.pc = require("../build/playcanvas.assemblyscript_32");
    
    requireUncached("./math/test_mat4")
    requireUncached("./math/test_quat")
    requireUncached("./math/test_vec2")
    requireUncached("./math/test_vec3")
    requireUncached("./math/test_vec4")
    requireUncached("./scene/test_graphnode")

    console.log(`32bit: ${counter} tests (${success} succeeded, ${error} failed)`);


    counter = 0;
    success = 0;
    error = 0;

    await load_wasm("../build/optimized_64.wasm");
    //window.module.memory.grow((300 * 1024 * 1024 ) / 65536) // can use up to 300mb without regrowth (which invalidates all dataviews)
    //window.module.updateDataViews();
    global.instance = window.instance;
    global.pc = require("../build/playcanvas.assemblyscript_64");
    
    requireUncached("./math/test_mat4")
    requireUncached("./math/test_quat")
    requireUncached("./math/test_vec2")
    requireUncached("./math/test_vec3")
    requireUncached("./math/test_vec4")
    requireUncached("./scene/test_graphnode")

    console.log(`64bit: ${counter} tests (${success} succeeded, ${error} failed)`);
}

main();

// require("repl").start("> ");
