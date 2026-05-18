import type * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

declare global {
    interface Window {
        _scrolledToExample?: boolean;
        editor?: editor.IStandaloneCodeEditor;
        monaco: typeof monaco;
        preferredGraphicsDevice?: string;
    }
}

export {};
