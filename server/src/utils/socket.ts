import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { prisma } from '../prisma';

let io: SocketServer | null = null;

// Active student session socket registries
const activeStudentSockets = new Map<string, string>();
const socketToStudent = new Map<string, string>();

/**
 * Initializes the Socket.io server.
 */
export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to WebSocket: ${socket.id}`);
    
    socket.on('register_student', async ({ studentId }) => {
      if (!studentId) return;

      const existingSocketId = activeStudentSockets.get(studentId);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io?.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          console.log(`⚠️ Duplicate session attempt detected for student ${studentId}.`);
          try {
            const student = await prisma.student.findUnique({ where: { id: studentId } });
            if (student) {
              const newWarningCount = student.warningCount + 1;
              let newStatus = student.status;
              let newReason = student.terminationReason;

              if (newWarningCount >= 3) {
                newStatus = 'Disqualified';
                newReason = 'MULTIPLE_WINDOWS_OPEN';
              }

              const updated = await prisma.student.update({
                where: { id: studentId },
                data: {
                  warningCount: newWarningCount,
                  status: newStatus,
                  terminationReason: newReason
                }
              });

              // Broadcast update to admin dashboard
              await broadcastStudentUpdate(studentId);

              // Reject/close the duplicate new connection
              socket.emit('close_duplicate', { message: 'Only one active examination window is allowed.' });
              
              if (newWarningCount >= 3) {
                existingSocket.emit('student_update', updated);
                existingSocket.emit('disqualified', { reason: 'MULTIPLE_WINDOWS_OPEN' });
              } else {
                existingSocket.emit('student_update', updated);
                existingSocket.emit('duplicate_window_warning', { warningCount: newWarningCount });
              }
            }
          } catch (err) {
            console.error('Error handling duplicate tab socket register:', err);
          }
          return;
        }
      }

      // Safe to register socket
      activeStudentSockets.set(studentId, socket.id);
      socketToStudent.set(socket.id, studentId);
      console.log(`✅ Registered student session: ${studentId} on socket ${socket.id}`);
    });
    
    socket.on('disconnect', () => {
      const studentId = socketToStudent.get(socket.id);
      if (studentId) {
        if (activeStudentSockets.get(studentId) === socket.id) {
          activeStudentSockets.delete(studentId);
        }
        socketToStudent.delete(socket.id);
      }
      console.log(`🔌 Client disconnected from WebSocket: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Returns the active Socket.io server instance.
 */
export function getSocketIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return io;
}

/**
 * Fetches the student details with assignments and broadcasts the update to all clients.
 */
export async function broadcastStudentUpdate(studentId: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        assignments: {
          include: {
            question: true
          }
        }
      }
    });

    if (student) {
      const formatted = {
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
        questions: student.assignments.map(a => a.question.title)
      };

      if (io) {
        io.emit('student_update', formatted);
        console.log(`📡 Broadcasted student update for: ${student.rollNumber} (status: ${student.status})`);
      }
    }
  } catch (err) {
    console.error('Error broadcasting student update:', err);
  }
}
