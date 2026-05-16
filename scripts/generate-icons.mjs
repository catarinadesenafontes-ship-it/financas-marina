import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('./public/icon.svg')

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`./public/icon-${size}.png`)
  console.log(`✓ icon-${size}.png gerado`)
}

console.log('Ícones PWA gerados com sucesso!')
