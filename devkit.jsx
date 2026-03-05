import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: "#030310", navy: "#07071e", purple: "#8b5cf6", violet: "#a78bfa",
  blue: "#3b82f6", blueLight: "#60a5fa", gold: "#f59e0b", green: "#10b981",
  red: "#f87171", text: "#eeeeff", muted: "#9999bb",
  border: "rgba(255,255,255,0.08)", glass: "rgba(255,255,255,0.04)",
  glassHover: "rgba(255,255,255,0.07)",
};

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Syne:wght@400;500;600&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;overflow:hidden;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.35);border-radius:10px;}
    textarea,input{caret-color:${T.violet};}
    ::selection{background:rgba(139,92,246,0.35);color:${T.text};}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scanIn{from{opacity:0;transform:translateY(-6px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,20px)}}
    @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,30px)}}
    .tool-btn:hover{background:rgba(139,92,246,0.12)!important;border-color:rgba(139,92,246,0.35)!important;color:${T.violet}!important;}
    .tool-btn.active{background:rgba(139,92,246,0.18)!important;border-color:rgba(139,92,246,0.5)!important;color:${T.violet}!important;}
    .icon-btn:hover{background:rgba(255,255,255,0.08)!important;}
    .copy-btn:hover{color:${T.green}!important;}
    .cmd-item:hover,.cmd-item.selected{background:rgba(139,92,246,0.13)!important;border-color:rgba(139,92,246,0.3)!important;}
    .pill{transition:all 0.2s;}
    .pill:hover{opacity:0.85;}
  `}</style>
);

// ─── TOOLS CONFIG ─────────────────────────────────────────────────────────────
const TOOLS = [
  { id: "json",      icon: "{ }", label: "JSON",        desc: "Format & validate JSON",         cat: "Format"   },
  { id: "regex",     icon: ".*",  label: "Regex",       desc: "Live regex tester",               cat: "Test"     },
  { id: "base64",    icon: "b64", label: "Base64",      desc: "Encode & decode Base64",          cat: "Encode"   },
  { id: "color",     icon: "◈",   label: "Color",       desc: "HEX / RGB / HSL converter",      cat: "Convert"  },
  { id: "diff",      icon: "≠",   label: "Diff",        desc: "Compare two text blocks",         cat: "Compare"  },
  { id: "timestamp", icon: "⏱",   label: "Timestamp",   desc: "Unix ↔ human date",              cat: "Convert"  },
  { id: "url",       icon: "⊕",   label: "URL",         desc: "Encode & decode URLs",            cat: "Encode"   },
  { id: "uuid",      icon: "⚿",   label: "UUID/Hash",   desc: "Generate UUIDs & hashes",         cat: "Generate" },
  { id: "jwt",       icon: "⊞",   label: "JWT",         desc: "Decode & inspect JWT tokens",     cat: "Decode"   },
  { id: "css",       icon: "px",  label: "CSS Units",   desc: "px ↔ rem ↔ em converter",        cat: "Convert"  },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const copyToClipboard = async (text, setCopied) => {
  try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
};

const hexToRgb = (hex) => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
};
const rgbToHsl = (r,g,b) => {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}
  return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
};
const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);});
const simpleHash = (str) => { let h=5381; for(let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i)|0; return (h>>>0).toString(16).padStart(8,'0'); };
const decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decode = (str) => JSON.parse(atob(str.replace(/-/g,'+').replace(/_/g,'/')));
    return { header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] };
  } catch { return null; }
};

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
const Textarea = ({ value, onChange, placeholder, mono = false, rows = 8, style = {} }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10,
      color: T.text, fontFamily: mono ? "'JetBrains Mono',monospace" : "'Syne',sans-serif",
      fontSize: mono ? 12.5 : 14, padding:"12px 14px", resize:"vertical", outline:"none",
      lineHeight:1.65, transition:"border 0.2s", ...style }}
    onFocus={e=>e.target.style.borderColor="rgba(139,92,246,0.5)"}
    onBlur={e=>e.target.style.borderColor=T.border}
  />
);

const OutputBox = ({ label, value, mono = true, color = T.blueLight }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, textTransform:"uppercase", letterSpacing:"0.12em", color:T.muted }}>{label}</span>
        <button className="copy-btn" onClick={() => copyToClipboard(value, setCopied)}
          style={{ background:"none", border:"none", cursor:"pointer", color: copied ? T.green : T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:11, transition:"color 0.2s" }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div style={{ background:"rgba(0,0,0,0.35)", border:`1px solid ${T.border}`, borderRadius:10,
        padding:"12px 14px", fontFamily: mono ? "'JetBrains Mono',monospace" : "'Syne',sans-serif",
        fontSize: mono ? 12.5 : 14, color, whiteSpace:"pre-wrap", wordBreak:"break-all",
        maxHeight:220, overflowY:"auto", lineHeight:1.7 }}>
        {value || <span style={{color:T.muted,opacity:0.5}}>output appears here</span>}
      </div>
    </div>
  );
};

const Label = ({ children }) => (
  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, textTransform:"uppercase",
    letterSpacing:"0.12em", color:T.violet, marginBottom:7 }}>{children}</div>
);

const Row = ({ children, gap=10 }) => (
  <div style={{ display:"flex", gap, alignItems:"center", flexWrap:"wrap" }}>{children}</div>
);

const Pill = ({ children, active, onClick, color = T.purple }) => (
  <button className="pill" onClick={onClick}
    style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${active ? color : T.border}`,
      background: active ? `${color}22` : "transparent", color: active ? color : T.muted,
      fontFamily:"'JetBrains Mono',monospace", fontSize:12, cursor:"pointer" }}>
    {children}
  </button>
);

