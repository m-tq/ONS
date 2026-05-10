import { classNames } from '../lib/format'

export type StatusVariant = 'confirmed' | 'staging' | 'rejected' | 'ocs' | 'pending' | 'op' | 'private'

interface Props {
  variant: StatusVariant
  children: React.ReactNode
  title?: string
}

export function StatusTag({ variant, children, title }: Props) {
  return (
    <span className={classNames('tag', `tag--${variant}`)} title={title}>
      {children}
    </span>
  )
}
