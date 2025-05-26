// @ts-check

/**
 * @param {string} avatarURL
 */
export async function overlayAvatar(avatarURL) {

  const png = await fetch('https://corsproxy.io/' + avatarURL).then(r => r.blob());
  const dataURI = await readBlob(png);

  const img = await awaitImageOnload(dataURI);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  canvas.style.cssText = 'position: absolute; top: -9999px; left: -9999px; pointer-events: none;';
  const scratchCtx = canvas.getContext('2d');
  if (!scratchCtx) {
    // TODO: restore the icon?
    return;
  }

  scratchCtx.filter = 'grayscale(0.4) contrast(1.5)';

  //drawing code
  scratchCtx.clearRect(0, 0, canvas.width, canvas.height);

  scratchCtx.globalCompositeOperation = 'source-over'; //default

  //Do whatever drawing you want. In your case, draw your image.
  scratchCtx.drawImage(img, 8, 8, 116, 116);

  //As long as we can represent our clipping region as a single path, 
  //we can perform our clipping by using a non-default composite operation.
  //You can think of destination-in as "write alpha". It will not touch
  //the color channel of the canvas, but will replace the alpha channel.
  //(Actually, it will multiply the already drawn alpha with the alpha
  //currently being drawn - meaning that things look good where two anti-
  //aliased pixels overlap.)
  //
  //If you can't represent the clipping region as a single path, you can
  //always draw your clip shape into yet another scratch canvas.

  scratchCtx.fillStyle = '#fff'; //color doesn't matter, but we want full opacity
  scratchCtx.globalCompositeOperation = 'destination-in';
  scratchCtx.beginPath();
  scratchCtx.arc(64, 64, 64, 0, 2 * Math.PI, true);
  scratchCtx.closePath();
  scratchCtx.fill();

  scratchCtx.strokeStyle = '#000';
  scratchCtx.lineWidth = 8;
  scratchCtx.globalCompositeOperation = 'source-over'; //default
  scratchCtx.beginPath();
  scratchCtx.arc(64, 64, 60, 0, 2 * Math.PI, true);
  scratchCtx.closePath();
  scratchCtx.stroke();


  const imgData = canvas.toDataURL();
  return imgData;
}

/**
 * @param {string} src
 * @return {Promise<HTMLImageElement>}
 */
function awaitImageOnload(src) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (event, source, lineno, colno, error) => reject(error || event);
  });
}

/** @param {Blob} b */
function readBlob(b) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onloadend = function () {
      resolve(reader.result);
    };

    reader.onerror = function () {
      reject(reader.error);
    };

    reader.readAsDataURL(b);
  });
}
