// @ts-nocheck
import { fetchWithCsrf } from "./http.js";

const HISTORY_PAGE_SIZE = 20;
const CLASSIC_SYMBOL_COUNT = 22;
const ODDS_MATCH_ORDER = [5, 4, 3, 2];
const NUMBERS_TARGET_RTP = 0.86;
const BASE_GROUP_COEFFICIENTS = [1.85, 1.75, 1.65, 1.55, 1.45, 1.35, 1.25, 1.15, 1.05, 0.95, 0.85];
const GAME_TYPE_ODDS_COEFFICIENTS = {
  1: 1.0,
  2: 0.94,
  3: 1.08,
  4: 1.03,
  5: 0.98,
};

/**
 * BingoMiniGame - Bonus game after winning on slot machine
 * Based on BingoTicketSystem from legacy code
 *
 * Rules:
 * - Numbers must be UNIQUE across ALL tickets (not just within one ticket)
 * - User selects a coin value (10, 20, 50, 100, 200, 500, 1000)
 * - Bet per ticket = betMultiplier[numbers] × coinValue
 * - Total bet must not exceed user balance
 * - Click ticket numbers to remove them
 */
class BingoMiniGame {
  constructor(winAmount, shadowRoot, onComplete, userBalance) {
    this.winAmount = winAmount;
    this.shadowRoot = shadowRoot;
    this.onComplete = onComplete;
    this.userBalance = userBalance || 0;

    // Game state
    this.currentTicket = 0;
    this.tickets = [[], [], [], [], []]; // 5 tickets, each can have up to 5 numbers
    this.maxNumbersPerTicket = 5;
    this.maxTickets = 5;
    this.totalNumbers = 30;
    this.drawnNumbers = [];
    this.drawCount = 12;
    this.isPlaying = false;
    this.gameFinished = false;

    // Coin value selection
    this.coinValues = [10, 20, 50, 100, 200, 500, 1000];
    this.selectedCoinValue = 10; // Default to lowest

    // Payout odds table (matches, odds, probability%)
    // Formula: P(k of n) = C(12,k) × C(18, n-k) / C(30,n)
    // 30 total numbers, 12 drawn, 18 not drawn
    this.oddsTable = [
      { played: 1, matches: 1, odds: 2.5, prob: 40.00 },   // 12/30 = 40%
      { played: 2, matches: 1, odds: 0.62, prob: 49.66 },
      { played: 2, matches: 2, odds: 6.59, prob: 15.17 },
      { played: 3, matches: 1, odds: 0.27, prob: 45.22 },
      { played: 3, matches: 2, odds: 2.89, prob: 29.26 },
      { played: 3, matches: 3, odds: 18.45, prob: 5.42 },
      { played: 4, matches: 1, odds: 0.15, prob: 35.73 },
      { played: 4, matches: 2, odds: 1.64, prob: 36.85 },
      { played: 4, matches: 3, odds: 10.64, prob: 14.45 },
      { played: 4, matches: 4, odds: 55.36, prob: 1.81 },
      { played: 5, matches: 1, odds: 0.10, prob: 25.77 },
      { played: 5, matches: 2, odds: 1.05, prob: 37.79 },
      { played: 5, matches: 3, odds: 7.33, prob: 23.62 },
      { played: 5, matches: 4, odds: 35.43, prob: 6.25 },
      { played: 5, matches: 5, odds: 179.94, prob: 0.56 },
    ];

    // Bet multipliers per ticket size (1 number = 1x coin value)
    this.betMultipliers = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

    this.render();
  }

  /**
   * Show toast notification (replaces JS alerts)
   */
  showToast(message, type = 'error') {
    const container = this.overlay.querySelector('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `minigame-toast minigame-toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Select coin value for betting
   */
  selectCoinValue(value) {
    if (this.isPlaying || this.gameFinished) return;
    this.selectedCoinValue = value;
    this.updateUI();
  }

  /**
   * Calculate total bet across all tickets
   */
  calculateTotalBet() {
    return this.tickets
      .filter(t => t.length > 0)
      .reduce((sum, t) => sum + (this.betMultipliers[t.length] * this.selectedCoinValue), 0);
  }

  /**
   * Check if user has sufficient balance
   */
  hasSufficientBalance() {
    return this.calculateTotalBet() <= this.userBalance;
  }

  render() {
    const overlay = document.createElement('dialog');
    overlay.className = 'minigame-overlay';
    overlay.id = 'minigameOverlay';

    overlay.innerHTML = `
      <div class="minigame-toast-container" id="toastContainer"></div>
      <div class="minigame-container">
        <div class="minigame-header">
          <h2>BINGO BONUS GAME</h2>
          <p>You won: <span class="minigame-prize">${this.winAmount} coins</span></p>
          <p>Your balance: <span class="balance-display-mini" id="balanceDisplay">${this.userBalance} coins</span></p>
          <p>Each number can only be used ONCE across all tickets!</p>
        </div>

        <!-- Coin Selector -->
        <div class="coin-selector">
          <div class="coin-selector-label">Select Coin Value</div>
          <div class="coin-selector-buttons" id="coinSelector">
            ${this.coinValues.map(v => `
              <button class="coin-btn ${v === this.selectedCoinValue ? 'selected' : ''}" data-value="${v}">${v}</button>
            `).join('')}
          </div>
        </div>

        <!-- Total Bet Display -->
        <div class="total-bet-display">
          <span class="total-bet-label">Total Bet:</span>
          <span class="total-bet-value" id="totalBetDisplay">0 coins</span>
        </div>

        <div class="minigame-layout">
          <div class="minigame-numbers">
            <h3>Select numbers (1-30)</h3>
            <div class="number-grid" id="numberGrid">
              ${this.renderNumberGrid()}
            </div>
          </div>

          <div class="minigame-tickets">
            <h3>Your tickets (click number to remove)</h3>
            <div class="tickets-container" id="ticketsContainer">
              ${this.renderTickets()}
            </div>
          </div>
        </div>

        <div class="minigame-odds">
          <h3>Odds Table</h3>
          <div class="odds-table-container">
            ${this.renderOddsTable()}
          </div>
        </div>

        <div class="minigame-drawn" id="drawnSection" style="display: none;">
          <h3>Drawn numbers (12)</h3>
          <div class="drawn-numbers" id="drawnNumbers"></div>
        </div>

        <div class="minigame-result" id="resultSection" style="display: none;">
          <h2>Result</h2>
          <p id="resultText"></p>
          <p class="total-win" id="totalWin"></p>
        </div>

        <div class="minigame-controls">
          <button class="minigame-btn minigame-btn-secondary" id="nextTicketBtn">Next ticket</button>
          <button class="minigame-btn minigame-btn-primary" id="playBtn" disabled>Start drawing</button>
          <button class="minigame-btn minigame-btn-success" id="collectBtn" style="display: none;">Collect winnings</button>
          <button class="minigame-btn minigame-btn-secondary" id="skipBtn">Skip</button>
        </div>

        <div class="minigame-info">
          Click a number (1-30) to add to active ticket. Click a number in ticket to remove.
          <br>Each number can only be used ONCE across all tickets! 12 of 30 numbers are drawn.
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(overlay);
    this.overlay = overlay;
    overlay.addEventListener('close', () => overlay.remove(), { once: true });
    this.bindEvents();
    this.updateUI();
    if (typeof overlay.showModal === 'function') {
      overlay.showModal();
    } else {
      overlay.setAttribute('open', '');
    }
  }

  renderOddsTable() {
    let html = '<table class="odds-table"><thead><tr><th>Numbers</th><th>Matches</th><th>Odds</th><th>Probability</th></tr></thead><tbody>';
    for (const row of this.oddsTable) {
      html += `<tr><td>${row.played}</td><td>${row.matches}</td><td>${row.odds}x</td><td>${row.prob}%</td></tr>`;
    }
    html += '</tbody></table>';
    return html;
  }

  renderNumberGrid() {
    let html = '';
    for (let i = 1; i <= this.totalNumbers; i++) {
      html += `<button class="number-btn" data-number="${i}">${i}</button>`;
    }
    return html;
  }

  renderTickets() {
    let html = '';
    for (let i = 0; i < this.maxTickets; i++) {
      const isActive = i === this.currentTicket;
      html += `
        <div class="ticket ${isActive ? 'active' : ''}" data-ticket="${i}">
          <span class="ticket-label">Ticket ${i + 1}:</span>
          <div class="ticket-numbers" id="ticketNumbers${i}"></div>
          <span class="ticket-result" id="ticketResult${i}"></span>
        </div>
      `;
    }
    return html;
  }

  bindEvents() {
    // Coin selector buttons
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const value = parseInt(btn.dataset.value);
        this.selectCoinValue(value);
      });
    });

    // Number selection
    this.overlay.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const num = parseInt(btn.dataset.number);
        this.selectNumber(num, btn);
      });
    });

    // Ticket selection
    this.overlay.querySelectorAll('.ticket').forEach(ticket => {
      ticket.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const ticketIdx = parseInt(ticket.dataset.ticket);
        this.switchTicket(ticketIdx);
      });
    });

    // Next ticket button
    this.overlay.querySelector('#nextTicketBtn').addEventListener('click', () => {
      if (this.isPlaying || this.gameFinished) return;
      this.nextTicket();
    });

    // Play button
    this.overlay.querySelector('#playBtn').addEventListener('click', () => {
      if (!this.isPlaying && !this.gameFinished) {
        this.play();
      }
    });

    // Collect button
    this.overlay.querySelector('#collectBtn').addEventListener('click', () => {
      this.collect();
    });

    // Skip button
    this.overlay.querySelector('#skipBtn').addEventListener('click', () => {
      this.skip();
    });
  }

  selectNumber(num, btn) {
    const ticket = this.tickets[this.currentTicket];

    // Check if number is already in CURRENT ticket
    const indexInCurrentTicket = ticket.indexOf(num);

    if (indexInCurrentTicket !== -1) {
      // Remove from current ticket
      ticket.splice(indexInCurrentTicket, 1);
    } else {
      // Check if number is used in ANY other ticket (globally unique enforcement)
      const usedInOtherTicket = this.tickets.some((t, idx) =>
        idx !== this.currentTicket && t.includes(num)
      );

      if (usedInOtherTicket) {
        this.showToast(`Number ${num} is already used in another ticket`, 'warning');
        return;
      }

      // Add to current ticket if not full
      if (ticket.length < this.maxNumbersPerTicket) {
        ticket.push(num);
        ticket.sort((a, b) => a - b);
      } else {
        this.showToast(`Ticket ${this.currentTicket + 1} is full (max 5 numbers)`, 'info');
        return;
      }
    }

    this.updateUI();
  }

  /**
   * Remove a number from a specific ticket
   */
  removeNumberFromTicket(ticketIdx, num) {
    if (this.isPlaying || this.gameFinished) return;

    const ticket = this.tickets[ticketIdx];
    const idx = ticket.indexOf(num);
    if (idx !== -1) {
      ticket.splice(idx, 1);
      this.updateUI();
    }
  }

  switchTicket(ticketIdx) {
    this.currentTicket = ticketIdx;
    this.updateUI();
  }

  nextTicket() {
    // Find next ticket with space or empty
    for (let i = 0; i < this.maxTickets; i++) {
      const nextIdx = (this.currentTicket + 1 + i) % this.maxTickets;
      if (this.tickets[nextIdx].length < this.maxNumbersPerTicket) {
        this.currentTicket = nextIdx;
        break;
      }
    }
    this.updateUI();
  }

  updateUI() {
    // Update coin selector buttons
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => {
      const value = parseInt(btn.dataset.value);
      btn.classList.toggle('selected', value === this.selectedCoinValue);
    });

    // Calculate total bet and update display
    const totalBet = this.calculateTotalBet();
    const totalBetDisplay = this.overlay.querySelector('#totalBetDisplay');
    if (totalBetDisplay) {
      totalBetDisplay.textContent = `${totalBet} coins`;
      totalBetDisplay.classList.toggle('insufficient', totalBet > this.userBalance);
    }

    // Update balance display
    const balanceDisplay = this.overlay.querySelector('#balanceDisplay');
    if (balanceDisplay) {
      balanceDisplay.textContent = `${this.userBalance} coins`;
      balanceDisplay.classList.toggle('low', this.userBalance < 500);
      balanceDisplay.classList.toggle('insufficient', totalBet > this.userBalance);
    }

    // Update ticket active states and styling
    this.overlay.querySelectorAll('.ticket').forEach((ticket, idx) => {
      ticket.classList.toggle('active', idx === this.currentTicket);
    });

    // Update ticket contents with removable numbers
    for (let i = 0; i < this.maxTickets; i++) {
      const container = this.overlay.querySelector(`#ticketNumbers${i}`);
      const betAmount = this.tickets[i].length > 0
        ? this.betMultipliers[this.tickets[i].length] * this.selectedCoinValue
        : 0;

      container.innerHTML = this.tickets[i].map(num =>
        `<span class="ticket-number removable" data-ticket="${i}" data-num="${num}" title="Click to remove">${num}</span>`
      ).join('');

      // Show bet for this ticket
      const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
      if (resultEl && !this.gameFinished) {
        resultEl.textContent = betAmount > 0 ? `Bet: ${betAmount} coins` : '';
      }

      // Bind click to remove number from ticket
      container.querySelectorAll('.ticket-number').forEach(numEl => {
        numEl.addEventListener('click', (e) => {
          if (this.isPlaying || this.gameFinished) return;
          e.stopPropagation();
          const ticketIdx = parseInt(numEl.dataset.ticket);
          const num = parseInt(numEl.dataset.num);
          this.removeNumberFromTicket(ticketIdx, num);
        });
      });
    }

    // Update number grid selection state
    // Numbers used in OTHER tickets are completely disabled (globally-used)
    const currentTicketNums = this.tickets[this.currentTicket];
    this.overlay.querySelectorAll('.number-btn').forEach(btn => {
      const num = parseInt(btn.dataset.number);
      const isInCurrentTicket = currentTicketNums.includes(num);
      const isInOtherTicket = this.tickets.some((t, idx) => idx !== this.currentTicket && t.includes(num));

      // 'selected' = in current ticket (green)
      btn.classList.toggle('selected', isInCurrentTicket);
      // 'globally-used' = in other tickets (disabled, cannot be selected)
      btn.classList.toggle('globally-used', isInOtherTicket);
      // Remove old 'used-other' class if present
      btn.classList.remove('used-other');
    });

    // Update play button state - disabled if no numbers OR insufficient balance
    const hasNumbers = this.tickets.some(t => t.length > 0);
    const hasSufficientBalance = this.hasSufficientBalance();
    const playBtn = this.overlay.querySelector('#playBtn');
    playBtn.disabled = !hasNumbers || !hasSufficientBalance || this.isPlaying;

    // Update play button text based on balance
    if (!this.isPlaying && !this.gameFinished) {
      if (!hasNumbers) {
        playBtn.textContent = 'Select numbers';
      } else if (!hasSufficientBalance) {
        playBtn.textContent = 'Insufficient balance';
      } else {
        playBtn.textContent = 'Start drawing';
      }
    }

    // Update next ticket button state
    const currentFull = this.tickets[this.currentTicket].length >= this.maxNumbersPerTicket;
    this.overlay.querySelector('#nextTicketBtn').disabled = currentFull && this.tickets.every(t => t.length >= this.maxNumbersPerTicket) || this.isPlaying;
  }

  async play() {
    // Validate balance before playing
    const totalBet = this.calculateTotalBet();
    if (totalBet > this.userBalance) {
      this.showToast('Insufficient balance! Please select a lower coin value or fewer numbers.', 'error');
      return;
    }

    if (totalBet === 0) {
      this.showToast('Please select at least one number on a ticket.', 'warning');
      return;
    }

    this.isPlaying = true;

    // Disable controls
    this.overlay.querySelector('#playBtn').disabled = true;
    this.overlay.querySelector('#playBtn').textContent = 'Drawing...';
    this.overlay.querySelector('#nextTicketBtn').disabled = true;
    this.overlay.querySelector('#skipBtn').style.display = 'none';
    this.overlay.querySelectorAll('.number-btn').forEach(btn => btn.classList.add('disabled'));
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => btn.classList.add('disabled'));

    // Show drawn section
    this.overlay.querySelector('#drawnSection').style.display = 'block';

    try {
      // Call backend API with new ticket-based format
      const response = await fetchWithCsrf('/api/games/slot-machine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'slot_minigame',
          tickets: this.tickets,
          coin_value: this.selectedCoinValue
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Use server's drawn numbers and results
        this.drawnNumbers = result.data.drawn_numbers;
        this.serverResults = result.data;

        // Update user balance from server response
        if (result.data.new_balance !== undefined) {
          this.userBalance = result.data.new_balance;
        }

        // Animate drawing with server numbers
        this.animateDraw(0);
      } else {
        throw new Error(result.message || 'Mini-game request failed');
      }
    } catch (error) {
      console.error('[BingoMiniGame] API Error:', error);
      this.showToast('Error: ' + error.message, 'error');

      // Re-enable controls on error
      this.isPlaying = false;
      this.overlay.querySelector('#playBtn').disabled = false;
      this.overlay.querySelector('#playBtn').textContent = 'Start drawing';
      this.overlay.querySelector('#nextTicketBtn').disabled = false;
      this.overlay.querySelector('#skipBtn').style.display = 'inline-block';
      this.overlay.querySelectorAll('.number-btn').forEach(btn => btn.classList.remove('disabled'));
      this.overlay.querySelectorAll('.coin-btn').forEach(btn => btn.classList.remove('disabled'));
      this.overlay.querySelector('#drawnSection').style.display = 'none';
    }
  }

  animateDraw(index) {
    if (index >= this.drawnNumbers.length) {
      this.showResults();
      return;
    }

    const num = this.drawnNumbers[index];
    const container = this.overlay.querySelector('#drawnNumbers');

    // Add drawn number to display
    const numEl = document.createElement('span');
    numEl.className = 'drawn-number';
    numEl.textContent = num;
    container.appendChild(numEl);

    // Mark in grid
    const gridBtn = this.overlay.querySelector(`.number-btn[data-number="${num}"]`);
    if (gridBtn) {
      gridBtn.classList.add('drawn');
      if (gridBtn.classList.contains('selected')) {
        gridBtn.classList.add('matched');
      }
    }

    // Mark matched numbers in tickets
    this.tickets.forEach((ticket, ticketIdx) => {
      if (ticket.includes(num)) {
        const ticketNumEls = this.overlay.querySelectorAll(`#ticketNumbers${ticketIdx} .ticket-number`);
        ticketNumEls.forEach(el => {
          if (parseInt(el.dataset.num) === num) {
            el.classList.add('matched');
          }
        });
      }
    });

    // Continue animation
    setTimeout(() => this.animateDraw(index + 1), 500);
  }

  showResults() {
    this.gameFinished = true;
    let totalWin = 0;

    // Use server results if available (authoritative), fallback to client calculation
    if (this.serverResults && this.serverResults.ticket_results) {
      // Server-provided results (authoritative)
      this.serverResults.ticket_results.forEach((result, i) => {
        if (result.numbers_played === 0) return;

        const ticketWin = result.payout || 0;
        totalWin += ticketWin;

        // Show result on ticket
        const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
        resultEl.textContent = `${result.matches}/${result.numbers_played} = ${ticketWin.toFixed(2)} coins`;
        if (ticketWin > 0) resultEl.classList.add('win');
      });

      // Use server's total payout
      totalWin = this.serverResults.total_payout || totalWin;
    } else {
      // Fallback: Calculate results locally (should not happen with working backend)
      for (let i = 0; i < this.maxTickets; i++) {
        const ticket = this.tickets[i];
        if (ticket.length === 0) continue;

        const played = ticket.length;
        const matched = ticket.filter(n => this.drawnNumbers.includes(n)).length;
        const multiplier = this.payoutTable[played]?.[matched] || 0;
        const betMultiplier = this.betMultipliers[played];
        const ticketWin = multiplier * betMultiplier;

        totalWin += ticketWin;

        // Show result on ticket
        const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
        resultEl.textContent = `${matched}/${played} = ${ticketWin.toFixed(2)} coins`;
        if (ticketWin > 0) resultEl.classList.add('win');
      }
    }

    // Calculate net result
    const totalBet = this.serverResults?.total_bet || this.calculateTotalBet();
    const netResult = totalWin - totalBet;

    // Show result section
    const resultSection = this.overlay.querySelector('#resultSection');
    resultSection.style.display = 'block';

    this.overlay.querySelector('#resultText').innerHTML = `
      Total bet: ${totalBet} coins<br>
      Total payout: ${totalWin} coins<br>
      Net result: <span style="color: ${netResult >= 0 ? '#10b981' : '#ef4444'}">${netResult >= 0 ? '+' : ''}${netResult} coins</span>
    `;
    this.overlay.querySelector('#totalWin').textContent = netResult >= 0 ? `Won: ${netResult} coins` : `Lost: ${Math.abs(netResult)} coins`;

    // Update balance display in mini-game
    const balanceDisplay = this.overlay.querySelector('#balanceDisplay');
    if (balanceDisplay && this.serverResults?.new_balance !== undefined) {
      this.userBalance = this.serverResults.new_balance;
      balanceDisplay.textContent = `${this.userBalance} coins`;
    }

    // Update main slot machine balance display
    if (this.serverResults && this.serverResults.new_balance !== undefined) {
      const balanceEl = document.querySelector('#kreditOkvir') ||
        document.querySelector('.balance-display');
      if (balanceEl) {
        balanceEl.textContent = this.serverResults.new_balance;
      }
    }

    // Set total win for onComplete callback (payout, not net)
    this.totalWin = totalWin;

    // Show collect button, hide play button
    this.overlay.querySelector('#playBtn').style.display = 'none';
    this.overlay.querySelector('#collectBtn').style.display = 'inline-block';

  }

  collect() {
    if (typeof this.overlay.close === 'function' && this.overlay.open) {
      this.overlay.close();
    } else {
      this.overlay.remove();
    }
    if (this.onComplete) {
      this.onComplete(this.totalWin || this.winAmount);
    }
  }

  skip() {
    if (typeof this.overlay.close === 'function' && this.overlay.open) {
      this.overlay.close();
    } else {
      this.overlay.remove();
    }
    if (this.onComplete) {
      this.onComplete(this.winAmount);
    }
  }
}

function createRootScope(rootElement) {
  return {
    getElementById(id) {
      const candidate = rootElement.ownerDocument?.getElementById(id) || null;
      return candidate && rootElement.contains(candidate) ? candidate : null;
    },
    querySelector(selector) {
      return rootElement.querySelector(selector);
    },
    querySelectorAll(selector) {
      return rootElement.querySelectorAll(selector);
    },
    appendChild(node) {
      return rootElement.appendChild(node);
    },
  };
}

export class SlotMachine {
  constructor(rootElement, options = {}) {
    if (!rootElement) {
      throw new Error('SlotMachine root element is required');
    }

    this.rootElement = rootElement;
    this.shadowRoot = createRootScope(rootElement);
    this.initialBalance = Number.parseInt(
      String(options.balance ?? rootElement.dataset?.balance ?? 0),
      10,
    ) || 0;
    this.initialJwtToken = String(options.jwtToken ?? rootElement.dataset?.jwtToken ?? '');

    // State
    this.credits = 0;
    this.bet = 2;
    this.kvote = this.getOddsForGameType(1);
    this.spinsCount = 0;
    this.stopArray = [];
    this.selectedPaylines = [1, 0, 0, 0, 0, 0, 0];
    this.jokerAdded = false;
    this.jokerPosition = 0;
    this.jokerCost = 0;
    this.rewardMode = 2;
    this.gameTypeValue = 1;
    this.progressInterval = null;
    this.isSpinning = false;
    this.activeMenuView = 'game';
    this.historyPage = 1;
    this.historyTotalPages = 1;
    this.historyTotalItems = 0;
    this.historyItems = [];
    this.historyLoading = false;
    this.isMounted = false;
    this.magicOpenAiMode = false;
    this.magicOpenAiPrevView = 'game';
    this.magicOpenAiPrevBodyOverflow = '';
    // Start magic mode facing the user (0deg yaw), then swing left/right.
    this.magicCameraYawRad = 0;
    this.magicCameraPitchRad = -0.08;
    this.magicCameraDepthOffset = -34;
    this.magicSwingAngleRad = 0;
    this.magicSwingAmplitudeRad = (40 * Math.PI) / 180;
    this.magicInitialLeftSwingRad = (20 * Math.PI) / 180;
    this.magicSwingSpeedRadPerSec = 0.3;
    this.magicSwingAnimationFrame = null;
    this.magicSwingStartTime = 0;
    this.magicSwingDebugState = null;
    this.magicLastRenderedSwingRad = null;
    this.magicSwingMotionDirection = 0;
    this.currentSpinDurationMs = 5000;
    this.spinCountdownSeconds = 5;

    this.jwtToken = '';
    this.spinDirections = [-1, -1, -1, -1, -1];
    this.currentRotations = [0, 0, 0, 0, 0];
    this.renderRotations = [0, 0, 0, 0, 0];
    this.reelSpringOffsets = [0, 0, 0, 0, 0];
    this.symbolStrip = this.getSymbolSetForGameType(1);
    this.reelAnimationFrame = null;
    this.jokerSelectionActive = false;
    this.canvas = null;
    this.ctx = null;
    this.webgl = null;
    this.webglProgram = null;
    this.webglVertexBuffer = null;
    this.webglTexture = null;
    this.webglPositionLocation = -1;
    this.webglUvLocation = -1;
    this.webglTextureLocation = null;
    this.webglEnabled = false;
    this.webglBackbufferCanvas = null;
    this.webglTextureWidth = 0;
    this.webglTextureHeight = 0;
    this.maxSpinnerRenderDpr = 1.25;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.reelBorderColor = 'rgba(245, 218, 118, 0.8)';
    this.reelPanelBaseColor = 'rgb(255, 255, 255)';
    this.reelCellFillColor = 'rgba(208, 156, 61, 0.2)';
    this.reelWoodTopColor = 'rgb(188, 129, 67)';
    this.reelWoodMidColor = 'rgb(144, 93, 43)';
    this.reelWoodBottomColor = 'rgb(96, 58, 23)';
    this.cellHalfHeight = 0;
    this.middleRowCenterY = 0;
    this.bottomRowCenterY = 0;
  }

