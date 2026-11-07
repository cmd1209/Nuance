import type { ReactNode } from "react";

/** Natural content flow shared by Colors and future sections; no viewport sizing here. */
export function SectionLayout({ title, headingId, navigation, description, children, notice }: {
  title: string; headingId: string; navigation?: ReactNode; description: ReactNode; children: ReactNode; notice?: string;
}) {
  return <section className="section-layout" aria-labelledby={headingId}>
    <div className="section-layout__heading">
      <h1 id={headingId} tabIndex={-1}>{title}</h1>
      {navigation}
    </div>
    <p className="section-layout__description">{description}</p>
    <div className="section-layout__content">{children}</div>
    <p className="section-layout__notice" role="status">{notice}</p>
  </section>;
}
