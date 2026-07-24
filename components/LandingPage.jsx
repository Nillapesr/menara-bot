'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="land">
      <nav className="nav">
        <span className="logo">MENARA_</span>
        <div className="nav-links">
          <Link href="/login" className="nav-link">Masuk</Link>
          <Link href="/register" className="btn-nav">Get Started</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-tag">PANEL KENDALI BOT TELEGRAM</div>
        <h1 className="hero-title">
          PASANG BOT.
          <br />
          <span className="hl-yellow">TULIS KODE.</span>
          <br />
          BIARKAN JALAN.
        </h1>
        <p className="hero-desc">
          Tempel token dari @BotFather, tulis kode custom kalau mau
          lebih dari sekadar kata kunci — kirim gambar, tombol, bahkan
          sambungkan ke ChatGPT. Semua dari browser, tanpa server sendiri.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn-primary">
            GET STARTED →
          </Link>
          <Link href="/login" className="btn-secondary">
            Sudah punya akun
          </Link>
        </div>
      </section>

      <section className="features">
        <div className="feature-card fc-yellow">
          <span className="fc-num">01</span>
          <h3>TANPA CODING</h3>
          <p>Atur kata kunci → balasan otomatis langsung dari dashboard, tak perlu tulis satu baris kode pun.</p>
        </div>
        <div className="feature-card fc-pink">
          <span className="fc-num">02</span>
          <h3>KODE CUSTOM</h3>
          <p>Butuh lebih? Tulis JS sendiri: kirim gambar, tombol interaktif, atau sambungkan ke API luar.</p>
        </div>
        <div className="feature-card fc-blue">
          <span className="fc-num">03</span>
          <h3>TERHUBUNG AI</h3>
          <p>Template siap pakai untuk menyambungkan bot ke ChatGPT atau API kompatibel OpenAI lainnya.</p>
        </div>
        <div className="feature-card fc-green">
          <span className="fc-num">04</span>
          <h3>BANYAK BOT SEKALIGUS</h3>
          <p>Kelola semua bot Telegram kamu dari satu dashboard — nyalakan, jeda, hapus kapan saja.</p>
        </div>
      </section>

      <section className="cta">
        <h2>SIAP MEMANCARKAN SINYAL PERTAMAMU?</h2>
        <Link href="/register" className="btn-primary btn-lg">
          BUAT AKUN GRATIS →
        </Link>
      </section>

      <footer className="foot">
        <span>MENARA © 2026</span>
      </footer>

      <style jsx>{`
        .land {
          min-height: 100vh;
          background: var(--bru-bg);
          color: var(--bru-ink);
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-bottom: var(--bru-border);
          background: var(--bru-white);
        }

        .logo {
          font-family: var(--display);
          font-weight: 800;
          font-size: 22px;
          letter-spacing: -0.02em;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-link {
          text-decoration: none;
          color: var(--bru-ink);
          font-weight: 600;
          font-size: 14px;
        }

        .btn-nav {
          text-decoration: none;
          background: var(--bru-ink);
          color: var(--bru-bg);
          padding: 10px 20px;
          font-weight: 700;
          font-size: 14px;
          border: var(--bru-border);
        }

        .hero {
          max-width: 900px;
          margin: 0 auto;
          padding: 90px 32px 60px;
          text-align: center;
        }

        .hero-tag {
          display: inline-block;
          background: var(--bru-yellow);
          border: var(--bru-border);
          padding: 6px 16px;
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          margin-bottom: 28px;
          box-shadow: var(--bru-shadow-sm);
        }

        .hero-title {
          font-family: var(--display);
          font-size: clamp(40px, 9vw, 84px);
          font-weight: 800;
          line-height: 1.02;
          letter-spacing: -0.03em;
          margin: 0 0 24px;
        }

        .hl-yellow {
          background: var(--bru-yellow);
          padding: 0 8px;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }

        .hero-desc {
          font-size: 17px;
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto 36px;
          color: #333;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          text-decoration: none;
          background: var(--bru-ink);
          color: var(--bru-bg);
          padding: 16px 28px;
          font-weight: 800;
          font-size: 15px;
          border: var(--bru-border);
          box-shadow: var(--bru-shadow);
          transition: transform 0.12s, box-shadow 0.12s;
          display: inline-block;
        }

        .btn-primary:hover {
          transform: translate(-3px, -3px);
          box-shadow: 9px 9px 0 var(--bru-ink);
        }

        .btn-primary:active {
          transform: translate(0, 0);
          box-shadow: 2px 2px 0 var(--bru-ink);
        }

        .btn-lg {
          padding: 20px 36px;
          font-size: 18px;
        }

        .btn-secondary {
          text-decoration: none;
          color: var(--bru-ink);
          padding: 16px 20px;
          font-weight: 700;
          font-size: 15px;
          border-bottom: 3px solid var(--bru-ink);
        }

        .features {
          max-width: 1100px;
          margin: 40px auto 0;
          padding: 0 32px 80px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 20px;
        }

        .feature-card {
          border: var(--bru-border);
          box-shadow: var(--bru-shadow-sm);
          padding: 24px;
          background: var(--bru-white);
        }

        .fc-yellow { background: var(--bru-yellow); }
        .fc-pink { background: var(--bru-pink); color: var(--bru-white); }
        .fc-blue { background: var(--bru-blue); color: var(--bru-white); }
        .fc-green { background: var(--bru-green); }

        .fc-num {
          font-family: var(--mono);
          font-weight: 800;
          font-size: 13px;
          opacity: 0.6;
        }

        .feature-card h3 {
          font-family: var(--display);
          font-size: 20px;
          margin: 10px 0 10px;
          letter-spacing: -0.01em;
        }

        .feature-card p {
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
        }

        .cta {
          text-align: center;
          padding: 70px 32px;
          border-top: var(--bru-border);
          border-bottom: var(--bru-border);
          background: var(--bru-ink);
          color: var(--bru-bg);
        }

        .cta h2 {
          font-family: var(--display);
          font-size: clamp(26px, 5vw, 44px);
          margin: 0 0 28px;
          letter-spacing: -0.02em;
        }

        .cta :global(.btn-primary) {
          background: var(--bru-yellow);
          color: var(--bru-ink);
          box-shadow: 6px 6px 0 var(--bru-bg);
        }

        .cta :global(.btn-primary:hover) {
          box-shadow: 9px 9px 0 var(--bru-bg);
        }

        .foot {
          text-align: center;
          padding: 24px;
          font-family: var(--mono);
          font-size: 12px;
          color: #555;
        }
      `}</style>
    </main>
  );
}
