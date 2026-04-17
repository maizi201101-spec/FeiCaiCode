import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import WorkbenchPage from './pages/WorkbenchPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:projectId/*" element={<WorkbenchPage />} />
      </Routes>
    </BrowserRouter>
  )
}
