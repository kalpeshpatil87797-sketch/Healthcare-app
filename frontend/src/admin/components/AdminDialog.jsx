import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function AdminDialog({
  title,
  description,
  onClose,
  children,
  footer,
  closeDisabled = false,
  tone = "default",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (!closeDisabled) onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE)
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [closeDisabled, onClose]);

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && !closeDisabled) onClose();
  }

  return createPortal(
    <div className="admin-dialog-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`admin-dialog admin-dialog-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="admin-dialog-header">
          <div>
            <h2 id={titleId} className="admin-dialog-title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="admin-dialog-description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="admin-dialog-body">{children}</div>

        {footer ? <div className="admin-dialog-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
