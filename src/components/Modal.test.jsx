import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not steal focus away from an existing input when it mounts", () => {
    render(
      <>
        <input aria-label="Target input" />
        <Modal title="Test modal" onClose={() => {}}>
          <input aria-label="Modal field" />
        </Modal>
      </>,
    );

    const targetInput = screen.getByLabelText("Target input");
    targetInput.focus();

    expect(document.activeElement).toBe(targetInput);
  });

  it("keeps the active input focused when the parent rerenders with a new close callback", () => {
    function StatefulModal() {
      const [value, setValue] = useState("");

      return (
        <>
          <button type="button" aria-label="Restore target">
            Restore target
          </button>
          <Modal title="Test modal" onClose={() => setValue("closed")}>
            <input
              aria-label="Modal field"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Modal>
        </>
      );
    }

    render(<StatefulModal />);

    const restoreTarget = screen.getByLabelText("Restore target");
    const modalField = screen.getByLabelText("Modal field");

    restoreTarget.focus();
    modalField.focus();
    fireEvent.change(modalField, { target: { value: "15" } });

    expect(document.activeElement).toBe(modalField);
    expect(modalField.value).toBe("15");
  });

  it("restores focus to the opener only after the modal is closed", () => {
    function OpenModal() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <button type="button" aria-label="Open trigger" onClick={() => setIsOpen(true)}>
            Open trigger
          </button>
          {isOpen && (
            <Modal title="Test modal" onClose={() => setIsOpen(false)}>
              <input aria-label="Modal field" />
            </Modal>
          )}
        </>
      );
    }

    render(<OpenModal />);

    const opener = screen.getByLabelText("Open trigger");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);

    const modalField = screen.getByLabelText("Modal field");
    modalField.focus();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("only closes when the backdrop itself is clicked", () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test modal" onClose={onClose}>
        <input aria-label="Modal field" />
      </Modal>,
    );

    const modalField = screen.getByLabelText("Modal field");
    const modalWrap = document.querySelector(".modal-wrap");

    modalField.focus();
    fireEvent.mouseDown(modalField);
    fireEvent.change(modalField, { target: { value: "15" } });

    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(modalField);
    expect(modalField.value).toBe("15");

    fireEvent.mouseDown(modalWrap);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
