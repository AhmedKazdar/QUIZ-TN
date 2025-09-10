import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Question.css"; // Import the custom styles
import { useNavigate } from "react-router-dom";

const QuestionsTable = () => {
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null); // Track the question being edited
  const [updatedQuestion, setUpdatedQuestion] = useState({
    textequestion: "",
    type: "",
  });
  const [creating, setCreating] = useState(false); // State for showing the create form
  const [newQuestion, setNewQuestion] = useState({
    textequestion: "",
    type: "multiple-choice",
  });
  const [currentPage, setCurrentPage] = useState(1); // State for the current page
  const questionsPerPage = 5; // Number of questions per page
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get("http://localhost:3001/question/all");
      setQuestions(response.data.questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  // Handle editing question
  const handleEdit = (id, textequestion, type) => {
    setEditing(id); // Set the current question to be edited
    setUpdatedQuestion({ textequestion, type }); // Pre-fill the form with the current data
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUpdatedQuestion((prevQuestion) => ({
      ...prevQuestion,
      [name]: value,
    }));
  };

  const handleSubmit = async (e, id) => {
    e.preventDefault();
    try {
      await axios.put(
        `http://localhost:3001/question/update/${id}`,
        updatedQuestion
      );
      setEditing(null); // Stop editing
      fetchQuestions(); // Re-fetch the questions to reflect changes
    } catch (error) {
      console.error("Error updating question:", error);
    }
  };

  // Handle creating new question
  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    if (name === "textequestion") {
      setNewQuestion((prevQuestion) => ({
        ...prevQuestion,
        textequestion: value,
      }));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:3001/question/create", newQuestion);
      setCreating(false); // Hide create form
      setNewQuestion({ textequestion: "", type: "" }); // Clear the form
      fetchQuestions(); // Re-fetch the questions to include the new one
    } catch (error) {
      console.error("Error creating question:", error);
    }
  };

  const handleCancel = () => {
    setEditing(null); // Stop editing without saving
  };

  const handleCreateCancel = () => {
    setCreating(false); // Hide the create form
    setNewQuestion({ textequestion: "", type: "" }); // Clear the form
  };

  // Handle delete with confirmation
  const handleDelete = async (id) => {
    // Confirm deletion with the user
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (confirmDelete) {
      try {
        await axios.delete(`http://localhost:3001/question/delete/${id}`);
        fetchQuestions(); // Re-fetch the questions to update the list
      } catch (error) {
        console.error("Error deleting question:", error);
      }
    }
  };

  // Get the current questions based on the current page and items per page
  const indexOfLastQuestion = currentPage * questionsPerPage;
  const indexOfFirstQuestion = indexOfLastQuestion - questionsPerPage;
  const currentQuestions = questions.slice(
    indexOfFirstQuestion,
    indexOfLastQuestion
  );

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="container">
      <h2 className="title">All Questions</h2>
      <div className="button-container">
        <button className="btn home-btn" onClick={() => navigate("/home")}>
          Go to Home
        </button>
        <button className="btn home-btn" onClick={() => setCreating(true)}>
          Create New Question
        </button>
      </div>

      {creating && (
        <div className="form-container">
          <h3>Create Question</h3>
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label>Text:</label>
              <input
                type="text"
                name="textequestion"
                value={newQuestion.textequestion}
                onChange={handleCreateChange}
                required
                className="input-field"
              />
            </div>
            {/*    <div className="form-group">
              <label>Type:</label>
              <input
                type="text"
                name="type"
                value={newQuestion.type}
                onChange={handleCreateChange}
                required
                className="input-field"
              />
            </div> */}
            <div className="form-actions">
              <button type="submit" className="btn submit-btn">
                Create
              </button>
              <button
                type="button"
                className="btn cancel-btn"
                onClick={handleCreateCancel}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table className="questions-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Text</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentQuestions.map((q, index) => (
            <tr key={q._id} className={index % 2 === 0 ? "even" : "odd"}>
              <td>{q._id}</td>
              <td>
                {editing === q._id ? (
                  <input
                    type="text"
                    name="textequestion"
                    value={updatedQuestion.textequestion}
                    onChange={handleChange}
                    className="input-field"
                  />
                ) : (
                  q.textequestion
                )}
              </td>
              <td>
                {editing === q._id ? (
                  <input
                    type="text"
                    name="type"
                    value={updatedQuestion.type}
                    onChange={handleChange}
                    className="input-field"
                  />
                ) : (
                  q.type
                )}
              </td>
              <td>
                {editing === q._id ? (
                  <>
                    <button
                      className="btn save-btn"
                      onClick={(e) => handleSubmit(e, q._id)}
                    >
                      Save
                    </button>
                    <button className="btn cancel-btn" onClick={handleCancel}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn edit-btn"
                      onClick={() => handleEdit(q._id, q.textequestion, q.type)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn delete-btn"
                      onClick={() => handleDelete(q._id)} // Call delete with confirmation
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="pagination">
        <button
          onClick={() => paginate(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <button
          onClick={() => paginate(currentPage + 1)}
          disabled={currentPage * questionsPerPage >= questions.length}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default QuestionsTable;
