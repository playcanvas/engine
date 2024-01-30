import { exampleData } from '../../example-data.mjs';
import { kebabCaseToPascalCase } from './strings.mjs';
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
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug, i) => {
        const name = kebabCaseToPascalCase(exampleSlug);
        // @ts-ignore
        categories[categorySlug].examples[exampleSlug] = name;
        // @ts-ignore
        const data = exampleData[categorySlug][exampleSlug];
        const files = [
            {
                name: 'example.js',
                text: data.example,
                type: 'javascript'
            }
        ];
        const extraFiles = data.files;
        if (extraFiles) {
            Object.keys(extraFiles).forEach((name) => {
                files.push({
                    name,
                    text: extraFiles[name],
                    type: 'text'
                });
            });
        }
        paths[`/${categorySlug}/${exampleSlug}`] = {
            path: `/${categorySlug}/${exampleSlug}`,
            files: files,
            category: category,
            name: name
        };
    });
});

export default { categories, paths };
