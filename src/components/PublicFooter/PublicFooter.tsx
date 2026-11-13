import { Link } from '@tanstack/react-router'
import { pagesCopy } from '~/content/copy'
import styles from './PublicFooter.module.scss'

export function PublicFooter() {
  const { footer } = pagesCopy
  return (
    <footer className={styles.footer}>
      <nav aria-label="Footer" className={styles.links}>
        <Link to="/privacy">{footer.privacy}</Link>
        <Link to="/terms">{footer.terms}</Link>
        <a href={`mailto:${footer.supportEmail}`}>{footer.contact}</a>
      </nav>
    </footer>
  )
}
