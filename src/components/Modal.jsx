import { useEffect, useRef } from "react";

export default function Modal({ title, children, onClose, className }) {
  const dialogRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="modal-wrap" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`modal${className ? ` ${className}` : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <button className="modal-close" onClick={onClose} type="button">
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
