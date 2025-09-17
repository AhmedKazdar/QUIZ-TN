import { ScoreService } from './score.service';
import { Score } from './score.schema';
import { Types } from 'mongoose';
export declare class ScoreController {
    private readonly scoreService;
    private readonly logger;
    constructor(scoreService: ScoreService);
    calculateScore(userId: string): Promise<Score>;
    getUserRank(userId: string): Promise<{
        rank: number;
        totalUsers: number;
    }>;
    getLeaderboard(page?: number, limit?: number): Promise<{
        leaderboard: Array<{
            rank: number;
            userId: Types.ObjectId;
            username: string;
            score: number;
        }>;
        total: number;
        page: number;
        totalPages: number;
    }>;
    getTopScores(limit?: number): Promise<Score[]>;
}
