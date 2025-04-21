// src/components/MainPage.js
import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function MainPage({ 
  showPage, 
  vocabularyData, 
  setVocabularyData,
  engW, 
  trW, 
  engS, 
  trS, 
  setEngS, 
  setTrS,
  ignoredWords,
  setIgnoredWords
}) {
  const [randomIndex, setRandomIndex] = useState(0);
  const [displayType, setDisplayType] = useState(1);
  const [intervalText, setIntervalText] = useState('');

  // AI configuration
  const AI_URL = process.env.REACT_APP_AI_API_URL;
  const AIToken1 = process.env.REACT_APP_AI_API_KEY1;
  const AIToken2 = process.env.REACT_APP_AI_API_KEY2;
  var AIToken = process.env.REACT_APP_AI_API_KEY1;



  const generateNext = () => {
    const engInput = document.getElementById("eng");
    const trInputs = document.querySelectorAll(".tr");
    
    // Reset fields
    trInputs.forEach((v) => {
      v.disabled = false;
      v.value = "";
    });
    
    engInput.value = "";
    if (engS.length <= 0) return;
    
    const newDisplayType = Math.ceil(Math.random() * 2);
    const newRandomIndex = Math.floor(Math.random() * engS.length);
    
    setDisplayType(newDisplayType);
    setRandomIndex(newRandomIndex);
    setIntervalText('');
    if (newDisplayType === 1) {
      engInput.disabled = false;
      for (let i = 0; i < 3; i++) {
        trInputs[i].disabled = true;
        if (trS[newRandomIndex][i] !== undefined) {
          trInputs[i].value = trS[newRandomIndex][i];
        }
      }
    } else {
      engInput.disabled = true;
      engInput.value = engS[newRandomIndex];
    }
    
  };

  const handleSetInterval = () => {
    const interval = intervalText.trim();
  
    if (interval === "?" || interval === "a") {
      setEngS(engW);
      setTrS(trW);
    } else if (interval === "i") {
      const engI = vocabularyData.words
        .filter(word => word.ignore === false)
        .map(word => word.english);
      const trI = vocabularyData.words
        .filter(word => word.ignore === false)
        .map(word => [...word.turkish]);
      setEngS(engI);
      setTrS(trI);
    } else {
      const range = interval.split("-").map(v => Number(v.trim()));
  
      if (range.length === 1 && !isNaN(range[0])) {
        const count = Math.min(range[0], engW.length);
        setEngS(engW.slice(engW.length - count));
        setTrS(trW.slice(engW.length - count));
      } else if (
        range.length === 2 &&
        !isNaN(range[0]) &&
        !isNaN(range[1]) &&
        range[0] >= 0 &&
        range[1] <= engW.length &&
        range[0] < range[1]
      ) {
        setEngS(engW.slice(range[0], range[1]));
        setTrS(trW.slice(range[0], range[1]));
      } else {
        alert("Invalid interval input.");
        return;
      }
    }
  
    generateNext();
  };

  const ignoreCurrentWord = () => {
    const newEngS = [...engS];
    const newTrS = [...trS];
    
    newEngS.splice(randomIndex, 1);
    newTrS.splice(randomIndex, 1);
    
    setEngS(newEngS);
    setTrS(newTrS);
    generateNext();
  };

  const markAsIgnored = () => {
    const wordToIgnore = engS[randomIndex];
    const updatedData = { ...vocabularyData };
    
    // Find the word in the original data and mark it as ignored
    const wordIndex = updatedData.words.findIndex(word => word.english === wordToIgnore);
    if (wordIndex !== -1) {
      updatedData.words[wordIndex].ignore = true;
      setVocabularyData(updatedData);
      
      // Add to ignored words list
      setIgnoredWords([...ignoredWords, wordToIgnore]);
    }
    
    ignoreCurrentWord();
  };

  const askAI = async (sysPrompt, userPrompt) => {
    console.log(engS.length)
    try {
      const response = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: sysPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
        }),
      });
      
      const data = await response.json();
      return data.choices[0].message.content.replaceAll('"', '');
    } catch (error) {
      alert(`An error occurs while AI is responding! | query:${userPrompt}`);
      return "Error getting AI response";
    }
  };

  const handleAIHelp = async () => {
    if (!engS[randomIndex]) {
      console.log("There is no word to create a sample sentence or explain clearly!");
      return;
    }
    
    const word = engS[randomIndex];
    const sysPrompt = "You are an English language assistant. Create a grammatically correct sentence using the word.";
    const userPrompt = `Create a sentence using the word "${word}", use at most 9 words.`;
    AIToken = AIToken1;
    const response = await askAI(sysPrompt, userPrompt);
    setIntervalText(response);
    
    // Update the vocabulary data with the new sentence
    if (vocabularyData && !vocabularyData.sentences.some(sentence => sentence.hasOwnProperty(word))) {
      const updatedData = { ...vocabularyData };
      updatedData.sentences.push({ [word]: response });
      setVocabularyData(updatedData);
    }
  };

  const handleHint = async () => {
    const trInputs = document.querySelectorAll(".tr");
    for (let i = 0; i < 3; i++) {
      trInputs[i].disabled = true;
      if (trS[randomIndex][i] !== undefined) {
        trInputs[i].value = trS[randomIndex][i];
      }
    }
    
    document.getElementById("eng").disabled = true;
    document.getElementById("eng").value = engS[randomIndex];
    
    const word = engS[randomIndex];
    if (!word) {
      console.log("There is no word to create a sample sentence or explain clearly!");
      return;
    }
    
    const sysPrompt = "You are an english language assistant. Explain the given word with only one short sentence.";
    const userPrompt = `Explain the world: ${word}, use at most 10 word to explain it`;
    AIToken = AIToken2;
    const response = await askAI(sysPrompt, userPrompt);
    setIntervalText(response);
  };

  const saveUpdatesToFirestore = async () => {
    try {
      if (!vocabularyData) {
        alert("No data to save!");
        return;
      }
      
      const vocabularyRef = doc(db, 'data', 'mainData');
      await updateDoc(vocabularyRef, vocabularyData);
      
      alert("Data successfully updated in Firestore!");
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Error saving data: " + error.message);
    }
  };

  useEffect(() => {
    if (engS.length > 0) {
      generateNext();
    }
  }, [engS, trS]);

  return (
    <div>
      <input id="eng" type="text" style={{ textAlign: 'center' }} placeholder="English" />
      <input id="tr1" type="text" className="tr" style={{ textAlign: 'center' }} placeholder="Turkish" />
      <input id="tr2" type="text" className="tr" style={{ textAlign: 'center' }} placeholder="Turkish" />
      <input id="tr3" type="text" className="tr" style={{ textAlign: 'center' }} placeholder="Turkish" />
      
      <div className="custom-input-container">
        <textarea 
          id="interval" 
          placeholder="Interval < x-y, x, a:All, i:ignore >"
          value={intervalText}
          onChange={(e) => setIntervalText(e.target.value)}
        />
      </div>
      
      <div className="label-container">
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={ignoreCurrentWord}>Ignore</a>
        </div>
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={markAsIgnored}>x</a>
        </div>
      </div>
      
      <div className="label-container">
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={handleHint}>?</a>
        </div>
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={handleAIHelp}>AI</a>
        </div>
      </div>
      
      <div className="btn">
        <a onClick={handleSetInterval}>Set Interval</a>
      </div>
      
      <div className="btn">
        <a onClick={()=> showPage('translationPractice')}>Practice</a>
      </div>
      
      <div className="label-container">
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={() => showPage('addWord')}>+</a>
        </div>
        <label className="number-label" id="size">{engS.length}</label>
        <div className="btn" style={{ width: '60%' }}>
          <a onClick={saveUpdatesToFirestore}>🗘</a>
        </div>
      </div>
    </div>
  );
}

export default MainPage;
