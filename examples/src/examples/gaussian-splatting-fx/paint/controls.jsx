import {
    BindingTwoWay,
    LabelGroup,
    ColorPicker,
    SelectInput,
    SliderInput,
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
            <Panel headerText='Paint Settings'>
                <LabelGroup text='Paint Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'paintColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'paintIntensity' }}
                        min={0.1}
                        max={1.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Brush Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'brushSize' }}
                        min={0.05}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
