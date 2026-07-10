import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { prisma } from '../prisma';
import { parsePdfQuestions } from '../utils/pdfParser';
import { broadcastStudentUpdate } from '../utils/socket';

const router = Router();

// Configure multer for PDF uploads (in-memory buffering)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Admin JWT Authentication middleware
export interface AdminRequest extends Request {
  adminId?: string;
}

export function authenticateAdmin(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'super_secret_admin_key_123456_change_in_production';
    const decoded = jwt.verify(token, secret) as { adminId: string };
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }
}

// 1. Admin Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { username }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValidPassword = (password === admin.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { adminId: admin.id },
      process.env.JWT_SECRET || 'super_secret_admin_key_123456_change_in_production',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any }
    );

    return res.json({
      message: 'Login successful',
      token,
      admin: { id: admin.id, username: admin.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET all questions (for question bank view)
router.get('/questions', authenticateAdmin, async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// 3. Manual Question Entry
router.post('/manual-question', authenticateAdmin, async (req, res) => {
  const { title, problemStatement, inputFormat, outputFormat, sampleInput, sampleOutput } = req.body;

  if (!title || !problemStatement) {
    return res.status(400).json({ error: 'Question Title and Problem Statement are required' });
  }

  try {
    const question = await prisma.question.create({
      data: {
        title,
        problemStatement,
        inputFormat: inputFormat || '',
        outputFormat: outputFormat || '',
        sampleInput: sampleInput || '',
        sampleOutput: sampleOutput || ''
      }
    });

    return res.status(201).json({
      message: 'Question created successfully',
      question
    });
  } catch (error) {
    console.error('Error creating question:', error);
    return res.status(500).json({ error: 'Failed to create question' });
  }
});

// 4. PDF Upload & Parse (Returns proposal for preview)
router.post('/upload-pdf', authenticateAdmin, (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    try {
      const extracted = await parsePdfQuestions(req.file.buffer);
      return res.json({
        message: `Extracted ${extracted.length} questions. Please review them before saving.`,
        questions: extracted
      });
    } catch (error: any) {
      console.error('Error processing PDF upload:', error);
      return res.status(500).json({ error: error.message || 'Failed to process PDF' });
    }
  });
});

// 5. Save Bulk Questions (From PDF preview)
router.post('/save-bulk-questions', authenticateAdmin, async (req, res) => {
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'No questions provided' });
  }

  try {
    const data = questions.map((q: any) => ({
      title: q.title || 'Untitled PDF Question',
      problemStatement: q.problemStatement || '',
      inputFormat: q.inputFormat || '',
      outputFormat: q.outputFormat || '',
      sampleInput: q.sampleInput || '',
      sampleOutput: q.sampleOutput || ''
    }));

    const result = await prisma.question.createMany({
      data
    });

    return res.status(201).json({
      message: `Successfully saved ${result.count} questions to the database.`,
      count: result.count
    });
  } catch (error) {
    console.error('Error saving bulk questions:', error);
    return res.status(500).json({ error: 'Failed to save questions' });
  }
});

// 6. Delete a question
router.delete('/questions/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.question.delete({
      where: { id }
    });
    return res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ error: 'Failed to delete question. It may be assigned to a student.' });
  }
});

// 7. GET all registered students with assigned questions (exclude status Eligible)
router.get('/students', authenticateAdmin, async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        status: { not: 'Eligible' }
      },
      include: {
        assignments: {
          include: {
            question: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = students.map(student => ({
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      branch: student.branch,
      year: student.year,
      semester: student.semester,
      email: student.email,
      examName: student.examName,
      loginTime: student.loginTime,
      examStartTime: student.examStartTime,
      submissionTime: student.submissionTime,
      timerExpiryTime: student.timerExpiryTime,
      terminationReason: student.terminationReason,
      status: student.status,
      submissionStatus: student.submissionStatus,
      warningCount: student.warningCount,
      marksObtained: student.marksObtained,
      totalMarks: student.totalMarks,
      finalResult: student.finalResult,
      createdAt: student.createdAt,
      isActive: student.isActive,
      isEligible: student.isEligible,
      questions: student.assignments.map(a => a.question.title),
      codeSubmissions: student.assignments.map(a => ({
        questionId: a.questionId,
        title: a.question.title,
        problemStatement: a.question.problemStatement,
        submittedCode: a.submittedCode || '',
        draftCode: a.draftCode || '',
        marks: a.marks || 0
      }))
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({ error: 'Failed to fetch registered students' });
  }
});

// 8. DELETE a registered student details (cascades sessions & assignments)
router.delete('/students/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.student.delete({
      where: { id }
    });
    return res.json({ message: 'Student registration details deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ error: 'Failed to delete student registration details.' });
  }
});

// 9. Manual Status Override by Admin
router.post('/students/:id/status', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const updated = await prisma.student.update({
      where: { id },
      data: { status }
    });

    // Notify all connected clients (admins and students)
    await broadcastStudentUpdate(updated.id);

    return res.json({ message: 'Status updated successfully', student: updated });
  } catch (error) {
    console.error('Error updating student status:', error);
    return res.status(500).json({ error: 'Failed to update student status' });
  }
});

// 10. Manual Warning Count Override by Admin
router.post('/students/:id/warning', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { warningCount } = req.body;

  if (warningCount === undefined) {
    return res.status(400).json({ error: 'warningCount is required' });
  }

  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let status = student.status;
    if (warningCount >= 3) {
      status = 'Disqualified';
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        warningCount: parseInt(warningCount, 10),
        status
      }
    });

    await broadcastStudentUpdate(updated.id);

    return res.json({ message: 'Warnings updated successfully', student: updated });
  } catch (error) {
    console.error('Error updating warnings:', error);
    return res.status(500).json({ error: 'Failed to update student warnings' });
  }
});

// 11. GET all eligible students
router.get('/eligible-students', authenticateAdmin, async (req, res) => {
  try {
    const list = await prisma.student.findMany({
      where: { isEligible: true },
      orderBy: { rollNumber: 'asc' }
    });
    return res.json(list);
  } catch (error) {
    console.error('Error fetching eligible students:', error);
    return res.status(500).json({ error: 'Failed to fetch eligible student roster' });
  }
});

// 12. Bulk upload/save eligible students
router.post('/upload-eligible-students', authenticateAdmin, async (req, res) => {
  const { students } = req.body; // Array of { rollNumber, name, branch, year, semester, email }

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No eligible students provided' });
  }

  try {
    let addedCount = 0;
    for (const s of students) {
      if (!s.rollNumber) continue;
      
      // Upsert: update if exists, otherwise create
      await prisma.student.upsert({
        where: { rollNumber: s.rollNumber },
        update: {
          isEligible: true,
          name: s.name || '',
          branch: s.branch || '',
          year: s.year || '',
          semester: s.semester || '',
          email: s.email || ''
        },
        create: {
          rollNumber: s.rollNumber,
          name: s.name || '',
          branch: s.branch || '',
          year: s.year || '',
          semester: s.semester || '',
          email: s.email || '',
          isEligible: true,
          isActive: true,
          status: 'Eligible'
        }
      });
      addedCount++;
    }

    return res.status(201).json({
      message: `Successfully registered ${addedCount} eligible students in roster.`,
      count: addedCount
    });
  } catch (error) {
    console.error('Error saving eligible students:', error);
    return res.status(500).json({ error: 'Failed to upload eligible student roster' });
  }
});

// 13. DELETE an eligible student
router.delete('/eligible-students/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (student.status === 'Eligible') {
      await prisma.student.delete({
        where: { id }
      });
    } else {
      await prisma.student.update({
        where: { id },
        data: { isEligible: false }
      });
    }

    return res.json({ message: 'Eligible student removed successfully' });
  } catch (error) {
    console.error('Error removing eligible student:', error);
    return res.status(500).json({ error: 'Failed to remove student from eligible roster.' });
  }
});

// 14. Toggle Student Active/Inactive Status
router.post('/students/:id/toggle-active', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const updated = await prisma.student.update({
      where: { id },
      data: { isActive: !student.isActive }
    });

    await broadcastStudentUpdate(updated.id);

    return res.json({ message: `Student status updated to ${updated.isActive ? 'Active' : 'Inactive'}`, student: updated });
  } catch (error) {
    console.error('Error toggling student active status:', error);
    return res.status(500).json({ error: 'Failed to update student active status' });
  }
});

// 15. Bulk actions on students
router.post('/students/bulk-action', authenticateAdmin, async (req, res) => {
  const { studentIds, action, value } = req.body;
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'No student IDs provided' });
  }

  try {
    if (action === 'activate') {
      await prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: { isActive: true }
      });
    } else if (action === 'deactivate') {
      await prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: { isActive: false }
      });
    } else if (action === 'delete') {
      await prisma.student.deleteMany({
        where: { id: { in: studentIds } }
      });
    } else if (action === 'toggle-eligibility') {
      await prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: { isEligible: !!value }
      });
    } else {
      return res.status(400).json({ error: 'Invalid bulk action' });
    }

    // Broadcast update for each student
    for (const id of studentIds) {
      try {
        await broadcastStudentUpdate(id);
      } catch (_) {}
    }

    return res.json({ message: `Bulk action ${action} completed successfully` });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    return res.status(500).json({ error: 'Failed to complete bulk action' });
  }
});

export default router;
