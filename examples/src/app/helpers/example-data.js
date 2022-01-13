import exampleData from '../../../dist/example-data';
import * as exampleClasses from '../../examples';

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
        examples: {},
        name: category
    };
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug) => {
        const name = exampleSlug.split('-').map(a => capitalizeFirstLetter(a)).join('').replace('1d', '1D').replace('2d', '2D');
        const ExampleClass = exampleClassesForCategory[`${name}Example`];
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
        if (example.load) {
            let children = example.load().props.children;
            if (!Array.isArray(children)) {
                children = [children];
            }
            children.forEach((child) => {
                if (child.props.type === 'shader') {
                    files.push({
                        name: child.props.name,
                        text: child.props.data,
                        type: 'shader'
                    });
                } else if (child.props.type === 'json') {
                    files.push({
                        name: child.props.name,
                        text: JSON.stringify(child.props.data, null, 4),
                        type: 'json'
                    });
                }
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
