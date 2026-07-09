import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Starting database seeding...');

  // 1. Seed Admin
  const adminUsername = 'admin';
  const adminPassword = 'adminpassword';
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: adminUsername }
  });

  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        username: adminUsername,
        passwordHash: adminPassword
      }
    });
    console.log(`✅ Default admin created: Username: "${adminUsername}", Password: "${adminPassword}"`);
  } else {
    await prisma.adminUser.update({
      where: { username: adminUsername },
      data: { passwordHash: adminPassword }
    });
    console.log('ℹ️ Admin user updated to plain-text password.');
  }

  // 2. Seed Sample Programming Questions
  const sampleQuestions = [
    {
      title: 'Reverse a String',
      problemStatement: 'Write a program that takes a string as input and returns the string reversed. For example, if the input is "hello", the output should be "olleh".',
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
      problemStatement: 'Write a program to check if a given positive integer or word is a palindrome. A palindrome is a word, number, phrase, or other sequence of characters that reads the same backward as forward.',
      inputFormat: 'A single string or number S.',
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

  let addedCount = 0;
  for (const q of sampleQuestions) {
    const existing = await prisma.question.findFirst({
      where: { title: q.title }
    });

    if (!existing) {
      await prisma.question.create({
        data: q
      });
      addedCount++;
    }
  }

  console.log(`✅ Seeded ${addedCount} sample programming questions.`);

  // 3. Seed Sample Eligible Students
  const sampleEligible = [
    { rollNumber: 'CSE123', name: 'Student One', branch: 'CSE (AI & ML)', year: 'III Year', semester: 'I Semester', email: 'karrerathi8@gmail.com' },
    { rollNumber: 'CSE202412', name: 'Student Two', branch: 'CSE', year: 'IV Year', semester: 'I Semester', email: 'student2@example.com' },
    { rollNumber: 'CSE202411', name: 'Student Three', branch: 'CSE', year: 'III Year', semester: 'II Semester', email: 'student3@example.com' }
  ];

  let eligibleAdded = 0;
  for (const es of sampleEligible) {
    const existing = await prisma.eligibleStudent.findUnique({
      where: { rollNumber: es.rollNumber }
    });
    if (!existing) {
      await prisma.eligibleStudent.create({
        data: es
      });
      eligibleAdded++;
    }
  }
  console.log(`✅ Seeded ${eligibleAdded} eligible students.`);
  console.log('Database seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
export { seed };