// ─── TOOL: JSON ───────────────────────────────────────────────────────────────
const JsonTool = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('format');

  const process = () => {
    try {
      const parsed = JSON.parse(input);
      if (mode === 'format') setOutput(JSON.stringify(parsed, null, 2));
      else if (mode === 'minify') setOutput(JSON.stringify(parsed));
      else if (mode === 'keys') {
        const getKeys = (obj, prefix='') => Object.keys(obj).flatMap(k => {
          const val = obj[k]; const full = prefix ? `${prefix}.${k}` : k;
          return typeof val === 'object' && val !== null && !Array.isArray(val) ? [full, ...getKeys(val, full)] : [full];
        });
        setOutput(getKeys(parsed).join('\n'));
      }
      setError('');
    } catch(e) { setError(e.message); setOutput(''); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, height:"100%" }}>
      <Row>
        {['format','minify','keys'].map(m => <Pill key={m} active={mode===m} onClick={()=>setMode(m)}>{m}</Pill>)}
        <button onClick={process} style={{ marginLeft:"auto", padding:"6px 20px", borderRadius:8,
          background:`linear-gradient(135deg,${T.purple},${T.blue})`, border:"none", color:"white",
          fontFamily:"'JetBrains Mono',monospace", fontSize:12, cursor:"pointer", fontWeight:600 }}>
          RUN ⚡
        </button>
      </Row>
      <div><Label>Input JSON</Label><Textarea value={input} onChange={setInput} placeholder='{"hello": "world"}' mono rows={9}/></div>
      {error && <div style={{ color:T.red, fontFamily:"'JetBrains Mono',monospace", fontSize:12, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, padding:"8px 12px" }}>✗ {error}</div>}
      <OutputBox label="Output" value={output} />
    </div>
  );
};

