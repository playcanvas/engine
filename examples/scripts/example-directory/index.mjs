import fs from 'fs';
import Handlebars from 'handlebars';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../../`;

function loadHtmlTemplate(data) {
    const html = fs.readFileSync(`${MAIN_DIR}/scripts/example-directory/example.mustache`, "utf8");
    const template = Handlebars.compile(html);
    return template(data);
}

const categoriesList = [];

let categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories = categories.filter(c => c !== 'index.mjs');
categories.forEach(function (category) {
    var dir = `${MAIN_DIR}/dist/${category}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    let examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples = examples.filter(e => e !== 'index.mjs');
    examples = examples.map(example => example.replace('.tsx', ''));
    categoriesList.push({
        name: category,
        examples
    });
    examples.forEach((example) => {
        const content = loadHtmlTemplate({
            path: `${category}/${example}`,
            exampleTitle: `${example.split('-').join(' ')}`,
            largeThumbnailName: `${category}_${example}_large`
        });
        var dir = `${MAIN_DIR}/dist/${category}/${example}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(`${MAIN_DIR}/dist/${category}/${example}/index.html`, content);
    });
});

fs.writeFileSync(`dist/examples.json`, JSON.stringify(categoriesList));
