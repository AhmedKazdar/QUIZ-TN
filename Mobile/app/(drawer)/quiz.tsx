import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ImageSourcePropType,
} from "react-native";
import axios, { AxiosError } from "axios";
import { RouteProp, useRoute } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

/* -------------------- TYPES -------------------- */
type Question = {
  _id: string;
  textequestion: string;
};

type ResponseItem = {
  _id: string;
  questionId: { _id: string } | string;
  text: string;
  isCorrect: boolean;
};

type SelectedAnswer = {
  questionId: string;
  selectedAnswerId: string;
  correctAnswerId?: string;
  selectedAnswerText: string;
};

type DrawerParamList = {
  index: undefined;
  profile: undefined;
  quiz: { mode?: "practice" | "online"; reset?: boolean };
  settings: undefined;
  "(drawer)": { resetQuiz?: string };
};

type QuizRouteProp = RouteProp<DrawerParamList, "quiz">;

export default function QuizScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [shuffledResponses, setShuffledResponses] = useState<ResponseItem[]>(
    []
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(false);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restartCount, setRestartCount] = useState(0);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [currentSponsorImage, setCurrentSponsorImage] =
    useState<ImageSourcePropType | null>(null);

  const route = useRoute<QuizRouteProp>();
  const quizMode = route.params?.mode ?? "practice";
  const shouldReset = route.params?.reset ?? false;

  // Store timer ID for cleanup
  const timerRef = useRef<number | null>(null);

  // Sponsor images array
  const sponsorImages: ImageSourcePropType[] = [
    require("../../assets/sponsor/sponsor1.png"),
    require("../../assets/sponsor/sponsor2.png"),
  ];

  console.log("QuizScreen: Route params", {
    mode: quizMode,
    shouldReset,
    restartCount,
  });

  // Reset state if shouldReset is true
  useEffect(() => {
    if (shouldReset) {
      console.log("QuizScreen: Resetting state due to reset param");
      resetState();
    }
  }, [shouldReset]);

  // Helper function to reset state
  const resetState = () => {
    setQuestions([]);
    setResponses([]);
    setShuffledResponses([]);
    setIndex(0);
    setSelected(false);
    setScore(0);
    setFinalScore(0);
    setShowModal(false);
    setSelectedAnswers([]);
    setTimeLeft(10);
    setError(null);
    setIsLoading(true);
    setRestartCount(0);
    setFetchTrigger((prev) => prev + 1);
    setCurrentSponsorImage(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("QuizScreen: Component unmounting, clearing state");
      resetState();
    };
  }, []);

  // Sponsor image rotation
  useEffect(() => {
    if (showModal || isLoading || error) return;

    const selectRandomImage = () => {
      const randomIndex = Math.floor(Math.random() * sponsorImages.length);
      setCurrentSponsorImage(sponsorImages[randomIndex]);
    };

    selectRandomImage(); // Set initial image

    const interval = setInterval(selectRandomImage, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [showModal, isLoading, error]);

  const fetchQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("QuizScreen: Fetching quiz data", {
        restartCount,
        fetchTrigger,
      });
      const [qRes, rRes] = await Promise.all([
        axios.get("http://192.168.1.115:3001/question/all"),
        axios.get("http://192.168.1.115:3001/response"),
      ]);

      const allQ: Question[] = Array.isArray(qRes.data.questions)
        ? qRes.data.questions
        : [];
      const allR: ResponseItem[] = Array.isArray(rRes.data.responses)
        ? rRes.data.responses
        : [];

      if (!allQ.length || !allR.length) {
        throw new Error("No questions or responses found");
      }

      const filteredQ = allQ.filter((q) =>
        allR.some(
          (r) =>
            String(
              typeof r.questionId === "string" ? r.questionId : r.questionId._id
            ) === q._id
        )
      );

      if (!filteredQ.length) {
        throw new Error("No valid questions found after filtering");
      }

      const orderedQ =
        quizMode === "practice"
          ? [...filteredQ].sort(() => Math.random() - 0.5)
          : filteredQ;

      console.log("QuizScreen: Setting state", {
        questions: orderedQ.length,
        responses: allR.length,
      });
      setQuestions(orderedQ);
      setResponses(allR);
      setSelectedAnswers([]);
      setScore(0);
      setIndex(0);
      setFinalScore(0);
      setShuffledResponses([]);
      setTimeLeft(10);
      setError(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : err instanceof Error
          ? err.message
          : "Unknown error fetching quiz data";
      console.error("QuizScreen: Fetch error", errorMessage, err);
      setError("Failed to fetch quiz data: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [quizMode]);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchQuiz();
    }
    return () => {
      isMounted = false;
      console.log("QuizScreen: fetchQuiz useEffect cleanup");
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchQuiz, fetchTrigger]);

  useEffect(() => {
    if (!questions.length || !responses.length) return;

    setTimeLeft(10);
    const currQ = questions[index];
    if (!currQ) {
      console.error("QuizScreen: No current question at index", index);
      setError("Invalid question index");
      return;
    }
    const possible = responses.filter((r) => {
      const qid =
        typeof r.questionId === "string" ? r.questionId : r.questionId._id;
      return qid === currQ._id;
    });

    console.log("QuizScreen: Shuffled responses", possible.length);
    setShuffledResponses([...possible].sort(() => Math.random() - 0.5));
    setSelected(false);
  }, [index, questions, responses]);

  useEffect(() => {
    if (timeLeft > 0 && !selected) {
      timerRef.current = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    if (timeLeft === 0 && !selected) {
      if (quizMode === "online") {
        setSelected(true);
        finishQuiz();
      } else {
        setSelected(true);
      }
    }
  }, [timeLeft, selected, quizMode]);

  const handleAnswer = (resp: ResponseItem) => {
    if (selected) return;
    setSelected(true);

    const questionId =
      typeof resp.questionId === "string"
        ? resp.questionId
        : resp.questionId._id;
    const correct = responses.find(
      (r) =>
        (typeof r.questionId === "string" ? r.questionId : r.questionId._id) ===
          questionId && r.isCorrect
    );

    const isAnswerCorrect = resp._id === correct?._id;

    setSelectedAnswers((prev) => {
      const existingAnswer = prev.find((a) => a.questionId === questionId);
      if (existingAnswer) {
        console.log("QuizScreen: Answer exists for question", questionId);
        return prev;
      }

      const newAnswer = {
        questionId,
        selectedAnswerId: resp._id,
        correctAnswerId: correct?._id,
        selectedAnswerText: resp.text,
      };
      console.log(
        "QuizScreen: New answer",
        newAnswer,
        "Correct:",
        isAnswerCorrect
      );
      return [...prev, newAnswer];
    });

    if (isAnswerCorrect) {
      setScore((s) => {
        console.log("QuizScreen: Score incremented to", s + 1);
        return s + 1;
      });
    }

    if (quizMode === "online") {
      setTimeout(() => {
        if (!isAnswerCorrect) {
          finishQuiz();
        } else if (index < questions.length - 1) {
          setIndex((i) => i + 1);
          setTimeLeft(10); // Reset timer for next question
        } else {
          finishQuiz();
        }
      }, 800);
    }
  };

  const finishQuiz = async () => {
    console.log("QuizScreen: Finishing quiz", { score, selectedAnswers });
    setShowModal(true);
    const userId = await SecureStore.getItemAsync("userId");
    if (!userId) {
      console.error("QuizScreen: No userId found");
      setError("User not found");
      return;
    }

    try {
      try {
        const deleteResponse = await axios.delete(
          `http://192.168.1.115:3001/response/user/${userId}`
        );
        console.log(
          "QuizScreen: Cleared previous responses",
          deleteResponse.data
        );
      } catch (deleteError: unknown) {
        const errorMessage =
          deleteError instanceof AxiosError
            ? deleteError.response?.data?.message || deleteError.message
            : "Unknown error clearing responses";
        console.error("QuizScreen: Error clearing responses", errorMessage);
        setError("Failed to clear previous responses: " + errorMessage);
        return;
      }

      const payload = selectedAnswers.map((a) => ({
        userId,
        questionId: a.questionId,
        text: a.selectedAnswerText,
        isCorrect: a.selectedAnswerId === a.correctAnswerId,
      }));
      console.log("QuizScreen: Submitting responses", payload);

      try {
        const submitResponse = await axios.post(
          "http://192.168.1.115:3001/response/submit",
          payload
        );
        console.log("QuizScreen: Submit response", submitResponse.data);
      } catch (submitError: unknown) {
        const errorMessage =
          submitError instanceof AxiosError
            ? submitError.response?.data?.message || submitError.message
            : "Unknown error submitting responses";
        console.error("QuizScreen: Error submitting responses", errorMessage);
        setError("Failed to submit responses: " + errorMessage);
        return;
      }

      const sc = await axios.post(
        `http://192.168.1.115:3001/score/calculate/${userId}`
      );
      console.log("QuizScreen: Backend score", sc.data.score);
      setFinalScore(sc.data.score ?? 0);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : "Unknown error completing quiz";
      console.error("QuizScreen: Error in finishQuiz", errorMessage);
      setError("Could not complete quiz submission: " + errorMessage);
    }
  };

  const restart = async () => {
    console.log("QuizScreen: Restarting quiz", {
      restartCount: restartCount + 1,
    });
    try {
      const userId = await SecureStore.getItemAsync("userId");
      if (userId) {
        try {
          const deleteResponse = await axios.delete(
            `http://192.168.1.115:3001/response/user/${userId}`
          );
          console.log(
            "QuizScreen: Cleared responses on restart",
            deleteResponse.data
          );
        } catch (deleteError: unknown) {
          const errorMessage =
            deleteError instanceof AxiosError
              ? deleteError.response?.data?.message || deleteError.message
              : "Unknown error clearing responses";
          console.error(
            "QuizScreen: Error clearing responses on restart",
            errorMessage
          );
          setError("Failed to clear responses for restart: " + errorMessage);
          return;
        }
      }
      resetState();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : "Unknown error restarting quiz";
      console.error("QuizScreen: Error in restart", errorMessage);
      setError("Failed to restart quiz: " + errorMessage);
    }
  };

  const goToHome = async () => {
    console.log("QuizScreen: Navigating to home");
    try {
      const userId = await SecureStore.getItemAsync("userId");
      if (userId) {
        try {
          const deleteResponse = await axios.delete(
            `http://192.168.1.115:3001/response/user/${userId}`
          );
          console.log(
            "QuizScreen: Cleared responses on home navigation",
            deleteResponse.data
          );
        } catch (deleteError: unknown) {
          const errorMessage =
            deleteError instanceof AxiosError
              ? deleteError.response?.data?.message || deleteError.message
              : "Unknown error clearing responses";
          console.error(
            "QuizScreen: Error clearing responses on home navigation",
            errorMessage
          );
          setError("Failed to clear responses: " + errorMessage);
          return;
        }
      }
      resetState();
      router.replace({
        pathname: "/(drawer)",
        params: { resetQuiz: "true" },
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : "Unknown error navigating to home";
      console.error("QuizScreen: Error in goToHome", errorMessage);
      setError("Failed to navigate to home: " + errorMessage);
    }
  };

  console.log("QuizScreen: Rendering", {
    error,
    questions: questions.length,
    shuffledResponses: shuffledResponses.length,
    index,
    score,
    timeLeft,
    restartCount,
    isLoading,
  });

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={goToHome}>
          <Text style={styles.homeTxt}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const currQ = questions[index];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.timer}>⏳ {timeLeft}s</Text>
        <Text style={styles.question}>
          {currQ?.textequestion || "Loading..."}
        </Text>

        {shuffledResponses.map((r) => (
          <TouchableOpacity
            key={r._id}
            style={[
              styles.option,
              selected && r.isCorrect
                ? styles.correct
                : selected &&
                  r._id ===
                    selectedAnswers.find(
                      (a) =>
                        a.questionId ===
                        (typeof r.questionId === "string"
                          ? r.questionId
                          : r.questionId._id)
                    )?.selectedAnswerId
                ? styles.wrong
                : null,
            ]}
            onPress={() => handleAnswer(r)}
            disabled={selected}
          >
            <Text style={styles.optionTxt}>{r.text}</Text>
          </TouchableOpacity>
        ))}

        {quizMode === "practice" &&
          selected &&
          index < questions.length - 1 && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => {
                setIndex((i) => i + 1);
                setTimeLeft(10); // Reset timer for next question
              }}
            >
              <Text style={styles.nextTxt}>Next</Text>
            </TouchableOpacity>
          )}

        {quizMode === "practice" &&
          selected &&
          index === questions.length - 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={finishQuiz}>
              <Text style={styles.nextTxt}>Finish</Text>
            </TouchableOpacity>
          )}
      </View>

      {currentSponsorImage && (
        <View style={styles.sponsorContainer}>
          <Image
            source={currentSponsorImage}
            style={styles.sponsorImage}
            resizeMode="contain"
          />
        </View>
      )}

      <Modal transparent visible={showModal} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.score}>
            {finalScore} / {questions.length}
          </Text>
          <Text style={styles.message}>
            {quizMode === "online" && finalScore !== questions.length
              ? "❌ Game Over! You answered incorrectly."
              : finalScore === questions.length
              ? "🔥 Perfect!"
              : finalScore >= questions.length / 2
              ? "👏 Well done!"
              : "🤔 Keep practicing!"}
          </Text>

          <TouchableOpacity style={styles.restartBtn} onPress={restart}>
            <Text style={styles.restartTxt}>Restart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={goToHome}>
            <Text style={styles.homeTxt}>Home</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------- STYLES -------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f9f9f9",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  timer: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  question: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
    color: "#222",
  },
  option: {
    backgroundColor: "#e0e0e0",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  optionTxt: {
    fontSize: 16,
    color: "#000",
    textAlign: "center",
  },
  correct: {
    backgroundColor: "#c8e6c9",
  },
  wrong: {
    backgroundColor: "#ffcdd2",
  },
  nextBtn: {
    backgroundColor: "#2196f3",
    padding: 12,
    marginTop: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  nextTxt: {
    color: "#fff",
    fontSize: 16,
  },
  sponsorContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    padding: 10,
    backgroundColor: "#e0e0e0",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  sponsorImage: {
    width: "100%",
    height: "100%",
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  score: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  message: {
    fontSize: 20,
    color: "#fff",
    marginBottom: 20,
  },
  restartBtn: {
    backgroundColor: "#4caf50",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  restartTxt: {
    color: "#fff",
    fontSize: 16,
  },
  homeBtn: {
    backgroundColor: "#f44336",
    padding: 12,
    borderRadius: 8,
  },
  homeTxt: {
    color: "#fff",
    fontSize: 16,
  },
  error: {
    color: "red",
    textAlign: "center",
    marginTop: 40,
  },
});
