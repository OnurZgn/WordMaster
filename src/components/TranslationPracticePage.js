import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/TranslationPracticePage.css";

let AIToken = process.env.REACT_APP_AI_API_KEY1;

const TranslationPracticePage = ({ showPage }) => {
  let [sentences, setSentences] = useState([]);
  let [selected, setselected] = useState(null); // To store the selected sentence
  const [currentSentence, setCurrentSentence] = useState(null);
  const [userTranslation, setUserTranslation] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ correct: 0, close: 0, incorrect: 0, total: 0 });
  const [showAnswer, setShowAnswer] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);
  const [translationDirection, setTranslationDirection] = useState("en-tr"); // "en-tr" or "tr-en"
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [difficulty, setDifficulty] = useState("medium");
  const [practiceTopic, setPracticeTopic] = useState("general"); // New: Topic selector

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
          model: "gpt-4o",
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
      return "invalid";
    }
  };

  useEffect(() => {
    fetchSentences();
  }, []);

  useEffect(() => {
    if (sentences.length > 0) {
      selectRandomSentence();
    }
  }, [sentences, translationDirection, difficulty, practiceTopic]);

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
          setProgress({ correct: 0, close: 0, incorrect: 0, total: 0 });
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
        const word = Object.keys(sentence)[0];
        const text = sentence[word] || "";

        const wordCount = text.trim().split(/\s+/).length;

        if (difficulty === "easy") return wordCount <= 7;
        if (difficulty === "medium") return wordCount > 6 && wordCount <= 10;
        if (difficulty === "hard") return wordCount > 10;
        return true;
      });
    }


    // Filter by topic
    if (practiceTopic !== "general") {
      filteredSentences = filteredSentences.filter(sentence => {
        if (typeof sentence === 'object' && sentence.topic) {
          return sentence.topic === practiceTopic;
        }
        return false;
      });
    }

    if (filteredSentences.length === 0) {
      // If no sentences match criteria, generate a sentence with AI
      const generatedSentence = await generateSentenceByTopic(practiceTopic, difficulty);
      if (generatedSentence) {
        setCurrentSentence({
          text: generatedSentence.text,
          translation: generatedSentence.translation,
          topic: practiceTopic,
          difficulty: difficulty
        });
        setAiFeedback("");
        setUserTranslation("");
        setShowAnswer(false);
        setWordDefinition(null);
        return;
      }

      // Fallback to all sentences if no match and generation failed
      filteredSentences = sentences;
    }

    const randomIndex = Math.floor(Math.random() * filteredSentences.length);
    selected = filteredSentences[randomIndex];
    setselected(selected); // Store the selected sentence
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
          topic: selected.topic || "general",
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

  // Generate a sentence based on topic
  const generateSentenceByTopic = async (topic, difficulty) => {
    const difficultyLevels = {
      easy: "simple sentences with basic vocabulary",
      medium: "moderately complex sentences with common vocabulary",
      hard: "complex sentences with advanced vocabulary and structures"
    };

    const topicPrompts = {
      "tenses": `Create an English sentence that practices the use of various tenses (past, present, future). Make it ${difficultyLevels[difficulty]}.`,
      "phrasal-verbs": `Create an English sentence that includes at least one phrasal verb. Make it ${difficultyLevels[difficulty]}.`,
      "modals": `Create an English sentence that includes modal verbs (can, could, should, would, etc.). Make it ${difficultyLevels[difficulty]}.`,
      "conditionals": `Create an English sentence that demonstrates the use of conditionals. Make it ${difficultyLevels[difficulty]}.`
    };

    const sysPrompt = "You are a language education assistant. Create sentences for language learners based on specific grammar topics.";
    const userPrompt = `${topicPrompts[topic] || "Create a general English sentence."} 
    
Response format:
English: [Your created sentence]
Turkish: [Turkish translation of the sentence]
Explanation: [Brief explanation of the grammar point demonstrated]`;

    try {
      const result = await askAI(sysPrompt, userPrompt);
      if (result === "invalid") return null;

      // Parse the result
      const englishMatch = result.match(/English: (.*)/);
      const turkishMatch = result.match(/Turkish: (.*)/);

      if (englishMatch && turkishMatch) {
        return {
          text: englishMatch[1].trim(),
          translation: turkishMatch[1].trim(),
          topic: topic,
          difficulty: difficulty
        };
      }
      return null;
    } catch (error) {
      console.error("Error generating sentence:", error);
      return null;
    }
  };

  // AI ile çeviriyi yap (Türkçeye çevir)
  const translateToTurkish = async (sentence) => {
    const sysPrompt = "You are an English-to-Turkish translator. Provide only the Turkish translation of the sentence.";
    const userPrompt = `Translate this English sentence to Turkish: "${sentence}"`;

    const result = await askAI(sysPrompt, userPrompt);
    if (result === "invalid") return;
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

    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} translation validator. Evaluate whether the translation is correct, close (partially correct), or incorrect.`;
    const userPrompt = `
The user translated the ${sourceLang} sentence: "${currentSentence.text}" 
Into ${targetLang} as: "${userTranslation}"

Evaluate this translation with one of three categories:
1. "✓ CORRECT" - The translation is fully accurate in meaning and grammar
2. "⚠ CLOSE" - The translation captures the main idea but has major errors or could be improved
3. "✗ INCORRECT" - The translation has significant errors or misses the meaning

Then provide:
1. The correct translation
2. A detailed explanation of any mistakes or how the "close" translation could be improved
3. Highlight specific errors or problem areas by mentioning the exact words or phrases that need correction
4. If relevant, briefly explain the grammar concept involved (especially if this is related to ${currentSentence.topic || "general translation"})

