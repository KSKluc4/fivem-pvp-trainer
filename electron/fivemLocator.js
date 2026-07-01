'use strict'

// Resolves the local path to FiveM.exe so we can spawn it directly with a
// fivem:// URL instead of relying on shell.openExternal, which silently does
// nothing on machines where the fivem:// protocol handler is registered
// incompletely (URL Protocol key present, shell\open\command missing/broken).

const { execFile } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')

const execFileAsync = promisify(execFile)

// Checked in order — FiveM registers one of these depending on installer version.
const FIVEM_REGISTRY_KEYS = [
  'HKCU\\Software\\Classes\\FiveM.ProtocolHandler\\shell\\open\\command',
  'HKCU\\Software\\Classes\\fivem\\shell\\open\\command',
]

const FIVEM_FIXED_PATHS = [
  path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'FiveM.exe'),
  'C:\\FiveM\\FiveM.exe',
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'FiveM', 'FiveM.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'FiveM', 'FiveM.exe'),
]

// Parses the "(Default)    REG_SZ    <value>" line from `reg query <key> /ve`
// output and extracts the executable path out of a shell command string such as
// `"C:\path\FiveM.exe" "%1"` or the unquoted `C:\path\FiveM.exe %1`.
function parseFivemRegistryCommand(stdout) {
  if (!stdout) return null
  const match = stdout.match(/REG_SZ\s+(.+)/)
  if (!match) return null
  const raw = match[1].trim()
  if (!raw) return null

  const quoted = raw.match(/^"([^"]+)"/)
  if (quoted) return quoted[1]

  const argIdx = raw.indexOf(' %')
  const bare = argIdx === -1 ? raw : raw.slice(0, argIdx)
  return bare.trim() || null
}

let cachedResolved = null // { path, source: 'registry' | 'path' }

async function queryFivemPathFromRegistry(log) {
  for (const key of FIVEM_REGISTRY_KEYS) {
    try {
      log?.info('fivemLocator: querying registry key:', key)
      const { stdout } = await execFileAsync('reg.exe', ['query', key, '/ve'])
      const exePath = parseFivemRegistryCommand(stdout)
      if (exePath && fs.existsSync(exePath)) {
        log?.info('fivemLocator: resolved FiveM.exe from registry:', exePath, 'key:', key)
        return exePath
      }
      log?.warn('fivemLocator: registry key present but exe path invalid/missing:', key, exePath)
    } catch (e) {
      log?.warn('fivemLocator: registry key not found or query failed:', key, e?.message || e)
    }
  }
  return null
}

async function resolveFivemExePath(log) {
  if (cachedResolved) return cachedResolved

  const fromRegistry = await queryFivemPathFromRegistry(log)
  if (fromRegistry) {
    cachedResolved = { path: fromRegistry, source: 'registry' }
    return cachedResolved
  }

  const fromFixedPaths = FIVEM_FIXED_PATHS.find((p) => p && fs.existsSync(p))
  if (fromFixedPaths) {
    log?.info('fivemLocator: resolved FiveM.exe from fixed install paths:', fromFixedPaths)
    cachedResolved = { path: fromFixedPaths, source: 'path' }
    return cachedResolved
  }

  log?.warn('fivemLocator: FiveM.exe not found via registry or fixed paths')
  return null
}

function clearFivemPathCache() {
  cachedResolved = null
}

module.exports = {
  parseFivemRegistryCommand,
  queryFivemPathFromRegistry,
  resolveFivemExePath,
  clearFivemPathCache,
  FIVEM_REGISTRY_KEYS,
  FIVEM_FIXED_PATHS,
}
