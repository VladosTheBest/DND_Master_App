import type { CSSProperties, ReactNode, Ref } from "react";

type AppShellProps = {
  className: string;
  style: CSSProperties;
  mainClassName: string;
  contentClassName: string;
  sidebar?: ReactNode;
  header: ReactNode;
  tabs?: ReactNode;
  preview?: ReactNode;
  children: ReactNode;
  contentRef: Ref<HTMLElement>;
};

export function AppShell({
  className,
  style,
  mainClassName,
  contentClassName,
  sidebar,
  header,
  tabs,
  preview,
  children,
  contentRef
}: AppShellProps) {
  return (
    <div className={className} style={style}>
      {sidebar}
      <main className={mainClassName}>
        {header}
        {tabs}
        <section className={contentClassName} ref={contentRef}>
          {children}
        </section>
      </main>
      {preview}
    </div>
  );
}
