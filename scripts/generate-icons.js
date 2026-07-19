#!/usr/bin/env node
'use strict'

/**
 * Regenerates every raster/icon format from the vector masters in
 * assets/brand/ — the single source of truth for the FiveM PvP Trainer
 * brand mark (crosshair, cyan→purple gradient, matches theme.js).
 *
 * Run after editing any assets/brand/*.svg file:
 *   node scripts/generate-icons.js
 *
 * Outputs:
 *   build/icon.ico              — multi-res Windows icon (electron-builder: exe/installer/taskbar)
 *   electron/icon.ico           — same file, read directly by electron/main.js BrowserWindow
 *   site/favicon.ico            — same file, landing page favicon
 *   site/apple-touch-icon.png   — 180x180, landing page
 *   site/og-image.png           — 1200x630, Open Graph / Twitter card
 *   src/frontend/public/favicon.svg — transparent master, served at /favicon.svg (app + site)
 */

const fs    = require('fs')
const path  = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico').default

const ROOT  = path.join(__dirname, '..')
const BRAND = path.join(ROOT, 'assets', 'brand')

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function renderPng(svgPath, size) {
  return sharp(svgPath, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer()
}

async function buildIco() {
  const svgPath = path.join(BRAND, 'logo-dark-bg.svg')
  const pngBuffers = await Promise.all(ICO_SIZES.map((size) => renderPng(svgPath, size)))
  const icoBuffer = await pngToIco(pngBuffers)

  const destinations = [
    path.join(ROOT, 'build', 'icon.ico'),
    path.join(ROOT, 'electron', 'icon.ico'),
    path.join(ROOT, 'site', 'favicon.ico'),
  ]
  for (const dest of destinations) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, icoBuffer)
    console.log(`  wrote ${path.relative(ROOT, dest)}`)
  }
}

async function buildAppleTouchIcon() {
  const svgPath = path.join(BRAND, 'logo-dark-bg.svg')
  const buffer  = await renderPng(svgPath, 180)
  const dest    = path.join(ROOT, 'site', 'apple-touch-icon.png')
  fs.writeFileSync(dest, buffer)
  console.log(`  wrote ${path.relative(ROOT, dest)}`)
}

async function buildOgImage() {
  const svgPath = path.join(BRAND, 'og-template.svg')
  const buffer  = await sharp(svgPath, { density: 384 }).resize(1200, 630).png().toBuffer()
  const dest    = path.join(ROOT, 'site', 'og-image.png')
  fs.writeFileSync(dest, buffer)
  console.log(`  wrote ${path.relative(ROOT, dest)}`)
}

async function copyFrontendFavicon() {
  const src  = path.join(BRAND, 'logo.svg')
  const dest = path.join(ROOT, 'src', 'frontend', 'public', 'favicon.svg')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`  wrote ${path.relative(ROOT, dest)}`)
}

async function copySiteFavicon() {
  const src  = path.join(BRAND, 'logo.svg')
  const dest = path.join(ROOT, 'site', 'favicon.svg')
  fs.copyFileSync(src, dest)
  console.log(`  wrote ${path.relative(ROOT, dest)}`)
}

async function main() {
  console.log('Generating icons from assets/brand/ ...')
  await buildIco()
  await buildAppleTouchIcon()
  await buildOgImage()
  await copyFrontendFavicon()
  await copySiteFavicon()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
