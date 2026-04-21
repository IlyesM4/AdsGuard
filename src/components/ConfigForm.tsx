import React, { useState, useEffect } from 'react';
import { Settings, Key, Hash, Layers, Play, Facebook } from 'lucide-react';
import { FBConfig } from '../types';

interface ConfigFormProps {
  onSave: (config: FBConfig) => void;
  initialConfig?: FBConfig;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ onSave, initialConfig }) => {
  const [accessToken, setAccessToken] = useState(initialConfig?.accessToken || '');
  const [adAccountIds, setAdAccountIds] = useState(initialConfig?.adAccountIds.join(', ') || '');
  const [campaignIds, setCampaignIds] = useState(initialConfig?.campaignIds.join(', ') || '');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        setAccessToken(event.data.token);
        setIsLoggingIn(false);
      } else if (event.data?.type === 'FB_AUTH_ERROR') {
        alert(`Facebook Login Error: ${event.data.error}`);
        setIsLoggingIn(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFacebookLogin = async () => {
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/auth/facebook/url');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const { url } = await response.json();

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        url,
        'fb_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error: any) {
      alert(error.message);
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parseIds = (input: string) => 
      Array.from(new Set(input.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)));

    onSave({
      accessToken,
      adAccountIds: parseIds(adAccountIds),
      campaignIds: parseIds(campaignIds),
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8 max-w-2xl mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Settings className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Configuration</h2>
          <p className="text-gray-500 text-sm">Connect your Facebook Ads account</p>
        </div>
      </div>

      <div className="mb-8">
        <button
          type="button"
          onClick={handleFacebookLogin}
          disabled={isLoggingIn}
          className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          <Facebook className="w-5 h-5 fill-current" />
          {isLoggingIn ? 'Connecting...' : 'Connect with Facebook Login'}
        </button>
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-100"></div>
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or manual token</span>
          <div className="flex-1 h-px bg-gray-100"></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Key className="w-4 h-4" />
            Facebook Access Token
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAA..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            required
          />
          <p className="mt-1 text-xs text-gray-400">Your token is stored locally in your browser session.</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Hash className="w-4 h-4" />
            Ad Account IDs (one per line)
          </label>
          <textarea
            value={adAccountIds}
            onChange={(e) => setAdAccountIds(e.target.value)}
            placeholder="123456789&#10;987654321"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Layers className="w-4 h-4" />
            Campaign IDs (one per line, optional)
          </label>
          <textarea
            value={campaignIds}
            onChange={(e) => setCampaignIds(e.target.value)}
            placeholder="111222333&#10;444555666"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          <Play className="w-4 h-4 fill-current" />
          Launch Dashboard
        </button>
      </form>
    </div>
  );
};

