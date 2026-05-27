import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useParams } from 'react-router-dom';

// Backend API Base Configuration
// Dynamically use window.location.hostname to prevent cross-site cookie blocking (localhost vs 127.0.0.1)
const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:5000/api`;

// Auth Context
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) setUser(data.user);
    return { ok: res.ok, data };
  };

  const register = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) setUser(data.user);
    return { ok: res.ok, data };
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// ==========================================
// BACKGROUND COMPONENT
// ==========================================
const Background = () => (
  <>
    <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#090d16_1px,transparent_1px),linear-gradient(to_bottom,#090d16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80" />
    <div className="fixed top-[-10%] left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
    <div className="fixed bottom-[-10%] right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none z-0" />
  </>
);

// ==========================================
// HEADER COMPONENT
// ==========================================
const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="w-full bg-black/20 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center px-6 md:px-12 relative z-20">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-black tracking-[0.2em] text-sm uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          RTI Ledger
        </span>
      </Link>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-500 font-mono tracking-widest">{user.email}</span>
          <button 
            onClick={() => { logout(); navigate('/'); }}
            className="text-[10px] bg-white/[0.03] border border-white/10 hover:border-emerald-500/50 px-3 py-1.5 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors"
          >
            LOGOUT
          </button>
        </div>
      )}
    </header>
  );
};

// ==========================================
// VIEWS
// ==========================================

const EntryPage = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const action = isLogin ? login : register;
    const { ok, data } = await action(email, password);
    if (!ok) setError(data.error || 'Authentication failed');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative z-10">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase">
            Democratizing <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
              Information Access
            </span>
          </h1>
          <p className="text-gray-400 text-sm tracking-wide font-medium leading-relaxed">
            The Right to Information Act, 2005 empowers citizens to seek information from public authorities, promoting transparency and accountability in governance. Our secure ledger archives, redacts, and indexes responses for public benefit.
          </p>
        </div>

        <div className="bg-white/[0.01] border border-white/5 p-8 rounded-3xl backdrop-blur-2xl shadow-2xl animate-fadeIn">
          <div className="flex gap-4 mb-8">
            <button onClick={() => setIsLogin(true)} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors ${isLogin ? 'border-emerald-500 text-white' : 'border-transparent text-gray-600'}`}>Login</button>
            <button onClick={() => setIsLogin(false)} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors ${!isLogin ? 'border-emerald-500 text-white' : 'border-transparent text-gray-600'}`}>Register</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Citizen Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors" />
            <input type="password" placeholder="Secure Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors" />
            {error && <p className="text-red-400 text-[10px] font-mono">{error}</p>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider text-xs py-4 rounded-xl transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              {isLogin ? 'Authenticate' : 'Initialize Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <div className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full relative z-10 animate-fadeIn space-y-8 mt-10">
      <h2 className="text-3xl font-black uppercase tracking-tight">Citizen Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/my-documents" className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/30 p-8 rounded-2xl transition-all group flex flex-col items-center justify-center text-center space-y-4 shadow-lg backdrop-blur-sm">
          <span className="text-4xl group-hover:scale-110 transition-transform">📂</span>
          <span className="text-xs font-black uppercase tracking-widest text-gray-300 group-hover:text-emerald-400">My Uploaded Documents</span>
        </Link>
        <Link to="/upload" className="bg-emerald-500/[0.05] hover:bg-emerald-500/[0.1] border border-emerald-500/20 hover:border-emerald-500/50 p-8 rounded-2xl transition-all group flex flex-col items-center justify-center text-center space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.1)] backdrop-blur-sm">
          <span className="text-4xl group-hover:scale-110 transition-transform">📤</span>
          <span className="text-xs font-black uppercase tracking-widest text-emerald-400 group-hover:text-emerald-300">Upload New RTI</span>
        </Link>
        <Link to="/search" className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/30 p-8 rounded-2xl transition-all group flex flex-col items-center justify-center text-center space-y-4 shadow-lg backdrop-blur-sm">
          <span className="text-4xl group-hover:scale-110 transition-transform">🔍</span>
          <span className="text-xs font-black uppercase tracking-widest text-gray-300 group-hover:text-emerald-400">Search Database</span>
        </Link>
      </div>
    </div>
  );
};

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/departments`, { credentials: 'include' }).then(r => r.json()).then(setDepartments).catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() && !selectedDept) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const qs = new URLSearchParams();
      if (searchQuery) qs.append('q', searchQuery);
      if (selectedDept) qs.append('department', selectedDept);
      const res = await fetch(`${API_BASE}/search?${qs.toString()}`, { credentials: 'include' });
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedDept) handleSearch();
  }, [selectedDept]);

  return (
    <div className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full relative z-10 animate-fadeIn space-y-8 mt-4">
      <Link to="/dashboard" className="text-xs font-bold text-gray-500 hover:text-emerald-400 transition-colors">← Dashboard</Link>
      
      <div className="space-y-6">
        <h2 className="text-3xl font-black uppercase tracking-tight">Search Ledger</h2>
        
        <form onSubmit={handleSearch} className="flex gap-3 bg-white/[0.02] border border-white/10 p-2 rounded-2xl shadow-2xl backdrop-blur-xl focus-within:border-emerald-500/40 transition-colors">
          <input 
            type="text" 
            placeholder="Search by keyword, ward, or content..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm px-4 py-3 focus:outline-none"
          />
          <button type="submit" className="bg-white text-black font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all cursor-pointer">
            {loading ? '...' : 'Query'}
          </button>
        </form>

        {hasSearched && (
          <div className="space-y-4 pt-4">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Results ({searchResults.length})</h3>
             <div className="grid grid-cols-1 gap-4">
                {searchResults.map(post => (
                  <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-6 transition-all cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20">{post.department}</span>
                        <h4 className="text-lg font-bold pt-1">{post.title}</h4>
                      </div>
                      <span className="text-xs text-gray-500">{post.state}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-3 line-clamp-2">{post.description}</p>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Ministry Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-4">
          <div 
            onClick={() => setSelectedDept('')}
            className={`bg-white/[0.02] backdrop-blur-md rounded-xl p-6 border-t-4 border-t-gray-500 border-x border-b border-x-white/5 border-b-white/5 hover:bg-white/[0.05] transition-all cursor-pointer shadow-lg group relative ${selectedDept === '' ? 'ring-2 ring-emerald-500 bg-white/[0.05]' : ''}`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="text-gray-400 text-lg">📁</span>
            </div>
            <h3 className="text-white font-bold text-lg mb-2">All Ministries</h3>
            <p className="text-gray-400 text-xs">Search across all available government departments and ministries.</p>
            <span className="absolute top-6 right-6 text-gray-500 group-hover:text-white transition-colors">↗</span>
          </div>

          {departments.map((dept, idx) => {
            const colors = ['emerald', 'blue', 'red', 'orange', 'pink', 'purple', 'teal', 'cyan'];
            const color = colors[idx % colors.length];
            const borderColors = {
              emerald: 'border-t-emerald-500', blue: 'border-t-blue-500', red: 'border-t-red-500', 
              orange: 'border-t-orange-500', pink: 'border-t-pink-500', purple: 'border-t-purple-500', 
              teal: 'border-t-teal-500', cyan: 'border-t-cyan-500'
            };
            const bgColors = {
              emerald: 'bg-emerald-500/20', blue: 'bg-blue-500/20', red: 'bg-red-500/20', 
              orange: 'bg-orange-500/20', pink: 'bg-pink-500/20', purple: 'bg-purple-500/20', 
              teal: 'bg-teal-500/20', cyan: 'bg-cyan-500/20'
            };
            const textColors = {
              emerald: 'text-emerald-400', blue: 'text-blue-400', red: 'text-red-400', 
              orange: 'text-orange-400', pink: 'text-pink-400', purple: 'text-purple-400', 
              teal: 'text-teal-400', cyan: 'text-cyan-400'
            };
            
            return (
              <div 
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`bg-white/[0.02] backdrop-blur-md rounded-xl p-6 border-t-4 ${borderColors[color]} border-x border-b border-x-white/5 border-b-white/5 hover:bg-white/[0.05] transition-all cursor-pointer shadow-lg group relative ${selectedDept === dept ? 'ring-2 ring-white/50 bg-white/[0.05]' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full ${bgColors[color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className={`${textColors[color]} text-lg`}>🏛️</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{dept}</h3>
                <p className="text-gray-400 text-xs line-clamp-3">Explore public documents and RTI responses filed under {dept}.</p>
                <span className={`absolute top-6 right-6 ${textColors[color]} opacity-50 group-hover:opacity-100 transition-opacity`}>↗</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const UploadForm = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('BBMP');
  const [stateParam, setStateParam] = useState('Karnataka');
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!description.trim()) { setStatus('Description is mandatory.'); return; }
    
    setUploading(true);
    setStatus('Processing and redacting document...');
    
    const formData = new FormData();
    formData.append('rti_pdf', selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('department', department);
    formData.append('state', stateParam);

    try {
      const res = await fetch(`${API_BASE}/upload-rti`, { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setStatus('Success! Document secured and vaulted.');
        setTitle(''); setDescription(''); setSelectedFile(null);
        document.getElementById('file-upload').value = '';
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Network failure.');
    }
    setUploading(false);
  };

  return (
    <div className="flex-1 p-6 md:p-12 max-w-xl mx-auto w-full relative z-10 animate-fadeIn mt-4">
      <Link to="/dashboard" className="text-xs font-bold text-gray-500 hover:text-emerald-400 transition-colors block mb-6">← Dashboard</Link>
      
      <div className="bg-white/[0.01] border border-white/5 p-8 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-tight">File Public Document</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Title</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description (Mandatory for Indexing)</label>
            <textarea required rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Summarize the contents..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Department</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">State</label>
              <input type="text" value={stateParam} onChange={e => setStateParam(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="border border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 text-center relative bg-black/40 group">
            <input id="file-upload" type="file" required accept=".pdf" onChange={e => setSelectedFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <span className="text-xs text-gray-400 font-medium group-hover:text-gray-300">{selectedFile ? `📄 ${selectedFile.name}` : "Drag and drop raw PDF here"}</span>
          </div>
          <button type="submit" disabled={uploading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            {uploading ? 'Processing...' : 'Strip PII & Broadcast'}
          </button>
        </form>
        {status && <div className="p-3 text-[10px] text-center font-mono border border-white/10 rounded-lg">{status}</div>}
      </div>
    </div>
  );
};

const MyDocuments = () => {
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/posts/me`, { credentials: 'include' }).then(r => r.json()).then(setPosts).catch(console.error);
  }, []);

  return (
    <div className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full relative z-10 animate-fadeIn mt-4">
      <Link to="/dashboard" className="text-xs font-bold text-gray-500 hover:text-emerald-400 transition-colors block mb-6">← Dashboard</Link>
      <h2 className="text-2xl font-black uppercase tracking-tight mb-6">My Vaulted Records</h2>
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="bg-white/[0.02] border border-white/10 p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="text-sm font-bold text-emerald-400">{post.title}</h4>
              <p className="text-[10px] text-gray-500 mt-1">{new Date(post.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={() => navigate(`/post/${post.id}`)} 
                className="flex-1 md:flex-none text-center text-xs font-bold text-gray-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                View Discussion
              </button>
              <a 
                href={`${API_BASE}/download/${post.id}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex-1 md:flex-none text-center text-xs font-bold text-black bg-emerald-500 border border-emerald-500 px-4 py-2 rounded-lg hover:bg-emerald-400 transition-colors"
              >
                Download PDF
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// RECURSIVE COMMENT NODE
// ==========================================
const CommentNode = ({ comment, onReply }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { user } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReply(comment.id, replyText);
    setReplyText('');
    setIsReplying(false);
  };

  return (
    <div className="pl-4 border-l-2 border-white/10 mt-4 animate-fadeIn">
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-mono text-emerald-400">@{comment.author}</span>
          <span className="text-[10px] text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
        </div>
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{comment.comment_text}</p>
        
        {user && (
          <div className="mt-3">
            <button 
              onClick={() => setIsReplying(!isReplying)}
              className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-emerald-400 transition-colors"
            >
              {isReplying ? 'Cancel' : 'Reply'}
            </button>
          </div>
        )}

        {isReplying && (
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button type="submit" className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-[10px] uppercase font-bold hover:bg-emerald-500 hover:text-black transition-colors">
              Post
            </button>
          </form>
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-2">
          {comment.replies.map(reply => (
            <CommentNode key={reply.id} comment={reply} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// POST DETAILS VIEW
// ==========================================
const PostDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const postRes = await fetch(`${API_BASE}/posts/${id}`, { credentials: 'include' });
      if (!postRes.ok) throw new Error("Document not found");
      const postData = await postRes.json();
      setPost(postData);

      const commentsRes = await fetch(`${API_BASE}/posts/${id}/comments`, { credentials: 'include' });
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handlePostComment = async (parentId, text) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parent_id: parentId, comment_text: text })
      });
      if (res.ok) {
        fetchDetails(); // Refresh thread
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRootSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    handlePostComment(null, newComment);
    setNewComment('');
  };

  if (loading) return <div className="flex-1 text-center p-12 text-emerald-500 animate-pulse mt-20">Decrypting ledger...</div>;
  if (error) return <div className="flex-1 text-center p-12 text-red-500 mt-20">{error}</div>;
  if (!post) return null;

  return (
    <div className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full relative z-10 flex flex-col md:flex-row gap-8 animate-fadeIn mt-4">
      {/* Left Pane: Document Info */}
      <div className="w-full md:w-1/3 space-y-6">
        <Link to="/dashboard" className="text-xs font-bold text-gray-500 hover:text-emerald-400 transition-colors block mb-2">← Dashboard</Link>
        <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl sticky top-24">
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/20">{post.department}</span>
          <h2 className="text-2xl font-black mt-4 mb-2">{post.title}</h2>
          <p className="text-xs text-gray-500 mb-6">{post.state} • Uploaded by {post.author}</p>
          
          <div className="space-y-4 mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-white/10 pb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{post.description}</p>
          </div>

          <a 
            href={`${API_BASE}/download/${post.id}`} 
            target="_blank" 
            rel="noreferrer"
            className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            Access Scrubbed PDF
          </a>
        </div>
      </div>

      {/* Right Pane: Discussion Thread */}
      <div className="w-full md:w-2/3 space-y-6">
        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
          Public Discourse <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400 font-mono">{comments.length > 0 ? 'Active' : 'Empty'}</span>
        </h3>
        
        {user ? (
          <form onSubmit={handleRootSubmit} className="bg-white/[0.02] border border-white/10 p-4 rounded-xl shadow-inner mb-8">
            <textarea
              rows="3"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add your analysis or insight..."
              className="w-full bg-black/40 border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none mb-3"
            />
            <div className="flex justify-end">
              <button type="submit" className="bg-white text-black font-bold uppercase tracking-wider text-[10px] px-6 py-2 rounded-lg hover:bg-emerald-400 transition-colors">
                Publish Thought
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-6 text-center mb-8">
             <p className="text-xs text-gray-400 uppercase tracking-widest">Authenticate to join the discourse</p>
          </div>
        )}

        <div className="space-y-2">
          {comments.length > 0 ? (
            comments.map(comment => (
              <CommentNode key={comment.id} comment={comment} onReply={handlePostComment} />
            ))
          ) : (
            <p className="text-center text-gray-600 text-sm italic py-12">No insights shared yet. Be the first to analyze this document.</p>
          )}
        </div>
      </div>
    </div>
  );
};


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="relative w-full min-h-screen bg-black text-white overflow-x-hidden font-sans select-none flex flex-col">
          <Background />
          <Header />
          <Routes>
            <Route path="/" element={<EntryPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadForm /></ProtectedRoute>} />
            <Route path="/my-documents" element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
            <Route path="/post/:id" element={<PostDetails />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return children;
};