import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Swords, Crown, Volume2, VolumeX, Settings2, BookOpen, ArrowUpRight, RotateCcw, Undo2, Maximize2, Minimize2, RefreshCw, X, Sparkles, Users, Cpu, Globe2, Shield, Move, Grid2X2, Box, ArrowRight, Info } from 'lucide-react';
import { type Square } from 'chess.js';
import { useChessGame } from './game/useChessGame';
import { derivePieces, roster } from './data/roster';
import type { Character } from './scene/types';
import OnlinePanel from './components/OnlinePanel';

const ChessScene = lazy(() => import('./scene/ChessScene'));
const pieceGlyphs: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const pieceNames: Record<string, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const franchises = ['NARUTO', 'ONE PIECE', 'DRAGON BALL', 'BLEACH', 'JUJUTSU KAISEN', 'DEMON SLAYER', 'SOLO LEVELING', 'BLACK CLOVER', 'HUNTER × HUNTER', 'ATTACK ON TITAN'];

function Avatar({ character, small = false }: { character: Character; small?: boolean }) {
  const hair = character.appearance?.hair || character.accent;
  return <span className={`avatar ${small ? 'small' : ''}`} style={{ '--accent': character.accent } as React.CSSProperties}>
    <svg viewBox="0 0 70 76" aria-hidden="true"><path d="M8 76Q9 49 35 49Q62 49 63 76" fill={character.appearance?.outfit || '#313b40'} /><path d="M29 47v12l6 6 6-6V47" fill="#b7987e"/><path d="M19 23Q18 6 36 7Q54 8 53 28L50 45 40 55H31L21 44Z" fill={character.appearance?.skin || '#ddba9d'}/><path d={character.appearance?.style === 'spiky' ? 'M15 35 10 15 21 19 20 4 32 12 38 1 44 12 56 6 53 22 61 24 50 37 47 22 36 27 25 22 21 38Z' : character.appearance?.style === 'bald' ? 'M18 28Q17 5 36 5Q57 6 54 28L45 20 36 26 27 20Z' : 'M15 40V23Q15 3 35 4Q58 3 56 30L52 43 47 22 29 20 22 34 22 46Z'} fill={hair}/><path d="M25 36h7m7 0h7" stroke="#292b32" strokeWidth="2.5"/><path d="m32 46 7 0" stroke="#956f62" strokeWidth="1.3"/>{character.id === 'gojo' && <path d="M20 30h32v12H20z" fill="#19202c"/>}{character.appearance?.style === 'hat' && <><ellipse cx="36" cy="19" rx="29" ry="6" fill={character.id==='luffy'?'#d7b477':'#28232e'}/><path d="M19 18V7Q34-3 50 7v11" fill={character.id==='luffy'?'#d7b477':'#28232e'}/><path d="M19 14h31v5H19z" fill="#9b4044"/></>}{character.id==='naruto'&&<><path d="M20 24h31v8H20z" fill="#394857"/><path d="M28 25h15v6H28z" fill="#a7b2b2"/></>}</svg>
  </span>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  render() { return this.state.broken ? this.props.fallback : this.props.children; }
}

function Modal({ title, eyebrow, onClose, children, wide = false, dismissible = true }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean; dismissible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const firstControl = ref.current?.querySelector<HTMLElement>('button, input, select, [tabindex="0"]');
    if (firstControl) firstControl.focus(); else ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) closeRef.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]');
        if (!nodes?.length) return;
        const first=nodes[0], last=nodes[nodes.length-1];
        if (e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();}
        if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown', handle);
    return () => {window.removeEventListener('keydown', handle);previous?.focus();};
  }, [dismissible]);
  return <div className="modal-backdrop" onClick={()=>dismissible&&onClose()}><div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e=>e.stopPropagation()}>{dismissible&&<button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button>}<span className="eyebrow">{eyebrow || 'ANIME CHESS'}</span><h2>{title}</h2>{children}</div></div>;
}

