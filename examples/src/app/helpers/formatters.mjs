
const findClosingBracketMatchIndex = (str, pos) => {
    if (str[pos] != '{') throw new Error("No '{' at index " + pos);
    let depth = 1;
    for (let i = pos + 1; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
            if (--depth == 0) {
                return i;
            }
        }
    }
    return -1;
};

const getTypeScriptFunctionFromText = (text) => {
    const transformedCode = text;
    const functionSignatureStartString = 'example(canvas: HTMLCanvasElement';
    const indexOfFunctionSignatureStart = transformedCode.indexOf(functionSignatureStartString);
    const functionSignatureEndString = '): void ';
    const indexOfFunctionSignatureEnd = indexOfFunctionSignatureStart + transformedCode.substring(indexOfFunctionSignatureStart).indexOf(functionSignatureEndString) + functionSignatureEndString.length;
    const indexOfFunctionEnd = findClosingBracketMatchIndex(transformedCode, indexOfFunctionSignatureEnd) + 1;
    let functionText = 'function ' + transformedCode.substring(indexOfFunctionSignatureStart, indexOfFunctionEnd);
    functionText = functionText.split('\n')
        .map((line, index) => {
            if (index === 0) return line;
            if (line.substring(0, 4).split('').filter(a => a !== ' ').length > 0) {
                return line;
            }
            return line.substring(4);
        })
        .join('\n');
    return functionText;
};

const getInnerFunctionText = (text) => {
    if (text.includes(': void {')) {
        text = text.substring(text.indexOf(": void {") + 8);
    } else {
        text = text.substring(text.indexOf("{") + 1);
    }
    text = text.substring(0, text.lastIndexOf("}"));
    // strip the PlayCanvas app initialization
    const indexOfAppCallStart = text.indexOf('const app');
    const indexOfAppCallEnd = indexOfAppCallStart + text.substring(indexOfAppCallStart, text.length - 1).indexOf(';');
    const appCall = text.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
    text = text.replace(appCall, '');
    return text;
};

const getExampleClassFromTextFile = (Babel, text) => {
    const className = text.match(/class \w+/);
    text = text
        .substring(text.indexOf("class "))
        .replace(className[0], "class Example");
    text = text.substring(0, text.indexOf("export default") - 1);
    text = text.replace(/AssetLoader/g, "div");
    text = text.replace(/ScriptLoader/g, "div");
    text = Babel.transform(text, {
        retainLines: true,
        filename: `transformedScript.tsx`,
        presets: ["react", "typescript", "env"]
    }).code;
    text = text.replace("example(canvas", "example(app, canvas");
    text = text.replace("wasmSupported(", "window.wasmSupported(");
    text = text.replace("loadWasmModuleAsync(", "window.loadWasmModuleAsync(");
    text = text.replace(/static\//g, '../../static/');

    const indexOfAppCallStart = text.indexOf("var app");
    const indexOfAppCallEnd =
        indexOfAppCallStart +
        text.substring(indexOfAppCallStart, text.length - 1).indexOf(";");
    const appCall = text.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
    text = text.replace(appCall, "");
    return text;
};

export default {
    getTypeScriptFunctionFromText: getTypeScriptFunctionFromText,
    getInnerFunctionText: getInnerFunctionText,
    getExampleClassFromTextFile: getExampleClassFromTextFile
};
