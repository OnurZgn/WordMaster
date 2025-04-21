import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function AddWordPage({ showPage, vocabularyData, setVocabularyData, engW, trW, setEngW, setTrW }) {
  const [newEng, setNewEng] = useState('');
  const [newTr1, setNewTr1] = useState('');
  const [newTr2, setNewTr2] = useState('');
  const [newTr3, setNewTr3] = useState('');

  // AI configuration
  const AI_URL = process.env.REACT_APP_AI_API_URL;
  const AIToken = process.env.REACT_APP_AI_API_KEY2;

  const askAI = async (sysPrompt, userPrompt) => {
    try {
      const response = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4o",
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

  const handleAddWord = async () => {
    const trimmedEng = newEng.trim();
    const trimmedTr1 = newTr1.trim();
    const trimmedTr2 = newTr2.trim();
    const trimmedTr3 = newTr3.trim();

    if (trimmedEng && (trimmedTr1 || trimmedTr2 || trimmedTr3)) {
      // Check if the word already exists
      const isAlreadyIn = engW.some(word => {
        if (Array.isArray(word)) {
          const words = word[0].split("-"); 
          return words.includes(trimmedEng);
        } else {
          return word === trimmedEng;
        }
      });

      if (isAlreadyIn) {
        alert("This word already exists");
      } else {
        const newEngW = [...engW, trimmedEng];
        const newTrW = [...trW, [trimmedTr1, trimmedTr2, trimmedTr3].filter(tr => tr !== "")];
        
        setEngW(newEngW);
        setTrW(newTrW);

        if (vocabularyData) {
          const updatedData = { ...vocabularyData };
          updatedData.words.push({ 
            english: trimmedEng, 
            turkish: [trimmedTr1, trimmedTr2, trimmedTr3].filter(tr => tr !== ""),
            ignore: false 
          });
          
          setVocabularyData(updatedData);
          
          try {
            // If you're using Firebase, update the document
            // This assumes you have a document reference
            if (vocabularyData.docRef) {
              await updateDoc(doc(db, "vocabulary", vocabularyData.docRef), {
                words: updatedData.words
              });
            }
            alert("Word added successfully!");
          } catch (error) {
            console.error("Error updating document:", error);
            alert("Error saving word to database");
          }
        } else {
          alert("Word added successfully!");
        }

        // Clear the inputs
        setNewEng('');
        setNewTr1('');
        setNewTr2('');
        setNewTr3('');
      }
    } else {
      if (trimmedEng) {
        const sysPrompt = "You are an english-turkish translate program.";
        const userPrompt = `Write the equivalents up to 3 of ${trimmedEng} using only one turkish word, don't comment or dont explain just give the equivalents and give 2 english sentences as additional.`;
        
        const aiResponse = await askAI(sysPrompt, userPrompt);
        alert(aiResponse);
        return;
      }
      
      alert("Please enter at least one word and its equivalent.");
    }
  };

  const handleSave = async () => {
    try {
      if (!vocabularyData) {
        alert("No data to save!");
        return;
      }
  
      // Firestore reference to the document where data will be saved
      const vocabularyRef = doc(db, 'data', 'mainData');  // Adjust 'mainData' or any document ID you're working with
  
      // Update the document in Firestore
      await updateDoc(vocabularyRef, {
        words: vocabularyData.words,
        sentences: vocabularyData.sentences,  // Add other fields as necessary
      });
  
      alert("Data successfully updated in Firestore!");
  
    } catch (error) {
      console.error('An error occurred while updating database:', error);
      alert("An error occurred while updating database: " + error.message);
    }
  };
  

  const handleDownload = () => {
    if (!vocabularyData || !vocabularyData.words || vocabularyData.words.length === 0) {
      alert("No data to download");
      return;
    }

    // Create English words file
    const engContent = vocabularyData.words.map(word => word.english).join('\n');
    const engBlob = new Blob([engContent], { type: 'text/plain' });
    const engUrl = URL.createObjectURL(engBlob);
    const engLink = document.createElement('a');
    engLink.href = engUrl;
    engLink.download = 'engW.txt';
    engLink.click();

    // Create Turkish words file
    const trContent = vocabularyData.words.map(word => word.turkish.join('-')).join('\n');
    const trBlob = new Blob([trContent], { type: 'text/plain' });
    const trUrl = URL.createObjectURL(trBlob);
    const trLink = document.createElement('a');
    trLink.href = trUrl;
    trLink.download = 'TRW.txt';
    trLink.click();
  };

  return (
    <div id="addWordPage" className="page">
      <input
        id="newEng"
        type="text"
        style={{ textAlign: 'center' }}
        placeholder="English"
        value={newEng}
        onChange={(e) => setNewEng(e.target.value)}
      />
      <input
        id="newTr1"
        className="tr"
        style={{ textAlign: 'center' }}
        type="text"
        placeholder="Turkish"
        value={newTr1}
        onChange={(e) => setNewTr1(e.target.value)}
      />
      <input
        id="newTr2"
        className="tr"
        style={{ textAlign: 'center' }}
        type="text"
        placeholder="Turkish"
        value={newTr2}
        onChange={(e) => setNewTr2(e.target.value)}
      />
      <input
        id="newTr3"
        className="tr"
        style={{ textAlign: 'center' }}
        type="text"
        placeholder="Turkish"
        value={newTr3}
        onChange={(e) => setNewTr3(e.target.value)}
      />
      <div className="btn">
        <a onClick={handleAddWord}>Add</a>
      </div>
      <div className="btn">
        <a onClick={handleSave}>Save</a>
      </div>
      <div className="btn">
        <a onClick={handleDownload}>Download Files</a>
      </div>
      <div className="btn">
        <a onClick={() => showPage("main")}>Back to Menu</a>
      </div>
    </div>
  );
}

export default AddWordPage;