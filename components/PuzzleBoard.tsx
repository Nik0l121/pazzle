
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Piece, Difficulty } from '../types';

interface PuzzleBoardProps {
  image: string;
  difficulty: Difficulty;
  showPreview: boolean;
  isMuted: boolean;
  onSolved: () => void;
  onMove: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface VisualEffect {
  x: number;
  y: number;
  startTime: number;
  particles: Particle[];
}

const MELODY_FREQS = [261.63, 329.63, 392.00, 440.00, 523.25]; // C4, E4, G4, A4, C5 (Pentatonic)

const PuzzleBoard: React.FC<PuzzleBoardProps> = ({ image, difficulty, showPreview, isMuted, onSolved, onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);
  const [activePieceIndex, setActivePieceIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  const [pieceSize, setPieceSize] = useState({ w: 0, h: 0 });
  const [effects, setEffects] = useState<VisualEffect[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const melodyTimerRef = useRef<number | null>(null);

  // Initialize Web Audio with a warm, filtered sound to prevent "squeaking"
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime); // Cut off high frequencies to avoid squeaks
      filter.Q.setValueAtTime(1, ctx.currentTime);
      
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      masterGainRef.current = masterGain;
      filterRef.current = filter;

      // Base Ambient Pad (Low Drones)
      const createDrone = (freq: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(0.02, ctx.currentTime); // Very quiet
        osc.connect(g);
        g.connect(filter);
        osc.start();
      };
      createDrone(130.81); // C3
      createDrone(164.81); // E3
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  const playSnapSound = useCallback(() => {
    if (isMuted || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, [isMuted]);

  const triggerMelodyNote = useCallback(() => {
    if (isMuted || !audioContextRef.current || !filterRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    
    const freq = MELODY_FREQS[Math.floor(Math.random() * MELODY_FREQS.length)];
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.5); // Soft attack
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0); // Long decay
    
    osc.connect(g);
    g.connect(filterRef.current);
    osc.start();
    osc.stop(ctx.currentTime + 3.1);
  }, [isMuted]);

  // Handle Muting and Ambient Start
  useEffect(() => {
    if (isMuted) {
      masterGainRef.current?.gain.setTargetAtTime(0, 0, 0.2);
    } else if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(1, 0, 1.0);
    }

    const startOnFirstInput = () => {
      initAudio();
      if (!isMuted) masterGainRef.current?.gain.setTargetAtTime(1, 0, 1.0);
      
      if (melodyTimerRef.current) clearInterval(melodyTimerRef.current);
      melodyTimerRef.current = window.setInterval(() => {
        if (!isMuted && Math.random() > 0.4) triggerMelodyNote();
      }, 4000);

      window.removeEventListener('pointerdown', startOnFirstInput);
    };

    window.addEventListener('pointerdown', startOnFirstInput);
    return () => {
      window.removeEventListener('pointerdown', startOnFirstInput);
      if (melodyTimerRef.current) clearInterval(melodyTimerRef.current);
    };
  }, [isMuted, initAudio, triggerMelodyNote]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = image;
    img.onload = () => setImgObj(img);
  }, [image]);

  const initGame = useCallback(() => {
    if (!imgObj || !containerRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const imgAspect = imgObj.width / imgObj.height;
    const containerAspect = cw / ch;

    let bw, bh;
    const fillFactor = 0.85;
    if (containerAspect > imgAspect) {
      bh = ch * fillFactor;
      bw = bh * imgAspect;
    } else {
      bw = cw * fillFactor;
      bh = bw / imgAspect;
    }

    setBoardSize({ w: bw, h: bh });
    const pw = bw / difficulty;
    const ph = bh / difficulty;
    setPieceSize({ w: pw, h: ph });

    const newPieces: Piece[] = [];
    const boardX = (cw - bw) / 2;
    const boardY = (ch - bh) / 2;

    for (let r = 0; r < difficulty; r++) {
      for (let c = 0; c < difficulty; c++) {
        newPieces.push({
          id: r * difficulty + c,
          row: r,
          col: c,
          currentX: Math.random() * (cw - pw),
          currentY: Math.random() * (ch - ph),
          targetX: boardX + c * pw,
          targetY: boardY + r * ph,
          isLocked: false,
          zIndex: r * difficulty + c
        });
      }
    }
    setPieces(newPieces);
    setEffects([]);
  }, [imgObj, difficulty]);

  useEffect(() => {
    initGame();
    window.addEventListener('resize', initGame);
    return () => window.removeEventListener('resize', initGame);
  }, [initGame]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const boardX = (canvas.width - boardSize.w) / 2;
    const boardY = (canvas.height - boardSize.h) / 2;
    
    if (showPreview) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.drawImage(imgObj, boardX, boardY, boardSize.w, boardSize.h);
      ctx.restore();
    }

    // Background Grid - very subtle
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<=difficulty; i++) {
      ctx.beginPath();
      ctx.moveTo(boardX + i * pieceSize.w, boardY);
      ctx.lineTo(boardX + i * pieceSize.w, boardY + boardSize.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + i * pieceSize.h);
      ctx.lineTo(boardX + boardSize.w, boardY + i * pieceSize.h);
      ctx.stroke();
    }

    const sortedPieces = [...pieces].sort((a, b) => a.zIndex - b.zIndex);
    sortedPieces.forEach(p => {
      ctx.save();
      const isDragging = activePieceIndex !== null && pieces[activePieceIndex].id === p.id;

      if (!p.isLocked) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = isDragging ? 30 : 10;
        ctx.shadowOffsetY = isDragging ? 8 : 4;
      }

      const sx = (p.col * imgObj.width) / difficulty;
      const sy = (p.row * imgObj.height) / difficulty;
      const sw = imgObj.width / difficulty;
      const sh = imgObj.height / difficulty;

      ctx.beginPath();
      ctx.rect(p.currentX, p.currentY, pieceSize.w, pieceSize.h);
      ctx.clip();
      
      if (isDragging) {
         ctx.translate(p.currentX + pieceSize.w/2, p.currentY + pieceSize.h/2);
         ctx.scale(1.08, 1.08);
         ctx.translate(-(p.currentX + pieceSize.w/2), -(p.currentY + pieceSize.h/2));
      }

      ctx.drawImage(imgObj, sx, sy, sw, sh, p.currentX, p.currentY, pieceSize.w, pieceSize.h);
      ctx.restore();

      // Border only for unlocked pieces
      if (!p.isLocked) {
        ctx.strokeStyle = isDragging ? 'rgba(129, 140, 248, 0.8)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = isDragging ? 3 : 1;
        ctx.strokeRect(p.currentX, p.currentY, pieceSize.w, pieceSize.h);
      }
    });

