import { Search } from "lucide-react";

export default function FloatingSearchButton({ targetRef, selector }) {
  const handleClick = () => {
    let element = null;

    if (targetRef?.current) {
      element = targetRef.current;
    } else if (selector) {
      element = document.querySelector(selector);
    }

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    setTimeout(() => {
      element.focus?.({ preventScroll: true });
    }, 120);
  };

  return (
    <button
      className="search-fab"
      onClick={handleClick}
      aria-label="Search"
      title="Search"
    >
      <Search size={18} />
    </button>
  );
}
