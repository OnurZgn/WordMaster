import { doc, setDoc } from 'firebase/firestore'; 
import React, { useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

function UploadPage({ showPage, setVocabularyData, setEngW, setTrW, setEngS, setTrS }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        const content = e.target.result;

        try {
          const parsedData = JSON.parse(content);

          if (parsedData.words && parsedData.sentences) {
            saveDataToFirestore(parsedData);
          } else {
            alert("Invalid data structure in the uploaded file.");
          }
        } catch (error) {
          alert("Error parsing JSON file: " + error.message);
        }
      };

      reader.onerror = function () {
        console.error("There was an error reading the file.");
      };
      
      reader.readAsText(file);
    });
  };

  const saveDataToFirestore = async (data) => {
    try {
      const docRef = doc(db, 'data', 'mainData');  
      await setDoc(docRef, {
        words: data.words,
        sentences: data.sentences
      });
  
      alert("Data successfully uploaded to Firestore!");
  
      // State'leri güncelle
      setEngW(data.words.map(word => word.english));
      setTrW(data.words.map(word => word.turkish));
      setEngS(data.words.filter(word => !word.ignore).map(word => word.english));
      setTrS(data.words.filter(word => !word.ignore).map(word => word.turkish));
      setVocabularyData(data);
  
      showPage('main');
    } catch (error) {
      console.error("Error saving data to Firestore:", error);
      alert("Error saving data: " + error.message);
    }
  };

  const fetchDataFromFirestore = async () => {
    try {
      const wordsCollection = collection(db, 'data');
      const snapshot = await getDocs(wordsCollection);
      
      if (snapshot.empty) {
        alert('No data found in the database!');
        return;
      }

      let data;
      snapshot.forEach((doc) => {
        if (doc.id === 'mainData') {
          data = doc.data();
        }
      });

      if (!data) {
        alert('Main vocabulary data not found!');
        return;
      }

      const vocabularyData = data;

      const engW = vocabularyData.words.map(word => word.english);
      setEngW(engW);

      const trW = vocabularyData.words.map(word => [...word.turkish]);
      setTrW(trW);

      const trI = vocabularyData.words.filter(word => word.ignore === false).map(word => [...word.turkish]);
      const engI = vocabularyData.words.filter(word => word.ignore === false).map(word => word.english);

      setEngS(engI);
      setTrS(trI);
      setVocabularyData(vocabularyData);

      showPage('main');
    } catch (error) {
      console.error('Error fetching data from Firestore:', error);
      alert('Error fetching data: ' + error.message);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        id="fileInput" 
        multiple 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <label htmlFor="fileInput" className="file-upload">Load Files</label>
      <div className="btn tooltip">
        <span className="tooltiptext">
          If you click this button without uploading your files,
          the data will be retrieved from Firebase.
        </span>
        <a onClick={fetchDataFromFirestore}>Load/Fetch Data</a>
      </div>
    </div>
  );
}

export default UploadPage;
