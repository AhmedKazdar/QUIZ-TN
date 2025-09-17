import { Model, Types } from 'mongoose';
import { Score } from './score.schema';
import { ResponseDocument } from '../response/response.schema';
import { User } from '../user/user.schema';
export declare class ScoreService {
    private scoreModel;
    private responseModel;
    private userModel;
    constructor(scoreModel: Model<Score>, responseModel: Model<ResponseDocument>, userModel: Model<User>);
    syncUserScore(userId: string): Promise<Score>;
    calculateScore(userId: string): Promise<Score>;
    getTopRanking(limit?: number): Promise<Score[]>;
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
}
