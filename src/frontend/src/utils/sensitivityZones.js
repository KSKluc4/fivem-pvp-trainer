// cm/360 zone thresholds — validated against FPS community standards
export const ZONES = [
  {
    id:     'very-slow',
    label:  'Muito Lenta',
    icon:   '🐢',
    color:  '#8892a4',
    maxCm:  999,  // upper bound (open); matched when cm >= 60
    minCm:  60,
    phrase: 'Sensibilidade muito baixa — boa para tracking de longa distância, mas exige muito espaço de mousepad.',
    ref:    'Jogadores de Battlefield/PUBG de longa distância',
  },
  {
    id:     'slow',
    label:  'Lenta',
    icon:   '🎯',
    color:  '#2ed573',
    maxCm:  60,
    minCm:  35,
    phrase: 'Sensibilidade baixa — controle preciso, popular entre jogadores de rifle no FPS competitivo.',
    ref:    'Maioria dos jogadores de CS2/Valorant profissionais',
  },
  {
    id:     'medium',
    label:  'Média',
    icon:   '⚡',
    color:  '#00d4ff',
    maxCm:  35,
    minCm:  20,
    phrase: 'Zona ideal para FiveM PvP — equilíbrio entre controle e velocidade de reação.',
    ref:    'Referência FiveM PvP competitivo',
  },
  {
    id:     'fast',
    label:  'Rápida',
    icon:   '🔥',
    color:  '#ffa502',
    maxCm:  20,
    minCm:  12,
    phrase: 'Sensibilidade alta — reações rápidas, exige treino consistente para manter precisão.',
    ref:    'Jogadores de CQC / shotgun / pistola',
  },
  {
    id:     'very-fast',
    label:  'Muito Rápida',
    icon:   '💥',
    color:  '#ff4757',
    maxCm:  12,
    minCm:  0,
    phrase: 'Sensibilidade extremamente alta — apenas para jogadores com muito treino específico.',
    ref:    'Nichos: Overwatch tanks, jogadores de controlador',
  },
]

/**
 * Returns the zone for a given cm/360 value.
 * @param {number} cm
 * @returns {typeof ZONES[0]}
 */
export function getZone(cm) {
  for (const zone of ZONES) {
    if (cm >= zone.minCm) return zone
  }
  return ZONES[ZONES.length - 1]
}
