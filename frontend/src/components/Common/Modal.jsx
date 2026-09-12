const Modal = ({ isOpen, onClose, title, children, maxWidth = "sm:max-w-md", contentClassName = "" }) => {
  if (!isOpen) return null;

  const defaultContentStyle = "px-5 py-4 overflow-y-auto max-h-[85vh] sm:max-h-[85vh]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Mobile: bottom sheet slide-up; Desktop: centered card */}
      <div
        className={`
          w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl
          border-t border-gray-100 dark:border-slate-800 sm:border
          shadow-2xl overflow-hidden
          animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-250 ease-out
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-3.5 pb-3 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white m-0 tracking-tight">{title}</h2>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 border-none cursor-pointer text-lg leading-none transition-colors"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className={contentClassName || defaultContentStyle}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
