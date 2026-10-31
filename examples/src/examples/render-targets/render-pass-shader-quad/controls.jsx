import {
    BindingTwoWay,
    BooleanInput,
    Button,
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
    return (
        <>
            <Panel headerText='Brushes'>
                <LabelGroup text='Count'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.count' }}
                        min={1}
                        max={8}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.size' }}
                        min={8}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.speed' }}
                        min={0.1}
                        max={4}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Blend'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.blend' }}
                        type='string'
                        options={[
                            { v: 'add', t: 'Additive' },
                            { v: 'normal', t: 'Normal' },
                            { v: 'lighten', t: 'Lighten' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Canvas'>
                <LabelGroup text='Trail length'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.trail' }}
                        min={0.1}
                        max={6}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Border'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.border' }}
                    />
                </LabelGroup>
                <Button text='Clear' onClick={() => observer.emit('clear')} />
            </Panel>
        </>
    );
}
