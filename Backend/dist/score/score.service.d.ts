import { Model } from 'mongoose';
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
}
