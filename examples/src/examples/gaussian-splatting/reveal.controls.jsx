import { BindingTwoWay, LabelGroup, SelectInput, Button } from '@playcanvas/pcui/react';

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
            <LabelGroup text='Renderer'>
                <SelectInput
                    type='number'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'renderer' }}
                    value={observer.get('renderer') ?? 0}
                    options={[
                        { v: 0, t: 'Auto' },
                        { v: 1, t: 'Raster (CPU Sort)' },
                        { v: 2, t: 'Raster (GPU Sort)' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Effect'>
                <SelectInput
                    options={[
                        { v: 'radial', t: 'Radial' },
                        { v: 'rain', t: 'Rain' },
                        { v: 'grid', t: 'Grid Eruption' }
                    ]}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'effect' }}
                />
            </LabelGroup>
            <Button
                text='Restart'
                onClick={() => {
                    observer.emit('restart');
                }}
            />
            <Button
                text='Prev'
                onClick={() => {
                    observer.emit('prev');
                }}
            />
            <Button
                text='Next'
                onClick={() => {
                    observer.emit('next');
                }}
            />
        </>
    );
}
