import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase, kebabCaseToPascalCase } from '../src/app/strings.mjs';

/**
 * @type {{
 *      category: string,
 *      categoryKebab: string,
 *      categoryPascal: string,
 *      exampleName: string,
 *      exampleNameKebab: string,
 *      exampleNamePascal: string,
 *      exampleClass: import('./standalone-html.mjs').ExampleClass
 * }[]}
 */
const exampleMetaData = [];
/**
 * @type {Record<string, { examples: Record<string, string> }>}
 */
const hierachy = {};

for (const category in realExamples) {
    const categoryKebab = toKebabCase(category);
    const categoryPascal = kebabCaseToPascalCase(categoryKebab);

    hierachy[categoryKebab] = { examples: {} };

    // @ts-ignore
    const examples = realExamples[category];
    for (const name in examples) {
        const exampleClass = examples[name];
        const exampleName = name.replace(/Example$/, "");
        const exampleNameKebab = toKebabCase(exampleName);
        const exampleNamePascal = kebabCaseToPascalCase(exampleNameKebab);

        hierachy[categoryKebab].examples[exampleNameKebab] = exampleNamePascal;

        exampleMetaData.push({
            category,
            categoryKebab,
            categoryPascal,
            exampleName,
            exampleNameKebab,
            exampleNamePascal,
            exampleClass
        });
    }
}

export { exampleMetaData, hierachy };
