import type { PrismaClient } from "./PrismaConnection.js";

import type { IGameRepository } from "../interfaces/IGameRepository.js";
import type { PaginatedResult } from "../interfaces/ITransactionRepository.js";
import { safeJsonParse } from "../lib/payloadParsers.js";
import {
  isGameModeName,
  isRewardModeName,
  type MiniGameHistoryAttachment,
  type SaveSpinInput,
  type UserHistoryItem,
  type UserStats,
} from "../types/domain.js";

export class GameRepository implements IGameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveSpin(userId: number, data: SaveSpinInput): Promise<number> {
    const netResultCoins = Number(data.totalPayout || 0) - Number(data.totalBet || 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const history = await tx.gameHistory.create({
        data: {
          userId,
          betTransactionId: data.betTransactionId,
          winTransactionId: data.winTransactionId,
          reelsJson: JSON.stringify(data.reels),
          gridJson: data.grid ? JSON.stringify(data.grid) : null,
          activeLinesJson: JSON.stringify(data.activeLines),
          winningLinesJson: JSON.stringify(data.winningLines),
          rewardMode: data.rewardMode,
          gameType: data.gameMode,
          betPerLineCoins: Number(data.betPerLine || 0),
          totalBetCoins: Number(data.totalBet || 0),
          totalPayoutCoins: Number(data.totalPayout || 0),
          netResultCoins,
          jokerEnabled: !!data.jokerEnabled,
          jokerPosition: data.jokerPosition,
          jokerCostCoins: Number(data.jokerCost || 0),
          miniGameTriggered: !!data.miniGameTriggered,
        },
      });

      if (data.miniGameTriggered) {
        await tx.pendingMiniGame.create({
          data: {
            userId,
            gameHistoryId: history.id,
          },
        });
      }

      return history;
    });

    return result.id;
  }

  async consumePendingMiniGame(userId: number): Promise<number | null> {
    const result = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.pendingMiniGame.findFirst({
        where: { userId, consumedAt: null },
        orderBy: { id: "desc" },
      });

      if (!pending) {
        return null;
      }

      await tx.pendingMiniGame.update({
        where: { id: pending.id },
        data: { consumedAt: new Date() },
      });

      return pending.gameHistoryId;
    });

    return result;
  }

  async attachMiniGameToHistory(
    gameHistoryId: number | null,
    miniGameData: MiniGameHistoryAttachment,
  ): Promise<void> {
    if (!gameHistoryId) {
      return;
    }

    await this.prisma.gameHistory.update({
      where: { id: gameHistoryId },
      data: {
        miniGameTriggered: true,
        miniGameMode: miniGameData.mode,
        miniGamePlayedJson: JSON.stringify(miniGameData.played),
        miniGameDrawnJson: JSON.stringify(miniGameData.drawnNumbers),
        miniGameTotalBetCoins: Number(miniGameData.totalBet || 0),
        miniGameTotalPayoutCoins: Number(miniGameData.totalPayout || 0),
        miniGameNetResultCoins: Number(miniGameData.netResult || 0),
      },
    });
  }

  async getUserHistory(
    userId: number,
    limit: number,
    skip: number,
  ): Promise<PaginatedResult<UserHistoryItem>> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gameHistory.count({ where: { userId } }),
      this.prisma.gameHistory.findMany({
        where: { userId },
        orderBy: { id: "desc" },
        take: limit,
        skip,
      }),
    ]);

    const items = rows.map((row) => {
      const parsedLines = safeJsonParse(row.activeLinesJson, []);
      const activeLines = Array.isArray(parsedLines) ? parsedLines : [];
      const activeLineCount = activeLines.filter((line) => Number(line) === 1).length;

      return {
        id: String(row.id),
        reels: safeJsonParse(row.reelsJson, []),
        active_lines: activeLineCount,
        bet_per_line: row.betPerLineCoins,
        total_bet: row.totalBetCoins,
        total_payout: row.totalPayoutCoins,
        net_result: row.netResultCoins,
        joker_enabled: row.jokerEnabled,
        mini_game_triggered: row.miniGameTriggered,
        reward_mode: isRewardModeName(row.rewardMode) ? row.rewardMode : "single",
        game_mode: isGameModeName(row.gameType) ? row.gameType : "numbers",
        timestamp: row.createdAt.toISOString(),
      };
    });

    return { total, items };
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const stats = await this.prisma.gameHistory.aggregate({
      where: { userId },
      _count: true,
      _sum: {
        totalBetCoins: true,
        totalPayoutCoins: true,
        netResultCoins: true,
      },
      _max: {
        totalPayoutCoins: true,
      },
      _min: {
        netResultCoins: true,
      },
    });

    const [winsResult, miniGamesResult] = await this.prisma.$transaction([
      this.prisma.gameHistory.count({
        where: { userId, totalPayoutCoins: { gt: 0 } },
      }),
      this.prisma.gameHistory.count({
        where: { userId, miniGameTriggered: true },
      }),
    ]);

    const totalSpins = stats._count;
    const wins = winsResult;

    return {
      user_id: userId,
      total_spins: totalSpins,
      total_wagered: stats._sum.totalBetCoins ?? 0,
      total_won: stats._sum.totalPayoutCoins ?? 0,
      total_net: stats._sum.netResultCoins ?? 0,
      wins,
      losses: totalSpins - wins,
      win_rate: totalSpins > 0 ? (wins / totalSpins) * 100 : 0,
      biggest_win: stats._max.totalPayoutCoins ?? 0,
      biggest_loss: stats._min.netResultCoins ?? 0,
      mini_games_triggered: miniGamesResult,
    };
  }
}
