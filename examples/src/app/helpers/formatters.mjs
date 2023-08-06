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

const getEngineTypeFromClass = (text) => {
    if (text.indexOf(`_defineProperty(Example, "ENGINE", 'DEBUG');`) !== -1) {
        return 'DEBUG';
    } else if (text.indexOf(`_defineProperty(Example, "ENGINE", 'PERFORMANCE');`) !== -1) {
        return 'PERFORMANCE';
    }
    return null;
};

const getWebgpuEnabledFromClass = (text) => {
    if (text.indexOf(`_defineProperty(Example, "WEBGPU_ENABLED", true);`) !== -1) {
        return true;
    }
    return false;
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
    getEngineTypeFromClass,
    getWebgpuEnabledFromClass,
    retrieveStaticObject,
    classIncludesMiniStats
};
