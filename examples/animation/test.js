var chai = require("chai");
const { MaterialHandler } = require("../../build/playcanvas");
const { replace } = require("sinon");

function describe(name, func) {
	console.log(name);
	func()
}

function it(name, func) {
	//console.log(name);
	try {
		func();
	} catch (e) {
		console.log(name, "failed: ", e)
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


fetch = require("file-fetch");
fs = require("fs");

global.window = {
	navigator: {
		userAgent: "node"
	}
};

require("./Loader");
//console.log("Loader", Loader)

async function load_wasm() {
	var wasmFile = fs.readFileSync("../../build/untouched.wasm");
	//buffer = await response.arrayBuffer();
	imports = {};
	//module = Loader.instantiateBuffer(buffer, imports);
	var module = await Loader.instantiateBuffer(wasmFile, imports);
	//console.log(module);
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

//function evalContext(code) {
//	console.log("this", this.instance.exports);
//	eval(code);
//}

//function requireContext(src) {
//	console.log("requireContext this", this);
//	return require(src);
//}

async function main() {
	await load_wasm();
	window.module.memory.grow((300 * 1024 * 1024 ) / 65536) // can use up to 300mb without regrowth (which invalidates all dataviews)
	window.module.updateDataViews();
	global.instance = window.instance;
	if (1) {
		//global.pc = requireContext.call(global, "../../build/playcanvas.assemblyscript");
		global.pc = require("../../build/playcanvas.assemblyscript");
	} else {
		var code = fs.readFileSync("../../build/playcanvas.assemblyscript.js", "utf8");
		code = code.replace(/instance\./g, "window.instance.");
		console.log(evalContext.bind({exports: "ddd", instance: window.instance, window})(code));
	}
	require("../../tests/math/test_mat4")
	require("../../tests/math/test_quat")
	require("../../tests/math/test_vec2")
	require("../../tests/math/test_vec3")
	require("../../tests/math/test_vec4")

}

main();

require("repl").start("> ");