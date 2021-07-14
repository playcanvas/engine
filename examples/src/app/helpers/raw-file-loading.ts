import { File } from './types';

export const playcanvasTypeDefs = (() => {
    // @ts-ignore: use of require context
    const files = require.context('!!raw-loader!../../../node_modules/playcanvas/build/', true, /\.d.ts$/);
    let result;
    files.keys().forEach((key: string) => {
        result = files(key).default;
    });
    return result;
})();

export const examples = (() => {
    const exampleFiles: any = {};

    function importAll(r: any) {
        r.keys().forEach((key: any) => (exampleFiles[key] = r(key)));
    }

    // @ts-ignore: library file import
    importAll(require.context('../../examples/', true, /\.tsx$/));

    const categories: any = {};
    const paths: {[key: string]: { path: string, example: any, files: Array<File> }} = {};

    Object.keys(exampleFiles).forEach((key: string) => {
        if (key.indexOf('./') === 0) {
            const splitPath = key.split('/');
            const categorySlug = splitPath[1];
            const nameSlug = splitPath[2].replace('.tsx', '');
            const example = new exampleFiles[key].default();
            if (example.constructor.HIDDEN) return;
            if (!categories[categorySlug]) {
                categories[categorySlug] = {
                    name: example.constructor.CATEGORY,
                    examples: {
                        [nameSlug]: example
                    }
                };
            } else {
                categories[categorySlug].examples[nameSlug] = example;
            }

            const findClosingBracketMatchIndex = (str: string, pos: number) => {
                if (str[pos] != '{') {
                    throw new Error("No '{' at index " + pos);
                }
                let depth = 1;
                for (let i = pos + 1; i < str.length; i++) {
                    switch (str[i]) {
                        case '{':
                            depth++;
                            break;
                        case '}':
                            if (--depth == 0) {
                                return i;
                            }
                            break;
                    }
                }
                return -1;    // No matching closing parenthesis
            };

            const transformedCode = require(`!raw-loader!../../examples/${categorySlug}/${nameSlug}.tsx`).default;
            const functionSignatureStartString = 'example(canvas: HTMLCanvasElement';
            const indexOfFunctionSignatureStart = transformedCode.indexOf(functionSignatureStartString);
            const functionSignatureEndString = '): void ';
            const indexOfFunctionSignatureEnd = indexOfFunctionSignatureStart + transformedCode.substring(indexOfFunctionSignatureStart).indexOf(functionSignatureEndString) + functionSignatureEndString.length;
            const indexOfFunctionEnd = findClosingBracketMatchIndex(transformedCode, indexOfFunctionSignatureEnd) + 1;
            let functionText = 'function ' + transformedCode.substring(indexOfFunctionSignatureStart, indexOfFunctionEnd);
            functionText = functionText.split('\n')
                .map((line: string, index: number) => {
                    if (index === 0) return line;
                    if (line.substring(0, 4).split('').filter((a) => a !== ' ').length > 0) {
                        return line;
                    }
                    return line.substring(4);
                })
                .join('\n');

            const files: Array<File> = [
                {
                    name: 'example.ts',
                    text: functionText
                }
            ];
            // @ts-ignore
            if (example.load) {
                // @ts-ignore
                let children = example.load().props.children;
                if (!Array.isArray(children)) {
                    children = [children];
                }
                children.forEach((child: any) => {
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

            paths[`/${categorySlug}/${nameSlug}`] = {
                path: `/${categorySlug}/${nameSlug}`,
                example: exampleFiles[key].default,
                files: files
            };
        }
    });

    return { categories, paths };
})();