    // MAGICAL EFFECTS
    const now = Date.now();
    setEffects(prev => {
      const active = prev.filter(eff => now - eff.startTime < 1200);
      active.forEach(eff => {
        const elapsed = now - eff.startTime;
        const progress = elapsed / 1200;
        
        // Circular Ripple
        ctx.save();
        ctx.beginPath();
        const maxRadius = pieceSize.w * 2;
        const currentRadius = progress * maxRadius;
        ctx.arc(eff.x + pieceSize.w / 2, eff.y + pieceSize.h / 2, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(165, 180, 252, ${1 - progress})`;
        ctx.lineWidth = 2 * (1 - progress);
        ctx.stroke();
        
        // Inner Glow Circle
        if (progress < 0.5) {
          ctx.beginPath();
          ctx.arc(eff.x + pieceSize.w / 2, eff.y + pieceSize.h / 2, pieceSize.w / 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress * 2) * 0.3})`;
          ctx.fill();
        }
        ctx.restore();

        // Shimmer Particles
        eff.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.015;
          if (p.life > 0) {
            ctx.fillStyle = p.color.replace('ALPHA', p.life.toString());
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });
      return active;
    });

  }, [pieces, imgObj, boardSize, pieceSize, difficulty, activePieceIndex, showPreview, effects]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  const handleStart = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const sorted = [...pieces].sort((a, b) => b.zIndex - a.zIndex);
    const pIdx = sorted.findIndex(p => !p.isLocked && x >= p.currentX && x <= p.currentX + pieceSize.w && y >= p.currentY && y <= p.currentY + pieceSize.h);

    if (pIdx !== -1) {
      const realIdx = pieces.findIndex(p => p.id === sorted[pIdx].id);
      setActivePieceIndex(realIdx);
      setDragOffset({ x: x - pieces[realIdx].currentX, y: y - pieces[realIdx].currentY });
      const maxZ = Math.max(...pieces.map(p => p.zIndex));
      setPieces(prev => {
        const next = [...prev];
        next[realIdx].zIndex = maxZ + 1;
        return next;
      });
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (activePieceIndex === null || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    setPieces(prev => {
      const next = [...prev];
      next[activePieceIndex] = {
        ...next[activePieceIndex],
        currentX: Math.max(0, Math.min(canvas.width - pieceSize.w, x - dragOffset.x)),
        currentY: Math.max(0, Math.min(canvas.height - pieceSize.h, y - dragOffset.y))
      };
      return next;
    });
  };

  const handleEnd = () => {
    if (activePieceIndex === null) return;
    const p = pieces[activePieceIndex];
    const dist = Math.sqrt(Math.pow(p.currentX - p.targetX, 2) + Math.pow(p.currentY - p.targetY, 2));

    if (dist < pieceSize.w * 0.25) {
      playSnapSound();
      
      const newParticles: Particle[] = Array.from({ length: 25 }).map(() => ({
        x: p.targetX + pieceSize.w / 2,
        y: p.targetY + pieceSize.h / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        size: 1.5 + Math.random() * 3,
        color: `rgba(224, 231, 255, ALPHA)`
      }));

      setEffects(prev => [...prev, { x: p.targetX, y: p.targetY, startTime: Date.now(), particles: newParticles }]);
      
      setPieces(prev => {
        const next = [...prev];
        next[activePieceIndex] = { ...next[activePieceIndex], currentX: p.targetX, currentY: p.targetY, isLocked: true, zIndex: 0 };
        if (next.every(i => i.isLocked)) setTimeout(onSolved, 800);
        return next;
      });
    }
    onMove();
    setActivePieceIndex(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={containerRef.current?.clientWidth || 0}
        height={containerRef.current?.clientHeight || 0}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}
        className="block cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};

export default PuzzleBoard;
