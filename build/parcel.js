// https://parceljs.org/api.html

// Call like:
//     cd build
//     node parcel.js
//     node parcel.js -l 1 -o output/playcanvas.min.parcel.js
// For comparison:
//     node build.js -l 1 -o output/playcanvas.min.js

var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var Path = require("path");
var Bundler = require("parcel-bundler");
var JSConcatPackager = require("parcel-bundler/src/packagers/JSConcatPackager");
var JSPackager = require("parcel-bundler/src/packagers/JSPackager");
var Packager = require("parcel-bundler/src/packagers/Packager");

/**
 * Update Parcel packagers to include a copyright notice at the very beginning
 */

var JSConcatPackager_start_original = JSConcatPackager.prototype.start;
// Adding copyright notice for `-l 1` builds
JSConcatPackager.prototype.start = async function() {
    var optionsPlayCanvas = global.optionsPlayCanvas;
    // Pretty much ugly ES5 for:
    // await super.write(`// COPYRIGHT NOTICE\n`);
    await Packager.prototype.write.call(this, optionsPlayCanvas.copyrightNotice);
    JSConcatPackager_start_original.call(this);
}
var JSPackager_start_original = JSPackager.prototype.start;
// Adding copyright notice for `-l 0` builds
JSPackager.prototype.start = async function() {
    var optionsPlayCanvas = global.optionsPlayCanvas;
    // Pretty much ugly ES5 for:
    // await super.write(`// COPYRIGHT NOTICE\n`);
    await Packager.prototype.write.call(this, optionsPlayCanvas.copyrightNotice);
    await JSPackager_start_original.call(this);
    if (debugParcel) {
        fs.writeFileSync("output/JSPackager_this.json", JSON.safeStringify(this));
    }
    var n = optionsPlayCanvas.copyrightNotice.split("\n").length;
    this.lineOffset += n; // Fix source maps
}

// A bit slower, but quite useful, dumps e.g. `parcel_dump_bundled.json` with complex structures etc. to analyze
var debugParcel = true;

if (debugParcel) {
    // Delete .cache folder, otherwise Parcel does nothing while developing this bundler
    fs.rmdirSync(".cache", { recursive: true });
}

var watch = false;
var debug = false;
var profiler = false;
//var sourceMap = false;
var outputPath;
//var sourcePath;
var COMPILER_LEVEL = [
    "WHITESPACE_ONLY",
    "SIMPLE",
    "ADVANCED"
];
var compilerLevel = COMPILER_LEVEL[0];

// configs for the builds we support
var targets = {
    engine: {
        defaultOutputPath: "output/playcanvas.js",
        //defaultSourcePath: "../src",
        depsFile: "./dependencies.txt",
        desc: "Playcanvas Engine"
    },
    extras: {   // or ministats
        defaultOutputPath: "output/playcanvas-extras.js",
        //defaultSourcePath: "../extras",
        depsFile: "./extras_dependencies.txt",
        desc: "Playcanvas Extras"
    }
};

// by default build the engine
var target = targets.engine;

// https://stackoverflow.com/questions/11616630/how-can-i-print-a-circular-structure-in-a-json-like-format
// safely handles circular references
JSON.safeStringify = (obj, indent = 2) => {
    let cache = [];
    const retVal = JSON.stringify(
        obj,
        (key, value) =>
        typeof value === "object" && value !== null
        ? cache.includes(value)
        ? "circular..." // Duplicate reference found, discard key
        : cache.push(value) && value // Store value in our collection
        : value,
        indent
    );
    cache = null;
    return retVal;
};

// get git revision
var getRevision = function (callback) {
    var command = "git rev-parse --short HEAD";

    cp.exec(command, function (err, stdout, stderr) {
        if (err) {
            callback(err, "-");
            return;
        }
        callback(null, stdout.trim());
    });
};

// get version from VERSION file
var getVersion = function (callback) {
    fs.readFile("../VERSION", function (err, buffer) {
        if (err) {
            callback(err, "__CURRENT_SDK_VERSION__");
        }
        callback(null, buffer.toString().trim());
    });
};

