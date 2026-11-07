import type { Square } from 'chess.js'

export type Character = {
  id: string
  name: string
  anime: string
  role: string
  piece: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
  originalPiece?: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
  color: 'w' | 'b'
  square: string
  accent: string
  modelUrl?: string
  appearance?: {
    hair?: string
    outfit?: string
    skin?: string
    style?: 'spiky' | 'long' | 'short' | 'bald' | 'hat'
    weapon?: 'sword' | 'staff' | 'none'
    cloak?: boolean
    [key: string]: unknown
  }
}

export type BoardPiece = { square: Square; character: Character }

export type ChessSceneProps = {
  pieces: BoardPiece[]
  selected: Square | null
  legalSquares: Square[]
  captureSquares?: Square[]
  onSquareClick: (square: Square) => void
  onMove: (from: Square, to: Square) => void
  lastMove: { from: Square; to: Square } | null
  flipped: boolean
  showAuras: boolean
  quality?: 'high' | 'low'
}
