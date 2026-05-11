import React, { useState, useEffect } from 'react';
import { ChevronDown, Save, Check, Users, FileText, Clock } from 'lucide-react';
import { Client, MeetingPrepRecord } from '../types';

export function ClientHistory() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [preps, setPreps] = useState<MeetingPrepRecord[]>([]);
  const [prepsLoading, setPrepsLoading] = useState(false);
  const [expandedPrepId, setExpandedPrepId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSaving, setNoteSaving] = useState<Record<string, boolean>>({});
  const [noteSaved, setNoteSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setDbError(d.error); return; }
        setClients(d.clients || []);
      })
      .catch(() => setDbError('Failed to connect to the database.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClientId) { setPreps([]); return; }
    setPrepsLoading(true);
    setExpandedPrepId(null);
    fetch(`/api/meeting-preps?clientId=${selectedClientId}`)
      .then(r => r.json())
      .then(d => {
        const data: MeetingPrepRecord[] = d.preps || [];
        setPreps(data);
        const initialNotes: Record<string, string> = {};
        data.forEach(p => { initialNotes[p.id] = p.post_meeting_notes || ''; });
        setNotes(initialNotes);
      })
      .finally(() => setPrepsLoading(false));
  }, [selectedClientId]);

  const saveNotes = async (prepId: string) => {
    setNoteSaving(prev => ({ ...prev, [prepId]: true }));
    try {
      await fetch(`/api/meeting-preps/${prepId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes[prepId] }),
      });
      setNoteSaved(prev => ({ ...prev, [prepId]: true }));
      setTimeout(() => setNoteSaved(prev => ({ ...prev, [prepId]: false })), 2000);
    } finally {
      setNoteSaving(prev => ({ ...prev, [prepId]: false }));
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const daysSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="max-w-lg mx-auto mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="font-semibold text-amber-800 mb-2">Database not connected</p>
        <p className="text-sm text-amber-700 mb-4">{dbError}</p>
        <p className="text-xs text-amber-600">Add <code className="bg-amber-100 px-1 py-0.5 rounded">SUPABASE_URL</code> and <code className="bg-amber-100 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to your <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code> file and restart the server.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Client History</h2>
        <p className="text-gray-500">Browse saved meeting preps and add post-meeting notes for AI context.</p>
      </div>

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {/* Left: client list */}
        <div className="w-60 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-800 text-sm">Clients</span>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{clients.length}</span>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-xs text-gray-400">No clients yet. Save a meeting prep to a client to see them here.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {clients.map(client => {
                const prepCount = client.meeting_preps?.[0]?.count ?? 0;
                const isSelected = selectedClientId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}
                  >
                    <p className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>{client.name}</p>
                    {client.niche && <p className="text-xs text-gray-400 truncate mt-0.5">{client.niche}</p>}
                    <p className="text-xs text-gray-300 mt-1">{prepCount} report{prepCount !== 1 ? 's' : ''}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: reports panel */}
        <div className="flex-1 overflow-y-auto">
          {!selectedClientId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
              <FileText className="w-10 h-10 text-gray-200" />
              <p className="text-sm">Select a client to view their reports</p>
            </div>
          ) : prepsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Client header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedClient?.name}</h3>
                  {selectedClient?.niche && <p className="text-sm text-gray-400">{selectedClient.niche}</p>}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <FileText className="w-4 h-4" />
                  {preps.length} report{preps.length !== 1 ? 's' : ''}
                </div>
              </div>

              {preps.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No reports saved yet for {selectedClient?.name}.</p>
                  <p className="text-gray-300 text-xs mt-1">Generate a meeting prep and save it to this client.</p>
                </div>
              ) : (
                preps.map((prep, i) => {
                  const isExpanded = expandedPrepId === prep.id;
                  const date = new Date(prep.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  });
                  const age = daysSince(prep.created_at);
                  const isLatest = i === 0;

                  return (
                    <div key={prep.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Report header */}
                      <button
                        onClick={() => setExpandedPrepId(isExpanded ? null : prep.id)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isLatest ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{date}</p>
                              {isLatest && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-full">Latest</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {prep.template_name && (
                                <span className="text-xs text-gray-400">{prep.template_name}</span>
                              )}
                              {prep.file_name && (
                                <span className="text-xs text-gray-300">{prep.file_name}</span>
                              )}
                              <span className="flex items-center gap-1 text-xs text-gray-300">
                                <Clock className="w-3 h-3" />
                                {age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age} days ago`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {prep.post_meeting_notes && (
                            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              Has notes
                            </span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded: report + notes */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          <pre className="p-6 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-7 max-h-[480px] overflow-y-auto bg-gray-50/50">
                            {prep.output}
                          </pre>

                          <div className="px-6 pb-6 pt-5 border-t border-gray-100 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Post-meeting notes</p>
                              <p className="text-xs text-gray-400">What happened in this meeting? The AI will reference these in future reports for this client.</p>
                            </div>
                            <textarea
                              value={notes[prep.id] ?? ''}
                              onChange={e => setNotes(prev => ({ ...prev, [prep.id]: e.target.value }))}
                              placeholder="e.g. Client closed 3 deals. They want to push YouTube Ads next month. CPL concerns addressed — they're happy with current targeting."
                              rows={3}
                              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                            <button
                              onClick={() => saveNotes(prep.id)}
                              disabled={noteSaving[prep.id]}
                              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all ${
                                noteSaved[prep.id]
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {noteSaved[prep.id]
                                ? <><Check className="w-3.5 h-3.5" /> Saved</>
                                : <><Save className="w-3.5 h-3.5" /> Save Notes</>
                              }
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
