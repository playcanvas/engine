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
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug, i) => {
        const name = kebabCaseToPascalCase(exampleSlug);
        /*
        let realClass;
        try {
            realClass = realExamples[category][name + "Example"];
        } catch (e) {
            // slow process of porting everything to proper MJS
            debugger;
            return;
        }
        if (!realClass) {
            return;
        }
        */
        //debugger;
        //console.log({category, name, realClass });
        categories[categorySlug].examples[exampleSlug] = name;
        const data = exampleData[categorySlug][exampleSlug];
        const files = [
            {
                name: 'example.js',
                //text: realClass.example.toString(),
                text: data.example,
                type: 'javascript'
            },
        ];
        const extraFiles = data.files;
        //const extraFiles = realClass.FILES;
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

export default {
    categories,
    paths
};
