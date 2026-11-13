import { PublicFooter } from '~/components/PublicFooter/PublicFooter'
import { pagesCopy } from '~/content/copy'
import { landingCta } from '~/lib/landing-cta'
import styles from './Landing.module.scss'

export function Landing({ signedIn }: { signedIn: boolean }) {
  const copy = pagesCopy.landing
  const cta = landingCta(signedIn, copy.cta)
  return (
    <>
      <main className={styles.landing}>
        <section aria-labelledby="hero-heading" className={styles.section}>
          <h1 id="hero-heading">{copy.hero.headline}</h1>
          <p>{copy.hero.subhead}</p>
          <a href={cta.href} className={styles.cta}>
            {cta.label}
          </a>
        </section>

        <section aria-labelledby="problem-heading" className={styles.section}>
          <h2 id="problem-heading">{copy.problem.heading}</h2>
          <p>{copy.problem.body}</p>
          <h2>{copy.solution.heading}</h2>
          <p>{copy.solution.body}</p>
        </section>

        <section aria-labelledby="how-heading" className={styles.section}>
          <h2 id="how-heading">{copy.how.heading}</h2>
          <ol className={styles.steps}>
            {copy.how.steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Slot for G12 (persona showcase). */}
        <section
          aria-labelledby="personas-heading"
          data-slot="persona-showcase"
          className={styles.section}
        >
          <h2 id="personas-heading">{copy.personas.heading}</h2>
        </section>

        <section aria-labelledby="channels-heading" className={styles.section}>
          <h2 id="channels-heading">{copy.channels.heading}</h2>
          <ul className={styles.channels}>
            {copy.channels.items.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>

        {/* Slot for G14 (plan cards). */}
        <section
          aria-labelledby="pricing-heading"
          data-slot="pricing"
          className={styles.section}
        >
          <h2 id="pricing-heading">{copy.pricing.heading}</h2>
        </section>

        <section aria-labelledby="faq-heading" className={styles.section}>
          <h2 id="faq-heading">{copy.faq.heading}</h2>
          {copy.faq.items.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
