import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import VisualizationPage from './pages/VisualizationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/visualize" element={<VisualizationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
