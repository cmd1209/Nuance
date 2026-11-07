import { useLayoutEffect, type ReactNode, type Ref } from "react";

type Theme = "light" | "dark";

/** Owns document theme, viewport sizing, and navigation clearance for every section. */
export function AppShell({ theme, header, navigation, children, overlays, mainRef }: {
  theme: Theme; header: ReactNode; navigation: ReactNode; children: ReactNode; overlays?: ReactNode; mainRef?: Ref<HTMLElement>;
}) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    };
  }, [theme]);

  return <div className="nuance-app" data-theme={theme}>
    {header}
    <main ref={mainRef} className="nuance-main">{children}</main>
    {navigation}
    {overlays}
  </div>;
}
