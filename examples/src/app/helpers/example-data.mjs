import * as realExamples from "../../examples/index.mjs";
import { toKebabCase, kebabCaseToPascalCase } from './strings.mjs';


/** @type {Record<string, Record<string, { nameSlug: string, categorySlug: string}>>} */
const exampleData = {};
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    // @ts-ignore
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {
        const release = process.env.NODE_ENV !== 'development';
        if (release && examples[exampleName_].HIDDEN) {
            console.log(`build:example:data> skip hidden example: ${category_}/${exampleName_}`);
            continue;
        }
        const example = toKebabCase(exampleName_).replace('-example', '');
        // turn: turn into simple array...
        exampleData[category][example] = {
            nameSlug: example,
            categorySlug: category
        };
    }
}

/** @type {Record<string, Record<string, object>>} */
const categories = {};
/** @type {Record<string, object>} */
const paths = {};
Object.keys(exampleData).forEach((categorySlug) => {
    const category = kebabCaseToPascalCase(categorySlug);
    categories[categorySlug] = {
        examples: {}
    };
    // @ts-ignore
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug) => {
        const name = kebabCaseToPascalCase(exampleSlug);
        // @ts-ignore
        categories[categorySlug].examples[exampleSlug] = name;
        const files = [{
            name: 'example.js',
            type: 'javascript'
        }];
        paths[`/${categorySlug}/${exampleSlug}`] = {
            path: `/${categorySlug}/${exampleSlug}`,
            files: files,
            category: category,
            name: name
        };
    });
});

export default { categories, paths };