// ─── TOOL: REGEX ──────────────────────────────────────────────────────────────
const RegexTool = () => {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testStr, setTestStr] = useState('');
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pattern || !testStr) { setMatches([]); setError(''); return; }
    try {
      const rx = new RegExp(pattern, flags);
      const found = [...testStr.matchAll(new RegExp(pattern, flags.includes('g') ? flags : flags+'g'))];
      setMatches(found.map(m => ({ full: m[0], index: m.index, groups: m.slice(1) })));
      setError('');
    } catch(e) { setError(e.message); setMatches([]); }
  }, [pattern, flags, testStr]);

  const highlighted = () => {
    if (!pattern || !testStr || error) return testStr;
    try {
      return testStr.replace(new RegExp(pattern, flags.includes('g') ? flags : flags+'g'),
        m => `⟪${m}⟫`);
    } catch { return testStr; }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <Label>Pattern</Label>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, position:"relative" }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:16 }}>/</span>
            <input value={pattern} onChange={e=>setPattern(e.target.value)} placeholder="[a-z]+" style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:14, padding:"10px 14px 10px 24px", outline:"none" }} />
          </div>
          <input value={flags} onChange={e=>setFlags(e.target.value)} style={{ width:60, background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.violet, fontFamily:"'JetBrains Mono',monospace", fontSize:14, padding:"10px", outline:"none", textAlign:"center" }} />
        </div>
        {error && <div style={{ color:T.red, fontFamily:"'JetBrains Mono',monospace", fontSize:11, marginTop:5 }}>✗ {error}</div>}
      </div>
      <div><Label>Test String</Label><Textarea value={testStr} onChange={setTestStr} placeholder="Paste your test text here..." mono rows={5}/></div>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: matches.length > 0 ? T.green : T.muted }}>
          {matches.length > 0 ? `✓ ${matches.length} match${matches.length>1?'es':''}` : "no matches"}
        </span>
      </div>
      {matches.length > 0 && (
        <div style={{ background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, padding:12, maxHeight:160, overflowY:"auto" }}>
          {matches.map((m,i) => (
            <div key={i} style={{ display:"flex", gap:12, padding:"5px 0", borderBottom: i<matches.length-1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ color:T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:11, minWidth:20 }}>{i}</span>
              <span style={{ color:T.gold, fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>"{m.full}"</span>
              <span style={{ color:T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>@{m.index}</span>
              {m.groups.length > 0 && <span style={{ color:T.blueLight, fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>groups: {m.groups.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
      {testStr && pattern && !error && <OutputBox label="Highlighted (matches in ⟪⟫)" value={highlighted()} />}
    </div>
  );
};

// ─── TOOL: BASE64 ─────────────────────────────────────────────────────────────
const Base64Tool = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState('encode');

  useEffect(() => {
    if (!input) { setOutput(''); return; }
    try {
      if (mode === 'encode') setOutput(btoa(unescape(encodeURIComponent(input))));
      else setOutput(decodeURIComponent(escape(atob(input.trim()))));
    } catch { setOutput('⚠ Invalid input'); }
  }, [input, mode]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Row><Pill active={mode==='encode'} onClick={()=>setMode('encode')}>encode</Pill><Pill active={mode==='decode'} onClick={()=>setMode('decode')}>decode</Pill></Row>
      <div><Label>{mode === 'encode' ? 'Plain Text Input' : 'Base64 Input'}</Label><Textarea value={input} onChange={setInput} placeholder={mode==='encode' ? 'Hello, World!' : 'SGVsbG8sIFdvcmxkIQ=='} mono rows={7}/></div>
      <OutputBox label={mode === 'encode' ? 'Base64 Output' : 'Decoded Output'} value={output} />
    </div>
  );
};

// ─── TOOL: COLOR ──────────────────────────────────────────────────────────────
const ColorTool = () => {
  const [hex, setHex] = useState('#8b5cf6');
  const [r,setR] = useState(139); const [g,setG] = useState(92); const [b2,setB2] = useState(246);
  const rgb = hexToRgb(hex) || {r,g,b:b2};
  const hsl = rgbToHsl(rgb.r,rgb.g,rgb.b);

  const fromHex = (v) => {
    setHex(v);
    const c = hexToRgb(v);
    if(c){setR(c.r);setG(c.g);setB2(c.b);}
  };
  const fromRgb = (nr,ng,nb) => {
    setR(nr);setG(ng);setB2(nb);
    setHex(`#${[nr,ng,nb].map(x=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,'0')).join('')}`);
  };

  const vals = [
    { label:"HEX", value: hex },
    { label:"RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { label:"HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
    { label:"CSS var", value: `--color: ${hex};` },
    { label:"Tailwind approx", value: `bg-[${hex}]` },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
        <div style={{ width:100, height:100, borderRadius:14, background:hex, border:`1px solid ${T.border}`, flexShrink:0, boxShadow:`0 0 30px ${hex}55` }} />
        <div style={{ flex:1 }}>
          <Label>HEX</Label>
          <input value={hex} onChange={e=>fromHex(e.target.value)} style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:16, padding:"9px 14px", outline:"none", marginBottom:10 }} />
          <input type="color" value={hex} onChange={e=>fromHex(e.target.value)} style={{ width:"100%", height:36, border:"none", background:"none", cursor:"pointer", borderRadius:8 }} />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[["R",r,setR,0],["G",g,setG,1],["B",b2,setB2,2]].map(([lbl,val,setter])=>(
          <div key={lbl}>
            <Label>{lbl}</Label>
            <input type="number" min={0} max={255} value={val} onChange={e=>{
              const n=Number(e.target.value);
              if(lbl==="R") fromRgb(n,g,b2); else if(lbl==="G") fromRgb(r,n,b2); else fromRgb(r,g,n);
            }} style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:14, padding:"9px 14px", outline:"none" }} />
          </div>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {vals.map(({label,value}) => {
          const [copied, setCopied] = useState(false);
          return (
            <div key={label} onClick={() => copyToClipboard(value, setCopied)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.25)", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", cursor:"pointer", transition:"all 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.35)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.muted, minWidth:60 }}>{label}</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.blueLight }}>{value}</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color: copied ? T.green : T.muted }}>{copied ? "✓" : "copy"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── TOOL: DIFF ───────────────────────────────────────────────────────────────
const DiffTool = () => {
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const diff = () => {
    if (!a || !b) return [];
    const la = a.split('\n'), lb = b.split('\n');
    const maxLen = Math.max(la.length, lb.length);
    return Array.from({length: maxLen}, (_,i) => {
      const lineA = la[i] ?? null, lineB = lb[i] ?? null;
      if (lineA === lineB) return { type:'same', a:lineA, b:lineB, i };
      if (lineA === null) return { type:'add', a:null, b:lineB, i };
      if (lineB === null) return { type:'rem', a:lineA, b:null, i };
      return { type:'change', a:lineA, b:lineB, i };
    });
  };

  const lines = diff();
  const changed = lines.filter(l=>l.type!=='same').length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><Label>Original (A)</Label><Textarea value={a} onChange={setA} placeholder="Original text..." rows={7}/></div>
        <div><Label>Modified (B)</Label><Textarea value={b} onChange={setB} placeholder="Modified text..." rows={7}/></div>
      </div>
      {lines.length > 0 && (
        <>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: changed > 0 ? T.gold : T.green }}>
            {changed > 0 ? `⚡ ${changed} line${changed>1?'s':''} changed` : '✓ identical'}
          </div>
          <div style={{ background:"rgba(0,0,0,0.35)", border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden", maxHeight:220, overflowY:"auto" }}>
            {lines.map(line => (
              <div key={line.i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ padding:"5px 10px", fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  background: line.type==='rem'||line.type==='change' ? "rgba(248,113,113,0.08)" : "transparent",
                  color: line.type==='rem'||line.type==='change' ? T.red : T.muted, borderRight:`1px solid ${T.border}` }}>
                  {line.a ?? ''}
                </div>
                <div style={{ padding:"5px 10px", fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  background: line.type==='add'||line.type==='change' ? "rgba(16,185,129,0.08)" : "transparent",
                  color: line.type==='add'||line.type==='change' ? T.green : T.muted }}>
                  {line.b ?? ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── TOOL: TIMESTAMP ──────────────────────────────────────────────────────────
const TimestampTool = () => {
  const [unix, setUnix] = useState(Math.floor(Date.now()/1000).toString());
  const [human, setHuman] = useState('');

  const now = () => setUnix(Math.floor(Date.now()/1000).toString());

  const fromUnix = (v) => {
    setUnix(v);
    if (!v) { setHuman(''); return; }
    try {
      const d = new Date(Number(v) * (v.length <= 10 ? 1000 : 1));
      setHuman(isNaN(d) ? 'invalid' : d.toISOString());
    } catch { setHuman('invalid'); }
  };
  const fromHuman = (v) => {
    setHuman(v);
    if (!v) { setUnix(''); return; }
    try {
      const d = new Date(v);
      setUnix(isNaN(d) ? 'invalid' : Math.floor(d.getTime()/1000).toString());
    } catch { setUnix('invalid'); }
  };

  const date = unix && !isNaN(unix) ? new Date(Number(unix)*1000) : null;
  const formats = date ? [
    { label:"ISO 8601",    v: date.toISOString() },
    { label:"UTC",         v: date.toUTCString() },
    { label:"Local",       v: date.toLocaleString() },
    { label:"Date only",   v: date.toLocaleDateString() },
    { label:"Time only",   v: date.toLocaleTimeString() },
    { label:"Relative",    v: (() => { const s=Math.floor((Date.now()-date)/1000); if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; })() },
  ] : [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"end" }}>
        <div>
          <Label>Unix Timestamp</Label>
          <input value={unix} onChange={e=>fromUnix(e.target.value)} style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:15, padding:"10px 14px", outline:"none" }} />
        </div>
        <div style={{ color:T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:16, paddingBottom:8 }}>⇄</div>
        <div>
          <Label>Human Date</Label>
          <input value={human} onChange={e=>fromHuman(e.target.value)} placeholder="2025-01-01T00:00:00Z" style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none" }} />
        </div>
      </div>
      <button onClick={now} style={{ alignSelf:"flex-start", padding:"6px 16px", borderRadius:8, background:"rgba(139,92,246,0.15)", border:`1px solid rgba(139,92,246,0.3)`, color:T.violet, fontFamily:"'JetBrains Mono',monospace", fontSize:12, cursor:"pointer" }}>⏱ Now</button>
      {formats.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {formats.map(({label,v}) => {
            const [copied, setCopied] = useState(false);
            return (
              <div key={label} onClick={()=>copyToClipboard(v,setCopied)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.25)", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.35)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.muted, minWidth:80 }}>{label}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.blueLight }}>{v}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color: copied?T.green:T.muted }}>{copied?"✓":"copy"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── TOOL: URL ────────────────────────────────────────────────────────────────
const UrlTool = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('encode');

  const output = (() => {
    if (!input) return '';
    try {
      if (mode === 'encode') return encodeURIComponent(input);
      if (mode === 'decode') return decodeURIComponent(input);
      if (mode === 'parse') {
        const u = new URL(input.includes('://') ? input : 'https://'+input);
        return JSON.stringify({ protocol:u.protocol, host:u.host, pathname:u.pathname, search:u.search, hash:u.hash, params: Object.fromEntries(u.searchParams) }, null, 2);
      }
    } catch(e) { return `⚠ ${e.message}`; }
  })();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Row><Pill active={mode==='encode'} onClick={()=>setMode('encode')}>encode</Pill><Pill active={mode==='decode'} onClick={()=>setMode('decode')}>decode</Pill><Pill active={mode==='parse'} onClick={()=>setMode('parse')}>parse URL</Pill></Row>
      <div><Label>Input</Label><Textarea value={input} onChange={setInput} placeholder={mode==='parse'?'https://example.com/path?foo=bar':'text to encode...'} mono rows={6}/></div>
      <OutputBox label="Output" value={output} />
    </div>
  );
};

// ─── TOOL: UUID ───────────────────────────────────────────────────────────────
const UuidTool = () => {
  const [uuids, setUuids] = useState([generateUUID()]);
  const [hashInput, setHashInput] = useState('');
  const [count, setCount] = useState(1);

  const genUuids = () => setUuids(Array.from({length:count}, generateUUID));
  const hash = hashInput ? `djb2: ${simpleHash(hashInput)}\nlength: ${hashInput.length}\ncharCodes: ${[...hashInput].slice(0,6).map(c=>c.charCodeAt(0)).join(', ')}${hashInput.length>6?'...':''}` : '';

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div>
        <Label>UUID v4 Generator</Label>
        <Row gap={8}>
          <input type="number" min={1} max={20} value={count} onChange={e=>setCount(Number(e.target.value))}
            style={{ width:64, background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:13, padding:"7px 10px", outline:"none" }} />
          <button onClick={genUuids} style={{ padding:"7px 18px", borderRadius:8, background:`linear-gradient(135deg,${T.purple},${T.blue})`, border:"none", color:"white", fontFamily:"'JetBrains Mono',monospace", fontSize:12, cursor:"pointer", fontWeight:600 }}>
            GENERATE
          </button>
        </Row>
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
          {uuids.map((u,i) => {
            const [copied, setCopied] = useState(false);
            return (
              <div key={i} onClick={()=>copyToClipboard(u,setCopied)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 14px", cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.4)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:T.blueLight }}>{u}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:copied?T.green:T.muted }}>{copied?"✓":"copy"}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <Label>Quick Hash (djb2)</Label>
        <Textarea value={hashInput} onChange={setHashInput} placeholder="Type anything to hash..." rows={3}/>
        {hash && <OutputBox label="Hash Info" value={hash} />}
      </div>
    </div>
  );
};

// ─── TOOL: JWT ────────────────────────────────────────────────────────────────
const JwtTool = () => {
  const [token, setToken] = useState('');
  const decoded = token.trim() ? decodeJWT(token.trim()) : null;

  const isExpired = decoded?.payload?.exp ? decoded.payload.exp * 1000 < Date.now() : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div><Label>JWT Token</Label><Textarea value={token} onChange={setToken} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." mono rows={5}/></div>
      {token && !decoded && <div style={{ color:T.red, fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>✗ Invalid JWT token</div>}
      {decoded && (
        <>
          {isExpired !== null && (
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: isExpired ? T.red : T.green }}>
              {isExpired ? "⚠ Token is EXPIRED" : "✓ Token is valid (not expired)"}
            </div>
          )}
          <OutputBox label="Header" value={JSON.stringify(decoded.header, null, 2)} />
          <OutputBox label="Payload" value={JSON.stringify(decoded.payload, null, 2)} color={T.gold}/>
          <OutputBox label="Signature" value={decoded.signature} color={T.muted}/>
        </>
      )}
    </div>
  );
};

// ─── TOOL: CSS UNITS ─────────────────────────────────────────────────────────
const CssTool = () => {
  const [base, setBase] = useState(16);
  const [px, setPx] = useState('16');
  const [rem, setRem] = useState('1');

  const fromPx = v => { setPx(v); setRem(v ? (Number(v)/base).toFixed(4) : ''); };
  const fromRem = v => { setRem(v); setPx(v ? (Number(v)*base).toFixed(2) : ''); };

  const scale = [4,8,12,16,20,24,32,40,48,56,64,80,96,128];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <Label>Base Font Size (px)</Label>
        <input type="number" value={base} onChange={e=>setBase(Number(e.target.value))}
          style={{ width:80, background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.violet, fontFamily:"'JetBrains Mono',monospace", fontSize:15, padding:"9px 14px", outline:"none" }} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"end" }}>
        <div><Label>px</Label><input value={px} onChange={e=>fromPx(e.target.value)} style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:16, padding:"10px 14px", outline:"none" }} /></div>
        <div style={{ color:T.muted, fontFamily:"'JetBrains Mono',monospace", fontSize:16, paddingBottom:8 }}>⇄</div>
        <div><Label>rem</Label><input value={rem} onChange={e=>fromRem(e.target.value)} style={{ width:"100%", background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontFamily:"'JetBrains Mono',monospace", fontSize:16, padding:"10px 14px", outline:"none" }} /></div>
      </div>
      <div>
        <Label>Common Scale Reference</Label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
          {scale.map(s => {
            const [copied, setCopied] = useState(false);
            return (
              <div key={s} onClick={()=>{ fromPx(s.toString()); copyToClipboard(`${(s/base).toFixed(4)}rem`, setCopied); }}
                style={{ background:"rgba(0,0,0,0.3)", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 4px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(139,92,246,0.4)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.blueLight }}>{s}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:T.muted }}>{(s/base).toFixed(2)}r</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TOOL MAP ────────────────────────────────────────────────────────────────
const TOOL_COMPONENTS = {
  json: JsonTool, regex: RegexTool, base64: Base64Tool, color: ColorTool,
  diff: DiffTool, timestamp: TimestampTool, url: UrlTool, uuid: UuidTool,
  jwt: JwtTool, css: CssTool,
};

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
const CommandPalette = ({ onSelect, onClose }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = TOOLS.filter(t =>
    t.label.toLowerCase().includes(q.toLowerCase()) ||
    t.desc.toLowerCase().includes(q.toLowerCase()) ||
    t.cat.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => { setSel(0); }, [q]);

  const handleKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s+1, filtered.length-1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
    if (e.key === 'Enter' && filtered[sel]) { onSelect(filtered[sel].id); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(3,3,16,0.85)", backdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:120 }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", maxWidth:580, background:"rgba(7,7,30,0.95)", border:`1px solid rgba(139,92,246,0.3)`, borderRadius:16, overflow:"hidden", boxShadow:`0 0 80px rgba(139,92,246,0.25), 0 30px 60px rgba(0,0,0,0.5)`, animation:"scanIn 0.15s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ color:T.violet, fontSize:18 }}>⌘</span>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={handleKey}
            placeholder="Search tools..." style={{ flex:1, background:"none", border:"none", outline:"none", color:T.text, fontFamily:"'Syne',sans-serif", fontSize:16 }} />
          <kbd style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.muted, background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, borderRadius:5, padding:"2px 7px" }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:380, overflowY:"auto" }}>
          {filtered.length === 0 && <div style={{ padding:"24px 18px", color:T.muted, fontFamily:"'Syne',sans-serif", fontSize:14, textAlign:"center" }}>No tools found</div>}
          {filtered.map((t,i) => (
            <div key={t.id} className="cmd-item" onClick={()=>{onSelect(t.id);onClose();}}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 18px", cursor:"pointer", transition:"all 0.15s", background: i===sel ? "rgba(139,92,246,0.13)" : "transparent", borderLeft: i===sel ? `2px solid ${T.violet}` : "2px solid transparent" }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"rgba(139,92,246,0.12)", border:`1px solid rgba(139,92,246,0.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.violet, flexShrink:0 }}>{t.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14, color:T.text }}>{t.label}</div>
                <div style={{ fontSize:12, color:T.muted, marginTop:1 }}>{t.desc}</div>
              </div>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.muted, background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:5, padding:"2px 8px" }}>{t.cat}</span>
            </div>
          ))}
        </div>
        <div style={{ padding:"10px 18px", borderTop:`1px solid ${T.border}`, display:"flex", gap:16 }}>
          {[["↑↓","navigate"],["↵","open"],["esc","close"]].map(([k,l])=>(
            <span key={k} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:5 }}>
              <kbd style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, borderRadius:4, padding:"1px 6px" }}>{k}</kbd> {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function DevKit() {
  const [active, setActive] = useState('json');
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette(p => !p); }
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ActiveTool = TOOL_COMPONENTS[active];
  const activeMeta = TOOLS.find(t => t.id === active);

  return (
    <>
      <GlobalStyle />
      {/* NEBULA ORBS */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)", top:-100, left:-120, filter:"blur(80px)", animation:"orb1 18s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", bottom:0, right:-80, filter:"blur(80px)", animation:"orb2 14s ease-in-out infinite" }}/>
      </div>

      <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns:"220px 1fr", gridTemplateRows:"auto 1fr", height:"100vh", overflow:"hidden" }}>

        {/* TOP BAR */}
        <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", height:54, background:"rgba(7,7,30,0.8)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, fontWeight:900, background:`linear-gradient(135deg,#fff 0%,${T.violet} 50%,${T.blueLight} 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>DEVKIT</div>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.muted, background:"rgba(139,92,246,0.1)", border:`1px solid rgba(139,92,246,0.2)`, borderRadius:5, padding:"2px 8px" }}>v1.0</span>
          </div>
          <button onClick={()=>setPalette(true)} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 16px", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:9, cursor:"pointer", transition:"all 0.2s", color:T.muted, fontFamily:"'Syne',sans-serif", fontSize:13 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(139,92,246,0.35)"; e.currentTarget.style.color=T.text; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.muted; }}>
            <span>Search tools...</span>
            <div style={{ display:"flex", gap:3 }}>
              <kbd style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, background:"rgba(255,255,255,0.08)", border:`1px solid ${T.border}`, borderRadius:4, padding:"1px 6px" }}>⌘K</kbd>
            </div>
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:T.green, boxShadow:`0 0 8px ${T.green}`, animation:"pulse 2s infinite" }}/>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.muted }}>10 tools loaded</span>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ background:"rgba(7,7,30,0.6)", backdropFilter:"blur(20px)", borderRight:`1px solid ${T.border}`, overflowY:"auto", padding:"12px 10px" }}>
          {[...new Set(TOOLS.map(t=>t.cat))].map(cat => (
            <div key={cat} style={{ marginBottom:16 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:"uppercase", letterSpacing:"0.15em", color:T.muted, padding:"0 8px", marginBottom:5, opacity:0.6 }}>{cat}</div>
              {TOOLS.filter(t=>t.cat===cat).map(t => (
                <button key={t.id} className={`tool-btn ${active===t.id?'active':''}`} onClick={()=>setActive(t.id)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", background:"transparent", border:`1px solid transparent`, borderRadius:9, cursor:"pointer", textAlign:"left", transition:"all 0.2s", color: active===t.id ? T.violet : T.muted, marginBottom:2 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, minWidth:22, textAlign:"center" }}>{t.icon}</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight: active===t.id ? 600 : 400 }}>{t.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* MAIN PANEL */}
        <div style={{ overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:0 }}>
          <div style={{ marginBottom:20, animation:"fadeIn 0.3s ease" }} key={active}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:"rgba(139,92,246,0.15)", border:`1px solid rgba(139,92,246,0.3)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.violet }}>{activeMeta.icon}</div>
              <div>
                <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:18, fontWeight:700, color:T.text }}>{activeMeta.label}</h1>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:T.muted, marginTop:1 }}>{activeMeta.desc}</p>
              </div>
            </div>
          </div>
          <div key={active + '_body'} style={{ animation:"fadeIn 0.25s ease" }}>
            <ActiveTool />
          </div>
        </div>
      </div>

      {palette && <CommandPalette onSelect={id => setActive(id)} onClose={() => setPalette(false)} />}
    </>
  );
}
