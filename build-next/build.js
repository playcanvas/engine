var fs = require("fs");
var path = require("path");
var argv = require('yargs').argv;

var CONCAT_SRC_FILE = "src.js";

if (fs.existsSync(CONCAT_SRC_FILE)) {
    fs.unlinkSync(CONCAT_SRC_FILE);
}

// Concatenate source files, read from "../build/dependencies.txt"
fs.readFileSync("../build/dependencies.txt", "utf-8")
    .split("\n")
    .forEach(function (srcFile) {
        if (srcFile) {
            fs.appendFileSync(CONCAT_SRC_FILE, "// " + srcFile + '\n');
            var script = fs.readFileSync(path.resolve(srcFile));
            fs.appendFileSync(CONCAT_SRC_FILE, script);
        }
    });

// Triggers esbuild, just use its minification
require("esbuild").build({
    stdio: "inherit",
    entryPoints: [CONCAT_SRC_FILE],
    outfile: argv.o,
    minify: argv.l,
    bundle: false
});
