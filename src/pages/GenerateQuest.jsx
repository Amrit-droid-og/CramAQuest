import React, { useState } from 'react';
import { generateQuestFromText, generateQuestFromFile } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, BookOpen, FileText, Upload, AlertCircle } from 'lucide-react';

export default function GenerateQuest() {
  const [activeTab, setActiveTab] = useState('text'); // 'text' or 'file'
  const [studyMaterial, setStudyMaterial] = useState('');
  const [file, setFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError("File size exceeds 10MB limit.");
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
    }
  };

  // Convert File object to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async () => {
    setError('');
    setIsGenerating(true);

    try {
      let gameData;
      if (activeTab === 'text') {
        if (!studyMaterial.trim()) {
          throw new Error("Please paste some study material first.");
        }
        gameData = await generateQuestFromText(studyMaterial, numQuestions);
      } else {
        if (!file) {
          throw new Error("Please select a study document (PDF or Image) first.");
        }
        const base64Data = await fileToBase64(file);
        gameData = await generateQuestFromFile(base64Data, file.type, numQuestions);
      }

      navigate('/play', { state: { gameData } });
    } catch (err) {
      setError(err.message || "Failed to generate quest. Please verify your Gemini API key in src/lib/gemini.js or try a different file.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-1 md:px-0">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
          Create New Quest
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-2">
          Transform your raw notes, study guides, PDF files, or diagrams into an engaging study quest.
        </p>
      </header>

      {/* Mode Selector Tab */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6 max-w-sm">
        <button
          onClick={() => { setActiveTab('text'); setError(''); }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'text'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Paste Text
        </button>
        <button
          onClick={() => { setActiveTab('file'); setError(''); }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'file'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Upload Document
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm animate-in fade-in duration-500">
        {activeTab === 'text' ? (
          <textarea
            className="w-full h-64 p-4 rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow text-foreground"
            placeholder="Paste your lecture notes, chapter summaries, or textbook sections here (Photosynthesis, Calculus formulas, etc.)..."
            value={studyMaterial}
            onChange={(e) => setStudyMaterial(e.target.value)}
            disabled={isGenerating}
          />
        ) : (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 bg-background/50 hover:bg-background transition-colors relative">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              disabled={isGenerating}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center pointer-events-none">
              <div className="mx-auto w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mb-4">
                {file ? <FileText className="w-6 h-6 text-primary" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
              </div>
              <p className="font-semibold text-lg">
                {file ? file.name : "Drag & drop your file here"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {file ? `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Supports PDFs and Images up to 10MB"}
              </p>
              {!file && (
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/80 px-3 py-1.5 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Tip: Save PPT slides as PDF to upload them
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto bg-muted/30 p-2 rounded-lg border border-border">
            <label htmlFor="numQuestions" className="text-sm font-medium text-foreground whitespace-nowrap">
              Number of Questions:
            </label>
            <input
              id="numQuestions"
              type="number"
              min="1"
              max="30"
              value={numQuestions}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 30) setNumQuestions(30);
                else if (val < 1) setNumQuestions(1);
                else setNumQuestions(val || 5);
              }}
              disabled={isGenerating}
              className="w-20 px-3 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
            <span className="text-xs text-muted-foreground hidden sm:inline">(Max 30)</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Forging Quest...
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5" />
                Generate Quest
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
