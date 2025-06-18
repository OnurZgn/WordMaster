import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
var AIToken = process.env.REACT_APP_AI_API_KEY1;
function AddWordPage({ showPage, vocabularyData, setVocabularyData, engW, trW, setEngW, setTrW }) {
  const [newEng, setNewEng] = useState('');
  const [newTr1, setNewTr1] = useState('');
  const [newTr2, setNewTr2] = useState('');
  const [newTr3, setNewTr3] = useState('');

  // AI configuration
  const AI_URL = process.env.REACT_APP_AI_API_URL;
  const AIToken1 = process.env.REACT_APP_AI_API_KEY1;
  const AIToken2 = process.env.REACT_APP_AI_API_KEY2;

  const askAI = async (sysPrompt, userPrompt) => {
    if (AIToken === AIToken1) AIToken = AIToken2;
    else AIToken = AIToken1;
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
      return "invalid";
    }
  };

  const handleAddWord = async () => {
    const trimmedEng = newEng.trim();
    const trimmedTr1 = newTr1.trim();
    const trimmedTr2 = newTr2.trim();
    const trimmedTr3 = newTr3.trim();

    if (trimmedEng && (trimmedTr1 || trimmedTr2 || trimmedTr3)) {
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

        setNewEng('');
        setNewTr1('');
        setNewTr2('');
        setNewTr3('');
      }
    } else {
      // ✅ Sadece İngilizce kelime girilmişse AI'den çevirileri al
      if (trimmedEng) {
        const sysPrompt = "You are a bilingual dictionary that only returns structured data.";
        const userPrompt = `Give me the 3 most common  Turkish equivalents of the English word "${trimmedEng}", comma-separated in one line. Then give 2 example English sentences using the word, each on a new line. Do not explain anything. Explain the meaning of the word.`;
        const aiResponse = await askAI(sysPrompt, userPrompt);
        if (aiResponse === "invalid") {
          return;
        }


        // AI cevabını satırlara ayır ve ilk satırdan anlamları çıkar
        const lines = aiResponse.split('\n');
        const meanings = lines[0].split(',').map(str => str.trim());

        // Otomatik inputlara yerleştir
        setNewTr1(meanings[0] || '');
        setNewTr2(meanings[1] || '');
        setNewTr3(meanings[2] || '');

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

  const handleReset = () => {
    if((newEng !== '' && (newTr1 !== '' || newTr2 !== '' || newTr3 !== ''))) {
      setNewTr1('');
      setNewTr2('');
      setNewTr3('');
    }else
    setNewEng('');
    
  };

  const handleDownload = () => {
    if (!vocabularyData || !vocabularyData.words || vocabularyData.words.length === 0) {
      alert("No data to download");
      return;
    }
    // ✅ Create JSON file with full vocabularyData
    const jsonBlob = new Blob([JSON.stringify(vocabularyData, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = 'data.json';
    jsonLink.click();
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
        <a onClick={handleReset}>Reset</a>
      </div>
      <div className="btn">
        <a onClick={() => showPage("main")}>Back to Menu</a>
      </div>
      
    </div>
  );
}

export default AddWordPage;