var getCopyrightNotice = function (ver, rev) {
    var buildOptions = "";
    if (debug || profiler) {
        if (profiler && !debug) {
            buildOptions += " (PROFILER)";
        } else if (debug) {
            buildOptions += " (DEBUG PROFILER)";
        }
    }
    return [
        "/*",
        " * " + target.desc + " v" + ver + " revision " + rev + buildOptions,
        " * Copyright 2011-" + new Date().getFullYear() + " PlayCanvas Ltd. All rights reserved.",
        " */",
        ""
    ].join("\n");
};

// Single entrypoint file location:
//const entryFiles = Path.join(__dirname, "./index.html");
const entryFiles = "../src/playcanvas.js";
// OR: Multiple files with globbing (can also be .js)
// const entryFiles = "./src/*.js";
// OR: Multiple files in an array
// const entryFiles = ["./src/index.html", "./some/other/directory/scripts.js"];

var optionsPlayCanvas = {
    __CURRENT_SDK_VERSION__: "some ver",
    __REVISION__: "some rev",
    //PROFILER: profiler || debug,
    //DEBUG: debug,
    //RELEASE: compilerLevel != COMPILER_LEVEL[0]
    PROFILER: false,
    DEBUG: false,
    RELEASE: true,
    copyrightNotice: ""
};

global.optionsPlayCanvas = optionsPlayCanvas;

async function main() {
    // Bundler options
    var options = {
        outDir: path.dirname(outputPath), // The out directory to put the build files in, defaults to dist
        outFile: path.basename(outputPath), // The name of the outputFile
        publicUrl: "./", // The url to serve on, defaults to "/"
        watch: watch, // Whether to watch the files and rebuild them on change, defaults to process.env.NODE_ENV !== "production"
        cache: true, // Enabled or disables caching, defaults to true
        cacheDir: ".cache", // The directory cache gets put in, defaults to .cache
        contentHash: false, // Disable content hash from being included on the filename
        //global: "moduleName", // Expose modules as UMD under this name, disabled by default
        minify: compilerLevel == "SIMPLE", // Minify files, enabled if process.env.NODE_ENV === "production"
        scopeHoist: compilerLevel == "SIMPLE", // Turn on experimental scope hoisting/tree shaking flag, for smaller production bundles
        target: "browser", // Browser/node/electron, defaults to browser
        bundleNodeModules: false, // By default, package.json dependencies are not included when using "node" or "electron" with "target" option above. Set to true to adds them to the bundle, false by default
        //https: { // Define a custom {key, cert} pair, use true to generate one or false to use http
        //    cert: "./ssl/c.crt", // Path to custom certificate
        //    key: "./ssl/k.key" // Path to custom key
        //},
        logLevel: 3, // 5 = save everything to a file, 4 = like 3, but with timestamps and additionally log http requests to dev server, 3 = log info, warnings & errors, 2 = log warnings & errors, 1 = log errors, 0 = log nothing
        hmr: false, // Enable or disable HMR while watching
        hmrPort: 0, // The port the HMR socket runs on, defaults to a random free port (0 in node.js resolves to a random free port)
        sourceMaps: true, // Enable or disable sourcemaps, defaults to enabled (minified builds currently always create sourcemaps)
        hmrHostname: "", // A hostname for hot module reload, default to ""
        detailedReport: false, // Prints a detailed report of the bundles, assets, filesizes and times, defaults to false, reports are only printed if watch is disabled
        autoInstall: false, // Enable or disable auto install of missing dependencies found during bundling
    };
    if (debugParcel) {
        console.log("options", options);
    }
    // Initializes a bundler using the entrypoint location and options provided
    const bundler = new Bundler(entryFiles, options);
    bundler.addAssetType("js", require.resolve("./JSAssetPlayCanvas"));

    // `bundled` gets called once Parcel has successfully finished bundling, the main bundle instance gets passed to the callback
    bundler.on("bundled", (bundle) => {
        // bundler contains all assets and bundles, see documentation for details
        if (debugParcel) {
            console.log("Event: bundled");
            fs.writeFileSync("output/parcel_event_bundled.json", JSON.safeStringify(bundle));
        }
    });

    // `buildEnd` gets called after each build (aka including every rebuild), this also emits if an error occurred
    bundler.on("buildEnd", () => {
        if (debugParcel) {
            console.log("Event: buildEnd");
        }
    });

    // `buildStart` gets called at the start of the first build, the entryFiles Array gets passed to the callback
    bundler.on("buildStart", entryPoints => {
        if (debugParcel) {
            console.log("Event: buildStart");
            console.log("entryPoints", entryPoints);
        }
    });

    bundler.on("buildError", error => {
        if (debugParcel) {
            console.log("Event: buildError");
            console.log("error", error);
        }
    });

    // Run the bundler, this returns the main bundle
    // Use the events if you"re using watch mode as this promise will only trigger once and not for every rebuild
    const bundle = await bundler.bundle();
};

