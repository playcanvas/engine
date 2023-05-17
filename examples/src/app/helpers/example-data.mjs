import exampleData from '../../../dist/example-data.js';

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const categories = {};
const paths = {};

Object.keys(exampleData).forEach((categorySlug) => {
    const category = categorySlug.split('-').map(a => capitalizeFirstLetter(a)).join('');
    categories[categorySlug] = {
        examples: {}
    };
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug, i) => {
        const name = exampleSlug.split('-').map(a => capitalizeFirstLetter(a)).join('').replace('1d', '1D').replace('2d', '2D');
        categories[categorySlug].examples[exampleSlug] = name;
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
            files: files,
            category: category,
            name: name
        };
    });
});

export default {
    categories,
    paths
};
