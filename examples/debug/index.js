const fs = require("fs");
const Babel = require("@babel/standalone");
const Handlebars = require("handlebars");

const MAIN_DIR = `${__dirname}/../`;

const EXAMPLE_CONSTS = [
    "vshader",
    "fshader",
    "fshaderFeedback",
    "fshaderCloud",
    "vshaderFeedback",
    "vshaderCloud"
];

function retrieveConstString(data, name) {
    const start = data.indexOf(`const ${name} = `);
    if (start < 1) return;
    const end = data.indexOf("`;", start);
    return data.substring(start + name.length + 10, end);
}

function loadHtmlTemplate(data) {
    const html = fs.readFileSync(`${MAIN_DIR}/debug/index.mustache`, "utf8");
    const template = Handlebars.compile(html);
    return template(data);
}

function formatExampleString(exampleString) {
    exampleString = exampleString
        .substring(exampleString.indexOf("extends Example {"))
        .replace("extends Example {", "class Example {");
    exampleString = exampleString.substring(0, exampleString.indexOf("export default") - 1);
    exampleString = exampleString.replace(/AssetLoader/g, "div");
    exampleString = exampleString.replace(/ScriptLoader/g, "div");
    exampleString = Babel.transform(exampleString, {
        retainLines: true,
        filename: `transformedScript.tsx`,
        presets: ["react", "typescript", "env"]
    }).code;
    exampleString = exampleString.replace("example(canvas", "example(app, canvas");
    exampleString = exampleString.replace("wasmSupported(", "window.wasmSupported(");
    exampleString = exampleString.replace("loadWasmModuleAsync(", "window.loadWasmModuleAsync(");
    exampleString = exampleString.replace(/static\//g, '../../static/');

    const indexOfAppCallStart = exampleString.indexOf("var app");
    const indexOfAppCallEnd =
        indexOfAppCallStart +
        exampleString.substring(indexOfAppCallStart, exampleString.length - 1).indexOf(";");
    const appCall = exampleString.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
    exampleString = exampleString.replace(appCall, "");
    return exampleString;
}

function buildExample(category, filename) {
    const exampleString = fs.readFileSync(
        `${MAIN_DIR}/src/examples/${category}/${filename}`,
        "utf8"
    );
    const exampleConstValues = [];
    EXAMPLE_CONSTS.forEach((key) => {
        const value = retrieveConstString(exampleString, key);
        if (!value) return;
        exampleConstValues.push({ k: key, v: value });
    });
    const formattedExampleString = formatExampleString(exampleString);
    if (!fs.existsSync(`${MAIN_DIR}/dist/debug/${category}/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/debug/${category}/`);
    }
    fs.writeFileSync(`${MAIN_DIR}/dist/debug/${category}/${filename.replace(".tsx", "")}.html`, loadHtmlTemplate({
        exampleClass: formattedExampleString,
        exampleConstValues: JSON.stringify(exampleConstValues),
        enginePath: process.env.ENGINE_PATH || '../../build/playcanvas.dbg.js'
    }));
}

if (!fs.existsSync(`${MAIN_DIR}/dist/debug/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/debug/`);
}
const categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories.forEach(function (category) {
    const examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples.forEach((example) => {
        buildExample(category, example);
    });
});
