import { ScoreService } from './score.service';
import { Score } from './score.schema';
export declare class ScoreController {
    private readonly scoreService;
    private readonly logger;
    constructor(scoreService: ScoreService);
    calculateScore(userId: string): Promise<Score>;
}
