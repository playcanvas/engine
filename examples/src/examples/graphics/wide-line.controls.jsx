import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
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
    const link = (path) => ({ observer, path: `settings.${path}` });
    const binding = () => new BindingTwoWay();
    const slider = (path, min, max, precision = 1) => (
        <SliderInput
            binding={binding()}
            link={link(path)}
            min={min}
            max={max}
            precision={precision}
        />
    );
    const toggle = (path) => (
        <BooleanInput type='toggle' binding={binding()} link={link(path)} />
    );

    return (
        <>
            <Panel headerText='Geometry'>
                <LabelGroup text='Points'>{slider('points', 8, 256, 0)}</LabelGroup>
                <LabelGroup text='Amplitude'>{slider('amplitude', 0, 5, 2)}</LabelGroup>
                <LabelGroup text='Frequency'>{slider('frequency', 0.25, 4, 2)}</LabelGroup>
                <LabelGroup text='Start Width'>{slider('startWidth', 0, 40, 1)}</LabelGroup>
                <LabelGroup text='End Width'>{slider('endWidth', 0, 40, 1)}</LabelGroup>
                <LabelGroup text='Start Color'>
                    <ColorPicker binding={binding()} link={link('startColor')} channels={3} />
                </LabelGroup>
                <LabelGroup text='End Color'>
                    <ColorPicker binding={binding()} link={link('endColor')} channels={3} />
                </LabelGroup>
                <LabelGroup text='Closed'>{toggle('closed')}</LabelGroup>
            </Panel>
            <Panel headerText='Style'>
                <LabelGroup text='Cap'>
                    <SelectInput
                        binding={binding()}
                        link={link('cap')}
                        type='string'
                        options={[
                            { v: 'Butt', t: 'Butt' },
                            { v: 'Square', t: 'Square' },
                            { v: 'Round', t: 'Round' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Join'>
                    <SelectInput
                        binding={binding()}
                        link={link('join')}
                        type='string'
                        options={[
                            { v: 'Miter', t: 'Miter' },
                            { v: 'Bevel', t: 'Bevel' },
                            { v: 'Round', t: 'Round' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Dash Length'>{slider('dashLength', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Gap Length'>{slider('gapLength', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Dash Offset'>{slider('dashOffset', -8, 8, 2)}</LabelGroup>
            </Panel>
        </>
    );
}
