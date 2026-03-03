"""
Tic-Tac-Toe: Human vs AI (Minimax Algorithm)
Flask Backend - Production Style
"""

from flask import Flask, render_template, request, jsonify, session
import math
import uuid

app = Flask(__name__)
app.secret_key = "ttt-secret-neon-2024"  # Change in production

# ─────────────────────────────────────────────
#  GAME LOGIC
# ─────────────────────────────────────────────

HUMAN = "X"
AI    = "O"
EMPTY = None


def get_initial_state():
    return {
        "board": [EMPTY] * 9,
        "game_over": False,
        "winner": None,
        "winning_combo": None,
        "scores": {"human": 0, "ai": 0, "draws": 0},
    }


def check_winner(board):
    """Return (winner, winning_combo) or (None, None)."""
    combos = [
        [0,1,2],[3,4,5],[6,7,8],   # rows
        [0,3,6],[1,4,7],[2,5,8],   # cols
        [0,4,8],[2,4,6],           # diagonals
    ]
    for combo in combos:
        a, b, c = combo
        if board[a] and board[a] == board[b] == board[c]:
            return board[a], combo
    return None, None


def is_full(board):
    return all(cell is not None for cell in board)


def minimax(board, depth, is_maximizing, alpha=-math.inf, beta=math.inf):
    """Alpha-beta pruned Minimax for unbeatable AI."""
    winner, _ = check_winner(board)
    if winner == AI:
        return 10 - depth
    if winner == HUMAN:
        return depth - 10
    if is_full(board):
        return 0

    if is_maximizing:
        best = -math.inf
        for i in range(9):
            if board[i] is EMPTY:
                board[i] = AI
                best = max(best, minimax(board, depth + 1, False, alpha, beta))
                board[i] = EMPTY
                alpha = max(alpha, best)
                if beta <= alpha:
                    break
        return best
    else:
        best = math.inf
        for i in range(9):
            if board[i] is EMPTY:
                board[i] = HUMAN
                best = min(best, minimax(board, depth + 1, True, alpha, beta))
                board[i] = EMPTY
                beta = min(beta, best)
                if beta <= alpha:
                    break
        return best


def best_ai_move(board):
    """Return index of AI's best move."""
    best_val = -math.inf
    move = -1
    for i in range(9):
        if board[i] is EMPTY:
            board[i] = AI
            val = minimax(board, 0, False)
            board[i] = EMPTY
            if val > best_val:
                best_val = val
                move = i
    return move


# ─────────────────────────────────────────────
#  SESSION HELPERS
# ─────────────────────────────────────────────

def get_game():
    if "game" not in session:
        session["game"] = get_initial_state()
    return session["game"]


def save_game(game):
    session["game"] = game
    session.modified = True


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Home page."""
    get_game()  # Ensure session exists
    return render_template("index.html")


@app.route("/move", methods=["POST"])
def move():
    """Handle human move, then trigger AI move."""
    game = get_game()

    if game["game_over"]:
        return jsonify({"error": "Game is over. Please reset."}), 400

    data = request.get_json()
    cell = data.get("cell")

    if cell is None or not (0 <= cell <= 8):
        return jsonify({"error": "Invalid cell"}), 400

    board = game["board"]

    # Validate move
    if board[cell] is not EMPTY:
        return jsonify({"error": "Cell already taken"}), 400

    # Human plays
    board[cell] = HUMAN
    winner, combo = check_winner(board)

    if winner:
        game["game_over"] = True
        game["winner"] = winner
        game["winning_combo"] = combo
        game["scores"]["human"] += 1
        save_game(game)
        return jsonify(build_response(game))

    if is_full(board):
        game["game_over"] = True
        game["winner"] = "draw"
        game["scores"]["draws"] += 1
        save_game(game)
        return jsonify(build_response(game))

    # AI plays
    ai_cell = best_ai_move(board)
    board[ai_cell] = AI
    winner, combo = check_winner(board)

    if winner:
        game["game_over"] = True
        game["winner"] = winner
        game["winning_combo"] = combo
        game["scores"]["ai"] += 1
    elif is_full(board):
        game["game_over"] = True
        game["winner"] = "draw"
        game["scores"]["draws"] += 1

    save_game(game)
    return jsonify(build_response(game, ai_cell=ai_cell))


@app.route("/reset", methods=["POST"])
def reset():
    """Reset board while keeping scores."""
    game = get_game()
    scores = game["scores"]  # Preserve scores
    game = get_initial_state()
    game["scores"] = scores
    save_game(game)
    return jsonify({"status": "ok", "board": game["board"], "scores": game["scores"]})


@app.route("/clear", methods=["POST"])
def clear():
    """Clear all scores and reset the game."""
    game = get_initial_state()
    save_game(game)
    return jsonify({"status": "ok", "scores": game["scores"]})


def build_response(game, ai_cell=None):
    return {
        "board": game["board"],
        "game_over": game["game_over"],
        "winner": game["winner"],
        "winning_combo": game["winning_combo"],
        "scores": game["scores"],
        "ai_cell": ai_cell,
    }


# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)