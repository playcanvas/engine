import {
    BindingTwoWay,
    BooleanInput,
    Button,
    LabelGroup,
    Panel,
    SliderInput,
    SelectInput
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
            <Panel headerText='Compute Radix Sort'>
                <LabelGroup text='Elements (K)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.elementsK' }}
                        min={1}
                        max={30000}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Bits'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.bits' }}
                        options={[
                            { v: 8, t: '8 bits' },
                            { v: 16, t: '16 bits' },
                            { v: 24, t: '24 bits' },
                            { v: 32, t: '32 bits' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Radix mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.mode' }}
                        type='string'
                        options={[
                            { v: '4-shared-mem', t: '4-bit shared (portable)' },
                            { v: 'onesweep', t: 'OneSweep (fused, NVIDIA)' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Render'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.render' }}
                    />
                </LabelGroup>
                <LabelGroup text='Validation'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.validation' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Benchmark'>
                <LabelGroup text='Run up to'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.benchMaxElements' }}
                        options={[
                            { v: 100_000, t: '100K' },
                            { v: 500_000, t: '500K' },
                            { v: 1_000_000, t: '1M' },
                            { v: 2_000_000, t: '2M' },
                            { v: 3_000_000, t: '3M' },
                            { v: 4_000_000, t: '4M' },
                            { v: 5_000_000, t: '5M' },
                            { v: 6_000_000, t: '6M' },
                            { v: 8_000_000, t: '8M' },
                            { v: 10_000_000, t: '10M' },
                            { v: 15_000_000, t: '15M' },
                            { v: 20_000_000, t: '20M' },
                            { v: 25_000_000, t: '25M' },
                            { v: 30_000_000, t: '30M' },
                            { v: 40_000_000, t: '40M' },
                            { v: 50_000_000, t: '50M' }
                        ]}
                    />
                </LabelGroup>
                <Button
                    text='Run'
                    onClick={() => {
                        observer.emit('benchmark');
                    }}
                />
                <Button
                    text='Validate'
                    onClick={() => {
                        observer.emit('validate');
                    }}
                />
            </Panel>
        </>
    );
}
