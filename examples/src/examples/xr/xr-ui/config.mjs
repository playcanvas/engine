/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    FILES: {
        'ui.html': /* html */`
            <div class='container'>
                <div class='button' data-xr='immersive-ar'>AR</div>
                <div class='button' data-xr='immersive-vr'>VR</div>
            </div>
            <div class='message'></div>
        `,
        'ui.css': /* css */`
            body {
                font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
            }
            .container {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: auto;
                height: auto;
                flex-wrap: nowrap;
                justify-content: center;
                align-items: center;
            }
            .container > .button {
                padding: 32px;
                margin: 8px;
                color: #fff;
                background-color: rgba(0, 0, 0, 0.5);
                font-size: 24px;
                font-weight: bold;
                opacity: 0.3;
                cursor: default;
                user-select: none;
            }
            .container > .button.active {
                opacity: 1;
                cursor: pointer;
            }
            .container > .button.active:hover {
                background-color: rgba(0, 0, 0, 1);
            }
            .message {
                position: absolute;
                margin: 8px;
                bottom: 0;
                right: 0;
                padding: 8px 16px;
                color: #fff;
                background-color: rgba(0, 0, 0, 0.5);
            }
            @media only screen and (max-width: 600px) {
                .message {
                    bottom: 80px;
                }
            }
        `,
        'text.txt': `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur pellentesque mauris in lorem efficitur, nec bibendum nisi iaculis. Curabitur ac convallis tellus, et egestas sapien. Aliquam tincidunt, est sit amet convallis ultricies, turpis eros lobortis sapien, a vehicula erat odio ut odio. Aliquam a posuere leo. Fusce dictum nisi enim, pharetra egestas nisi varius at. Duis porttitor vulputate egestas. Sed sed tellus pulvinar, pretium nulla at, gravida velit. Ut dignissim finibus ullamcorper. Fusce et quam id justo blandit posuere. Nulla hendrerit tellus ut enim egestas, et ullamcorper erat fermentum. Curabitur viverra mauris ut ex sollicitudin egestas. Proin tempor scelerisque mi eu pellentesque. Nunc accumsan volutpat rutrum. Duis posuere congue odio, et venenatis ante bibendum ut. Cras faucibus enim id fringilla tincidunt. Aenean sodales nisi blandit nibh interdum, eget rhoncus lorem egestas.\n\n\Donec posuere, massa in lacinia venenatis, risus libero blandit libero, non gravida erat eros tempor augue. Etiam eget fringilla mauris. Nunc fringilla risus pharetra augue congue, quis viverra massa sagittis. Sed tortor diam, maximus sodales leo ut, consequat cursus felis. Sed feugiat rutrum sem, quis porta metus ullamcorper non. Nullam commodo diam sit amet laoreet mollis. Aliquam erat volutpat. Ut dictum at elit eu mollis. Aenean id massa congue velit ornare lacinia vitae vel elit. Ut ex metus, tincidunt vitae diam non, tincidunt eleifend sem. Integer efficitur odio malesuada dolor tincidunt, ac cursus lacus imperdiet. Praesent elementum turpis vel placerat ullamcorper. Sed pharetra sodales sem eu placerat. Duis ultrices, velit ac imperdiet accumsan, purus mauris porttitor turpis, id tempor odio nunc vitae mauris. Sed rutrum, nulla sed varius cursus, erat lectus efficitur nisi, et dignissim lorem lorem eu urna. Vestibulum at lacus gravida, volutpat nisi sed, euismod sapien.`
    }
};
