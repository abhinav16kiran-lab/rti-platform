import React, { useState, useEffect } from 'react';

// ==========================================
// 1. RECURSIVE COMMENT COMPONENT (THE TREE)
// ==========================================
function CommentNode({ comment, onReplySubmit }) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReplySubmit(comment.id, replyText);
    setReplyText('');
    setShowReplyBox(false);
  };

  return (
    <div className="mt-4 pl-4 border-l-2 border-emerald-500/20 transition-all">
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-xl p-4 shadow-md">
        <div className="flex justify-between items-center text-[11px] text-gray-400">
          <span className="font-bold text-emerald-400 font-mono">@{comment.author || 'anonymous'}</span>
          <span>{comment.created_at ? new Date(comment.created_at).toLocaleTimeString() : 'Just now'}</span>
        </div>
        <p className="text-gray-200 text-sm mt-2 leading-relaxed">{comment.comment_text}</p>
        
        <button 
          onClick={() => setShowReplyBox(!showReplyBox)}
          className="text-[11px] text-gray-400 hover:text-emerald-300 mt-3 flex items-center gap-1 cursor-pointer transition-colors"
        >
          💬 Reply
        </button>
      </div>

      {showReplyBox && (
        <form onSubmit={handleReply} className="mt-2 pl-2 flex gap-2">
          <input 
            type="text" 
            placeholder="Write a nested reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all">
            Post
          </button>
        </form>
      )}

      {/* RECURSIVE LOOP: Renders children inside themselves dynamically */}
      {comment.replies && comment.replies.map(reply => (
        <CommentNode key={reply.id} comment={reply} onReplySubmit={onReplySubmit} />
      ))}
    </div>
  );
}

