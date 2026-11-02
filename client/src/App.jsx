import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import EventDetail from './pages/EventDetail.jsx';
import TicketPage from './pages/TicketPage.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import EventForm from './pages/EventForm.jsx';
import EventDashboard from './pages/EventDashboard.jsx';
import Scanner from './pages/Scanner.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="ticket/:code" element={<TicketPage />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />

        <Route path="organizer" element={<ProtectedRoute />}>
          <Route index element={<OrganizerDashboard />} />
          <Route path="events/new" element={<EventForm />} />
          <Route path="events/:id" element={<EventDashboard />} />
          <Route path="events/:id/edit" element={<EventForm />} />
          <Route path="events/:id/scan" element={<Scanner />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
