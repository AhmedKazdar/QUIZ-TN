import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Pagination
} from "@mui/material";
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorOutlineIcon
} from "@mui/icons-material";
import SideBar from "../../components/Sidebar/SideBar";
import "./Question.css";

const QuestionsTable = () => {
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [updatedQuestion, setUpdatedQuestion] = useState({
    textequestion: "",
    type: "multiple-choice",
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newQuestion, setNewQuestion] = useState({
    textequestion: "",
    type: "multiple-choice",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });
  const questionsPerPage = 5;
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    const name = localStorage.getItem('username');
    const userRole = localStorage.getItem('role');
    
    if (name) setUsername(name);
    if (userRole) setRole(userRole);
    
    fetchQuestions();
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get("http://localhost:3001/api/question/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(response.data.questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to fetch questions',
        severity: 'error'
      });
    }
  };

  // Handle editing question
  const handleEdit = (id, textequestion, type) => {
    setEditing(id);
    setUpdatedQuestion({ 
      textequestion, 
      type: type || 'multiple-choice' 
    });
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
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3001/api/question/update/${id}`,
        updatedQuestion,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditing(null);
      fetchQuestions();
      setSnackbar({
        open: true,
        message: 'Question updated successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error("Error updating question:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update question',
        severity: 'error'
      });
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
      const token = localStorage.getItem('token');
      await axios.post(
        "http://localhost:3001/api/question/create", 
        newQuestion,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOpenDialog(false);
      setNewQuestion({ 
        textequestion: "", 
        type: "multiple-choice" 
      });
      fetchQuestions();
      setSnackbar({
        open: true,
        message: 'Question created successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error("Error creating question:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to create question',
        severity: 'error'
      });
    }
  };

  const handleCancel = () => {
    setEditing(null); // Stop editing without saving
  };

  const handleCreateCancel = () => {
    setCreating(false); // Hide the create form
    setNewQuestion({ textequestion: "", type: "" }); // Clear the form
  };

  // Handle delete confirmation
  const handleDeleteClick = (id) => {
    setQuestionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Handle delete with confirmation
  const handleDelete = async () => {
    if (!questionToDelete) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/api/question/delete/${questionToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchQuestions();
      setSnackbar({
        open: true,
        message: 'Question deleted successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error("Error deleting question:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete question',
        severity: 'error'
      });
    } finally {
      setDeleteConfirmOpen(false);
      setQuestionToDelete(null);
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

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };


  

  return (
    <div className="dashboard-container">
      {/* Mobile Menu Toggle */}
      <button className="menu-toggle" onClick={toggleMenu}>
        {isMenuOpen ? '✕' : '☰'}
      </button>
      
      {/* Overlay for mobile menu */}
      <div 
        className={`overlay ${isMenuOpen ? 'active' : ''}`} 
        onClick={closeMenu}
      />
      
      {/* Sidebar */}
      <SideBar 
        username={username} 
        role={role} 
        isOpen={isMenuOpen}
        onLogout={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          navigate("/login");
        }}
      />
      
      <div className="main-content">
        <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            mb={4}
          >
            <Typography variant="h4" component="h1" className="page-title">
              Questions Management
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
              sx={{ 
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1
              }}
            >
              New Question
            </Button>
          </Box>

          <Paper 
            elevation={3} 
            sx={{ 
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1)'
            }}
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'background.paper' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>Question Text</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', width: '200px' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', width: '150px', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentQuestions.map((q) => (
                    <TableRow 
                      key={q._id}
                      sx={{ 
                        '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                        '&:hover': { backgroundColor: 'action.selected' }
                      }}
                    >
                      <TableCell>
                        {editing === q._id ? (
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            name="textequestion"
                            value={updatedQuestion.textequestion}
                            onChange={handleChange}
                            sx={{ 
                              '& .MuiOutlinedInput-root': { 
                                backgroundColor: 'background.paper',
                                '&:hover fieldset': {
                                  borderColor: 'primary.main',
                                },
                              }
                            }}
                          />
                        ) : (
                          <Typography variant="body1">
                            {q.textequestion}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing === q._id ? (
                          <FormControl fullWidth size="small" variant="outlined">
                            <Select
                              name="type"
                              value={updatedQuestion.type}
                              onChange={handleChange}
                              sx={{ 
                                '& .MuiSelect-select': { 
                                  py: 1,
                                  backgroundColor: 'background.paper'
                                }
                              }}
                            >
                              <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                              <MenuItem value="true-false">True/False</MenuItem>
                              <MenuItem value="short-answer">Short Answer</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              textTransform: 'capitalize',
                              color: 'text.secondary'
                            }}
                          >
                            {q.type || 'multiple-choice'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          {editing === q._id ? (
                            <>
                              <Button
                                variant="contained"
                                size="small"
                                color="primary"
                                onClick={(e) => handleSubmit(e, q._id)}
                                sx={{ minWidth: '80px' }}
                              >
                                Save
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                color="inherit"
                                onClick={handleCancel}
                                sx={{ minWidth: '80px' }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEdit(q._id, q.textequestion, q.type)}
                                title="Edit"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(q._id);
                                }}
                                title="Delete"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {questions.length > 0 && (
              <Box display="flex" justifyContent="center" p={2}>
                <Pagination
                  count={Math.ceil(questions.length / questionsPerPage)}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </Paper>
        </Box>
      </div>
      
      {/* Create Question Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Create New Question
            </Typography>
            <IconButton 
              onClick={() => setOpenDialog(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <form ref={formRef} onSubmit={handleCreateSubmit}>
          <DialogContent dividers>
            <Box mb={3}>
              <TextField
                fullWidth
                label="Question Text"
                name="textequestion"
                value={newQuestion.textequestion}
                onChange={handleCreateChange}
                variant="outlined"
                required
                multiline
                rows={3}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth variant="outlined">
                <InputLabel>Question Type</InputLabel>
                <Select
                  name="type"
                  value={newQuestion.type}
                  onChange={handleCreateChange}
                  label="Question Type"
                >
                  <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                  <MenuItem value="true-false">True/False</MenuItem>
                  <MenuItem value="short-answer">Short Answer</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.12)' }}>
            <Button 
              variant="outlined" 
              onClick={() => setOpenDialog(false)}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
            >
              Create Question
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => !isSubmitting && setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom style={{color: 'red'}}>
              Confirm Deletion
            </Typography>
          </Box>
          
          <Typography variant="body1" align="center" sx={{ mb: 4, color: 'text.secondary' }}>
            Are you sure you want to delete this question?
            <br />
            <strong>This action cannot be undone.</strong>
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            justifyContent: 'center', 
            gap: 2,
            mt: 3
          }}>
            <Button 
              variant="outlined"
              fullWidth
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isSubmitting}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained"
              fullWidth
              onClick={handleDelete}
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <DeleteIcon />}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                backgroundColor: 'error.main',
                '&:hover': {
                  backgroundColor: 'error.dark',
                },
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default QuestionsTable;
