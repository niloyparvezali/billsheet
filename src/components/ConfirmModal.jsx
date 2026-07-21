import Modal from "./Modal";
import { useLanguage } from "../context/LanguageContext";

export default function ConfirmModal({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  children,
  modalClassName,
}) {
  const { t } = useLanguage();
  const displayTitle = title || t("confirm", "Confirm action");
  const displayConfirm = confirmText || t("confirm", "Confirm");
  const displayCancel = cancelText || t("cancel", "Cancel");

  return (
    <Modal title={displayTitle} onClose={onCancel} className={modalClassName}>
      <p>{message}</p>
      {children}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {displayCancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          {displayConfirm}
        </button>
      </div>
    </Modal>
  );
}
