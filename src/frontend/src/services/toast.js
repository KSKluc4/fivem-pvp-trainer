const listeners = new Set()
let uid = 0

function emit(item) {
  const t = { ...item, id: ++uid }
  listeners.forEach((fn) => fn(t))
}

export const toast = {
  success: (msg, duration = 3200) => emit({ type: 'success', msg, duration }),
  error:   (msg, duration = 4500) => emit({ type: 'error',   msg, duration }),
  info:    (msg, duration = 3000) => emit({ type: 'info',    msg, duration }),
  subscribe: (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