export default function App() {
  const chess = useChessGame();
  const { game, history, selected, legalSquares, status } = chess;
  const pieces = useMemo(() => derivePieces(history), [history]);
  const [modal, setModal] = useState<'guide'|'roster'|'settings'|'restart'|'leaveonline'|'closeonline'|null>(null);
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(45);
  const [auras, setAuras] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<'3d'|'2d'>('3d');
  const [expanded, setExpanded] = useState(false);
  const [team, setTeam] = useState<'w'|'b'>('w');
  const [quality, setQuality] = useState<'high'|'low'>('high');
  const [rosterFilter, setRosterFilter] = useState('');
  const [dismissedEnd, setDismissedEnd] = useState('');
  const audioRef = useRef<AudioContext | null>(null);
  const moveListRef = useRef<HTMLDivElement>(null);
  const selectedCharacter = pieces.find(p=>p.square===selected)?.character;
  const selectedMoves = useMemo(() => selected ? game.moves({square:selected,verbose:true}) : [], [game, chess.fen, selected]);
  const captureSquares = [...new Set(selectedMoves.filter(m=>m.captured).map(m=>m.to))];
  const movementRules: Record<string,string> = {
    p:'Moves forward one square (two from its starting square). Captures diagonally. Promotes at the far rank.',
    n:'Jumps in an L: two squares in one direction, then one across. Can jump over pieces.',
    b:'Moves any clear distance diagonally.', r:'Moves any clear distance horizontally or vertically.',
    q:'Moves any clear distance horizontally, vertically, or diagonally.', k:'Moves one square in any direction, never into check. Castling is shown when legal.'
  };
  const latest = history.at(-1);
  const active = game.turn();
  const gameOver = chess.isGameOver;
  const onlineMode = chess.mode === 'online';
  const online = chess.online;
  const endKey = `${chess.mode}:${onlineMode ? online.room?.code + ':' + online.room?.phase : ''}:${chess.fen}`;
  const onlineOpponent = online.room && online.color ? online.room.players[online.color === 'w' ? 'b' : 'w'] : null;
  const isCheck = game.isCheck();
  useEffect(() => {
    if (onlineMode && online.color) setFlipped(online.color === 'b');
  }, [onlineMode, online.color]);
  const onlineTitle = gameOver ? status.title
    : !online.room ? 'Create or join a private room'
    : online.connection !== 'connected' ? 'Reconnecting to your battle…'
    : online.room.phase === 'waiting' ? 'Waiting for your opponent'
    : !onlineOpponent?.connected ? 'Opponent disconnected'
    : active === online.color ? isCheck ? 'You are in check' : 'Your turn'
    : isCheck ? 'Opponent is in check' : "Opponent's turn";
  const onlineDetail = gameOver ? status.detail
    : online.color ? `You are ${online.color === 'w' ? 'the White Heroes' : 'the Black Villains'} · ${online.room?.phase === 'waiting' ? 'Share your invitation' : !onlineOpponent?.connected ? 'Moves paused until reconnection' : 'Private online match'}`
    : 'Invite a friend to play from another device.';
  const captureNames = useMemo(() => {
    const onBoard = new Set(pieces.map(p=>p.character.id));
    return roster.filter(c=>!onBoard.has(c.id));
  },[pieces]);

  const playSound = (capture=false) => {
    if(!sound) return;
    try {
      const ctx = audioRef.current ||= new AudioContext();
      void ctx.resume();
      [capture?180:350, capture?270:520].forEach((freq,i)=>{
        const osc=ctx.createOscillator(), gain=ctx.createGain(); osc.type='sine';osc.frequency.value=freq;
        gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(volume/600,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22+i*.08);
        osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.35);
      });
    } catch { /* Audio is optional; chess remains available. */ }
  };
  const lastSoundMove = useRef(0);
  useEffect(()=>{ if(history.length>lastSoundMove.current) playSound(Boolean(latest?.captured));lastSoundMove.current=history.length;moveListRef.current?.scrollTo({top:moveListRef.current.scrollHeight,behavior:'smooth'}); },[history.length]);
  useEffect(()=>{ const listener=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);

  const twoDBoard = <div className="flat-board-wrap"><div className="flat-board" role="group" aria-label="Chessboard"><div className="flat-squares">{Array.from({length:64},(_,i)=>{
    const file=flipped?7-i%8:i%8, rank=flipped?Math.floor(i/8)+1:8-Math.floor(i/8);
    const square=`${'abcdefgh'[file]}${rank}` as Square;
    const piece=pieces.find(p=>p.square===square);
    return <button key={square} className={`flat-square ${(file+rank)%2 === 0 ? 'light' : 'dark'} ${selected===square?'selected':''} ${legalSquares.includes(square)?'legal':''} ${captureSquares.includes(square)?'capture-target':''} ${latest&&(latest.from===square||latest.to===square)?'last':''}`} onClick={()=>chess.selectSquare(square)} aria-label={`${square}${piece?`, ${piece.character.color==='w'?'Heroes':'Villains'} ${piece.character.name}, ${piece.character.role}`:''}${legalSquares.includes(square)?', legal destination':''}`}><span className="coordinate">{square}</span>{legalSquares.includes(square)&&<span className="flat-target-label">{captureSquares.includes(square)?'CAPTURE':'MOVE'}</span>}{piece&&<span className={`flat-piece ${piece.character.color==='w'?'white':'black'}`}>{pieceGlyphs[piece.character.piece]}</span>}{piece&&<span className="flat-name">{piece.character.name.split(' ').at(-1)}</span>}</button>;
  })}</div></div><span className="flat-hint">Select a piece, then a highlighted square to move.</span></div>;

  const restart = () => {chess.restart();setModal(null);setDismissedEnd('');};
  const playerBar = (color:'w'|'b') => {
    const turnIsActive = active === color && !gameOver && (!onlineMode || online.room?.phase === 'playing');
    const isYou = onlineMode && online.color === color;
    const seat = onlineMode ? online.room?.players[color] : null;
    const subtitle = onlineMode ? isYou ? `You · ${online.connection === 'connected' ? 'Connected' : 'Reconnecting…'}` : seat ? `Opponent · ${seat.connected ? 'Connected' : 'Disconnected'}` : 'Waiting for a player…'
      : color === 'w' ? 'Light finds a way.' : chess.mode === 'ai' ? 'Stockfish · Engine opponent' : 'Power has no limits.';
    const turnText = !turnIsActive ? 'STANDING BY' : chess.aiThinking ? 'THINKING…' : isCheck ? 'IN CHECK' : onlineMode && !isYou ? 'OPPONENT TURN' : 'YOUR TURN';
    return <div className={`player-bar ${color==='w'?'hero-bar':'villain-bar'}`}><div className={`team-mark ${color==='w'?'hero':'villain'}`}>{color==='w'?<Swords size={21}/>:<Crown size={21}/>}</div><div className="player-info"><strong>{color==='w'?'The Heroes':'The Villains'} <span className={`team-label ${color==='w'?'hero':'villain'}`}>{color==='w'?'WHITE':'BLACK'}</span></strong><span>{subtitle}</span></div><div className={`turn-tag ${turnIsActive?'active':''}`}><span/>{turnText}</div></div>;
  };

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#" aria-label="Anime Chess home"><span className="brand-symbol"><Crown size={25} strokeWidth={1.5}/></span><span className="brand-type">ANIME CHESS<span>MULTIVERSE WAR</span></span></a><nav aria-label="Main navigation"><button className="nav-link active" onClick={()=>setModal(null)}>Battlefield</button><button className="nav-link" onClick={()=>setModal('roster')}>The roster <span>32</span></button><button className="nav-link" onClick={()=>setModal('guide')}>How to play <ArrowUpRight size={13}/></button></nav><div className="header-actions"><button className="icon-button mobile-help" aria-label="How to play" onClick={()=>setModal('guide')}><BookOpen size={18}/></button><span className="live-label"><i/> MULTIVERSE ONLINE</span><button className={`icon-button ${sound?'enabled':''}`} onClick={()=>{setSound(!sound);}} title={sound?'Mute sound':'Enable sound'} aria-label={sound?'Mute sound':'Enable sound'}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="icon-button" aria-label="Settings" onClick={()=>setModal('settings')}><Settings2 size={18}/></button></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span className="gold-line"/> TEN UNIVERSES. ONE BATTLEFIELD.</div><h1>Legends meet. <em>War begins.</em></h1><p>Your favorite anime icons. The world's most timeless battle.</p></div><button className="outline-button roster-cta" onClick={()=>setModal('roster')}><Users size={16}/> Explore the roster <ArrowUpRight size={16}/></button></section>
      <section className={`battle-layout ${expanded?'expanded':''}`} aria-label="Chess game">
        <div className="battlefield"><div className="board-heading"><div><span className="live-dot"/><span>THE MULTIVERSE ARENA</span><span className="room-number">01</span></div><div className="view-controls"><button className={view==='3d'?'active':''} onClick={()=>setView('3d')} aria-label="3D view"><Box size={13}/>3D</button><button className={view==='2d'?'active':''} onClick={()=>setView('2d')} aria-label="2D accessible board"><Grid2X2 size={13}/>2D</button><span className="control-separator"/><button onClick={()=>setExpanded(!expanded)} aria-label={expanded?'Exit expanded view':'Expand board'}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button></div></div>
          {playerBar(flipped?'w':'b')}
          <div className={`board-stage ${view==='2d'?'is-flat':''}`}>
            <div className="stage-vignette"/><div className="arena-label">M U L T I V E R S E</div>
            {view==='3d'?<SceneBoundary fallback={<div className="fallback-board"><span className="fallback-notice">3D unavailable on this device · Accessible board</span>{twoDBoard}</div>}><Suspense fallback={<div className="scene-loading"><Crown size={32}/><span>SUMMONING YOUR LEGENDS</span><div className="loading-line"/></div>}><ChessScene pieces={pieces} selected={selected} legalSquares={legalSquares} captureSquares={captureSquares} onSquareClick={chess.selectSquare} onMove={chess.move} lastMove={latest?{from:latest.from,to:latest.to}:null} flipped={flipped} showAuras={auras} quality={quality}/></Suspense></SceneBoundary>:twoDBoard}
            <div className="board-overlay-bottom"><span><Move size={12}/>{view==='3d'?'DRAG TO MOVE · RIGHT-DRAG TO ORBIT':'CLASSIC VIEW · ALL CHESS RULES APPLY'}</span><button onClick={()=>setFlipped(!flipped)} title="Flip board" aria-label="Flip board"><RefreshCw size={13}/></button></div>
          </div>
          {playerBar(flipped?'b':'w')}
          <div className="arena-footer"><span><Shield size={13}/> PURE CHESS. LEGENDARY CHARACTERS.</span><span><i/> {view==='3d'?'3D EXPERIENCE':'ACCESSIBLE 2D'} <span className="footer-dot">·</span> NO TIME LIMIT</span></div>
        </div>
        <aside className={`match-panel ${onlineMode?'online-match':''}`}>
          <div className="match-heading"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>The battle is yours.</h2><p>Choose your side of the story.</p></div>
          <div className="mode-picker game-mode-picker" role="group" aria-label="Game mode"><button className={chess.mode==='local'?'selected':''} onClick={()=>chess.setMode('local')}><Users size={15}/> Local PvP</button><button className={chess.mode==='ai'?'selected':''} onClick={()=>chess.setMode('ai')}><Cpu size={15}/> vs. Computer</button><button className={onlineMode?'selected':''} onClick={()=>chess.setMode('online')}><Globe2 size={15}/> Online Multiplayer</button></div>
          {onlineMode&&<OnlinePanel online={online} onLeave={()=>setModal('leaveonline')} onCloseRoom={()=>setModal('closeonline')}/>}
          {!onlineMode&&online.room&&<button className="online-return" onClick={()=>chess.setMode('online')}><Globe2 size={13}/> Return to room {online.room.code}</button>}
          <div className="match-status"><span className={`status-orb ${active==='b'?'villain':''}`}>{active==='w'?<Swords size={19}/>:<Crown size={19}/>}</span><div aria-live="polite"><strong>{onlineMode?onlineTitle:gameOver?status.title:chess.aiThinking?'The Villains are thinking…':isCheck?`${active==='w'?'Heroes':'Villains'} are in check`:`${active==='w'?'Heroes':'Villains'} to move`}</strong><span>{onlineMode?onlineDetail:gameOver?status.detail:chess.mode==='ai'?chess.aiError?'Engine unavailable · switch to Local PvP':chess.aiReady?'You are the Heroes · Stockfish opponent':'Preparing Stockfish…': 'Local match · Pass & play'}</span></div>{!gameOver&&<span className="status-live"/>}</div>
          <section className="movement-guide" aria-label="Movement guide">
            <div className="section-label"><span>MOVE WITH INTENT</span><span>{selected?.toUpperCase()||'SELECT A PIECE'}</span></div>
            {selectedCharacter ? <><strong><span className="guide-role-glyph">{pieceGlyphs[selectedCharacter.piece]}</span>{selectedCharacter.name}<small>{selectedCharacter.role}</small></strong><p>{movementRules[selectedCharacter.piece]}</p><div className="move-options" aria-label="Legal destinations">{legalSquares.length ? legalSquares.map(square=>{const candidate=selectedMoves.find(m=>m.to===square);const special=candidate?.flags.includes('k')||candidate?.flags.includes('q')?'Castle':candidate?.flags.includes('e')?'En passant':candidate?.promotion?'Promote':captureSquares.includes(square)?'Capture':'Move';return <button key={square} className={captureSquares.includes(square)?'capture':''} onClick={()=>chess.selectSquare(square)} aria-label={`${special} to ${square.toUpperCase()}`}>{special} <b>{square.toUpperCase()}</b></button>;}):<span className="no-legal-moves">This piece has no legal moves in the current position.</span>}</div></> : <p>Select a character to see its chess role and legal destinations. Click a highlighted square or a destination below to move.</p>}
            <div className="movement-legend"><span><i/>Legal move</span><span><i/>Capture</span><span><i/>Selected</span></div>
          </section>
          <div className="history-section"><div className="section-label"><span>BATTLE LOG</span><span className="count-badge">{history.length.toString().padStart(2,'0')} MOVES</span></div><div className="history-table-header"><span>#</span><span><i className="white-piece-dot"/> HEROES</span><span><i className="black-piece-dot"/> VILLAINS</span></div><div className={`move-log ${history.length===0?'empty':''}`} ref={moveListRef}>{history.length===0?<div className="empty-log"><Swords size={29} strokeWidth={1}/><strong>Every legend has a first move.</strong><span>Select a Hero to begin your story.</span><div className="suggested-move">The opening is yours <ArrowRight size={13}/></div></div>:Array.from({length:Math.ceil(history.length/2)},(_,i)=><div className="move-row" key={i}><span>{i+1}.</span>{[history[i*2],history[i*2+1]].map((m,j)=><span key={j} className={m===latest?'latest':''}>{m&&<><span className="move-glyph">{pieceGlyphs[m.piece]}</span>{m.san}{m===latest&&<i/>}</>}</span>)}</div>)}</div></div>
          <div className="captured-section"><div className="section-label"><span>FALLEN LEGENDS</span><span>{captureNames.length} / 32</span></div>{captureNames.length?<div className="captured-list">{captureNames.map(c=><span key={c.id} title={`${c.name} · ${c.color==='w'?'Heroes':'Villains'}`}><Avatar character={c} small/></span>)}</div>:<div className="no-captures"><span>—</span> All legends are still standing.</div>}</div>
          <div className="match-actions"><button className="undo-button" onClick={chess.undo} disabled={!chess.canUndo} title={onlineMode?'Undo is disabled in online matches':'Undo last turn'}><Undo2 size={16}/> Undo move</button><button className="icon-button" onClick={()=>setFlipped(!flipped)} title="Rotate board" aria-label="Rotate board"><RefreshCw size={16}/></button></div>{!onlineMode&&<button className="new-match-button" onClick={()=>history.length?setModal('restart'):restart()}><Swords size={16}/> New battle <ArrowUpRight size={17}/></button>}
          <div className="rules-note"><Shield size={12}/><span>{onlineMode?'Server-validated moves · Online undo disabled':'Classic rules. No special powers. All skill.'}</span></div>
        </aside>
      </section>
      <section className="collection-strip"><div className="collection-copy"><span className="eyebrow">THE CHOSEN 32</span><h3>Icons from every universe.</h3><button onClick={()=>setModal('roster')}>Meet your legends <ArrowRight size={14}/></button></div><div className="featured-legends">{[roster.find(c=>c.id==='naruto'),roster.find(c=>c.id==='luffy'),roster.find(c=>c.id==='goku'),roster.find(c=>c.id==='gojo'),roster.find(c=>c.id==='sukuna')].filter((c):c is Character=>!!c).map(c=><button className="legend-card" key={c.id} onClick={()=>{setTeam(c.color);setRosterFilter(c.name);setModal('roster');}}><Avatar character={c}/><div><span>{c.name}</span><small>{c.anime}</small></div><span className="legend-role">{pieceGlyphs[c.piece]}</span></button>)}</div><button className="all-legends" onClick={()=>{setRosterFilter('');setModal('roster');}}>+27<ArrowUpRight size={15}/></button></section>
      <div className="franchises">{franchises.map(f=><span key={f}>{f}</span>)}</div>
      <footer className="site-footer"><span>ANIME CHESS <span>/</span> MULTIVERSE WAR</span><span>A fan-made crossover. An infinite rivalry.</span><button onClick={()=>setModal('roster')}><Info size={12}/> Your 32 legends · original GLB figurines</button></footer>
    </main>
    {selectedCharacter&&<div className="selection-toast" role="status"><Avatar character={selectedCharacter} small/><div><strong>{selectedCharacter.name}</strong><span>{selectedCharacter.role} · {selected?.toUpperCase()} · {legalSquares.length} legal destinations</span></div><button className="icon-button" onClick={()=>selected&&chess.selectSquare(selected)} aria-label="Deselect piece"><X size={15}/></button></div>}
    {modal==='guide'&&<Modal title="Every move writes a legend." eyebrow="HOW TO PLAY" onClose={()=>setModal(null)}><p className="modal-intro">The characters are extraordinary. The rules are classic chess.</p><div className="guide-steps"><div><span>01</span><div><h3>Choose your battle</h3><p>Play Local PvP, face Stockfish, or choose Online Multiplayer to create a private room and invite a friend. The creator plays White; the joining player plays Black.</p></div></div><div><span>02</span><div><h3>Make your move</h3><p>Click a figurine to reveal legal moves, then click a highlighted square. You can also drag pieces. Use 2D view for a keyboard-accessible board.</p></div></div><div><span>03</span><div><h3>Claim the multiverse</h3><p>Checkmate the opposing king. Castling, en passant, all four promotions, stalemate, repetition, and the fifty-move rule follow standard chess rules.</p></div></div></div><div className="guide-tip"><Move size={18}/><p>Right-drag to orbit. Scroll to zoom. Flip the board anytime. Character auras are visual and never affect a move.</p></div><p className="room-ended-note">Online: keep this browser tab to preserve your seat. Temporary disconnections pause play; reconnect within two minutes. Leaving an active room resigns the game. Online undo and restart are disabled.</p><button className="new-match-button" onClick={()=>setModal(null)}>Enter the arena <ArrowRight size={16}/></button></Modal>}
    {modal==='settings'&&<Modal title="Set the atmosphere." eyebrow="ARENA SETTINGS" onClose={()=>setModal(null)}><div className="setting-row"><div><strong>Battle sounds</strong><span>Subtle move and capture tones</span></div><button className={`switch ${sound?'on':''}`} role="switch" aria-checked={sound} aria-label="Battle sounds" onClick={()=>setSound(!sound)}><i/></button></div><label className="volume-setting">Volume <span>{volume}%</span><input aria-label="Sound volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label><div className="setting-row"><div><strong>Character auras</strong><span>A little energy from another universe</span></div><button className={`switch ${auras?'on':''}`} role="switch" aria-checked={auras} aria-label="Character auras" onClick={()=>setAuras(!auras)}><i/></button></div><label className="setting-row"><div><strong>Render quality</strong><span>Lower quality uses fewer resources</span></div><select value={quality} onChange={e=>setQuality(e.target.value as 'high'|'low')}><option value="high">High</option><option value="low">Performance</option></select></label><p className="settings-footnote">Audio is generated locally. No downloads or account required to play.</p></Modal>}
    {modal==='roster'&&<Modal title="Not pieces. Legends." eyebrow="THE MULTIVERSE COLLECTION" onClose={()=>{setModal(null);setRosterFilter('');}} wide><p className="modal-intro">32 fighters. 10 universes. One timeless rivalry.</p><div className="roster-notice"><Sparkles size={16}/><p><strong>Your chosen roster. Original placeholder figurines.</strong> All 32 characters follow your exact team and role assignments. The original stylized GLBs are ready to replace with licensed, detailed character models.</p></div><div className="roster-toolbar"><div className="mode-picker"><button className={team==='w'?'selected':''} onClick={()=>setTeam('w')}><Swords size={14}/> Heroes · 16</button><button className={team==='b'?'selected':''} onClick={()=>setTeam('b')}><Crown size={14}/> Villains · 16</button></div><input aria-label="Search characters" placeholder="Find your legend…" value={rosterFilter} onChange={e=>setRosterFilter(e.target.value)}/></div><div className="roster-grid">{roster.filter(c=>c.color===team&&`${c.name} ${c.anime}`.toLowerCase().includes(rosterFilter.toLowerCase())).map(c=><div className="roster-character" key={c.id}><Avatar character={c}/><span className="roster-square">{c.square.toUpperCase()}</span><h3>{c.name}</h3><span>{c.anime}</span><div><span>{pieceGlyphs[c.piece]}</span> {c.role}</div></div>)}{!roster.some(c=>c.color===team&&`${c.name} ${c.anime}`.toLowerCase().includes(rosterFilter.toLowerCase()))&&<p className="no-results">No legends found on this team. Try another name or universe.</p>}</div></Modal>}
    {modal==='restart'&&<Modal title="A new war awaits." eyebrow="NEW BATTLE" onClose={()=>setModal(null)}><p className="modal-intro">Start again with all 32 legends? Your current battle and move history will be cleared.</p><div className="dialog-actions"><button className="outline-button" onClick={()=>setModal(null)}>Return to battle</button><button className="new-match-button" onClick={restart}><RotateCcw size={15}/> Start new battle</button></div></Modal>}
    {(modal==='leaveonline'||modal==='closeonline')&&<Modal title={modal==='closeonline'?'Close this battlefield?':'Leave this battlefield?'} eyebrow="ONLINE ROOM" onClose={()=>setModal(null)}><p className="modal-intro">{modal==='closeonline'?'This closes the room for both players. The current battle will end.':online.room?.phase==='playing'?'Leaving an active game resigns your side. Your opponent will see the result.':'Exit the private room and return to the online lobby.'}</p><div className="dialog-actions"><button className="outline-button" onClick={()=>setModal(null)}>Stay in room</button><button className="new-match-button" disabled={online.busy} onClick={()=>{void (modal==='closeonline'?online.closeRoom():online.leaveRoom()).then(ok=>{if(ok)setModal(null);});}}>{modal==='closeonline'?'Close room':'Leave room'}</button></div></Modal>}
    {chess.pendingPromotion&&<Modal title="A legend ascends." eyebrow="PAWN PROMOTION" dismissible={false} onClose={()=>{}}><p className="modal-intro">Choose a new role for your pawn. Its character identity stays with it.</p><div className="promotion-options">{(['q','r','b','n'] as const).map(p=><button key={p} onClick={()=>chess.promote(p)}><span>{pieceGlyphs[p]}</span>{pieceNames[p]}</button>)}</div></Modal>}
    {gameOver&&dismissedEnd!==endKey&&<Modal title={status.title} eyebrow="THE BATTLE IS OVER" onClose={()=>setDismissedEnd(endKey)}><div className="end-emblem"><Crown size={42}/></div><p className="modal-intro">{status.detail}</p><p className="end-moves">{history.length} moves. A story for the multiverse.</p><button className="new-match-button" disabled={onlineMode&&online.busy} onClick={()=>onlineMode?void online.leaveRoom():restart()}>{onlineMode?'Exit room':'Begin another legend'} <ArrowRight size={16}/></button><button className="text-button" onClick={()=>setDismissedEnd(endKey)}>Review the battlefield</button></Modal>}
  </div>;
}
