import React, { useEffect, useState } from "react";
import axios from "axios";
import SideBar from "../../components/Sidebar/SideBar";
import { isAuthenticated } from "../../utils/auth";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DeleteIcon from '@mui/icons-material/Delete';
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
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { Delete, Edit, Add as AddIcon, Close as CloseIcon } from "@mui/icons-material";
import { CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

// Button styles
export const buttonStyles = {
  primary: {
    backgroundColor: '#1976d2',
    color: '#fff',
    '&:hover': {
      backgroundColor: '#1565c0',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    },
    '&.Mui-disabled': {
      backgroundColor: '#e0e0e0',
      color: '#9e9e9e'
    },
    minWidth: '120px',
    textTransform: 'none',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out'
  },
  secondary: {
    backgroundColor: '#f5f5f5',
    color: '#1976d2',
    border: '1px solid #e0e0e0',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      borderColor: '#1976d2'
    },
    minWidth: '120px',
    textTransform: 'none',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out'
  },
  danger: {
    backgroundColor: '#d32f2f',
    color: '#fff',
    '&:hover': {
      backgroundColor: '#b71c1c',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    },
    minWidth: '100px',
    textTransform: 'none',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out'
  },
  icon: {
    padding: '4px',
    width: '28px',
    height: '28px',
    '&:hover': {
      backgroundColor: 'rgba(25, 118, 210, 0.08)'
    },
    '& .MuiSvgIcon-root': {
      fontSize: '18px'
    }
  }
};

const ResponsesPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth < 768;
      setIsMobile(mobileView);
      
      // Auto-close sidebar when switching to mobile view
      if (mobileView && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };
  
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [responseToDelete, setResponseToDelete] = useState(null);
  const responsesPerPage = 5;

  const fetchResponses = async () => {
    try {
      const res = await axios.get("http://localhost:3001/api/response");
      setResponses(res.data.responses);
    } catch (error) {
      console.error("Error fetching responses:", error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await axios.get("http://localhost:3001/api/question/all");
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

  const handleDeleteClick = (id) => {
    setResponseToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!responseToDelete) return;
    
    try {
      await axios.delete(`http://localhost:3001/api/response/${responseToDelete}`);
      fetchResponses();
      showSnackbar("Response deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting response:", error);
      showSnackbar("Error deleting response. Please try again.", "error");
    } finally {
      setDeleteConfirmOpen(false);
      setResponseToDelete(null);
    }
  };

  const validateResponses = () => {
    const errors = [];
    newResponses.forEach((response, index) => {
      if (!response.text.trim()) {
        errors.push(`Response #${index + 1}: Text is required`);
      }
      if (!response.questionId) {
        errors.push(`Response #${index + 1}: Please select a question`);
      }
    });
    return errors;
  };

  const handleCreate = async () => {
    const validationErrors = validateResponses();
    if (validationErrors.length > 0) {
      showSnackbar(validationErrors[0], "error");
      return;
    }

    // Get the token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      showSnackbar("Authentication token not found. Please log in again.", "error");
      return;
    }

    // Extract user ID from the token
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      showSnackbar("Invalid token format. Please log in again.", "error");
      return;
    }

    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.userId || payload.sub; // Try common JWT claims for user ID
      
      if (!userId) {
        throw new Error("User ID not found in token");
      }

      setIsSubmitting(true);
      
      // Validate questionIds
      for (const response of newResponses) {
        if (!response.questionId || response.questionId.trim() === "") {
          showSnackbar(`Invalid question ID for one of the responses`, "error");
          return;
        }
      }

      // Bulk create responses by sending a batch request to the backend
      const responseData = newResponses.map((response) => ({
        text: response.text,
        questionId: response.questionId,
        isCorrect: response.isCorrect,
        userId: userId
      }));

      // Make the POST request for creating multiple responses at once
      const res = await axios.post(
        "http://localhost:3001/api/response/create-multiple",
        responseData,
        {
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
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
        showSnackbar("Failed to create responses. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error in handleCreate:", error);
      const errorMessage = error.response?.data?.message || "Error creating responses";
      showSnackbar(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingResponse.text || !editingResponse.questionId) {
      alert("Please enter response text and select a question!");
      return;
    }

    // Get the token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      showSnackbar("Authentication token not found. Please log in again.", "error");
      return;
    }

    // Extract user ID from the token
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      showSnackbar("Invalid token format. Please log in again.", "error");
      return;
    }

    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      const userId = payload.userId || payload.sub; // Try common JWT claims for user ID
      
      if (!userId) {
        throw new Error("User ID not found in token");
      }

      const requestData = {
        text: editingResponse.text,
        isCorrect: editingResponse.isCorrect,
        questionId: editingResponse.questionId,
        userId: userId
      };

      console.log('Sending update request with data:', requestData);
      const response = await axios.put(
        `http://localhost:3001/api/response/${editingResponse._id}`, 
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('Update response:', response.data);
      fetchResponses();
      setModalOpen(false);
      setEditingResponse(null);
      showSnackbar("Response updated successfully!", "success");
    } catch (error) {
      console.error("Error editing response:", error);
      console.error("Full error response:", error.response?.data);
      // If the error contains an array of messages, join them with newlines
      const errorMessage = Array.isArray(error.response?.data?.message) 
        ? error.response.data.message.join('\n')
        : error.response?.data?.message || 
          error.message || 
          "Error updating response. Please try again.";
      showSnackbar(`Error: ${errorMessage}`, "error");
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

  // Handle authentication and user data
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login", { replace: true });
      return;
    }

    const name = localStorage.getItem("username");
    const userRole = localStorage.getItem("role");

    if (name) setUsername(name);
    if (userRole) setRole(userRole);
  }, [navigate]);

  return (
    <div className={`main-content ${sidebarOpen && isMobile ? 'sidebar-open' : ''}`}>
      <SideBar 
        username={username} 
        role={role} 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar}
        onClose={closeSidebar}
        onLogout={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          navigate("/login");
        }}
      />
      <Box 
        sx={{ 
          flex: 1, 
          p: 3,
          ml: { sm: sidebarOpen ? '250px' : 0 },
          mt: { xs: '60px', sm: 0 }, // Add margin top on mobile
          width: { sm: sidebarOpen ? 'calc(100% - 250px)' : '100%' },
          transition: 'all 0.3s ease',
          minHeight: '100vh',
          bgcolor: 'background.default',
          position: 'relative',
          zIndex: 1 // Ensure content is above the sidebar
        }}
      >
        <Box sx={{ 
          mb: 4,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'background.default',
          pt: 2,
          pb: 2
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            gap: 2
          }}>
             <Typography variant="h4" component="h1" className="page-title">
                         Responses Management
                       </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleModalOpen()}
              disabled={isSubmitting}
              sx={{
                ...buttonStyles.primary,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                '& .MuiButton-startIcon': {
                  marginRight: '8px'
                }
              }}
            >
              Add Response
            </Button>
          </Box>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage and view all responses in the system
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          {responses.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="h6" color="textSecondary" sx={{ mb: 2 }}>
                No Responses Available
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleModalOpen()}
                disabled={isSubmitting}
                sx={{
                  ...buttonStyles.primary,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    marginRight: '8px'
                  }
                }}
              >
                Create Your First Response
              </Button>
            </Box>
          ) : (
            <>
              {/* Desktop Table View */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <TableContainer className="table-container">
                  <Table className="responses-table">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ minWidth: '50px' }}>#</TableCell>
                        <TableCell>Response</TableCell>
                        <TableCell>Question</TableCell>
                        <TableCell sx={{ width: '120px' }}>Status</TableCell>
                        <TableCell sx={{ width: '120px', textAlign: 'center' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentResponses.map((res, index) => (
                        <TableRow key={res._id} hover>
                          <TableCell>{indexOfFirstResponse + index + 1}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: '300px' }}>
                              {res.text}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: '300px' }}>
                              {res.questionId?.textequestion || 'No Question'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box component="span" sx={statusBadgeStyle(res.isCorrect)}>
                              {res.isCorrect ? 'Correct' : 'Incorrect'}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <div className="action-buttons">
                              <IconButton
                                size="small"
                                onClick={() => handleModalOpen(res)}
                                title="Edit"
                                sx={{ p: 0.5 }}
                              >
                                <Edit fontSize="small" color="primary" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(res._id);
                                }}
                                title="Delete"
                                disabled={isSubmitting}
                                sx={{ p: 0.5 }}
                              >
                                <Delete fontSize="small" color="error" />
                              </IconButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Mobile Card View */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2 }}>
                {currentResponses.map((res, index) => (
                  <Paper 
                    key={res._id} 
                    sx={{ 
                      mb: 2, 
                      p: 2,
                      '&:hover': {
                        boxShadow: 3
                      }
                    }}
                    elevation={1}
                  >
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" color="textSecondary">
                        #{indexOfFirstResponse + index + 1}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" color="textSecondary">Response:</Typography>
                      <Typography variant="body1">{res.text}</Typography>
                    </Box>
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" color="textSecondary">Question:</Typography>
                      <Typography variant="body2">{res.questionId?.textequestion || 'No Question'}</Typography>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mt: 1,
                      pt: 1,
                      borderTop: '1px solid rgba(0,0,0,0.12)'
                    }}>
                      <Box component="span" sx={statusBadgeStyle(res.isCorrect)}>
                        {res.isCorrect ? 'Correct' : 'Incorrect'}
                      </Box>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleModalOpen(res);
                          }}
                          title="Edit"
                          sx={{ mr: 0.5 }}
                        >
                          <Edit fontSize="small" color="primary" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(res._id);
                          }}
                          title="Delete"
                          disabled={isSubmitting}
                        >
                          <Delete fontSize="small" color="error" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </>
          )}

          {/* Pagination */}
          {responses.length > 0 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination
                count={Math.ceil(responses.length / responsesPerPage)}
                page={currentPage}
                onChange={(event, page) => handlePageChange(page)}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </Paper>
      </Box>


      {/* Delete Confirmation Dialog */}
      <Modal 
        open={deleteConfirmOpen} 
        onClose={() => !isSubmitting && setDeleteConfirmOpen(false)}
        closeAfterTransition
        BackdropProps={{
          style: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)'
          }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 450 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            outline: 'none',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom style={{color: 'red'}}>
              Confirm Deletion
            </Typography>
          </Box>
          
          <Typography variant="body1" align="center" sx={{ mb: 4, color: 'text.secondary' }}>
            Are you sure you want to delete this response?
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
                ...buttonStyles.secondary,
                py: 1.5,
                fontSize: '1rem'
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
                ...buttonStyles.danger,
                py: 1.5,
                fontSize: '1rem',
                '&:hover': {
                  backgroundColor: 'error.dark',
                }
              }}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Response Form Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => !isSubmitting && setModalOpen(false)}
        aria-labelledby="response-form-modal"
      >
        <Box
          style={{
            width: "400px",
            margin: "50px auto",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <Typography variant="h5" gutterBottom style={{color: 'initial'}}>
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
              <FormControl fullWidth style={{ marginBottom: "20px" }} variant="outlined">
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
                
                label={<Typography style={{ color: "initial" }}>Correct</Typography>}
              />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Button
                  variant="outlined"
                  onClick={() => setModalOpen(false)}
                  sx={buttonStyles.secondary}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleEdit}
                  sx={buttonStyles.primary}
                >
                  Save Changes
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
                      label={<Typography style={{ color: "initial" }}>Correct</Typography>}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Button
                  variant="outlined"
                  onClick={handleAddResponse}
                  sx={{
                    ...buttonStyles.secondary,
                    mt: 2,
                    '&:hover': {
                      backgroundColor: '#e3f2fd',
                      borderColor: '#1976d2'
                    }
                  }}
                  startIcon={<AddIcon />}
                >
                  Add Another Response
                </Button>
                <div style={{ display: "flex", gap: "12px" }}>
                  <Button
                    variant="outlined"
                    onClick={() => setModalOpen(false)}
                    sx={buttonStyles.secondary}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleCreate}
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{
                      ...buttonStyles.primary,
                      '&.Mui-disabled': {
                        backgroundColor: '#e0e0e0',
                        color: '#9e9e9e'
                      }
                    }}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Responses'}
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
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          elevation={6}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
   </div>
  );
};

// Status badge styles
const statusBadgeStyle = (isCorrect) => ({
  display: 'inline-flex',
  alignItems: 'center',
  px: 1.5,
  py: 0.5,
  borderRadius: 1,
  bgcolor: isCorrect ? 'success.light' : 'error.light',
  color: isCorrect ? 'success.dark' : 'error.dark',
  fontSize: '0.75rem',
  fontWeight: 'medium',
  textTransform: 'capitalize'
});

export default ResponsesPage;
