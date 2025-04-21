import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/TranslationPracticePage.css";

let AIToken = process.env.REACT_APP_AI_API_KEY1;

const TranslationPracticePage = ({ showPage }) => {
  const [sentences, setSentences] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(null);
  const [userTranslation, setUserTranslation] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ correct: 0, total: 0 });
  const [showAnswer, setShowAnswer] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);
  const [translationDirection, setTranslationDirection] = useState("en-tr"); // "en-tr" or "tr-en"
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");
  
  // Reference for the tooltip positioning
  const tooltipRef = useRef(null);
  
  // AI configuration
  const AI_URL = process.env.REACT_APP_AI_API_URL;
  const AIToken1 = process.env.REACT_APP_AI_API_KEY1;
  const AIToken2 = process.env.REACT_APP_AI_API_KEY2;

  // Function to validate translation using AI
  const askAI = async (sysPrompt, userPrompt) => {
    // Alternate between API keys to distribute usage
    if (AIToken === AIToken1) AIToken = AIToken2;
    else AIToken = AIToken1;
    
    try {
      setIsLoading(true);
      const response = await fetch(`${AI_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      setIsLoading(false);
      return data.choices[0].message.content.replaceAll('"', "");
    } catch (error) {
      setIsLoading(false);
      console.error("AI error:", error);
      return "Error getting AI response. Please try again.";
    }
  };

  useEffect(() => {
    fetchSentences();
  }, []);
  
  useEffect(() => {
    if (sentences.length > 0) {
      selectRandomSentence();
    }
  }, [sentences, translationDirection, difficulty]);

  const fetchSentences = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "data", "mainData");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure we have sentences in the right format
        if (data.sentences && Array.isArray(data.sentences)) {
          setSentences(data.sentences);
          setProgress({ correct: 0, total: 0 });
        } else {
          console.log("No sentences found or wrong format!");
          setSentences([]);
        }
      } else {
        console.log("Document not found!");
      }
    } catch (error) {
      console.error("Error fetching sentences:", error);
    }
    setIsLoading(false);
  };

  const goNext = async () => {
    await selectRandomSentence();
};

const selectRandomSentence = async (direction = translationDirection) => {
    if (sentences.length === 0) return;

    let filteredSentences = sentences;
    if (difficulty !== "all") {
      filteredSentences = sentences.filter(sentence => {
        if (typeof sentence === 'object' && sentence.difficulty) {
          return sentence.difficulty === difficulty;
        } else {
          const text = typeof sentence === 'string' ? sentence : (sentence.sentence || "");
          const wordCount = text.split(" ").length;

          if (difficulty === "easy") return wordCount <= 5;
          if (difficulty === "medium") return wordCount > 5 && wordCount <= 10;
          if (difficulty === "hard") return wordCount > 10;
          return true;
        }
      });
    }

    if (filteredSentences.length === 0) filteredSentences = sentences;

    const randomIndex = Math.floor(Math.random() * filteredSentences.length);
    const selected = filteredSentences[randomIndex];

    // Yön 'tr-en' ise Türkçe cümleyi sormalıyız, ve İngilizce çevirisini AI ile yapmalıyız
    if (direction === 'tr-en') {
      if (typeof selected === 'string') {
        // Eğer İngilizce cümle alınmışsa, Türkçe'ye çevir
        const translatedSentence = await translateToTurkish(selected);
        setCurrentSentence({
          text: translatedSentence,
          translation: selected,  // İngilizcesi de eklenebilir
          index: sentences.indexOf(selected)
        });
      } else if (selected && selected.sentence) {
        // Eğer cümle nesnesi varsa
        const translatedSentence = await translateToTurkish(selected.sentence);
        setCurrentSentence({
          text: translatedSentence,
          translation: selected.translation || null,
          index: sentences.indexOf(selected)
        });
      } else if (selected) {
        const firstKey = Object.keys(selected)[0];
        if (firstKey && typeof selected[firstKey] === 'string') {
          // Eğer metin varsa
          const translatedSentence = await translateToTurkish(selected[firstKey]);
          setCurrentSentence({
            text: translatedSentence,
            translation: selected[firstKey],
            index: sentences.indexOf(selected)
          });
        }
      }
    } else {
      // Yön 'en-tr' ise, İngilizce cümleyi olduğu gibi göster
      if (typeof selected === 'string') {
        setCurrentSentence({
          text: selected,
          translation: null,
          index: sentences.indexOf(selected)
        });
      } else if (selected && selected.sentence) {
        setCurrentSentence({
          text: selected.sentence,
          translation: selected.translation || null,
          index: sentences.indexOf(selected)
        });
      } else if (selected) {
        const firstKey = Object.keys(selected)[0];
        if (firstKey && typeof selected[firstKey] === 'string') {
          setCurrentSentence({
            text: selected[firstKey],
            translation: null,
            index: sentences.indexOf(selected)
          });
        }
      }
    }

    setAiFeedback("");
    setUserTranslation("");
    setShowAnswer(false);
    setWordDefinition(null);
};

// AI ile çeviriyi yap (Türkçeye çevir)
const translateToTurkish = async (sentence) => {
    const sysPrompt = "You are an English-to-Turkish translator. Provide only the Turkish translation of the sentence.";
    const userPrompt = `Translate this English sentence to Turkish: "${sentence}"`;

    const result = await askAI(sysPrompt, userPrompt);
    return result;  // Çeviriyi döndürüyoruz
};


  const handleCheckTranslation = async () => {
    if (!userTranslation.trim()) {
      alert("Please enter your translation first!");
      return;
    }
  
    if (!currentSentence) return;
  
    const sourceLang = translationDirection === "en-tr" ? "English" : "Turkish";
    const targetLang = translationDirection === "en-tr" ? "Turkish" : "English";
  
    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} translation validator. Check whether the translation is correct or not. Be concise and helpful.`;
    const userPrompt = `
  The user translated the ${sourceLang} sentence "${currentSentence.text}" into ${targetLang} as follows:
  "${userTranslation}"
  
  Is this translation correct? Respond in a structured format:
  1. Start with either "✓ CORRECT" or "✗ INCORRECT"
  2. If incorrect, provide the correct translation
  3. Add a brief explanation of any mistakes (max 2 sentences)
  `;
  
    const result = await askAI(sysPrompt, userPrompt);
    setAiFeedback(result);
  
    const isCorrect = result.toLowerCase().includes("correct") && !result.toLowerCase().includes("incorrect");
  
    // Update progress
    setProgress(prev => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      total: prev.total + 1
    }));
  
    // Update streak
    setStreak(prev => isCorrect ? prev + 1 : 0);
  
    // Add to practice history
    setPracticeHistory(prev => [
      ...prev, 
      {
        sentence: currentSentence.text,
        userTranslation,
        isCorrect,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleShowAnswer = async () => {
    setShowAnswer(true);
    if (!currentSentence) return;
  
    const sourceLang = translationDirection === "en-tr" ? "English" : "Turkish";
    const targetLang = translationDirection === "en-tr" ? "Turkish" : "English";
  
    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} translator. Provide only the translation without explanations.`;
    const userPrompt = `Translate this ${sourceLang} sentence to ${targetLang}: "${currentSentence.text}"`;
  
    const result = await askAI(sysPrompt, userPrompt);
    setAiFeedback(`Model translation: ${result}`);
  };
  

  // Function to handle word click for definition
  const handleWordClick = async (e) => {
    if (!currentSentence) return;
    
    // Get the clicked word
    const word = e.target.textContent.replace(/[.,!?;:()]/g, '');
    if (!word.trim()) return;
    
    // Position the tooltip near the clicked word
    const rect = e.target.getBoundingClientRect();
    if (tooltipRef.current) {
      tooltipRef.current.style.top = `${rect.bottom + window.scrollY + 10}px`;
      tooltipRef.current.style.left = `${rect.left + window.scrollX}px`;
    }
    
    // Get translation for the word
    setIsLoading(true);
    const sourceLang = translationDirection === "en-tr" ? "English" : "Turkish";
    const targetLang = translationDirection === "en-tr" ? "Turkish" : "English";
    
    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} dictionary. Provide a brief definition/translation of the word.`;
    const userPrompt = `Provide the ${targetLang} translation of the ${sourceLang} word "${word}". Format your response as:
Word: (original word)
Translation: (at least three translation) in ${targetLang}`;

    const result = await askAI(sysPrompt, userPrompt);
    setWordDefinition({ word, definition: result });
    setIsLoading(false);
  };

  const toggleDirection = async () => {
    const newDirection = translationDirection === "en-tr" ? "tr-en" : "en-tr";
    setTranslationDirection(newDirection);
    
    if (newDirection === "tr-en") {
      const sysPrompt = "You are a Turkish-to-English translator. Provide only the English translation of the sentence.";
      const userPrompt = `Translate this Turkish sentence to English: "${currentSentence.text}"`;
      const result = await askAI(sysPrompt, userPrompt);
      
      // Set the AI-generated translation as the question in the translation box
      setCurrentSentence(prevState => ({
        ...prevState,
        text: result,
      }));
    }
  };
  

  // Calculate accuracy percentage
  const getAccuracyPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.correct / progress.total) * 100);
  };

  // Handle difficulty change
  const handleDifficultyChange = (e) => {
    setDifficulty(e.target.value);
  };

  return (
    <div className="translation-practice">
      <div className="translation-header">
        <h2>Translation Practice</h2>
        <div className="practice-controls">
          <div className="direction-toggle">
            <span className={translationDirection === "en-tr" ? "active" : ""}>English</span>
            <button className="toggle-btn" onClick={toggleDirection}>
              ⇄
            </button>
            <span className={translationDirection === "tr-en" ? "active" : ""}>Turkish</span>
          </div>
          
          <div className="difficulty-selector">
            <label htmlFor="difficulty">Difficulty:</label>
            <select 
              id="difficulty" 
              value={difficulty} 
              onChange={handleDifficultyChange}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="all">All Levels</option>
            </select>
          </div>
          
          <button className="back-button" onClick={() => showPage("main")}>
            Back to Menu
          </button>
        </div>
      </div>

      {currentSentence ? (
        <div className="practice-container">
          <div className="stats-container">
            <div className="stat">
              <span>Accuracy:</span> {getAccuracyPercentage()}%
            </div>
            <div className="stat">
              <span>Current streak:</span> {streak}
            </div>
            <div className="stat">
              <span>Completed:</span> {progress.total}
            </div>
          </div>

          <div className="sentence-card">
            <h3>Translate to {translationDirection === "en-tr" ? "Turkish" : "English"}:</h3>
            <p className="source-sentence">
              {currentSentence.text.split(" ").map((word, index) => (
                <span 
                  key={index} 
                  className="clickable-word" 
                  onClick={handleWordClick}
                >
                  {word}{index < currentSentence.text.split(" ").length - 1 ? " " : ""}
                </span>
              ))}
            </p>
            <div className="sentence-hint">
              <small>Click on any word to see its translation</small>
            </div>
          </div>

          {wordDefinition && (
            <div className="word-tooltip" ref={tooltipRef}>
              <div className="tooltip-header">
                <span className="word">{wordDefinition.word}</span>
                <button className="close-tooltip" onClick={() => setWordDefinition(null)}>×</button>
              </div>
              <div className="tooltip-content">
                {wordDefinition.definition}
              </div>
            </div>
          )}

          <textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            placeholder={`Enter your ${translationDirection === "en-tr" ? "Turkish" : "English"} translation...`}
            className="translation-input"
          />

          <div className="button-group">
            <button 
              className="check-button" 
              onClick={handleCheckTranslation}
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Check Translation"}
            </button>
            
            <button 
              className="show-button" 
              onClick={handleShowAnswer}
              disabled={isLoading || showAnswer}
            >
              Show Answer
            </button>
            
            <button 
              className="next-button" 
              onClick={goNext}
            >
              Next Sentence
            </button>
          </div>

          {aiFeedback && (
            <div className={`feedback-container ${aiFeedback.toLowerCase().includes("correct") && !aiFeedback.toLowerCase().includes("incorrect") ? "correct" : "incorrect"}`}>
              <h4>Feedback:</h4>
              <p>{aiFeedback}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="no-sentences">
          {isLoading ? (
            <p>Loading sentences...</p>
          ) : (
            <div>
              <p>No sentences available for practice.</p>
              <p>Add some sentences first or check your database.</p>
              <button onClick={() => showPage("main")}>Go Back</button>
            </div>
          )}
        </div>
      )}
      
      {practiceHistory.length > 0 && (
        <div className="practice-history">
          <h3>Recent Practice</h3>
          <div className="history-items">
            {practiceHistory.slice(-5).map((item, idx) => (
              <div key={idx} className={`history-item ${item.isCorrect ? 'correct' : 'incorrect'}`}>
                <div className="history-sentence">{item.sentence}</div>
                <div className="history-translation">{item.userTranslation}</div>
                <div className="history-result">{item.isCorrect ? '✓' : '✗'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationPracticePage;