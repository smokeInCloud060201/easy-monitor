import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<div className="p-8 text-2xl font-semibold text-white">Metrics View Stub</div>} />
          <Route path="/logs" element={<div className="p-8 text-2xl font-semibold text-white">Logs View Stub</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
