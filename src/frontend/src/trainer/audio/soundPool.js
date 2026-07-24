// A small, bounded pool of one-shot voices per sound effect. The AudioBuffer
// is decoded/synthesized exactly once (by trainerAudio.js) and reused —
// AudioBufferSourceNode itself is a cheap, single-use Web Audio primitive by
// design, so "pooling" here means bounding *concurrent* voices rather than
// pre-allocating nodes: if more shots land than `maxVoices` can hold at once
// (e.g. several clicks in the same frame), the oldest voice is stopped and
// evicted instead of letting the graph grow unbounded. Never an
// HTMLAudioElement, never created per-shot beyond this lightweight node.
//
// Takes an injected `context` (only needs createBufferSource/createGain) so
// this stays testable with a fake context, no real Web Audio required.
export class SoundPool {
  constructor(context, buffer, destination, { maxVoices = 6 } = {}) {
    this.context = context
    this.buffer = buffer
    this.destination = destination
    this.maxVoices = maxVoices
    this.voices = []
  }

  play(gainValue = 1) {
    if (!this.buffer || !this.context) return null
    if (this.voices.length >= this.maxVoices) {
      const oldest = this.voices.shift()
      try { oldest.stop() } catch { /* already stopped/ended */ }
    }

    const source = this.context.createBufferSource()
    source.buffer = this.buffer
    const gain = this.context.createGain()
    gain.gain.value = gainValue
    source.connect(gain)
    gain.connect(this.destination)
    source.onended = () => {
      const idx = this.voices.indexOf(source)
      if (idx !== -1) this.voices.splice(idx, 1)
    }
    source.start(0)
    this.voices.push(source)
    return source
  }

  dispose() {
    for (const voice of this.voices) {
      try { voice.stop() } catch { /* already stopped/ended */ }
    }
    this.voices = []
  }
}
