'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { parseFivemRegistryCommand } = require('./fivemLocator')

test('parses quoted exe path with "%1" argument (typical FiveM installer output)', () => {
  const stdout = `
HKEY_CURRENT_USER\\Software\\Classes\\FiveM.ProtocolHandler\\shell\\open\\command
    (Default)    REG_SZ    "C:\\Users\\user\\AppData\\Local\\FiveM.app\\FiveM.exe" "%1"

`
  assert.equal(
    parseFivemRegistryCommand(stdout),
    'C:\\Users\\user\\AppData\\Local\\FiveM.app\\FiveM.exe'
  )
})

test('parses unquoted exe path followed by %1', () => {
  const stdout = `
HKEY_CURRENT_USER\\Software\\Classes\\fivem\\shell\\open\\command
    (Default)    REG_SZ    C:\\FiveM\\FiveM.exe %1

`
  assert.equal(parseFivemRegistryCommand(stdout), 'C:\\FiveM\\FiveM.exe')
})

test('parses quoted exe path with no arguments', () => {
  const stdout = '    (Default)    REG_SZ    "D:\\Games\\FiveM\\FiveM.exe"'
  assert.equal(parseFivemRegistryCommand(stdout), 'D:\\Games\\FiveM\\FiveM.exe')
})

test('returns null when there is no REG_SZ value (key not found)', () => {
  const stdout = 'ERROR: The system was unable to find the specified registry key or value.'
  assert.equal(parseFivemRegistryCommand(stdout), null)
})

test('returns null for empty/undefined input', () => {
  assert.equal(parseFivemRegistryCommand(''), null)
  assert.equal(parseFivemRegistryCommand(undefined), null)
})
