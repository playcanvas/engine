import React from 'react';
import * as pc from '../../../../';

interface ScriptLoaderProps {
    name: string,
    url: string
}
class ScriptLoader extends React.Component <ScriptLoaderProps, any> {
    static ctor: any;
    static load(resource: ScriptLoaderProps, app: pc.Application, onLoad: any) {
        fetch(resource.url)
            .then((response: any) => response.text())
            .then((data) => {
                (window as any)[resource.name] = (Function('module', 'exports', data).call(module, module, module.exports), module).exports;
                onLoad();
            });
    }
}

export {
    ScriptLoader
};
