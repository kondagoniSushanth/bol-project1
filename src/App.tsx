import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LeftSoleScreen from './components/LeftSoleScreen';
import RightSoleScreen from './components/RightSoleScreen';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#1e1e1e] text-white">
        <Routes>
          <Route path="/" element={<Navigate to="/left-sole" replace />} />
          <Route path="/left-sole" element={<LeftSoleScreen />} />
          <Route path="/right-sole" element={<RightSoleScreen />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;