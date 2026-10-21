// Uses the image tooling already installed with Expo. Keep assets/logo.png as the original.
const fs = require('node:fs/promises');
const path = require('node:path');
const { getJimpImageAsync } = require('@expo/image-utils/build/jimp');
const { createSquareAsync } = require('@expo/image-utils');

const root = path.resolve(__dirname, '..');
const background = '#12112e';

async function main() {
  const original = await getJimpImageAsync(path.join(root, 'assets/logo.png'));
  const { width, height } = original.bitmap;
  // Approved artwork: 736 x 552 with the icon centered in a large backdrop.
  // These normalized bounds remove that backdrop without changing the artwork.
  const side = Math.round(Math.min(width * 320 / 736, height * 320 / 552));
  const left = Math.round(width / 2 - side / 2);
  const top = Math.round(height / 2 - side / 2);
  const mark = original.clone().crop(left, top, side, side);
  const square = await getJimpImageAsync(await createSquareAsync({ size: 1024, color: background }));
  square.composite(mark.clone().resize(1024, 1024), 0, 0);

  await fs.mkdir(path.join(root, 'public/icons'), { recursive: true });
  async function save(image, file, size) {
    await image.clone().resize(size, size).writeAsync(path.join(root, file));
    console.log(`${file} (${size} x ${size})`);
  }
  await save(square, 'assets/icon.png', 1024);
  await save(square, 'assets/favicon.png', 48);
  await save(square, 'public/icons/icon-192.png', 192);
  await save(square, 'public/icons/icon-512.png', 512);
  await save(square, 'public/apple-touch-icon.png', 180);

  // Padding keeps the stacked tiles inside Android and browser mask safe areas.
  const adaptive = await getJimpImageAsync(await createSquareAsync({ size: 1024, color: '#00000000' }));
  adaptive.composite(square.clone().resize(640, 640), 192, 192);
  await save(adaptive, 'assets/adaptive-icon.png', 1024);
  const maskable = await getJimpImageAsync(await createSquareAsync({ size: 1024, color: background }));
  maskable.composite(square.clone().resize(576, 576), 224, 224);
  await save(maskable, 'public/icons/icon-maskable-512.png', 512);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
