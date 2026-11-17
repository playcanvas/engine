import {
    BindingTwoWay,
    BooleanInput,
    Button,
    Label,
    LabelGroup,
    Panel
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    // shown once a setting which only applies to the loading on a reload changed
    const [reloadHint, setReloadHint] = useState(observer.get('reloadHint') ?? '');
    useEffect(() => {
        const event = observer.on('reloadHint:set', () =>
            setReloadHint(observer.get('reloadHint') ?? '')
        );
        return () => event?.unbind();
    }, [observer]);

    /**
     * @param {string} path - The observer path of the value.
     * @returns {ReactElement} A label showing the value.
     */
    const value = (path) => (
        <Label binding={new BindingTwoWay()} link={{ observer, path }} value={observer.get(path)} />
    );

    return (
        <>
            <Panel headerText='Settings'>
                <LabelGroup text='Precompile'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.precompile' }}
                    />
                </LabelGroup>
                <LabelGroup text='Frustum culling'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.frustumCulling' }}
                    />
                </LabelGroup>
                <div
                    style={{
                        display: reloadHint ? 'block' : 'none',
                        color: '#f60',
                        padding: '2px 6px 6px'
                    }}
                >
                    {reloadHint}
                </div>
                <LabelGroup text='Rotate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.rotate' }}
                    />
                </LabelGroup>
                <Button text='Add materials' onClick={() => observer.emit('add')} />
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Shaders'>{value('stats.shaders')}</LabelGroup>
                <LabelGroup text='Pipelines'>{value('stats.pipelines')}</LabelGroup>
                <LabelGroup text='Precompile'>{value('stats.time')}</LabelGroup>
                <LabelGroup text='Compile stalls'>{value('stats.stalls')}</LabelGroup>
            </Panel>
        </>
    );
}
