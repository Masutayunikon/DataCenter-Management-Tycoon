// clientNames.js — Random client name generator

const CLIENT_NAMES = [
  'AlphaNet', 'ByteFlow', 'CloudPeak', 'DataStream', 'EchoSys',
  'FiberLink', 'GridNode', 'HexCore', 'InfoNet', 'JetCloud',
  'KiloBase', 'LimeData', 'MegaHost', 'NanoNet', 'OmniCloud',
  'PulseNet', 'QuadCore', 'RouterX', 'SkyBridge', 'TeraByte',
]

export function randomClientName() {
  return CLIENT_NAMES[Math.floor(Math.random() * CLIENT_NAMES.length)] +
    ' #' + Math.floor(Math.random() * 900 + 100)
}
