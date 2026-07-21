import Modal from "./Modal";

export default function ConfirmModal({
  title = "Confirm action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  children,
  modalClassName,
}) {
  return (
    <Modal title={title} onClose={onCancel} className={modalClassName}>
      <p>{message}</p>
      {children}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {cancelText}
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
