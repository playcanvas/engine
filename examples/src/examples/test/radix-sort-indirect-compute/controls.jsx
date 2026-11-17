import { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput } from '@playcanvas/pcui/react';

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
            <Panel headerText='Indirect Radix Sort Test'>
                <LabelGroup text='Elements (K)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.elementsK' }}
                        min={1}
                        max={10000}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Bits'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.bits' }}
                        options={[
                            { v: 4, t: '4 bits (1 pass)' },
                            { v: 8, t: '8 bits (2 passes)' },
                            { v: 12, t: '12 bits (3 passes)' },
                            { v: 16, t: '16 bits (4 passes)' },
                            { v: 20, t: '20 bits (5 passes)' },
                            { v: 24, t: '24 bits (6 passes)' },
                            { v: 28, t: '28 bits (7 passes)' },
                            { v: 32, t: '32 bits (8 passes)' }
                        ]}
                    />
                </LabelGroup>
                {/* Visible count auto-oscillates (10%-90%) to simulate camera rotation */}
            </Panel>
        </>
    );
}
