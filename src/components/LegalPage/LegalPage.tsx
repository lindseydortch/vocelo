import { PublicPage } from '~/components/PublicPage/PublicPage'
import type { LegalDoc } from '~/content/legal'

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <PublicPage heading={doc.heading}>
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
    </PublicPage>
  )
}
