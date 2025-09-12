import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Button,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Box,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import SideBar from "../../components/Sidebar/SideBar";
import { isAuthenticated } from "../../utils/auth";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");

  const quizMode = location.state?.mode || "practice";
  const quizSessionId = `quiz_${new Date().getTime()}_${Math.random()
    .toString(36)
    .slice(2)}`; // Unique session ID

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      navigate("/login", { replace: true });
      return;
    }

    // Get user data from local storage
    const name = localStorage.getItem("username");
    const userRole = localStorage.getItem("role");
    if (name) setUsername(name);
    if (userRole) setRole(userRole);

    const fetchData = async () => {
      try {
        const [questionsRes, responsesRes] = await Promise.all([
          axios.get("http://localhost:3001/api/question/all"),
          axios.get("http://localhost:3001/api/response"),
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
        `http://localhost:3001/api/response?userId=${userId}`
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
          `http://localhost:3001/api/score/calculate/${userId}`
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
          `http://localhost:3001/api/score/calculate/${userId}`
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
        "http://localhost:3001/api/response/submit",
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
        `http://localhost:3001/api/score/calculate/${userId}`
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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile Menu Toggle Button */}
      <button 
        className="menu-toggle" 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          zIndex: 1200,
          background: 'none',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          display: { xs: 'block', md: 'none' },
          color: '#4361ee'
        }}
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>
      
      {/* Sidebar */}
      <SideBar 
        username={username}
        role={role}
        isOpen={isMenuOpen}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3,
          width: { sm: `calc(100% - 250px)` },
          ml: { sm: '250px' },
          mt: { xs: '50px', sm: 0 }
        }}
      >
        <div className="quiz-container">
          {error && (
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
          )}

          {questions.length > 0 && currentQuestion ? (
            <div className="question-container">
              <Typography variant="h5" gutterBottom>
                {`${currentQuestionIndex + 1}. ${
                  currentQuestion.text || currentQuestion.textequestion || 'No question text available'
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
      </Box>
    </Box>
  );
};

export default QuizGame;
