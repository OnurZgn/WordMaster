import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/TranslationPracticePage.css"; // We'll create this CSS file

const TranslationPracticePage = ({ showPage }) => {
  const [sentences, setSentences] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ correct: 0, total: 0 });
  const [showAnswer, setShowAnswer] = useState(false);

  // AI configuration
  const AI_URL = process.env.REACT_APP_AI_API_URL;
  const AIToken = process.env.REACT_APP_AI_API_KEY;

  // Function to validate translation using AI
  const askAI = async (sysPrompt, userPrompt) => {
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
      console.log(data);
      setIsLoading(false);
      return data.choices[0].message.content.replaceAll('"', "");
    } catch (error) {
      setIsLoading(false);
      console.error("AI error:", error);
      return "Error getting AI response. Please try again.";
    }
  };

  useEffect(() => {
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

    fetchSentences();
  }, []);

  // Function to check translation with AI
  const handleCheckTranslation = async () => {
    if (!userTranslation.trim()) {
      alert("Please enter your translation first!");
      return;
    }

    const currentSentence = getCurrentSentence();
    if (!currentSentence) return;

    const sysPrompt = "You are an English-to-Turkish translation validator. Be concise but helpful.";
    const userPrompt = `
The user translated the sentence "${currentSentence}" into Turkish as follows:
"${userTranslation}"

Is this translation correct? Respond in a structured format:
1. Start with either "✓ CORRECT" or "✗ INCORRECT"
2. If incorrect, provide the correct translation
3. Add a brief explanation of any mistakes (max 2 sentences)
`;

    const result = await askAI(sysPrompt, userPrompt);
    setAiFeedback(result);
    
    // Update progress
    setProgress(prev => {
      const isCorrect = result.toLowerCase().includes("correct") && !result.toLowerCase().includes("incorrect");
      return {
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        total: prev.total + 1
      };
    });

    // Save progress to user data (would need to be implemented)
  };

  // Function to go to the next sentence
  const goNext = () => {
    setAiFeedback("");
    setUserTranslation("");
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1 < sentences.length ? prev + 1 : 0));
  };

  // Function to reveal the correct answer without AI check
  const handleShowAnswer = async () => {
    setShowAnswer(true);
    const currentSentence = getCurrentSentence();
    if (!currentSentence) return;

    const sysPrompt = "You are an English-to-Turkish translator. Provide only the translation without explanations.";
    const userPrompt = `Translate this English sentence to Turkish: "${currentSentence}"`;

    const result = await askAI(sysPrompt, userPrompt);
    setAiFeedback(`Model translation: ${result}`);
  };

  // Helper to get current sentence safely
  const getCurrentSentence = () => {
    if (sentences.length === 0) return null;
    
    const currentSentence = sentences[currentIndex];
    // Handle both possible data structures
    if (typeof currentSentence === 'string') {
      return currentSentence;
    } else if (currentSentence && currentSentence.sentence) {
      return currentSentence.sentence;
    } else if (currentSentence) {
      // Try to get first property which might be a sentence
      const firstKey = Object.keys(currentSentence)[0];
      if (firstKey && typeof currentSentence[firstKey] === 'string') {
        return currentSentence[firstKey];
      }
    }
    return "No sentence available";
  };

  // Calculate accuracy percentage
  const getAccuracyPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.correct / progress.total) * 100);
  };

  return (
    <div className="translation-practice">
      <div className="translation-header">
        <h2>Translation Practice</h2>
        <button className="back-button" onClick={() => showPage("main")}>
          Back to Menu
        </button>
      </div>

      {sentences.length > 0 ? (
        <div className="practice-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentIndex / sentences.length) * 100}%` }}
            ></div>
          </div>
          
          <div className="stats-container">
            <div className="stat">
              <span>Progress:</span> {currentIndex + 1}/{sentences.length}
            </div>
            <div className="stat">
              <span>Accuracy:</span> {getAccuracyPercentage()}%
            </div>
          </div>

          <div className="sentence-card">
            <h3>Translate to Turkish:</h3>
            <p className="english-sentence">{getCurrentSentence()}</p>
          </div>

          <textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            placeholder="Enter your Turkish translation..."
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
    </div>
  );
};

export default TranslationPracticePage;