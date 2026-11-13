import { PublicFooter } from '~/components/PublicFooter/PublicFooter'
import type { LegalDoc } from '~/content/legal'
import styles from '../PublicPage/PublicPage.module.scss'

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <main className={styles.page}>
        <h1>{doc.heading}</h1>
        <p>Last updated: {doc.lastUpdated}</p>
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <PublicFooter />
    </>
  )
}
