import FloatingSearchButton from "./FloatingSearchButton";

export default function PageHeader({ title, subtitle, searchRef, children }) {
  return (
    <div className="page-title">
      <div>
        <h2>{title}</h2>

        {subtitle && <p>{subtitle}</p>}

        {children}
      </div>

      {searchRef && <FloatingSearchButton targetRef={searchRef} />}
    </div>
  );
}
