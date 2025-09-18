"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CellState = {
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  neighborMines: number
}

type GameStatus = "playing" | "won" | "lost"

type Difficulty = {
  name: string
  rows: number
  cols: number
  mines: number
}

const difficulties: Record<string, Difficulty> = {
  beginner: { name: "Beginner", rows: 9, cols: 9, mines: 10 },
  intermediate: { name: "Intermediate", rows: 16, cols: 16, mines: 40 },
  expert: { name: "Expert", rows: 16, cols: 30, mines: 99 },
}

export default function Component() {
  const [difficulty, setDifficulty] = useState<string>("beginner")
  const [grid, setGrid] = useState<CellState[][]>([])
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing")
  const [timer, setTimer] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [firstClick, setFirstClick] = useState(true)

  const currentDifficulty = difficulties[difficulty]
  const { rows, cols, mines } = currentDifficulty

  const minesRemaining = useMemo(() => {
    if (!grid.length) return mines
    const flaggedCount = grid.flat().filter((cell) => cell.isFlagged).length
    return mines - flaggedCount
  }, [grid, mines])

  const initializeGrid = useCallback(
    (avoidRow?: number, avoidCol?: number) => {
      const newGrid: CellState[][] = Array(rows)
        .fill(null)
        .map(() =>
          Array(cols)
            .fill(null)
            .map(() => ({
              isMine: false,
              isRevealed: false,
              isFlagged: false,
              neighborMines: 0,
            })),
        )

      // Place mines randomly, avoiding the first clicked cell
      const minePositions = new Set<string>()
      while (minePositions.size < mines) {
        const row = Math.floor(Math.random() * rows)
        const col = Math.floor(Math.random() * cols)
        const key = `${row}-${col}`

        if (avoidRow !== undefined && avoidCol !== undefined) {
          if (row === avoidRow && col === avoidCol) continue
        }

        minePositions.add(key)
      }

      // Set mines
      minePositions.forEach((pos) => {
        const [row, col] = pos.split("-").map(Number)
        newGrid[row][col].isMine = true
      })

      // Calculate neighbor mine counts
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (!newGrid[row][col].isMine) {
            let count = 0
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = row + dr
                const nc = col + dc
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].isMine) {
                  count++
                }
              }
            }
            newGrid[row][col].neighborMines = count
          }
        }
      }

      return newGrid
    },
    [rows, cols, mines],
  )

  const resetGame = useCallback(() => {
    setGrid(initializeGrid())
    setGameStatus("playing")
    setTimer(0)
    setIsTimerRunning(false)
    setFirstClick(true)
  }, [initializeGrid])

  useEffect(() => {
    resetGame()
  }, [resetGame])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && gameStatus === "playing") {
      interval = setInterval(() => {
        setTimer((prev) => Math.min(prev + 1, 999))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, gameStatus])

  const revealCell = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== "playing") return

      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))

        if (firstClick) {
          setFirstClick(false)
          setIsTimerRunning(true)
          // Regenerate grid avoiding the first clicked cell
          const regeneratedGrid = initializeGrid(row, col)
          return regeneratedGrid
        }

        const cell = newGrid[row][col]
        if (cell.isRevealed || cell.isFlagged) return prevGrid

        cell.isRevealed = true

        if (cell.isMine) {
          setGameStatus("lost")
          setIsTimerRunning(false)
          // Reveal all mines
          newGrid.forEach((row) => {
            row.forEach((cell) => {
              if (cell.isMine) cell.isRevealed = true
            })
          })
          return newGrid
        }

        // If cell has no neighboring mines, reveal adjacent cells
        if (cell.neighborMines === 0) {
          const queue = [[row, col]]
          const visited = new Set<string>()

          while (queue.length > 0) {
            const [r, c] = queue.shift()!
            const key = `${r}-${c}`
            if (visited.has(key)) continue
            visited.add(key)

            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr
                const nc = c + dc
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                  const neighborCell = newGrid[nr][nc]
                  if (!neighborCell.isRevealed && !neighborCell.isFlagged && !neighborCell.isMine) {
                    neighborCell.isRevealed = true
                    if (neighborCell.neighborMines === 0) {
                      queue.push([nr, nc])
                    }
                  }
                }
              }
            }
          }
        }

        return newGrid
      })
    },
    [gameStatus, firstClick, initializeGrid, rows, cols],
  )

  const toggleFlag = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== "playing") return

      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))
        const cell = newGrid[row][col]

        if (!cell.isRevealed) {
          cell.isFlagged = !cell.isFlagged
        }

        return newGrid
      })
    },
    [gameStatus],
  )

  const revealAdjacent = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== "playing") return

      const cell = grid[row][col]
      if (!cell.isRevealed || cell.neighborMines === 0) return

      // Count adjacent flags
      let flagCount = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr
          const nc = col + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isFlagged) {
            flagCount++
          }
        }
      }

      // If flag count matches neighbor mines, reveal adjacent unflagged cells
      if (flagCount === cell.neighborMines) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr
            const nc = col + dc
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const adjacentCell = grid[nr][nc]
              if (!adjacentCell.isRevealed && !adjacentCell.isFlagged) {
                revealCell(nr, nc)
              }
            }
          }
        }
      }
    },
    [gameStatus, grid, rows, cols, revealCell],
  )

  // Check win condition
  useEffect(() => {
    if (gameStatus === "playing" && grid.length > 0) {
      const allNonMinesRevealed = grid.every((row) => row.every((cell) => cell.isMine || cell.isRevealed))

      if (allNonMinesRevealed) {
        setGameStatus("won")
        setIsTimerRunning(false)
      }
    }
  }, [grid, gameStatus])

  const getCellContent = (cell: CellState) => {
    if (cell.isFlagged) return "🚩"
    if (!cell.isRevealed) return ""
    if (cell.isMine) return "💣"
    if (cell.neighborMines === 0) return ""
    return cell.neighborMines.toString()
  }

  const getCellClassName = (cell: CellState, row: number, col: number) => {
    let className = "w-6 h-6 text-xs font-bold border flex items-center justify-center select-none "

    if (cell.isRevealed) {
      className += "bg-gray-200 border-gray-400 "
      if (cell.isMine) {
        className += "bg-red-500 "
      } else {
        // Number colors matching Windows XP
        const colors = [
          "",
          "text-blue-600",
          "text-green-600",
          "text-red-600",
          "text-purple-600",
          "text-yellow-600",
          "text-pink-600",
          "text-black",
          "text-gray-600",
        ]
        className += colors[cell.neighborMines] || "text-black"
      }
    } else {
      className +=
        "bg-gray-300 border-white border-t-2 border-l-2 border-r-gray-500 border-b-gray-500 hover:bg-gray-200 active:bg-gray-200 cursor-pointer"
    }

    return className
  }

  const getSmileyFace = () => {
    switch (gameStatus) {
      case "won":
        return "😎"
      case "lost":
        return "😵"
      default:
        return "🙂"
    }
  }

  const formatNumber = (num: number) => {
    return num.toString().padStart(3, "0")
  }

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <div className="mb-4">
        <Select
          value={difficulty}
          onValueChange={(value) => {
            setDifficulty(value)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(difficulties).map(([key, diff]) => (
              <SelectItem key={key} value={key}>
                {diff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-gray-300 p-3 border-2 border-gray-500 border-t-white border-l-white">
        {/* Header with timer, smiley, and mine counter */}
        <div className="flex justify-between items-center mb-3 bg-gray-200 p-2 border border-gray-500 border-t-white border-l-white">
          <div className="bg-black text-red-500 px-2 py-1 font-mono text-lg border border-gray-600">
            {formatNumber(minesRemaining)}
          </div>

          <Button
            onClick={resetGame}
            className="text-2xl p-2 bg-gray-300 hover:bg-gray-200 border-2 border-white border-r-gray-500 border-b-gray-500"
            variant="ghost"
          >
            {getSmileyFace()}
          </Button>

          <div className="bg-black text-red-500 px-2 py-1 font-mono text-lg border border-gray-600">
            {formatNumber(timer)}
          </div>
        </div>

        {/* Game grid */}
        <div
          className="inline-block bg-gray-200 p-2 border-2 border-gray-500 border-t-white border-l-white"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: "0px",
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={getCellClassName(cell, rowIndex, colIndex)}
                onClick={() => revealCell(rowIndex, colIndex)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  toggleFlag(rowIndex, colIndex)
                }}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    // Middle click
                    e.preventDefault()
                    revealAdjacent(rowIndex, colIndex)
                  }
                }}
                disabled={gameStatus !== "playing"}
              >
                {getCellContent(cell)}
              </button>
            )),
          )}
        </div>

        {gameStatus !== "playing" && (
          <div className="mt-4 text-center">
            <div className="text-lg font-bold">{gameStatus === "won" ? "🎉 You Won!" : "💥 Game Over!"}</div>
            <div className="text-sm text-gray-600 mt-1">Time: {timer}s</div>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600 max-w-md text-center">
        <p>
          <strong>Controls:</strong>
        </p>
        <p>Left click: Reveal cell</p>
        <p>Right click: Flag/unflag cell</p>
        <p>Middle click on numbers: Reveal adjacent cells</p>
      </div>
    </div>
  )
}
