import { Router } from 'express';
import { prisma } from '../prisma';
import crypto from 'crypto';
import { broadcastStudentUpdate } from '../utils/socket';
import { runPythonCode } from '../utils/codeRunner';

const router = Router();

// Helper to shuffle an array and pick N items
function getRandomQuestions(questions: any[], count: number): any[] {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 1. Register Student / Start Questions
router.post('/register', async (req, res) => {
  const { name, rollNumber, branch, year, semester, email } = req.body;

  // Validation
  if (!name || !rollNumber || !branch || !year || !semester || !email) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  try {
    // Check if eligibility check is enforced via settings
    const rosterSetting = await prisma.setting.findUnique({
      where: { key: 'enableRoster' }
    });
    const requireEligibility = rosterSetting ? rosterSetting.value === 'true' : false;

    // 1. Check if student already exists
    let student = await prisma.student.findUnique({
      where: { rollNumber },
      include: {
        assignments: {
          include: {
            question: true
          }
        }
      }
    });

    // Roster Validation
    if (requireEligibility) {
      if (!student || !student.isEligible) {
        return res.status(400).json({
          error: `Roll Number '${rollNumber}' is not in the eligible student roster. Please contact your coordinator.`
        });
      }
    }

    // Active Status Validation
    if (student && !student.isActive) {
      return res.status(400).json({
        error: `Your student account has been marked as inactive. Please contact your coordinator.`
      });
    }

    let assignedQuestions = [];

    if (student) {
      // Prevent duplicates or retaking exam after finalized state
      if (student.status === 'Submitted' || student.status === 'Completed' || student.status === 'Disqualified') {
        return res.status(400).json({
          error: 'You have already submitted this exam or have been disqualified.'
        });
      }
      // Update details (and status from "Eligible" to "Registered" if first login)
      const newStatus = student.status === 'Eligible' ? 'Registered' : student.status;
      student = await prisma.student.update({
        where: { id: student.id },
        data: { 
          name, 
          branch, 
          year, 
          semester, 
          email,
          status: newStatus
        },
        include: {
          assignments: {
            include: {
              question: true
            }
          }
        }
      });
      
      assignedQuestions = student.assignments.map(a => a.question);
    } else {
      // Create new student record
      student = await prisma.student.create({
        data: { 
          name, 
          rollNumber, 
          branch, 
          year, 
          semester, 
          email,
          isEligible: true, // Registration directly makes them eligible when Roster is OFF
          isActive: true,
          status: 'Registered'
        },
        include: {
          assignments: {
            include: {
              question: true
            }
          }
        }
      });
    }

    // 2. If student does not have exactly 5 questions assigned, assign them now
    if (assignedQuestions.length < 5) {
      // Delete any incomplete assignments first to avoid duplicates or errors
      if (student.assignments.length > 0) {
        await prisma.questionAssignment.deleteMany({
          where: { studentId: student.id }
        });
      }

      // Fetch all questions from the question bank
      const allQuestions = await prisma.question.findMany();

      if (allQuestions.length < 5) {
        return res.status(400).json({
          error: `Not enough questions in the Question Bank. Currently there are only ${allQuestions.length} questions, but 5 are required. Please contact an admin.`
        });
      }

      // Select 5 unique random questions
      const selected = getRandomQuestions(allQuestions, 5);

      // Save assignments
      const assignmentData = selected.map(q => ({
        studentId: student!.id,
        questionId: q.id
      }));

      await prisma.questionAssignment.createMany({
        data: assignmentData
      });

      assignedQuestions = selected;
    }

    // 3. Create a session token
    const token = crypto.randomBytes(32).toString('hex');
    const durationHours = parseInt(process.env.SESSION_DURATION_HOURS || '4', 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // Save student session
    const session = await prisma.studentSession.create({
      data: {
        studentId: student.id,
        token,
        expiresAt
      }
    });

    // Broadcast registration to admin
    await broadcastStudentUpdate(student.id);

    return res.status(200).json({
      message: 'Registration successful. Questions assigned.',
      token: session.token,
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        branch: student.branch,
        year: student.year,
        semester: student.semester,
        email: student.email,
        examName: student.examName,
        status: student.status,
        warningCount: student.warningCount,
        loginTime: student.loginTime,
        timerExpiryTime: student.timerExpiryTime,
        terminationReason: student.terminationReason
      },
      questions: assignedQuestions.map((q, idx) => ({
        index: idx + 1,
        id: q.id,
        title: q.title,
        problemStatement: q.problemStatement,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        sampleInput: q.sampleInput,
        sampleOutput: q.sampleOutput
      }))
    });

  } catch (error) {
    console.error('Registration/Assignment error:', error);
    return res.status(500).json({ error: 'Failed to process student registration.' });
  }
});

// 2. Retrieve questions by active session token
router.get('/session/:token', async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Session token is required' });
  }

  try {
    const session = await prisma.studentSession.findUnique({
      where: { token },
      include: {
        student: {
          include: {
            assignments: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found. Please log in again.' });
    }

    if (new Date() > session.expiresAt) {
      // Cleanup expired session
      await prisma.studentSession.delete({ where: { id: session.id } });
      return res.status(401).json({ error: 'Session has expired. Please register again.' });
    }

    const student = session.student;
    const questions = student.assignments.map((a, idx) => ({
      index: idx + 1,
      id: a.question.id,
      title: a.question.title,
      problemStatement: a.question.problemStatement,
      inputFormat: a.question.inputFormat,
      outputFormat: a.question.outputFormat,
      sampleInput: a.question.sampleInput,
      sampleOutput: a.question.sampleOutput,
      draftCode: a.draftCode || '',
      submittedCode: a.submittedCode || ''
    }));

    return res.json({
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        branch: student.branch,
        year: student.year,
        semester: student.semester,
        email: student.email,
        examName: student.examName,
        status: student.status,
        warningCount: student.warningCount,
        loginTime: student.loginTime,
        timerExpiryTime: student.timerExpiryTime,
        terminationReason: student.terminationReason
      },
      questions
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    return res.status(500).json({ error: 'Internal server error verifying session.' });
  }
});

// 3. Student Starts the Exam
router.post('/start-exam', async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  try {
    const examDurationMinutes = 120; // 2 hours
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + examDurationMinutes);

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        status: 'Exam Started',
        examStartTime: new Date(),
        timerExpiryTime: expiry
      }
    });

    // Notify admins in real-time
    await broadcastStudentUpdate(student.id);

    return res.json({
      message: 'Exam started successfully',
      status: student.status,
      examStartTime: student.examStartTime,
      timerExpiryTime: student.timerExpiryTime
    });
  } catch (error) {
    console.error('Error starting exam:', error);
    return res.status(500).json({ error: 'Failed to start exam' });
  }
});

