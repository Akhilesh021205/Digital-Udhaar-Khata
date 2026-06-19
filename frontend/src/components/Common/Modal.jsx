const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Mobile: bottom sheet slide-up; Desktop: centered card */}
      <div
        className="
          w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl
          border-t border-gray-100 sm:border sm:border-gray-100
          shadow-2xl overflow-hidden
          animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-250 ease-out
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-4 pb-3 sm:pt-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 m-0 tracking-tight">{title}</h2>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 border-none cursor-pointer text-lg leading-none transition-colors"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Content – scrollable for long forms on mobile */}
        <div className="px-5 py-4 overflow-y-auto max-h-[75vh] sm:max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

