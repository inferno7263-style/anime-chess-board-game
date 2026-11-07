import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Globe2, Link2, LogOut, RefreshCw, Shield, Wifi, WifiOff, XCircle } from 'lucide-react';
import { useOnlineGame } from '../online/useOnlineGame';

type Props = {
  online: ReturnType<typeof useOnlineGame>;
  onLeave: () => void;
  onCloseRoom: () => void;
};

/** Room codes invite an opponent. Seat credentials never enter an invitation. */
export default function OnlinePanel({ online, onLeave, onCloseRoom }: Props) {
  const [code, setCode] = useState(online.invitationCode);
  const [copied, setCopied] = useState(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (online.invitationCode) setCode(online.invitationCode); }, [online.invitationCode]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  const { room, color } = online;
  const opponent = room && color ? room.players[color === 'w' ? 'b' : 'w'] : null;
  const connected = online.connection === 'connected';
  const terminal = room?.phase === 'finished' || room?.phase === 'closed';
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(online.inviteUrl); setCopied(true); }
    catch { inviteInput.current?.focus(); inviteInput.current?.select(); }
  };
  return <section className="online-panel" aria-label="Online multiplayer room">
    <div className={`online-connection ${connected ? 'connected' : ''}`} role="status">
      {connected ? <Wifi size={13}/> : <WifiOff size={13}/>}
      <span>{connected ? 'Room server connected' : online.connection === 'connecting' ? 'Connecting to room server…' : 'Connection lost · Reconnecting…'}</span>
      {!connected && <button onClick={online.reconnect} aria-label="Reconnect to room server" title="Reconnect"><RefreshCw size={13}/></button>}
    </div>
    {!room ? <>
      <p className="online-intro">A private battlefield for two. Create a room as White, or join a friend as Black.</p>
      <button className="new-match-button create-room" onClick={()=>void online.createRoom()} disabled={!connected || online.busy}><Globe2 size={15}/>{online.busy ? 'Please wait…' : 'Create private room'}</button>
      <div className="online-or"><span/> OR JOIN A FRIEND <span/></div>
      <form className="room-join-form" onSubmit={event=>{event.preventDefault();void online.joinRoom(code);}}>
        <label htmlFor="join-room-code">Room code</label>
        <div><input id="join-room-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} placeholder="Enter room code" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/><button className="outline-button" type="submit" disabled={!connected || online.busy || code.trim().length<4}>Join room</button></div>
      </form>
      <p className="online-security"><Shield size={12}/>Moves are validated by the room server.</p>
    </> : <>
      <div className="room-code-row"><div><span className="eyebrow">PRIVATE ROOM</span><strong data-testid="room-code">{room.code}</strong></div><span className={`your-side ${color === 'b' ? 'black' : ''}`}>YOU ARE {color === 'w' ? 'WHITE' : 'BLACK'}</span></div>
      {!terminal && <><label className="invite-label" htmlFor="invitation-link"><Link2 size={12}/> Invite your opponent</label><div className="invite-input"><input id="invitation-link" ref={inviteInput} readOnly value={online.inviteUrl} aria-label="Invitation link" onFocus={e=>e.target.select()}/><button onClick={()=>void copyInvite()} aria-label={copied?'Invitation copied':'Copy invitation link'} title="Copy invitation link">{copied?<Check size={14}/>:<Copy size={14}/>}</button></div>{copied&&<span className="copy-feedback" role="status">Invitation link copied</span>}</>}
      <div className={`opponent-status ${opponent?.connected?'connected':''}`} role="status"><i/><span>{terminal ? room.result?.message : !opponent ? 'Waiting for your opponent…' : opponent.connected ? `Opponent connected · ${color === 'w' ? 'Black' : 'White'}` : `Opponent disconnected · Moves paused`}</span></div>
      {opponent && !opponent.connected && !terminal && <p className="reconnect-note">Their seat is reserved for {Math.round(room.reconnectGraceMs/1000)} seconds. The current game will be restored when they reconnect.</p>}
      <div className="room-actions"><button onClick={onLeave} disabled={online.busy}><LogOut size={13}/>{terminal ? 'Exit room' : 'Leave room'}</button>{color === 'w' && !terminal && <button onClick={onCloseRoom} disabled={online.busy}><XCircle size={13}/>Close room</button>}</div>
    </>}
    {online.error && <div className="online-error" role="alert"><span>{online.error}</span><button onClick={online.clearError} aria-label="Dismiss online error">×</button></div>}
  </section>;
}
