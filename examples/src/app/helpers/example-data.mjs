import { exampleData } from '../../example-data.mjs';
/**
 * @param {string} string 
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
/**
 * @example
 * console.log(toKebabCase("BlendTrees1D")); // blend-trees-1d
 * @param {string} str - The string.
 * @returns String in kebab-case-format
 */
function toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
      .toLowerCase()
      .replaceAll("1d", "-1d")
      .replaceAll("2d", "-2d")
      .replaceAll("3d", "-3d")
}
/** @type {Record<string, Record<string, object>>} */
const categories = {};
/** @type {Record<string, object>} */
const paths = {};
Object.keys(exampleData).forEach((categorySlug) => {
    const category = categorySlug.split('-').map(a => capitalizeFirstLetter(a)).join('');
    categories[categorySlug] = {
        examples: {}
    };
    Object.keys(exampleData[categorySlug]).forEach((exampleSlug, i) => {
        const name = exampleSlug.split('-').map(a => capitalizeFirstLetter(a)).join('').replace('1d', '1D').replace('2d', '2D');
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
