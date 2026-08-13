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