Format your response starting with one of the three categories (CORRECT, CLOSE, or INCORRECT).
`;

    const result = await askAI(sysPrompt, userPrompt);
    if (result === "invalid") return;
    setAiFeedback(result);

    // Determine the category from the AI response
    let category = "incorrect";
    if (result.toLowerCase().includes("correct") && !result.toLowerCase().includes("close") && !result.toLowerCase().includes("incorrect")) {
      category = "correct";
      sentences = sentences.filter(sentence => {
        return sentence[Object.keys(sentence)[0]] !== selected[Object.keys(selected)[0]];
      });
      setSentences(sentences); // Update the sentences state to remove the current sentence

    } else if (result.toLowerCase().includes("close")) {
      category = "close";
    }


    // Update progress based on category
    setProgress(prev => ({
      ...prev,
      [category]: prev[category] + 1,
      total: prev.total + 1
    }));

    // Update streak - both correct and close answers contribute to streak
    setStreak(prev => (category === "correct" || category === "close") ? prev + 1 : 0);

    // Add to practice history
    setPracticeHistory(prev => [
      ...prev,
      {
        sentence: currentSentence.text,
        userTranslation,
        category,
        timestamp: new Date().toISOString()
      }
    ]);
    if (category === "correct") {
      goNext(); // Automatically go to the next sentence if the answer is correct
    }
  };

  const handleShowAnswer = async () => {
    setShowAnswer(true);
    if (!currentSentence) return;

    const sourceLang = translationDirection === "en-tr" ? "English" : "Turkish";
    const targetLang = translationDirection === "en-tr" ? "Turkish" : "English";

    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} translator. Provide the translation with a brief explanation.`;
    const userPrompt = `Translate this ${sourceLang} sentence to ${targetLang}: "${currentSentence.text}"

Please provide:
1. The translation
2. A brief explanation of any challenging vocabulary or grammar in the sentence
${currentSentence.topic ? `3. Explain how this sentence relates to the topic of "${currentSentence.topic}"` : ""}`;

    const result = await askAI(sysPrompt, userPrompt);
    if (result === "invalid") return;
    setAiFeedback(`Model translation and explanation: ${result}`);
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

    const sysPrompt = `You are a ${sourceLang}-to-${targetLang} dictionary. Provide a brief definition/translation of the word with examples.`;
    const userPrompt = `Provide the ${targetLang} translation of the ${sourceLang} word "${word}". Format your response as:
Word: (original word)
Translation: (at least three translations) in ${targetLang} 
Examples: (1-2 simple example sentences using this word)
${currentSentence.topic ? `Related to "${currentSentence.topic}": (briefly mention if this word relates to the grammar topic we're practicing)` : ""}`;

    const result = await askAI(sysPrompt, userPrompt);
    if (result === "invalid") return;
    setWordDefinition({ word, definition: result });
    setIsLoading(false);
  };

  const toggleDirection = async () => {
    const newDirection = translationDirection === "en-tr" ? "tr-en" : "en-tr";
    setTranslationDirection(newDirection);

    if (currentSentence) {
      if (newDirection === "tr-en") {
        const sysPrompt = "You are a Turkish-to-English translator. Provide only the English translation of the sentence.";
        const userPrompt = `Translate this Turkish sentence to English: "${currentSentence.text}"`;
        const result = await askAI(sysPrompt, userPrompt);
        if (result === "invalid") return;

        // Set the AI-generated translation as the question in the translation box
        setCurrentSentence(prevState => ({
          ...prevState,
          text: result,
        }));
      } else {
        await selectRandomSentence("en-tr");
      }
    }
  };

  // Calculate accuracy percentage
  const getAccuracyPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round(((progress.correct + (progress.close * 0.5)) / progress.total) * 100);
  };

  // Handle difficulty change
  const handleDifficultyChange = (e) => {
    setDifficulty(e.target.value);
  };

  // Handle topic change
  const handleTopicChange = (e) => {
    setPracticeTopic(e.target.value);
  };

  // Get feedback class based on category
  const getFeedbackClass = (feedbackText) => {
    if (feedbackText.toLowerCase().includes("correct") && !feedbackText.toLowerCase().includes("incorrect") && !feedbackText.toLowerCase().includes("close")) {
      return "correct";
    } else if (feedbackText.toLowerCase().includes("close")) {
      return "close";
    }
    return "incorrect";
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

          <div className="topic-selector">
            <label htmlFor="topic">Topic:</label>
            <select
              id="topic"
              value={practiceTopic}
              onChange={handleTopicChange}
            >
              <option value="general">General</option>
              <option value="tenses">Tenses</option>
              <option value="phrasal-verbs">Phrasal Verbs</option>
              <option value="modals">Modal Verbs</option>
              <option value="conditionals">Conditionals</option>
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
            {currentSentence.topic && currentSentence.topic !== "general" && (
              <div className="stat topic-tag">
                <span>Topic:</span> {currentSentence.topic.replace("-", " ")}
              </div>
            )}
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
            <div className={`feedback-container ${getFeedbackClass(aiFeedback)}`}>
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
              <div key={idx} className={`history-item ${item.category}`}>
                <div className="history-sentence">{item.sentence}</div>
                <div className="history-translation">{item.userTranslation}</div>
                <div className="history-result">
                  {item.category === "correct" ? '✓' : item.category === "close" ? '⚠' : '✗'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslationPracticePage;