"use client";

// A small toolbar shown on screen but hidden when printing. The button opens
// the browser's print dialog, where the teacher chooses "Save as PDF".
export function PrintControls() {
  return (
    <div className="print:hidden mb-6 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-600">
        Use your browser&apos;s <strong>Save as PDF</strong> option in the print
        dialog to export this exam.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
