import { GAME_SIZE } from '../../constants.js';

const $ = document.querySelector.bind(document);

import initSpritesheet from './sprite.js';

// setup a canvas
export default async function initCanvas() {
  const sheet = await initSpritesheet('public/spritesheet.png', 16);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  ctx.canvas.width = GAME_SIZE;
  ctx.canvas.height = GAME_SIZE;

  return fn => {
    let last = Date.now();

    // render loop
    function render() {
      // calculate time between frames (delta time)
      const now = Date.now();
      const delta = (now - last)/1000;
      last = now;

      // draw background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
      ctx.save();
      ctx.translate(GAME_SIZE/2, GAME_SIZE/2);

      // run the passed in render fn
      fn(ctx, {sheet, delta, now});

      ctx.restore();

      window.requestAnimationFrame(render);
    };

    window.requestAnimationFrame(render);
  };
}
