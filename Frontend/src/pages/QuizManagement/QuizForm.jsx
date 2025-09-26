import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Select, 
  InputNumber, 
  message, 
  Space, 
  Typography,
  Divider,
  Layout,
  Modal
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import quizService from '../../services/quiz.service';
import SideBar from '../../components/Sidebar/SideBar';
import { isAuthenticated, getCurrentUser } from '../../utils/auth';
import './QuizManagement.css';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;


const QuizForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const [modal, contextHolder] = Modal.useModal();

  useEffect(() => {
    if (isEditMode) {
      fetchQuiz();
    }
  }, [id, isEditMode]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const quiz = await quizService.getQuizById(id);
      // Transform the backend response to match form fields
      const correctOption = quiz.options.find(opt => opt.isCorrect);
      const incorrectOptions = quiz.options.filter(opt => !opt.isCorrect);
      
      form.setFieldsValue({
        question: quiz.question,
        correctAnswer: correctOption?.text || '',
        incorrectAnswers: incorrectOptions.map(opt => opt.text) || ['', '', ''],
        explanation: quiz.explanation,
      });
    } catch (error) {
      console.error('Error fetching quiz:', error);
      message.error('Failed to load quiz');
      navigate('/quizzes');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      
      // Transform the form data to match the backend DTO
      const quizData = {
        question: values.question,
        options: [
          // Add correct answer
          { 
            text: values.correctAnswer, 
            isCorrect: true 
          },
          // Add incorrect answers (filter out empty strings)
          ...(values.incorrectAnswers || [])
            .filter(incorrect => incorrect && incorrect.trim() !== '')
            .map(incorrect => ({
              text: incorrect,
              isCorrect: false
            }))
        ]
      };
  
      if (isEditMode) {
        // Update existing quiz
        await quizService.updateQuiz(id, quizData);
        message.success('Quiz updated successfully');
      } else {
        // Create new quiz
        await quizService.createQuiz(quizData);
        message.success('Quiz created successfully');
      }
      navigate('/quizzes');
    } catch (error) {
      console.error('Error saving quiz:', error);
      message.error(`Failed to ${isEditMode ? 'update' : 'create'} quiz: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: 'Delete Quiz',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this quiz? This action cannot be undone.',
      okText: 'Yes, delete it',
      okType: 'danger',
      cancelText: 'No, keep it',
      onOk: async () => {
        try {
          setDeleteLoading(true);
          await quizService.deleteQuiz(id);
          message.success('Quiz deleted successfully');
          navigate('/quizzes');
        } catch (error) {
          console.error('Error deleting quiz:', error);
          message.error(`Failed to delete quiz: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

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
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)}
            style={{ marginBottom: '16px' }}
          >
            Back to List
          </Button>
          
          <Card>
        <Title level={3} style={{ marginBottom: '24px' }}>
          {isEditMode ? 'Edit Quiz Question' : 'Create New Quiz Question'}
        </Title>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            difficulty: 'medium',
            incorrectAnswers: ['', '', ''],
          }}
        >
          <Form.Item
            name="question"
            label="Question"
            rules={[{ required: true, message: 'Please input the question!' }]}
          >
            <TextArea rows={3} placeholder="Enter the question" />
          </Form.Item>


          <Divider orientation="left">Answers</Divider>
          
          <Form.Item
            name="correctAnswer"
            label="Correct Answer"
            rules={[{ required: true, message: 'Please input the correct answer!' }]}
          >
            <Input placeholder="Enter the correct answer" />
          </Form.Item>

          <Form.Item label="Incorrect Answers">
            <Form.List name="incorrectAnswers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Form.Item
                      {...restField}
                      key={key}
                      name={[name]}
                      rules={[
                        {
                          required: true,
                          message: 'Please input an incorrect answer or remove this field!',
                        },
                      ]}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Input placeholder={`Incorrect answer ${key + 1}`} />
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            danger
                            onClick={() => remove(name)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </Form.Item>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    style={{ marginBottom: '16px' }}
                    disabled={fields.length >= 5}
                  >
                    Add Incorrect Answer
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item
            name="explanation"
            label="Explanation (Optional)"
          >
            <TextArea rows={2} placeholder="Add an explanation for the correct answer" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<SaveOutlined />}
              >
                {isEditMode ? 'Update' : 'Create'} Question
              </Button>
              <Button onClick={() => navigate('/quizzes')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
            </Form>
          </Card>
        </div>
      </Layout>
      {contextHolder}
    </Layout>
  );
};

export default QuizForm;
