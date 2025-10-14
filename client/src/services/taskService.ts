import { db } from '@ume/shared';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';

const COUPLES_COLLECTION = 'couples';
const TASKS_SUBCOLLECTION = 'tasks';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'not-started' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  dueDate?: Date;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  monthsBeforeWedding?: number;
  estimatedHours?: number;
  notes?: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  monthsBeforeWedding: number;
  estimatedHours: number;
}

// Task CRUD Functions
export async function getTasks(coupleId: string): Promise<Task[]> {
  try {
    const tasksRef = collection(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION);
    const q = query(tasksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
      };
    }) as Task[];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function getTask(coupleId: string, taskId: string): Promise<Task | null> {
  try {
    const taskRef = doc(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION, taskId);
    const taskDoc = await getDoc(taskRef);
    
    if (taskDoc.exists()) {
      const data = taskDoc.data();
      return {
        id: taskDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
      } as Task;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching task:', error);
    return null;
  }
}

export async function saveTask(coupleId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const tasksRef = collection(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION);
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedTask = Object.fromEntries(
      Object.entries(task).filter(([_, v]) => v !== undefined)
    );
    
    const docRef = await addDoc(tasksRef, {
      ...cleanedTask,
      dueDate: task.dueDate ? Timestamp.fromDate(task.dueDate) : null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving task:', error);
    throw error;
  }
}

export async function updateTask(coupleId: string, taskId: string, updates: Partial<Task>): Promise<void> {
  try {
    const taskRef = doc(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION, taskId);
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    const updateData: any = {
      ...cleanedUpdates,
      updatedAt: Timestamp.fromDate(new Date())
    };
    
    if (updates.dueDate) {
      updateData.dueDate = Timestamp.fromDate(updates.dueDate);
    }
    
    await updateDoc(taskRef, updateData);
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

export async function deleteTask(coupleId: string, taskId: string): Promise<void> {
  try {
    const taskRef = doc(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION, taskId);
    await deleteDoc(taskRef);
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

// Utility functions
export async function getTasksByCategory(coupleId: string, category: string): Promise<Task[]> {
  try {
    const tasksRef = collection(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION);
    const q = query(
      tasksRef, 
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
      };
    }) as Task[];
  } catch (error) {
    console.error('Error fetching tasks by category:', error);
    return [];
  }
}

export async function getTasksByStatus(coupleId: string, status: Task['status']): Promise<Task[]> {
  try {
    const tasksRef = collection(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION);
    const q = query(
      tasksRef, 
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
      };
    }) as Task[];
  } catch (error) {
    console.error('Error fetching tasks by status:', error);
    return [];
  }
}

export async function getTaskStats(coupleId: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}> {
  try {
    const tasks = await getTasks(coupleId);
    const now = new Date();
    
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      notStarted: tasks.filter(t => t.status === 'not-started').length,
      overdue: tasks.filter(t => 
        t.dueDate && 
        t.dueDate < now && 
        t.status !== 'completed'
      ).length
    };
  } catch (error) {
    console.error('Error calculating task stats:', error);
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      overdue: 0
    };
  }
}

// Wedding date functions
export async function getWeddingDate(coupleId: string): Promise<Date | null> {
  try {
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    const coupleDoc = await getDoc(coupleRef);
    
    if (coupleDoc.exists()) {
      const data = coupleDoc.data();
      return data.weddingDate?.toDate() || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching wedding date:', error);
    return null;
  }
}

export async function saveWeddingDate(coupleId: string, weddingDate: Date): Promise<void> {
  try {
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    
    // Ensure the date is at 3:00 PM local time
    const adjustedDate = new Date(weddingDate);
    adjustedDate.setHours(15, 0, 0, 0); // Set to 3:00 PM
    
    await updateDoc(coupleRef, {
      weddingDate: Timestamp.fromDate(adjustedDate),
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error saving wedding date:', error);
    throw error;
  }
}

// Template task creation
export async function createTasksFromTemplates(
  coupleId: string, 
  templates: TaskTemplate[], 
  weddingDate: Date
): Promise<void> {
  try {
    const tasksToCreate = templates.map(template => {
      const dueDate = new Date(weddingDate);
      dueDate.setMonth(dueDate.getMonth() - template.monthsBeforeWedding);
      
      return {
        title: template.title,
        description: template.description,
        status: 'not-started' as const,
        priority: template.priority,
        category: template.category,
        dueDate,
        estimatedHours: template.estimatedHours,
        monthsBeforeWedding: template.monthsBeforeWedding
      };
    });
    
    const tasksRef = collection(db, COUPLES_COLLECTION, coupleId, TASKS_SUBCOLLECTION);
    
    // Create all tasks
    await Promise.all(
      tasksToCreate.map(task => 
        addDoc(tasksRef, {
          ...task,
          dueDate: Timestamp.fromDate(task.dueDate),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        })
      )
    );
  } catch (error) {
    console.error('Error creating tasks from templates:', error);
    throw error;
  }
}