// 4. Student Submits the Exam
router.post('/submit-exam', async (req, res) => {
  const { studentId, answers } = req.body; // answers is an array of { questionId: string, code: string }

  if (!studentId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Student ID and answers list are required' });
  }

  try {
    // 1. Save all code submissions
    let non_empty_submissions = 0;
    for (const ans of answers) {
      if (ans.code && ans.code.trim()) {
        non_empty_submissions++;
      }
      await prisma.questionAssignment.update({
        where: {
          studentId_questionId: {
            studentId,
            questionId: ans.questionId
          }
        },
        data: {
          submittedCode: ans.code || '',
          marks: ans.code && ans.code.trim() ? 20.0 : 0.0 // Mock grading: 20 marks per non-empty question
        }
      });
    }

    // Calculate marks obtained: mock calculation 20 points per answered question
    const marksObtained = non_empty_submissions * 20.0;
    const finalResult = marksObtained >= 40.0 ? 'Pass' : 'Fail';

    // 2. Update Student exam status details
    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        status: 'Submitted',
        submissionStatus: 'Submitted',
        submissionTime: new Date(),
        marksObtained,
        finalResult
      }
    });

    // Notify admins in real-time
    await broadcastStudentUpdate(student.id);

    return res.json({
      message: 'Exam submitted successfully',
      status: student.status,
      marksObtained: student.marksObtained,
      finalResult: student.finalResult
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    return res.status(500).json({ error: 'Failed to submit exam' });
  }
});

// 5. Student Receives a Warning (e.g., tab-switching detected)
router.post('/warning', async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  try {
    const currentStudent = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!currentStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const newWarningCount = currentStudent.warningCount + 1;
    let newStatus = currentStudent.status;

    if (newWarningCount >= 3) {
      newStatus = 'Disqualified';
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        warningCount: newWarningCount,
        status: newStatus,
        terminationReason: newStatus === 'Disqualified' ? 'EXCESSIVE_WARNINGS' : null
      }
    });

    // Notify admins in real-time
    await broadcastStudentUpdate(updated.id);

    return res.json({
      message: newStatus === 'Disqualified' ? 'Student disqualified due to excessive warnings' : 'Warning recorded',
      warningCount: updated.warningCount,
      status: updated.status
    });
  } catch (error) {
    console.error('Error recording warning:', error);
    return res.status(500).json({ error: 'Failed to record warning' });
  }
});

// 6. Run Python Code
router.post('/run-code', async (req, res) => {
  const { studentId, questionId, code, stdin } = req.body;

  if (!studentId || !questionId || code === undefined) {
    return res.status(400).json({ error: 'studentId, questionId, and code are required' });
  }

  try {
    const result = await runPythonCode(code, stdin || '');
    return res.json(result);
  } catch (error) {
    console.error('Error in run-code route:', error);
    return res.status(500).json({ error: 'Execution service encountered a failure' });
  }
});

// 7. Auto-Save Student Draft Code
router.post('/auto-save', async (req, res) => {
  const { studentId, questionId, code } = req.body;

  if (!studentId || !questionId || code === undefined) {
    return res.status(400).json({ error: 'studentId, questionId, and code are required' });
  }

  try {
    await prisma.questionAssignment.update({
      where: {
        studentId_questionId: {
          studentId,
          questionId
        }
      },
      data: {
        draftCode: code
      }
    });

    return res.json({ success: true, savedAt: new Date() });
  } catch (error) {
    console.error('Error auto-saving draft code:', error);
    return res.status(500).json({ error: 'Failed to auto-save draft code' });
  }
});

export default router;
