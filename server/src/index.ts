import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import adminRoutes from './routes/admin';
import studentRoutes from './routes/student';
import settingsRoutes from './routes/settings';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { initSocket } from './utils/socket';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // For local dev, allow any origin. In production this should be configured.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/student', studentRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Question Portal API is active' });
});

// Automatic seeding of admin & sample questions if database is empty
async function runAutoSeed() {
  try {
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      await prisma.adminUser.create({
        data: {
          username: 'admin',
          passwordHash: 'adminpassword'
        }
      });
      console.log('✅ Auto-seeded admin user. Username: "admin", Password: "adminpassword" (Plaintext)');
    } else {
      // Force update existing default admin to plain text to prevent lockouts
      await prisma.adminUser.updateMany({
        where: { username: 'admin' },
        data: { passwordHash: 'adminpassword' }
      });
      console.log('✅ Updated existing admin password to plain-text.');
    }

    const questionCount = await prisma.question.count();
    if (questionCount === 0) {
      const sampleQuestions = [
        {
          title: 'Reverse a String',
          problemStatement: 'Write a program that takes a string S as input and returns the string reversed. For example, if the input is "hello", the output should be "olleh".',
          inputFormat: 'A single line containing the input string S.',
          outputFormat: 'A single line containing the reversed string.',
          sampleInput: 'hello',
          sampleOutput: 'olleh'
        },
        {
          title: 'FizzBuzz Challenge',
          problemStatement: 'Write a program that prints the numbers from 1 to N. But for multiples of three print "Fizz" instead of the number and for the multiples of five print "Buzz". For numbers which are multiples of both three and five print "FizzBuzz".',
          inputFormat: 'A single integer N.',
          outputFormat: 'Print numbers or Fizz/Buzz/FizzBuzz on separate lines from 1 to N.',
          sampleInput: '5',
          sampleOutput: '1\n2\nFizz\n4\nBuzz'
        },
        {
          title: 'Check Palindrome',
          problemStatement: 'Write a program to check if a given word S is a palindrome. A palindrome is a word that reads the same backward as forward (case-sensitive).',
          inputFormat: 'A single string S.',
          outputFormat: 'Print "true" if S is a palindrome, otherwise print "false".',
          sampleInput: 'radar',
          sampleOutput: 'true'
        },
        {
          title: 'Fibonacci Series',
          problemStatement: 'Write a program to generate the first N terms of the Fibonacci series. The sequence starts with 0 and 1, and each subsequent number is the sum of the two preceding ones.',
          inputFormat: 'A single integer N representing the number of terms.',
          outputFormat: 'Space-separated integers representing the first N terms of the series.',
          sampleInput: '6',
          sampleOutput: '0 1 1 2 3 5'
        },
        {
          title: 'Sum of Prime Numbers',
          problemStatement: 'Write a program to calculate the sum of all prime numbers between 1 and a given number N (inclusive). A prime number is a number greater than 1 that has no positive divisors other than 1 and itself.',
          inputFormat: 'A single integer N.',
          outputFormat: 'A single integer representing the sum of all prime numbers <= N.',
          sampleInput: '10',
          sampleOutput: '17'
        }
      ];

      await prisma.question.createMany({
        data: sampleQuestions
      });
      console.log('✅ Auto-seeded 5 sample programming questions.');
    }

    const eligibleCount = await prisma.eligibleStudent.count();
    if (eligibleCount === 0) {
      const sampleEligible = [
        { rollNumber: 'CSE123', name: 'Student One', branch: 'CSE (AI & ML)', year: 'III Year', semester: 'I Semester', email: 'karrerathi8@gmail.com' },
        { rollNumber: 'CSE202412', name: 'Student Two', branch: 'CSE', year: 'IV Year', semester: 'I Semester', email: 'student2@example.com' },
        { rollNumber: 'CSE202411', name: 'Student Three', branch: 'CSE', year: 'III Year', semester: 'II Semester', email: 'student3@example.com' }
      ];

      await prisma.eligibleStudent.createMany({
        data: sampleEligible
      });
      console.log('✅ Auto-seeded 3 sample eligible students.');
    }
  } catch (error) {
    console.error('⚠️ Auto-seeding check encountered an error:', error);
  }
}

// Migration script for legacy eligible students to the single Student table
async function migrateEligibleStudents() {
  try {
    const eligibleCount = await prisma.eligibleStudent.count();
    if (eligibleCount > 0) {
      console.log(`[Migration] Found ${eligibleCount} EligibleStudent records. Merging to Student collection...`);
      const list = await prisma.eligibleStudent.findMany();
      for (const item of list) {
        await prisma.student.upsert({
          where: { rollNumber: item.rollNumber },
          update: {
            isEligible: true,
            name: item.name,
            branch: item.branch,
            year: item.year,
            semester: item.semester,
            email: item.email
          },
          create: {
            rollNumber: item.rollNumber,
            name: item.name,
            branch: item.branch,
            year: item.year,
            semester: item.semester,
            email: item.email,
            isEligible: true,
            isActive: true,
            status: "Eligible"
          }
        });
      }
      await prisma.eligibleStudent.deleteMany();
      console.log('[Migration] Successfully merged and cleaned up eligible student roster.');
    }
  } catch (err) {
    console.error('[Migration Error] Failed to migrate eligible students:', err);
  }
}

// Start Server
initSocket(server);

server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Attempt to test database connection and run auto-seeding
  try {
    await prisma.$connect();
    console.log('🔌 Connected to SQLite/PostgreSQL successfully.');
    await runAutoSeed();
    await migrateEligibleStudents();
  } catch (dbError) {
    console.warn('⚠️ Could not connect to database. Please verify configurations.');
    console.error(dbError);
  }
});