// ==========================================
// 2. MAIN APPLICATION WORKSPACE
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('search'); // 'search' | 'upload' | 'details'
  
  // Backend API Base Configuration - Ready for CORS cross-port comms
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

  // Search Engine States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null); // Error boundary state
  
  // Document Upload States
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('BBMP');
  const [stateParam, setStateParam] = useState('Karnataka');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Deep-Thread Active Workspace
  const [activePost, setActivePost] = useState(null);
  const [commentsTree, setCommentsTree] = useState([]);
  const [detailsError, setDetailsError] = useState(null); // Error boundary state

  // FETCH TARGET A: Real-time query streaming from DB
  const handleSearchBackend = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      // Changed endpoint from '/posts/search' to '/search' matching app.py
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error(`Search protocol failed (Status: ${response.status})`);
      }
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setSearchError('Unable to connect to the search ledger. The server might be unreachable.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // FETCH TARGET B: Binary Stream to Redaction Pipeline
  const handleFileUploadBackend = async (e) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) {
      setUploadStatus('Please fill in the title and append a valid document.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Processing document streams through PII Redaction Engine...');

    const formData = new FormData();
    // Corrected payload key: Changed 'file' to 'rti_pdf' matching app.py request.files['rti_pdf']
    formData.append('rti_pdf', selectedFile);
    formData.append('title', title);
    formData.append('department', department);
    formData.append('state', stateParam);

    try {
      // Changed endpoint from '/posts/upload' to '/upload-rti' matching app.py
      const response = await fetch(`${API_BASE}/upload-rti`, {
        method: 'POST',
        body: formData, // Browser sets multipart boundary natively
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus('Success! Document scrubbed of personal descriptors and indexed.');
        setTitle('');
        setSelectedFile(null);
        // Clear file input
        document.getElementById('file-upload-input').value = '';
      } else {
        setUploadStatus(`Pipeline Error: ${data.error || 'Upload rejected'}`);
      }
    } catch (err) {
      setUploadStatus('Network failure communicating with backend server.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // FETCH TARGET C: Async Tree Generation
  const fetchCommentsForPost = async (post) => {
    setActivePost(post);
    setCurrentView('details');
    setDetailsError(null);
    try {
      const response = await fetch(`${API_BASE}/posts/${post.id}/comments`);
      if (!response.ok) throw new Error(`Failed to retrieve discussion matrix (Status: ${response.status})`);
      const data = await response.json();
      setCommentsTree(data);
    } catch (err) {
      console.error(err);
      setDetailsError('Unable to load thread nodes. Connection interrupted.');
      setCommentsTree([]);
    }
  };

  // FETCH TARGET D: Post Thread Nodes
  const handleAddCommentBackend = async (parentId, text) => {
    try {
      const response = await fetch(`${API_BASE}/posts/${activePost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: parentId,
          comment_text: text,
          author: 'anonymous_citizen'
        }),
      });

      if (!response.ok) throw new Error('Failed to record text sequence');
      
      // Refresh the discussion tree instantly following submission
      await fetchCommentsForPost(activePost);
    } catch (err) {
      console.error(err);
      alert("Failed to submit comment. Please check your connection and try again.");
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-white overflow-x-hidden font-sans select-none">
      
      {/* 3D CYBERNETIC MESH MATRIX BACKGROUND LAYER */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#090d16_1px,transparent_1px),linear-gradient(to_bottom,#090d16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80" />
      <div className="fixed top-[-10%] left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* CONTENT SYSTEM HUB CONTAINER */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Global Navigation Header */}
        <header className="w-full bg-black/20 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center px-6 md:px-12">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-black tracking-[0.2em] text-sm uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              RTI Ledger
            </span>
          </div>
          <div className="flex bg-white/[0.03] p-1 border border-white/10 rounded-xl text-xs font-semibold">
            <button 
              onClick={() => setCurrentView('search')}
              className={`px-4 py-2 rounded-lg cursor-pointer transition-all duration-300 ${currentView === 'search' || currentView === 'details' ? 'bg-emerald-500 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-gray-400 hover:text-white'}`}
            >
              🔍 Audit Search
            </button>
            <button 
              onClick={() => setCurrentView('upload')}
              className={`px-4 py-2 rounded-lg cursor-pointer transition-all duration-300 ${currentView === 'upload' ? 'bg-emerald-500 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-gray-400 hover:text-white'}`}
            >
              📤 File Document
            </button>
          </div>
        </header>

        {/* Dynamic View Display Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center items-start">
          <div className="w-full max-w-4xl">
            
            {/* VIEW A: AUDIT SEARCH DASHBOARD */}
            {currentView === 'search' && (
              <div className="space-y-12">
                <div className="space-y-3 max-w-2xl mt-4">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase">
                    Scan Public <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
                      Information Ledgers
                    </span>
                  </h1>
                  <p className="text-gray-400 text-xs md:text-sm tracking-wide font-medium leading-relaxed">
                    Query records instantly. All dataset materials are autonomously scrubbed of identity profiles prior to index tracking.
                  </p>
                </div>

                {/* Form Processing Query */}
                <form onSubmit={handleSearchBackend} className="flex gap-3 bg-white/[0.02] border border-white/10 p-2 rounded-2xl shadow-2xl backdrop-blur-xl focus-within:border-emerald-500/40 transition-colors">
                  <input 
                    type="text" 
                    placeholder="Search by keyword, ward number, or department (e.g., 'BBMP')..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm px-4 py-3 focus:outline-none"
                  />
                  <button type="submit" className="bg-white text-black font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl hover:bg-emerald-400 hover:text-black transition-all cursor-pointer">
                    {searchLoading ? 'Scanning...' : 'Query'}
                  </button>
                </form>

                {/* Search Error Boundary Handling */}
                {searchError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-center text-red-400 font-mono tracking-wide leading-relaxed animate-fadeIn">
                    {searchError}
                  </div>
                )}

                {hasSearched && !searchError && (
                  <div className="space-y-4 animate-fadeIn">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Query Results ({searchResults.length})</h2>
                    
                    {searchResults.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {searchResults.map(post => (
                          <div 
                            key={post.id}
                            onClick={() => fetchCommentsForPost(post)}
                            className="bg-white/[0.01] hover:bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-lg group hover:border-emerald-500/30"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-2">
                                <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                  {post.department}
                                </span>
                                <h3 className="text-lg font-bold group-hover:text-emerald-300 transition-colors pt-1">{post.title}</h3>
                              </div>
                              <span className="text-xs text-gray-500 font-medium tracking-wide">{post.state}</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-4 line-clamp-2 bg-black/40 p-4 rounded-xl border border-white/5 font-mono leading-relaxed">
                              {post.extracted_text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-emerald-500/[0.02] border border-white/5 rounded-2xl p-12 text-center backdrop-blur-sm">
                        <p className="text-xs text-gray-400 tracking-wide">No system logs discovered matching "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIEW B: UPLOAD FORM PANEL */}
            {currentView === 'upload' && (
              <div className="max-w-xl mx-auto bg-white/[0.01] border border-white/5 p-8 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-8 mt-4 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase tracking-tight">File Public Document</h2>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-medium">Our backend system isolates text sequences via binary conversion and strips identity records prior to archival indexing.</p>
                </div>

                <form onSubmit={handleFileUploadBackend} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Document Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Road Repair Budget Inquiry"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Department</label>
                      <select 
                        value={department} 
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer transition-colors"
                      >
                        <option value="BBMP">BBMP</option>
                        <option value="BESCOM">BESCOM</option>
                        <option value="BWSSB">BWSSB</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">State Jurisdiction</label>
                      <select 
                        value={stateParam} 
                        onChange={(e) => setStateParam(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer transition-colors"
                      >
                        <option value="Karnataka">Karnataka</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Delhi">Delhi</option>
                      </select>
                    </div>
                  </div>

                  <div className="border border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-8 text-center transition-all relative bg-black/40 group">
                    <input 
                      id="file-upload-input"
                      type="file" 
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400 font-medium tracking-wide block group-hover:text-gray-300 transition-colors">
                      {selectedFile ? `📄 Attached: ${selectedFile.name}` : "Drag and drop raw PDF tracking copy here (Max 16MB)"}
                    </span>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider text-xs py-4 rounded-xl transition-all cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50"
                  >
                    {isUploading ? 'Redacting Sensitive Records...' : 'Strip PII & Broadcast'}
                  </button>
                </form>

                {uploadStatus && (
                  <div className={`p-4 bg-white/[0.02] border rounded-xl text-[11px] text-center font-mono tracking-wide leading-relaxed ${uploadStatus.includes('Error') || uploadStatus.includes('failure') ? 'border-red-500/30 text-red-400' : 'border-white/5 text-emerald-400'}`}>
                    {uploadStatus}
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: DETAILED VIEW & HOOKED SUB-THREADS */}
            {currentView === 'details' && activePost && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-4 animate-fadeIn">
                
                {/* File Inspection Block */}
                <div className="lg:col-span-7 bg-white/[0.01] border border-white/5 rounded-3xl p-6 backdrop-blur-2xl shadow-xl space-y-5">
                  <button 
                    onClick={() => setCurrentView('search')}
                    className="text-xs font-bold text-gray-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    ← Back to Index
                  </button>
                  <div className="space-y-2">
                    <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                      {activePost.department}
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight pt-1">{activePost.title}</h2>
                    <p className="text-[10px] text-gray-500 font-mono tracking-wide">INDEXING ARCHIVE UNIT: {activePost.author || 'ANONYMOUS'}</p>
                  </div>
                  
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-5 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner">
                    {activePost.extracted_text}
                  </div>
                </div>

                {/* Verification Threading System */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Discussion Matrix</h3>
                  </div>
                  
                  {/* Base Root Level Thread Box */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const txt = e.target.elements.topComment.value;
                      if (!txt.trim()) return;
                      handleAddCommentBackend(null, txt);
                      e.target.reset();
                    }}
                    className="space-y-2"
                  >
                    <textarea 
                      name="topComment"
                      placeholder="Append verifiable inquiry trace context..."
                      rows="3"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button type="submit" className="bg-white text-black font-black uppercase tracking-widest text-[10px] px-4 py-2.5 rounded-lg cursor-pointer hover:bg-emerald-400 hover:text-black transition-all shadow-md">
                      Commit Root Trace
                    </button>
                  </form>

                  {/* Details Error Boundary Handling */}
                  {detailsError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400 font-mono">
                      {detailsError}
                    </div>
                  )}

                  {/* Render Thread Nodes */}
                  {!detailsError && (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                      {commentsTree.length > 0 ? (
                        commentsTree.map(comment => (
                          <CommentNode 
                            key={comment.id} 
                            comment={comment} 
                            onReplySubmit={handleAddCommentBackend} 
                          />
                        ))
                      ) : (
                        <p className="text-[11px] text-gray-600 tracking-wider font-mono text-center pt-4">No active trace threads registered.</p>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}