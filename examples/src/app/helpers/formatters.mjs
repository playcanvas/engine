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
    const functionReturnType = ': void {';
    // if the text contains a function return type then we need to extract the functions inner text from after
    // that point as the function signature may contain complex parameter types including parantheses
    if (text.includes(functionReturnType)) {
        text = text.substring(text.indexOf(functionReturnType) + functionReturnType.length);
    } else {
        // otherwise we're dealing with a JS function so we can just extract the inner text from after the first paranthesis
        text = text.substring(text.indexOf("{") + 1);
    }
    text = text.substring(0, text.lastIndexOf("}"));
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
    text = text.replace("wasmSupported(", "window.wasmSupported(");
    text = text.replace("loadWasmModuleAsync(", "window.loadWasmModuleAsync(");
    text = text.replace(/static\//g, '../../static/');
    return text;
};

const getEngineTypeFromClass = (text) => {
    if (text.indexOf(`_defineProperty(Example, "ENGINE", 'DEBUG');`) !== -1) {
        return 'DEBUG';
    } else if (text.indexOf(`_defineProperty(Example, "ENGINE", 'PERFORMANCE');`) !== -1) {
        return 'PERFORMANCE';
    }
    return null;
};

const classIncludesMiniStats = (text) => {
    return text.includes('_defineProperty(Example, "MINISTATS", true);');
};

const retrieveStaticObject = (text, name) => {
    const staticStart = `static ${name} = `;
    let start = text.indexOf(staticStart);
    if (start < 0) return;
    start += staticStart.length;
    const end = findClosingBracketMatchIndex(text, start) + 1;
    return text.substring(start, end);
};

export default {
    getTypeScriptFunctionFromText: getTypeScriptFunctionFromText,
    getInnerFunctionText: getInnerFunctionText,
    getExampleClassFromTextFile: getExampleClassFromTextFile,
    getEngineTypeFromClass: getEngineTypeFromClass,
    retrieveStaticObject: retrieveStaticObject,
    classIncludesMiniStats: classIncludesMiniStats
};
