// AudioEngine.js — Procedural Web Audio for sound effects and background music
// Guard: no-ops in Node.js (server-side imports)
const _isBrowser = typeof window !== 'undefined'

let audioCtx = null
let masterGain = null
let musicGain = null
let sfxGain = null
let droneOsc = null

const VOLUMES = {
  master: 0.5,
  music: 0.5,
  sfx: 0.8
}

/**
 * Pre-initialize the AudioContext and gain nodes, then synthesize buffers.
 * The context will exist in a 'suspended' state until resumeAudio() is called.
 * Returns a Promise that resolves when "loading" is visually done.
 */
export async function preloadAudio(settings) {
  if (!_isBrowser) return
  if (audioCtx) return

  // Create Context
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return // Not supported
  
  audioCtx = new AudioContext()

  // Gain Nodes
  masterGain = audioCtx.createGain()
  musicGain = audioCtx.createGain()
  sfxGain = audioCtx.createGain()

  musicGain.connect(masterGain)
  sfxGain.connect(masterGain)
  masterGain.connect(audioCtx.destination)

  // Apply provided settings
  if (settings) {
    updateVolumes(settings)
  } else {
    updateVolumes({ masterVolume: 50, musicVolume: 50, sfxVolume: 80 })
  }

  // Artificial delay to simulate heavy audio synthesis loading for the UI
  return new Promise(resolve => setTimeout(resolve, 800))
}

/**
 * Resumes the AudioContext. MUST be called from a user interaction event (click/keydown).
 */
export function resumeAudio() {
  if (!_isBrowser) return
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

export function updateVolumes(settings) {
  if (!masterGain) return
  VOLUMES.master = (settings.masterVolume ?? 50) / 100
  VOLUMES.music = (settings.musicVolume ?? 50) / 100
  VOLUMES.sfx = (settings.sfxVolume ?? 80) / 100

  masterGain.gain.setTargetAtTime(VOLUMES.master, audioCtx.currentTime, 0.1)
  musicGain.gain.setTargetAtTime(VOLUMES.music, audioCtx.currentTime, 0.1)
  sfxGain.gain.setTargetAtTime(VOLUMES.sfx, audioCtx.currentTime, 0.1)
}

/**
 * Play a specific synthesized sound effect
 * @param {string} type 'click', 'error', 'money', 'repair', 'alert'
 */
export function playSFX(type) {
  if (!_isBrowser || !audioCtx || VOLUMES.sfx === 0 || VOLUMES.master === 0) return

  // Need to resume context if it was suspended
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const t = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()

  osc.connect(gain)
  gain.connect(sfxGain)

  // Configure sound based on type
  if (type === 'click') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05)
    
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
    
    osc.start(t)
    osc.stop(t + 0.05)
  }
  else if (type === 'error') {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15)
    
    gain.gain.setValueAtTime(0.4, t)
    gain.gain.linearRampToValueAtTime(0.01, t + 0.15)
    
    osc.start(t)
    osc.stop(t + 0.15)
  }
  else if (type === 'money') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.setValueAtTime(1600, t + 0.05) // Arpeggio up
    
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.5, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3)
    
    osc.start(t)
    osc.stop(t + 0.3)
  }
  else if (type === 'repair') {
    osc.type = 'square'
    osc.frequency.setValueAtTime(400, t)
    osc.frequency.setValueAtTime(600, t + 0.1)
    
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2)
    
    osc.start(t)
    osc.stop(t + 0.2)
  }
  else if (type === 'alert') {
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.setValueAtTime(1000, t + 0.1)
    osc.frequency.setValueAtTime(800, t + 0.2)
    
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.linearRampToValueAtTime(0.01, t + 0.4)
    
    osc.start(t)
    osc.stop(t + 0.4)
  }
  else if (type === 'failure') {
    // 3 harsh descending sawtooth beeps
    osc.disconnect()
    gain.disconnect()
    for (let i = 0; i < 3; i++) {
      const osc2  = audioCtx.createOscillator()
      const gain2 = audioCtx.createGain()
      osc2.connect(gain2)
      gain2.connect(sfxGain)
      osc2.type = 'sawtooth'
      const startFreq = 600 - i * 120
      const startTime = t + i * 0.2
      osc2.frequency.setValueAtTime(startFreq, startTime)
      osc2.frequency.linearRampToValueAtTime(startFreq * 0.55, startTime + 0.16)
      gain2.gain.setValueAtTime(0.5, startTime)
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.16)
      osc2.start(startTime)
      osc2.stop(startTime + 0.16)
    }
    return
  }
  else if (type === 'notification') {
    // Quick double chime for new clients and tickets
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.setValueAtTime(1200, t + 0.1) // Pitch up for the second chime
    
    // First burst
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1)
    
    // Second burst
    gain.gain.setValueAtTime(0, t + 0.1)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25)
    
    osc.start(t)
    osc.stop(t + 0.25)
  }
}

/**
 * Start a low frequency hum for the background
 */
export function startBackgroundDrone() {
  if (!_isBrowser || !audioCtx || droneOsc) return

  // 1) Main Low Drone (Engine / Power)
  droneOsc = audioCtx.createOscillator()
  droneOsc.type = 'sine'
  droneOsc.frequency.setValueAtTime(55, audioCtx.currentTime) // Low A

  const modOsc = audioCtx.createOscillator()
  modOsc.type = 'sine'
  modOsc.frequency.setValueAtTime(0.2, audioCtx.currentTime) // Slow LFO

  const modGain = audioCtx.createGain()
  modGain.gain.setValueAtTime(5, audioCtx.currentTime)

  modOsc.connect(modGain)
  modGain.connect(droneOsc.frequency)

  // 2) Secondary Drone (Harmonic)
  const droneOsc2 = audioCtx.createOscillator()
  droneOsc2.type = 'triangle'
  droneOsc2.frequency.setValueAtTime(110, audioCtx.currentTime) // Octave up
  const droneGain2 = audioCtx.createGain()
  droneGain2.gain.setValueAtTime(0.1, audioCtx.currentTime)
  
  // 3) Air Conditioning / Server Fan noise (Filtered White Noise)
  // Use a longer buffer (8s) so any loop edge is inaudible under the lowpass filter
  const bufferSize = audioCtx.sampleRate * 8
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const output = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1 // White noise
  }
  // Crossfade edges to zero (50 ms) so the loop boundary never clicks
  const fadeSamples = Math.floor(audioCtx.sampleRate * 0.05)
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples
    output[i] *= t
    output[bufferSize - 1 - i] *= t
  }
  
  const fanNoise = audioCtx.createBufferSource()
  fanNoise.buffer = noiseBuffer
  fanNoise.loop = true
  
  const fanFilter = audioCtx.createBiquadFilter()
  fanFilter.type = 'lowpass'
  fanFilter.frequency.value = 350 // Cut off high frequencies for a muffled wind sound
  
  const fanGain = audioCtx.createGain()
  fanGain.gain.setValueAtTime(0.25, audioCtx.currentTime) // Very subtle

  // Connect everything to the music channel
  droneOsc.connect(musicGain)
  
  droneOsc2.connect(droneGain2)
  droneGain2.connect(musicGain)
  
  fanNoise.connect(fanFilter)
  fanFilter.connect(fanGain)
  fanGain.connect(musicGain)
  
  // Start all sources (they won't output sound until audioCtx is resumed)
  modOsc.start()
  droneOsc.start()
  droneOsc2.start()
  fanNoise.start()
}
