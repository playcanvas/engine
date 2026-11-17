import {
    BindingTwoWay,
    LabelGroup,
    SelectInput,
    SliderInput,
    Button,
    Panel
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
            <Panel headerText='Renderer'>
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
            </Panel>
            <Panel headerText='Editor Settings'>
                <Button text='Select' onClick={() => observer.emit('select')} />
                <LabelGroup text='Box Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'boxSize' }}
                        min={0.1}
                        max={5.0}
                        precision={2}
                    />
                </LabelGroup>
                <Button text='Delete Selected' onClick={() => observer.emit('deleteSelected')} />
                <Button text='Clone Selected' onClick={() => observer.emit('cloneSelected')} />
            </Panel>
        </>
    );
}
