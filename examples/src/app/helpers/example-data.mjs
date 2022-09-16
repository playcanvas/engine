import exampleData from '../../../dist/example-data.js';
import * as exampleClasses from '../../examples/index.mjs';

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const categories = {};
const paths = {};

Object.keys(exampleData).forEach((categorySlug) => {
    const category = categorySlug.split('-').map(a => capitalizeFirstLetter(a)).join('');
    const exampleClassesForCategory = exampleClasses[category];
    if (!exampleClassesForCategory) {
        return;
    }
    categories[categorySlug] = {
        examples: {}
    };
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug, i) => {
        const name = exampleSlug.split('-').map(a => capitalizeFirstLetter(a)).join('').replace('1d', '1D').replace('2d', '2D');
        const className = `${name}Example`;
        const ExampleClass = exampleClassesForCategory[className];

        if (!ExampleClass) {
            console.error(`Failed to find example class: ${className}`, exampleClassesForCategory);
        }

        if (i === 0) categories[categorySlug].name = ExampleClass.CATEGORY;
        if (ExampleClass.HIDDEN) return;
        const example = new ExampleClass();
        categories[categorySlug].examples[exampleSlug] = example;
        const files = [
            {
                name: 'example.js',
                text: exampleData[categorySlug][exampleSlug].javaScriptFunction,
                type: 'javascript'
            },
            {
                name: 'example.ts',
                text: exampleData[categorySlug][exampleSlug].typeScriptFunction,
                type: 'typescript'
            }
        ];
        const extraFiles = exampleData[categorySlug][exampleSlug].files;
        if (extraFiles) {
            Object.keys(extraFiles).forEach((fileName) => {
                files.push({
                    name: fileName,
                    text: extraFiles[fileName],
                    type: 'text'
                });
            });
        }
        paths[`/${categorySlug}/${exampleSlug}`] = {
            path: `/${categorySlug}/${exampleSlug}`,
            example: ExampleClass,
            files: files
        };
    });
});

export default {
    categories,
    paths
};
