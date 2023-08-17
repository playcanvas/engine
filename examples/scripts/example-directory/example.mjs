/**
 * @param {object} options - The options.
 * @param {string} options.path - The path.
 * @param {string} options.exampleTitle - The example title.
 * @param {string} options.largeThumbnailName - The large thumbnail name.
 * @returns {string}
 */
function template({ path, exampleTitle, largeThumbnailName }) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url='/#/${path}'" />
    <meta name="twitter:card" content="photo" />
    <meta name="twitter:site" content="@playcanvas" />
    <meta name="twitter:title" content="${exampleTitle}" />
    <meta name="twitter:description" content="A PlayCanvas engine example" />
    <meta name="twitter:image" content="https://playcanvas.github.io/thumbnails/${largeThumbnailName}.png" />
    <meta name="twitter:url" content="https://playcanvas.github.io/${path}" />
  </head>
  <body>
    <p>Please follow <a href="/#/${path}">this link</a>.</p>
  </body>
</html>`;
}
export { template };
