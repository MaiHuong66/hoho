import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Upload, 
  UserCircle, 
  GraduationCap, 
  FileText, 
  Send, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Table,
  Loader2,
  ChevronLeft,
  Files,
  Lock,
  Download,
  LogOut,
  Settings
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using Vite's asset loading
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
import { geminiService } from './services/gemini';
import { Document, Lecture, Question, TestResult, UserRole } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [role, setRole] = useState<UserRole | null>('STUDENT');
  const [activeWindow, setActiveWindow] = useState<number>(2); // 1: Admin, 2: Learning, 3: Test
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  // Student State
  const [studentInfo, setStudentInfo] = useState({ name: '', class: '' });
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [currentTestAnswers, setCurrentTestAnswers] = useState<Record<string, number>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [globalFileId, setGlobalFileId] = useState('');
  const [greeting, setGreeting] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    // Load results from localStorage for persistence without Firebase
    const savedResults = localStorage.getItem('tutor_results');
    if (savedResults) setResults(JSON.parse(savedResults));

    // Fetch Global Config and Persistent Content
    const initPersistentContent = async () => {
      try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        if (config.globalFileId) {
          setGlobalFileId(config.globalFileId);
          await fetchAndProcessDriveFile(config.globalFileId);
        }
      } catch (error) {
        console.error("Failed to init persistent content:", error);
      }
    };
    initPersistentContent();
  }, []);

  useEffect(() => {
    if (results.length > 0) {
      localStorage.setItem('tutor_results', JSON.stringify(results));
    }
  }, [results]);

  const fetchAndProcessDriveFile = async (fileId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/drive/${fileId}`);
      const data = await res.json();
      if (data.content) {
        const doc: Document = {
          id: 'drive-main',
          title: `Tài liệu từ Drive (${fileId})`,
          content: data.content,
          uploadedAt: new Date()
        };
        setDocuments([doc]);
        
        // Generate Lecture, Test, and Greeting/Summary
        const [lecture, questions] = await Promise.all([
          geminiService.generateLecture(data.content),
          geminiService.generateTest(data.content)
        ]);
        
        setCurrentLecture(lecture);
        setTestQuestions(questions);
        
        // Simple greeting and summary
        setGreeting(`Chào mừng bạn đến với bài học: ${lecture.title}. Tôi là Trợ lý Gia sư Tin học của bạn.`);
        setSummary(lecture.conclusion);
      }
    } catch (error) {
      console.error(error);
      alert("Không thể tải tài liệu từ Google Drive. Vui lòng kiểm tra File ID.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateGlobalFileId = async (fileId: string) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      if (res.ok) {
        setGlobalFileId(fileId);
        await fetchAndProcessDriveFile(fileId);
      }
    } catch (error) {
      alert("Lỗi khi cập nhật File ID.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    const newDocs: Document[] = [];
    let combinedContent = "";

    try {
      let currentCombined = documents.map(d => d.content).join("\n");
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let content = "";

        if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
          content = await extractTextFromPDF(file);
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
          content = await extractTextFromDocx(file);
        } else {
          content = await extractTextFromTxt(file);
        }

        newDocs.push({
          id: Math.random().toString(36).substr(2, 9),
          title: file.name,
          content: content,
          uploadedAt: new Date()
        });
        combinedContent += `\n--- Nguồn từ file: ${file.name} ---\n${content}\n`;
      }

      const updatedDocs = [...documents, ...newDocs];
      setDocuments(updatedDocs);
      const finalCombined = updatedDocs.map(d => d.content).join("\n");
      
      // Generate lecture and test from combined content
      const [lecture, questions] = await Promise.all([
        geminiService.generateLecture(finalCombined),
        geminiService.generateTest(finalCombined)
      ]);
      
      setCurrentLecture(lecture);
      setTestQuestions(questions);
      alert(`${files.length} tài liệu đã được ghi nhận. Hệ thống đã cập nhật bài giảng và bài test dựa trên nội dung mới.`);
    } catch (error) {
      console.error(error);
      alert("Có lỗi khi xử lý tài liệu. Vui lòng kiểm tra định dạng file.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const extractTextFromTxt = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin') {
      setIsAdminAuthenticated(true);
      setShowAdminLogin(false);
      setRole('LECTURER');
      setActiveWindow(1);
      setAdminPassword('');
    } else {
      alert('Sai mật khẩu!');
    }
  };

  const handleLogout = () => {
    setRole('STUDENT');
    setActiveWindow(2);
    setIsAdminAuthenticated(false);
  };

  const exportToCSV = () => {
    if (results.length === 0) {
      alert("Chưa có kết quả để xuất.");
      return;
    }

    // CSV with BOM for Excel/Google Sheets compatibility
    const headers = ["STT", "Họ tên", "Lớp", "Điểm", "Tổng câu", "Nhận xét", "Ngày làm bài"];
    const csvRows = [
      headers.join(","),
      ...results.map((r, i) => [
        i + 1,
        `"${r.studentName}"`,
        `"${r.studentClass}"`,
        r.score,
        r.totalQuestions,
        `"${r.feedback.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${new Date(r.timestamp).toLocaleString()}"`
      ].join(","))
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ket_qua_sinh_vien_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Đã tải xuống file CSV. Bạn có thể mở file này bằng Excel hoặc tải lên Google Sheets.");
  };

  const copyGradesToClipboard = () => {
    if (results.length === 0) {
      alert("Chưa có dữ liệu điểm số.");
      return;
    }
    let markdown = "| STT | Họ tên | Lớp | Điểm | Nhận xét |\n|---|---|---|---|---|\n";
    results.forEach((r, i) => {
      markdown += `| ${i + 1} | ${r.studentName} | ${r.studentClass} | ${r.score}/${r.totalQuestions} | ${r.feedback.replace(/\n/g, ' ')} |\n`;
    });
    
    navigator.clipboard.writeText(markdown);
    alert("Đã sao chép bảng điểm định dạng Markdown. Bạn có thể dán trực tiếp vào Google Sheets hoặc Excel.");
  };
  const handleAskQuestion = async () => {
    if (!chatInput.trim() || documents.length === 0) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    
    setIsLoading(true);
    try {
      const combinedContent = documents.map(d => d.content).join("\n");
      const answer = await geminiService.answerQuestion(combinedContent, userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Lỗi kết nối AI." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = async () => {
    if (documents.length === 0) {
      alert("Chưa có tài liệu để tạo bài test.");
      return;
    }
    
    if (testQuestions.length === 0) {
      setIsLoading(true);
      try {
        const combinedContent = documents.map(d => d.content).join("\n");
        const questions = await geminiService.generateTest(combinedContent);
        setTestQuestions(questions);
      } catch (error) {
        alert("Lỗi khi tạo bài test.");
        return;
      } finally {
        setIsLoading(false);
      }
    }
    
    setActiveWindow(3);
    setTestSubmitted(false);
    setCurrentTestAnswers({});
  };

  const submitTest = async () => {
    if (!studentInfo.name || !studentInfo.class) {
      alert("Vui lòng nhập đầy đủ Họ tên và Lớp.");
      return;
    }

    let score = 0;
    const errors: any[] = [];
    const answers = testQuestions.map(q => {
      const selected = currentTestAnswers[q.id];
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) score++;
      else errors.push({ question: q.question, selected: q.options[selected], correct: q.options[q.correctAnswer] });
      
      return {
        questionId: q.id,
        selectedOption: selected,
        isCorrect
      };
    });

    setIsLoading(true);
    try {
      const feedback = await geminiService.generateFeedback(score, testQuestions.length, errors, studentInfo.name);
      const result: TestResult = {
        id: Math.random().toString(36).substr(2, 9),
        studentName: studentInfo.name,
        studentClass: studentInfo.class,
        score,
        totalQuestions: testQuestions.length,
        feedback,
        answers,
        timestamp: new Date()
      };
      setResults(prev => [...prev, result]);
      setLastResult(result);
      setTestSubmitted(true);
    } catch (error) {
      alert("Lỗi khi chấm điểm.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans text-[#1a1a1a] selection:bg-[#5A5A40] selection:text-white">
      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-2xl font-bold flex items-center gap-2">
                  <Lock className="w-6 h-6 text-[#5A5A40]" />
                  Giảng viên đăng nhập
                </h3>
                <button 
                  onClick={() => setShowAdminLogin(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu quản trị</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                    autoFocus
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all"
                >
                  Đăng nhập
                </button>
                <p className="text-center text-xs text-gray-400">Mật khẩu mặc định là 'admin'</p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!role ? (
          <motion.div 
            key="role-selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center">
              <div className="w-20 h-20 bg-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="text-white w-10 h-10" />
              </div>
              <h1 className="font-serif text-3xl font-bold text-[#1a1a1a] mb-2">Gia sư Tin học</h1>
              <p className="text-gray-500 mb-8">Vui lòng chọn vai trò của bạn để bắt đầu</p>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setShowAdminLogin(true)}
                  className="w-full flex items-center justify-between p-4 border-2 border-[#5A5A40] rounded-2xl hover:bg-[#5A5A40] hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <UserCircle className="w-6 h-6" />
                    <span className="font-semibold">Giảng viên</span>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                
                <button 
                  onClick={() => setRole('STUDENT')}
                  className="w-full flex items-center justify-between p-4 border-2 border-[#5A5A40] rounded-2xl hover:bg-[#5A5A40] hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-6 h-6" />
                    <span className="font-semibold">Sinh viên</span>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="app-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col"
          >
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setRole(null)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            {role === 'LECTURER' ? <UserCircle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            {role === 'LECTURER' ? 'Quản trị Giảng viên' : 'Học tập Sinh viên'}
          </h2>
        </div>
        
        <div className="flex gap-2">
          {role === 'STUDENT' && (
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-[#5A5A40]"
              title="Giảng viên đăng nhập"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          {role === 'LECTURER' ? (
            <button 
              onClick={() => setActiveWindow(1)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeWindow === 1 ? "bg-[#5A5A40] text-white" : "hover:bg-gray-100"
              )}
            >
              Tài liệu & Điểm
            </button>
          ) : (
            <>
              <button 
                onClick={() => setActiveWindow(2)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeWindow === 2 ? "bg-[#5A5A40] text-white" : "hover:bg-gray-100"
                )}
              >
                Bài giảng
              </button>
              <button 
                onClick={() => setActiveWindow(3)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeWindow === 3 ? "bg-[#5A5A40] text-white" : "hover:bg-gray-100"
                )}
              >
                Kiểm tra
              </button>
            </>
          )}
          {role === 'LECTURER' && (
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-500"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 flex-1">
        <AnimatePresence mode="wait">
          {/* WINDOW 1: LECTURER ADMIN */}
          {activeWindow === 1 && role === 'LECTURER' && (
            <motion.div 
              key="window1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                  <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-[#5A5A40]" />
                    Tải tài liệu
                  </h3>
                  <p className="text-gray-500 mb-6">Hỗ trợ PDF, DOCX, TXT. Bạn có thể chọn nhiều file cùng lúc.</p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".txt,.pdf,.docx"
                    multiple
                  />
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full py-12 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[#5A5A40] hover:bg-[#F5F5F0] transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-10 h-10 animate-spin text-[#5A5A40]" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-[#F5F5F0] rounded-full flex items-center justify-center">
                          <Files className="w-6 h-6 text-[#5A5A40]" />
                        </div>
                        <span className="font-medium">Nhấn để chọn file (PDF, DOCX, TXT)</span>
                      </>
                    )}
                  </button>
                  
                  {documents.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase">Tài liệu đã tải ({documents.length})</p>
                      <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2">
                        {documents.map(doc => (
                          <div key={doc.id} className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <p className="text-xs font-semibold text-green-800 truncate">{doc.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Management Section */}
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                  <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#5A5A40]" />
                    Cấu hình Hệ thống
                  </h3>
                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Google Drive File ID (Persistent Memory)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={globalFileId}
                          onChange={(e) => setGlobalFileId(e.target.value)}
                          placeholder="Nhập File ID..."
                          className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40] text-sm"
                        />
                        <button 
                          onClick={() => updateGlobalFileId(globalFileId)}
                          className="px-4 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4A4A30] transition-colors"
                        >
                          Lưu
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">ID này sẽ được dùng để tải bài giảng tự động cho mọi sinh viên.</p>
                    </div>
                  </div>

                  <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2">
                    <Table className="w-6 h-6 text-[#5A5A40]" />
                    Quản lý kết quả
                  </h3>
                  <p className="text-gray-500 mb-6">Theo dõi tiến độ và xuất dữ liệu sinh viên sang Google Sheets.</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={exportToCSV}
                      className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all"
                    >
                      <Download className="w-5 h-5" />
                      Xuất sang Google Sheets (CSV)
                    </button>
                    
                    <button 
                      onClick={copyGradesToClipboard}
                      className="w-full py-4 border-2 border-[#5A5A40] text-[#5A5A40] rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#F5F5F0] transition-all"
                    >
                      <Files className="w-5 h-5" />
                      Sao chép bảng điểm (Markdown)
                    </button>
                  </div>

                  <div className="mt-8">
                    <h4 className="font-semibold text-sm uppercase tracking-wider text-gray-400 mb-4">Kết quả gần đây</h4>
                    {results.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 italic">Chưa có sinh viên nào làm bài</p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {results.map(r => (
                          <div key={r.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="font-medium">{r.studentName}</p>
                              <p className="text-xs text-gray-500">{r.studentClass}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#5A5A40]">{r.score}/{r.totalQuestions}</p>
                              <p className="text-[10px] text-gray-400">{new Date(r.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* WINDOW 2: STUDENT LEARNING */}
          {activeWindow === 2 && (
            <motion.div 
              key="window2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Lecture Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Greeting & Summary Banner */}
                {greeting && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#5A5A40] text-white p-8 rounded-[32px] shadow-lg relative overflow-hidden"
                  >
                    <div className="relative z-10">
                      <h2 className="font-serif text-2xl font-bold mb-2">{greeting}</h2>
                      <p className="text-white/80 text-sm leading-relaxed max-w-2xl">
                        <strong>Tóm tắt bài giảng:</strong> {summary}
                      </p>
                    </div>
                    <div className="absolute -right-10 -bottom-10 opacity-10">
                      <GraduationCap size={200} />
                    </div>
                  </motion.div>
                )}

                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 min-h-[600px]">
                  {!currentLecture ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                      <BookOpen className="w-16 h-16 text-gray-200 mb-4" />
                      <h3 className="text-xl font-bold text-gray-400">Chưa có bài giảng</h3>
                      <p className="text-gray-400">Giảng viên cần tải tài liệu lên trước.</p>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none">
                      <h1 className="font-serif text-3xl font-bold text-[#1a1a1a] border-b pb-4 mb-6">
                        {currentLecture.title}
                      </h1>
                      
                      <section className="mb-8">
                        <h3 className="text-[#5A5A40] font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Mục tiêu bài học
                        </h3>
                        <ul className="list-disc pl-5 mt-2">
                          {currentLecture.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                        </ul>
                      </section>

                      <section className="mb-8">
                        <h3 className="text-[#5A5A40] font-bold">Nội dung chính</h3>
                        <div className="mt-2 text-gray-700 leading-relaxed">
                          <ReactMarkdown>{currentLecture.mainContent}</ReactMarkdown>
                        </div>
                      </section>

                      <section className="mb-8 p-6 bg-[#F5F5F0] rounded-2xl border-l-4 border-[#5A5A40]">
                        <h3 className="text-[#5A5A40] font-bold mb-3">Ví dụ minh họa</h3>
                        <div className="space-y-4">
                          {currentLecture.examples.map((ex, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl shadow-sm italic text-sm">
                              {ex}
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h3 className="text-[#5A5A40] font-bold">Kết luận</h3>
                        <p className="mt-2 text-gray-600 italic">{currentLecture.conclusion}</p>
                      </section>

                      <div className="mt-12 pt-8 border-t flex justify-center">
                        <button 
                          onClick={startTest}
                          className="px-8 py-4 bg-[#5A5A40] text-white rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                        >
                          Làm bài kiểm tra ngay <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Assistant Chat */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 flex flex-col h-[600px] sticky top-24">
                  <div className="p-6 border-b flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center">
                      <GraduationCap className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold">Trợ lý Gia sư</h4>
                      <p className="text-[10px] text-green-500 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Đang trực tuyến
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        Hãy đặt câu hỏi về bài học này. Tôi sẽ giải đáp dựa trên tài liệu.
                      </div>
                    )}
                    {chatHistory.map((chat, i) => (
                      <div key={i} className={cn(
                        "max-w-[85%] p-4 rounded-2xl text-sm",
                        chat.role === 'user' 
                          ? "bg-gray-100 ml-auto rounded-tr-none" 
                          : "bg-[#F5F5F0] mr-auto rounded-tl-none border border-[#5A5A40]/10"
                      )}>
                        {chat.text}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="bg-[#F5F5F0] mr-auto p-4 rounded-2xl rounded-tl-none border border-[#5A5A40]/10">
                        <Loader2 className="w-4 h-4 animate-spin text-[#5A5A40]" />
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                        placeholder="Hỏi về bài học..."
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-all"
                      />
                      <button 
                        onClick={handleAskQuestion}
                        disabled={isLoading || !chatInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* WINDOW 3: TEST WINDOW */}
          {activeWindow === 3 && (
            <motion.div 
              key="window3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-3xl mx-auto"
            >
              {!testSubmitted ? (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-serif text-2xl font-bold">Bài kiểm tra đánh giá</h3>
                    <div className="px-4 py-1 bg-[#F5F5F0] rounded-full text-xs font-bold text-[#5A5A40]">
                      {testQuestions.length} Câu hỏi
                    </div>
                  </div>

                  {/* Student Info Form */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Họ và Tên</label>
                      <input 
                        type="text" 
                        value={studentInfo.name}
                        onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                        placeholder="Nguyễn Văn A"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Lớp</label>
                      <input 
                        type="text" 
                        value={studentInfo.class}
                        onChange={(e) => setStudentInfo({ ...studentInfo, class: e.target.value })}
                        placeholder="CNTT K20"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="space-y-10">
                    {testQuestions.map((q, idx) => (
                      <div key={q.id} className="space-y-4">
                        <p className="font-bold text-lg">
                          <span className="text-[#5A5A40] mr-2">Câu {idx + 1}:</span>
                          {q.question}
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          {q.options.map((opt, optIdx) => (
                            <button 
                              key={optIdx}
                              onClick={() => setCurrentTestAnswers({ ...currentTestAnswers, [q.id]: optIdx })}
                              className={cn(
                                "p-4 text-left rounded-2xl border-2 transition-all",
                                currentTestAnswers[q.id] === optIdx 
                                  ? "border-[#5A5A40] bg-[#F5F5F0] font-semibold" 
                                  : "border-gray-100 hover:border-gray-200"
                              )}
                            >
                              <span className="inline-block w-8 h-8 rounded-full bg-gray-100 text-center leading-8 mr-3 text-xs font-bold">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 pt-8 border-t">
                    <button 
                      onClick={submitTest}
                      disabled={isLoading || Object.keys(currentTestAnswers).length < testQuestions.length}
                      className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold text-lg hover:bg-[#4A4A30] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Nộp bài và xem kết quả'}
                    </button>
                    {Object.keys(currentTestAnswers).length < testQuestions.length && (
                      <p className="text-center text-xs text-red-400 mt-2">Vui lòng hoàn thành tất cả các câu hỏi.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Result Header */}
                  <div className="bg-white p-10 rounded-[32px] shadow-sm border border-gray-100 text-center">
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
                      (lastResult?.score || 0) >= (lastResult?.totalQuestions || 0) / 2 ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                    )}>
                      <span className="text-4xl font-bold">{lastResult?.score}/{lastResult?.totalQuestions}</span>
                    </div>
                    <h3 className="font-serif text-3xl font-bold mb-2">Kết quả của {lastResult?.studentName}</h3>
                    <p className="text-gray-500 mb-8">Lớp: {lastResult?.studentClass}</p>
                    
                    <div className="p-6 bg-[#F5F5F0] rounded-2xl text-left border-l-4 border-[#5A5A40]">
                      <h4 className="font-bold text-[#5A5A40] mb-2">Nhận xét từ Gia sư:</h4>
                      <p className="text-gray-700 italic leading-relaxed">{lastResult?.feedback}</p>
                    </div>
                  </div>

                  {/* Detailed Answers */}
                  <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                    <h4 className="font-serif text-xl font-bold mb-6">Đáp án chi tiết</h4>
                    <div className="space-y-8">
                      {testQuestions.map((q, idx) => {
                        const userAns = lastResult?.answers.find(a => a.questionId === q.id);
                        return (
                          <div key={q.id} className="p-6 rounded-2xl border border-gray-100">
                            <div className="flex items-start justify-between mb-4">
                              <p className="font-bold">Câu {idx + 1}: {q.question}</p>
                              {userAns?.isCorrect ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                              )}
                            </div>
                            
                            <div className="space-y-2 mb-4">
                              <p className={cn(
                                "text-sm p-3 rounded-xl",
                                userAns?.isCorrect ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                              )}>
                                <strong>Lựa chọn của bạn:</strong> {q.options[userAns?.selectedOption || 0]}
                              </p>
                              {!userAns?.isCorrect && (
                                <p className="text-sm p-3 rounded-xl bg-green-50 text-green-800">
                                  <strong>Đáp án đúng:</strong> {q.options[q.correctAnswer]}
                                </p>
                              )}
                            </div>

                            <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-600 leading-relaxed">
                              <strong>Giải thích:</strong> {q.explanation}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-8 flex gap-4">
                      <button 
                        onClick={() => setActiveWindow(2)}
                        className="flex-1 py-4 border-2 border-[#5A5A40] text-[#5A5A40] rounded-2xl font-bold hover:bg-[#5A5A40] hover:text-white transition-all"
                      >
                        Quay lại bài học
                      </button>
                      <button 
                        onClick={() => {
                          setTestSubmitted(false);
                          setCurrentTestAnswers({});
                          setActiveWindow(3);
                        }}
                        className="flex-1 py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all"
                      >
                        Làm lại bài test
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="max-w-5xl mx-auto p-12 text-center text-gray-400 text-xs">
            <p>© 2026 Trợ lý Gia sư Tin học Thông minh. Hệ thống hỗ trợ giảng dạy AI.</p>
          </footer>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
