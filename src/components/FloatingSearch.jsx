import { useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";

export default function FloatingSearch({ targetRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 220);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTimeout(() => {
      if (targetRef?.current) {
        targetRef.current.focus();
        targetRef.current.select?.();
      }
    }, 350);
  };

  if (!visible) return null;

  return (
    <button
      className="floating-search-button"
      onClick={handleSearch}
      aria-label="Search"
    >
      <FiSearch size={20} />
    </button>
  );
}