declare class Answer {
    questionId: string;
    selectedResponseId: string;
}
export declare class SubmitAnswerDto {
    userId: string;
    answers: Answer[];
    quizId?: string;
}
export {};
