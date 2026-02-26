import clsx from 'clsx';

const STATUS_ICON = {
  fail: { icon: '✕', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  warning: { icon: '!', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  pass: { icon: '✓', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

const SEVERITY_LABEL = {
  high: { text: 'สำคัญมาก', cls: 'bg-red-50 text-red-600' },
  medium: { text: 'ควรแก้ไข', cls: 'bg-amber-50 text-amber-600' },
  low: { text: 'เล็กน้อย', cls: 'bg-gray-100 text-gray-500' },
};

export default function FindingCard({ finding, index, showFix = true }) {
  const s = STATUS_ICON[finding.status] || STATUS_ICON.warning;
  const sev = SEVERITY_LABEL[finding.severity] || SEVERITY_LABEL.low;

  return (
    <div
      className={clsx(
        'finding-card rounded-[15px] border p-5 transition-shadow hover:shadow-sm bg-white',
        s.border
      )}
      style={{ animationDelay: `${index * 80}ms`, opacity: 0, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start gap-3">
        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm', s.bg, s.text)}>
          {s.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-text-primary text-base">
              {finding.titleTh || finding.title}
            </h3>
            {finding.status !== 'pass' && (
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', sev.cls)}>
                {sev.text}
              </span>
            )}
          </div>
          {finding.descriptionTh && (
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
              {finding.descriptionTh}
            </p>
          )}
          {/* Show howToFix only for top findings (free) or all (paid) */}
          {finding.howToFix && showFix && (
            <div className="mt-2 bg-background-secondary rounded-[8px] px-3 py-2">
              <p className="text-sm text-text-primary">
                <span className="font-medium">วิธีแก้: </span>
                {finding.howToFix}
              </p>
            </div>
          )}
          {finding.howToFix && !showFix && (
            <div className="mt-2 bg-gray-50 rounded-[8px] px-3 py-2 border border-dashed border-gray-200">
              <p className="text-xs text-text-secondary flex items-center gap-1.5">
                <span>🔒</span>
                <span>วิธีแก้อยู่ใน Action Plan</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
