export default function EmptyState() {
  return (
    <div className="empty">
      <div className="dot" aria-hidden="true" />
      <p className="title">Belum ada bot yang terpasang</p>
      <p className="desc">Tempel token dari @BotFather di atas untuk memulai siaran pertamamu.</p>

      <style jsx>{`
        .empty {
          text-align: center;
          padding: 64px 20px;
          border: 1px dashed var(--border);
          border-radius: 10px;
          margin-top: 32px;
        }

        .dot {
          width: 10px;
          height: 10px;
          background: var(--text-faint);
          border-radius: 50%;
          margin: 0 auto 18px;
        }

        .title {
          font-family: var(--mono);
          font-size: 15px;
          margin: 0 0 6px;
        }

        .desc {
          color: var(--text-faint);
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
