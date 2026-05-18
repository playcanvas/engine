import type * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

declare module '*.frag' {
    const text: string;
    export default text;
}

declare module '*.vert' {
    const text: string;
    export default text;
}

declare module '*.wgsl' {
    const text: string;
    export default text;
}

declare module '*.glsl' {
    const text: string;
    export default text;
}

declare module '*.html' {
    const text: string;
    export default text;
}

declare module '*.css' {
    const text: string;
    export default text;
}

declare module '*.txt' {
    const text: string;
    export default text;
}

declare module '*.json' {
    const data: JsonValue;
    export default data;
}

declare global {
    interface Window {
        _scrolledToExample?: boolean;
        editor?: editor.IStandaloneCodeEditor;
        monaco: typeof monaco;
        preferredGraphicsDevice?: string;
    }
}

export {};
