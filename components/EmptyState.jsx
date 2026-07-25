'use client';

export default function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
          <path d="M16 13v6M13 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="empty-title">Belum ada bot</p>
      <p className="empty-desc">Tambahkan bot pertamamu dengan menekan tombol "Tambah Bot" di atas.</p>

      <style jsx>{`
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 56px 24px;
          text-align: center;
          background: var(--panel);
          border: 1px solid var(--border-solid);
          border-radius: 14px;
          border-style: dashed;
          margin-top: 8px;
        }
        .empty-icon {
          color: var(--text-faint);
          margin-bottom: 14px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-dim);
          margin: 0 0 6px;
        }
        .empty-desc {
          font-size: 13px;
          color: var(--text-faint);
          max-width: 320px;
          line-height: 1.6;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
