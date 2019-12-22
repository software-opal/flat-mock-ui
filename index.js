#!/usr/bin/env node
const pug = require('pug');
const sass = require('node-sass');
const fs = require('fs').promises;
const path = require('path');


function loadStylesheet(styleFile) {
  return new Promise((resolve, reject) => {
    sass.render({
      file: styleFile,
    }, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}
async function loadScripts(files) {
  const allFiles = await Promise.all(files.map(async (file) => {
    const reader = await fs.readFile(file);
    return reader.toString();
  }));
  return allFiles.join('\n');
}

async function* walkdir(dir) {
  for await (const entry of await fs.opendir(dir)) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkdir(p);
    } else if (entry.isFile()) {
      yield p;
    }
  }
}

function renderPug(filename, options = {}) {
  return new Promise((resolve, reject) => {
    pug.renderFile(filename, options, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

function script() {
  function renderElement(e) {
    console.log(e);
    const scale = 4;
    return html2canvas(e, {
      scale,
      width: e.offsetWidth + 20,
      height: e.offsetHeight + 20,
      backgroundColor: 'rgba(0,0,0,0)',
    }).then((canvas) => {
      const { width, height } = canvas;
      const ctx = canvas.getContext('2d');

      const imageBox = {};

      for (let i = 0; i < width; i += 1) {
        const [r, g, b, a] = ctx.getImageData(i, height / 2, 1, 1).data;
        if (!(r === 0 && g === 0 && b === 0 && a === 0)) {
          imageBox.left = i;
          break;
        }
      }
      for (let i = width; i > 0; i -= 1) {
        const [r, g, b, a] = ctx.getImageData(i, height / 2, 1, 1).data;
        if (!(r === 0 && g === 0 && b === 0 && a === 0)) {
          imageBox.right = i;
          break;
        }
      }
      for (let i = 0; i < height; i += 1) {
        const [r, g, b, a] = ctx.getImageData(width / 2, i, 1, 1).data;
        if (!(r === 0 && g === 0 && b === 0 && a === 0)) {
          imageBox.top = i;
          break;
        }
      }
      for (let i = height; i > 0; i -= 1) {
        const [r, g, b, a] = ctx.getImageData(width / 2, i, 1, 1).data;
        if (!(r === 0 && g === 0 && b === 0 && a === 0)) {
          imageBox.bottom = i;
          break;
        }
      }

      const newWidth = (imageBox.right - imageBox.left) + 1;
      const newHeight = (imageBox.bottom - imageBox.top) + 1;
      const imageData = ctx.getImageData(imageBox.left, imageBox.top, newWidth, newHeight);
      canvas.width = newWidth;
      canvas.height = newHeight;
      canvas.style.width = `${newWidth / scale}px`;
      canvas.style.height = `${newHeight / scale}px`;
      ctx.fillStyle = 'red';
      ctx.clearRect(0, 0, newWidth, newHeight);
      ctx.fillRect(0, 0, newWidth, newHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.putImageData(imageData, 0, 0);

      return canvas;
    });
  }
  function renderAll() {
    ((table) => {
      Promise.all(
        Array
          .from(table.getElementsByTagName('tr'))
          .map((e) => {
          }),
      ).then(() => {
        const e = document.createElement('span');
        e.innerText = 'All done!';
        table.parentElement.insertBefore(e, table);
      }).catch((error) => {
        console.error(error);
        const e = document.createElement('span');
        e.innerText = `Error!${error}`;
        table.parentElement.insertBefore(e, table);
      });
    })(document.getElementById('forms'));
  }
  function renderOne(tr_element) {
    const tds = tr_element.getElementsByTagName('td');
    const a = tds[0].getElementsByTagName('a')[0];
    let oldCanvas = tds[0].getElementsByTagName('canvas')[0];
    if (!oldCanvas) {
      oldCanvas = document.createElement('canvas');
      a.parentElement.append(document.createElement('br'));
      a.parentElement.append(oldCanvas);
    }
    const child = tds[1].children[0].children[0];
    if (child) {
      return renderElement(child).then((canvas) => {
        a.href = canvas.toDataURL('image/png');
        a.download = `${a.dataset.filename}.png`;
        oldCanvas.parentElement.replaceChild(canvas, oldCanvas);
      });
    }
    return Promise.resolve(null);
  }
  window.renderAll = renderAll;
  window.renderOne = renderOne;
}

function getScript() {
  return `${script.toString()};`;
}


async function render({ input, output, style }) {
  const stylesheet = loadStylesheet(style, { style: 'compact' });
  const scripts = loadScripts([
    'node_modules/html2canvas/dist/html2canvas.min.js',
  ]);
  const entries = [];
  for await (const entry of walkdir(input)) {
    try {
      const form = await renderPug(entry);
      entries.push([entry, form]);
    } catch (e) {
      throw { error: e, filename: entry };
    }
  }
  const tableRows = entries.map(([filename, data], i) => {
    filename = filename.replace(/\\/g, '/');
    const name = filename.replace(/\\\//g, '_').replace('.pug', '').replace(/[^-_a-zA-Z0-9]/g, '_');
    const id = `${i}__${name}`
    return `
      <tr id="row__${id}">
        <td>
          <a data-filename="${name}">Download ${filename}</a>
          <span style="padding: 10px"></span>
          <button onclick="renderOne(document.getElementById('row__${id}'))">Render ${filename}</button>
        </td>
        <td align="right">
          <div>
            ${data}
          </div>
        </td>
      </tr>
    `;
  }).join('\n');

  const outputHtml = `
<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>Flat UI :: ${new Date().toLocaleString()}</title>
    <style type="text/css">
      ${(await stylesheet).css}
    </style>
  </head>
  <button onclick="renderAll()">Generate</button>
  <table id="forms" style="min-width: 100%">
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <script>
    (function() {
      ${await scripts}
    }());
  </script>
  <script>
    (function() {
      'use strict';
      ${getScript()}
      script();
    }());
  </script>
  </body>
</html>
`;
  await fs.writeFile(output, outputHtml);
}

render({
  input: 'views',
  output: 'renders.html',
  style: 'style.scss',
}).catch((e) => console.error(e));
