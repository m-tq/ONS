import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

import { classNames } from '../lib/format'

type Variant = 'default' | 'primary' | 'quiet' | 'danger'

export interface ActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?:     Variant
  /** When true, shows a spinner + the `pendingLabel` and disables the button. */
  pending?:     boolean
  /** Replacement text to show while `pending` is true. Defaults to children. */
  pendingLabel?: ReactNode
  /** Extra disabled condition that works alongside `pending`. */
  disabled?:    boolean
  icon?:        ReactNode
  children:     ReactNode
}

/**
 * Standard button primitive with a built-in spinner+label for pending actions.
 * Ensures every user-facing action surfaces progress consistently.
 */
export function ActionButton({
  variant = 'default',
  pending = false,
  pendingLabel,
  disabled = false,
  icon,
  children,
  className,
  ...rest
}: ActionButtonProps) {
  const cls = classNames(
    'button',
    variant === 'primary' && 'button--primary',
    variant === 'quiet'   && 'button--quiet',
    variant === 'danger'  && 'button--danger',
    className,
  )

  const body = pending ? (pendingLabel ?? children) : children
  const leading = pending
    ? <Loader2 size={12} className="spin" aria-hidden="true" />
    : icon

  return (
    <button
      className={cls}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...rest}
    >
      {leading}
      {body}
    </button>
  )
}
