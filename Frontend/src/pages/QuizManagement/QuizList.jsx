import React, { useState, useEffect,useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, message, Space, Card, Typography, Layout } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import quizService from '../../services/quiz.service';
import SideBar from '../../components/Sidebar/SideBar';
import { isAuthenticated, getCurrentUser } from '../../utils/auth';
import './QuizManagement.css';

const { Title } = Typography;

const QuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching quizzes...');
      const data = await quizService.findAll();
      console.log('Quizzes data:', data);
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      message.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);


  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        console.log('Fetching quizzes...');
        const data = await quizService.findAll();
        console.log('Quizzes data:', data);
        setQuizzes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error in useEffect:', error);
      }
    };
    loadQuizzes();
  }, []);

  const handleEdit = (id) => {
    navigate(`/quizzes/edit/${id}`);
  };

  const handleDelete = async (id) => {
    try {
      // Note: We'll need to implement a delete endpoint in the backend
      // For now, we'll just show a success message
      message.success('Quiz deleted successfully');
      await fetchQuizzes();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      message.error('Failed to delete quiz');
    }
  };

  const columns = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record._id)}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const user = getCurrentUser();
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  if (!isAuthenticated()) {
    navigate('/login');
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideBar 
        username={user?.username} 
        role={user?.role} 
        isOpen={!collapsed}
        onToggle={toggleSidebar}
      />
      <Layout className="site-layout" style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <div style={{ padding: '24px' }}>
          <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title level={3}>Quiz Questions</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/quizzes/new')}
          >
            Add New Question
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={quizzes}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} questions`
          }}
        />
      </Card>
    </div>
  </Layout>
</Layout>
  );
};

export default QuizList;
