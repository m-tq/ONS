import { ONS_CONTRACT, EXPLORER_HOST } from '../lib/constants'
import { truncateMiddle } from '../lib/format'

interface Props {
  network: string
  rpc:     string
  online:  boolean
}

export function Footer({ network, rpc, online }: Props) {
  return (
    <footer className="oct-footer">
      <div className="oct-footer__left">
        <span
          className={`status-dot ${online ? '' : 'status-dot--danger'}`}
          aria-hidden="true"
        />
        <span>{online ? 'rpc online' : 'rpc offline'}</span>
        <span>·</span>
        <span className="mono">{rpc.replace(/^https?:\/\//, '')}</span>
      </div>
      <div className="oct-footer__right">
        <span>{network}</span>
        <span>·</span>
        <a
          className="mono"
          href={`${EXPLORER_HOST}/address.html?addr=${ONS_CONTRACT}`}
          target="_blank"
          rel="noreferrer noopener"
          title={ONS_CONTRACT}
        >
          contract {truncateMiddle(ONS_CONTRACT, 6, 4)}
        </a>
        <span>·</span>
        <span>ons</span>
      </div>
    </footer>
  )
}
