import { BindingTwoWay, Panel, Label, Button } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='WebGPU'>
                <Button text='Add' onClick={() => observer.emit('add:webgpu')} />
                <Button text='Remove' onClick={() => observer.emit('remove:webgpu')} />
                <Label
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'webgpu' }}
                    value={observer.get('webgpu')}
                />
            </Panel>
            <Panel headerText='WebGL 2'>
                <Button text='Add' onClick={() => observer.emit('add:webgl2')} />
                <Button text='Remove' onClick={() => observer.emit('remove:webgl2')} />
                <Label
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'webgl2' }}
                    value={observer.get('webgl2')}
                />
            </Panel>
            <Panel headerText='Null'>
                <Button text='Add' onClick={() => observer.emit('add:null')} />
                <Button text='Remove' onClick={() => observer.emit('remove:null')} />
                <Label
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'null' }}
                    value={observer.get('null')}
                />
            </Panel>
        </>
    );
}
