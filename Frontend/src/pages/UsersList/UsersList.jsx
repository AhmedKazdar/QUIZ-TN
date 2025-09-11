import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SideBar from '../../components/Sidebar/SideBar';
import { isAuthenticated } from '../../utils/auth';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import './UsersList.css';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const navigate = useNavigate();
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
    
    // Get user info if authenticated
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUsername(decoded.username || '');
        setRole(decoded.role || '');
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await axios.get('http://localhost:3001/users/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch users';
      toast.error(errorMessage);
      
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/user/${selectedUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setDeleteDialogOpen(false);
      setSelectedUserId(null);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  if (!isAuthenticated() || role !== 'admin') {
    navigate('/unauthorized');
    return null;
  }

  const emptyRows = rowsPerPage - Math.min(rowsPerPage, users.length - page * rowsPerPage);

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
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="main-content">
        <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" component="h1" fontWeight={600}>
              Users Management
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/create-account')}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              Add New User
            </Button>
          </Box>
          
          <Paper elevation={0} className="table-container">
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                        <Typography variant="body1">
                          {user.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phoneNumber || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.role} 
                        color={user.role === 'admin' ? 'primary' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {user.isActive ? (
                          <>
                            <CheckCircleIcon color="success" fontSize="small" />
                            <Typography>Active</Typography>
                          </>
                        ) : (
                          <>
                            <CancelIcon color="disabled" fontSize="small" />
                            <Typography color="textSecondary">Inactive</Typography>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.lastActive 
                        ? format(new Date(user.lastActive), 'PPpp')
                        : 'Never'}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center" gap={1}>
                        <Tooltip title="Edit User">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => navigate(`/admin/edit-user/${user.id}`)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete User">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(user.id)}
                            disabled={user.role === 'admin'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              {emptyRows > 0 && (
                <TableRow style={{ height: 53 * emptyRows }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
        
        {users.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={users.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '& .MuiTablePagination-toolbar': {
                paddingLeft: 0,
                paddingRight: 1,
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                marginBottom: 0,
              },
              '& .MuiInputBase-root': {
                marginRight: 2,
              }
            }}
          />
        )}
      </Box>
    </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this user? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            color="inherit"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default UsersList;
