#!/usr/bin/env node
'use strict'

/**
 * Release script — bumps version, builds React, publishes to GitHub Releases.
 *
 * Usage:
 *   npm run release           → patch bump (1.0.0 → 1.0.1)
 *   npm run release minor     → minor bump (1.0.0 → 1.1.0)
 *   npm run release major     → major bump (1.0.0 → 2.0.0)
 *
 * Requires GH_TOKEN env var (or uses `gh auth token` from GitHub CLI).
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT  = path.join(__dirname, '..')
const bump  = process.argv[2] || 'patch'

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`❌  Usage: npm run release [patch|minor|major]`)
  process.exit(1)
}

// ── Resolve GH_TOKEN ──────────────────────────────────────────────────────────
let GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''

if (!GH_TOKEN) {
  // Try GitHub CLI
  const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) {
    GH_TOKEN = r.stdout.trim()
    console.log('  Using token from `gh auth token`')
  }
}

if (!GH_TOKEN) {
  console.error('❌  GH_TOKEN not found.')
  console.error('    Set it with: export GH_TOKEN=your_github_pat')
  console.error('    Or authenticate the GitHub CLI: gh auth login')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, GH_TOKEN }, ...opts })
}

function runIn(dir, cmd) {
  run(cmd, { cwd: path.join(ROOT, dir) })
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🚀  Starting ${bump} release…\n`)

// 1. Bump version in package.json (without git tag yet)
run(`npm version ${bump} --no-git-tag-version`)

// Re-read bumped version
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
console.log(`\n📦  Releasing v${version}`)

// 2. Build React frontend
console.log('\n⚛️   Building React frontend…')
runIn('src/frontend', 'npm run build')

// 3. Stage all tracked changes + built assets, commit, then tag
run(`git add -A`)
run(`git commit -m "chore: release v${version}"`)
run(`git tag v${version}`)

// 4. Build Electron + publish to GitHub Releases
console.log('\n🔨  Building Electron installer and publishing to GitHub Releases…')
run('npx electron-builder --publish always')

// 5. Push commits + tag
run(`git push origin master --follow-tags`)

console.log(`\n✅  v${version} released!`)
console.log(`    Users with the app installed will be notified automatically on next launch.`)
console.log(`    GitHub Release: https://github.com/KSKluc4/fivem-pvp-trainer/releases/tag/v${version}`)
