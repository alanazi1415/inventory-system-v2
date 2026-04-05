import * as React from "react"

type Toast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const listeners: Array<(state: { toasts: Toast[] }) => void> = []
let state = { toasts: [] as Toast[] }
let count = 0

function dispatch(action: { type: string; toast?: Toast; toastId?: string }) {
  if (action.type === "ADD_TOAST") {
    state = { toasts: [action.toast!, ...state.toasts].slice(0, 1) }
  } else if (action.type === "DISMISS_TOAST") {
    state = { toasts: state.toasts.map(t => action.toastId === undefined || t.id === action.toastId ? { ...t, open: false } : t) }
  } else if (action.type === "REMOVE_TOAST") {
    state = { toasts: action.toastId ? state.toasts.filter(t => t.id !== action.toastId) : [] }
  }
  listeners.forEach(l => l(state))
}

export function toast(props: Omit<Toast, "id">) {
  const id = (++count).toString()
  dispatch({
    type: "ADD_TOAST",
    toast: { ...props, id, open: true, onOpenChange: (o) => !o && dispatch({ type: "DISMISS_TOAST", toastId: id }) }
  })
  return { id, dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }) }
}

export function useToast() {
  const [s, setS] = React.useState(state)
  React.useEffect(() => {
    listeners.push(setS)
    return () => {
      const i = listeners.indexOf(setS)
      if (i > -1) listeners.splice(i, 1)
    }
  }, [])
  return { ...s, toast, dismiss: (id?: string) => dispatch({ type: "DISMISS_TOAST", toastId: id }) }
}
