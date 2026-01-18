
import React, { useState, useEffect, useRef } from 'react';
import { ImageIcon, RotateCcw, Sparkles, ChevronLeft, Upload, Grid, LayoutGrid, Timer, Trophy, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { Difficulty, GameState, PuzzleMetadata } from './types';
import PuzzleBoard from './components/PuzzleBoard';
import { GoogleGenAI } from '@google/genai';

const CATEGORIES = ["Nature", "Architecture", "Animals", "Space"];

const PREDEFINED_IMAGES: PuzzleMetadata[] = [
  { id: 'n1', category: 'Nature', title: 'Mountain Lake', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200' },
  { id: 'n2', category: 'Nature', title: 'Forest Path', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200' },
  { id: 'a1', category: 'Architecture', title: 'Paris Streets', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200' },
  { id: 'a2', category: 'Architecture', title: 'Modern Sky', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200' },
  { id: 'an1', category: 'Animals', title: 'Wild Tiger', url: 'https://images.unsplash.com/photo-1564349683136-77e08bef1ef1?auto=format&fit=crop&w=1200' },
  { id: 'an2', category: 'Animals', title: 'Graceful Deer', url: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?auto=format&fit=crop&w=1200' },
  { id: 's1', category: 'Space', title: 'Nebula Dream', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200' },
  { id: 's2', category: 'Space', title: 'Starry Sky', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1200' },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    image: null,
    difficulty: Difficulty.MEDIUM,
    pieces: [],
    isSolved: false,
    moves: 0,
    startTime: null,
    currentTime: 0,
  });

  const [view, setView] = useState<'main' | 'category' | 'difficulty' | 'game'>('main');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (gameState.startTime && !gameState.isSolved) {
      timerRef.current = window.setInterval(() => {
        setGameState(prev => ({
          ...prev,
          currentTime: Math.floor((Date.now() - (prev.startTime || 0)) / 1000)
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState.startTime, gameState.isSolved]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setGameState(prev => ({ ...prev, image: event.target?.result as string }));
        setView('difficulty');
      };
      reader.readAsDataURL(file);
    }
  };

  // Fix: Added missing selectPredefined function
  const selectPredefined = (url: string) => {
    setGameState(prev => ({ ...prev, image: url }));
    setView('difficulty');
  };

  const generateAIPicture = async () => {
    setIsGenerating(true);
    try {
      // Fix: Re-instantiate ai client for each call to ensure fresh environment
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "A high-definition cinematic landscape painting, vibrant colors, 4k detail, wide aspect ratio."
      });

      const text = response.text || "Fantasy Landscape";
      const imgAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Fix: Corrected the contents structure to use parts property
      const imgResponse = await imgAi.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A beautiful puzzle art based on: ${text.substring(0, 100)}` }] }
      });

      // Find the image part, do not assume it is the first part.
      if (imgResponse.candidates && imgResponse.candidates[0].content.parts) {
        for (const part of imgResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            setGameState(prev => ({ ...prev, image: `data:image/png;base64,${part.inlineData.data}` }));
            setView('difficulty');
            break;
          }
        }
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const startGame = (difficulty: Difficulty) => {
    setGameState(prev => ({
      ...prev,
      difficulty,
      isSolved: false,
      moves: 0,
      startTime: Date.now(),
      currentTime: 0
    }));
    setShowPreview(false);
    setView('game');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Main Menu View
  if (view === 'main') {
    return (
      <div className="fixed inset-0 bg-[#0a0a0c] text-slate-100 flex flex-col p-6 landscape:flex-row landscape:items-center gap-8 overflow-y-auto landscape:overflow-hidden safe-area-inset">
        <div className="landscape:w-1/3 space-y-6">
          <div className="inline-block p-4 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-600/30">
            <LayoutGrid className="w-12 h-12 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">Puzzle Master</h1>
            <p className="text-slate-400 mt-2">Premium Jigsaw experience for S24 FE.</p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button onClick={() => document.getElementById('fileInput')?.click()} className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all active:scale-95">
              <Upload className="text-indigo-400" />
              <div className="text-left">
                <div className="font-bold">My Photos</div>
                <div className="text-xs text-slate-500">Solve your own memories</div>
              </div>
              <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </button>

            <button onClick={generateAIPicture} disabled={isGenerating} className="flex items-center gap-4 p-5 bg-indigo-600 border border-indigo-500 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50">
              <Sparkles className="text-white" />
              <div className="text-left">
                <div className="font-bold text-white">{isGenerating ? 'Dreaming...' : 'AI Magic'}</div>
                <div className="text-xs text-indigo-100">AI-generated unique art</div>
              </div>
            </button>
          </div>
        </div>

        <div className="landscape:w-2/3 h-full flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Grid className="w-5 h-5 text-indigo-400" />
            Galleries
          </h2>
          <div className="grid grid-cols-2 gap-4 h-full landscape:overflow-y-auto pr-2 custom-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setView('category'); }}
                className="group relative h-40 rounded-3xl overflow-hidden border border-white/10 transition-transform active:scale-95"
              >
                <img 
                  src={PREDEFINED_IMAGES.find(i => i.category === cat)?.url} 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" 
                  alt={cat}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                  <span className="text-lg font-bold tracking-wide">{cat}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Category View (Gallery)
  if (view === 'category') {
    return (
      <div className="fixed inset-0 bg-[#0a0a0c] text-slate-100 flex flex-col p-6 safe-area-inset">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('main')} className="p-3 bg-white/5 rounded-full hover:bg-white/10">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{selectedCategory}</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto h-full pr-2">
          {PREDEFINED_IMAGES.filter(i => i.category === selectedCategory).map(img => (
            <button 
              key={img.id} 
              onClick={() => selectPredefined(img.url)}
              className="group aspect-video rounded-2xl overflow-hidden border border-white/10 transition-all hover:border-indigo-500 active:scale-95"
            >
              <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={img.title} />
              <div className="p-3 bg-slate-900/90 text-sm font-medium text-center">{img.title}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Difficulty Selection
  if (view === 'difficulty') {
    return (
      <div className="fixed inset-0 bg-[#0a0a0c] text-slate-100 flex flex-col landscape:flex-row items-center justify-center p-8 gap-12 safe-area-inset">
        <div className="w-full max-w-sm aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10">
          <img src={gameState.image!} className="w-full h-full object-cover" alt="Preview" />
        </div>
        <div className="w-full max-w-md space-y-8">
          <div className="text-center landscape:text-left">
            <h2 className="text-3xl font-bold italic tracking-tighter">SELECT CHALLENGE</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: 'Easy', d: Difficulty.EASY, desc: '3x3 Pieces' },
              { l: 'Medium', d: Difficulty.MEDIUM, desc: '4x4 Pieces' },
              { l: 'Hard', d: Difficulty.HARD, desc: '6x6 Pieces' },
              { l: 'Expert', d: Difficulty.EXPERT, desc: '8x8 Pieces' },
            ].map(diff => (
              <button 
                key={diff.d} 
                onClick={() => startGame(diff.d)}
                className="flex flex-col items-center p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-600 hover:border-indigo-500 transition-all group"
              >
                <div className="text-lg font-bold group-hover:text-white">{diff.l}</div>
                <div className="text-xs text-slate-500 group-hover:text-indigo-200">{diff.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setView('main')} className="w-full py-4 text-slate-500 hover:text-white transition-colors">Back</button>
        </div>
      </div>
    );
  }

  // Game View
  return (
    <div className="fixed inset-0 bg-[#050507] flex flex-col overflow-hidden">
      <header className="h-14 landscape:h-12 flex items-center justify-between px-6 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('main')} className="p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft />
          </button>
          <div className="h-6 w-[1px] bg-white/10 hidden landscape:block" />
          <button 
            onClick={() => setShowPreview(!showPreview)} 
            className={`p-2 rounded-xl transition-all flex items-center gap-2 ${showPreview ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
            title="Peek original"
          >
            {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            <span className="text-xs font-bold uppercase hidden landscape:inline">Peek</span>
          </button>
        </div>
        
        <div className="flex items-center gap-12">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Time</span>
            <span className="text-lg font-mono font-bold text-white">{formatTime(gameState.currentTime)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Moves</span>
            <span className="text-lg font-mono font-bold text-white">{gameState.moves}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-slate-400 hover:text-white">
            {isMuted ? <VolumeX /> : <Volume2 />}
          </button>
          <button onClick={() => startGame(gameState.difficulty)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RotateCcw />
          </button>
        </div>
      </header>

      <main className="flex-1 relative touch-none overflow-hidden bg-slate-950">
        <PuzzleBoard 
          image={gameState.image!} 
          difficulty={gameState.difficulty}
          showPreview={showPreview}
          isMuted={isMuted}
          onSolved={() => setGameState(prev => ({ ...prev, isSolved: true }))}
          onMove={() => setGameState(prev => ({ ...prev, moves: prev.moves + 1 }))}
        />
      </main>

      {gameState.isSolved && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-[3rem] p-10 text-center space-y-8 shadow-2xl">
            <div className="inline-flex items-center justify-center w-28 h-28 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Trophy className="w-14 h-14 text-emerald-500 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">LEGENDARY!</h2>
              <p className="text-slate-500 text-sm">Challenge completed with precision.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-3xl">
                <div className="text-[10px] uppercase font-black text-slate-500">Time</div>
                <div className="text-2xl font-mono font-bold">{formatTime(gameState.currentTime)}</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-3xl">
                <div className="text-[10px] uppercase font-black text-slate-500">Moves</div>
                <div className="text-2xl font-mono font-bold">{gameState.moves}</div>
              </div>
            </div>
            <button 
              onClick={() => setView('main')}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-600/30 transition-all active:scale-95 uppercase tracking-widest"
            >
              Perfect!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
