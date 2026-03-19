import React, { useState } from 'react';
import axios from 'axios';
import { Search, Info, Flame } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api/v1';

interface SpanProp {
  service: string;
  name: string;
  duration: number;
}

export default function TraceExplorer() {
  const [traceId, setTraceId] = useState('');
  const [spans, setSpans] = useState<SpanProp[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceId.trim()) return;
    
    setSearched(true);
    try {
      const res = await axios.post(`${API_BASE}/traces/query`, { trace_id: traceId });
      setSpans(res.data.spans);
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">Trace Explorer</h1>
      <p className="text-gray-400 mb-8">Query hierarchical Span cascades deeply indexed instantly by Tantivy.</p>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Paste exactly Trace ID manually (e.g. 5f4e-2a...)"
            value={traceId}
            onChange={e => setTraceId(e.target.value)}
            className="w-full bg-surface/50 backdrop-blur-md border border-white/10 rounded-full py-4 pl-12 pr-6 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono shadow-xl"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-full font-bold transition-all shadow-lg hover:shadow-primary/20">
            Execute
          </button>
        </div>
      </form>

      {searched && spans.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-white/10 bg-transparent">
           <Info className="w-12 h-12 text-gray-500 mx-auto mb-4" />
           <p className="text-xl text-gray-300 font-bold">No spans tracked</p>
           <p className="text-gray-500 mt-2">No active Spans matched that specific Trace ID query routing rapidly over Tantivy.</p>
        </div>
      ) : (
        spans.length > 0 && (
          <div className="glass-panel p-6 shadow-2xl">
            <h3 className="font-bold mb-4 text-xl border-b border-white/10 pb-4 flex items-center gap-2">
               <Flame className="w-5 h-5 text-orange-500" />
               Flame Graph Summary
            </h3>
            <div className="space-y-2">
               {spans.map((s, i) => (
                 <div key={i} className="p-3 bg-white/5 bg-gradient-to-r from-transparent hover:to-primary/5 rounded-lg border border-white/5 font-mono text-sm flex gap-4 transition-colors">
                   <div className="text-primary w-32 truncate font-bold">{s.service}</div>
                   <div className="text-gray-300 flex-1">{s.name}</div>
                   <div className="text-gray-400 bg-black/40 px-3 py-1 rounded shadow-inner">{s.duration} ms</div>
                 </div>
               ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
