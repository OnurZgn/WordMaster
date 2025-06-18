// src/App.js
import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import MainPage from './components/MainPage';
import AddWordPage from './components/AddWordPage';
import TranslationPracticePage from './components/TranslationPracticePage'; // Import the new page
import { ThemeProvider, useTheme } from './context/ThemeContext';
import './App.css';

const AppContent = () => {
  const { isDark, toggleTheme } = useTheme();
  const [currentPage, setCurrentPage] = useState('upload');
  const [vocabularyData, setVocabularyData] = useState(null);

  const [engW, setEngW] = useState([]);
  const [trW, setTrW] = useState([]);
  const [engS, setEngS] = useState([]);
  const [trS, setTrS] = useState([]);
  const [ignoredWords, setIgnoredWords] = useState([]);

  const showPage = (pageId) => {
    setCurrentPage(pageId);
  };

  return (
    <div className="app-container">
      <div className="theme-toggle">
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
      <div className="container">
        {currentPage === 'upload' && (
          <UploadPage 
            showPage={showPage}
            setVocabularyData={setVocabularyData}
            setEngW={setEngW}
            setTrW={setTrW}
            setEngS={setEngS}
            setTrS={setTrS}
          />
        )}

        {currentPage === 'main' && (
          <MainPage 
            showPage={showPage}
            vocabularyData={vocabularyData}
            setVocabularyData={setVocabularyData}
            engW={engW}
            trW={trW}
            engS={engS}
            trS={trS}
            setEngS={setEngS}
            setTrS={setTrS}
            ignoredWords={ignoredWords}
            setIgnoredWords={setIgnoredWords}
          />
        )}

        {currentPage === 'addWord' && (
          <AddWordPage 
            showPage={showPage}
            vocabularyData={vocabularyData}
            setVocabularyData={setVocabularyData}
            engW={engW}
            trW={trW}
            setEngW={setEngW}
            setTrW={setTrW}
          />
        )}

        {currentPage === 'translationPractice' && (  // New page for translation practice
          <TranslationPracticePage 
            showPage={showPage}
          />
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
