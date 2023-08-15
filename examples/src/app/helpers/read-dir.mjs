import fs from 'fs';

const ignoreList = [
    'lit-material.mjs',
];

const getExamplesList = (mainDir, category) => {
    let examples = fs.readdirSync(`${mainDir}/src/examples/${category}`);
    examples = examples.filter((e) => {
        const exclude = ignoreList.includes(e);
        if (exclude) {
            console.log(`Excluding ignored file: ${e}`);
        }
        return !exclude;
    });
    return examples;
};

export default getExamplesList;
