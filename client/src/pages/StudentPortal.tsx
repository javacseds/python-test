import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import { SplitPane } from '../components/SplitPane';
import { API_BASE_URL } from '../utils/apiHelper';
import { 
  BookOpen, User, ArrowLeft, ArrowRight, 
  AlertTriangle, Play, CheckSquare, ShieldAlert, Terminal, 
  RotateCcw, Trash2, Maximize, Clock, ShieldCheck
} from 'lucide-react';

interface Question {
  index: number;
  id: string;
  title: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  draftCode?: string;
  submittedCode?: string;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year: string;
  semester: string;
  email: string;
  status: string;
  warningCount: number;
  examName: string;
  timerExpiryTime?: string;
  terminationReason?: string;
}

interface StudentPortalProps {
  student: Student;
  questions: Question[];
  onLogout: () => void;
}

const cleanSampleInput = (raw: string): string => {
  if (!raw) return '';
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      const lower = line.toLowerCase();
      return !lower.startsWith('input') && !lower.startsWith('sample test case') && !lower.startsWith('output');
    })
    .join('\n')
    .trim();
};

interface CustomModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'confirm';
  onConfirm?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ student, questions, onLogout }) => {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [stdins, setStdins] = useState<{ [questionId: string]: string }>({});
  
  // Console outputs for each question ID
  const [consoleOutputs, setConsoleOutputs] = useState<{ [questionId: string]: { stdout: string; stderr: string; error?: string } }>({});
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved to database');
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [isDuplicateLockout, setIsDuplicateLockout] = useState(false);
  
  // Custom Modal Overlay State
  const [modal, setModal] = useState<CustomModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize draft answers
  useEffect(() => {
    const initialAnswers: { [questionId: string]: string } = {};
    questions.forEach(q => {
      initialAnswers[q.id] = q.draftCode || '';
    });
    setAnswers(initialAnswers);
  }, [questions]);

  // Set up WebSockets & Standard Restrictions
  useEffect(() => {
    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.emit('register_student', { studentId: student.id });

    socket.on('duplicate_window_warning', ({ warningCount }) => {
      setModal({
        isOpen: true,
        title: 'Security Alert - Duplicate Session',
        message: `Another tab or window has tried to connect to this exam session. This violation has been recorded.\n\nWarning Count: ${warningCount} / 3. Reaching 3 warnings terminates the exam.\n\nNote: The duplicate session has been blocked.`,
        type: 'warning'
      });
    });

    socket.on('close_duplicate', () => {
      setIsDuplicateLockout(true);
      socket.disconnect();
    });

    // Keystroke locks, print locks, and copy-paste disables
    const preventRightClick = (e: MouseEvent) => e.preventDefault();
    const preventPrint = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setModal({
          isOpen: true,
          title: 'Keystroke Locked',
          message: 'Printing is disabled during the assessment.',
          type: 'error'
        });
      }
    };
    const preventCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setModal({
        isOpen: true,
        title: 'Keystroke Locked',
        message: 'Copying, cutting, or pasting text inside this workspace is strictly prohibited.',
        type: 'error'
      });
    };

    document.addEventListener('contextmenu', preventRightClick);
    document.addEventListener('keydown', preventPrint);
    document.addEventListener('copy', preventCopyCutPaste);
    document.addEventListener('cut', preventCopyCutPaste);
    document.addEventListener('paste', preventCopyCutPaste);

    return () => {
      socket.disconnect();
      document.removeEventListener('contextmenu', preventRightClick);
      document.removeEventListener('keydown', preventPrint);
      document.removeEventListener('copy', preventCopyCutPaste);
      document.removeEventListener('cut', preventCopyCutPaste);
      document.removeEventListener('paste', preventCopyCutPaste);
    };
  }, [student.id]);

  // Tab Defocus Monitor using Tab visibilityState API (highly robust)
  useEffect(() => {
    if (student.status !== 'Exam Started') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && !modal.isOpen) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/student/warning`, {
            studentId: student.id
          });
          const data = res.data;
          
          if (data.status === 'Disqualified') {
            // Disqualified screen triggers via parent props automatically
          } else {
            setModal({
              isOpen: true,
              title: 'Security Alert - Tab Switched',
              message: `You have minimized or switched the browser tab. This violation is logged.\n\nWarning Count: ${data.warningCount} / 3. Reaching 3 warnings terminates the exam.`,
              type: 'warning'
            });
          }
        } catch (err) {
          console.error('Error logging focus warning:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [student.status, student.id, modal.isOpen]);

  // Full Screen Exits Lock Monitor
  useEffect(() => {
    if (student.status !== 'Exam Started') return;

    const handleFullscreenChange = async () => {
      if (!document.fullscreenElement && !modal.isOpen) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/student/warning`, {
            studentId: student.id
          });
          const data = res.data;

          if (data.status === 'Disqualified') {
            // Disqualified screen triggers via parent props automatically
          } else {
            setModal({
              isOpen: true,
              title: 'Security Alert - Fullscreen Exited',
              message: `Fullscreen mode was deactivated. Fullscreen is mandatory during this exam.\n\nWarning Count: ${data.warningCount} / 3.\nPlease return to fullscreen immediately.`,
              type: 'warning',
              onConfirm: () => requestFullScreen()
            });
          }
        } catch (err) {
          console.error('Error reporting fullscreen exit:', err);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [student.status, student.id, modal.isOpen]);

  // Timer Countdown manager
  useEffect(() => {
    if (student.status !== 'Exam Started' || !student.timerExpiryTime) {
      setTimeLeft('--:--');
      return;
    }

    const expiryTime = new Date(student.timerExpiryTime).getTime();

    const updateTimer = async () => {
      const now = new Date().getTime();
      const diff = expiryTime - now;

      if (diff <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft('00:00');
        setModal({
          isOpen: true,
          title: 'Time Limit Expired',
          message: 'Your exam time limit has reached. Your answers are being submitted automatically.',
          type: 'info',
          onConfirm: handleForceAutoSubmit
        });
        return;
      }

      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const formattedHours = hours > 0 ? `${hours}:` : '';
      const formattedMins = String(minutes).padStart(2, '0');
      const formattedSecs = String(seconds).padStart(2, '0');

      setTimeLeft(`${formattedHours}${formattedMins}:${formattedSecs}`);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [student.status, student.timerExpiryTime]);

  // Code Auto-Save (every 5 seconds)
  useEffect(() => {
    if (student.status !== 'Exam Started') return;

    const autoSaveInterval = setInterval(async () => {
      setSaveStatus('Auto-saving draft...');
      try {
        const promises = Object.entries(answers).map(([qId, code]) => {
          return axios.post(`${API_BASE_URL}/api/student/auto-save`, {
            studentId: student.id,
            questionId: qId,
            code
          });
        });
        await Promise.all(promises);
        
        const now = new Date().toLocaleTimeString();
        setSaveStatus(`All changes saved to database (last saved at ${now})`);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSaveStatus('Auto-save failed. Check connection.');
      }
    }, 5000);

    return () => clearInterval(autoSaveInterval);
  }, [answers, student.status, student.id]);

  const requestFullScreen = () => {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    }
  };

  const handleStartExam = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/student/start-exam`, { studentId: student.id });
      requestFullScreen();
    } catch (err) {
      console.error(err);
      setModal({
        isOpen: true,
        title: 'Launch Failed',
        message: 'Could not communicate with the exam configuration servers. Contact your exam administrator.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunCode = async (questionId: string) => {
    const code = answers[questionId] || '';
    const stdin = stdins[questionId] || '';
    setLoading(true);

    setConsoleOutputs(prev => ({
      ...prev,
      [questionId]: { stdout: 'Initializing sandboxed runtime environment...\n', stderr: '' }
    }));

    try {
      const response = await axios.post(`${API_BASE_URL}/api/student/run-code`, {
        studentId: student.id,
        questionId,
        code,
        stdin
      });

      const { stdout, stderr, error } = response.data;
      setConsoleOutputs(prev => ({
        ...prev,
        [questionId]: { stdout, stderr, error }
      }));
    } catch (err) {
      console.error('Execution router failed:', err);
      setConsoleOutputs(prev => ({
        ...prev,
        [questionId]: {
          stdout: '',
          stderr: 'Traceback (most recent call last):\n  SystemError: Code compilation service offline.',
          error: 'Execution Service Offline'
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClearOutput = (questionId: string) => {
    setConsoleOutputs(prev => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  const handleResetCode = (questionId: string) => {
    setModal({
      isOpen: true,
      title: 'Reset Code Cell',
      message: 'Are you sure you want to clear the editor cell? All unsaved edits will be lost.',
      type: 'confirm',
      onConfirm: () => {
        setAnswers(prev => ({
          ...prev,
          [questionId]: ''
        }));
      }
    });
  };

  const handleSubmitExam = () => {
    setModal({
      isOpen: true,
      title: 'Submit Assessment',
      message: 'Are you sure you want to submit your exam answers? This action is final and cannot be undone.',
      type: 'confirm',
      onConfirm: executeSubmitExam
    });
  };

  const executeSubmitExam = async () => {
    setLoading(true);
    const formattedAnswers = Object.entries(answers).map(([qId, code]) => ({
      questionId: qId,
      code
    }));

    try {
      await axios.post(`${API_BASE_URL}/api/student/submit-exam`, {
        studentId: student.id,
        answers: formattedAnswers
      });
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (err) {
      console.error(err);
      setModal({
        isOpen: true,
        title: 'Submission Failed',
        message: 'An error occurred while submitting your answers. Verify your network connection and try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForceAutoSubmit = async () => {
    const formattedAnswers = Object.entries(answers).map(([qId, code]) => ({
      questionId: qId,
      code
    }));
    try {
      await axios.post(`${API_BASE_URL}/api/student/submit-exam`, {
        studentId: student.id,
        answers: formattedAnswers
      });
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (err) {
      console.error('Failed auto submitting:', err);
    }
  };

  // Lockout State: Duplicate Window warning
  if (isDuplicateLockout) {
    return (
      <div className="min-vh-100 bg-gradient-soft d-flex align-items-center justify-content-center py-5 px-3">
        <div className="portal-card p-5 text-center shadow-lg border border-danger border-2 animate-fade-in" style={{ maxWidth: '540px' }}>
          <div className="d-inline-flex p-4 rounded-circle bg-danger-subtle text-danger mb-4">
            <ShieldAlert size={56} />
          </div>
          <h2 className="fw-bold font-heading text-danger mb-3">Duplicate Session Blocked</h2>
          <p className="text-secondary mb-4 small fw-medium" style={{ lineHeight: '1.6' }}>
            This browser tab has been closed because another examination window is already active for this student roll number.
          </p>
          <div className="p-3 bg-light rounded-3 text-muted small mb-4 text-start border">
            <div><strong>Student:</strong> {student.name} ({student.rollNumber})</div>
            <div><strong>System Code:</strong> DUPLICATE_WINDOW_REJECTION</div>
          </div>
          <button onClick={onLogout} className="btn btn-portal-secondary w-100">
            Exit Portal
          </button>
        </div>
      </div>
    );
  }

  // State 1: Disqualified Page
  if (student.status === 'Disqualified') {
    return (
      <div className="min-vh-100 bg-gradient-soft d-flex align-items-center justify-content-center py-5 px-3">
        <div className="portal-card p-5 text-center shadow-lg border border-danger border-2 animate-fade-in" style={{ maxWidth: '540px' }}>
          <div className="d-inline-flex p-4 rounded-circle bg-danger-subtle text-danger mb-4">
            <ShieldAlert size={56} />
          </div>
          <h2 className="fw-bold font-heading text-danger mb-3">Session Terminated</h2>
          <p className="text-secondary mb-4 small fw-medium" style={{ lineHeight: '1.6' }}>
            Your assessment has been automatically locked due to multiple window, fullscreen, or focus-switching security violations.
          </p>
          <div className="p-3 bg-light rounded-3 text-muted small mb-4 text-start border">
            <div><strong>Student ID:</strong> {student.rollNumber}</div>
            <div><strong>Reason:</strong> {student.terminationReason || 'SECURITY_MALPRACTICE_DETECTION'}</div>
            <div><strong>Violation Warnings:</strong> {student.warningCount} / 3</div>
          </div>
          <button onClick={onLogout} className="btn btn-portal-secondary w-100">
            Exit Portal
          </button>
        </div>
      </div>
    );
  }

  // State 2: Submitted Page
  if (student.status === 'Submitted' || student.status === 'Completed') {
    return (
      <div className="min-vh-100 bg-gradient-soft d-flex align-items-center justify-content-center py-5 px-3">
        <div className="portal-card p-5 text-center shadow-lg border border-success border-2 animate-fade-in" style={{ maxWidth: '540px' }}>
          <div className="d-inline-flex p-4 rounded-circle bg-success-subtle text-success mb-4">
            <ShieldCheck size={56} />
          </div>
          <h2 className="fw-bold font-heading text-success mb-3">Assessment Submitted</h2>
          <p className="text-secondary mb-4 small fw-medium">
            Thank you! Your programming answers have been saved and locked. You can now close your browser tab.
          </p>
          <div className="p-3 bg-light rounded-3 text-muted small mb-4 text-start border">
            <div><strong>Student Name:</strong> {student.name} ({student.rollNumber})</div>
            <div><strong>Final Submission:</strong> SUCCESSFUL</div>
          </div>
          <button onClick={onLogout} className="btn btn-portal-primary w-100">
            Exit Portal
          </button>
        </div>
      </div>
    );
  }

  // State 3: Instructions Page
  if (student.status === 'Registered' || student.status === 'Waiting for Exam') {
    return (
      <div className="min-vh-100 bg-gradient-soft d-flex align-items-center justify-content-center py-5 px-3">
        <div className="portal-card p-4 p-md-5 animate-fade-in" style={{ maxWidth: '640px', width: '100%' }}>
          <div className="text-center mb-4">
            <span className="badge bg-primary-subtle text-primary px-3 py-1.5 rounded-pill mb-2 fw-semibold">Assessment Lockboard</span>
            <h3 className="fw-bold font-heading">{student.examName}</h3>
            <p className="text-muted small">Prepare your workspace. Full Screen mode is enforced immediately on launch.</p>
          </div>

          <div className="p-3 bg-light rounded-3 border mb-4">
            <h5 className="fw-bold small text-secondary uppercase mb-2">Registration Profile</h5>
            <div className="row g-2 text-muted small">
              <div className="col-sm-6"><strong>Student Name:</strong> {student.name}</div>
              <div className="col-sm-6"><strong>Roll Number:</strong> {student.rollNumber}</div>
              <div className="col-sm-6"><strong>Branch:</strong> {student.branch}</div>
              <div className="col-sm-6"><strong>Timeline:</strong> 120 Minutes Session</div>
            </div>
          </div>

          <div className="mb-4">
            <h6 className="fw-bold text-dark mb-2">Locked Examination Policy:</h6>
            <ul className="text-muted small ps-3" style={{ lineHeight: '1.7' }}>
              <li><strong>Jupyter Workspace</strong>: Every question offers an integrated Jupyter-style Monaco editor console.</li>
              <li><strong>Timer Persistence</strong>: Refreshing the page does not reset the clock or erase code drafts.</li>
              <li><strong>Single Tab Policy</strong>: Opening another tab, window, or exiting full-screen triggers security warnings. Reaching 3 warning counters terminates the test.</li>
              <li><strong>Disable Actions</strong>: Right-click, Copy, Cut, Paste, and Print operations are disabled.</li>
            </ul>
          </div>

          <button
            onClick={handleStartExam}
            className="btn btn-portal-primary w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
          >
            <Maximize size={16} /> Enter Full Screen & Start Exam
          </button>
        </div>
      </div>
    );
  }

  // State 4: Jupyter split-pane workspace
  const activeQuestion = questions[activeIdx];
  const activeConsole = consoleOutputs[activeQuestion.id] || { stdout: '', stderr: '' };

  const handleNext = () => {
    if (activeIdx < questions.length - 1) setActiveIdx(prev => prev + 1);
  };
  const handlePrev = () => {
    if (activeIdx > 0) setActiveIdx(prev => prev - 1);
  };

  // Left Panel Component
  const leftPanel = (
    <div className="p-4 bg-white h-100 d-flex flex-column justify-content-between" style={{ userSelect: 'none' }}>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
          <span className="badge bg-primary-subtle text-primary py-1.5 px-3 rounded-pill fw-bold">
            Question {activeIdx + 1} of {questions.length}
          </span>
          <div className="text-muted small d-flex align-items-center gap-1">
            <Clock size={14} className="text-primary animate-pulse" />
            <span className="fw-bold font-heading text-dark" style={{ fontSize: '1.1rem' }}>{timeLeft}</span>
          </div>
        </div>

        <h3 className="fw-bold text-dark mb-3 font-heading">{activeQuestion.title}</h3>
        
        <div className="mb-4">
          <label className="label-title">Problem Statement</label>
          <p className="text-dark small" style={{ lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
            {activeQuestion.problemStatement}
          </p>
        </div>

        <div className="mb-3">
          <label className="label-title">Input Specifications</label>
          <div className="p-2.5 bg-light border rounded text-dark small" style={{ whiteSpace: 'pre-line' }}>{activeQuestion.inputFormat}</div>
        </div>

        <div className="mb-3">
          <label className="label-title">Output Specifications</label>
          <div className="p-2.5 bg-light border rounded text-dark small" style={{ whiteSpace: 'pre-line' }}>{activeQuestion.outputFormat}</div>
        </div>

        <div className="row g-2 mb-4">
          <div className="col-6">
            <label className="label-title">Sample Input</label>
            <pre className="p-2 bg-dark text-light rounded small" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}><code>{activeQuestion.sampleInput}</code></pre>
          </div>
          <div className="col-6">
            <label className="label-title">Sample Output</label>
            <pre className="p-2 bg-dark text-light rounded small" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}><code>{activeQuestion.sampleOutput}</code></pre>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center border-top pt-3">
        <button
          onClick={handlePrev}
          disabled={activeIdx === 0}
          className="btn btn-portal-secondary btn-sm px-3"
        >
          <ArrowLeft size={14} /> Previous
        </button>
        <button
          onClick={handleNext}
          disabled={activeIdx === questions.length - 1}
          className="btn btn-portal-primary btn-sm px-3"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  // Right Panel Component (Jupyter Environment)
  const rightPanel = (
    <div className="bg-dark text-light h-100 d-flex flex-column justify-content-between p-3" style={{ borderLeft: '1px solid #1e293b' }}>
      
      {/* Cell Editor */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: '320px' }}>
        <div className="d-flex justify-content-between align-items-center bg-secondary bg-opacity-25 px-3 py-2 rounded-top border-bottom border-secondary small">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-success">[ In ]:</span>
            <span className="text-white-50">Jupyter Cell 1 (Python 3.x)</span>
          </div>
          <div className="small text-muted italic text-truncate" style={{ maxWidth: '200px' }}>{saveStatus}</div>
        </div>
        
        <div className="flex-grow-1" style={{ border: '1px solid #334155', borderTop: '0', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={answers[activeQuestion.id] || ''}
            onChange={(val) => {
              if (val !== undefined) {
                setAnswers(prev => ({
                  ...prev,
                  [activeQuestion.id]: val
                }));
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'Fira Code, monospace',
              automaticLayout: true,
              tabSize: 4,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              autoIndent: 'advanced'
            }}
          />
        </div>
      </div>

      {/* Control Console Toolbar */}
      <div className="d-flex justify-content-between align-items-center my-3 bg-secondary bg-opacity-10 p-2 rounded border border-secondary">
        <div className="d-flex gap-2">
          <button
            onClick={() => handleRunCode(activeQuestion.id)}
            disabled={loading}
            className="btn btn-success btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 fw-bold shadow-sm"
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <>
                <Play size={14} /> Run Code
              </>
            )}
          </button>
          <button
            onClick={() => handleResetCode(activeQuestion.id)}
            className="btn btn-outline-warning btn-sm d-flex align-items-center gap-1 px-2.5 py-1.5"
          >
            <RotateCcw size={14} /> Reset Cell
          </button>
        </div>
        <div>
          <button
            onClick={() => handleClearOutput(activeQuestion.id)}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 px-2.5 py-1.5"
          >
            <Trash2 size={14} /> Clear Output
          </button>
        </div>
      </div>

      {/* Standard Input Console (stdin) */}
      <div className="mb-2">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="d-flex align-items-center gap-1 text-white-50 small" style={{ fontSize: '0.8rem' }}>
            <Terminal size={12} className="text-primary" />
            <span>Standard Input (stdin) - Optional</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setStdins(prev => ({
                ...prev,
                [activeQuestion.id]: cleanSampleInput(activeQuestion.sampleInput)
              }));
            }}
            className="btn btn-link btn-sm text-primary p-0 text-decoration-none"
            style={{ fontSize: '0.75rem', fontWeight: '600' }}
          >
            Use Sample Input
          </button>
        </div>
        <textarea
          value={stdins[activeQuestion.id] || ''}
          onChange={(e) => setStdins(prev => ({ ...prev, [activeQuestion.id]: e.target.value }))}
          className="form-control bg-black text-light border border-secondary font-monospace"
          style={{
            fontSize: '0.8rem',
            height: '52px',
            resize: 'none',
            lineHeight: '1.3',
            borderRadius: '4px',
            borderColor: '#334155'
          }}
          placeholder="Type mock input values here (separated by new lines) for input() calls..."
        />
      </div>

      {/* Jupyter Output Console */}
      <div className="bg-black rounded p-3 font-monospace" style={{ minHeight: '160px', maxHeight: '240px', overflowY: 'auto', border: '1px solid #1e293b' }}>
        <div className="d-flex align-items-center gap-1 text-muted small mb-2 border-bottom border-secondary pb-1">
          <Terminal size={14} />
          <span>Console Output Log</span>
        </div>
        
        {/* Output messages */}
        {activeConsole.stdout && (
          <pre className="text-light small mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{activeConsole.stdout}</pre>
        )}
        
        {activeConsole.stderr && (
          <pre className="text-danger small mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4', fontFamily: 'monospace' }}>
            {activeConsole.stderr}
          </pre>
        )}

        {!activeConsole.stdout && !activeConsole.stderr && (
          <span className="text-muted small italic">Run the python cell above to view compiler output here.</span>
        )}
      </div>

    </div>
  );

  return (
    <div className="min-vh-100 bg-gradient-soft d-flex flex-column" style={{ overflow: 'hidden' }}>
      
      {/* Top Banner Navigation */}
      <header className="navbar navbar-expand-lg bg-gradient-header shadow-md sticky-top py-2.5 px-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 text-white">
            <BookOpen className="text-primary" size={24} />
            <span className="h5 mb-0 fw-bold font-heading text-white">{student.examName}</span>
          </div>
          <div className="nav flex-row gap-1.5 d-none d-xl-flex">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setActiveIdx(idx)}
                className={`btn btn-sm rounded px-2.5 py-1 ${idx === activeIdx ? 'btn-primary' : 'btn-outline-light bg-white bg-opacity-10 border-0 text-white'}`}
                style={{ fontSize: '0.8rem' }}
              >
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Warnings counters */}
        <div className="d-flex align-items-center gap-3">
          {student.warningCount > 0 && (
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1.5 d-flex align-items-center gap-1 rounded">
              <AlertTriangle size={14} /> Security Warnings: {student.warningCount}/3
            </span>
          )}
          <div className="d-none d-md-flex align-items-center text-white bg-dark bg-opacity-25 py-1 px-3 rounded border border-light border-opacity-10 small">
            <User size={13} className="text-primary me-1" /> {student.name} ({student.rollNumber})
          </div>
          <button
            onClick={handleSubmitExam}
            className="btn btn-success btn-sm px-3.5 py-1.5 rounded d-flex align-items-center gap-1.5 fw-bold"
            disabled={loading}
          >
            <CheckSquare size={14} /> Submit Assessment
          </button>
        </div>
      </header>

      {/* Main Workspace split panel */}
      <SplitPane
        leftElement={leftPanel}
        rightElement={rightPanel}
      />

      {/* Custom Glassmorphic Modal Overlay */}
      {modal.isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999
          }}
        >
          <div 
            className="portal-card p-4 text-center shadow-lg border animate-scale-up" 
            style={{ 
              maxWidth: '460px', 
              width: '90%', 
              borderColor: modal.type === 'error' || modal.type === 'warning' ? '#ef4444' : '#e2e8f0'
            }}
          >
            <div className="mb-3">
              {modal.type === 'error' && <ShieldAlert className="text-danger mx-auto" size={48} />}
              {modal.type === 'warning' && <AlertTriangle className="text-warning mx-auto" size={48} />}
              {modal.type === 'info' && <Clock className="text-primary mx-auto" size={48} />}
              {modal.type === 'confirm' && <CheckSquare className="text-success mx-auto" size={48} />}
            </div>
            <h4 className="fw-bold font-heading mb-2">{modal.title}</h4>
            <p className="text-secondary small mb-4" style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {modal.message}
            </p>
            <div className="d-flex gap-2 justify-content-center">
              {modal.type === 'confirm' ? (
                <>
                  <button 
                    onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} 
                    className="btn btn-portal-secondary px-4 py-1.5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setModal(prev => ({ ...prev, isOpen: false }));
                      if (modal.onConfirm) modal.onConfirm();
                    }} 
                    className="btn btn-success px-4 py-1.5 fw-bold shadow-sm text-white"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    if (modal.onConfirm) modal.onConfirm();
                  }} 
                  className="btn btn-portal-primary px-5 py-1.5 shadow-sm"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