  mount() {
    if (this.isMounted) return;
    this.isMounted = true;

    this.credits = this.initialBalance;
    this.jwtToken = this.initialJwtToken;

    // Additional state for joker/lines
    this.validJokerPositions = new Array(15).fill(0);
    this.jokerAffectedLines = [];
    this.jokerCanvasX = 0;
    this.jokerCanvasY = 0;
    this.jokerImageLoaded = false;
    this.img = new Image();
    // Preload joker image so it's ready when user clicks
    this.img.onload = () => { this.jokerImageLoaded = true; };
    this.img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKIAAACiCAMAAAD1LOYpAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAALNUExURUdwTP/fIP3bIv3cIv7fH//hHvzbIv3bIv7dIf/gH/3cIf/hHv/fHP/jH/3cIf/hH/zbIv7dIf7cIf/gH//gH/3cIQAAAQYFCR0VFSMXFRoRDyobFi8gGAoJDRAOEsa1nQYDA/fq4S0kJEIzKikfHjorIzIkHNK7ocq5oBUTFz0vJhQLCfbl2k49LjIoKzUnIdHApufWySEVDu/Xx+rZzSQaGkc5LxwYHfju58y8pltLPc62naOLcdm9ppd8YmJQQNnMvZ2Eas/BsA0HBvTh1GRUR66Yf9THt1pHNd3QwqiSev/gHHtqV+PVw+jLtkg3Ke/ez1JDNL2pkVVFOmtbSsmymCIcIk0+NaF+ZaiEaeTGrzsvMI10W8StlOfNvN3ArvzbI4dmTvDj24RsV3VlU66Jburc08GwmUMxIL+Ye/Hazdm2muXa039jS+7f1pVzW72ki8ajiN+7oCUhKfr18HBhTc+rkMzDulc/L8Geg512XYJyYLeagq6PdIt6Y8e2qDkqGuPBprahiO3Swt/PunNXQ7eTeY9sVGxNOnhdS0A2OJJ/aWpWQLWkkce8sObRw6+diu7RvMCyosioj9avk5iHdObh29bFrM3IxOfWut/Ht9Kxms2liYt8dLipm2RGMfPUI+3JrtvMsqiUiJ6NfOvbw//pIWJGPYFya2JTUkk+PuHWz/39/Jx9dbiNb6d+YffZN5F1a0tNVFxLSVFEQquHffjbwn9aQ25RSnNjXnhpaHBxdiktNoBiWpOIhottYsupoNS2q4aOlVI4JOrLLaybmXJXUzU7RcqgfGZeXZ2JTb2clHp9gvLWUKCtt5WYnf3rz7KwtNTT0eXUqezo5syxIq/BzcWsQV9lbNbg58C/wbWdVuXIIpOgq9i7OcDT3tu+IFZYYfDZc+7Zk11PFdy/VJJ+O6qTJde+cradNHNfLJqEG35sGNrCiv/oLsn1uUoAAAAWdFJOUwCoGjuHuwUreJhttPbpSeANZFLRx1vpWQcXAAA0RElEQVR42uyXXU/beBrFpy0MoZQCbSfkxXSjODZbW45LQlyNgRqaNTLExeOxiyFlgShON0BTCiOz0NAoDG9tMQNMYEcKpc3OVFm6laAV0o6mN3sxXHS5R1wQVdWqQ7d0NZ9h/+nufgGGtnPBubJ8k5/OOc/zOB99dKADHehABzrQgfasw3lHTpQYcnLygXJyDCUnjuQd/nURFr8FzD9UkJubW1BwKP8t5Me/FrqP80oM+QVpn68zlcqsZ168eJHJZFKdvnS6AIDmfXC+vJL83CJAt7659WpneyNQN35bDw9y8ZcbW683M4CzqCD/kw+Y+BEDwOvMPN/a2GgLqphzefnpU/Yfit1utxnXHnDC9xs7bzlPFhz9IGbmGXILO9cBXmBq6eHaD8ssgvILKs2rIkZiFps0LVpYWSFkfefV5npnYUHJe/ay+Pihws7HP21vVMeeLEejmsirMInQPM1O8QpKUmYjPLvs4nQOZiWJCEe2s5SHjhS/vwVTcsqX2vx32+ef1k/xswsyr1K0ZEEoWKSjMQ2YSKI4+t3XCEpzAs0MCnGNp3Zfb6bSuSfej5WHDUW+1E/bGE6o96bbIrNTsqZhccWBkJSsyqxGwYiVwsjv7sUhUQwT+iAhqJqgS+LLN6n0qfcwO4dzitKPt3aePuBxlOB0PqrKMsdKsII6rEpUJWGNISGSZqw/TCs4LAoQE4RhVec4Tjhduvsmkz514h0TfnLSl3kTiU1pfCNmQ8MEq9ESLSgKRcMYQkRVGFFoDMMkFqIW1oxmDsaRKUbQdJEUCZfFif/4OuXLPf4up7jAl9o6T8OiOsXXxcyueFyhaVEQMIoSWYmiZZmmrKCXJM1iNK94LSLshdp48B42C7TVPAjZQSlTxw69q7SLDYWdz3f4B41TssAF22IahUBmTKcRGLNKTFSjZIpiWAvMYBAtU6wqWXBBtGG8qjMyZRZFCBoUKIridjd9RSXv5Djm5foyO6o8zseq6xeYMBMMygRqseq0GaFwjF+KUoyCSTJC0maryCisJposKIujmqbrmojRBBnHYAKmCJQAlXwXRh491vm8WlXBEtT1tunZaDgsaxzpggnR7KIcDjrGWiUWhQGmiFgVQpRZxWFBVbNH0xg+KCqMJMRdLgFCRJiRAs99J/e7kcX5vsf/ejA7u9A4XfunP05/Xn/hKw6S2TgkIBRqQkwO0ECbR1PMCkVhNInRUbDGKRxRYS9zW4/xgqzLGoNAYGGKhMgts69+Tufsb8infM8ja3Kw8cvG+q8vNDRcmG785rdimI2jIkIiJjvuNePUHRvF2hwUCUsYSi8/uc2rRFynXfeB6xFOi4SuV1UTEA4jGMzy8tPdF/sadklh5z+/Wr6tEz+C/UYMcrSmgbtBEwTmEhDc7LXDVosRx1AracIEmOEGGV2eam0NBBgxGPj+vh6oqx6v7h9YTFSrLOfCaFVjpIf1IOx9+7ow+FIb9xounP3Dg2B2CWt6HLKaXV6vJ0xAKGzz4pCoUB4jxAyGxyP3b/f29oZu1g0nFkOrk3prV++t8cmJvpuJxaGbE4kvG+sYhpFFlKteevgqVXh8vwjXt5eivKxFeVVlWJXnZYIKo4gDdxEihFhKMSF7nolbkcBkqPVG743V1on5/pqmppqBoa6+REvvjZauRE9PYmh4Yvj64qX6RgaKSzIv0dL2z8eO7gdhTnp9Q43Ggkw4DFtxKxqPkyQCCx6cDEMogYE3FAdOYSQQ6A2FVromboZCQ4v+pvbR9ib/yEh5Yhi8mOhb7EkkEn3XE1Udc5/GdBEiMEogH26k0vvAaEi/iPBRTeNVmmHiVqvLYoUVLE7iRqMZTChsNlOD+nhgcnKyZWKob2io7+7dnrnfdbu7u0fb/d921FT9/vrw8FBisaq8vKq8pqbG3578m18WYKPJ5PU6dveB0eB7HKAYGfRHpjmW4QgEtZod1GAYPW00njaZrHEXMRnobWlZbV15dne+Z2BgvqfJ7a6s7K7sdgPGb5Nnf1N16VJ5TXlNR0dHMjmW9Pvn/PXnVcpicqJk88vML2U0pDNtSzFdBlVkaYkBu42jJcyEQxhyurTsjMlsjQtgPlpCodaVrmcDPSN+v79pbnTU3V0JVDEzlqwdO1tVk8X7JlmbTCZn2kFH+//sjzm8ZWU4XmoMr6dLftFJ8a1P0losFpQlCsNgcGEVWmYZFrPazwET7ViYoCMg4lBrtobP5kdGQAkBIWB0f1ZZUTHTkKxtSHZ0+JP/1czM6Gh7u79/ZG7KaffavF7v6TO7qWNH9k54/Nj6xt/PqyJMWs1mC26xeHGP886dy7Dy18ueUtsZOxgbPRCYvBECQ7Ky0pVF/D8hyLriYkNtbW3DDEBtbx8bGwNPbvDU3jTS09N/nbXgZrsJL7W9zBTteT/mFaU2wEXhAZnFbLIAQqOxtKzsTLPH0dzcfO6cHSEx4S/jkcnelomJVWAjyBmk7P4fY8XFGYDY0FBRkY18ZqZhZsbtHm1qyiIO9A+RRltpqdfiIZ07vlN7/FdTfNK3DbrHMIQiYBiJOhwo6nA6m5vtTueZsuYv7CRKCgR3a7y3pXViZXV15W7/25zn5txgnrvdAOot35UrV0DmF7Oko1lG0MaR+fm7ssfppB6qfPQJ/9p3aG8fZ/m+raVghJf14LiEkBSGKBLNgqEBSTu/aG52XgbdJETifqS3FZh4Y3Vlvn8E/H7WwO7Psk282PDo0dWrV65du3bl6qNHALXSnRUwEjAOjNTDOKowjCQq0mbasKfD7FtfmGqprq+uG9ZcLo/HCSswCSvS2tqd/3Bmvj9p5VkYT5u0M5Pp/si2217QGuFebESAVABcihAqsAZvEQorPweBC1aqYimFCAg72BGr1KitmGy1jrO1rbM72zax2Rk3bl81naavm/jCpJnsZifp/hX7fK+z3ZfqXiOaGJMPzznnOc8Jir7WVkYc1HrlcvnYl9/CERMEceU66rwAvqt783yJEA4TQvXwn4cHBlJOp/OqSk0Yv+pcrlSmlVTz53JtrzY49sOj/2NkPjrxbOKF2Ww22C6zAgGukSDqGwzOfD8zM7OdOduE33EP9MrHbk1GfYknT0cLPOJNldNpsYAFiHsaxmKpPcBUymKJpVJO0qXhfrTjZ8XnCgWN8kj6/h05eeh2/OWxyO6LdWPIWDLLhfJsnLUyYkVme3s705f5Hq/biqC4oUWqdY3dgor+kr8AxKHKgioVk8VkRLgPhEtLw0TMmEyGv8hEMvXDh+eBuPy7C4ZXf9t6FY97svGtnZ5Pjh96q+xs1OuhkJkbG4uH4h5pu1Rx5kyrLtPXmtnOZDIKMdXV3KZ0u8a+HCn4E34/xuX14vXAgspp4REHCBffhzzh8EDMQggtFov65s0FTHUun0+GyvX1+dk7v78y++BlzyGv149+9tKIfzeGQtNcjUV4ahmUtJ4529QHuowOQy0WYw/SLuTHW1FEGzxPnyRXhgIOx4LKIgMX0Y5UF6hQE9WOETy+B+BKiBi5ZDU/qrey6/Orq/Vi8U3k1KES7vFPI7sb5XrdaDTbbDiVBz9v0TU16XhAgoe2lNC0hJbLH3c/5njEQsFXgncTRLVTPQzEJaIhKg7CpZgotichQUTIWAhUrq9UE75pq4ctF1mcYOxOz5HDIP6q5125WKzVQuaErexxDQ4qm1BlECoyaEmxIqhQMkwjgwHXP+6eNj5NIL1GuUISlX7o5KlAmIqRRhzg+zD2VkQe2QdGbMGhpP+p22V10fRYfH3+Qe3liUMsmaOn1t4Uy+VaDSqaa7VpOXUGmSED7RTwbqKholGj0bQLJC7TLVi3HxNdmIpOVXNDgT+cR/PxGqK4Kb7iS2/fdnTc6OjoACMgnVedKtKMi/lkdbCLdrU3mEzKmfvru5FPD2OJO0WOq9XrZhR6wuhhTpNByaDADERUMAwWjESpEQiULtPtSYyLv5p8WsBcp4cq/X+8NLw0PLAEQKyVgWHwEUD+IYwgRJRccNwLLObT6dG2ZnmjpBjXNrd7yu96DnwnHP3FmuF+mautr5vN9gmDSXj6bKtOp9MwYvh1UMxgFWK1SJRiqsVlmpwe8fn9T/LJRKmaTOau99/7guw61BYLBowE8e0eIGSU7SGqUOjAUBrx93azdbPLVM5a5d1f/7h27PjBDed+rV4rm+sGiKhvPk21CgUaRgMJg5BQGQwSE5dKFEy73OQZgS0mnrzOreST48n0cj9PqEY1Yd5qbL1UTNTBP+jFDr7OIFSrHP2dubu5pDleXN0arNfjbHyruPPogDIeheEUQ6GQEYUev5AFIcNIxBrsPCIhDyjWMEple5eQ7nZ/xyFFJJIri7m7+Xz+bq7zi0vEbCzEvOfmLp1XO2NA6xD99EBFDAvZ1IHO5VylOsl62CvleLGIsd7YjRw7aNLe+TsXjUaNKLS9yHRJtOKZ4NmzOtKFpNAaikLJNYzg9GnczLe5UYxLFUdBejyfzuXO3bsEs8GmG1AjG85BT4sMjP9DtDj5tBZ2dFby40PdXUGl9S+0/rHc49IX3/UcaFUfPfFyqmjkQkbz+ryNbWkwFfWK1madgsBJtAoNJRT0ZYBJCai2Brkep98occVEMl8tjUPFwHlsFz5/hckdqIbHiD482H9ERLJf7nVWhowhVikICjc2m55Lpe7ezd3IgVLZzx+9t4bg2Db7+oPZ9fg0a5IKhOKgVCrW0FpGSFHoSiF+tAmUGorWW6dJM45Gp3ylkr96F0lClXIiHaLM/cvnznU6ziNWECGJlPxIIweRRIZeTJeycY9QGdx8cUajpz0er+ddz0G88cjaj/Gp0LWLlw32eXDW9LQ0KFVKgmKx18sIhRoQIoFTTENDo6Dd63Z5RriCbzQ6PZqoJvM5JMY5ErHVqaWBuf5zyxdwlfJKWmQEkww1PzDhQOeFXCJaZNnetj9pN7YEXrnXY9p8H/n4ICHsB47Ljph/89t5s91usNetuKsktJaWuvVioVCnE+BGoAQMblUBE3R56e5JjpyAo9HESi4HEcM4VeYQIOCMzkDFgZqqeB1lJOWQ7z1EzHO6NGnysPGGRnfL/a0ZrxSXsOHZqf0r/XHkfZHLZkdCExfv2A0Gu62ul3itLq3XZFVQQl0fRR4BA9/GBpTKvY0SU7TgT+ZLI8Y0Tzg3MEyOATLJskBFBSfk6X7aLURPNe6Ghc50tWSrW93ZoqnxeZPw61fPlbRJv/Gv/QPP8WNrIZabCrEjUfvFK2C0TdQ8eq/b48lKKQqEQnwBUKMRK5QtjVpkoO6RkA+u7YuWcB+jzEg46jmYTUokC19XQTaR6L++yC9A3nTClbS/dK0ez1rjbLebaaY2XwVbXHr5m8gn+36udwIBgoUrhqK+y/NERkONY8uwVjek07UK+XlhEHj6GImWpuV0I40bECdqvjCa+8pxLxwmB1/YoYrBD1VDDl4/sgE79lhFMYIYdiBEVO0mfdZEPqwRU4zQY1VK9dnay5NH963zbojj2CzLcaFrl3EXGAzrtonLeLstLWJdEyGkcKH2wRdh4jRNaxsaH8N2yLE/VUg7HJ39YUzL3NDiAubXsrx8lafbYwQkeXHyQSdfMpS75VraHbdatV1MU5C1anvZ1X9Efr0P4rG1N1CQi8dDBmQIgwFbenZ2dqLGahulTFMTRbViXVMCAeqMyIPQKG1o7I4WcL0k875vR/O5lcVlQDrDT17/9cYNUWXFIboh48k6iI6WvevAoiJBx1xmb3dLWtyb+s02lMZUjPfqV/8ZObJfgnhnNCJrlzmj3WY2Gm02MM6vThisDVKtDoRNrTpA9vWh0LAfiVSpbJB0T09NJXKV/s98k9O+anplMTBnEU1M9X/zTUfneL/sRnhZRbqQXy28QcaQxipDdxM+H2t1t+D4/U6qoTQmrn6bvXPu2cnj+8UwZEQIWMNlZTTY7TYcqYb5a//hy1p/0srTcLrT3bbTnb1MstwURA7QHhBoRcEQVBA96NHFFlgQD4oWb5RRAdUpCjjgHYrFW63a6ihtVGprjS5qE6um1diaJpPtfGvSDzPZZL/s/7DvcTMf9RdyAgkJD+/7Ppf3nEmEYyBQlIZC9GYBTBPKgv/N56XS+fxyRf9Wl2sm6+f2Bl9zq9s5AalRmtPTPCBdXbVZcjPabWuejJz/Z25yMnNIiL2VTqf3pX+YbzDzYT9XZDP4xo6AMk114+M356v3hZpjHIqHwyVgteJ6TOmLKfMwfQSRKSQwhygMIqwIKMpCgdMSCT0zVSC6b69w5fY1pOesFrotDk/u7IRHl36zuXYiY/VBfWdGu6rWIYWM0wLkhgWhpSWjJesWOY2QaSuQVLNEpJDli4X8IqPxep+24D+lX58vOe8sODhKIAIbtDrPqvZhmA97irvUCkW+BOYQki2QBg5Qm5HN52YyJIr8YXueLzf3WuXC6Ghw3Ds7Y/MEdYXJ/vnjZI70+Hi0vWHwpU5K1g/g3dXZpip10w+qH/TaZmEm6lIkCFKEGAwa4e3u+M3n2pH/nj+Ml/78RU32l6QJXKHZeAhTYrhPXRcxciA2onKx+LSKpMPQU+gMuiwfUq19b329dmnY4hgYAA8M5np0SedQ/0vPT6PHDk/hXbslWEnec5qWJoMT4173RHBhVFddPevuXPCWZ/IVRvOGMZMuCjy78y9twY1X596E+mvpv3E/MFmtxHw+ZUDtB+mO4koYyBiWz6exQLs5JphDFEyGS64vKYjIkK9QGAgOETaxaIKiOjswx+lxeurv1Xa9DHq6uo4XkvbBiXGI2F6vz9oxXCwSiebVwaRuBnKEc8GekmK4bV4uM4sM3S0PVdqCqfOH8XLp53USoNoawfQwj2rcn4elzWF4rArrMGez5HITF1YEIA0D/I/D55DPUBOEuE0shu1azmSyaECgZkuFpaJ/qLZ2cG2gYmjreEE9/9Ky1jUs43FBWOFLKFfS5E9C1pmdTbp/SJWVc3fKihT3ow0qLZxfzh3GKzUfygJlzUq/WhmxRshWw1t/z0jM74pGjASL3KVBF6HTUEQBIuGZw5DBycMB3CyURaVQhMIUXlPx2/Lh/qX5obWgf752wntvy17MZQE4OcqEPaiNkCFN1lGdzZY7mhQJDTx6oii/qE47fQ0QPvq19Oy085dL37z7EIiA//kxdVm3GiiNYSGX0q8fieKheJkMpcqBLKTyoPQUnhkRmAmoq8kEXQ6LT8sLVGdpKBQKWyPkI0vNg47CDN/bLcf9TAYskSiVTYUXm0Jh0sLIW4dOV2mT/mSnyPhcgicqqkubniIhfqo58+ngH373p9IvedZWqJxPSe5/kYA1EqqqasTqGx+O4KGAwUSREygLthjwF75Zhpg5GioNNZFVbDOJEwSUiAkANRoGQ8Om/NDl7hxtX13FM5uaABZ5UFp45/XKRgI8GRH1e+5WV95s1zMQCR3JRPLxvr5FrVb16NOrsxfBS9+WfrHa1RaLH1QHtCcQmAS6+FyNjX7XdyN6vCibahKDZNMg76TIZAKzhE2B3onbUBbTlHj95s2Tnc2wmFe0a8/PZAPEtcfBdHC9ZEUTT8AzryQSmzsvDm02W7Vt7ulO8VDzQCUky/YphYwrRBiIUXVrsQ8gqqY+/vGrs6LEV+AtEZLP6u5ICH+K45OTeCjkw/QFPUoMBtLIpZpMTLBoyN08hFfOY0DjWKDlJnF45fWT+GH88PCwp+DaRKddQNdoUlodlRntdx4EJ+q5SN7u/snJga6wt3JUKk0mR21V6/NbTumtrHRtnYKjQcoVkZLTPmu1ix9L/3YWp7+FmDNpLQuAuYDO4Hg8BpdoWjSqT9M2YmnROg6VI2dC1CFjDk8goKGAECYQeryxsrMcn+tRaXtief2i/rIORWomr9bhzMpJ7519XC/kdw52nRztHiQXnOPu8XHyARKWP+yR3mz5OatMIWObm43Rxb7FRW0BlPGXmstn7dNfX6z5vG7tzvMHOiaj0XgsGsdCISxUpdeH9KqxaFogm0WgVBTMmQZrNMJFTUwKCnmiDSBu7LyA7y8rDPeWzASRTdNo6IJaR+dMenrvhNObyd623iPaWNztvfXd7aPtDYUZsuGQO3mz4eHdMkRBSdj7p6ZPR1GlKvm15uJZT4suX3n1ubvMDoLdEYhFY/FoDMf0jdGYq6oxhFWNabuFcoJFReVcrpwrEfBQUiBR8n4egQgQw0aC4GZvxnsOl9+8WFkhhHT6sOOxLSOn99i5MCw8JQtp76BMQiZ8QIy1rZ2jEIB1HfT8FM6S+tkpW7SqxZJPr66cJTsXL/z4oa4uL8+Ou3zxOB6PknuBvnFszOuuCvnSHq0IaSaAxCU4JMQ2FokQ+ixnMankkYs54nCYQ0U5Gzvx16mpwiGLN7chp9DtADeUCDUaym+HJU/s7u0q9/cPbLbK3G4NH0nt/8ezvsUZUrpnAOKFs2Tn4tUf69cjgYAyMBmdi05ORvX4JOwuY9+P6L0u1/WxsJCBmsJicRggijng07DwowAPfpTKAs9gkT/Peb98tLS3TBAM4VDrgDPrzp1ra7lJR9dusXlzI9zWBn8jkdj1rW//c+bg4MCTG3RHOBQJf/gGWUXwv74+gHj1LIhXrr7zP1UH1HhHNwxhKBadgzAG4t1YUNDo0qcVbGo0TA6INAGyJskWysMCAY9LZ7ApoHpsNhVEk0i8f7J8tH5ysskJM+nFrY7ZBw0NtrVxaaXbMth8dLQDZ0VhPtrfH9orzKmeOZh1erytRRrIS9dv9ZWQfFb9/TlAPGvHugJRrDsQUSqNkVAMi82NRUm6QKBwpT16VFVVsqJhszkwcYRYDozRiN8bbhd1FKdq2EwoJtlmIryxvbT9Yv/7J0RCLOYJBh2z1d8919X7e6XSa/UV60fbS0vbu3svbOknWwWrOTerwaSdjuLboIqK2LPpEhU0WlXyfPrV78+BWN8dAHuOhKLRuVBs7H+Em91PYukdxy/atN3ORbMXewbAFURQBBUQZWAQRXzFHZTBMCoKrEfhCOh4QKqiB3FEFfFdcdhR1KIa6ogzYxzUNTFCnJppSJNN6l3vmjTZm/4P/R27t8Mm54LLT35vz/f7ex50jXU4TpCMXLVKp/wRYlX8lsXmdYDQofElPZXPe7Z7ivh85oujo2Dw7KOkNTZL+JZNJ2exj8UtAgFMHXNfn2m9XWyvkW561olEIpFOpkRS001CGr9HRSAkIl6OoJbDq2x882YKEMN7UxkRH32y7IM+HB+vA0RsZ2cRxg2OT5JJN8qwzW3IJxQiRLGMks3n82qfFvVsj401lyCPj063909vTvbTS2hO/c3l3d3bYCWV1z/jMB8fTzlmDDmoNEfh2TKvgotGpaKEdzkHvb9/uQkGZiD3bW1r7gLjgfCXKH4x0b999OldI+iGqp6NlZUd3ZoPEm3Uw1gE0kkGd3O/GqlmdbDYxYMUUCyPqQ1PW/98sDE2N0JH2NfXO8NpX339cH3qphJmX+tdQ0nuxbuQ4rhvSmEbOreDezFWpVObInth/UnCVCMqtaLo5pCtrauoAxpp41CkhKEIhOrjDO0CQ+fzykZVI1mB+2SiuXgjyAiSEdPpGHs6KkJjkdv4wSfsJyBbJM+bazcObubmpptprbHbk+TfTk6up0+h2K5jZ929VE6/bcjQ93rZ7LRF7dqcOIpDmtPY/hjhF4u0pcsikXmLGL1ozeO11K5oNWqSUa0m2+WLQ+cPX/3lX/v4ZPn4AYYtwgeJ5urA5wMjhjGwMCMPKSEvXViDFBaLUo1kjRRVPpvvnO3vapvOuh253Q3EbkdO9m/2Ty9jP57RKbxRz1DT6/tlQ6g89JO20B0vTA0pkun9HXEOir4kN6TmfM9o/1NBbu3YvuoXRI3oOMPo/hoOwIM6HFucP1jEGGtQi411eiM+iQMjw4cJwxKEBgORVfaigM2iZiP85oan4AQG2qos7y2zFxeB3f6KteTNSfI0dnk1WEArsjgdptf3IoOrynsO9srtrolG/WK7Hb13u60isd+0uUW0V3XzOGN6mUz98ARArSntgwPwmwwy4oBckOA6bGcNw3Z0+GSdTi7X4RBGBsadqmSSiOyywQI2m0rJZtJHGiqnuwa8OG5Zb7KklAmvwXx6nU4m7q6PCijUkfaIy9T32trk8HZGf9LWSN3S1SgQviQ3E6i9dHnTrCC83k5O3kpNODxFIkIU+0r//f0fvyQjfvPNd/+pm68Cf6/jLvl2FjGIHvnJMYxk5B72MCmQYnoZ6AEWlULhV+eNxBb6Z9vWzXqvNaWKqxNE+d1pKpm4uQs+mZhYaI8oTKI+q9/hLB86b1qVxqVNUftLFCXvEFDQs3D8GWfqnnEkK6X5e1MPhGqR9TCDGCMlbR1oh8ZJ3Q7m8y0uGvPzAdCI+WTYA+JYNZVWxi57MfhtmYBNpVL5/ImGQOBi1KNQzCjdSfSemJ2LJUypxPUZK9hMn7Z4HGbl8rHJEVHMfI5G0bh71eUnDT9amIP6X7lA3sqdxDPJgnyToYEoqiHPor7DDJIWjMGnqkYjtlKO+zBsjatb1OWH9Uaub2mJZORqtqkPW27WIEIRCKiUsrJqJmdkNzBr8STTqfhx0u+9CEynReb2uyDr7C1td9Ti1KfMm4aQ1yS/sL2yx+NiV1RLbsy0WrHBFXIoFAr55Ljk2uUQah5i+P9uefS7DPbqw1BjeSOO49gaA2MwGMRK/p6MofphGH6vMaZ2BHRq9eOC4icILY9D4VNYfKSkmbyQfg/T5FiajHQFLmdTqDlxxCo+OqP3XrQRuFG/tWXzCs8rdtujgBhyNdVIc7R2f9MrR2Roa0svnzxpqbR8Dmtgbqs1kOjjDPbqwaT+N4nXlRN6AOICVr7cqA+H639Qco0yHxZWPi+hVyPfFhcgtCwOSH82BeELbkcC/aNtibTZqhgNxC7bUtJl4qyg4+ojn77b32abITyfLXMzq4qFrhC0tCMU9aOFgGhwRD6HttadxpX5sYXb2TAZRaVGIxL1ZTKppNX/OW2U64k6jLvmYzC4MqFQrhcq1fXA6+PKNOP0EiaSzYIosnOptBKoxmraRNFuoOt94sSjIC52Y9eJpFWbbEWCfw0izKyGuYHRtnfve/nt56+mB1zSeGE05Ir6a8T+VVfEGRkaWncSjePzxO7FsoY8WDQisqG/+zrzwgQGjF6hN2Ikokoly1cIw8NqpQwY17iHKxBEZgGrAGHzJCVUXh6d5MyDchx91z5q6QoEYjeJZKk42YG8vToDpc1uqZ2e3i1BnjvO627fg2OVroZcr6JicZMr5IwAotPjrZqvcBh0qodmEWlEVs0/Mj5++v2fPhH4+rpRT0ZNJlSpVEKhsB6Epoqr9/kYmjUeePhsVjYSrJXQ6Dwe1GYZnXzJ32Vpn53dHZm7vE5soTlpDhK8ugoymQUdtZWVgmqeLaqfW5gRu91uu8PhMqz6DaF1EtHpmQF9Wh6W4pjmIc/Q0G8+ZL5PffTBSXhAOpD9wuWqhpdUYZVKWS+TCSHzxillEbMkizJIQYLPWmnU3F6eIItOzyrJ6m0YGJgO3PZOz13MuKzxVAuSfbT9dza7+Gl3f/eG1xkiOivWI344X3Ki5Ou8JkizcyhCEs6Pd1aJ1OV75ODWlALiP39lk/zV9z/jhAfXyyHRMow7PKyCUIahJGVcLpzSmlqEmguHNFL8rIVGa5bkPiySJ+hZE4HOudve20DXrM0liktPBMzsj1dnrS035W1tnpBrvaLKtBqKopBpcTRqcG1FPDYnENosFZ3d/RVmvY6UYnvqvtJSK5wtmf/mAMWIO2FUMHy+JZlM9YAolIXrhQyGDMMO5xGqREBnZ7N7Wml8XlGzhMPh5OVysvKa57pvJ0agb2wKazyeGr3k5TU3NHQTxMCAx4PL5Smt1N6kdcdz7KtRw/8ot/qntNIrPLudpDPdzPQjHeR+CCiBi1DCDasavBEjxAWTRcT1RlBYRZeoYxDURpBqJVn5MoYkmC2gUVKy1MRstgl14646pNHJmO3Exsa243Ym09rtx3Sm27+h5zWdtj+t5irjTw7PPOec5zznvue9Pgj8DQe7gsPqdqfTqZ7oogEhTC3FdZCKu7xIfv3b6xPuwQnwDrGRqEYFH0hGKg7pSEN61icv5WFykRhsREMpDu1PLpeLhNJSuV/sNzln/d4Fu6+rpe23Rys+drS3B1bDb3W7nfaB7qmWyZbJth8W/AACDSz2IYDDFsewxWINRNqdrmAXatA1kIl1Z5L3vr/LocYbN57Uu90gPLHoiEYT9Xgk3RRFg9ekVSp+PT1ayC0lRYV53F8041qlXA8/xsbSRrnQL9KPG70BgEjVTE72OhxOuzoVsLX8MrDQ11RR29TX19J2FDrzias/PX+tN+iwVJmHIcrjeidka7B3dBRJDtoH+LJ1t635b7X+9QJL1bttqihQqElobLZuitbpaEqlknTUJ3+ElypJIo8314znQfeT6yvlO49RhEm9+rDz4+tTUAlmi6M9FQm3t7QMpVKWgYmppqaKqaaetjev1p4HiEGzuUptcYBV7KxsDwXOTTDHX5IIz58P7LZ88M0D6xeCtjjrdvM1USBRxUgoht4RHyiZ+jhfJJUpSayouZnL4+ByuQktyRuNRqFIJlCgt10tLVO9lgXfJ9bU+PjdR0FXKJz6+RNLEB1rvV/bfa27Dxqf2apWmx0up77T+3a7VV8ej6fTo0i4i+sy93bfb3ujdeDCsJuqsNWrdB7wDwCPYXQ6hBGykcm8jQtkJIEfPoxGA0Un0FgOCI0iMcHRrqYWhqnLxZOWlOtYSK+PDDl8VMHk1JGCJt9gU+bE1b6Ba319165bwAWbzdaIvlPuDNld3khPmh41GMDNFtftHuedSHfYgkMszXR4Eh6NCgikKE2NDkikGD4/Wa/kCDAC7weIPI5SLCqvrjYZhdBoCK1A6A2rBx8ZJl0pV1VELo8M904VfPQRTAQnnvgq2tpq+87X1vY9MdutarPPHjBJ5QFXyGpNqXsMNLBoyED7W2/dfcnk9QP3Jlhmwl3PqjyJREIT3YHooSvi8FfSEU+WcgSyQ7widLaRryWIxnPVeqNUgckwHFw4GDPw4OGU9X55pzw1pDn2ycP7d6sg8XxMwZmm8+++39flgyi77AH4J28k5AuF7GFXlyqdhjhnDDWb9/ayYwLqXT9A0Xw3q0kkPAmdiumu0OmoKYqmNSo+m/mAI9DyBJzTZfl5+fm4kqxuMBlFJCbDweGKw3afedic0t9aLDXOhiOzJFlySFjaaZz99NLRE+9CZ3a4qsxqZ6XR3yk0RUJqtdW+oF9N2ZJpiLPBcPbrTwv+Ox6cWmdtLK2hbbE/aDTQXyiW0uniFEMd90j4tnhmfuftVhl6/8nDMVxUWWkUESVcmQzHMWPApQ4trM5Pf35Y+OObkVm0ytXfz+M1j+WO1l2uHfSpgw51RKgkpPrxSLvPrA45wyTvVhJVSyZpSK4f2MuG4P59rV9p+DAMMNFETAVVraEkGkhFUB3QHUnHJsKoPSflcPK4AIpQCstNIjEu0wq06JsjTmd49fb0/GHhhzU3z83xipaz2WXe6blcW3HT+SHzQK8vICX9pgDanTGjiJNGVV06nTQYMqN3vmzd2y7o907942ZSFQMvlohGQRtBtcGUUTTFMBLAKEk+uHnr5FcmDkfAxbgEiRFCk1GBo2V8GSYC+Q506qenx/rfufueXzx2+PTy9lZ2+XTh4k+OdA8MDnQPPSyVN7zXbrWqLRZUNF7ZxQ2DLj16pBh0cX2Pi/L7D/6pczpjiAGFCQ/yOoyElrAMRBrwSVQUu7mxkdy8CCxiJRhJkoTCKJeSOLcIYZQavQpZeS43ny966BUVli0Di1vba6f7s4nJAXbi2oDbOm5VV4Euov2jUCBFYh2Z4zVpEJzM2V2Py/9H48/+WXZLU6yLRaGmQXcYiqIYFj4gjBIJ6CNAztAyjgAvKUEQSWmpUIxhMLQKBDgplgmaFx8vcmQPZ6YPccqW19ay29vZ5rHHM9BYWwaGLlY51MccIIxqV2ghbJQ1pjM1SBQzZ4rX93zb4DsHb8h5hdM1o9BdQHZGJBQdRygZFhDyVXHkzOIPUEZiBClWkKRfKCUJTMbF0QmQDOPw5nK5fG37ldtl+UXLa1nAuJQdy81cabjy5tTQSXfw2PAxs8UMeRhI+bWf1SVRMSeTZ/ZOIqLx7/1F+WOxOx4A6dHRLKWhqAqGBecNKOk4TfPZjRxEGgeIgFEsBYgkxkVnVgJCxBGM5abzOZ2uxTEEcS2bzUI+5mKLyg96KkBxB4fARZp9wGFYrpR9+CCN7LYhk1x/hSsb+/fd+MtcP2eu7bkHPUiz0Z0fYDHW8RKixJbUoDs5JYRYoVD4RSKASChxnlZGyo0wsyzdzucIPp3J5vGW15bXIBmzW08/GyvMnX3E8G29QbML9ZfwuNcvUHYk46PgcMBAtL7Kvu83Tv2ueW3pluo55CK4WpWOhijDxGrrGEEQKY2KpTZuo+NGEtGoACYJFGoZTggr3yEEnLKdV/Nz/aCKa2tr20tLW1tL29n53PEojEBDZrvT5YNJwusnBI3JzTRwWAxG8dXulLzW+rdnBUdGEs+hT0ugT1cwiEQbmHE+K9kZEyQbV9DxBAEY4dcvhiGGUGKkorza1KjUCrgwI/qVnPyyfkjG7ae/+fXTlZWl7WeekZGR2Ek72EQgUS/CcO3Fjc1Rw6jhSM/eGsv/deqD9y487ok9nTkLJY1m1Z1qYVnbf2p6RMImkyVIGsWAECAiFgmMEHc2VMtNpEw8HvFNdIUO5fF2MC69+OPvV1aeLgFEfmzmLXXAm7KDJJIymbJjIw3TswEEZ98r3jL47qn16OKh5fnHdyAZNRKGqgAWWb6NBQJpGBhUbHoDdUJeoXiHRkQigmhsONdQTnJLTWHz5Ue+Wd5LHrdefPHFi5VnK8+iM5dmwM9fuR8JByJyTKlcTWcAYjGMpq98vWn/a//6FW/s87n5aM2/2znbn7TSLIBj1fqu7rTL2wXunUWBSlxcsrQiccxImLSDs8Yia9JZMzROFj50Mh+mE8yaLH7obGyzSwwTFXeDSwqLoCUZGLUKFStd2qEiCFMViKx01hnd6uzfMOe5MJP5OlbbTuJRCfHTL+ec57zc+5wDNSMfRW5QIxhaKkAtgsHI56/9GfmbBHkj/CFflGCY6uMBS5e4XsXSvd3cPtSv+ujcBfDGp7HtVDQYjcZCE3FzIpWavmYOzbdxmSxx2/j47fHf/BHqh58+RXuqZuuZ1+easd+WSmWtEHFkfBzUaEB2luKC9ibBmhq92RNidaStMUzCAG9UdQ9Y6sWNKobQ8/ol9927rqlbU15vMrixnYlFM7FMOpVKwSFM3bljVHAxHVY3tgaIkJwrDjHbVO3Idntnbllu54YMgREQUfCGYoJEHF/rQq/W6AxMBAUtJkEjZOIuxcACD1OpJES/7Prf/3T14UI47ApHotsbkWAmmNkGSachIyQSzekZ1oN6qv36+DvTX2qqDjXlW+rYdHk5lnG1DM5z63sQFdW9MoEAMjUuMEghB85xqWw2lUPHQI3AB8Jknld0KFgslUIkl1/97Z3lt9yBQMDnD0ZT20Fg3Nje2IjHQxNwrA3ma6Gezgbq1PV/3UDPZQ81e3W6Qvm/e/fGrqiBkU9mFxzOM9nCoAc+t9c6IDByIMUwJDx0bZUhhl9RS7dKx6uHNpuq+0vzHX3InI5FIpHMRjSTCUY3gDEasIzY3p6dSOvN9ot0KhFv/nJVedhxbsjVBxNzvXx+jlEmwwXoeZ4AN5mgkFgzgZWpHDbEb4Ykr0UGAzvf0qMSYS1dLKrw6v3m182jqUwsCBLJRDNRRBhMLozY31xyxqenTQpI6q7rX2kKDr1doKRG8992Nb8VBW7wRz5Z6YCdTXBobqxNQcihsdGUCZDVkXwMdDemUcVj9sAftf6NT9v1CXMcTnLkaTIWjQJiNBhJOu0j7r6LPv0TvQuV73v/P+wYYG6cUvOtERChLZDxpQLwRBlChCSGIyWCnQmCw0ZqlJCIILyGxq46ol4lYlAJ7qLHHQrFAoFI0uvPmTkT9CctIx7PH1SiwJNpJ+TJHWvNcw2blys/+9YAVm5tVUNchD4a9QYmowAfIwM37RzYmUPjoEvKSNA95V91drIIYQ+XQVBpv5/53LUQ9nofPUr6I4C4AUZPhi2WpaUPVCLf6GjkI+oDa9VzjsOXK6GTQYx8CDiAKW1vIpU4J6WBJ9IugC8S0AgiRAiMSJd1DfUYhziv4gnRy/4LF9DY2z2v3++Pbm9nIFF7wwPOvg+G+qecCFFnrSqkUJ6fcXmsFTyxtxdiDso0Wi3eNOcEM4MbgitSwSHRLWDkigz4hLKHKee2cEV0dIsQ5b9H3nDS54+nSE/0hhc6+m5O9swErpmfPntuHeYZ91pBj01Qi6nV0GVBzMHH3plCZDTOOTY7x8gkEelMOoYiOZ3b0tnAbWiYmpm6Bfkv7FpwWgAxDp7odb3f0d2manCFRkPfWGsKKUcg5ZWaveVlVOkAo4wMi9oxKZQ5bHTPDxBp6AtClNDFTBQlofPnzrddnJx/qJhXzHjDTqfTYrelU4l0wBf2Kj6e7G8U3Qqk05tHRAjnukbzVZMUjgsg4lKB1IBrbwzLkQ8CGnomwWbLOehaKCAywOCseh6De/PmJ31ud1/H+90LPsuI3TY8YX6SSMecYZdC0SOqe9cfN36tKT6yxRElZ5Wr/zCoe6HSgRQtwHvx8REUctgodNNyWkSzTxIGicirF2G6q28sLXlsE7aAxTmAdPi3S1DhmOMxv8+3EP487I/hq8qCWsqRSW2B8rM9k7b3sgm6fhyOy+868ohskhE95uGgV0V0BjgjT8TjNSy+Netxm/Tx+ITNZhmwh/SjCagdzOk4KdHYFxplGeVIpVSp+VqtvWyACkeAX8avzOQRaTlENH0uZEJgRM9QWKw6ke6TWZvbpjen9Uaj0eax6aEG06cBMI0+MvZNZc0vKEcshWeUq3tarYEv0F7WzsnoeUQCHRfyYid5YiQMMvpIRJ2TH77pXkH9o6F92hSCLiiVuBQKxECgQXi8paw4hu1op8pAkZ/iuJp/5UovqhSJ7xHZOTWCqckpCdAjg8VtHLr74ez95fsrK/eNZmgkR1PmiRGfH6qeiGXTWllaSzkGOf3aGfDI3vda7SryhhoBxqXltEheGwM9Cjkkp1CIiXT9Q4ue2ZWV2dlhm/GaPjGaCFksfmfyafjxv5XFhZRjktqiKs3qF79GPEgAjiDIb8jScGTyMYjDIcQsnu7B0OKSxz3rnh0eNujNoENLxO8Pf7OuqSk9zrWHhRWV1v1BUmVIhaSFv0dEauVw5DSUdeQM1uBg5/z84tKSGyjdw6GQxelP+h9vaioLjntHX3Wxw7qvI1NKjo3IIxLoOrQ8hw7/ZWKswf7JtoeLIKBMT4cLTPwfjaOgkHLscrq6wmHd3RHnLEwjEQkERZB2ZwtJRCpVLmbV909CEnx4E35m3v3riwLMQRY4NFmkSmreLXOIBLI8qd08I6ZDjPPzkz2dO7tbSkfZCwIkIUvKqiqt6wc6Zs4ZCcRIzZ8dOWnr3BV5uojb2P/PZ/tZa2Vx+akXvBy0trqgplKzvr8zyGT/cEk2Z3vSH8lARCXEDw52s5rKM0UvZ3lp7WtFZ6uU1vXdg51BsVBOo/4IlXNOzBrcOdhdtyprzhZV11JejpxGFi8tKK5yOKzZ9X0AxcSkYCRcVuNwVBWXlb/8paqU2pLy0qIKh0Nj3cpm10Gy2S2rhtz5Wl7yyuymRbtzf0muzq3Ir84tf4U25/5QZZRU/3gBcfWrtn/4RE7kRE7kRE7kZybfAdU5oJ2ZeEtRAAAAAElFTkSuQmCC";
    this.cellHalfWidth = 0;
    this.spinnerPaddingLeft = 0;
    this.spinnerPaddingTop = 0;
    this.lineColor = 'rgb(68, 42, 11)';

    // Bind event handlers
    this.boundCanvasClick = this.handleCanvasClick.bind(this);

    this.initializeUI();
    this.bindEvents();
    this.updateDisplay();
    void this.loadSpinsCountFromHistory();
  }

