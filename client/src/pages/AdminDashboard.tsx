import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, FileUp, Database, Trash2, LogOut, FileText, CheckCircle, HelpCircle, Eye, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';

interface Question {
  id: string;
  title: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  createdAt: string;
}

interface PreviewQuestion {
  title: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
}

interface StudentRecord {
  id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year: string;
  semester: string;
  email: string;
  examName: string;
  loginTime: string;
  examStartTime?: string;
  submissionTime?: string;
  timerExpiryTime?: string;
  terminationReason?: string;
  status: string;
  submissionStatus: string;
  warningCount: number;
  marksObtained: number;
  totalMarks: number;
  finalResult: string;
  createdAt: string;
  questions: string[];
  codeSubmissions?: {
    questionId: string;
    title: string;
    problemStatement: string;
    submittedCode: string;
    draftCode: string;
    marks: number;
  }[];
}

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'pdf' | 'bank' | 'students' | 'eligible'>('manual');
  
  // Question Bank State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Student List State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Eligible roster state
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [uploadMessage, setUploadMessage] = useState<{ type: string; text: string } | null>(null);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [examFilter, setExamFilter] = useState<string>('All');

  // Manual Form State
  const [manualForm, setManualForm] = useState<PreviewQuestion>({
    title: '',
    problemStatement: '',
    inputFormat: '',
    outputFormat: '',
    sampleInput: '',
    sampleOutput: ''
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // PDF Upload State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Axios Configuration with JWT Auth
  const apiConfig = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const fetchQuestions = async () => {
    setBankLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/admin/questions', apiConfig);
      setQuestions(response.data);
    } catch (err: any) {
      console.error('Error fetching questions:', err);
    } finally {
      setBankLoading(false);
    }
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/admin/students', apiConfig);
      setStudents(response.data);
    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchEligibleStudents = async () => {
    setEligibleLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/admin/eligible-students', apiConfig);
      setEligibleStudents(response.data);
    } catch (err: any) {
      console.error('Error fetching eligible roster:', err);
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleBulkUploadEligible = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMessage(null);
    if (!bulkInput.trim()) return;

    const lines = bulkInput.split('\n');
    const parsedStudents: any[] = [];

    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length > 0 && parts[0].trim()) {
        parsedStudents.push({
          rollNumber: parts[0].trim(),
          name: parts[1]?.trim() || `Student ${parts[0].trim()}`,
          branch: parts[2]?.trim() || 'CSE',
          year: parts[3]?.trim() || 'III Year',
          semester: parts[4]?.trim() || 'I Semester',
          email: parts[5]?.trim() || `student.${parts[0].trim().toLowerCase()}@example.com`
        });
      }
    });

    if (parsedStudents.length === 0) {
      setUploadMessage({ type: 'danger', text: 'No valid roll numbers parsed.' });
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/admin/upload-eligible-students', { students: parsedStudents }, apiConfig);
      setUploadMessage({ type: 'success', text: `Successfully registered ${parsedStudents.length} eligible students!` });
      setBulkInput('');
      fetchEligibleStudents();
    } catch (err: any) {
      console.error(err);
      setUploadMessage({ type: 'danger', text: err.response?.data?.error || 'Bulk upload failed.' });
    }
  };

  const handleDeleteEligible = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this student from the eligible roster?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/eligible-students/${id}`, apiConfig);
      setEligibleStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Delete eligible student error:', err);
    }
  };

  const handleExportCsv = (filteredStudentsList: StudentRecord[]) => {
    if (filteredStudentsList.length === 0) {
      alert('No student records to export.');
      return;
    }

    // CSV Headers
    const headers = ['Roll Number', 'Name', 'Branch', 'Year', 'Semester', 'Email ID', 'Registration Date', 'Assigned Questions'];
    
    // Format rows
    const rows = filteredStudentsList.map(s => [
      s.rollNumber,
      `"${s.name.replace(/"/g, '""')}"`,
      s.branch,
      s.year,
      s.semester,
      s.email,
      new Date(s.createdAt).toLocaleDateString(),
      `"${s.questions.join(', ').replace(/"/g, '""')}"`
    ]);

    // Construct CSV text
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Create download element
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const filename = `students_list_${branchFilter === 'All' ? 'overall' : branchFilter.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this student registration? This will clear their session and assignments.')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/admin/students/${id}`, apiConfig);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete student registration details.');
    }
  };

  const handleStatusOverride = async (studentId: string, newStatus: string) => {
    try {
      await axios.post(`http://localhost:5000/api/admin/students/${studentId}/status`, { status: newStatus }, apiConfig);
      // Local state is updated via socket connection automatically
    } catch (err: any) {
      console.error(err);
      alert('Failed to override student status.');
    }
  };

  const handleWarningOverride = async (studentId: string, currentWarnings: number) => {
    const confirmWarning = window.confirm('Are you sure you want to log a warning for this student? Reaching 3 warnings disqualifies them.');
    if (!confirmWarning) return;
    
    try {
      await axios.post(`http://localhost:5000/api/admin/students/${studentId}/warning`, { warningCount: currentWarnings + 1 }, apiConfig);
    } catch (err: any) {
      console.error(err);
      alert('Failed to increment warnings.');
    }
  };

  const handleExportPdf = (filteredStudentsList: StudentRecord[]) => {
    if (filteredStudentsList.length === 0) {
      alert('No student records to export.');
      return;
    }

    const doc = new jsPDF();
    
    // Set Document Properties
    doc.setFontSize(16);
    doc.text(`Registered Students List - ${branchFilter === 'All' ? 'Overall' : branchFilter}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);
    doc.text(`Total Registered Count: ${filteredStudentsList.length}`, 14, 26);

    const headers = [['Roll Number', 'Student Name', 'Branch', 'Year & Sem', 'Email ID']];
    const rows = filteredStudentsList.map(s => [
      s.rollNumber,
      s.name,
      s.branch,
      `${s.year} - ${s.semester}`,
      s.email
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 32,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    const filename = `students_list_${branchFilter === 'All' ? 'overall' : branchFilter.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const handleExportExcel = (filteredStudentsList: StudentRecord[]) => {
    if (filteredStudentsList.length === 0) {
      alert('No student records to export.');
      return;
    }

    const data = filteredStudentsList.map((s, idx) => ({
      'S.No': idx + 1,
      'Student Name': s.name,
      'Roll Number': s.rollNumber,
      'Branch': s.branch,
      'Year': s.year,
      'Semester': s.semester,
      'Email ID': s.email,
      'Exam Name': s.examName,
      'Registration Date': new Date(s.createdAt).toLocaleDateString(),
      'Login Time': new Date(s.loginTime).toLocaleTimeString(),
      'Current Status': s.status,
      'Warning Count': s.warningCount,
      'Marks Obtained': s.marksObtained,
      'Final Result': s.finalResult
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Roster');

    const max_widths = [
      { wch: 6 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
      { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, 
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, 
      { wch: 12 }, { wch: 12 }
    ];
    worksheet['!cols'] = max_widths;

    const filename = `students_list_${branchFilter === 'All' ? 'overall' : branchFilter.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleExportIndividualReport = (student: StudentRecord) => {
    const doc = new jsPDF();
    
    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // Navy Slate
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(22);
    doc.text('PROGRAMMING QUESTION PORTAL', 14, 20);
    doc.setFontSize(11);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('Official Examination Assessment Report', 14, 28);
    
    // 2. Demographics Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('Outfit', 'bold');
    doc.text('Student Particulars', 14, 52);
    
    const detailsLeft = [
      ['Student Name:', student.name],
      ['Roll Number:', student.rollNumber],
      ['Branch:', student.branch],
      ['Year & Semester:', `${student.year} - ${student.semester}`],
      ['Email ID:', student.email]
    ];
    
    const detailsRight = [
      ['Exam Name:', student.examName],
      ['Registration Date:', new Date(student.createdAt).toLocaleDateString()],
      ['Login Time:', new Date(student.loginTime).toLocaleTimeString()],
      ['Start Time:', student.examStartTime ? new Date(student.examStartTime).toLocaleTimeString() : 'N/A'],
      ['Submission Time:', student.submissionTime ? new Date(student.submissionTime).toLocaleTimeString() : 'N/A']
    ];
    if (student.terminationReason) {
      detailsRight.push(['Terminated By:', student.terminationReason]);
    }

    autoTable(doc, {
      body: detailsLeft,
      startY: 57,
      margin: { left: 14 },
      tableWidth: 88,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
    });

    autoTable(doc, {
      body: detailsRight,
      startY: 57,
      margin: { left: 108 },
      tableWidth: 88,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
    });

    // 3. Performance Summary
    const yPerf = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.setFont('Outfit', 'bold');
    doc.text('Performance Summary', 14, yPerf);

    const perfHeaders = [['Total Marks', 'Marks Obtained', 'Warning Count', 'Status', 'Result']];
    const perfRows = [[
      student.totalMarks,
      student.marksObtained,
      student.warningCount,
      student.status,
      student.finalResult
    ]];

    autoTable(doc, {
      head: perfHeaders,
      body: perfRows,
      startY: yPerf + 4,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10, halign: 'center' },
      columnStyles: { 3: { fontStyle: 'bold' }, 4: { fontStyle: 'bold' } }
    });

    // 4. Code Submissions
    let currentY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.setFont('Outfit', 'bold');
    doc.text('Python Question & Code Submissions', 14, currentY);
    currentY += 6;

    if (!student.codeSubmissions || student.codeSubmissions.length === 0) {
      doc.setFontSize(10);
      doc.setFont('Inter', 'italic');
      doc.text('No coding assignments or answers were recorded.', 14, currentY);
    } else {
      student.codeSubmissions.forEach((q, idx) => {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('Outfit', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text(`Question ${idx + 1}: ${q.title} (Marks: ${q.marks}/20)`, 14, currentY);
        currentY += 5;

        doc.setFontSize(9);
        doc.setFont('Inter', 'normal');
        doc.setTextColor(100, 100, 100);
        const splitProblem = doc.splitTextToSize(q.problemStatement, 182);
        doc.text(splitProblem, 14, currentY);
        currentY += (splitProblem.length * 4.5) + 3;

        doc.setFontSize(8.5);
        doc.setFont('Fira Code', 'normal');
        doc.setTextColor(15, 23, 42);
        const codeText = q.submittedCode && q.submittedCode.trim() ? q.submittedCode : '# No code submitted for this question.';
        const splitCode = doc.splitTextToSize(codeText, 174);
        const boxHeight = (splitCode.length * 4) + 6;

        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY, 182, boxHeight, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, currentY, 182, boxHeight, 'S');

        doc.text(splitCode, 18, currentY + 5);
        currentY += boxHeight + 8;
      });
    }

    const reportFilename = `student_report_${student.rollNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(reportFilename);
  };

  // Real-time WebSocket synchronization for Student Portal Updates
  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('student_update', (updatedStudent: StudentRecord) => {
      setStudents(prev => {
        const idx = prev.findIndex(s => s.id === updatedStudent.id);
        if (idx !== -1) {
          const list = [...prev];
          list[idx] = updatedStudent;
          return list;
        } else {
          return [updatedStudent, ...prev];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'bank') {
      fetchQuestions();
    } else if (activeTab === 'students') {
      fetchStudents();
    } else if (activeTab === 'eligible') {
      fetchEligibleStudents();
    }
  }, [activeTab]);

  // Handle Manual Form Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualMessage(null);

    if (!manualForm.title.trim() || !manualForm.problemStatement.trim()) {
      setManualMessage({ type: 'danger', text: 'Question Title and Problem Statement are required' });
      return;
    }

    setManualSaving(true);
    try {
      await axios.post('http://localhost:5000/api/admin/manual-question', manualForm, apiConfig);
      setManualMessage({ type: 'success', text: 'Question added to the Question Bank successfully!' });
      setManualForm({
        title: '',
        problemStatement: '',
        inputFormat: '',
        outputFormat: '',
        sampleInput: '',
        sampleOutput: ''
      });
    } catch (err: any) {
      console.error(err);
      setManualMessage({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to add manual question.'
      });
    } finally {
      setManualSaving(false);
    }
  };

  // Handle PDF Parsing Upload
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setPdfError(null);
    setBulkMessage(null);
    setPreviewQuestions([]);

    if (!pdfFile) {
      setPdfError('Please choose a PDF file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', pdfFile);

    setPdfParsing(true);
    try {
      const response = await axios.post('http://localhost:5000/api/admin/upload-pdf', formData, {
        headers: {
          ...apiConfig.headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      setPreviewQuestions(response.data.questions);
      setBulkMessage({ type: 'success', text: response.data.message });
    } catch (err: any) {
      console.error(err);
      setPdfError(err.response?.data?.error || 'Failed to parse and extract questions from PDF.');
    } finally {
      setPdfParsing(false);
    }
  };

  // Handle Editing of PDF Extracted Question fields before saving
  const handlePreviewChange = (index: number, field: keyof PreviewQuestion, value: string) => {
    setPreviewQuestions(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  // Remove a question from preview list
  const removePreviewItem = (index: number) => {
    setPreviewQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save parsed preview questions to backend
  const handleSaveBulk = async () => {
    setBulkMessage(null);
    if (previewQuestions.length === 0) return;

    setBulkSaving(true);
    try {
      const response = await axios.post('http://localhost:5000/api/admin/save-bulk-questions', {
        questions: previewQuestions
      }, apiConfig);
      
      setBulkMessage({ type: 'success', text: response.data.message });
      setPreviewQuestions([]);
      setPdfFile(null);
    } catch (err: any) {
      console.error(err);
      setBulkMessage({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to save extracted questions.'
      });
    } finally {
      setBulkSaving(false);
    }
  };

  // Delete question from bank
  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question? This action is irreversible.')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/admin/questions/${id}`, apiConfig);
      setQuestions(prev => prev.filter(q => q.id !== id));
      if (selectedQuestion?.id === id) {
        setSelectedQuestion(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete question. It might be assigned to students.');
    }
  };

  return (
    <div className="min-vh-100 bg-gradient-soft">
      {/* Top Navbar */}
      <header className="navbar navbar-expand-lg bg-gradient-header shadow-md sticky-top py-3">
        <div className="container-fluid px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2 text-white">
            <Database className="text-primary" size={26} />
            <span className="h4 mb-0 fw-bold font-heading text-white">Admin Dashboard</span>
          </div>
          
          <button
            onClick={onLogout}
            className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 rounded-pill px-3 py-1.5"
            style={{ fontSize: '0.85rem' }}
          >
            <LogOut size={14} /> Exit Dashboard
          </button>
        </div>
      </header>

      {/* Main Admin Work Area */}
      <div className="container py-4">
        {/* Navigation Tabs */}
        <div className="d-flex border-bottom mb-4 justify-content-start gap-2 bg-white p-2 rounded-3 shadow-sm">
          <button
            onClick={() => setActiveTab('manual')}
            className={`btn d-flex align-items-center gap-2 px-3 py-2 border-0 rounded-2 fw-semibold ${activeTab === 'manual' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
          >
            <PlusCircle size={18} /> Manual Entry
          </button>
          
          <button
            onClick={() => setActiveTab('pdf')}
            className={`btn d-flex align-items-center gap-2 px-3 py-2 border-0 rounded-2 fw-semibold ${activeTab === 'pdf' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
          >
            <FileUp size={18} /> PDF Upload & Splitter
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`btn d-flex align-items-center gap-2 px-3 py-2 border-0 rounded-2 fw-semibold ${activeTab === 'bank' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
          >
            <Database size={18} /> Question Bank ({questions.length || 'View'})
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`btn d-flex align-items-center gap-2 px-3 py-2 border-0 rounded-2 fw-semibold ${activeTab === 'students' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
          >
            <Users size={18} /> Registered Students ({students.length || 'View'})
          </button>

          <button
            onClick={() => setActiveTab('eligible')}
            className={`btn d-flex align-items-center gap-2 px-3 py-2 border-0 rounded-2 fw-semibold ${activeTab === 'eligible' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
          >
            <Users size={18} /> Eligible Roster ({eligibleStudents.length})
          </button>
        </div>

        {/* Tab 1: Manual Entry */}
        {activeTab === 'manual' && (
          <div className="portal-card p-4 p-md-5 animate-fade-in">
            <h4 className="fw-bold mb-4 font-heading d-flex align-items-center gap-2">
              <PlusCircle className="text-primary" /> Create Coding Question Manually
            </h4>

            {manualMessage && (
              <div className={`alert alert-${manualMessage.type} border-0 rounded-3 shadow-sm mb-4`}>
                {manualMessage.text}
              </div>
            )}

            <form onSubmit={handleManualSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="label-title">Question Title</label>
                  <input
                    type="text"
                    value={manualForm.title}
                    onChange={(e) => setManualForm(prev => ({ ...prev, title: e.target.value }))}
                    className="form-control"
                    placeholder="e.g. Reverse a string, Palindrome check"
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="label-title">Problem Statement</label>
                  <textarea
                    value={manualForm.problemStatement}
                    onChange={(e) => setManualForm(prev => ({ ...prev, problemStatement: e.target.value }))}
                    className="form-control"
                    rows={4}
                    placeholder="Describe the problem, logic required, constraints, and instructions..."
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="label-title">Input Format</label>
                  <textarea
                    value={manualForm.inputFormat}
                    onChange={(e) => setManualForm(prev => ({ ...prev, inputFormat: e.target.value }))}
                    className="form-control"
                    rows={3}
                    placeholder="Specify the inputs S or N..."
                  />
                </div>

                <div className="col-md-6">
                  <label className="label-title">Output Format</label>
                  <textarea
                    value={manualForm.outputFormat}
                    onChange={(e) => setManualForm(prev => ({ ...prev, outputFormat: e.target.value }))}
                    className="form-control"
                    rows={3}
                    placeholder="Describe print details or returned formats..."
                  />
                </div>

                <div className="col-md-6">
                  <label className="label-title">Sample Input</label>
                  <textarea
                    value={manualForm.sampleInput}
                    onChange={(e) => setManualForm(prev => ({ ...prev, sampleInput: e.target.value }))}
                    className="form-control code-input-field"
                    style={{ fontFamily: 'monospace' }}
                    rows={3}
                    placeholder="e.g. 5"
                  />
                </div>

                <div className="col-md-6">
                  <label className="label-title">Sample Output</label>
                  <textarea
                    value={manualForm.sampleOutput}
                    onChange={(e) => setManualForm(prev => ({ ...prev, sampleOutput: e.target.value }))}
                    className="form-control code-input-field"
                    style={{ fontFamily: 'monospace' }}
                    rows={3}
                    placeholder="e.g. 1 2 Fizz 4 Buzz"
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-top text-end">
                <button
                  type="submit"
                  className="btn btn-portal-primary px-4 py-2"
                  disabled={manualSaving}
                >
                  {manualSaving ? 'Saving...' : 'Add to Question Bank'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: PDF Upload & Splitter */}
        {activeTab === 'pdf' && (
          <div className="animate-fade-in">
            {/* Upload File Card */}
            <div className="portal-card p-4 mb-4">
              <h4 className="fw-bold mb-3 font-heading d-flex align-items-center gap-2">
                <FileUp className="text-primary" /> Auto Extract Questions from PDF
              </h4>
              <p className="text-muted small">
                Upload a PDF file containing coding exercises. Our system splits them into individual titles, problem statements, formats, and sample examples.
              </p>

              {pdfError && (
                <div className="alert alert-danger border-0 rounded-3 mb-3">{pdfError}</div>
              )}

              {bulkMessage && (
                <div className={`alert alert-${bulkMessage.type} border-0 rounded-3 mb-3`}>{bulkMessage.text}</div>
              )}

              <form onSubmit={handlePdfUpload} className="d-flex flex-column flex-sm-row gap-3 align-items-sm-end">
                <div className="flex-grow-1">
                  <label className="label-title">Choose PDF File</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="form-control"
                    disabled={pdfParsing}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-portal-primary py-2.5 px-4 d-flex align-items-center gap-2 justify-content-center"
                  disabled={pdfParsing || !pdfFile}
                >
                  {pdfParsing ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Parsing...
                    </>
                  ) : (
                    <>
                      <FileText size={18} /> Parse PDF Sheet
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* PREVIEW PANEL - Edit Split items before save */}
            {previewQuestions.length > 0 && (
              <div className="portal-card p-4">
                <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                  <div>
                    <h5 className="fw-bold mb-0">PDF Splitter Preview</h5>
                    <p className="text-muted small mb-0">We extracted {previewQuestions.length} questions. Correct and refine them below before saving.</p>
                  </div>
                  <button
                    onClick={handleSaveBulk}
                    className="btn btn-success d-flex align-items-center gap-2 px-4 py-2 shadow-sm"
                    disabled={bulkSaving}
                  >
                    <CheckCircle size={18} /> Save {previewQuestions.length} Questions to DB
                  </button>
                </div>

                <div className="d-flex flex-column gap-4">
                  {previewQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 border rounded-3 bg-light position-relative">
                      <button
                        type="button"
                        onClick={() => removePreviewItem(idx)}
                        className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-3 d-flex align-items-center gap-1"
                        title="Remove question from upload"
                      >
                        <Trash2 size={14} /> Remove
                      </button>

                      <div className="h6 fw-bold text-primary mb-3">Proposed Question #{idx + 1}</div>

                      <div className="row g-3">
                        <div className="col-12 col-md-10">
                          <label className="label-title">Question Title</label>
                          <input
                            type="text"
                            value={q.title}
                            onChange={(e) => handlePreviewChange(idx, 'title', e.target.value)}
                            className="form-control bg-white"
                          />
                        </div>

                        <div className="col-12">
                          <label className="label-title">Problem Statement</label>
                          <textarea
                            value={q.problemStatement}
                            onChange={(e) => handlePreviewChange(idx, 'problemStatement', e.target.value)}
                            className="form-control bg-white"
                            rows={3}
                          />
                        </div>

                        <div className="col-md-6">
                          <label className="label-title">Input Format</label>
                          <textarea
                            value={q.inputFormat}
                            onChange={(e) => handlePreviewChange(idx, 'inputFormat', e.target.value)}
                            className="form-control bg-white"
                            rows={2}
                          />
                        </div>

                        <div className="col-md-6">
                          <label className="label-title">Output Format</label>
                          <textarea
                            value={q.outputFormat}
                            onChange={(e) => handlePreviewChange(idx, 'outputFormat', e.target.value)}
                            className="form-control bg-white"
                            rows={2}
                          />
                        </div>

                        <div className="col-md-6">
                          <label className="label-title">Sample Input</label>
                          <textarea
                            value={q.sampleInput}
                            onChange={(e) => handlePreviewChange(idx, 'sampleInput', e.target.value)}
                            className="form-control bg-white"
                            style={{ fontFamily: 'monospace' }}
                            rows={2}
                          />
                        </div>

                        <div className="col-md-6">
                          <label className="label-title">Sample Output</label>
                          <textarea
                            value={q.sampleOutput}
                            onChange={(e) => handlePreviewChange(idx, 'sampleOutput', e.target.value)}
                            className="form-control bg-white"
                            style={{ fontFamily: 'monospace' }}
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-top text-end">
                  <button
                    onClick={handleSaveBulk}
                    className="btn btn-success px-4 py-2.5 shadow-sm"
                    disabled={bulkSaving}
                  >
                    {bulkSaving ? 'Saving questions...' : `Save ${previewQuestions.length} Questions to DB`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Question Bank List */}
        {activeTab === 'bank' && (
          <div className="row g-4 animate-fade-in">
            <div className="col-lg-7">
              <div className="portal-card p-4">
                <h4 className="fw-bold mb-4 font-heading d-flex align-items-center gap-2">
                  <Database className="text-primary" /> Current Question Bank
                </h4>

                {bankLoading ? (
                  <div className="text-center py-5">
                    <span className="spinner-border text-primary" role="status"></span>
                    <p className="mt-2 text-muted">Retrieving questions...</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <HelpCircle size={48} className="mb-2 opacity-50" />
                    <p>No questions found in database. Create manually or upload a PDF to seed.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table admin-table align-middle">
                      <thead>
                        <tr>
                          <th scope="col" className="ps-3 py-2.5" style={{ width: '60%' }}>Title</th>
                          <th scope="col" className="text-end pe-3 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q) => (
                          <tr key={q.id}>
                            <td className="ps-3 fw-semibold text-truncate" style={{ maxWidth: '280px' }}>{q.title}</td>
                            <td className="text-end pe-3">
                              <button
                                onClick={() => setSelectedQuestion(q)}
                                className="btn btn-sm btn-outline-primary me-2 d-inline-flex align-items-center gap-1"
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Selected Question Details */}
            <div className="col-lg-5">
              <div className="portal-card p-4 sticky-top" style={{ top: '90px' }}>
                <h5 className="fw-bold pb-2 border-bottom mb-3 text-secondary font-heading">Question Detail Card</h5>
                
                {selectedQuestion ? (
                  <div>
                    <h4 className="fw-bold text-primary mb-3 font-heading">{selectedQuestion.title}</h4>
                    
                    <div className="mb-3">
                      <label className="label-title">Problem Statement</label>
                      <p className="small text-dark" style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                        {selectedQuestion.problemStatement}
                      </p>
                    </div>

                    <div className="row g-2 mb-3">
                      {selectedQuestion.inputFormat && (
                        <div className="col-6">
                          <label className="label-title">Input Format</label>
                          <div className="p-2 bg-light border rounded small" style={{ whiteSpace: 'pre-line' }}>{selectedQuestion.inputFormat}</div>
                        </div>
                      )}
                      {selectedQuestion.outputFormat && (
                        <div className="col-6">
                          <label className="label-title">Output Format</label>
                          <div className="p-2 bg-light border rounded small" style={{ whiteSpace: 'pre-line' }}>{selectedQuestion.outputFormat}</div>
                        </div>
                      )}
                    </div>

                    <div className="mb-2">
                      <label className="label-title">Sample Input</label>
                      <pre className="p-2 bg-dark text-light rounded small" style={{ fontFamily: 'monospace' }}><code>{selectedQuestion.sampleInput}</code></pre>
                    </div>

                    <div className="mb-2">
                      <label className="label-title">Sample Output</label>
                      <pre className="p-2 bg-dark text-light rounded small" style={{ fontFamily: 'monospace' }}><code>{selectedQuestion.sampleOutput}</code></pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted small">
                    <Eye size={32} className="mb-2 opacity-50" />
                    <p>Select a question from the table to preview details here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Registered Students */}
        {activeTab === 'students' && (
          <div className="animate-fade-in">
            
            {/* Real-time Summary Cards */}
            {(() => {
              const totalRegistered = students.length;
              const totalEligible = students.filter(s => s.status !== 'Disqualified').length;
              const examStarted = students.filter(s => s.status === 'Exam Started').length;
              const inProgress = students.filter(s => s.status === 'In Progress' || s.status === 'Exam Started').length;
              const submitted = students.filter(s => s.status === 'Submitted' || s.status === 'Auto Submitted').length;
              const completed = students.filter(s => s.status === 'Completed').length;
              const absent = students.filter(s => s.status === 'Absent').length;
              const disqualified = students.filter(s => s.status === 'Disqualified').length;

              return (
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #2563EB' }}>
                      <div className="small text-muted mb-1 fw-medium">Total Registered</div>
                      <div className="h3 fw-bold mb-0 text-primary">{totalRegistered}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #0F172A' }}>
                      <div className="small text-muted mb-1 fw-medium">Total Eligible</div>
                      <div className="h3 fw-bold mb-0 text-dark">{totalEligible}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #F59E0B' }}>
                      <div className="small text-muted mb-1 fw-medium">Exam Started</div>
                      <div className="h3 fw-bold mb-0 text-warning">{examStarted}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #2563EB' }}>
                      <div className="small text-muted mb-1 fw-medium">In Progress</div>
                      <div className="h3 fw-bold mb-0 text-info">{inProgress}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #22C55E' }}>
                      <div className="small text-muted mb-1 fw-medium">Submitted</div>
                      <div className="h3 fw-bold mb-0 text-success">{submitted}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #16A34A' }}>
                      <div className="small text-muted mb-1 fw-medium">Completed</div>
                      <div className="h3 fw-bold mb-0" style={{ color: '#16A34A' }}>{completed}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #64748B' }}>
                      <div className="small text-muted mb-1 fw-medium">Absent</div>
                      <div className="h3 fw-bold mb-0 text-secondary">{absent}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3 col-xl-1.5">
                    <div className="p-3 bg-white border rounded-3 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #EF4444' }}>
                      <div className="small text-muted mb-1 fw-medium">Disqualified</div>
                      <div className="h3 fw-bold mb-0 text-danger">{disqualified}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Roster Controls Panel */}
            <div className="portal-card p-4">
              <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center mb-4 pb-3 border-bottom gap-3">
                <div>
                  <h4 className="fw-bold mb-1 font-heading d-flex align-items-center gap-2">
                    <Users className="text-primary" /> Roster Management
                  </h4>
                  <p className="text-muted small mb-0">Monitor live activity, warn / disqualify students, override logins, and download reports.</p>
                </div>
                
                {/* Export Buttons */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {(() => {
                    const filteredList = students.filter(s => {
                      const searchLower = searchQuery.toLowerCase();
                      const matchesSearch = 
                        s.name.toLowerCase().includes(searchLower) ||
                        s.rollNumber.toLowerCase().includes(searchLower) ||
                        s.email.toLowerCase().includes(searchLower) ||
                        s.examName.toLowerCase().includes(searchLower);

                      const matchesBranch = branchFilter === 'All' || s.branch === branchFilter;
                      const matchesYear = yearFilter === 'All' || s.year === yearFilter;
                      const matchesSemester = semesterFilter === 'All' || s.semester === semesterFilter;
                      const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
                      const matchesExam = examFilter === 'All' || s.examName === examFilter;

                      return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesStatus && matchesExam;
                    });

                    return (
                      <>
                        <button
                          onClick={() => handleExportCsv(filteredList)}
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 text-nowrap"
                          disabled={studentsLoading}
                        >
                          <FileText size={16} /> Download CSV
                        </button>
                        <button
                          onClick={() => handleExportExcel(filteredList)}
                          className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 text-nowrap"
                          disabled={studentsLoading}
                        >
                          <FileText size={16} /> Download Excel
                        </button>
                        <button
                          onClick={() => handleExportPdf(filteredList)}
                          className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1.5 py-2 px-3 fw-semibold rounded-2 text-nowrap"
                          disabled={studentsLoading}
                        >
                          <FileText size={16} /> Download PDF
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Conjunctive Search and Filters Bar */}
              <div className="row g-2 mb-4 bg-light p-3 rounded-3 border border-light">
                <div className="col-12 col-md-4 col-xl-3">
                  <span className="small fw-semibold text-muted mb-1 d-block">Search query</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, roll, email, exam..."
                    className="form-control form-control-sm"
                  />
                </div>

                <div className="col-6 col-md-2 col-xl-1.5">
                  <span className="small fw-semibold text-muted mb-1 d-block">Branch</span>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="form-select form-select-sm"
                  >
                    <option value="All">All</option>
                    <option value="CSE">CSE</option>
                    <option value="CSE (AI & ML)">CSE (AI & ML)</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-1.5">
                  <span className="small fw-semibold text-muted mb-1 d-block">Year</span>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="form-select form-select-sm"
                  >
                    <option value="All">All</option>
                    <option value="I Year">I Year</option>
                    <option value="II Year">II Year</option>
                    <option value="III Year">III Year</option>
                    <option value="IV Year">IV Year</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-1.5">
                  <span className="small fw-semibold text-muted mb-1 d-block">Semester</span>
                  <select
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="form-select form-select-sm"
                  >
                    <option value="All">All</option>
                    <option value="I Semester">I Sem</option>
                    <option value="II Semester">II Sem</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 col-xl-2">
                  <span className="small fw-semibold text-muted mb-1 d-block">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select form-select-sm"
                  >
                    <option value="All">All</option>
                    <option value="Registered">Registered</option>
                    <option value="Waiting for Exam">Waiting for Exam</option>
                    <option value="Exam Started">Exam Started</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Completed">Completed</option>
                    <option value="Absent">Absent</option>
                    <option value="Disqualified">Disqualified</option>
                  </select>
                </div>

                <div className="col-12 col-md-4 col-xl-2">
                  <span className="small fw-semibold text-muted mb-1 d-block">Exam Schedule</span>
                  <select
                    value={examFilter}
                    onChange={(e) => setExamFilter(e.target.value)}
                    className="form-select form-select-sm"
                  >
                    <option value="All">All Exams</option>
                    {Array.from(new Set(students.map(s => s.examName))).map(exam => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </select>
                </div>
              </div>

              {studentsLoading ? (
                <div className="text-center py-5">
                  <span className="spinner-border text-primary" role="status"></span>
                  <p className="mt-2 text-muted">Retrieving student records...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table admin-table align-middle">
                    <thead>
                      <tr>
                        <th scope="col" className="ps-3 py-2.5" style={{ width: '5%' }}>S.No</th>
                        <th scope="col" className="py-2.5" style={{ width: '22%' }}>Student Details</th>
                        <th scope="col" className="py-2.5" style={{ width: '12%' }}>Branch & Batch</th>
                        <th scope="col" className="py-2.5 text-center" style={{ width: '15%' }}>Monitor Status</th>
                        <th scope="col" className="py-2.5 text-center" style={{ width: '12%' }}>Warnings Log</th>
                        <th scope="col" className="py-2.5 text-center" style={{ width: '12%' }}>Grade Score</th>
                        <th scope="col" className="text-end pe-3 py-2.5" style={{ width: '22%' }}>Roster Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = students.filter(s => {
                          const searchLower = searchQuery.toLowerCase();
                          const matchesSearch = 
                            s.name.toLowerCase().includes(searchLower) ||
                            s.rollNumber.toLowerCase().includes(searchLower) ||
                            s.email.toLowerCase().includes(searchLower) ||
                            s.examName.toLowerCase().includes(searchLower);

                          const matchesBranch = branchFilter === 'All' || s.branch === branchFilter;
                          const matchesYear = yearFilter === 'All' || s.year === yearFilter;
                          const matchesSemester = semesterFilter === 'All' || s.semester === semesterFilter;
                          const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
                          const matchesExam = examFilter === 'All' || s.examName === examFilter;

                          return matchesSearch && matchesBranch && matchesYear && matchesSemester && matchesStatus && matchesExam;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="text-center py-5 text-muted small">
                                No student records match the selected query parameters.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((s, idx) => {
                          // Get color styling of status badge
                          let badgeBg = 'bg-secondary';
                          if (s.status === 'Exam Started') badgeBg = 'bg-warning text-dark';
                          else if (s.status === 'Submitted' || s.status === 'Completed') badgeBg = 'bg-success';
                          else if (s.status === 'Disqualified') badgeBg = 'bg-danger';

                          return (
                            <tr key={s.id}>
                              <td className="ps-3 fw-semibold text-muted">{idx + 1}</td>
                              <td>
                                <div className="fw-bold">{s.name}</div>
                                <div className="small text-muted">{s.rollNumber}</div>
                                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{s.email}</div>
                                <div className="text-secondary" style={{ fontSize: '0.73rem' }}>Login: {new Date(s.loginTime).toLocaleTimeString()}</div>
                              </td>
                              <td>
                                <div className="badge bg-primary-subtle text-primary mb-1">{s.branch}</div>
                                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>{s.year} - {s.semester}</div>
                                <div className="text-success fw-medium" style={{ fontSize: '0.73rem' }}>Drafts: {s.codeSubmissions?.filter(c => c.draftCode?.trim() || c.submittedCode?.trim()).length || 0} / 5</div>
                              </td>
                              {/* Status Column with Dropdown override */}
                              <td className="text-center">
                                <div className="d-flex flex-column align-items-center gap-1">
                                  <span className={`badge ${badgeBg} py-1.5 px-2.5 rounded-pill mb-1`} style={{ fontSize: '0.8rem' }}>
                                    {s.status}
                                  </span>
                                  {s.terminationReason && (
                                    <div className="text-danger fw-bold" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>
                                      {s.terminationReason}
                                    </div>
                                  )}
                                  {s.status === 'Exam Started' && s.timerExpiryTime && (
                                    <div className="text-muted fw-semibold" style={{ fontSize: '0.68rem' }}>
                                      Expires: {new Date(s.timerExpiryTime).toLocaleTimeString()}
                                    </div>
                                  )}
                                  {/* Override Select */}
                                  <select
                                    value={s.status}
                                    onChange={(e) => handleStatusOverride(s.id, e.target.value)}
                                    className="form-select form-select-sm py-0.5 px-1.5 mt-1"
                                    style={{ fontSize: '0.7rem', maxWidth: '120px' }}
                                  >
                                    <option value="Registered">Registered</option>
                                    <option value="Waiting for Exam">Waiting</option>
                                    <option value="Exam Started">Exam Started</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Absent">Absent</option>
                                    <option value="Disqualified">Disqualified</option>
                                  </select>
                                </div>
                              </td>
                              {/* Warnings Monitor Column */}
                              <td className="text-center">
                                <div className="d-flex flex-column align-items-center gap-1">
                                  <span className={`badge ${s.warningCount > 0 ? 'bg-danger-subtle text-danger' : 'bg-light text-muted'} py-1.5 px-2.5 rounded`} style={{ fontSize: '0.8rem' }}>
                                    Warnings: {s.warningCount} / 3
                                  </span>
                                  <button
                                    onClick={() => handleWarningOverride(s.id, s.warningCount)}
                                    className="btn btn-sm btn-outline-warning py-0.5 px-2"
                                    style={{ fontSize: '0.7rem' }}
                                    disabled={s.status === 'Disqualified'}
                                  >
                                    + Add Warning
                                  </button>
                                </div>
                              </td>
                              {/* Grade Results Column */}
                              <td className="text-center">
                                <div className="fw-bold">{s.marksObtained} / {s.totalMarks}</div>
                                <span className={`badge ${s.finalResult === 'Pass' ? 'bg-success' : s.finalResult === 'Fail' ? 'bg-danger' : 'bg-secondary'} small`} style={{ fontSize: '0.7rem' }}>
                                  {s.finalResult}
                                </span>
                              </td>
                              {/* Row Actions */}
                              <td className="text-end pe-3">
                                <div className="d-flex gap-1 justify-content-end">
                                  <button
                                    onClick={() => handleExportIndividualReport(s)}
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                    title="Download Student PDF Report"
                                  >
                                    <FileText size={12} /> Report
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStudent(s.id)}
                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                                    title="Delete registration details"
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Tab 5: Eligible Students Roster */}
        {activeTab === 'eligible' && (
          <div className="portal-card p-4 animate-fade-in">
            <h4 className="fw-bold mb-4 font-heading d-flex align-items-center gap-2">
              <Users className="text-primary" /> Eligible Examination Roster
            </h4>
            
            {uploadMessage && (
              <div className={`alert alert-${uploadMessage.type} border-0 rounded-3 shadow-sm mb-4`}>
                {uploadMessage.text}
              </div>
            )}

            <div className="row g-4">
              {/* Left Side: Paste Uploader */}
              <div className="col-12 col-xl-4">
                <div className="bg-light p-3 rounded-3 border">
                  <h6 className="fw-bold mb-2">Register Eligible Students (Bulk Paste)</h6>
                  <p className="text-muted small mb-3">
                    Paste raw text. Formats:<br/>
                    <code>RollNumber</code> (separated by lines)<br/>
                    <code>RollNumber, Name, Branch, Year, Semester, Email</code> (comma-separated values)
                  </p>
                  <form onSubmit={handleBulkUploadEligible}>
                    <textarea
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      className="form-control mb-3 font-monospace"
                      rows={6}
                      placeholder="e.g.&#10;21B81A0501&#10;21B81A0502, John Doe, CSE, III Year, I Semester, john@example.com"
                      style={{ fontSize: '0.8rem' }}
                    />
                    <button type="submit" className="btn btn-primary btn-sm w-100 py-2">
                      Upload Eligible Roster
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Side: Roster Table */}
              <div className="col-12 col-xl-8">
                <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="table table-striped align-middle small">
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Branch</th>
                        <th>Batch</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleLoading ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-muted">Loading eligible roster...</td>
                        </tr>
                      ) : eligibleStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-muted">No eligible students registered. Use the bulk uploader on the left.</td>
                        </tr>
                      ) : (
                        eligibleStudents.map(s => (
                          <tr key={s.id}>
                            <td className="fw-bold text-primary">{s.rollNumber}</td>
                            <td>{s.name}</td>
                            <td>{s.branch}</td>
                            <td>{s.year} - {s.semester}</td>
                            <td>
                              <button
                                onClick={() => handleDeleteEligible(s.id)}
                                className="btn btn-sm btn-outline-danger py-0.5 px-2"
                                style={{ fontSize: '0.7rem' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
