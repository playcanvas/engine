//import exampleData from '../../../dist/example-data.js';
// todo: nuke this file, just serving as example rn
import exampleData from '../example-data.js';
import * as realExamples from "../../examples/index.mjs";
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
//console.log(toKebabCase("BlendTrees1D")); // blend-trees-1d
function toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
      .toLowerCase()
      .replaceAll("1d", "-1d")
      .replaceAll("2d", "-2d")
      .replaceAll("3d", "-3d")
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
        let realClass;
        try {
            realClass = realExamples[category][name + "Example"];
        } catch (e) {
            // slow process of porting everything to proper MJS
            return;
        }
        if (!realClass) {
            return;
        }
        //debugger;
        console.log({category, name, realClass });
        categories[categorySlug].examples[exampleSlug] = name;
        const files = [
            {
                name: 'example.js',
                text: 'function' + realClass.prototype.example.toString(),
                type: 'javascript'
            },
            //{
            //    name: 'example.ts',
            //    text: exampleData[categorySlug][exampleSlug].typeScriptFunction,
            //    type: 'typescript'
            //}
        ];
        //const extraFiles = exampleData[categorySlug][exampleSlug].files;
        const extraFiles = realClass.prototype.files;
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
