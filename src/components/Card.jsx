/**
 * @param {{ children: import('react').ReactNode, className?: string, as?: 'section'|'article'|'div' }} props
 */
export function Card({ children, className = '', as: Element = 'section' }) {
  return (
    <Element className={`rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${className}`}>
      {children}
    </Element>
  );
}
