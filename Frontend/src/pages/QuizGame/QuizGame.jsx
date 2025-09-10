import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Button,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import "./QuizGame.css";

const QuizGame = () => {
  const [questions, setQuestions] = useState([]);
  const [score, setScore] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [selected, setSelected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [shuffledResponses, setShuffledResponses] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [error, setError] = useState("");
  const [responses, setResponses] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [isRestarted, setIsRestarted] = useState(false); // Track restart
  const navigate = useNavigate();
  const location = useLocation();

  const quizMode = location.state?.mode || "practice";
  const quizSessionId = `quiz_${new Date().getTime()}_${Math.random()
    .toString(36)
    .slice(2)}`; // Unique session ID

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [questionsRes, responsesRes] = await Promise.all([
          axios.get("http://localhost:3001/question/all"),
          axios.get("http://localhost:3001/response"),
        ]);

        const allQuestions = questionsRes.data.questions;
        const allResponses = responsesRes.data.responses;

        const filteredQuestions = allQuestions.filter((question) =>
          allResponses.some(
            (response) =>
              String(response.questionId._id) === String(question._id)
          )
        );

        const finalQuestions =
          quizMode === "practice"
            ? filteredQuestions.sort(() => Math.random() - 0.5)
            : filteredQuestions;

        setQuestions(finalQuestions);
        setResponses(allResponses);
      } catch (error) {
        console.error("Error fetching quiz data:", error);
        setError("Failed to load quiz data. Please try again.");
      }
    };

    fetchData();
  }, [quizMode]);

  useEffect(() => {
    if (questions.length > 0 && responses.length > 0) {
      setTimeLeft(10);
      const currentQuestion = questions[currentQuestionIndex];
      const current = responses.filter((r) => {
        const responseQuestionId =
          typeof r.questionId === "object" ? r.questionId._id : r.questionId;
        return String(responseQuestionId) === String(currentQuestion?._id);
      });

      setShuffledResponses(current.sort(() => Math.random() - 0.5));
      setSelected(false);
    }
  }, [currentQuestionIndex, responses, questions]);

  useEffect(() => {
    if (timeLeft > 0 && !selected) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !selected) {
      setSelected(true);
    }
  }, [timeLeft, selected]);

  const handleAnswerSelection = (response) => {
    if (selected) return;
    setSelected(true);

    const isCorrect = response.isCorrect;

    const questionId =
      typeof response.questionId === "object"
        ? response.questionId._id
        : response.questionId;

    const correctAnswer = responses.find(
      (r) =>
        (typeof r.questionId === "object" ? r.questionId._id : r.questionId) ===
          questionId && r.isCorrect === true
    );

    setSelectedAnswers((prev) => [
      ...prev,
      {
        questionId: questionId,
        selectedAnswerId: response._id,
        selectedAnswerText: response.text,
        correctAnswerId: correctAnswer?._id,
      },
    ]);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      if (quizMode === "online") {
        setTimeout(() => {
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
            setSelected(false);
            setTimeLeft(10);
          } else {
            handleFinishQuiz();
          }
        }, 1000);
      }
    } else if (quizMode === "online") {
      setTimeout(() => {
        handleFinishQuiz();
      }, 500);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelected(false);
      setTimeLeft(10);
    }
  };

  const handleFinishQuiz = async () => {
    setShowFinalScore(true);
    const userId = localStorage.getItem("userId");

    if (!userId) {
      setError("User not found. Please log in again.");
      return;
    }

    console.log("Fetched userId from localStorage:", userId);

    try {
      // Fetch existing responses
      const existingResponses = await axios.get(
        `http://localhost:3001/response?userId=${userId}`
      );
      console.log("Existing responses:", existingResponses.data);

      const existingQuestionIds = new Set(
        existingResponses.data.responses.map((r) => r.questionId.toString())
      );
      console.log("Existing question IDs:", existingQuestionIds);

      if (isRestarted) {
        console.log("Quiz restarted, skipping response submission");
        // Skip submission, only fetch score
        const scoreResponse = await axios.post(
          `http://localhost:3001/score/calculate/${userId}`
        );
        console.log("Score fetched successfully:", scoreResponse.data);
        if (scoreResponse.data?.score !== undefined) {
          setFinalScore(scoreResponse.data.score);
        } else {
          setError("Failed to fetch the score.");
        }
        return;
      }

      // Filter out already answered questions
      const newAnswers = selectedAnswers.filter(
        (answer) => !existingQuestionIds.has(answer.questionId.toString())
      );
      console.log("New Answers to Submit:", newAnswers);

      if (newAnswers.length === 0) {
        console.log("No new answers to submit, fetching score only");
        const scoreResponse = await axios.post(
          `http://localhost:3001/score/calculate/${userId}`
        );
        console.log("Score fetched successfully:", scoreResponse.data);
        if (scoreResponse.data?.score !== undefined) {
          setFinalScore(scoreResponse.data.score);
        } else {
          setError("Failed to fetch the score.");
        }
        return;
      }

      // Format answers for submission
      const formattedAnswers = newAnswers.map((answer) => ({
        userId,
        questionId: answer.questionId,
        isCorrect: answer.selectedAnswerId === answer.correctAnswerId,
        text: answer.selectedAnswerText || "",
      }));

      console.log("Submitting responses:", formattedAnswers);
      const response = await axios.post(
        "http://localhost:3001/response/submit",
        formattedAnswers
      );
      console.log("Responses submitted successfully:", response.data);

      if (response.data?.message !== "Responses submitted successfully") {
        throw new Error("Failed to submit responses.");
      }

      // Mark responses as submitted
      localStorage.setItem(`submitted_${userId}_${quizSessionId}`, "true");

      // Fetch score
      const scoreResponse = await axios.post(
        `http://localhost:3001/score/calculate/${userId}`
      );
      console.log("Score saved successfully:", scoreResponse.data);
      if (scoreResponse.data?.score !== undefined) {
        setFinalScore(scoreResponse.data.score);
      } else {
        setError("Failed to fetch the score.");
      }

      /*  // Fetch rankings
      const rankingResponse = await axios.get(
        "http://localhost:3001/score/ranking"
      );
      setRanking(rankingResponse.data); */
    } catch (error) {
      console.error("Error in handleFinishQuiz:", error.message);
      setError("Failed to process quiz results. Please try again.");
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelected(false);
    setSelectedAnswers([]);
    setShowFinalScore(false);
    setIsRestarted(true); // Mark as restarted
    console.log("Quiz restarted, isRestarted set to true");
    setTimeLeft(10);
    // Do not clear submission flag to prevent resubmission
  };

  const getResultMessage = () => {
    if (finalScore === questions.length) return "Amazing! Perfect Score!";
    if (finalScore >= questions.length / 2) return "Good Job!";
    return "Better Luck Next Time!";
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        <div className="quiz-content">
          {currentQuestion ? (
            <div>
              <Typography variant="h4" gutterBottom className="question-text">
                {`Question ${currentQuestionIndex + 1}: ${
                  currentQuestion.textequestion
                }`}
              </Typography>

              <LinearProgress
                variant="determinate"
                value={(timeLeft / 10) * 100}
                className="progress-bar"
              />

              <div className="responses-container">
                <Typography variant="h6" gutterBottom>
                  Choose your answer:
                </Typography>
                {shuffledResponses.map((response) => (
                  <Button
                    key={response._id}
                    variant="contained"
                    fullWidth
                    onClick={() => handleAnswerSelection(response)}
                    disabled={selected}
                    className="response-button"
                    aria-label={`Answer: ${response.text}`}
                  >
                    {response.text}
                  </Button>
                ))}
              </div>

              {quizMode === "practice" && (
                <div>
                  {currentQuestionIndex < questions.length - 1 ? (
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleNextQuestion}
                      disabled={!selected}
                      className="next-btn"
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleFinishQuiz}
                      disabled={!selected}
                      className="finish-btn"
                    >
                      Finish Quiz
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Typography variant="h6">Loading quiz...</Typography>
          )}

          <Dialog
            open={showFinalScore}
            onClose={() => setShowFinalScore(false)}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle className="dialog-title">
              🎉 Quiz Completed!
            </DialogTitle>
            <DialogContent className="dialog-content">
              <Typography variant="h5" gutterBottom>
                Your Score: {finalScore} / {questions.length}
              </Typography>
              <Typography variant="h6">{getResultMessage()}</Typography>

              <Typography variant="h6" gutterBottom>
                Top 5 Rankings:
              </Typography>
              {ranking.length > 0 ? (
                ranking.map((rank, index) => (
                  <Typography key={rank._id} variant="body1">
                    {index + 1}. {rank.userId.username}: {rank.score} points
                  </Typography>
                ))
              ) : (
                <Typography variant="body1">
                  No rankings available yet.
                </Typography>
              )}

              {quizMode !== "online" && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRestartQuiz}
                  className="restart-btn"
                >
                  Restart Quiz
                </Button>
              )}

              <Button
                variant="outlined"
                color="secondary"
                onClick={() => navigate("/home")}
                className="home-btn"
              >
                Go to Home Page
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default QuizGame;
