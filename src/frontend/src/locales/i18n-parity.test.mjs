// Guards against the pt/en locale files drifting apart — a key added to one
// and forgotten in the other would otherwise only surface as a raw i18next
// key showing up on screen in whichever language was missed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const pt  = JSON.parse(readFileSync(path.join(dir, 'pt', 'translation.json'), 'utf8'))
const en  = JSON.parse(readFileSync(path.join(dir, 'en', 'translation.json'), 'utf8'))

function flattenKeys(obj, prefix = '') {
  let keys = []
  for (const k of Object.keys(obj)) {
    const value = obj[k]
    const full  = prefix ? `${prefix}.${k}` : k
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

test('pt and en translation files have exactly the same keys', () => {
  const ptKeys = new Set(flattenKeys(pt))
  const enKeys = new Set(flattenKeys(en))

  const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k)).sort()
  const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k)).sort()

  assert.deepEqual(missingInEn, [], `Keys present in pt but missing in en: ${missingInEn.join(', ')}`)
  assert.deepEqual(missingInPt, [], `Keys present in en but missing in pt: ${missingInPt.join(', ')}`)
})

test('no translation value is an empty string', () => {
  function collectEmpty(obj, prefix, lang) {
    let empties = []
    for (const k of Object.keys(obj)) {
      const value = obj[k]
      const full  = prefix ? `${prefix}.${k}` : k
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        empties = empties.concat(collectEmpty(value, full, lang))
      } else if (value === '') {
        empties.push(`${lang}:${full}`)
      }
    }
    return empties
  }

  const empties = [...collectEmpty(pt, '', 'pt'), ...collectEmpty(en, '', 'en')]
  assert.deepEqual(empties, [], `Empty translation values found: ${empties.join(', ')}`)
})
