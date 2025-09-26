import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "mdb-react-ui-kit/dist/css/mdb.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
/* import Register from "./pages/Register/Register"; */
import CreateAccount from "./pages/CreateAccount/CreateAccount";
import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import QuizGame from "./pages/QuizGame/QuizGame";
import Otp from "./pages/Otp/Otp";
import QuestionsTable from "./pages/Question/Question";
import ResponsesPage from "./pages/Response/ResponsesPages";
import UsersList from "./pages/UsersList/UsersList";
import Profile from "./pages/Profile/Profile";
import Ranking from "./pages/Ranking/Ranking";
import QuizList from "./pages/QuizManagement/QuizList";
import QuizForm from "./pages/QuizManagement/QuizForm";

const router = createBrowserRouter(
  [
    { path: "/", element: <Home /> },
    { path: "/login", element: <Login /> },
    { path: "/verify-otp", element: <Otp /> },
   /*  {
      path: "/admin/register",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <CreateAccount />
          </AdminRoute>
        </PrivateRoute>
      ),
    }, */
    {
      path: "/admin/create-account",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <CreateAccount />
          </AdminRoute>
        </PrivateRoute>
      ),
    },
    {
      path: "/admin/users",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <UsersList />
          </AdminRoute>
        </PrivateRoute>
      ),
    },
    {
      path: "/home",
      element: (
        <PrivateRoute>
          <Home />
        </PrivateRoute>
      ),
    },
    {
      path: "/quiz",
      element: (
        <PrivateRoute>
          <QuizGame />
        </PrivateRoute>
      ),
    },
    {
      path: "/questions",
      element: (
        <PrivateRoute>
          <QuestionsTable />
        </PrivateRoute>
      ),
    },
    {
      path: "/responses",
      element: (
        <PrivateRoute>
          <ResponsesPage />
        </PrivateRoute>
      ),
    },
    {
      path: "/profile",
      element: (
        <PrivateRoute>
          <Profile />
        </PrivateRoute>
      ),
    },
    {
      path: "/ranking",
      element: (
        <PrivateRoute>
          <Ranking />
        </PrivateRoute>
      ),
    },
    {
      path: "/quizzes",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <QuizList />
          </AdminRoute>
        </PrivateRoute>
      ),
    },
    {
      path: "/quizzes/new",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <QuizForm />
          </AdminRoute>
        </PrivateRoute>
      ),
    },
    {
      path: "/quizzes/edit/:id",
      element: (
        <PrivateRoute>
          <AdminRoute>
            <QuizForm />
          </AdminRoute>
        </PrivateRoute>
      ),
    },
    { path: "*", element: <Login /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

const App = () => {
  return (
    <div className="App">
      <RouterProvider router={router} />
    </div>
  );
};

export default App;
