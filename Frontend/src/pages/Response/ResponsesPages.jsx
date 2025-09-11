import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Button,
  IconButton,
  Typography,
  Modal,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Snackbar,
  Alert,
  Checkbox,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const ResponsesPage = () => {
  const [responses, setResponses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [newResponses, setNewResponses] = useState([
    { text: "", questionId: "", isCorrect: false },
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentPage, setCurrentPage] = useState(1); // New state for pagination
  const responsesPerPage = 5; // Max responses per page

  const navigate = useNavigate(); // Initialize the navigate function

  const fetchResponses = async () => {
    try {
      const res = await axios.get("http://localhost:3001/response");
      setResponses(res.data.responses);
    } catch (error) {
      console.error("Error fetching responses:", error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await axios.get("http://localhost:3001/question/all");
      setQuestions(res.data.questions);
      setLoadingQuestions(false);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchResponses();
    fetchQuestions();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this response?")) {
      try {
        await axios.delete(`http://localhost:3001/response/${id}`);
        fetchResponses();
        showSnackbar("Response deleted successfully!", "success");
      } catch (error) {
        console.error("Error deleting response:", error);
        showSnackbar("Error deleting response.", "error");
      }
    }
  };

  const handleCreate = async () => {
    // Check if all fields are filled
    if (
      newResponses.some((response) => !response.text || !response.questionId)
    ) {
      alert("Please fill out all fields!");
      return;
    }

    try {
      // Validate questionId for each response (Ensure it's a valid ObjectId format)
      for (const response of newResponses) {
        if (!response.questionId || response.questionId.trim() === "") {
          showSnackbar(`Invalid questionId: ${response.questionId}`, "error");
          return; // Exit early if invalid questionId
        }
      }

      // Bulk create responses by sending a batch request to the backend
      const responseData = newResponses.map((response) => ({
        text: response.text,
        questionId: response.questionId, // Assuming it's in ObjectId format
        isCorrect: response.isCorrect,
      }));

      // Make the POST request for creating multiple responses at once
      const res = await axios.post(
        "http://localhost:3001/response/create-multiple",
        responseData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Handle success
      if (res.status === 201) {
        console.log("Responses created:", res.data);
        fetchResponses(); // Refresh the responses
        setModalOpen(false); // Close the modal
        setNewResponses([{ text: "", questionId: "", isCorrect: false }]); // Reset the form
        showSnackbar("Responses created successfully!", "success");
      } else {
        console.error("Failed to create responses:", res.data);
        showSnackbar("Failed to create responses.", "error");
      }
    } catch (error) {
      console.error("Error in handleCreate:", error);
      showSnackbar("Error creating responses.", "error");
    }
  };

  const handleEdit = async () => {
    if (!editingResponse.text || !editingResponse.questionId) {
      alert("Please enter response text and select a question!");
      return;
    }

    try {
      await axios.put(`http://localhost:3001/response/${editingResponse._id}`, {
        text: editingResponse.text,
        isCorrect: editingResponse.isCorrect,
        questionId: editingResponse.questionId,
      });
      fetchResponses();
      setModalOpen(false);
      setEditingResponse(null);
      showSnackbar("Response updated successfully!", "success");
    } catch (error) {
      console.error("Error editing response:", error);
      showSnackbar("Error updating response.", "error");
    }
  };

  const handleModalOpen = (response = null) => {
    if (response) {
      setEditingResponse({
        _id: response._id,
        text: response.text,
        isCorrect: response.isCorrect,
        questionId: response.questionId._id,
      });
    } else {
      setEditingResponse(null);
      setNewResponses([{ text: "", questionId: "", isCorrect: false }]);
    }
    setModalOpen(true);
  };

  const showSnackbar = (message, severity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleResponseChange = (index, field, value) => {
    const updatedResponses = [...newResponses];
    updatedResponses[index][field] = value;
    setNewResponses(updatedResponses);
  };

  const handleAddResponse = () => {
    setNewResponses([
      ...newResponses,
      { text: "", questionId: "", isCorrect: false },
    ]);
  };

  // Pagination logic
  const indexOfLastResponse = currentPage * responsesPerPage;
  const indexOfFirstResponse = indexOfLastResponse - responsesPerPage;
  const currentResponses = responses.slice(
    indexOfFirstResponse,
    indexOfLastResponse
  );

  // Handle page navigation
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f4f4f9",
        borderRadius: "8px",
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        style={{ textAlign: "center", color: "#4caf50" }}
      >
        Responses List
      </Typography>

      <div style={{ marginBottom: "20px" }}>
        {responses.length === 0 ? (
          <Typography variant="h6" align="center" color="textSecondary">
            No Responses Available
          </Typography>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>#</th>
                <th style={tableHeaderStyle}>Response</th>
                <th style={tableHeaderStyle}>Question</th>
                <th style={tableHeaderStyle}>Is Correct</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentResponses.map((res, index) => (
                <tr key={res._id} style={tableRowStyle}>
                  <td>{index + 1}</td>
                  <td>{res.text}</td>
                  <td>
                    {res.questionId
                      ? res.questionId.textequestion
                      : "No Question"}
                  </td>
                  <td>
                    <span
                      style={
                        res.isCorrect ? correctBadgeStyle : wrongBadgeStyle
                      }
                    >
                      {res.isCorrect ? "Correct" : "Wrong"}
                    </span>
                  </td>
                  <td>
                    <IconButton
                      color="primary"
                      onClick={() => handleModalOpen(res)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      color="secondary"
                      onClick={() => handleDelete(res._id)}
                    >
                      <Delete />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "20px",
          }}
        >
          <Button
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <Typography style={{ margin: "0 10px" }}>
            Page {currentPage}
          </Typography>
          <Button
            disabled={indexOfLastResponse >= responses.length}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Button
        variant="contained"
        color="primary"
        onClick={() => handleModalOpen()}
        style={{ marginTop: "20px", display: "block", margin: "0 auto" }}
      >
        Add Response
      </Button>

      <Button
        variant="contained"
        color="secondary"
        onClick={() => navigate("/home")} // Navigate to "/home"
        style={{ marginTop: "20px", display: "block", margin: "0 auto" }}
      >
        Go to Home
      </Button>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <Box
          style={{
            width: "400px",
            margin: "50px auto",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <Typography variant="h5" gutterBottom>
            {editingResponse ? "Edit Response" : "Create Responses"}
          </Typography>

          {editingResponse ? (
            <>
              <TextField
                label="Response Text"
                variant="outlined"
                fullWidth
                value={editingResponse.text}
                onChange={(e) =>
                  setEditingResponse({
                    ...editingResponse,
                    text: e.target.value,
                  })
                }
                style={{ marginBottom: "20px" }}
              />
              <FormControl fullWidth style={{ marginBottom: "20px" }}>
                <InputLabel>Selected Question</InputLabel>
                <Select value={editingResponse.questionId} disabled>
                  {questions
                    .filter(
                      (question) => question._id === editingResponse.questionId
                    )
                    .map((question) => (
                      <MenuItem key={question._id} value={question._id}>
                        {question.textequestion}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingResponse.isCorrect}
                    onChange={(e) =>
                      setEditingResponse({
                        ...editingResponse,
                        isCorrect: e.target.checked,
                      })
                    }
                  />
                }
                label="Correct"
              />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleEdit}
                >
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {newResponses.map((response, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <TextField
                      label="Response Text"
                      variant="outlined"
                      fullWidth
                      value={response.text}
                      onChange={(e) =>
                        handleResponseChange(index, "text", e.target.value)
                      }
                    />
                    <FormControl
                      fullWidth
                      style={{ marginTop: "10px", marginBottom: "10px" }}
                    >
                      <InputLabel>Question</InputLabel>
                      <Select
                        value={response.questionId}
                        onChange={(e) =>
                          handleResponseChange(
                            index,
                            "questionId",
                            e.target.value
                          )
                        }
                      >
                        {questions.map((question) => (
                          <MenuItem key={question._id} value={question._id}>
                            {question.textequestion}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={response.isCorrect}
                          onChange={(e) =>
                            handleResponseChange(
                              index,
                              "isCorrect",
                              e.target.checked
                            )
                          }
                        />
                      }
                      label="Correct"
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Button
                  variant="outlined"
                  onClick={handleAddResponse}
                  style={{ marginTop: "20px" }}
                >
                  Add Another Response
                </Button>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCreate}
                  >
                    Create Responses
                  </Button>
                </div>
              </div>
            </>
          )}
        </Box>
      </Modal>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

const tableHeaderStyle = {
  borderBottom: "2px solid #e0e0e0",
  padding: "10px",
  fontWeight: "bold",
};

const tableRowStyle = {
  borderBottom: "1px solid #e0e0e0",
};

const correctBadgeStyle = {
  color: "green",
};

const wrongBadgeStyle = {
  color: "red",
};

export default ResponsesPage;
