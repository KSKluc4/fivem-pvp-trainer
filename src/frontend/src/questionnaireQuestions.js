import {
  IconTargetArrow, IconRun, IconTarget, IconTelescope, IconHeartRateMonitor,
  IconCrosshair, IconBolt, IconArrowsMove, IconSwords, IconCrown,
  IconFocusCentered, IconSparkles, IconClock, IconGauge, IconBoltFilled,
  IconLineDashed, IconWaveSine, IconArrowsShuffle,
  IconBattery1, IconBattery2, IconBatteryCharging,
} from '@tabler/icons-react'

// Question copy (question/subtitle/option label+description) lives in the
// locale files under questionario.perguntas.<id> — this array only carries
// the structural bits (order, option values/icon/color) that drive the UI.
// `value` is what actually gets submitted to the backend — untouched by the
// icon/copy polish, so existing routines and saved answers stay compatible.
//
// Shared between the full 7-question Questionnaire.jsx wizard and the
// "Mudar meu foco" shortcut (FocusShortcutModal.jsx), which only shows the
// 3 multiSelect entries (specific_weakness/focus_area/aim_difficulty) —
// FOCUS_QUESTION_IDS below is exactly those 3, in this array's order.
export const QUESTIONS = [
  {
    id: 'specific_weakness',
    multiSelect: true,
    options: [
      { value: 'moving_target', icon: IconRun,              color: 'brandCyan' },
      { value: 'headshot',      icon: IconTarget,            color: 'brandPurple' },
      { value: 'long_range',    icon: IconTelescope,         color: 'orange' },
      { value: 'reaction',      icon: IconHeartRateMonitor,  color: 'red' },
    ],
  },
  {
    id: 'focus_area',
    multiSelect: true,
    options: [
      { value: 'aim',      icon: IconCrosshair,  color: 'brandCyan' },
      { value: 'reflex',   icon: IconBolt,        color: 'brandPurple' },
      { value: 'movement', icon: IconArrowsMove,  color: 'orange' },
    ],
  },
  {
    id: 'experience_level',
    options: [
      { value: 'iniciante',     icon: IconTarget, color: 'gray' },
      { value: 'intermediario', icon: IconSwords, color: 'brandCyan' },
      { value: 'avancado',      icon: IconCrown,   color: 'brandPurple' },
    ],
  },
  {
    id: 'aim_difficulty',
    multiSelect: true,
    options: [
      { value: 'tracking', icon: IconFocusCentered, color: 'brandCyan' },
      { value: 'flick',    icon: IconSparkles,       color: 'brandPurple' },
      { value: 'close',    icon: IconTargetArrow,    color: 'orange' },
    ],
  },
  {
    id: 'reflex_level',
    options: [
      { value: 'lento',  icon: IconClock,       color: 'gray' },
      { value: 'medio',  icon: IconGauge,        color: 'brandCyan' },
      { value: 'rapido', icon: IconBoltFilled,   color: 'brandPurple' },
    ],
  },
  {
    id: 'movement_quality',
    options: [
      { value: 'previsivel',   icon: IconLineDashed,    color: 'gray' },
      { value: 'moderado',     icon: IconWaveSine,      color: 'brandCyan' },
      { value: 'imprevisivel', icon: IconArrowsShuffle, color: 'brandPurple' },
    ],
  },
  {
    id: 'daily_time',
    options: [
      { value: 25, icon: IconBattery1,        color: 'brandCyan' },
      { value: 45, icon: IconBattery2,        color: 'brandPurple' },
      { value: 65, icon: IconBatteryCharging, color: 'orange' },
    ],
  },
]

export const QUESTIONS_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))

// SPEC-004's 3 "foco" questions — the ones the focus shortcut edits.
export const FOCUS_QUESTION_IDS = QUESTIONS.filter((q) => q.multiSelect).map((q) => q.id)