// parse arguments
var arguments = function () {
    var _last = null;
    var _arg = null;
    process.argv.forEach(function (arg) {
        if (arg === "-h") {
            console.log("Build Script for PlayCanvas Engine\n");
            console.log("Usage: node parcel.js -l [COMPILER_LEVEL] -o [OUTPUT_PATH] -m [SOURCE_PATH]\n");
            console.log("Arguments:");
            console.log("-h: show this help");
            console.log("-l COMPILER_LEVEL: Set compiler level");
            console.log("\t0: WHITESPACE_ONLY [default]");
            console.log("\t1: SIMPLE");
            console.log("\t2: ADVANCED OPTIMIZATIONS");
            console.log("-o PATH: output file path [output/playcanvas.js]");
            console.log("-d: build debug engine configuration");
            console.log("-p: build profiler engine configuration");
            console.log("-m SOURCE_PATH: build engine and generate source map next to output file. [../src]");
            console.log("-t target to build, either engine or extas. default is engine");
            console.log("--watch: Recompile observed file changes immediately");
            //console.log("--concatenateShaders: Just generate src/graphics/program-lib/chunks/generated-shader-chunks.js");
            process.exit();
        }

        if (arg === "-d") {
            debug = true;
        }

        if (arg === "-p") {
            profiler = true;
        }

        if (arg === "--watch") {
            watch = true;
        }

        //if (arg === "--concatenateShaders") {
        //    run = function() {
        //        concatenateShaders(function() {
        //            console.log("> concatenated shaders")
        //        });
        //    }
        //}

        if (_last === "-l") {
            var level = parseInt(arg, 10);
            if (!(level >= 0 && level <= 2)) {
                console.error("Invalid compiler level (-l) should be: 0, 1 or 2.");
                process.exit(1);
            }
            compilerLevel = COMPILER_LEVEL[level];
        }

        if (_last === "-o") {
            outputPath = arg;
        }

        if (arg === "-m") {
            sourceMap = true;
        }

        if (_last === "-m" && !arg.startsWith("-")) {
            sourcePath = arg;
        }

        if (_last === "-t") {
            if (!targets.hasOwnProperty(arg)) {
                console.error("Invalid target should be: engine or extras");
                process.exit(1);
            }
            target = targets[arg];
        }

        _last = arg;
    });

    outputPath = outputPath || target.defaultOutputPath;
    //sourcePath = sourcePath || target.defaultSourcePath;
};

var run = function() {
    getRevision(function (err, rev) {
        optionsPlayCanvas.__REVISION__ = rev;
        getVersion(function (err, ver) {
            optionsPlayCanvas.__CURRENT_SDK_VERSION__ = ver;
            optionsPlayCanvas.PROFILER = profiler || debug;
            optionsPlayCanvas.DEBUG = debug;
            optionsPlayCanvas.RELEASE = compilerLevel != COMPILER_LEVEL[0];
            optionsPlayCanvas.copyrightNotice = getCopyrightNotice(ver, rev);
            if (debugParcel) {
                console.log("optionsPlayCanvas", optionsPlayCanvas);
            }
            main();
        });
    });
}

arguments();
run();
