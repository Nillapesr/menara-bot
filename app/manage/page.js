'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BotCard from '@/components/BotCard';
import { useAuth } from '@/components/AuthContext';

export default function ManagePage() {
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const botId = searchParams.get('botId');

  useEffect(() => {
    if (!authLoading && user === null) router.push('/login');
  }, [authLoading, user, router]);

  const fetchBot = useCallback(async () => {
    if (!botId) {
      setError('Bot ID tidak ditemukan');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/bots/${botId}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 404) { setError('Bot tidak ditemukan'); setLoading(false); return; }
      const data = await res.json();
      setBot(data.bot);
    } catch {
      setError('Gagal memuat bot. Cek koneksi ke database.');
    } finally {
      setLoading(false);
    }
  }, [botId, router]);

  useEffect(() => {
    if (user && botId) {
      fetchBot();
    }
  }, [user, botId, fetchBot]);

  if (authLoading || !user) {
    return (
      <div className="loading-screen">
        <div className="loader-inner">
          <span className="loader-dot" />
          <span className="loader-dot" />
          <span className="loader-dot" />
        </div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
          }
          .loader-inner {
            display: flex;
            gap: 8px;
          }
          .loader-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
            animation: pulse 1.2s ease-in-out infinite;
          }
          .loader-dot:nth-child(2) { animation-delay: 0.2s; }
          .loader-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-inner">
          <span className="loader-dot" />
          <span className="loader-dot" />
          <span className="loader-dot" />
        </div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
          }
          .loader-inner {
            display: flex;
            gap: 8px;
          }
          .loader-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
            animation: pulse 1.2s ease-in-out infinite;
          }
          .loader-dot:nth-child(2) { animation-delay: 0.2s; }
          .loader-dot:nth-child(3) { animation-delay: 0.4s; }
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <h1>⚠️ Error</h1>
          <p>{error || 'Bot tidak ditemukan'}</p>
          <button onClick={() => window.close()}>Tutup Tab</button>
        </div>
        <style jsx>{`
          .error-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
            padding: 20px;
          }
          .error-content {
            text-align: center;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 16px;
            padding: 40px;
            backdrop-filter: blur(10px);
          }
          h1 {
            font-size: 28px;
            margin: 0 0 12px;
            color: #fca5a5;
          }
          p {
            color: rgba(255, 255, 255, 0.6);
            margin: 0 0 20px;
            font-size: 14px;
          }
          button {
            background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
            border: none;
            color: #fff;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            transition: all 0.2s ease;
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="manage-container">
      <div className="manage-header">
        <button className="close-btn" onClick={() => window.close()} title="Tutup">✕</button>
        <div className="header-content">
          <h1>📋 Manage Bot</h1>
          <p>@{bot.username}</p>
        </div>
      </div>

      <div className="manage-body">
        {bot && <BotCard bot={bot} onChange={() => fetchBot()} />}
      </div>

      <style jsx>{`
        .manage-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
          display: flex;
          flex-direction: column;
        }

        .manage-header {
          position: relative;
          padding: 24px 30px;
          border-bottom: 1px solid rgba(124, 58, 237, 0.1);
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(239, 68, 68, 0.2);
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .close-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .header-content {
          flex: 1;
        }

        .header-content h1 {
          font-size: 28px;
          margin: 0;
          color: #fff;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .header-content p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 4px 0 0;
          font-family: 'Courier New', monospace;
          font-weight: 600;
        }

        .manage-body {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .manage-header {
            padding: 16px 20px;
          }
          .header-content h1 {
            font-size: 20px;
          }
          .manage-body {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
