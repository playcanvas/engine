const MAIN_DIR = `${__dirname}/../../`;
const fs = require("fs");
const Babel = require("@babel/standalone");
const Handlebars = require("handlebars");
const formatters = require("./../../src/app/helpers/formatters.js");

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
    const html = fs.readFileSync(`${MAIN_DIR}/scripts/iframe/index.mustache`, "utf8");
    const template = Handlebars.compile(html);
    return template(data);
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
    const exampleClass = formatters.getExampleClassFromTextFile(Babel, exampleString);
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/${category}/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/${category}/`);
    }
    fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${category}/${filename.replace(".tsx", "")}.html`, loadHtmlTemplate({
        exampleClass: exampleClass,
        exampleConstValues: JSON.stringify(exampleConstValues),
        enginePath: process.env.ENGINE_PATH || '../../build/playcanvas.dbg.js'
    }));
}

if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
}
const categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories.forEach(function (category) {
    if (category.includes('index.js')) return;
    const examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples.forEach((example) => {
        if (example.includes('index.js')) return;
        buildExample(category, example);
    });
});
