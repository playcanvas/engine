import {
    BindingTwoWay,
    LabelGroup,
    SelectInput,
    BooleanInput,
    Button
} from '@playcanvas/pcui/react';

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
                        { v: 'hide', t: 'Statue Hide' },
                        { v: 'reveal', t: 'Statue Reveal' },
                        { v: 'tint', t: 'Statue Tint' },
                        { v: 'untint', t: 'Statue Untint' },
                        { v: 'roomHide', t: 'Room Hide' },
                        { v: 'roomReveal', t: 'Room Reveal' },
                        { v: 'roomTint', t: 'Room Tint' },
                        { v: 'roomUntint', t: 'Room Untint' }
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
            <LabelGroup text='Enabled'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'enabled' }}
                />
            </LabelGroup>
        </>
    );
}
