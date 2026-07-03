import { notifications } from '@mantine/notifications'
import { IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react'
import { createElement } from 'react'

const CONFIG = {
  success: { color: 'green',      icon: IconCheck },
  error:   { color: 'red',        icon: IconX },
  info:    { color: 'brandCyan',  icon: IconInfoCircle },
}

function show(type, msg, duration) {
  const { color, icon } = CONFIG[type]
  notifications.show({
    message:   msg,
    color,
    autoClose: duration,
    icon:      createElement(icon, { size: 18 }),
  })
}

export const toast = {
  success: (msg, duration = 3200) => show('success', msg, duration),
  error:   (msg, duration = 4500) => show('error',   msg, duration),
  info:    (msg, duration = 3000) => show('info',    msg, duration),
}
