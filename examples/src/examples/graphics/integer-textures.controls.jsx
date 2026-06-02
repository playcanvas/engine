import {
    BindingTwoWay,
    Container,
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
            <Panel headerText='Sand simulation'>
                <LabelGroup text='Brush'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.brush' }}
                        type='string'
                        value={1}
                        options={[
                            { v: 1, t: 'Sand' },
                            { v: 2, t: 'Orange Sand' },
                            { v: 3, t: 'Gray Sand' },
                            { v: 4, t: 'Stone' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Brush size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'options.brushSize' }}
                        value={8}
                        min={1}
                        max={16}
                        precision={0}
                    />
                </LabelGroup>
                <Container flex flexGrow={1}>
                    <Button text='Reset' onClick={() => observer.emit('reset')} />
                </Container>
            </Panel>
        </>
    );
}
