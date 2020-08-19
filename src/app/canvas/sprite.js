// setup a spritesheet parser
export default function initSpritesheet(src, size) {
  // create the image using the given source
  const img = new Image();
  img.src = src;

  // handler to render a single sprite from the spritesheet
  const draw = (tx, ty) => (ctx, {x=0, y=0, rot=0, flipH=false, flipV=false}) => {
    // if there's a rotation or a flip, render differently
    if (ctx.rot !== 0 || ctx.flipH || ctx.flipV) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      if (rot !== 0)
        ctx.rotate(rot);
      ctx.drawImage(img, tx * size, ty * size, size, size, - size/2, - size/2, size, size);
      ctx.restore();

    } else {
      // otherwise render the image upright
      ctx.drawImage(img, tx * size, ty * size, size, size, x - size/2, y - size/2, size, size);
    }
  };

  // resolve when the image has loaded
  return new Promise((resolve, reject) =>{
    img.onload = () => resolve(draw);
    img.onerror = reject;
  })
}