  initializeUI() {
    // Bet options - initialized based on game type
    this.updateBetOptions();

    // Lines
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    for (let i = 0; i < 7; i++) {
      const lineButton = document.createElement('button');
      lineButton.type = 'button';
      lineButton.className = `control-group line-btn${i === 0 ? ' active' : ''}`;
      lineButton.dataset.line = String(i);
      lineButton.textContent = `Line ${i + 1}`;
      lineButton.addEventListener('click', () => this.toggleLine(i, lineButton));
      linesContainer.appendChild(lineButton);
    }

    // Game types
    const gameTypeOptions = this.shadowRoot.getElementById('gameTypeOptions');
    ['Numbers', 'Roman', 'Fruits', 'Animals', 'Emoji'].forEach((type, idx) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'control-group' + (idx === 0 ? ' active' : '');
      optionButton.dataset.value = String(idx + 1);
      optionButton.textContent = type;
      optionButton.addEventListener('click', () => this.selectGameType(idx + 1, type, optionButton));
      gameTypeOptions.appendChild(optionButton);
    });

    // Reward modes
    const rewardModeOptions = this.shadowRoot.getElementById('rewardModeOptions');
    [{ value: 2, label: '1x5 Middle' }, { value: 1, label: '3x5 Multi-line' }].forEach((mode, idx) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'control-group' + (idx === 0 ? ' active' : '');
      optionButton.dataset.value = String(mode.value);
      optionButton.textContent = mode.label;
      optionButton.addEventListener('click', () => this.selectRewardMode(mode.value, optionButton));
      rewardModeOptions.appendChild(optionButton);
    });

    // Canvas reels
    this.canvas = this.shadowRoot.getElementById('spinners');

    setTimeout(() => {
      this.initCanvas();
      this.createOddsTables();
      if (this.rewardMode === 2) {
        this.setCanvasMiddleRow();
      } else {
        this.setCanvasFullHeight();
      }
      this.drawLines();
    }, 100);
  }

  initCanvas() {
    if (!this.canvas) return;

    const computedStyle = getComputedStyle(this.canvas);
    const innerPadding = parseFloat(computedStyle.getPropertyValue('--spinner-inner-padding'))
      || parseFloat(computedStyle.paddingLeft)
      || 10;
    const themedBorderColor = computedStyle.getPropertyValue('--slot-border-color').trim();
    const themedPanelColor = computedStyle.getPropertyValue('--slot-card-bg').trim();
    const woodTop = computedStyle.getPropertyValue('--slot-wheel-wood-top').trim();
    const woodMid = computedStyle.getPropertyValue('--slot-wheel-wood-mid').trim();
    const woodBottom = computedStyle.getPropertyValue('--slot-wheel-wood-bottom').trim();
    this.reelBorderColor = themedBorderColor || 'rgba(245, 218, 118, 0.8)';
    this.reelPanelBaseColor = this.parseCssColorToRgb(themedPanelColor, 'rgb(255, 255, 255)');
    const topbar = document.querySelector('.topbar');
    const topbarBackground = topbar
      ? getComputedStyle(topbar).backgroundColor.trim()
      : '';
    const panelBackground = themedPanelColor || 'rgba(208, 156, 61, 0.2)';
    this.reelCellFillColor = topbarBackground || panelBackground;
    this.reelWoodTopColor = this.parseCssColorToRgb(woodTop, 'rgb(188, 129, 67)');
    this.reelWoodMidColor = this.parseCssColorToRgb(woodMid, 'rgb(144, 93, 43)');
    this.reelWoodBottomColor = this.parseCssColorToRgb(woodBottom, 'rgb(96, 58, 23)');

    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = Math.max(1, Math.floor(rect.height));
    const deviceDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(deviceDpr, this.maxSpinnerRenderDpr || 1.25);
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));

    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;

    this.webglEnabled = this.ensureWebGLContext(pixelWidth, pixelHeight);
    if (this.webglEnabled) {
      this.ensureWebGLBackbuffer(pixelWidth, pixelHeight);
      this.ctx = this.webglBackbufferCanvas?.getContext('2d');
    } else {
      this.ctx = this.canvas.getContext('2d');
    }
    if (!this.ctx) return;

    this.spinnerPaddingLeft = innerPadding;
    this.spinnerPaddingTop = innerPadding;

    this.canvasWidth = cssWidth;
    this.canvasHeight = cssHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const contentWidth = Math.max(1, cssWidth - this.spinnerPaddingLeft * 2);
    const contentHeight = Math.max(1, cssHeight - this.spinnerPaddingTop * 2);

    this.cellHalfHeight = (contentHeight / 3) / 2;
    this.cellHalfWidth = (contentWidth / 5) / 2;
    this.middleRowCenterY = this.spinnerPaddingTop + 3 * this.cellHalfHeight;
    this.bottomRowCenterY = this.spinnerPaddingTop + 5 * this.cellHalfHeight;

    this.ctx.lineWidth = 10;
    this.ctx.font = '20px "Lucida Sans Unicode", "Lucida Grande", sans-serif';
    this.ctx.strokeStyle = this.lineColor;

    this.renderFrame();
  }

  createWebGLShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[SlotMachine] WebGL shader compile failed:', gl.getShaderInfoLog(shader) || '');
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  ensureWebGLContext(pixelWidth, pixelHeight) {
    if (!this.canvas) return false;
    if (!window.WebGLRenderingContext) return false;

    let gl = this.webgl;
    if (!gl) {
      const contextAttributes = {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      };

      gl = this.canvas.getContext('webgl2', contextAttributes)
        || this.canvas.getContext('webgl', contextAttributes)
        || this.canvas.getContext('experimental-webgl', contextAttributes);
      if (!gl) {
        return false;
      }

      const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_uv;
        varying vec2 v_uv;

        void main() {
          v_uv = a_uv;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fragmentShaderSource = `
        precision mediump float;
        varying vec2 v_uv;
        uniform sampler2D u_texture;

        void main() {
          gl_FragColor = texture2D(u_texture, v_uv);
        }
      `;

      const vertexShader = this.createWebGLShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = this.createWebGLShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vertexShader || !fragmentShader) {
        return false;
      }

      const program = gl.createProgram();
      if (!program) return false;

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[SlotMachine] WebGL program link failed:', gl.getProgramInfoLog(program) || '');
        gl.deleteProgram(program);
        return false;
      }

      const vertexBuffer = gl.createBuffer();
      const texture = gl.createTexture();
      if (!vertexBuffer || !texture) {
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (texture) gl.deleteTexture(texture);
        gl.deleteProgram(program);
        return false;
      }

      // Fullscreen quad with UVs, rendering the 2D backbuffer as a texture.
      const quadData = new Float32Array([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
      ]);

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      this.webgl = gl;
      this.webglProgram = program;
      this.webglVertexBuffer = vertexBuffer;
      this.webglTexture = texture;
      this.webglPositionLocation = gl.getAttribLocation(program, 'a_position');
      this.webglUvLocation = gl.getAttribLocation(program, 'a_uv');
      this.webglTextureLocation = gl.getUniformLocation(program, 'u_texture');

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    if (!this.webgl || !this.webglProgram || !this.webglVertexBuffer || !this.webglTexture) {
      return false;
    }

    if (this.webglTextureWidth !== pixelWidth || this.webglTextureHeight !== pixelHeight) {
      this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.webglTexture);
      this.webgl.texImage2D(
        this.webgl.TEXTURE_2D,
        0,
        this.webgl.RGBA,
        pixelWidth,
        pixelHeight,
        0,
        this.webgl.RGBA,
        this.webgl.UNSIGNED_BYTE,
        null,
      );
      this.webglTextureWidth = pixelWidth;
      this.webglTextureHeight = pixelHeight;
    }

    this.webgl.viewport(0, 0, pixelWidth, pixelHeight);
    return true;
  }

  ensureWebGLBackbuffer(pixelWidth, pixelHeight) {
    if (!this.webglEnabled) return;
    if (!this.webglBackbufferCanvas) {
      this.webglBackbufferCanvas = document.createElement('canvas');
    }
    if (this.webglBackbufferCanvas.width !== pixelWidth) {
      this.webglBackbufferCanvas.width = pixelWidth;
    }
    if (this.webglBackbufferCanvas.height !== pixelHeight) {
      this.webglBackbufferCanvas.height = pixelHeight;
    }
  }

  presentWebGLFrame() {
    if (!this.webglEnabled || !this.webgl || !this.webglProgram || !this.webglVertexBuffer || !this.webglTexture) {
      return;
    }
    if (!this.webglBackbufferCanvas) return;

    const gl = this.webgl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.webglProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.webglVertexBuffer);

    if (this.webglPositionLocation >= 0) {
      gl.enableVertexAttribArray(this.webglPositionLocation);
      gl.vertexAttribPointer(this.webglPositionLocation, 2, gl.FLOAT, false, 16, 0);
    }

    if (this.webglUvLocation >= 0) {
      gl.enableVertexAttribArray(this.webglUvLocation);
      gl.vertexAttribPointer(this.webglUvLocation, 2, gl.FLOAT, false, 16, 8);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    if (this.webglTextureWidth !== this.canvas.width || this.webglTextureHeight !== this.canvas.height) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.canvas.width,
        this.canvas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      this.webglTextureWidth = this.canvas.width;
      this.webglTextureHeight = this.canvas.height;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.webglBackbufferCanvas);

    if (this.webglTextureLocation) {
      gl.uniform1i(this.webglTextureLocation, 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  cancelReelAnimation() {
    if (!this.reelAnimationFrame) return;
    cancelAnimationFrame(this.reelAnimationFrame);
    this.reelAnimationFrame = null;
  }

  easeOutSpin(progress) {
    return 1 - Math.pow(1 - progress, 3.4);
  }

  cubicBezierComponent(t, control1, control2) {
    const inv = 1 - t;
    return (3 * inv * inv * t * control1) + (3 * inv * t * t * control2) + (t * t * t);
  }

  cubicBezierEase(progress, p1x = 0.22, p1y = 0.61, p2x = 0.36, p2y = 1) {
    const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
    let low = 0;
    let high = 1;
    let t = clamped;

    for (let i = 0; i < 10; i += 1) {
      const x = this.cubicBezierComponent(t, p1x, p2x);
      if (Math.abs(x - clamped) < 0.0001) break;
      if (x < clamped) {
        low = t;
      } else {
        high = t;
      }
      t = (low + high) * 0.5;
    }

    return this.cubicBezierComponent(t, p1y, p2y);
  }

  getReelStepAngle() {
    const stripLength = Array.isArray(this.symbolStrip) ? this.symbolStrip.length : 0;
    if (!Number.isFinite(stripLength) || stripLength < 2) {
      return 360 / CLASSIC_SYMBOL_COUNT;
    }
    return 360 / stripLength;
  }

  buildNumberSymbols() {
    return Array.from({ length: CLASSIC_SYMBOL_COUNT }, (_, index) => index + 1);
  }

  toRomanNumber(value) {
    const numericValue = Math.max(1, Math.floor(Number(value) || 1));
    const map = [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];

    let remaining = numericValue;
    let result = '';
    for (let i = 0; i < map.length; i += 1) {
      const [romanValue, romanSymbol] = map[i];
      while (remaining >= romanValue) {
        remaining -= romanValue;
        result += romanSymbol;
      }
    }
    return result || 'I';
  }

  getSymbolSetForGameType(gameType = 1) {
    const numberSymbols = this.buildNumberSymbols();
    const symbolSets = {
      1: numberSymbols,
      2: numberSymbols.map((value) => this.toRomanNumber(value)),
      3: ['🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍍', '🥥', '🥝', '🍑', '🍎', '🥭', '🍈', '🍅', '🥕', '🌽', '🥔', '🍆'],
      4: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐙', '🦋', '🐢', '🐬'],
      5: ['😀', '😁', '😂', '🤣', '😅', '😊', '😎', '🤩', '😍', '😘', '😜', '🤪', '🥳', '🤖', '👻', '😈', '🫠', '😇', '🤠', '🥶', '😡', '🤯'],
    };

    return symbolSets[gameType] || symbolSets[1];
  }

  resolveGroupCoefficients(groupCount) {
    if (groupCount <= 0) {
      return [];
    }
    if (groupCount === BASE_GROUP_COEFFICIENTS.length) {
      return [...BASE_GROUP_COEFFICIENTS];
    }
    if (groupCount === 1) {
      return [BASE_GROUP_COEFFICIENTS[0]];
    }

    const top = BASE_GROUP_COEFFICIENTS[0];
    const bottom = BASE_GROUP_COEFFICIENTS[BASE_GROUP_COEFFICIENTS.length - 1];
    return Array.from({ length: groupCount }, (_, index) => {
      const ratio = index / (groupCount - 1);
      return top + ((bottom - top) * ratio);
    });
  }

  getExactMatchProbability(symbolCount, matchCount) {
    const safeCount = Math.max(2, Number(symbolCount) || CLASSIC_SYMBOL_COUNT);
    if (matchCount === 5) {
      return 1 / (safeCount ** 5);
    }
    return (safeCount - 1) / (safeCount ** (matchCount + 1));
  }

  buildBaseNumbersOdds(symbolCount = CLASSIC_SYMBOL_COUNT) {
    const groupCount = Math.ceil(symbolCount / 2);
    const groupCoefficients = this.resolveGroupCoefficients(groupCount);
    const coefficientSum = groupCoefficients.reduce((sum, value) => sum + value, 0);
    const scale = NUMBERS_TARGET_RTP / (ODDS_MATCH_ORDER.length * coefficientSum);
    const odds = [];

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      const groupCoefficient = groupCoefficients[groupIndex] ?? 1;
      const groupSymbolCount = Math.max(0, Math.min(2, symbolCount - (groupIndex * 2)));

      for (let i = 0; i < ODDS_MATCH_ORDER.length; i += 1) {
        const matchCount = ODDS_MATCH_ORDER[i];
        const probability = groupSymbolCount * this.getExactMatchProbability(symbolCount, matchCount);
        const multiplier = probability > 0 ? Math.round((scale * groupCoefficient) / probability) : 0;
        odds.push(Math.max(1, multiplier));
      }
    }

    return odds;
  }

  getOddsForGameType(gameType = 1) {
    const baseOdds = this.buildBaseNumbersOdds(CLASSIC_SYMBOL_COUNT);
    const coefficient = GAME_TYPE_ODDS_COEFFICIENTS[gameType] ?? 1;

    if (coefficient === 1) {
      return baseOdds;
    }
    return baseOdds.map((value) => Math.max(1, Math.round(value * coefficient)));
  }

  animateReels(transitions, onComplete = null) {
    this.cancelReelAnimation();

    const startedAt = performance.now();
    const nextFrame = (now) => {
      let allComplete = true;

      for (let reel = 0; reel < transitions.length; reel++) {
        const transition = transitions[reel];
        if (!transition) continue;

        const effectiveStart = startedAt + transition.delay;
        if (now < effectiveStart) {
          allComplete = false;
          continue;
        }

        const elapsed = now - effectiveStart;
        const rawProgress = transition.duration <= 0 ? 1 : elapsed / transition.duration;
        const progress = Math.max(0, Math.min(1, rawProgress));
        const eased = transition.easing(progress);

        this.renderRotations[reel] = transition.from + ((transition.to - transition.from) * eased);
        if (progress < 1) {
          allComplete = false;
        } else {
          this.renderRotations[reel] = transition.to;
        }
      }

      this.renderFrame();

      if (!allComplete) {
        this.reelAnimationFrame = requestAnimationFrame(nextFrame);
        return;
      }

      this.reelAnimationFrame = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    };

    this.reelAnimationFrame = requestAnimationFrame(nextFrame);
  }

  getSymbolHue(symbol, fallbackIndex = 0) {
    const symbolText = String(symbol ?? '');
    const numberValue = Number(symbolText);
    if (Number.isFinite(numberValue) && symbolText !== '') {
      const symbolCount = Array.isArray(this.symbolStrip) && this.symbolStrip.length
        ? this.symbolStrip.length
        : CLASSIC_SYMBOL_COUNT;
      return ((Math.max(1, numberValue) - 1) * (360 / symbolCount)) % 360;
    }

    const hueWheel = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352];
    const idx = ((fallbackIndex % hueWheel.length) + hueWheel.length) % hueWheel.length;
    return hueWheel[idx];
  }

  parseCssColorToRgb(input, fallback = 'rgb(255, 255, 255)') {
    const value = String(input || '').trim();
    if (!value) return fallback;

    const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return `rgb(${r}, ${g}, ${b})`;
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }

    const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
      if (parts.length >= 3 && parts.every((part, idx) => idx > 2 || Number.isFinite(part))) {
        const r = Math.max(0, Math.min(255, Math.round(parts[0])));
        const g = Math.max(0, Math.min(255, Math.round(parts[1])));
        const b = Math.max(0, Math.min(255, Math.round(parts[2])));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    return fallback;
  }

  colorWithAlpha(rgbColor, alphaValue) {
    const safeAlpha = Math.max(0, Math.min(1, Number(alphaValue) || 0));
    const normalized = this.parseCssColorToRgb(rgbColor, 'rgb(255, 255, 255)');
    const rgbMatch = normalized.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
    if (!rgbMatch) {
      return `rgba(255, 255, 255, ${safeAlpha})`;
    }
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${safeAlpha})`;
  }

  getWoodGradientColors(depthWeight = 0.5) {
    const depth = Math.max(0, Math.min(1, Number(depthWeight) || 0));
    return {
      top: this.colorWithAlpha(this.reelWoodTopColor || 'rgb(188, 129, 67)', 0.78 + (depth * 0.16)),
      middle: this.colorWithAlpha(this.reelWoodMidColor || 'rgb(144, 93, 43)', 0.76 + (depth * 0.14)),
      bottom: this.colorWithAlpha(this.reelWoodBottomColor || 'rgb(96, 58, 23)', 0.82 + (depth * 0.14)),
    };
  }

  getSymbolFontSizePx(baseCellHeight, symbol) {
    const text = String(symbol ?? '');
    const charCount = text.length;
    let scale = 0.33;
    if (charCount >= 6) {
      scale = 0.2;
    } else if (charCount >= 5) {
      scale = 0.23;
    } else if (charCount >= 4) {
      scale = 0.26;
    } else if (charCount >= 3) {
      scale = 0.29;
    }
    return Math.max(15, baseCellHeight * scale);
  }

  transformByMagicCamera(x, y, z, includeDepthOffset = true) {
    let viewX = x;
    let viewY = y;
    let viewZ = z;

    if (this.magicOpenAiMode) {
      const yaw = Number(this.magicCameraYawRad) || 0;
      const yawCos = Math.cos(yaw);
      const yawSin = Math.sin(yaw);
      const yawX = (viewX * yawCos) + (viewZ * yawSin);
      const yawZ = (viewZ * yawCos) - (viewX * yawSin);
      viewX = yawX;
      viewZ = yawZ;

      const pitch = Number(this.magicCameraPitchRad) || 0;
      if (Math.abs(pitch) > 0.0001) {
        const pitchCos = Math.cos(pitch);
        const pitchSin = Math.sin(pitch);
        const pitchY = (viewY * pitchCos) - (viewZ * pitchSin);
        const pitchZ = (viewY * pitchSin) + (viewZ * pitchCos);
        viewY = pitchY;
        viewZ = pitchZ;
      }

      if (includeDepthOffset) {
        viewZ += Number(this.magicCameraDepthOffset) || 0;
      }
    }

    return { x: viewX, y: viewY, z: viewZ };
  }

  projectPoint3D(x, y, z, centerX, centerY, perspective) {
    const transformed = this.transformByMagicCamera(x, y, z, true);
    const viewX = transformed.x;
    const viewY = transformed.y;
    const viewZ = transformed.z;

    const safeZ = Math.max(-perspective + 1, viewZ);
    const scale = perspective / (perspective - safeZ);
    return {
      x: centerX + (viewX * scale),
      y: centerY + (viewY * scale),
      scale,
    };
  }

  projectWorldPoint(x, y, z, centerX, centerY, perspective, yawRad, pitchRad, depthOffset) {
    const yawCos = Math.cos(yawRad);
    const yawSin = Math.sin(yawRad);
    let viewX = (x * yawCos) + (z * yawSin);
    let viewZ = (z * yawCos) - (x * yawSin);

    let viewY = y;
    if (Math.abs(pitchRad) > 0.0001) {
      const pitchCos = Math.cos(pitchRad);
      const pitchSin = Math.sin(pitchRad);
      const pY = (viewY * pitchCos) - (viewZ * pitchSin);
      const pZ = (viewY * pitchSin) + (viewZ * pitchCos);
      viewY = pY;
      viewZ = pZ;
    }

    viewZ += depthOffset;
    const safeZ = Math.max(-perspective + 1, viewZ);
    const scale = perspective / (perspective - safeZ);
    return {
      x: centerX + (viewX * scale),
      y: centerY + (viewY * scale),
      scale,
      viewZ,
    };
  }

  drawMagicReelTunnel(reelCenterX, reelCenterY, reelWidth, reelAreaHeight) {
    const ctx = this.ctx;
    if (!ctx || !this.magicOpenAiMode) return;

    const holeRx = Math.max(6, reelWidth * 0.13);
    const holeRy = Math.max(14, reelAreaHeight * 0.2);

    // Punch a visible center tunnel so reels look like rotating pipes/rings.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(reelCenterX, reelCenterY, holeRx, holeRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Add tunnel rim and inner shadow for depth.
    ctx.save();
    const rimGradient = ctx.createRadialGradient(
      reelCenterX,
      reelCenterY,
      Math.max(1, holeRx * 0.18),
      reelCenterX,
      reelCenterY,
      holeRy,
    );
    rimGradient.addColorStop(0, 'rgba(14, 10, 4, 0.86)');
    rimGradient.addColorStop(0.65, 'rgba(14, 10, 4, 0.42)');
    rimGradient.addColorStop(1, 'rgba(14, 10, 4, 0)');
    ctx.beginPath();
    ctx.ellipse(reelCenterX, reelCenterY, holeRx * 1.08, holeRy * 1.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = rimGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(reelCenterX, reelCenterY, holeRx * 1.02, holeRy * 1.02, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(108, 78, 24, 0.92)';
    ctx.lineWidth = Math.max(1.6, reelWidth * 0.04);
    ctx.stroke();
    ctx.restore();
  }

  drawRoundedQuadPath(points, radiusPx) {
    const ctx = this.ctx;
    if (!ctx || !points || points.length !== 4) return;

    const clampDot = (value) => Math.max(-1, Math.min(1, value));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const normalize = (vector) => {
      const length = Math.hypot(vector.x, vector.y);
      if (length <= 0.0001) return { x: 0, y: 0 };
      return { x: vector.x / length, y: vector.y / length };
    };

    const roundedSegments = [];
    for (let i = 0; i < 4; i++) {
      const prev = points[(i + 3) % 4];
      const current = points[i];
      const next = points[(i + 1) % 4];

      const toPrev = normalize({ x: prev.x - current.x, y: prev.y - current.y });
      const toNext = normalize({ x: next.x - current.x, y: next.y - current.y });

      const lenPrev = distance(prev, current);
      const lenNext = distance(next, current);
      const cornerAngle = Math.acos(clampDot((toPrev.x * toNext.x) + (toPrev.y * toNext.y)));
      const maxOffset = Math.min(lenPrev, lenNext) * 0.5;

      let offset = radiusPx / Math.max(0.0001, Math.tan(cornerAngle * 0.5));
      if (!Number.isFinite(offset)) {
        offset = maxOffset;
      }
      offset = Math.max(0, Math.min(maxOffset, offset));

      const start = {
        x: current.x + (toPrev.x * offset),
        y: current.y + (toPrev.y * offset),
      };
      const end = {
        x: current.x + (toNext.x * offset),
        y: current.y + (toNext.y * offset),
      };

      roundedSegments.push({ corner: current, start, end });
    }

    ctx.beginPath();
    ctx.moveTo(roundedSegments[0].start.x, roundedSegments[0].start.y);
    for (let i = 0; i < roundedSegments.length; i++) {
      const segment = roundedSegments[i];
      ctx.quadraticCurveTo(
        segment.corner.x,
        segment.corner.y,
        segment.end.x,
        segment.end.y,
      );
      const nextSegment = roundedSegments[(i + 1) % roundedSegments.length];
      ctx.lineTo(nextSegment.start.x, nextSegment.start.y);
    }
    ctx.closePath();
  }

  drawPolygonPath(points) {
    const ctx = this.ctx;
    if (!ctx || !Array.isArray(points) || points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
  }

  drawDiamondBadge(points, depthWeight = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !Array.isArray(points) || points.length !== 4) return;

    const [top, right, bottom, left] = points;
    const minY = Math.min(top.y, right.y, bottom.y, left.y);
    const maxY = Math.max(top.y, right.y, bottom.y, left.y);
    const minX = Math.min(top.x, right.x, bottom.x, left.x);
    const maxX = Math.max(top.x, right.x, bottom.x, left.x);
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return;
    }

    const depth = Math.max(0, Math.min(1, Number(depthWeight) || 0));
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const drawDiamondPath = () => {
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(left.x, left.y);
      ctx.closePath();
    };

    const darkGoldA = depth > 0.5 ? 'rgba(122, 84, 20, 0.98)' : 'rgba(104, 70, 16, 0.97)';
    const darkGoldB = depth > 0.5 ? 'rgba(94, 62, 12, 0.98)' : 'rgba(81, 53, 10, 0.98)';
    const brightGold = depth > 0.5 ? 'rgba(245, 202, 94, 0.97)' : 'rgba(227, 175, 72, 0.96)';
    const midGold = depth > 0.5 ? 'rgba(187, 131, 42, 0.97)' : 'rgba(169, 117, 33, 0.97)';

    let fillGradient = null;
    if (this.magicOpenAiMode) {
      const outerRadius = Math.max(6, Math.max(width, height) * 0.58);
      fillGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.max(1, outerRadius * 0.09),
        centerX,
        centerY,
        outerRadius,
      );
      fillGradient.addColorStop(0, brightGold);
      fillGradient.addColorStop(0.5, midGold);
      fillGradient.addColorStop(1, darkGoldA);
    } else if (typeof ctx.createConicGradient === 'function') {
      fillGradient = ctx.createConicGradient(-Math.PI / 2, centerX, centerY);
      fillGradient.addColorStop(0, darkGoldA);
      fillGradient.addColorStop(0.2, brightGold);
      fillGradient.addColorStop(0.42, midGold);
      fillGradient.addColorStop(0.66, darkGoldB);
      fillGradient.addColorStop(0.86, brightGold);
      fillGradient.addColorStop(1, darkGoldA);
    } else {
      fillGradient = ctx.createLinearGradient(minX, minY, maxX, maxY);
      fillGradient.addColorStop(0, darkGoldA);
      fillGradient.addColorStop(0.38, brightGold);
      fillGradient.addColorStop(1, darkGoldB);
    }

    ctx.save();
    drawDiamondPath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawDiamondPath();
    ctx.strokeStyle = this.reelBorderColor || 'rgba(219, 162, 54, 0.98)';
    ctx.lineWidth = Math.max(1.2, width * 0.04);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  scaleDiamondPoints(points, scaleX = 1, scaleY = 1) {
    if (!Array.isArray(points) || points.length !== 4) {
      return points;
    }
    const centerX = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
    const centerY = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;
    return points.map((point) => ({
      x: centerX + ((point.x - centerX) * scaleX),
      y: centerY + ((point.y - centerY) * scaleY),
    }));
  }

  drawWoodDiamondBadge(points, depthWeight = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !Array.isArray(points) || points.length !== 4) return;

    const [top, right, bottom, left] = points;
    const minY = Math.min(top.y, right.y, bottom.y, left.y);
    const maxY = Math.max(top.y, right.y, bottom.y, left.y);
    const minX = Math.min(top.x, right.x, bottom.x, left.x);
    const maxX = Math.max(top.x, right.x, bottom.x, left.x);
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return;
    }

    const depth = Math.max(0, Math.min(1, Number(depthWeight) || 0));
    const width = maxX - minX;
    const height = maxY - minY;
    const cornerRadius = Math.max(1, Math.min(4, Math.min(width, height) * 0.45));
    const woodTop = this.colorWithAlpha(this.reelWoodTopColor || 'rgb(188, 129, 67)', 0.96);
    const woodMid = this.colorWithAlpha(this.reelWoodMidColor || 'rgb(144, 93, 43)', 0.95);
    const woodBottom = this.colorWithAlpha(this.reelWoodBottomColor || 'rgb(96, 58, 23)', 0.98);
    const woodGradient = ctx.createLinearGradient(minX, minY, maxX, maxY);
    woodGradient.addColorStop(0, woodTop);
    woodGradient.addColorStop(0.46, woodMid);
    woodGradient.addColorStop(1, woodBottom);

    ctx.save();
    this.drawRoundedQuadPath(points, cornerRadius);
    ctx.fillStyle = woodGradient;
    ctx.shadowColor = depth > 0.5 ? 'rgba(225, 173, 64, 0.9)' : 'rgba(198, 148, 50, 0.88)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.drawRoundedQuadPath(points, cornerRadius);
    ctx.strokeStyle = 'rgba(106, 72, 26, 0.96)';
    ctx.lineWidth = Math.max(1, width * 0.032);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  drawNeonDiamondBadge(points, highlightStrength = 1, depthWeight = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !Array.isArray(points) || points.length !== 4) return;

    const [top, right, bottom, left] = points;
    const minY = Math.min(top.y, right.y, bottom.y, left.y);
    const maxY = Math.max(top.y, right.y, bottom.y, left.y);
    const minX = Math.min(top.x, right.x, bottom.x, left.x);
    const maxX = Math.max(top.x, right.x, bottom.x, left.x);
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return;
    }

    const depth = Math.max(0, Math.min(1, Number(depthWeight) || 0));
    const strength = Math.max(1, Number(highlightStrength) || 1);
    const width = maxX - minX;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const glowBlur = Math.min(36, 18 + (strength * 6));

    const drawDiamondPath = () => {
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(left.x, left.y);
      ctx.closePath();
    };

    const neonWhite = depth > 0.5 ? 'rgba(249, 254, 255, 0.99)' : 'rgba(240, 250, 255, 0.98)';
    const neonBlue = depth > 0.5 ? 'rgba(173, 226, 255, 0.97)' : 'rgba(154, 214, 250, 0.96)';
    const neonBlueDeep = depth > 0.5 ? 'rgba(126, 190, 236, 0.95)' : 'rgba(112, 174, 220, 0.94)';

    let fillGradient = null;
    if (typeof ctx.createConicGradient === 'function') {
      fillGradient = ctx.createConicGradient(-Math.PI / 2, centerX, centerY);
      fillGradient.addColorStop(0, neonWhite);
      fillGradient.addColorStop(0.22, neonBlue);
      fillGradient.addColorStop(0.5, neonWhite);
      fillGradient.addColorStop(0.76, neonBlueDeep);
      fillGradient.addColorStop(1, neonWhite);
    } else {
      fillGradient = ctx.createLinearGradient(minX, minY, maxX, maxY);
      fillGradient.addColorStop(0, neonWhite);
      fillGradient.addColorStop(0.5, neonBlue);
      fillGradient.addColorStop(1, neonWhite);
    }

    ctx.save();
    drawDiamondPath();
    ctx.fillStyle = fillGradient;
    ctx.shadowColor = 'rgba(182, 236, 255, 0.98)';
    ctx.shadowBlur = glowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawDiamondPath();
    ctx.strokeStyle = 'rgba(233, 251, 255, 0.96)';
    ctx.lineWidth = Math.max(1, width * 0.035);
    ctx.shadowColor = 'rgba(149, 223, 255, 0.92)';
    ctx.shadowBlur = Math.max(10, glowBlur - 7);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    ctx.restore();
  }

  drawFlatDiamondBadge(centerX, centerY, baseCellWidth, baseCellHeight, depthWeight = 0.5, paylineHighlight = 0) {
    const isMagic = Boolean(this.magicOpenAiMode);
    const highlightStrength = Math.max(0, Number(paylineHighlight) || 0);
    const highlightScaleBoost = highlightStrength > 0
      ? Math.min(0.28, 0.12 + (highlightStrength * 0.07))
      : 0;
    const halfW = Math.max(11, baseCellWidth * (isMagic ? 0.42 : 0.36));
    const halfH = Math.max(10, baseCellHeight * (isMagic ? 0.38 : 0.36));
    const centerLiftY = isMagic ? (baseCellHeight * 0.08) : 0;
    const diamondCenterY = centerY - centerLiftY;
    const basePoints = [
      { x: centerX, y: diamondCenterY - halfH },
      { x: centerX + halfW, y: diamondCenterY },
      { x: centerX, y: diamondCenterY + halfH },
      { x: centerX - halfW, y: diamondCenterY },
    ];
    const baseStretchX = isMagic ? 1.2 : 1.1;
    const baseStretchY = isMagic ? 1.0 : 0.97;
    const stretchedPoints = this.scaleDiamondPoints(
      basePoints,
      baseStretchX + highlightScaleBoost,
      baseStretchY + (highlightScaleBoost * 0.2),
    );
    const woodBackPoints = this.scaleDiamondPoints(
      stretchedPoints,
      1.12 + (highlightScaleBoost * 0.55),
      1.08 + (highlightScaleBoost * 0.35),
    );
    this.drawWoodDiamondBadge(woodBackPoints, depthWeight);
    if (highlightStrength > 0) {
      this.drawNeonDiamondBadge(stretchedPoints, highlightStrength, depthWeight);
    } else {
      this.drawDiamondBadge(stretchedPoints, depthWeight);
    }
  }

  drawCurvedDiamondBadge({
    angleRad,
    angleSpanRad,
    radius,
    reelCenterX,
    reelCenterY,
    perspective,
    baseCellWidth,
    baseCellHeight,
    depthWeight,
    paylineHighlight = 0,
  }) {
    const isMagic = Boolean(this.magicOpenAiMode);
    const highlightStrength = Math.max(0, Number(paylineHighlight) || 0);
    const highlightScaleBoost = highlightStrength > 0
      ? Math.min(0.28, 0.12 + (highlightStrength * 0.07))
      : 0;
    const halfW = Math.max(11, baseCellWidth * (isMagic ? 0.42 : 0.36));
    const halfH = Math.max(10, baseCellHeight * (isMagic ? 0.38 : 0.36));
    const centerShiftRad = isMagic ? (angleSpanRad * 0.08) : 0;
    const angleOffset = (halfH / Math.max(1, baseCellHeight)) * angleSpanRad;
    const projectAtAngle = (xLocal, sampleAngle) => {
      const y3d = -radius * Math.sin(sampleAngle);
      const z3d = (radius * Math.cos(sampleAngle)) - radius;
      return this.projectPoint3D(xLocal, y3d, z3d, reelCenterX, reelCenterY, perspective);
    };

    const basePoints = [
      projectAtAngle(0, angleRad + centerShiftRad + angleOffset),
      projectAtAngle(halfW, angleRad + centerShiftRad),
      projectAtAngle(0, angleRad + centerShiftRad - angleOffset),
      projectAtAngle(-halfW, angleRad + centerShiftRad),
    ];
    const baseStretchX = isMagic ? 1.2 : 1.1;
    const baseStretchY = isMagic ? 1.0 : 0.97;
    const stretchedPoints = this.scaleDiamondPoints(
      basePoints,
      baseStretchX + highlightScaleBoost,
      baseStretchY + (highlightScaleBoost * 0.2),
    );
    const woodBackPoints = this.scaleDiamondPoints(
      stretchedPoints,
      1.12 + (highlightScaleBoost * 0.55),
      1.08 + (highlightScaleBoost * 0.35),
    );
    this.drawWoodDiamondBadge(woodBackPoints, depthWeight);
    if (highlightStrength > 0) {
      this.drawNeonDiamondBadge(stretchedPoints, highlightStrength, depthWeight);
    } else {
      this.drawDiamondBadge(stretchedPoints, depthWeight);
    }
  }

  drawCurvedDiamondBadgeWorld({
    angleRad,
    angleSpanRad,
    radius,
    reelCenterX,
    reelCenterY,
    perspective,
    baseCellWidth,
    baseCellHeight,
    depthWeight,
    paylineHighlight = 0,
    yawRad,
    pitchRad,
    depthOffset,
    symbolScale = 1,
    centerShiftMultiplier = 1,
  }) {
    const isMagic = Boolean(this.magicOpenAiMode);
    const highlightStrength = Math.max(0, Number(paylineHighlight) || 0);
    const highlightScaleBoost = highlightStrength > 0
      ? Math.min(0.28, 0.12 + (highlightStrength * 0.07))
      : 0;
    const effectiveCellWidth = baseCellWidth * symbolScale;
    const effectiveCellHeight = baseCellHeight * symbolScale;
    const halfW = Math.max(11, effectiveCellWidth * (isMagic ? 0.42 : 0.36));
    const halfH = Math.max(10, effectiveCellHeight * (isMagic ? 0.38 : 0.36));
    const centerShiftRad = (isMagic ? (angleSpanRad * 0.08) : 0) * centerShiftMultiplier;
    const angleOffset = (halfH / Math.max(1, effectiveCellHeight)) * angleSpanRad;

    const projectAtAngle = (xLocal, sampleAngle) => {
      const y3d = -radius * Math.sin(sampleAngle);
      const z3d = (radius * Math.cos(sampleAngle)) - radius;
      return this.projectWorldPoint(
        xLocal,
        y3d,
        z3d,
        reelCenterX,
        reelCenterY,
        perspective,
        yawRad,
        pitchRad,
        depthOffset,
      );
    };

    const basePoints = [
      projectAtAngle(0, angleRad + centerShiftRad + angleOffset),
      projectAtAngle(halfW, angleRad + centerShiftRad),
      projectAtAngle(0, angleRad + centerShiftRad - angleOffset),
      projectAtAngle(-halfW, angleRad + centerShiftRad),
    ];

    const baseStretchX = isMagic ? 1.2 : 1.1;
    const baseStretchY = isMagic ? 1.0 : 0.97;
    const stretchedPoints = this.scaleDiamondPoints(
      basePoints,
      baseStretchX + highlightScaleBoost,
      baseStretchY + (highlightScaleBoost * 0.2),
    );
    if (!isMagic) {
      const woodBackPoints = this.scaleDiamondPoints(
        stretchedPoints,
        1.12 + (highlightScaleBoost * 0.55),
        1.08 + (highlightScaleBoost * 0.35),
      );
      this.drawWoodDiamondBadge(woodBackPoints, depthWeight);
    }
    if (highlightStrength > 0) {
      this.drawNeonDiamondBadge(stretchedPoints, highlightStrength, depthWeight);
    } else {
      this.drawDiamondBadge(stretchedPoints, depthWeight);
    }
  }

  drawCurvedReelCell(cell, renderPass = 'full') {
    const ctx = this.ctx;
    if (!ctx) return;

    const {
      symbol,
      depthWeight,
      baseCellWidth,
      baseCellHeight,
      angleRad,
      angleSpanRad,
      radius,
      reelCenterX,
      reelCenterY,
      perspective,
      paylineHighlight = 0,
    } = cell;

    if (!Number.isFinite(angleRad) || !Number.isFinite(angleSpanRad) || !Number.isFinite(radius)) {
      return;
    }

    // When precomputed edges are provided (world-space pipeline), use them directly.
    // This bypasses per-cell edge computation and the widening hack, ensuring
    // adjacent cells share exact boundary vertices with zero gap.
    const savedYaw = this.magicCameraYawRad;
    if (cell.precomputedEdges) {
      if (cell.totalYawRad !== undefined) {
        this.magicCameraYawRad = cell.totalYawRad;
      }
    }

    const segments = cell.precomputedEdges
      ? (cell.precomputedEdges.leftEdge.length - 1)
      : (this.magicOpenAiMode ? 40 : 28);
    let leftEdge;
    let rightEdge;
    let centerEdge;
    let innerLeftEdge = null;
    let innerRightEdge = null;
    let innerRadius = null;

    if (cell.precomputedEdges) {
      leftEdge = cell.precomputedEdges.leftEdge;
      rightEdge = cell.precomputedEdges.rightEdge;
      centerEdge = cell.precomputedEdges.centerEdge;
    } else {
      const halfW = baseCellWidth / 2;
      leftEdge = [];
      rightEdge = [];
      centerEdge = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = angleRad + ((0.5 - t) * angleSpanRad);
        const y = -radius * Math.sin(angle);
        const z = (radius * Math.cos(angle)) - radius;
        let sampleHalfW = halfW;
        if (this.magicOpenAiMode) {
          const sampleNormal = this.transformByMagicCamera(
            0,
            -Math.sin(angle),
            Math.cos(angle),
            false,
          );
          // Widen mostly in bottom-back zone to close cracks without global overlap.
          const backStrength = Math.max(0, sampleNormal.z);
          const bottomStrength = Math.max(0, Math.min(1, y / Math.max(1, radius)));
          const widenFactor = 1 + (backStrength * (0.14 + (bottomStrength * 0.2)));
          sampleHalfW = halfW * widenFactor;
        }
        const left = this.projectPoint3D(-sampleHalfW, y, z, reelCenterX, reelCenterY, perspective);
        const right = this.projectPoint3D(sampleHalfW, y, z, reelCenterX, reelCenterY, perspective);
        leftEdge.push(left);
        rightEdge.push(right);
        centerEdge.push({
          x: (left.x + right.x) / 2,
          y: (left.y + right.y) / 2,
        });
      }
    }

    const topCenter = centerEdge[0];
    const bottomCenter = centerEdge[centerEdge.length - 1];
    const midIndex = Math.floor(segments / 2);
    const midLeft = leftEdge[midIndex];
    const midRight = rightEdge[midIndex];
    const projectedWidth = Math.hypot(midRight.x - midLeft.x, midRight.y - midLeft.y);
    const projectedHeight = Math.hypot(bottomCenter.x - topCenter.x, bottomCenter.y - topCenter.y);
    const minProjectedHeight = this.magicOpenAiMode ? 0.12 : 1;
    const minProjectedWidth = this.magicOpenAiMode ? 0.05 : 1;
    if (projectedHeight < minProjectedHeight || projectedWidth < minProjectedWidth) {
      if (cell.precomputedEdges) this.magicCameraYawRad = savedYaw;
      return;
    }

    const frontStrength = Math.max(0, Math.cos(angleRad));
    const sideBorderWidth = this.magicOpenAiMode
      ? 2
      : 2.2 + ((6 - 2.2) * frontStrength);
    const topBottomBorderWidth = this.magicOpenAiMode
      ? 2
      : 1.1 + ((3 - 1.1) * frontStrength);
    const borderAlpha = this.magicOpenAiMode
      ? 0.96
      : 0.72 + (0.26 * frontStrength);
    const edgeColor = this.magicOpenAiMode
      ? 'rgba(56, 36, 12, 0.96)'
      : (this.lineColor || 'rgb(94, 61, 17)');
    const lastEdgeIndex = leftEdge.length - 1;
    const panelBackgroundColor = this.reelCellFillColor || 'rgba(208, 156, 61, 0.2)';
    const itemBackground = this.magicOpenAiMode
      ? this.colorWithAlpha(panelBackgroundColor, cell.precomputedEdges ? 1 : 0.72)
      : panelBackgroundColor;
    const panelPoints = [...leftEdge, ...rightEdge.slice().reverse()];
    const totalYaw = Number(cell.totalYawRad ?? this.magicCameraYawRad) || 0;
    if (this.magicOpenAiMode) {
      const ringWallThickness = Math.max(12, baseCellHeight * 0.32);
      innerRadius = Math.max(6, radius - ringWallThickness);
      const halfW = baseCellWidth / 2;
      innerLeftEdge = [];
      innerRightEdge = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const sampleAngle = angleRad + ((0.5 - t) * angleSpanRad);
        const y = -innerRadius * Math.sin(sampleAngle);
        const z = (innerRadius * Math.cos(sampleAngle)) - innerRadius;
        const left = cell.precomputedEdges
          ? this.projectWorldPoint(
            -halfW, y, z,
            reelCenterX, reelCenterY, perspective,
            totalYaw,
            Number(this.magicCameraPitchRad) || 0,
            Number(this.magicCameraDepthOffset) || 0,
          )
          : this.projectPoint3D(-halfW, y, z, reelCenterX, reelCenterY, perspective);
        const right = cell.precomputedEdges
          ? this.projectWorldPoint(
            halfW, y, z,
            reelCenterX, reelCenterY, perspective,
            totalYaw,
            Number(this.magicCameraPitchRad) || 0,
            Number(this.magicCameraDepthOffset) || 0,
          )
          : this.projectPoint3D(halfW, y, z, reelCenterX, reelCenterY, perspective);
        innerLeftEdge.push(left);
        innerRightEdge.push(right);
      }
    }
    let faceTowardsCamera = Math.cos(angleRad);
    if (this.magicOpenAiMode) {
      const normal = this.transformByMagicCamera(
        0,
        -Math.sin(angleRad),
        Math.cos(angleRad),
        false,
      );
      const yawFacingSign = Math.cos(totalYaw) >= 0 ? 1 : -1;
      // Render symbols/diamonds on the outer ring surface.
      faceTowardsCamera = normal.z * yawFacingSign;
    }
    const isBackSide = faceTowardsCamera <= (this.magicOpenAiMode ? 0.03 : 0.02);
    const outerStrokeVisibility = this.magicOpenAiMode
      ? Math.max(0, Math.min(1, 0.4 + (0.6 * ((faceTowardsCamera - 0.28) / 0.52))))
      : 1;

    const drawCurvedPanelPath = () => {
      this.drawPolygonPath(panelPoints);
    };

    if (renderPass !== 'overlay') {
      if (this.magicOpenAiMode && innerLeftEdge && innerRightEdge) {
        const innerPanelPoints = [...innerLeftEdge, ...innerRightEdge.slice().reverse()];
        const innerFill = 'rgba(24, 16, 6, 0.78)';
        const wallFill = this.colorWithAlpha(panelBackgroundColor, 0.78);

        const fillQuad = (points, fillStyle) => {
          ctx.save();
          this.drawPolygonPath(points);
          ctx.fillStyle = fillStyle;
          ctx.fill();
          ctx.restore();
        };

        if (!cell.precomputedEdges) {
          fillQuad(innerPanelPoints, innerFill);
          fillQuad([...leftEdge, ...innerLeftEdge.slice().reverse()], wallFill);
          fillQuad([...rightEdge, ...innerRightEdge.slice().reverse()], wallFill);
          fillQuad([leftEdge[0], rightEdge[0], innerRightEdge[0], innerLeftEdge[0]], wallFill);
          fillQuad(
            [
              leftEdge[lastEdgeIndex],
              rightEdge[lastEdgeIndex],
              innerRightEdge[lastEdgeIndex],
              innerLeftEdge[lastEdgeIndex],
            ],
            wallFill,
          );
        }
      }

      ctx.save();
      drawCurvedPanelPath();
      ctx.fillStyle = itemBackground;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = edgeColor;
      ctx.globalAlpha = borderAlpha * outerStrokeVisibility;
      ctx.lineCap = this.magicOpenAiMode ? 'round' : 'butt';
      ctx.lineJoin = this.magicOpenAiMode ? 'round' : 'miter';
      ctx.shadowBlur = 0;
      const drawCellSideBorders = !(this.magicOpenAiMode && cell.precomputedEdges);

      if (drawCellSideBorders) {
        ctx.lineWidth = sideBorderWidth;
        ctx.beginPath();
        ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
        for (let i = 1; i < leftEdge.length; i++) {
          ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightEdge[0].x, rightEdge[0].y);
        for (let i = 1; i < rightEdge.length; i++) {
          ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
        }
        ctx.stroke();
      }

      if (!this.magicOpenAiMode) {
        ctx.lineWidth = topBottomBorderWidth;
        ctx.beginPath();
        ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
        ctx.lineTo(rightEdge[0].x, rightEdge[0].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftEdge[lastEdgeIndex].x, leftEdge[lastEdgeIndex].y);
        ctx.lineTo(rightEdge[lastEdgeIndex].x, rightEdge[lastEdgeIndex].y);
        ctx.stroke();
      } else {
        if (drawCellSideBorders && innerLeftEdge && innerRightEdge) {
          // Inner ring border only (no inner seam/connector lines).
          ctx.strokeStyle = edgeColor;
          ctx.globalAlpha = Math.min(1, borderAlpha * 0.94);
          ctx.lineWidth = Math.max(1.6, sideBorderWidth * 0.9);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(innerLeftEdge[0].x, innerLeftEdge[0].y);
          for (let i = 1; i < innerLeftEdge.length; i++) {
            ctx.lineTo(innerLeftEdge[i].x, innerLeftEdge[i].y);
          }
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(innerRightEdge[0].x, innerRightEdge[0].y);
          for (let i = 1; i < innerRightEdge.length; i++) {
            ctx.lineTo(innerRightEdge[i].x, innerRightEdge[i].y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const symbolCellScale = (this.magicOpenAiMode && cell.precomputedEdges) ? 0.72 : 1;
    // Render curved diamond below symbol text; appears on all wheel sides.
    if (!cell.precomputedEdges) {
      if (renderPass !== 'geometry') {
        ctx.save();
        this.drawCurvedDiamondBadge({
          angleRad,
          angleSpanRad,
          radius,
          reelCenterX,
          reelCenterY,
          perspective,
          baseCellWidth,
          baseCellHeight,
          depthWeight,
          paylineHighlight,
        });
        ctx.restore();
      }
    } else {
      const shouldDrawOuterDiamond = !isBackSide
        && (renderPass === 'overlay' || renderPass === 'full');
      if (shouldDrawOuterDiamond) {
        this.drawCurvedDiamondBadgeWorld({
          angleRad,
          angleSpanRad,
          radius,
          reelCenterX,
          reelCenterY,
          perspective,
          baseCellWidth,
          baseCellHeight,
          depthWeight,
          paylineHighlight,
          yawRad: totalYaw,
          pitchRad: Number(this.magicCameraPitchRad) || 0,
          depthOffset: Number(this.magicCameraDepthOffset) || 0,
          symbolScale: symbolCellScale,
        });
      }
    }

    if (renderPass === 'geometry') {
      if (cell.precomputedEdges) this.magicCameraYawRad = savedYaw;
      return;
    }

    ctx.save();
    if (!this.magicOpenAiMode) {
      drawCurvedPanelPath();
      ctx.clip();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let symbolCenterX = (midLeft.x + midRight.x) / 2;
    let symbolCenterY = (topCenter.y + bottomCenter.y) / 2;
    if (this.magicOpenAiMode && cell.precomputedEdges) {
      const centerShiftRad = angleSpanRad * 0.08;
      const shiftedAngle = angleRad + centerShiftRad;
      const shiftY = -radius * Math.sin(shiftedAngle);
      const shiftZ = (radius * Math.cos(shiftedAngle)) - radius;
      const shiftedCenter = this.projectWorldPoint(
        0,
        shiftY,
        shiftZ,
        reelCenterX,
        reelCenterY,
        perspective,
        totalYaw,
        Number(this.magicCameraPitchRad) || 0,
        Number(this.magicCameraDepthOffset) || 0,
      );
      symbolCenterX = shiftedCenter.x;
      symbolCenterY = shiftedCenter.y;
    }
    ctx.translate(symbolCenterX, symbolCenterY);

    // Stable local basis for symbols/diamonds so they stay attached to the ring while
    // remaining readable at side-facing swing angles.
    const axisXx = midRight.x - midLeft.x;
    const axisXy = midRight.y - midLeft.y;
    const axisYx = bottomCenter.x - topCenter.x;
    const axisYy = bottomCenter.y - topCenter.y;
    const axisXLength = Math.hypot(axisXx, axisXy);
    const axisYLength = Math.hypot(axisYx, axisYy);
    const minAxisYLength = this.magicOpenAiMode ? 0.01 : 0.05;
    if (axisYLength < minAxisYLength) {
      ctx.restore();
      if (cell.precomputedEdges) this.magicCameraYawRad = savedYaw;
      return;
    }
    let axisYUnitX = axisYx / Math.max(axisYLength, 0.0001);
    let axisYUnitY = axisYy / Math.max(axisYLength, 0.0001);
    let axisXUnitX;
    let axisXUnitY;
    if (this.magicOpenAiMode && axisXLength < 0.05) {
      // Stable silhouette fallback: derive X axis perpendicular to Y axis.
      axisXUnitX = axisYUnitY;
      axisXUnitY = -axisYUnitX;
      const alignment = (axisXUnitX * axisXx) + (axisXUnitY * axisXy);
      if (alignment < 0) {
        axisXUnitX *= -1;
        axisXUnitY *= -1;
      }
    } else {
      axisXUnitX = axisXx / Math.max(axisXLength, 0.0001);
      axisXUnitY = axisXy / Math.max(axisXLength, 0.0001);
    }

    const yDotX = (axisYUnitX * axisXUnitX) + (axisYUnitY * axisXUnitY);
    axisYUnitX -= axisXUnitX * yDotX;
    axisYUnitY -= axisXUnitY * yDotX;
    const orthoYLength = Math.hypot(axisYUnitX, axisYUnitY);
    if (orthoYLength < 0.001) {
      axisYUnitX = -axisXUnitY;
      axisYUnitY = axisXUnitX;
    } else {
      axisYUnitX /= orthoYLength;
      axisYUnitY /= orthoYLength;
    }

    const symbolScaleXRaw = axisXLength / Math.max(1, baseCellWidth);
    const symbolScaleY = axisYLength / Math.max(1, baseCellHeight);
    let symbolScaleXText = symbolScaleXRaw;
    if (this.magicOpenAiMode) {
      // Keep numbers readable at side-on silhouettes without distorting badge curvature.
      symbolScaleXText = Math.max(0.34, symbolScaleXText);
    }

    // Raw projected basis follows the true panel quadrilateral (best for ring curvature).
    const rawPlaneTxX = axisXx / Math.max(1, baseCellWidth);
    const rawPlaneTxY = axisXy / Math.max(1, baseCellWidth);
    const rawPlaneTyX = axisYx / Math.max(1, baseCellHeight);
    const rawPlaneTyY = axisYy / Math.max(1, baseCellHeight);

    let textTxX = axisXUnitX * symbolScaleXText;
    let textTxY = axisXUnitY * symbolScaleXText;
    let textTyX = axisYUnitX * symbolScaleY;
    let textTyY = axisYUnitY * symbolScaleY;
    if (this.magicOpenAiMode && cell.precomputedEdges) {
      // Keep numbers on the same projected tangent as diamonds during swing.
      textTxX = rawPlaneTxX;
      textTxY = rawPlaneTxY;
      textTyX = rawPlaneTyX;
      textTyY = rawPlaneTyY;
    }
    const textDet = (textTxX * textTyY) - (textTxY * textTyX);
    if (textDet < 0) {
      // Keep glyphs readable (non-mirrored).
      textTxX *= -1;
      textTxY *= -1;
    }
    if (this.magicOpenAiMode && !cell.precomputedEdges && textTyY < 0) {
      // Prevent upside-down numbers at extreme rotations.
      textTxX *= -1;
      textTxY *= -1;
      textTyX *= -1;
      textTyY *= -1;
    }
    const symbolCellWidth = baseCellWidth * symbolCellScale;
    const symbolCellHeight = baseCellHeight * symbolCellScale;
    if (isBackSide) {
      // Keep numbers on outer-facing side only; diamonds are already drawn for all sectors.
      ctx.restore();
      if (cell.precomputedEdges) this.magicCameraYawRad = savedYaw;
      return;
    }
    ctx.transform(textTxX, textTxY, textTyX, textTyY, 0, 0);
    if (this.magicOpenAiMode) {
      ctx.rotate(Math.PI);
      if (!cell.precomputedEdges) {
        const symbolCenterY = (topCenter.y + bottomCenter.y) / 2;
        const rowsAboveCenter = Math.max(0, (reelCenterY - symbolCenterY) / Math.max(1, baseCellHeight));
        const rotationBands = Math.floor(rowsAboveCenter + 0.05);
        const extraDeg = Math.min(36, rotationBands * 10);
        if (extraDeg > 0) {
          ctx.rotate((extraDeg * Math.PI) / 180);
        }
      }
    }
    const symbolText = String(symbol ?? '');
    ctx.font = `700 ${this.getSymbolFontSizePx(symbolCellHeight, symbolText)}px "Lucida Sans Unicode", "Lucida Grande", sans-serif`;
    ctx.fillStyle = 'rgba(44, 29, 9, 0.98)';
    ctx.strokeStyle = 'rgba(19, 13, 4, 0.82)';
    ctx.lineWidth = Math.max(0.8, symbolCellHeight * 0.028);
    ctx.shadowColor = 'rgba(255, 236, 162, 0.98)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const symbolTextY = 0;
    ctx.strokeText(symbolText, 0, symbolTextY);
    ctx.fillText(symbolText, 0, symbolTextY);
    ctx.restore();

    // Restore camera yaw if it was overridden for precomputed edges.
    if (cell.precomputedEdges) {
      this.magicCameraYawRad = savedYaw;
    }
  }

  drawReelCell(cell, renderPass = 'full') {
    const ctx = this.ctx;
    if (!ctx) return;
    if (cell?.curved) {
      this.drawCurvedReelCell(cell, renderPass);
      return;
    }
    const {
      points,
      symbol,
      depthWeight,
      baseCellWidth,
      baseCellHeight,
      paylineHighlight = 0,
    } = cell;
    const [topLeft, topRight, bottomRight, bottomLeft] = points;

    const centerX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
    const centerY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;
    const topMidX = (topLeft.x + topRight.x) / 2;
    const topMidY = (topLeft.y + topRight.y) / 2;
    const bottomMidX = (bottomLeft.x + bottomRight.x) / 2;
    const bottomMidY = (bottomLeft.y + bottomRight.y) / 2;
    const leftMidX = (topLeft.x + bottomLeft.x) / 2;
    const leftMidY = (topLeft.y + bottomLeft.y) / 2;
    const rightMidX = (topRight.x + bottomRight.x) / 2;
    const rightMidY = (topRight.y + bottomRight.y) / 2;

    const projectedHeight = Math.hypot(bottomMidX - topMidX, bottomMidY - topMidY);
    const projectedWidth = Math.hypot(rightMidX - leftMidX, rightMidY - leftMidY);
    if (projectedHeight < 6 || projectedWidth < 8) return;

    const borderAlpha = 0.98;
    const edgeColor = this.lineColor || 'rgb(94, 61, 17)';
    const itemBackground = this.reelCellFillColor || 'rgba(62, 44, 19, 0.88)';
    const panelPoints = [topLeft, topRight, bottomRight, bottomLeft];

    ctx.save();
    this.drawPolygonPath(panelPoints);
    ctx.fillStyle = itemBackground;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = edgeColor;
    ctx.globalAlpha = borderAlpha;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.shadowBlur = 0;

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bottomLeft.x, bottomLeft.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.stroke();
    ctx.restore();

    // Diamond background below the symbol.
    ctx.save();
    this.drawFlatDiamondBadge(centerX, centerY, baseCellWidth, baseCellHeight, depthWeight, paylineHighlight);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(centerX, centerY);
    ctx.scale(projectedWidth / baseCellWidth, projectedHeight / baseCellHeight);
    const symbolText = String(symbol ?? '');
    ctx.font = `700 ${this.getSymbolFontSizePx(baseCellHeight, symbolText)}px "Lucida Sans Unicode", "Lucida Grande", sans-serif`;
    ctx.fillStyle = 'rgba(44, 29, 9, 0.98)';
    ctx.strokeStyle = 'rgba(19, 13, 4, 0.82)';
    ctx.lineWidth = Math.max(0.9, baseCellHeight * 0.03);
    ctx.shadowColor = 'rgba(255, 236, 162, 0.98)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeText(symbolText, 0, 0);
    ctx.fillText(symbolText, 0, 0);
    ctx.restore();
  }

  drawReelsCanvas() {
    const ctx = this.ctx;
    if (!ctx || !this.canvasWidth || !this.canvasHeight) return;

    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;
    const contentWidth = Math.max(1, this.canvasWidth - (padX * 2));
    const contentHeight = Math.max(1, this.canvasHeight - (padY * 2));
    const magicRenderScale = this.magicOpenAiMode ? 0.26 : 1;
    const reelAreaWidth = Math.max(1, contentWidth * magicRenderScale);
    const reelAreaHeight = Math.max(1, contentHeight * magicRenderScale);
    const reelAreaY = padY + ((contentHeight - reelAreaHeight) / 2);
    const baseReelWidth = reelAreaWidth / 5;
    const magicRingSeparationPx = 30;
    const reelSpacing = this.magicOpenAiMode
      ? (baseReelWidth + magicRingSeparationPx)
      : baseReelWidth;
    const reelSpanWidth = baseReelWidth + (reelSpacing * 4);
    const reelStartX = padX + ((contentWidth - reelSpanWidth) / 2);
    const reelWidth = baseReelWidth;
    const rowHeight = reelAreaHeight / 3;
    const reelCenterY = reelAreaY + (reelAreaHeight / 2);
    const reelSpringOffsets = Array.isArray(this.reelSpringOffsets) && this.reelSpringOffsets.length >= 5
      ? this.reelSpringOffsets
      : [0, 0, 0, 0, 0];
    const strip = Array.isArray(this.symbolStrip) && this.symbolStrip.length
      ? this.symbolStrip
      : this.buildNumberSymbols();

    const cellGapPx = 0;
    const seamOverlapPx = this.magicOpenAiMode ? 5 : 2;
    const reelUnitCount = Math.max(1, strip.length);
    const stepAngle = 360 / reelUnitCount;
    // Keep symbol indexing aligned with normal mode so magic starts at 0deg reel orientation.
    const magicSymbolPhaseOffset = 0;
    const baseCellWidth = reelWidth + seamOverlapPx;
    const baseCellPitch = rowHeight;
    const baseCellHeight = Math.max(18, baseCellPitch - cellGapPx + seamOverlapPx);

    if (this.rewardMode === 1 && !this.magicOpenAiMode) {
      for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
        const reelLeft = reelStartX + (reelIndex * reelSpacing);
        const reelCenterX = reelLeft + (reelWidth / 2);
        const reelYOffset = Number(reelSpringOffsets[reelIndex] || 0);
        const reelCenterYWithSpring = reelCenterY + reelYOffset;
        const rotation = this.renderRotations[reelIndex] || 0;
        const symbolOffset = -rotation / stepAngle;
        const baseIndex = Math.floor(symbolOffset);
        const fraction = symbolOffset - baseIndex;

        ctx.save();
        ctx.beginPath();
        ctx.rect(reelLeft, reelAreaY, reelWidth, reelAreaHeight);
        ctx.clip();

        for (let row = -5; row <= 5; row++) {
          const virtualIndex = baseIndex + row;
          const normalizedIndex = ((virtualIndex % strip.length) + strip.length) % strip.length;
          const symbol = strip[normalizedIndex];
          const centerY = reelCenterYWithSpring + ((row - fraction) * baseCellPitch);

          if (centerY < (reelAreaY - baseCellHeight) || centerY > (reelAreaY + reelAreaHeight + baseCellHeight)) {
            continue;
          }

          const halfW = baseCellWidth / 2;
          const halfH = baseCellHeight / 2;
          const points = [
            { x: reelCenterX - halfW, y: centerY - halfH },
            { x: reelCenterX + halfW, y: centerY - halfH },
            { x: reelCenterX + halfW, y: centerY + halfH },
            { x: reelCenterX - halfW, y: centerY + halfH },
          ];

          const distanceFromCenter = Math.abs(centerY - reelCenterYWithSpring);
          const depthWeight = Math.max(0.18, 1 - (distanceFromCenter / (baseCellPitch * 4)));

          this.drawReelCell({
            points,
            symbol,
            hue: this.getSymbolHue(symbol, normalizedIndex),
            depthWeight,
            baseCellWidth,
            baseCellHeight,
          });
        }

        const flatOverlay = ctx.createLinearGradient(0, reelAreaY, 0, reelAreaY + reelAreaHeight);
        flatOverlay.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
        flatOverlay.addColorStop(0.22, 'rgba(0, 0, 0, 0.04)');
        flatOverlay.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
        flatOverlay.addColorStop(0.78, 'rgba(0, 0, 0, 0.04)');
        flatOverlay.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        ctx.fillStyle = flatOverlay;
        ctx.fillRect(reelLeft, reelAreaY, reelWidth, reelAreaHeight);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const x = reelStartX + (reelSpacing * i);
        ctx.beginPath();
        ctx.moveTo(x, reelAreaY);
        ctx.lineTo(x, reelAreaY + reelAreaHeight);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Desandro carousel radius formula: (cellSize / 2) / tan(PI / numberOfCells)
    const radiusBase = (baseCellPitch / 2) / Math.tan(Math.PI / strip.length);
    const radiusScale = this.magicOpenAiMode ? 0.78 : 1.08;
    const radius = Math.max(12, radiusBase * radiusScale);
    const perspective = this.magicOpenAiMode
      ? Math.max(2400, radius * 10)
      : 1000;
    const wheelVerticalClipPadding = this.magicOpenAiMode
      ? Math.max(baseCellHeight * 2.2, reelAreaHeight * 1.35)
      : (
        this.rewardMode === 2
          ? Math.max(8, baseCellHeight * 0.42)
          : 0
      );
    const wheelHorizontalClipPadding = this.magicOpenAiMode
      ? Math.max(12, reelWidth * 0.45)
      : 0;
    const magicYawCenterCompensationX = this.magicOpenAiMode
      ? (Math.sin(Number(this.magicCameraYawRad) || 0) * radius * 0.72)
      : 0;
    const reelCentersX = Array.from({ length: 5 }, (_, reelIndex) => (
      reelStartX + (reelIndex * reelSpacing) + (reelWidth / 2) + magicYawCenterCompensationX
    ));

    if (this.magicOpenAiMode) {
      this.drawMagicWorldReels(
        reelStartX, reelSpacing, reelWidth, reelAreaY, reelAreaHeight,
        reelCenterY, baseCellWidth, baseCellHeight, baseCellPitch,
        radius, perspective, reelUnitCount, stepAngle,
        magicSymbolPhaseOffset, strip, reelSpringOffsets,
      );
      return;
    }

    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      const reelLeft = reelStartX + (reelIndex * reelSpacing);
      const reelCenterX = reelCentersX[reelIndex];
      const reelYOffset = Number(reelSpringOffsets[reelIndex] || 0);
      const reelCenterYWithSpring = reelCenterY + reelYOffset;
      const angleSpanRad = ((Math.PI * 2) / reelUnitCount) * (this.magicOpenAiMode ? 1 : 1);

      ctx.save();
      ctx.beginPath();
      if (this.magicOpenAiMode) {
        ctx.rect(0, 0, this.canvasWidth, this.canvasHeight);
      } else {
        ctx.rect(
          reelLeft - wheelHorizontalClipPadding,
          reelAreaY - wheelVerticalClipPadding,
          reelWidth + (wheelHorizontalClipPadding * 2),
          reelAreaHeight + (wheelVerticalClipPadding * 2),
        );
      }
      ctx.clip();

      const cells = [];
      for (let idx = 0; idx < reelUnitCount; idx++) {
        const mappedIndex = ((idx + magicSymbolPhaseOffset) % reelUnitCount + reelUnitCount) % reelUnitCount;
        const mappedSymbol = strip[mappedIndex];
        const angleDeg = (this.renderRotations[reelIndex] || 0) + (idx * stepAngle);
        const angleRad = angleDeg * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        const halfW = baseCellWidth / 2;
        const halfH = baseCellHeight / 2;
        const corners2d = [];
        const cornerDepths = [];
        const localCorners = [
          { x: -halfW, y: -halfH },
          { x: halfW, y: -halfH },
          { x: halfW, y: halfH },
          { x: -halfW, y: halfH },
        ];

        for (let cornerIndex = 0; cornerIndex < localCorners.length; cornerIndex++) {
          const localCorner = localCorners[cornerIndex];
          const y3d = (localCorner.y * cosAngle) - (radius * sinAngle);
          const z3d = (localCorner.y * sinAngle) + (radius * cosAngle) - radius;
          cornerDepths.push(z3d);
          corners2d.push(this.projectPoint3D(
            localCorner.x,
            y3d,
            z3d,
            reelCenterX,
            reelCenterYWithSpring,
            perspective,
          ));
        }

        const averageDepth = (cornerDepths[0] + cornerDepths[1] + cornerDepths[2] + cornerDepths[3]) / 4;
        cells.push({
          unitIndex: idx,
          z: averageDepth,
          curved: true,
          angleRad,
          angleSpanRad,
          radius,
          reelCenterX,
          reelCenterY: reelCenterYWithSpring,
          perspective,
          points: corners2d,
          baseCellWidth,
          baseCellHeight,
          symbol: mappedSymbol,
          hue: this.getSymbolHue(mappedSymbol, mappedIndex),
          depthWeight: Math.max(0, Math.min(1, 1 - (Math.abs(averageDepth) / (radius * 2.2)))),
        });
      }

      cells.sort((left, right) => {
        if (left.z !== right.z) return left.z - right.z;
        return (left.unitIndex || 0) - (right.unitIndex || 0);
      });
      for (let i = 0; i < cells.length; i++) {
        this.drawReelCell(cells[i]);
      }

      if (!this.magicOpenAiMode) {
        const vignette = ctx.createLinearGradient(0, reelAreaY, 0, reelAreaY + reelAreaHeight);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
        vignette.addColorStop(0.2, 'rgba(0, 0, 0, 0.06)');
        vignette.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
        vignette.addColorStop(0.8, 'rgba(0, 0, 0, 0.06)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
        ctx.fillStyle = vignette;
        ctx.fillRect(reelLeft, reelAreaY, reelWidth, reelAreaHeight);
      }

      ctx.restore();
    }

    if (!this.magicOpenAiMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const x = reelStartX + (reelSpacing * i);
        ctx.beginPath();
        ctx.moveTo(x, reelAreaY);
        ctx.lineTo(x, reelAreaY + reelAreaHeight);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawMagicWorldReels(
    reelStartX, reelSpacing, reelWidth, reelAreaY, reelAreaHeight,
    reelCenterY, baseCellWidth, baseCellHeight, baseCellPitch,
    radius, perspective, reelUnitCount, stepAngle,
    magicSymbolPhaseOffset, strip, reelSpringOffsets,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;

    const baseYaw = Number(this.magicCameraYawRad) || 0;
    const swingRad = this.magicSwingAngleRad || 0;
    const totalYaw = baseYaw + swingRad;
    const pitchRad = Number(this.magicCameraPitchRad) || 0;
    const depthOff = Number(this.magicCameraDepthOffset) || 0;
    const angleSpanRad = (Math.PI * 2) / reelUnitCount;
    const segments = 40;
    const halfW = baseCellWidth / 2;
    const yawCos = Math.cos(totalYaw);
    const pitchCos = Math.cos(pitchRad);
    const pitchSin = Math.sin(pitchRad);
    const yawFacingSign = yawCos >= 0 ? 1 : -1;
    const backFaceThreshold = 0.03;
    const worldCells = [];

    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      const reelCenterX = reelStartX + (reelIndex * reelSpacing) + (reelWidth / 2);
      const reelYOffset = Number(reelSpringOffsets[reelIndex] || 0);
      const reelCenterYWithSpring = reelCenterY + reelYOffset;
      const reelCells = [];

      // Precompute all 22 boundary polylines (shared between adjacent cells).
      const boundaryPolylines = [];
      for (let b = 0; b < reelUnitCount; b++) {
        const rotDeg = this.renderRotations[reelIndex] || 0;
        const rotRad = rotDeg * (Math.PI / 180);
        const boundaryAngle = rotRad + ((b + 0.5) * angleSpanRad);

        const bY = -radius * Math.sin(boundaryAngle);
        const bZ = (radius * Math.cos(boundaryAngle)) - radius;

        const leftPt = this.projectWorldPoint(
          -halfW, bY, bZ,
          reelCenterX, reelCenterYWithSpring, perspective,
          totalYaw, pitchRad, depthOff,
        );
        const rightPt = this.projectWorldPoint(
          halfW, bY, bZ,
          reelCenterX, reelCenterYWithSpring, perspective,
          totalYaw, pitchRad, depthOff,
        );
        boundaryPolylines.push({
          left: leftPt,
          right: rightPt,
        });
      }

      // Build cells with shared boundary edges.
      for (let idx = 0; idx < reelUnitCount; idx++) {
        const mappedIndex = ((idx + magicSymbolPhaseOffset) % reelUnitCount + reelUnitCount) % reelUnitCount;
        const mappedSymbol = strip[mappedIndex];
        const rotDeg = this.renderRotations[reelIndex] || 0;
        const rotRad = rotDeg * (Math.PI / 180);
        const cellAngleRad = rotRad + (idx * angleSpanRad);

        // Top boundary = boundary idx, bottom boundary = boundary (idx+1) % count.
        const topBoundary = boundaryPolylines[idx];
        const bottomBoundary = boundaryPolylines[(idx + 1) % reelUnitCount];

        // Build edge arrays: first sample is the shared top boundary,
        // last sample is the shared bottom boundary, interior is per-cell.
        const leftEdge = [topBoundary.left];
        const rightEdge = [topBoundary.right];
        const centerEdge = [{
          x: (topBoundary.left.x + topBoundary.right.x) / 2,
          y: (topBoundary.left.y + topBoundary.right.y) / 2,
        }];

        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const angle = cellAngleRad + ((0.5 - t) * angleSpanRad);
          const sY = -radius * Math.sin(angle);
          const sZ = (radius * Math.cos(angle)) - radius;

          const left = this.projectWorldPoint(
            -halfW, sY, sZ,
            reelCenterX, reelCenterYWithSpring, perspective,
            totalYaw, pitchRad, depthOff,
          );
          const right = this.projectWorldPoint(
            halfW, sY, sZ,
            reelCenterX, reelCenterYWithSpring, perspective,
            totalYaw, pitchRad, depthOff,
          );
          leftEdge.push(left);
          rightEdge.push(right);
          centerEdge.push({
            x: (left.x + right.x) / 2,
            y: (left.y + right.y) / 2,
          });
        }

        // Last sample = shared bottom boundary.
        leftEdge.push(bottomBoundary.left);
        rightEdge.push(bottomBoundary.right);
        centerEdge.push({
          x: (bottomBoundary.left.x + bottomBoundary.right.x) / 2,
          y: (bottomBoundary.left.y + bottomBoundary.right.y) / 2,
        });

        // Compute average depth for sorting within this reel.
        const topZ = (((topBoundary.left.viewZ || 0) + (topBoundary.right.viewZ || 0)) / 2);
        const bottomZ = (((bottomBoundary.left.viewZ || 0) + (bottomBoundary.right.viewZ || 0)) / 2);
        const averageDepth = (topZ + bottomZ) / 2;
        const normalY = -Math.sin(cellAngleRad);
        const normalZ = Math.cos(cellAngleRad);
        const yawedNormalZ = normalZ * yawCos;
        const pitchedNormalZ = (normalY * pitchSin) + (yawedNormalZ * pitchCos);
        const faceTowardsCamera = pitchedNormalZ * yawFacingSign;
        const isBackSide = faceTowardsCamera <= backFaceThreshold;

        reelCells.push({
          unitIndex: idx,
          reelIndex,
          z: averageDepth,
          faceTowardsCamera,
          isBackSide,
          curved: true,
          angleRad: cellAngleRad,
          angleSpanRad,
          radius,
          reelCenterX,
          reelCenterY: reelCenterYWithSpring,
          perspective,
          baseCellWidth,
          baseCellHeight,
          symbol: mappedSymbol,
          hue: this.getSymbolHue(mappedSymbol, mappedIndex),
          depthWeight: Math.max(0, Math.min(1, 1 - (Math.abs(averageDepth) / (radius * 2.2)))),
          totalYawRad: totalYaw,
          precomputedEdges: {
            leftEdge,
            rightEdge,
            centerEdge,
          },
        });
      }
      for (let i = 0; i < reelCells.length; i++) {
        worldCells.push(reelCells[i]);
      }
    }

    // Rotation state from motion direction (delta swing per frame),
    // with angle fallback near startup/static frames.
    const swingSideValue = Number(swingRad) || 0;
    const prevSwing = Number(this.magicLastRenderedSwingRad);
    const hasPrevSwing = Number.isFinite(prevSwing);
    const swingDelta = hasPrevSwing ? (swingSideValue - prevSwing) : 0;
    const motionThreshold = 0.0006;
    if (swingDelta > motionThreshold) {
      this.magicSwingMotionDirection = 1;
    } else if (swingDelta < -motionThreshold) {
      this.magicSwingMotionDirection = -1;
    }
    const crossedNeutralThisFrame = hasPrevSwing
      && ((prevSwing < 0 && swingSideValue > 0) || (prevSwing > 0 && swingSideValue < 0));
    const neutralInstantEpsilon = 0.000001;
    const isNeutralInstant = crossedNeutralThisFrame
      || (Math.abs(swingSideValue) <= neutralInstantEpsilon);
    this.magicLastRenderedSwingRad = swingSideValue;
    // Spatial facing must drive painter priorities. Using motion direction here
    // causes priority flip exactly at swing extremes when delta changes sign.
    const faceLeft = !isNeutralInstant && swingSideValue < 0;
    const faceRight = !isNeutralInstant && swingSideValue > 0;

    // Global painter's order:
    // 1) reel stack order (depends on left/right state)
    // 2) back-facing sectors first within each reel
    // 3) farther sectors first
    // 4) stable tie-breakers
    worldCells.sort((a, b) => {
      const reelRankA = faceRight ? (4 - a.reelIndex) : a.reelIndex;
      const reelRankB = faceRight ? (4 - b.reelIndex) : b.reelIndex;
      if (reelRankA !== reelRankB) {
        return reelRankA - reelRankB;
      }
      if (a.isBackSide !== b.isBackSide) {
        return a.isBackSide ? -1 : 1;
      }
      if (a.z !== b.z) return a.z - b.z;
      if (a.faceTowardsCamera !== b.faceTowardsCamera) {
        return a.faceTowardsCamera - b.faceTowardsCamera;
      }
      if (a.reelIndex !== b.reelIndex) return a.reelIndex - b.reelIndex;
      return (a.unitIndex || 0) - (b.unitIndex || 0);
    });

    // Draw smooth reel contours first; ring faces are drawn afterward so lines that
    // are spatially behind the ring surface stay hidden.
    // Outer/inner, left/right contours keep ring silhouettes clean while swinging.
    const ringWallThickness = Math.max(12, baseCellHeight * 0.32);
    const innerRadius = Math.max(6, radius - ringWallThickness);
    const contourSamples = 96;
    const contourLoops = [];
    const projectContourPoint = (
      reelCenterX,
      reelCenterY,
      xLocal,
      loopRadius,
      angle,
      depthAnchorRadius,
    ) => {
      const y = -loopRadius * Math.sin(angle);
      const z = (loopRadius * Math.cos(angle)) - depthAnchorRadius;
      return this.projectWorldPoint(
        xLocal,
        y,
        z,
        reelCenterX,
        reelCenterY,
        perspective,
        totalYaw,
        pitchRad,
        depthOff,
      );
    };
    const buildContourLoop = (
      reelCenterX,
      reelCenterY,
      rotRad,
      xLocal,
      loopRadius,
      depthAnchorRadius,
    ) => {
      const points = [];
      for (let i = 0; i < contourSamples; i++) {
        const t = i / contourSamples;
        const angle = rotRad + (t * Math.PI * 2);
        const point = projectContourPoint(
          reelCenterX,
          reelCenterY,
          xLocal,
          loopRadius,
          angle,
          depthAnchorRadius,
        );
        const normalY = -Math.sin(angle);
        const normalZ = Math.cos(angle);
        const yawedNormalZ = normalZ * yawCos;
        const pitchedNormalZ = (normalY * pitchSin) + (yawedNormalZ * pitchCos);
        points.push({
          ...point,
          normalViewZ: pitchedNormalZ,
        });
      }
      return points;
    };

    const contourGapFill = this.colorWithAlpha(
      this.reelCellFillColor || 'rgba(208, 156, 61, 1)',
      1,
    );

    const drawLoopSegments = (points) => {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.stroke();
    };
    const drawLoop = (points) => {
      drawLoopSegments(points);
    };
    const drawAnnulusFill = (outerPoints, innerPoints) => {
      if (!outerPoints.length || !innerPoints.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = contourGapFill;
      ctx.beginPath();
      ctx.moveTo(outerPoints[0].x, outerPoints[0].y);
      for (let i = 1; i < outerPoints.length; i++) {
        ctx.lineTo(outerPoints[i].x, outerPoints[i].y);
      }
      ctx.closePath();
      const innerLastIndex = innerPoints.length - 1;
      ctx.moveTo(innerPoints[innerLastIndex].x, innerPoints[innerLastIndex].y);
      for (let i = innerLastIndex - 1; i >= 0; i--) {
        ctx.lineTo(innerPoints[i].x, innerPoints[i].y);
      }
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();
    };

    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      const reelCenterX = reelStartX + (reelIndex * reelSpacing) + (reelWidth / 2);
      const reelYOffset = Number(reelSpringOffsets[reelIndex] || 0);
      const reelCenterYWithSpring = reelCenterY + reelYOffset;
      const rotDeg = this.renderRotations[reelIndex] || 0;
      const rotRad = rotDeg * (Math.PI / 180);

      const outerLeft = buildContourLoop(
        reelCenterX,
        reelCenterYWithSpring,
        rotRad,
        -halfW,
        radius,
        radius,
      );
      const outerRight = buildContourLoop(
        reelCenterX,
        reelCenterYWithSpring,
        rotRad,
        halfW,
        radius,
        radius,
      );
      const innerLeft = buildContourLoop(
        reelCenterX,
        reelCenterYWithSpring,
        rotRad,
        -halfW,
        innerRadius,
        radius,
      );
      const innerRight = buildContourLoop(
        reelCenterX,
        reelCenterYWithSpring,
        rotRad,
        halfW,
        innerRadius,
        radius,
      );

      // Bridge points between the two large outer side ellipses (top + bottom),
      // using projected extrema so connectors stay on visible top/bottom edges.
      const getMinYPoint = (points) => points.reduce(
        (best, point) => (point.y < best.y ? point : best),
        points[0],
      );
      const getMaxYPoint = (points) => points.reduce(
        (best, point) => (point.y > best.y ? point : best),
        points[0],
      );
      const outerLeftTop = getMinYPoint(outerLeft);
      const outerRightTop = getMinYPoint(outerRight);
      const outerLeftBottom = getMaxYPoint(outerLeft);
      const outerRightBottom = getMaxYPoint(outerRight);

      contourLoops.push({
        reelIndex,
        reelCenterX,
        outerLeft,
        outerRight,
        innerLeft,
        innerRight,
        outerLeftTop,
        outerRightTop,
        outerLeftBottom,
        outerRightBottom,
      });
    }

    // Draw per-reel (back -> front): low-priority full side ellipses first,
    // then ring surfaces, then high-priority side ellipses last.
    const sideLoopKeys = {
      left: ['outerLeft', 'innerLeft'],
      right: ['outerRight', 'innerRight'],
    };
    const allLoopKeys = ['outerLeft', 'outerRight', 'innerLeft', 'innerRight'];
    const drawNamedLoops = (loops, keys) => {
      for (let j = 0; j < keys.length; j++) {
        const loop = loops[keys[j]];
        if (!Array.isArray(loop) || !loop.length) continue;
        drawLoop(loop);
      }
    };
    const drawConnector = (fromPoint, toPoint) => {
      if (!fromPoint || !toPoint) return;
      ctx.beginPath();
      ctx.moveTo(fromPoint.x, fromPoint.y);
      ctx.lineTo(toPoint.x, toPoint.y);
      ctx.stroke();
    };

    const cellsByReel = new Map();
    for (let i = 0; i < worldCells.length; i++) {
      const cell = worldCells[i];
      if (!cellsByReel.has(cell.reelIndex)) {
        cellsByReel.set(cell.reelIndex, []);
      }
      cellsByReel.get(cell.reelIndex).push(cell);
    }
    const loopsByReel = new Map();
    for (let i = 0; i < contourLoops.length; i++) {
      const loops = contourLoops[i];
      loopsByReel.set(loops.reelIndex, loops);
    }
    const overlayReelOrder = faceRight
      ? [4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4];
    for (let i = 0; i < overlayReelOrder.length; i++) {
      const reelIndex = overlayReelOrder[i];
      const reelCells = cellsByReel.get(reelIndex) || [];
      const loops = loopsByReel.get(reelIndex);
      if (!loops) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(22, 13, 4, 1)';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowBlur = 0;

      // Minimal-priority side (drawn first): visible only where not covered later.
      const minimalSide = faceRight ? 'right' : (faceLeft ? 'left' : null);
      const prioritySide = faceRight ? 'left' : (faceLeft ? 'right' : null);
      const minimalLoopKeys = minimalSide ? sideLoopKeys[minimalSide] : [];
      const priorityLoopKeys = prioritySide ? sideLoopKeys[prioritySide] : [];
      const baseLoopKeys = allLoopKeys.filter((key) => (
        !minimalLoopKeys.includes(key) && !priorityLoopKeys.includes(key)
      ));
      if (minimalSide) {
        drawNamedLoops(loops, minimalLoopKeys);
      }
      ctx.restore();

      // Fill side/gap surfaces after minimal lines, so minimal side truly stays behind.
      drawAnnulusFill(loops.outerLeft, loops.innerLeft);
      drawAnnulusFill(loops.outerRight, loops.innerRight);

      for (let cellIndex = 0; cellIndex < reelCells.length; cellIndex++) {
        this.drawReelCell(reelCells[cellIndex], 'geometry');
      }
      for (let cellIndex = 0; cellIndex < reelCells.length; cellIndex++) {
        this.drawReelCell(reelCells[cellIndex], 'overlay');
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(22, 13, 4, 1)';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowBlur = 0;
      if (prioritySide) {
        drawNamedLoops(loops, baseLoopKeys);
      }
      drawConnector(loops.outerLeftTop, loops.outerRightTop);
      drawConnector(loops.outerLeftBottom, loops.outerRightBottom);

      if (prioritySide) {
        drawNamedLoops(loops, priorityLoopKeys);
      } else {
        // Neutral: all side ellipses are drawn last with total priority.
        drawNamedLoops(loops, allLoopKeys);
      }
      ctx.restore();
    }

  }

  drawJokerSprite(x, y) {
    if (!this.ctx || !this.img || !this.jokerImageLoaded) return;
    if (!this.cellHalfWidth || !this.cellHalfHeight) return;

    const imageWidth = this.img.width;
    const imageHeight = this.img.height;
    if (!imageWidth || !imageHeight) return;

    const baseScale = Math.min(
      (2 * this.cellHalfWidth) / imageWidth,
      (2 * this.cellHalfHeight) / imageHeight,
    );
    // Keep joker 10% smaller while staying centered in the selected cell.
    const scale = baseScale * 0.9;

    const drawX = x + ((2 * this.cellHalfWidth - (imageWidth * scale)) / 2);
    const drawY = y + ((2 * this.cellHalfHeight - (imageHeight * scale)) / 2);
    this.ctx.drawImage(this.img, drawX, drawY, imageWidth * scale, imageHeight * scale);
  }

  getCellOriginFromGridPosition(gridPos) {
    if (!Number.isFinite(gridPos) || gridPos < 0 || gridPos > 14) {
      return null;
    }

    const row = Math.floor(gridPos / 5);
    const col = gridPos % 5;
    return {
      x: this.spinnerPaddingLeft + (this.cellHalfWidth * 2 * col),
      y: this.spinnerPaddingTop + (this.cellHalfHeight * 2 * row),
    };
  }

  syncJokerCanvasPositionFromSelection() {
    if (!this.jokerPosition || this.jokerPosition <= 0) return;
    const origin = this.getCellOriginFromGridPosition(this.jokerPosition - 1);
    if (!origin) return;
    this.jokerCanvasX = origin.x;
    this.jokerCanvasY = origin.y;
  }

  drawJokerSelectionBoxes() {
    if (!this.ctx) return;
    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;

    this.ctx.save();
    this.ctx.strokeStyle = '#3c0081';
    this.ctx.shadowColor = 'black';
    this.ctx.shadowBlur = 18;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    for (let i = 0; i < 15; i++) {
      if (this.validJokerPositions[i] !== 1) continue;
      let x;
      let y;

      if (i < 5) {
        x = padX + this.cellHalfWidth * 2 * i;
        y = padY;
      } else if (i < 10) {
        x = padX + this.cellHalfWidth * 2 * (i - 5);
        y = padY + this.cellHalfHeight * 2;
      } else {
        x = padX + this.cellHalfWidth * 2 * (i - 10);
        y = padY + this.cellHalfHeight * 4;
      }

      this.ctx.beginPath();
      this.ctx.rect(x, y, this.cellHalfWidth * 2, this.cellHalfHeight * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  renderFrame() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.drawReelsCanvas();

    // Keep paylines as top layer in 3x5 mode during and outside spin.
    if (!this.magicOpenAiMode) {
      this.lineCheck();
      if (this.jokerSelectionActive) {
        this.drawJokerSelectionBoxes();
      }

      // Joker should always stay visible and top-most until explicitly removed.
      if (this.jokerPosition > 0 && (this.jokerAdded || this.jokerSelectionActive)) {
        this.syncJokerCanvasPositionFromSelection();
        this.drawJokerSprite(this.jokerCanvasX, this.jokerCanvasY);
      }
    }

    if (this.webglEnabled) {
      this.presentWebGLFrame();
    }
  }

  createOddsTables() {
    // Use default symbols and odds for initial game type (1 = Numbers)
    const symbols = this.getSymbolSetForGameType(this.gameTypeValue || 1);
    const odds = this.getOddsForGameType(this.gameTypeValue || 1);
    this.updateOddsTables(symbols, odds);
  }

  bindEvents() {
    this.shadowRoot.getElementById('startBtn').addEventListener('click', () => this.startSpin());
    this.shadowRoot.getElementById('stopBtn').addEventListener('click', () => this.stopSpin());
    const jokerToggleButton = this.shadowRoot.getElementById('jokerCheckbox');
    if (jokerToggleButton) {
      jokerToggleButton.addEventListener('click', () => {
        if (jokerToggleButton.disabled) return;
        const shouldEnable = !jokerToggleButton.classList.contains('active');
        this.toggleJoker(shouldEnable);
      });
    }
    this.shadowRoot.getElementById('confirmJokerBtn').addEventListener('click', () => this.confirmJoker());
    this.shadowRoot.getElementById('removeJokerBtn').addEventListener('click', () => this.removeJoker());
    this.shadowRoot.getElementById('gameTypeBtn').addEventListener('click', () => this.cycleGameType());
    this.shadowRoot.getElementById('rewardModeBtn').addEventListener('click', () => this.cycleRewardMode());
    this.shadowRoot.getElementById('betBtn').addEventListener('click', () => this.cycleBet());
    this.shadowRoot.getElementById('slotMenuGame').addEventListener('click', () => this.setMenuView('game'));
    this.shadowRoot.getElementById('slotMenuRules').addEventListener('click', () => this.setMenuView('rules'));
    this.shadowRoot.getElementById('slotMenuHistory').addEventListener('click', () => {
      this.setMenuView('history');
      void this.loadHistoryPage(this.historyPage || 1);
    });

    const historyPagination = this.shadowRoot.getElementById('slotHistoryPagination');
    if (historyPagination) {
      historyPagination.addEventListener('click', (event) => {
        const trigger = event.target.closest('button[data-page]');
        if (!trigger) return;
        const page = Number.parseInt(trigger.getAttribute('data-page') || '', 10);
        if (!Number.isFinite(page)) return;
        void this.loadHistoryPage(page);
      });
    }

    const pageInput = this.shadowRoot.getElementById('slotHistoryPageInput');
    this.shadowRoot.getElementById('slotHistoryGoPage').addEventListener('click', () => {
      const page = Number.parseInt(pageInput.value || '', 10);
      if (!Number.isFinite(page)) return;
      void this.loadHistoryPage(page);
    });
    pageInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const page = Number.parseInt(pageInput.value || '', 10);
      if (!Number.isFinite(page)) return;
      void this.loadHistoryPage(page);
    });

    const magicButton = this.shadowRoot.getElementById('magicOpenAiBtn');
    if (magicButton) {
      magicButton.addEventListener('click', () => this.toggleMagicOpenAiMode());
    }
    const magicBackButton = this.shadowRoot.getElementById('magicOpenAiBackBtn');
    if (magicBackButton) {
      magicBackButton.addEventListener('click', () => this.toggleMagicOpenAiMode(false));
    }
    if (this.rootElement) {
      this.rootElement.addEventListener('click', (event) => {
        const trigger = event.target?.closest?.('#magicOpenAiBackBtn');
        if (!trigger) return;
        event.preventDefault();
        this.toggleMagicOpenAiMode(false);
      });
    }

    window.addEventListener('resize', () => this.initCanvas());
  }

  startMagicSwingAnimation() {
    this.stopMagicSwingAnimation();
    this.magicSwingStartTime = performance.now();
    this.magicSwingDebugState = null;
    this.magicLastRenderedSwingRad = null;
    this.magicSwingMotionDirection = 0;
    const loop = (now) => {
      const elapsed = (now - this.magicSwingStartTime) / 1000;
      const speed = Math.max(0.0001, this.magicSwingSpeedRadPerSec);
      const quarterPeriod = Math.PI / (2 * speed);
      const startupLeftDuration = quarterPeriod;
      const startupRightDuration = quarterPeriod * 2;

      if (elapsed <= startupLeftDuration) {
        // 0deg -> initial left swing.
        const t = Math.max(0, Math.min(1, elapsed / startupLeftDuration));
        this.magicSwingAngleRad = -this.magicInitialLeftSwingRad * Math.sin((Math.PI / 2) * t);
      } else if (elapsed <= startupLeftDuration + startupRightDuration) {
        // Initial left swing -> full right swing, then continue steady +/-amplitude oscillation.
        const t = (elapsed - startupLeftDuration) / startupRightDuration;
        const from = -this.magicInitialLeftSwingRad;
        const to = this.magicSwingAmplitudeRad;
        const mid = (from + to) / 2;
        const amp = (to - from) / 2;
        this.magicSwingAngleRad = mid - (amp * Math.cos(Math.PI * t));
      } else {
        // Steady oscillation: +amplitude -> -amplitude -> +amplitude ...
        const steadyElapsed = elapsed - startupLeftDuration - startupRightDuration;
        this.magicSwingAngleRad = this.magicSwingAmplitudeRad * Math.cos(speed * steadyElapsed);
      }

      const swingStateThreshold = 0.000001;
      let swingState = 'neutral';
      if (this.magicSwingAngleRad < -swingStateThreshold) {
        swingState = 'left';
      } else if (this.magicSwingAngleRad > swingStateThreshold) {
        swingState = 'right';
      }
      if (swingState !== this.magicSwingDebugState) {
        const swingDeg = (this.magicSwingAngleRad * 180) / Math.PI;
        console.log(
          `[magic-swing] state=${swingState} angleDeg=${swingDeg.toFixed(2)} `
          + `(left=negative angle, right=positive angle)`,
        );
        this.magicSwingDebugState = swingState;
      }

      // Only call renderFrame if no spin animation is running (avoids double-render).
      if (!this.reelAnimationFrame) {
        this.renderFrame();
      }
      this.magicSwingAnimationFrame = requestAnimationFrame(loop);
    };
    this.magicSwingAnimationFrame = requestAnimationFrame(loop);
  }

  stopMagicSwingAnimation() {
    if (this.magicSwingAnimationFrame) {
      cancelAnimationFrame(this.magicSwingAnimationFrame);
      this.magicSwingAnimationFrame = null;
    }
    this.magicSwingAngleRad = 0;
    this.magicSwingDebugState = null;
    this.magicLastRenderedSwingRad = null;
    this.magicSwingMotionDirection = 0;
  }

  toggleMagicOpenAiMode(forceState = null) {
    const isForcedState = typeof forceState === 'boolean';
    const nextState = typeof forceState === 'boolean' ? forceState : !this.magicOpenAiMode;
    const hadSameState = this.magicOpenAiMode === nextState;
    if (!isForcedState && hadSameState) {
      return;
    }
    const wasMagicMode = this.magicOpenAiMode;
    this.magicOpenAiMode = nextState;

    if (this.magicOpenAiMode && !wasMagicMode) {
      this.magicOpenAiPrevView = this.activeMenuView || 'game';
      this.magicOpenAiPrevBodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      this.startMagicSwingAnimation();
    } else if (!this.magicOpenAiMode && wasMagicMode) {
      this.stopMagicSwingAnimation();
      document.body.style.overflow = this.magicOpenAiPrevBodyOverflow || '';
    } else if (!this.magicOpenAiMode && hadSameState) {
      // Forced cleanup when classes and state drift out of sync.
      document.body.style.overflow = this.magicOpenAiPrevBodyOverflow || '';
    }

    if (this.rootElement) {
      this.rootElement.classList.toggle('magic-openai-fullscreen', this.magicOpenAiMode);
    }
    const slotGame = this.shadowRoot.querySelector('.slot-game');
    if (slotGame) {
      slotGame.classList.toggle('magic-openai-fullscreen', this.magicOpenAiMode);
    }

    if (this.canvas) {
      this.canvas.classList.toggle('magic-openai-active', this.magicOpenAiMode);
    }

    const magicButton = this.shadowRoot.getElementById('magicOpenAiBtn');
    if (magicButton) {
      magicButton.classList.toggle('active', this.magicOpenAiMode);
      magicButton.setAttribute('aria-pressed', this.magicOpenAiMode ? 'true' : 'false');
    }
    const magicBackButton = this.shadowRoot.getElementById('magicOpenAiBackBtn');
    if (magicBackButton) {
      magicBackButton.setAttribute('aria-hidden', this.magicOpenAiMode ? 'false' : 'true');
    }

    if (this.activeMenuView !== 'game') {
      this.setMenuView('game');
    }

    this.initCanvas();
    this.renderFrame();
  }

  setMenuView(view) {
    this.activeMenuView = view;

    const viewGame = this.shadowRoot.getElementById('slotViewGame');
    const viewRules = this.shadowRoot.getElementById('slotViewRules');
    const viewHistory = this.shadowRoot.getElementById('slotViewHistory');
    if (viewGame) viewGame.hidden = view !== 'game';
    if (viewRules) viewRules.hidden = view !== 'rules';
    if (viewHistory) viewHistory.hidden = view !== 'history';

    const btnGame = this.shadowRoot.getElementById('slotMenuGame');
    const btnRules = this.shadowRoot.getElementById('slotMenuRules');
    const btnHistory = this.shadowRoot.getElementById('slotMenuHistory');
    const map = [
      [btnGame, 'game'],
      [btnRules, 'rules'],
      [btnHistory, 'history'],
    ];
    for (let i = 0; i < map.length; i += 1) {
      const [btn, key] = map[i];
      if (!btn) continue;
      const isActive = view === key;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  }

  escapeHistoryCell(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  formatHistoryTimestamp(value) {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value || '-');
      return date.toLocaleString();
    } catch {
      return String(value || '-');
    }
  }

  getHistoryPageWindow() {
    const total = Math.max(1, this.historyTotalPages);
    const current = Math.min(total, Math.max(1, this.historyPage));
    const maxButtons = 5;

    let start = 1;
    if (total > maxButtons) {
      if (current <= 2) {
        start = 1;
      } else if (current >= total - 1) {
        start = total - (maxButtons - 1);
      } else {
        start = current - 2;
      }
    }

    const pages = [];
    for (let i = 0; i < maxButtons; i += 1) {
      const page = start + i;
      if (page > total) break;
      pages.push(page);
    }
    return pages;
  }

  renderHistoryView(errorMessage = '') {
    const statusEl = this.shadowRoot.getElementById('slotHistoryStatus');
    const tableWrap = this.shadowRoot.getElementById('slotHistoryTableWrap');
    const paginationEl = this.shadowRoot.getElementById('slotHistoryPagination');
    const pageInput = this.shadowRoot.getElementById('slotHistoryPageInput');
    const goBtn = this.shadowRoot.getElementById('slotHistoryGoPage');

    if (!statusEl || !tableWrap || !paginationEl || !pageInput || !goBtn) {
      return;
    }

    if (errorMessage) {
      statusEl.textContent = errorMessage;
      tableWrap.innerHTML = '';
      paginationEl.innerHTML = '';
      goBtn.disabled = true;
      return;
    }

    if (this.historyLoading) {
      statusEl.textContent = 'Loading history...';
      goBtn.disabled = true;
      return;
    }

    if (!this.historyItems.length) {
      statusEl.textContent = 'No spins found for this user yet.';
      tableWrap.innerHTML = '';
      paginationEl.innerHTML = '';
      pageInput.value = '1';
      pageInput.max = '1';
      goBtn.disabled = true;
      return;
    }

    const startIndex = (this.historyPage - 1) * HISTORY_PAGE_SIZE + 1;
    const endIndex = Math.min(this.historyPage * HISTORY_PAGE_SIZE, this.historyTotalItems);
    statusEl.textContent = `Showing ${startIndex}-${endIndex} of ${this.historyTotalItems} spins`;

    const rows = this.historyItems.map((item) => {
      const netClass = Number(item?.net_result || 0) >= 0
        ? 'slot-history-net-positive'
        : 'slot-history-net-negative';
      return `
        <tr>
          <td>${this.escapeHistoryCell(item?.id || '-')}</td>
          <td>${this.escapeHistoryCell(this.formatHistoryTimestamp(item?.timestamp))}</td>
          <td>${this.escapeHistoryCell(item?.game_mode || '-')}</td>
          <td>${this.escapeHistoryCell(item?.reward_mode || '-')}</td>
          <td>${this.escapeHistoryCell(item?.active_lines ?? '-')}</td>
          <td>${this.escapeHistoryCell(item?.bet_per_line ?? '-')}</td>
          <td>${this.escapeHistoryCell(item?.total_bet ?? '-')}</td>
          <td>${this.escapeHistoryCell(item?.total_payout ?? '-')}</td>
          <td class="${netClass}">${this.escapeHistoryCell(item?.net_result ?? '-')}</td>
          <td>${item?.joker_enabled ? 'YES' : 'NO'}</td>
          <td>${item?.mini_game_triggered ? 'YES' : 'NO'}</td>
        </tr>
      `;
    }).join('');

    tableWrap.innerHTML = `
      <table class="slot-history-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Type</th>
            <th>Mode</th>
            <th>Lines</th>
            <th>Bet/Line</th>
            <th>Total Bet</th>
            <th>Payout</th>
            <th>Net</th>
            <th>Joker</th>
            <th>Mini</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    const pages = this.getHistoryPageWindow();
    const firstPage = 1;
    const prevPage = Math.max(1, this.historyPage - 1);
    const nextPage = Math.min(this.historyTotalPages, this.historyPage + 1);
    const lastPage = this.historyTotalPages;

    paginationEl.innerHTML = `
      <button type="button" data-page="${firstPage}" ${this.historyPage === 1 ? 'disabled' : ''}>&laquo;</button>
      <button type="button" data-page="${prevPage}" ${this.historyPage === 1 ? 'disabled' : ''}>&lsaquo;</button>
      ${pages.map((page) => `<button type="button" data-page="${page}" class="${page === this.historyPage ? 'active' : ''}">${page}</button>`).join('')}
      <button type="button" data-page="${nextPage}" ${this.historyPage === this.historyTotalPages ? 'disabled' : ''}>&rsaquo;</button>
      <button type="button" data-page="${lastPage}" ${this.historyPage === this.historyTotalPages ? 'disabled' : ''}>&raquo;</button>
    `;

    pageInput.max = String(this.historyTotalPages);
    pageInput.value = String(this.historyPage);
    goBtn.disabled = this.historyTotalPages <= 1;
  }

  async loadHistoryPage(page) {
    const requestedPage = Number.parseInt(String(page || 1), 10);
    const normalizedPage = Number.isFinite(requestedPage) ? requestedPage : 1;
    const targetPage = Math.min(
      Math.max(1, normalizedPage),
      Math.max(1, this.historyTotalPages || 1),
    );

    this.historyLoading = true;
    this.renderHistoryView();

    try {
      const headers = {};
      if (this.jwtToken) {
        headers.Authorization = `Bearer ${this.jwtToken}`;
      }

      const response = await fetchWithCsrf(`/api/games/slot-machine/history?page=${targetPage}`, {
        method: 'GET',
        headers
      });
      const json = await response.json();

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || 'Failed to load history');
      }

      const totalPages = Number.parseInt(String(json.data.total_pages || 1), 10);
      const currentPage = Number.parseInt(String(json.data.page || targetPage), 10);
      const totalItems = Number.parseInt(String(json.data.total || 0), 10);

      this.historyTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
      this.historyPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
      this.historyTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0;
      this.historyItems = Array.isArray(json.data.history) ? json.data.history : [];
      this.historyLoading = false;
      this.renderHistoryView();
    } catch (error) {
      this.historyLoading = false;
      this.renderHistoryView(error.message || 'Failed to load history');
    }
  }

  cycleGameType() {
    const gameTypeOptions = this.shadowRoot.getElementById('gameTypeOptions');
    const controlGroups = gameTypeOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const value = parseInt(nextElement.dataset.value);
    const name = (nextElement.textContent || '').trim();
    this.selectGameType(value, name, nextElement);
  }

  cycleRewardMode() {
    const rewardModeOptions = this.shadowRoot.getElementById('rewardModeOptions');
    const controlGroups = rewardModeOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const value = parseInt(nextElement.dataset.value);
    this.selectRewardMode(value, nextElement);
  }

  cycleBet() {
    const betOptions = this.shadowRoot.getElementById('betOptions');
    const controlGroups = betOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const bet = parseInt(nextElement.dataset.value);
    this.selectBet(bet, nextElement);
  }

  updateBetOptions() {
    // Bet arrays per game type (matching reference implementation)
    const betArrays = {
      1: [2, 3, 4, 5, 6],  // Numbers (Brojevi)
      2: [1, 2, 3, 4, 5],  // Roman (Rimski)
      3: [5, 6, 7, 8, 9],  // Fruits (Vockice)
      4: [4, 5, 6, 7, 8],  // Animals (Zivotinje)
      5: [3, 4, 5, 6, 7]   // Emoji (Smajlici)
    };

    const bets = betArrays[this.gameTypeValue] || betArrays[1];
    const betOptions = this.shadowRoot.getElementById('betOptions');

    // Clear existing options
    betOptions.innerHTML = '';

    // Create new bet options
    bets.forEach((bet, idx) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'control-group' + (idx === 0 ? ' active' : '');
      optionButton.dataset.value = String(bet);
      optionButton.textContent = `${bet} $`;
      optionButton.addEventListener('click', () => this.selectBet(bet, optionButton));
      betOptions.appendChild(optionButton);
    });

    // Set the first bet as active
    this.bet = bets[0];
    this.updateDisplay();
  }

  selectBet(bet, element) {
    this.bet = bet;
    if (this.rewardMode === 1 && this.jokerAdded && this.jokerPosition > 0) {
      this.jokerCost = this.bet * 5;
      const jokerStatus = this.shadowRoot.getElementById('jokerStatus');
      if (jokerStatus) {
        jokerStatus.textContent = `YES (${this.jokerCost} $)`;
      }
    }
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    this.updateDisplay();
  }

  selectGameType(value, name, element) {
    this.gameTypeValue = value;
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    this.shadowRoot.getElementById('gameType').textContent = name;
    this.updateSymbols();
  }

  selectRewardMode(value, element) {
    // If user switches to single-line mode, force-clear any joker state first.
    if (value === 2) {
      const jokerCheckbox = this.shadowRoot.getElementById('jokerCheckbox');
      const hasJokerState = this.jokerAdded
        || this.jokerPosition > 0
        || (jokerCheckbox && jokerCheckbox.classList.contains('active'));
      if (hasJokerState) {
        this.removeJoker();
      }
    }

    this.rewardMode = value;
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    const infoPanelEl = this.shadowRoot.querySelector('.info-panel');

    if (value === 1) {
      // Multi-line mode: show full 3x5 with lines and joker controls
      this.shadowRoot.getElementById('linesContainer').style.display = 'flex';
      this.shadowRoot.getElementById('jokerContainer').style.display = 'block';
      infoPanelEl.style.marginTop = '0';
      this.setCanvasFullHeight();
    } else {
      // Single line mode (value === 2): hide lines/joker controls
      this.shadowRoot.getElementById('linesContainer').style.display = 'none';
      this.shadowRoot.getElementById('jokerContainer').style.display = 'none';
      infoPanelEl.style.marginTop = '0';
      this.setCanvasMiddleRow();
    }
    this.drawLines();
    this.updateDisplay();
  }

  setCanvasFullHeight() {
    if (!this.canvas) return;
    this.canvas.classList.remove('single-line-mode');
    this.canvas.style.overflow = 'hidden';
    this.canvas.style.transform = 'translateY(0)';
    this.renderFrame();
  }

  setCanvasMiddleRow() {
    if (!this.canvas) return;
    this.canvas.classList.add('single-line-mode');
    this.canvas.style.overflow = 'visible';
    this.canvas.style.transform = 'translateY(0)';
    this.renderFrame();
  }

  toggleLine(index, element) {
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    const currentlyActive = element.classList.contains('active');

    // If trying to turn off a line, check if it's the last one
    if (currentlyActive) {
      const activeCount = this.selectedPaylines.filter(l => l === 1).length;
      if (activeCount <= 1) {
        // Can't turn off the last line - do nothing
        return;
      }
    }

    const isActive = element.classList.toggle('active');
    this.selectedPaylines[index] = isActive ? 1 : 0;

    // Update disabled state for last remaining line
    const activeCount = this.selectedPaylines.filter(l => l === 1).length;

    if (activeCount === 1) {
      // Mark the last remaining active line as disabled (can't be turned off)
      linesContainer.querySelectorAll('.control-group.active').forEach((lineBtn) => {
        lineBtn.classList.add('last-active');
      });
    } else {
      // Remove last-active marker from all lines
      linesContainer.querySelectorAll('.control-group.last-active').forEach((lineBtn) => {
        lineBtn.classList.remove('last-active');
      });
    }

    // Redraw canvas
    this.drawLines();

    // Handle joker if active
    if (this.jokerAdded && this.jokerPosition > 0) {
      // Check if joker is still valid on selected lines
      const jokerLines = this.getLinesForJokerPosition(this.jokerPosition - 1);
      const validLines = jokerLines.filter(line => this.selectedPaylines[line - 1] === 1);
      if (validLines.length === 0) {
        this.removeJoker();
      } else {
        this.renderFrame();
      }
    }

    this.updateDisplay();
  }

  toggleJoker(checked) {
    const jokerButton = this.shadowRoot.getElementById('jokerCheckbox');
    if (jokerButton) {
      jokerButton.classList.toggle('active', !!checked);
      jokerButton.setAttribute('aria-pressed', checked ? 'true' : 'false');
    }

    if (checked) {
      // Calculate which grid positions are active based on selected lines
      this.calculateValidJokerPositions();
      this.countActivePaylines();
      this.jokerSelectionActive = true;
      this.drawJokerSelectionGrid();
      this.shadowRoot.getElementById('linesContainer').style.display = 'none';
    } else {
      this.jokerPosition = 0;
      this.jokerCost = 0;
      this.jokerAdded = false;
      this.jokerSelectionActive = false;
      this.removeCanvasClickListener();
      this.drawLines();
      this.shadowRoot.getElementById('linesContainer').style.display = 'flex';
      this.shadowRoot.getElementById('jokerStatus').textContent = 'NO (0 $)';

      // Hide joker buttons
      this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
      this.shadowRoot.getElementById('removeJokerBtn').style.display = 'none';
    }
    this.updateDisplay();
  }

  getPaylineGridPositions() {
    return [
      [5, 6, 7, 8, 9],      // Line 0: Middle row
      [0, 1, 2, 3, 4],      // Line 1: Top row
      [10, 11, 12, 13, 14], // Line 2: Bottom row
      [3, 5, 7, 9, 11],     // Line 3: Diagonal
      [1, 5, 7, 9, 13],     // Line 4: Diagonal
      [0, 4, 6, 8, 12],     // Line 5: Zigzag
      [2, 6, 8, 10, 14],    // Line 6: Zigzag
    ];
  }

  getActivePaylineHighlightMap() {
    const highlightMap = new Array(15).fill(0);
    if (this.rewardMode !== 1) {
      return highlightMap;
    }

    const paylineGridPositions = this.getPaylineGridPositions();
    for (let lineIndex = 0; lineIndex < paylineGridPositions.length; lineIndex++) {
      if (this.selectedPaylines[lineIndex] !== 1) continue;
      const positions = paylineGridPositions[lineIndex] || [];
      for (let posIndex = 0; posIndex < positions.length; posIndex++) {
        const gridPosition = positions[posIndex];
        if (!Number.isFinite(gridPosition) || gridPosition < 0 || gridPosition >= highlightMap.length) {
          continue;
        }
        highlightMap[gridPosition] += 1;
      }
    }

    return highlightMap;
  }

  calculateValidJokerPositions() {
    this.validJokerPositions = new Array(15).fill(0);

    const paylineGridPositions = this.getPaylineGridPositions();
    for (let i = 0; i < paylineGridPositions.length; i++) {
      if (this.selectedPaylines[i] === 1) {
        const positions = paylineGridPositions[i] || [];
        for (let j = 0; j < positions.length; j++) {
          this.validJokerPositions[positions[j]] = 1;
        }
      }
    }
  }

  countActivePaylines() {
    let count = 0;
    this.selectedPaylines.forEach(item => { if (item === 1) count++; });
    this.shadowRoot.getElementById('lineCount').textContent = count;
    return count;
  }

  drawJokerSelectionGrid() {
    if (!this.ctx || !this.cellHalfHeight || !this.cellHalfWidth) {
      this.initCanvas();
    }
    this.jokerSelectionActive = true;
    this.renderFrame();
    this.addCanvasClickListener();
  }

  addCanvasClickListener() {
    if (!this.canvas) return;
    this.canvas.classList.add('joker-active');
    this.canvas.addEventListener('click', this.boundCanvasClick);
  }

  removeCanvasClickListener() {
    if (!this.canvas) return;
    this.canvas.classList.remove('joker-active');
    this.canvas.removeEventListener('click', this.boundCanvasClick);
  }

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Account for 8px border
    const borderWidth = 8;
    const rawMouseX = e.clientX - rect.left - borderWidth;
    const rawMouseY = e.clientY - rect.top - borderWidth;

    // Account for spinner padding - convert to content area coordinates
    const contentMouseX = rawMouseX - this.spinnerPaddingLeft;
    const contentMouseY = rawMouseY - this.spinnerPaddingTop;

    // Determine which grid position was clicked (based on content area)
    const row = Math.floor(contentMouseY / (2 * this.cellHalfHeight));
    const col = Math.floor(contentMouseX / (this.cellHalfWidth * 2));

    if (row < 0 || row > 2 || col < 0 || col > 4) return;

    const gridPos = row * 5 + col;

    // Check if this position is valid (has a line through it)
    if (this.validJokerPositions[gridPos] === 1) {
      const jokerNum = gridPos + 1;
      if (this.jokerPosition !== jokerNum) {
        this.jokerPosition = jokerNum;
        this.jokerAffectedLines = [];

        // Calculate x, y for joker image (add padding offset for canvas coordinates)
        const x = this.spinnerPaddingLeft + this.cellHalfWidth * 2 * col;
        const y = this.spinnerPaddingTop + row * this.cellHalfHeight * 2;
        this.jokerCanvasX = x;
        this.jokerCanvasY = y;

        // Redraw boxes then joker on top
        this.redrawWithJoker(x, y);

        // Get which lines this position affects
        this.jokerAffectedLines = this.getLinesForJokerPosition(gridPos);
      }
    }
  }

  redrawWithJoker(x, y) {
    this.jokerCanvasX = x;
    this.jokerCanvasY = y;
    this.jokerSelectionActive = true;
    this.renderFrame();
    this.drawJokerAtPosition(x, y);
  }

  getLinesForJokerPosition(pos) {
    // Map of which lines each position is part of
    const jokerLineMapping = [
      [2, 6],         // pos 0
      [2, 5],         // pos 1
      [2, 7],         // pos 2
      [2, 4],         // pos 3
      [2, 6],         // pos 4
      [1, 4, 5],      // pos 5
      [1, 6, 7],      // pos 6
      [1, 4, 5],      // pos 7
      [1, 6, 7],      // pos 8
      [1, 4, 5],      // pos 9
      [3, 7],         // pos 10
      [3, 4],         // pos 11
      [3, 5],         // pos 12
      [3, 6],         // pos 13
      [3, 7]          // pos 14
    ];

    return jokerLineMapping[pos] || [];
  }

  drawJokerAtPosition(x, y) {
    this.drawJokerSprite(x, y);

    const confirmBtn = this.shadowRoot.getElementById('confirmJokerBtn');
    const removeBtn = this.shadowRoot.getElementById('removeJokerBtn');
    const checkbox = this.shadowRoot.getElementById('jokerCheckbox');

    if (checkbox && checkbox.classList.contains('active') && !this.jokerAdded) {
      confirmBtn.style.display = 'block';
      removeBtn.style.display = 'none';
    }
  }

  confirmJoker() {
    this.jokerAdded = true;
    this.jokerCost = this.bet * 5;
    this.jokerSelectionActive = false;
    this.shadowRoot.getElementById('jokerStatus').textContent = `YES (${this.jokerCost} $)`;

    // Hide "Confirm Joker" button, show "Remove Joker" button
    this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
    this.shadowRoot.getElementById('removeJokerBtn').style.display = 'block';

    this.removeCanvasClickListener();

    // Redraw lines with joker on the selected position
    this.drawLines();

    // Disable checkbox
    const jokerButton = this.shadowRoot.getElementById('jokerCheckbox');
    if (jokerButton) {
      jokerButton.disabled = true;
      jokerButton.classList.add('active');
      jokerButton.setAttribute('aria-pressed', 'true');
    }

    // Show lines container again
    this.shadowRoot.getElementById('linesContainer').style.display = 'flex';

    this.updateDisplay();
  }

  removeJoker() {
    this.jokerPosition = 0;
    this.jokerCost = 0;
    this.jokerAdded = false;
    this.jokerSelectionActive = false;
    this.jokerAffectedLines = [];
    this.jokerCanvasX = 0;
    this.jokerCanvasY = 0;
    this.shadowRoot.getElementById('jokerStatus').textContent = 'NO (0 $)';
    this.removeCanvasClickListener();

    this.drawLines();

    // Hide both joker buttons
    this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
    this.shadowRoot.getElementById('removeJokerBtn').style.display = 'none';

    // Re-enable and reset joker toggle button
    const checkbox = this.shadowRoot.getElementById('jokerCheckbox');
    if (checkbox) {
      checkbox.disabled = false;
      checkbox.classList.remove('active');
      checkbox.setAttribute('aria-pressed', 'false');
    }

    // If user was in joker-pick flow, ensure lines are visible again in multi-line mode
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    linesContainer.style.display = this.rewardMode === 1 ? 'flex' : 'none';

    this.updateDisplay();
  }

  updateSymbols() {
    const symbols = this.getSymbolSetForGameType(this.gameTypeValue);
    const odds = this.getOddsForGameType(this.gameTypeValue);
    this.symbolStrip = [...symbols];
    this.kvote = [...odds];

    this.cancelReelAnimation();
    this.currentRotations = [0, 0, 0, 0, 0];
    this.renderRotations = [0, 0, 0, 0, 0];

    // Update odds tables
    this.updateOddsTables(symbols, odds);

    // Update bet options for this game type
    this.updateBetOptions();
    this.drawLines();
  }

  updateOddsTables(symbols, odds) {
    const container = this.shadowRoot.getElementById('oddsContainer');
    if (!container) return;

    // Clear existing tables
    container.innerHTML = '';

    // Groups are rendered from highest symbol pair to lowest (e.g. 22/21 ... 2/1).
    const pairCount = Math.min(Math.floor(odds.length / 4), Math.floor(symbols.length / 2));
    const groups = [];
    for (let groupIdx = 0; groupIdx < pairCount; groupIdx++) {
      const symbolStart = (pairCount - groupIdx - 1) * 2;
      groups.push({
        symbols: [symbols[symbolStart], symbols[symbolStart + 1]],
        odds: odds.slice(groupIdx * 4, groupIdx * 4 + 4),
      });
    }

    groups.forEach(group => {
      const symLabel = `${group.symbols[0]} || ${group.symbols[1]}`;
      const table = document.createElement('table');
      table.className = 'odds-table';
      table.innerHTML = `
        <caption>Odds for ${symLabel}</caption>
        <tbody>
          ${group.odds.map((odd, row) => {
        const symbolCount = 5 - row; // 5, 4, 3, 2 symbols per row
        const emptyCount = row; // 0, 1, 2, 3 empty cells for alignment
        const lineLabel = `${symbolCount} in line`;
        return `
            <tr>
              <td class="line-label">${lineLabel}</td>
              ${Array(symbolCount).fill(`<td>${symLabel}</td>`).join('')}
              ${Array(emptyCount).fill('<td class="empty-cell"></td>').join('')}
              <td class="odds-value">${odd}</td>
            </tr>
          `}).join('')}
        </tbody>
      `;
      container.appendChild(table);
    });
  }

  updateDisplay() {
    this.shadowRoot.getElementById('credits').textContent = this.credits;
    this.shadowRoot.getElementById('currentBet').textContent = this.bet;
    const activeLines = this.rewardMode === 2 ? 1 : this.selectedPaylines.filter(l => l === 1).length;
    const jokerFee = this.rewardMode === 1 && this.jokerAdded && this.jokerPosition > 0 ? this.jokerCost : 0;
    this.shadowRoot.getElementById('lineCount').textContent = activeLines;
    const totalBet = this.rewardMode === 2 ? this.bet : (activeLines * this.bet) + jokerFee;
    this.shadowRoot.getElementById('totalBet').textContent = totalBet;
    this.shadowRoot.getElementById('spinsCount').textContent = this.spinsCount;
  }

  clearCanvas() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    if (this.webglEnabled) {
      this.presentWebGLFrame();
    }
  }

  lineCheck() {
    if (!this.ctx) return;

    // Only draw lines in multi-line mode
    // In single-line mode, the canvas border itself is the highlight
    if (this.rewardMode === 1) {
      const activeLines = [];
      for (let i = 0; i < 7; i++) {
        if (this.selectedPaylines[i] === 1) {
          activeLines.push(i);
        }
      }
      const mergeLine67Markers = this.selectedPaylines[5] === 1 && this.selectedPaylines[6] === 1;
      for (let i = 0; i < activeLines.length; i++) {
        this.drawPayline(activeLines[i], { drawPath: true, drawMarkers: false });
      }
      for (let i = 0; i < activeLines.length; i++) {
        this.drawPayline(activeLines[i], { drawPath: false, drawMarkers: true, mergeLine67Markers });
      }
      if (mergeLine67Markers) {
        this.drawMergedLine67Markers();
      }
    }
  }

  createLineThumbGradient(centerX, centerY, radius) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const safeRadius = Math.max(1, Number(radius) || 1);

    if (typeof ctx.createConicGradient === 'function') {
      const gradient = ctx.createConicGradient(-Math.PI / 2, centerX, centerY);
      gradient.addColorStop(0, 'rgba(255, 234, 164, 0.99)');
      gradient.addColorStop(0.22, 'rgba(224, 170, 72, 0.99)');
      gradient.addColorStop(0.5, 'rgba(247, 204, 106, 0.99)');
      gradient.addColorStop(0.74, 'rgba(170, 118, 40, 0.99)');
      gradient.addColorStop(1, 'rgba(255, 234, 164, 0.99)');
      return gradient;
    }

    const linearGradient = ctx.createLinearGradient(
      centerX - safeRadius,
      centerY - safeRadius,
      centerX + safeRadius,
      centerY + safeRadius,
    );
    linearGradient.addColorStop(0, 'rgba(255, 234, 164, 0.99)');
    linearGradient.addColorStop(0.5, 'rgba(247, 204, 106, 0.99)');
    linearGradient.addColorStop(1, 'rgba(170, 118, 40, 0.99)');
    return linearGradient;
  }

  traceRoundedRectPath(left, top, width, height, radius) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();

    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(left, top, width, height, safeRadius);
      return;
    }

    ctx.moveTo(left + safeRadius, top);
    ctx.lineTo(left + width - safeRadius, top);
    ctx.quadraticCurveTo(left + width, top, left + width, top + safeRadius);
    ctx.lineTo(left + width, top + height - safeRadius);
    ctx.quadraticCurveTo(left + width, top + height, left + width - safeRadius, top + height);
    ctx.lineTo(left + safeRadius, top + height);
    ctx.quadraticCurveTo(left, top + height, left, top + height - safeRadius);
    ctx.lineTo(left, top + safeRadius);
    ctx.quadraticCurveTo(left, top, left + safeRadius, top);
    ctx.closePath();
  }

  drawPayline(x, options = {}) {
    if (!this.ctx) return;
    const drawPath = options.drawPath !== false;
    const drawMarkers = options.drawMarkers !== false;
    const mergeLine67Markers = options.mergeLine67Markers === true;

    // Padding offsets for proper alignment with reels
    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;

    // Calculate Y positions with padding
    const topY = padY + this.cellHalfHeight;  // Center of top row
    // this.middleRowCenterY and this.bottomRowCenterY already include padding from initCanvas

    // 7 payline paths with line coordinates and circle positions
    // X coordinates need padding, Y uses precalculated values
    const path = [
      // Line 0: Middle horizontal
      [
        [[padX, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY], [padX + 4 * this.cellHalfWidth - 1, this.middleRowCenterY], [padX + 6 * this.cellHalfWidth - 1, this.middleRowCenterY], [padX + 8 * this.cellHalfWidth - 1, this.middleRowCenterY]]
      ],
      // Line 1: Top horizontal
      [
        [[padX, topY], [this.canvasWidth - padX, topY]],
        [[padX + 2 * this.cellHalfWidth, topY], [padX + 4 * this.cellHalfWidth - 1, topY], [padX + 6 * this.cellHalfWidth - 1, topY], [padX + 8 * this.cellHalfWidth - 1, topY]]
      ],
      // Line 2: Bottom horizontal
      [
        [[padX, this.bottomRowCenterY], [this.canvasWidth - padX, this.bottomRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 4 * this.cellHalfWidth - 1, this.bottomRowCenterY], [padX + 6 * this.cellHalfWidth - 1, this.bottomRowCenterY], [padX + 8 * this.cellHalfWidth - 1, this.bottomRowCenterY]]
      ],
      // Line 3: Diagonal down
      [
        [[padX, this.middleRowCenterY], [padX + this.cellHalfWidth, this.middleRowCenterY], [padX + 3 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 7 * this.cellHalfWidth, topY], [padX + 9 * this.cellHalfWidth, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 4 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 6 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 8 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight]]
      ],
      // Line 4: Diagonal up
      [
        [[padX, this.middleRowCenterY], [padX + this.cellHalfWidth, this.middleRowCenterY], [padX + 3 * this.cellHalfWidth, topY], [padX + 7 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 9 * this.cellHalfWidth, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 4 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 6 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 8 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight]]
      ],
      // Line 5: Zigzag down
      [
        [[padX, topY], [padX + this.cellHalfWidth, topY], [padX + 5 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 9 * this.cellHalfWidth, topY], [this.canvasWidth - padX, topY]],
        [[padX + this.cellHalfWidth, topY], [padX + 3 * this.cellHalfWidth, this.middleRowCenterY], [padX + 5 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 7 * this.cellHalfWidth, this.middleRowCenterY], [padX + 9 * this.cellHalfWidth, topY]]
      ],
      // Line 6: Zigzag up
      [
        [[padX, this.bottomRowCenterY], [padX + this.cellHalfWidth, this.bottomRowCenterY], [padX + 5 * this.cellHalfWidth, topY], [padX + 9 * this.cellHalfWidth, this.bottomRowCenterY], [this.canvasWidth - padX, this.bottomRowCenterY]],
        [[padX + this.cellHalfWidth, this.bottomRowCenterY], [padX + 3 * this.cellHalfWidth, this.middleRowCenterY], [padX + 5 * this.cellHalfWidth, topY], [padX + 7 * this.cellHalfWidth, this.middleRowCenterY], [padX + 9 * this.cellHalfWidth, this.bottomRowCenterY]]
      ]
    ];

    const drawPathGeometry = () => {
      this.ctx.beginPath();
      for (let i = 0; i < path[x][0].length; i++) {
        if (i === 0) {
          this.ctx.moveTo(path[x][0][i][0], path[x][0][i][1]);
        } else {
          this.ctx.lineTo(path[x][0][i][0], path[x][0][i][1]);
        }
      }
    };

    if (drawPath) {
      this.ctx.globalAlpha = 1;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Dark base stroke for higher contrast.
      this.ctx.strokeStyle = 'rgba(16, 10, 3, 0.98)';
      this.ctx.lineWidth = 6;
      drawPathGeometry();
      this.ctx.stroke();

      // Dark-gold visible stroke.
      this.ctx.strokeStyle = this.lineColor || 'rgb(94, 61, 17)';
      this.ctx.lineWidth = 4;
      drawPathGeometry();
      this.ctx.stroke();
    }

    // Draw numbered circles on the line
    if (drawMarkers) {
      const markerRadius = 14;
      const markerOuterRadius = 20;
      const lineTone = this.lineColor || 'rgb(94, 61, 17)';

      for (let i = 0; i < path[x][1].length; i++) {
        if (mergeLine67Markers && (x === 5 || x === 6) && (i === 1 || i === 3)) {
          continue;
        }

        const markerX = path[x][1][i][0];
        const markerY = path[x][1][i][1];

        // Backing circle in line color.
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(markerX, markerY, markerOuterRadius, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.colorWithAlpha(lineTone, 0.7);
        this.ctx.fill();
        this.ctx.strokeStyle = this.colorWithAlpha(lineTone, 0.98);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(markerX, markerY, markerRadius, 0, 2 * Math.PI);

        const markerGradient = this.createLineThumbGradient(markerX, markerY, markerRadius);

        this.ctx.fillStyle = markerGradient || this.colorWithAlpha(lineTone, 0.95);
        this.ctx.fill();
        this.ctx.strokeStyle = this.colorWithAlpha(lineTone, 0.98);
        this.ctx.stroke();

        this.ctx.font = '700 14px "Lucida Sans Unicode", "Lucida Grande", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'rgba(36, 24, 8, 0.98)';
        this.ctx.fillText(x + 1, markerX, markerY);
      }
    }

    this.ctx.globalAlpha = 1;
    this.ctx.lineWidth = 4;
  }

  drawMergedLine67Markers() {
    if (!this.ctx) return;

    const padX = this.spinnerPaddingLeft || 0;
    const markerY = this.middleRowCenterY;
    const markerPositions = [
      padX + (3 * this.cellHalfWidth),
      padX + (7 * this.cellHalfWidth),
    ];
    const lineTone = this.lineColor || 'rgb(94, 61, 17)';
    const markerWidth = 56;
    const markerHeight = 30;
    const markerRadius = 14;
    const innerInsetX = 4;
    const innerInsetY = 4;
    const lineWidth = 2;

    for (let i = 0; i < markerPositions.length; i++) {
      const markerX = markerPositions[i];
      const left = markerX - (markerWidth / 2);
      const top = markerY - (markerHeight / 2);
      const innerLeft = left + innerInsetX;
      const innerTop = top + innerInsetY;
      const innerWidth = markerWidth - (innerInsetX * 2);
      const innerHeight = markerHeight - (innerInsetY * 2);
      const innerRadius = Math.max(8, markerRadius - 3);

      // Backing pill in the same tone as line color.
      this.traceRoundedRectPath(left, top, markerWidth, markerHeight, markerRadius);
      this.ctx.fillStyle = this.colorWithAlpha(lineTone, 0.74);
      this.ctx.fill();
      this.ctx.lineWidth = lineWidth;
      this.ctx.strokeStyle = this.colorWithAlpha(lineTone, 0.99);
      this.ctx.stroke();

      // Inner pill with the same conic gradient as all line thumbs.
      this.traceRoundedRectPath(innerLeft, innerTop, innerWidth, innerHeight, innerRadius);
      const markerGradient = this.createLineThumbGradient(markerX, markerY, Math.max(innerWidth, innerHeight) / 2);
      this.ctx.fillStyle = markerGradient || this.colorWithAlpha(lineTone, 0.95);
      this.ctx.fill();
      this.ctx.lineWidth = lineWidth;
      this.ctx.strokeStyle = this.colorWithAlpha(lineTone, 0.99);
      this.ctx.stroke();

      this.ctx.font = '700 13px "Lucida Sans Unicode", "Lucida Grande", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = 'rgba(28, 18, 6, 0.99)';
      this.ctx.fillText('6/7', markerX, markerY);
    }
  }

  drawLines() {
    this.renderFrame();
  }

  getTotalBet() {
    if (this.rewardMode === 2) return this.bet;
    const jokerFee = this.jokerAdded && this.jokerPosition > 0 ? this.jokerCost : 0;
    return this.selectedPaylines.filter(l => l === 1).length * this.bet + jokerFee;
  }

  setButtonsEnabled(enabled) {
    // Disable/enable buttons with pointer-events: none
    const buttons = ['startBtn', 'betBtn', 'gameTypeBtn', 'rewardModeBtn'];
    buttons.forEach(id => {
      const btn = this.shadowRoot.getElementById(id);
      if (btn) {
        btn.disabled = !enabled;
        if (enabled) {
          btn.classList.remove('disabled');
        } else {
          btn.classList.add('disabled');
        }
      }
    });

    // Disable/enable clickable divs in slot-options (bet options, game types, reward modes)
    const slotOptions = this.shadowRoot.querySelector('.slot-options');
    if (slotOptions) {
      slotOptions.querySelectorAll('.control-group').forEach(el => {
        if (enabled) {
          el.classList.remove('disabled');
        } else {
          el.classList.add('disabled');
        }
      });
    }

    // Disable/enable clickable divs in slot-sidebar (lines, joker, control groups)
    const slotSidebar = this.shadowRoot.querySelector('.slot-sidebar');
    if (slotSidebar) {
      // Lines container items
      const linesContainer = slotSidebar.querySelector('.lines-container');
      if (linesContainer) {
        linesContainer.querySelectorAll('button').forEach(el => {
          if (enabled) {
            el.classList.remove('disabled');
          } else {
            el.classList.add('disabled');
          }
        });
      }

      // Joker container
      const jokerContainer = slotSidebar.querySelector('.joker-container');
      if (jokerContainer) {
        if (enabled) {
          jokerContainer.classList.remove('disabled');
        } else {
          jokerContainer.classList.add('disabled');
        }
      }

      // Control groups in sidebar
      slotSidebar.querySelectorAll('.control-group').forEach(el => {
        if (enabled) {
          el.classList.remove('disabled');
        } else {
          el.classList.add('disabled');
        }
      });
    }
  }

  setStopButtonEnabled(enabled) {
    const stopBtn = this.shadowRoot.getElementById('stopBtn');
    if (stopBtn) stopBtn.disabled = !enabled;
  }

  async startSpin() {
    if (this.isSpinning) return;
    const totalBet = this.getTotalBet();
    if (this.credits < totalBet) {
      if (typeof window.showToast === 'function') {
        window.showToast('Not enough credits. Use Add Credits to continue.', 'warning');
      }
      return;
    }

    this.isSpinning = true;
    this.credits -= totalBet;
    this.updateDisplay();

    // Disable all buttons while spin is preparing.
    this.setButtonsEnabled(false);
    this.setStopButtonEnabled(false);

    try {
      const response = await this.callSpinAPI();
      this.stopArray = response;
      void this.loadSpinsCountFromHistory();
      const spinDurationMs = this.rotateReels(response, true);
      this.setStopButtonEnabled(true);
      this.startProgressTimer(response, spinDurationMs);
    } catch (error) {
      console.error('Spin error:', error);
      this.credits += totalBet;
      this.isSpinning = false;
      this.setButtonsEnabled(true);
      this.setStopButtonEnabled(true);
      this.updateDisplay();
    }
  }

  async callSpinAPI() {
    const activeLines = this.rewardMode === 2 ? [1, 0, 0, 0, 0, 0, 0] : this.selectedPaylines;
    const jokerEnabled = this.rewardMode === 1 && this.jokerAdded && this.jokerPosition > 0;
    const headers = { 'Content-Type': 'application/json' };
    if (this.jwtToken) {
      headers.Authorization = `Bearer ${this.jwtToken}`;
    }
    const body = {
      action: 'slot_spin',
      ulog: parseInt(this.bet),
      igra: this.gameTypeValue,
      kvote: this.kvote,
      brojLinija: activeLines,
      dzoker: jokerEnabled ? this.jokerPosition : 0,
      vrednostDzokera: jokerEnabled ? this.jokerCost : 0,
      nacin: this.rewardMode,
      brojKredita: this.credits + this.getTotalBet()
    };

    const response = await fetchWithCsrf('/api/games/slot-machine', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const json = await response.json();

    // Extract result array from wrapped response { success: true, data: { result: [...] } }
    if (json.success && json.data && json.data.result) {
      return json.data.result;
    }

    // If error or unexpected format, throw
    throw new Error(json.message || 'Spin failed');
  }

  async loadSpinsCountFromHistory() {
    try {
      const authHeaders = { 'Content-Type': 'application/json' };
      if (this.jwtToken) {
        authHeaders.Authorization = `Bearer ${this.jwtToken}`;
      }

      const statsResponse = await fetchWithCsrf('/api/games/slot-machine', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'slot_stats' })
      });
      const statsJson = await statsResponse.json();

      const statsTotal = Number.parseInt(String(statsJson?.data?.total_spins ?? ''), 10);
      if (statsResponse.ok && statsJson.success && Number.isFinite(statsTotal) && statsTotal >= 0) {
        this.spinsCount = statsTotal;
        this.updateDisplay();
        return;
      }

      const response = await fetchWithCsrf('/api/games/slot-machine', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'slot_history', page: 1 })
      });
      const json = await response.json();

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || 'Could not load spin history');
      }

      const totalSpins = Number.parseInt(String(json.data.total ?? ''), 10);
      if (Number.isFinite(totalSpins) && totalSpins >= 0) {
        this.spinsCount = totalSpins;
      } else if (Array.isArray(json.data.history)) {
        this.spinsCount = json.data.history.length;
      }

      this.updateDisplay();
    } catch (error) {
      console.error('Failed to load spins count from history:', error);
    }
  }

  /**
   * Rotate reels with slot machine animation
   * @param {Array} values - Either [360,360,360,360,360] for initial spin or actual reel values [1-22]
   * @param {boolean} isFinalSpin - True when spinning to final position
   */
  rotateReels(values, isFinalSpin = false) {
    const reelCount = 5;
    const safeValues = Array.isArray(values) ? values : [];
    this.reelSpringOffsets = [0, 0, 0, 0, 0];

    this.spinDirections = this.spinDirections.map(() => {
      if (this.rewardMode === 1) {
        return Math.random() < 0.5 ? 1 : -1;
      }
      return -1;
    });

    if (!isFinalSpin) {
      const transitions = new Array(reelCount).fill(null);
      let maxDuration = 0;
      for (let i = 0; i < reelCount; i++) {
        const direction = this.spinDirections[i] || -1;
        const from = this.renderRotations[i] || 0;
        const spinRotations = 360 * (Math.floor(Math.random() * 5) + 8);
        const target = from + (direction * spinRotations);
        const delay = i * 500;
        const duration = 1000;

        this.currentRotations[i] = target;
        transitions[i] = {
          from,
          to: target,
          duration,
          delay,
          easing: (progress) => progress,
        };
        maxDuration = Math.max(maxDuration, delay + duration);
      }
      this.animateReels(transitions);
      this.currentSpinDurationMs = maxDuration;
      return maxDuration;
    }

    const totalDuration = this.animateClassicReelPhysicsStop(safeValues);
    this.currentSpinDurationMs = totalDuration;
    return totalDuration;
  }

  stopBounceEase(progress) {
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const base = 1 - Math.pow(1 - t, 5);
    const wobble = Math.sin(t * Math.PI * 4) * Math.pow(1 - t, 1.8) * 0.08;
    return base + wobble;
  }

  animateClassicReelPhysicsStop(values) {
    const reelCount = 5;
    const spinDurationMs = 3000;
    const sequentialStopDelayMs = 400;
    const stopDurationMs = 520;
    const stepAngle = this.getReelStepAngle();

    const startAngles = new Array(reelCount).fill(0).map((_, idx) => this.renderRotations[idx] || 0);
    const spinSpeeds = new Array(reelCount).fill(0);
    const stopStartTimes = new Array(reelCount).fill(0);
    const stopFromAngles = new Array(reelCount).fill(0);
    const stopTargetAngles = new Array(reelCount).fill(0);
    const springAmplitudePx = this.rewardMode === 2 ? 8 : 7;
    this.reelSpringOffsets = new Array(reelCount).fill(0);

    for (let i = 0; i < reelCount; i++) {
      const direction = this.spinDirections[i] || -1;
      const speedDegPerMs = 1.35 + (Math.random() * 0.22);
      const stopStart = spinDurationMs + (i * sequentialStopDelayMs);
      const angleAtStopStart = startAngles[i] + (direction * speedDegPerMs * stopStart);
      const targetValue = Number.parseInt(String(values?.[i] ?? 1), 10) || 1;
      const targetAngle = -(targetValue - 1) * stepAngle;
      const extraTurns = 360 * (3 + Math.floor(Math.random() * 2));
      let finalAngle = targetAngle + (direction * extraTurns);

      while (direction === -1 && finalAngle > angleAtStopStart) {
        finalAngle -= 360;
      }
      while (direction === 1 && finalAngle < angleAtStopStart) {
        finalAngle += 360;
      }

      spinSpeeds[i] = speedDegPerMs;
      stopStartTimes[i] = stopStart;
      stopFromAngles[i] = angleAtStopStart;
      stopTargetAngles[i] = finalAngle;
      this.currentRotations[i] = finalAngle;
    }

    const totalDurationMs = spinDurationMs + ((reelCount - 1) * sequentialStopDelayMs) + stopDurationMs;
    this.cancelReelAnimation();

    const startedAt = performance.now();
    const nextFrame = (now) => {
      const elapsed = now - startedAt;
      let allDone = true;

      for (let i = 0; i < reelCount; i++) {
        const direction = this.spinDirections[i] || -1;
        const stopStart = stopStartTimes[i];

        if (elapsed < stopStart) {
          this.renderRotations[i] = startAngles[i] + (direction * spinSpeeds[i] * elapsed);
          this.reelSpringOffsets[i] = 0;
          allDone = false;
          continue;
        }

        const stopElapsed = elapsed - stopStart;
        if (stopElapsed < stopDurationMs) {
          const progress = stopElapsed / stopDurationMs;
          const eased = this.stopBounceEase(progress);
          this.renderRotations[i] = stopFromAngles[i] + ((stopTargetAngles[i] - stopFromAngles[i]) * eased);
          const spring = Math.sin(progress * Math.PI * 4.8) * Math.exp(-3.2 * progress);
          this.reelSpringOffsets[i] = springAmplitudePx * spring;
          allDone = false;
          continue;
        }

        this.renderRotations[i] = stopTargetAngles[i];
        this.reelSpringOffsets[i] = 0;
      }

      this.renderFrame();

      if (!allDone) {
        this.reelAnimationFrame = requestAnimationFrame(nextFrame);
        return;
      }
      this.reelSpringOffsets = new Array(reelCount).fill(0);
      this.reelAnimationFrame = null;
    };

    this.reelAnimationFrame = requestAnimationFrame(nextFrame);
    return totalDurationMs;
  }

  startProgressTimer(data, durationMs = 5000) {
    const normalizedDurationMs = Math.max(1000, Number(durationMs) || 5000);
    const totalSeconds = Math.max(1, Math.ceil(normalizedDurationMs / 1000));
    this.spinCountdownSeconds = totalSeconds;

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    let elapsedSeconds = 0;
    const progressBar = this.shadowRoot.getElementById('progressBar');
    const progressLabel = this.shadowRoot.getElementById('progressLabel');
    if (progressBar) {
      progressBar.max = totalSeconds;
      progressBar.value = 0;
    }
    if (progressLabel) {
      progressLabel.textContent = `${totalSeconds} sec`;
    }

    this.progressInterval = setInterval(() => {
      elapsedSeconds += 1;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);

      if (progressLabel) {
        progressLabel.textContent = `${remaining} sec`;
      }
      if (progressBar) {
        progressBar.value = Math.min(totalSeconds, elapsedSeconds);
      }

      if (elapsedSeconds >= totalSeconds) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
        this.finishSpin(data);
      }
    }, 1000);
  }

  finishSpin(data) {
    const progressLabel = this.shadowRoot.getElementById('progressLabel');
    const progressBar = this.shadowRoot.getElementById('progressBar');
    if (progressLabel) {
      progressLabel.textContent = `${this.spinCountdownSeconds || 5} sec`;
    }
    if (progressBar) {
      progressBar.max = this.spinCountdownSeconds || 5;
      progressBar.value = 0;
    }
    this.cancelReelAnimation();
    this.renderRotations = [...this.currentRotations];
    this.reelSpringOffsets = [0, 0, 0, 0, 0];
    this.drawLines();

    if (data[8] !== undefined) this.credits = data[8];
    if (data[7] && data[7] > 0) this.showWin(data);

    this.isSpinning = false;
    this.setButtonsEnabled(true);
    this.setStopButtonEnabled(true);
    this.updateDisplay();
  }

  showWin(data) {
    const overlay = document.createElement('dialog');
    overlay.className = 'win-overlay';

    // Parse the request JSON from data[5] to check game mode
    let gameMode = 2;
    try {
      const requestJson = JSON.parse(data[5]);
      gameMode = requestJson.nacin;
    } catch (e) {
      console.warn('Could not parse request JSON:', e);
    }

    let html = `<h1>Congratulations!</h1>`;

    // Show winning lines info for multi-line mode
    if (gameMode === 1 && Array.isArray(data[10])) {
      for (let i = 0; i < data[10].length; i++) {
        const winInfo = data[10][i];
        // Check if it's a valid win (array with line info, not "no win" string)
        if (Array.isArray(winInfo) && winInfo.length >= 6) {
          const lineNum = winInfo[5] + 1;  // Line index is at position 5
          html += `<p>Win on line ${lineNum}!</p>`;
        }
      }
    } else {
      html += `<p>Well done, you have a win!</p>`;
    }

    html += `<h2>Winnings: ${data[7]} $</h2>`;
    html += '<div class="win-overlay-actions">';
    if (data[9] === 1) html += '<button class="btn-secondary" id="miniGameBtn">Mini Game</button>';
    html += '<button class="btn-primary" id="continueBtn">Continue</button>';
    html += '</div>';
    overlay.innerHTML = html;
    overlay.setAttribute('aria-label', 'Winning result');
    this.shadowRoot.appendChild(overlay);

    overlay.addEventListener('close', () => overlay.remove(), { once: true });

    const closeOverlay = () => {
      if (typeof overlay.close === 'function' && overlay.open) {
        overlay.close();
      } else {
        overlay.remove();
      }
    };

    overlay.querySelector('#continueBtn').addEventListener('click', () => closeOverlay());
    overlay.querySelector('#miniGameBtn')?.addEventListener('click', () => {
      closeOverlay();
      const winAmount = data[7];
      new BingoMiniGame(winAmount, this.shadowRoot, (finalWin) => {
        // Add any bonus winnings to credits
        const bonus = finalWin - winAmount;
        if (bonus > 0) {
          this.credits += bonus;
          this.updateDisplay();
        }
      }, this.credits); // Pass user balance for mini-game validation
    });

    if (typeof overlay.showModal === 'function') {
      overlay.showModal();
    } else {
      overlay.setAttribute('open', '');
    }
  }

  stopSpin() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;

      // Immediately disable stop button to prevent double-click
      this.setStopButtonEnabled(false);

      // Reset progress bar
      const progressLabel = this.shadowRoot.getElementById('progressLabel');
      const progressBar = this.shadowRoot.getElementById('progressBar');
      if (progressLabel) {
        progressLabel.textContent = `${this.spinCountdownSeconds || 5} sec`;
      }
      if (progressBar) {
        progressBar.max = this.spinCountdownSeconds || 5;
        progressBar.value = 0;
      }

      this.cancelReelAnimation();
      this.reelSpringOffsets = [0, 0, 0, 0, 0];

      const stepAngle = this.getReelStepAngle();
      for (let i = 0; i < 5; i++) {
        const targetValue = Number.parseInt(String(this.stopArray?.[i] ?? 1), 10) || 1;
        const targetAngle = -(targetValue - 1) * stepAngle;

        this.currentRotations[i] = targetAngle;
        this.renderRotations[i] = targetAngle;
      }
      this.drawLines();

      // Wait for animations to complete, then finalize
      setTimeout(() => {
        const data = this.stopArray;
        if (data[8] !== undefined) this.credits = data[8];
        if (data[7] && data[7] > 0) this.showWin(data);

        this.isSpinning = false;
        this.setButtonsEnabled(true);
        this.setStopButtonEnabled(true);
        this.updateDisplay();
      }, 50);
    }
  }
}
