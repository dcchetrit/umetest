'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { createBudgetTasksService } from '@/services/budgetTasksService';
import {
  getTasks,
  saveTask,
  updateTask,
  deleteTask,
  getWeddingDate,
  saveWeddingDate,
  createTasksFromTemplates,
  getTaskStats,
  Task as FirestoreTask,
  TaskTemplate
} from '@/services/taskService';

interface TasksClientProps {
  locale: string;
}

type Task = Omit<FirestoreTask, 'dueDate' | 'createdAt' | 'updatedAt'> & {
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};


function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      tasks: 'Wedding Tasks',
      welcome: 'Wedding Planning Tasks',
      overview: 'Keep track of your wedding planning progress with timeline and categories',
      add_task: 'Add New Task',
      add_template_tasks: 'Add Template Tasks',
      task_title: 'Task Title',
      description: 'Description',
      status: 'Status',
      priority: 'Priority',
      category: 'Category',
      due_date: 'Due Date',
      assigned_to: 'Assigned To',
      estimated_hours: 'Estimated Hours',
      months_before: 'Months Before Wedding',
      notes: 'Notes',
      back_home: '← Back to Home',
      'not-started': 'Not Started',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'low': 'Low',
      'medium': 'Medium', 
      'high': 'High',
      login_required: 'Please log in to view tasks',
      no_tasks: 'No tasks found',
      add_first_task: 'Add your first task to get started',
      mark_completed: 'Mark as Completed',
      mark_in_progress: 'Mark as In Progress',
      save: 'Save Task',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      start: 'Start',
      complete: 'Complete',
      all_categories: 'All Categories',
      all_statuses: 'All Statuses',
      venue: 'Venue',
      catering: 'Catering',
      photography: 'Photography',
      music: 'Music & Entertainment',
      flowers: 'Flowers & Decorations',
      attire: 'Attire & Beauty',
      invitations: 'Invitations & Stationery',
      transportation: 'Transportation',
      honeymoon: 'Honeymoon',
      legal: 'Legal & Documentation',
      other: 'Other',
      timeline: 'Timeline View',
      list: 'List View',
      filter_by_category: 'Filter by Category',
      filter_by_status: 'Filter by Status',
      sort_by: 'Sort by',
      sort_due_date: 'Due Date',
      sort_priority: 'Priority',
      sort_created: 'Created Date',
      sort_status: 'Status',
      progress_overview: 'Progress Overview',
      total_tasks: 'Total Tasks',
      completed_tasks: 'Completed',
      in_progress_tasks: 'In Progress',
      not_started_tasks: 'Not Started',
      overdue_tasks: 'Overdue',
      confirm_delete: 'Are you sure you want to delete this task?',
      task_added: 'Task added successfully',
      task_updated: 'Task updated successfully',
      task_deleted: 'Task deleted successfully',
      wedding_date: 'Wedding Date',
      set_wedding_date: 'Set Wedding Date'
    },
    fr: {
      tasks: 'Tâches de mariage',
      welcome: 'Tâches de planification de mariage',
      overview: 'Suivez l\'avancement de votre planification de mariage avec chronologie et catégories',
      add_task: 'Ajouter une nouvelle tâche',
      add_template_tasks: 'Ajouter des tâches modèles',
      task_title: 'Titre de la tâche',
      description: 'Description',
      status: 'Statut',
      priority: 'Priorité',
      category: 'Catégorie',
      due_date: 'Date d\'échéance',
      assigned_to: 'Assigné à',
      estimated_hours: 'Heures estimées',
      months_before: 'Mois avant le mariage',
      notes: 'Notes',
      back_home: '← Retour à l\'accueil',
      'not-started': 'Pas commencé',
      'in-progress': 'En cours',
      'completed': 'Terminé',
      'low': 'Faible',
      'medium': 'Moyenne',
      'high': 'Élevée',
      login_required: 'Veuillez vous connecter pour voir les tâches',
      no_tasks: 'Aucune tâche trouvée',
      add_first_task: 'Ajoutez votre première tâche pour commencer',
      mark_completed: 'Marquer comme terminé',
      mark_in_progress: 'Marquer comme en cours',
      save: 'Enregistrer',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      start: 'Commencer',
      complete: 'Terminer',
      all_categories: 'Toutes les catégories',
      all_statuses: 'Tous les statuts',
      venue: 'Lieu',
      catering: 'Traiteur',
      photography: 'Photographie',
      music: 'Musique et divertissement',
      flowers: 'Fleurs et décorations',
      attire: 'Tenue et beauté',
      invitations: 'Invitations et papeterie',
      transportation: 'Transport',
      honeymoon: 'Lune de miel',
      legal: 'Légal et documentation',
      other: 'Autre',
      timeline: 'Vue chronologique',
      list: 'Vue liste',
      filter_by_category: 'Filtrer par catégorie',
      filter_by_status: 'Filtrer par statut',
      sort_by: 'Trier par',
      sort_due_date: 'Date d\'échéance',
      sort_priority: 'Priorité',
      sort_created: 'Date de création',
      sort_status: 'Statut',
      progress_overview: 'Aperçu des progrès',
      total_tasks: 'Tâches totales',
      completed_tasks: 'Terminées',
      in_progress_tasks: 'En cours',
      not_started_tasks: 'Pas commencées',
      overdue_tasks: 'En retard',
      confirm_delete: 'Êtes-vous sûr de vouloir supprimer cette tâche?',
      task_added: 'Tâche ajoutée avec succès',
      task_updated: 'Tâche mise à jour avec succès',
      task_deleted: 'Tâche supprimée avec succès',
      wedding_date: 'Date du mariage',
      set_wedding_date: 'Définir la date du mariage'
    },
    es: {
      tasks: 'Tareas de boda',
      welcome: 'Tareas de planificación de boda',
      overview: 'Mantén un seguimiento del progreso de planificación de tu boda con cronología y categorías',
      add_task: 'Agregar nueva tarea',
      add_template_tasks: 'Agregar tareas plantilla',
      task_title: 'Título de la tarea',
      description: 'Descripción',
      status: 'Estado',
      priority: 'Prioridad',
      category: 'Categoría',
      due_date: 'Fecha de vencimiento',
      assigned_to: 'Asignado a',
      estimated_hours: 'Horas estimadas',
      months_before: 'Meses antes de la boda',
      notes: 'Notas',
      back_home: '← Volver al inicio',
      'not-started': 'No iniciado',
      'in-progress': 'En progreso',
      'completed': 'Completado',
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta',
      login_required: 'Por favor inicia sesión para ver las tareas',
      no_tasks: 'No se encontraron tareas',
      add_first_task: 'Agrega tu primera tarea para comenzar',
      mark_completed: 'Marcar como completado',
      mark_in_progress: 'Marcar como en progreso',
      save: 'Guardar',
      cancel: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      start: 'Iniciar',
      complete: 'Completar',
      all_categories: 'Todas las categorías',
      all_statuses: 'Todos los estados',
      venue: 'Lugar',
      catering: 'Catering',
      photography: 'Fotografía',
      music: 'Música y entretenimiento',
      flowers: 'Flores y decoraciones',
      attire: 'Vestimenta y belleza',
      invitations: 'Invitaciones y papelería',
      transportation: 'Transporte',
      honeymoon: 'Luna de miel',
      legal: 'Legal y documentación',
      other: 'Otro',
      timeline: 'Vista de cronología',
      list: 'Vista de lista',
      filter_by_category: 'Filtrar por categoría',
      filter_by_status: 'Filtrar por estado',
      sort_by: 'Ordenar por',
      sort_due_date: 'Fecha de vencimiento',
      sort_priority: 'Prioridad',
      sort_created: 'Fecha de creación',
      sort_status: 'Estado',
      progress_overview: 'Resumen de progreso',
      total_tasks: 'Tareas totales',
      completed_tasks: 'Completadas',
      in_progress_tasks: 'En progreso',
      not_started_tasks: 'No iniciadas',
      overdue_tasks: 'Vencidas',
      confirm_delete: '¿Estás seguro de que quieres eliminar esta tarea?',
      task_added: 'Tarea agregada exitosamente',
      task_updated: 'Tarea actualizada exitosamente',
      task_deleted: 'Tarea eliminada exitosamente',
      wedding_date: 'Fecha de la boda',
      set_wedding_date: 'Establecer fecha de la boda'
    },
    fr: {
      tasks: 'Tâches de mariage',
      welcome: 'Tâches de planification de mariage',
      overview: 'Suivez l\'avancement de la planification de votre mariage',
      add_task: 'Ajouter une nouvelle tâche',
      task_title: 'Tâche',
      status: 'Statut',
      priority: 'Priorité',
      due_date: 'Date d\'échéance',
      back_home: '← Retour à l\'accueil',
      'not-started': 'Pas commencé',
      'in-progress': 'En cours',
      'completed': 'Terminé',
      'low': 'Faible',
      'medium': 'Moyenne',
      'high': 'Élevée',
      loading: 'Chargement des tâches...',
      error: 'Erreur lors du chargement des tâches',
      login_required: 'Veuillez vous connecter pour voir les tâches',
      no_tasks: 'Aucune tâche trouvée',
      mark_completed: 'Marquer comme terminé',
      mark_in_progress: 'Marquer comme en cours',
      description: 'Description'
    },
    es: {
      tasks: 'Tareas de boda',
      welcome: 'Tareas de planificación de boda',
      overview: 'Mantén un seguimiento del progreso de planificación de tu boda',
      add_task: 'Agregar nueva tarea',
      task_title: 'Tarea',
      status: 'Estado',
      priority: 'Prioridad',
      due_date: 'Fecha de vencimiento',
      back_home: '← Volver al inicio',
      'not-started': 'No iniciado',
      'in-progress': 'En progreso',
      'completed': 'Completado',
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta',
      loading: 'Cargando tareas...',
      error: 'Error al cargar tareas',
      login_required: 'Por favor inicia sesión para ver las tareas',
      no_tasks: 'No se encontraron tareas',
      mark_completed: 'Marcar como completado',
      mark_in_progress: 'Marcar como en progreso',
      description: 'Descripción'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

const CATEGORIES = [
  'venue',
  'catering',
  'photography',
  'music',
  'flowers',
  'attire',
  'invitations',
  'transportation',
  'honeymoon',
  'legal',
  'other'
];

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'venue-1',
    title: 'Research and visit potential venues',
    description: 'Visit at least 3-5 venues and compare pricing, capacity, and amenities',
    category: 'venue',
    priority: 'high',
    monthsBeforeWedding: 12,
    estimatedHours: 20
  },
  {
    id: 'venue-2',
    title: 'Book wedding venue',
    description: 'Finalize venue contract and make deposit',
    category: 'venue',
    priority: 'high',
    monthsBeforeWedding: 11,
    estimatedHours: 3
  },
  {
    id: 'catering-1',
    title: 'Research catering options',
    description: 'Get quotes from multiple caterers and schedule tastings',
    category: 'catering',
    priority: 'high',
    monthsBeforeWedding: 10,
    estimatedHours: 15
  },
  {
    id: 'catering-2',
    title: 'Book wedding caterer',
    description: 'Choose caterer and finalize menu selection',
    category: 'catering',
    priority: 'high',
    monthsBeforeWedding: 8,
    estimatedHours: 2
  },
  {
    id: 'photography-1',
    title: 'Research wedding photographers',
    description: 'Review portfolios and meet with potential photographers',
    category: 'photography',
    priority: 'high',
    monthsBeforeWedding: 9,
    estimatedHours: 12
  },
  {
    id: 'photography-2',
    title: 'Book wedding photographer',
    description: 'Sign contract with chosen photographer',
    category: 'photography',
    priority: 'high',
    monthsBeforeWedding: 8,
    estimatedHours: 1
  },
  {
    id: 'music-1',
    title: 'Book wedding music/DJ',
    description: 'Research and book DJ or live band for ceremony and reception',
    category: 'music',
    priority: 'medium',
    monthsBeforeWedding: 6,
    estimatedHours: 8
  },
  {
    id: 'flowers-1',
    title: 'Choose wedding florist',
    description: 'Meet with florists and design floral arrangements',
    category: 'flowers',
    priority: 'medium',
    monthsBeforeWedding: 4,
    estimatedHours: 6
  },
  {
    id: 'attire-1',
    title: 'Shop for wedding dress',
    description: 'Try on dresses and order wedding dress',
    category: 'attire',
    priority: 'high',
    monthsBeforeWedding: 8,
    estimatedHours: 20
  },
  {
    id: 'attire-2',
    title: 'Shop for groom attire',
    description: 'Choose and order suit or tuxedo',
    category: 'attire',
    priority: 'medium',
    monthsBeforeWedding: 6,
    estimatedHours: 8
  },
  {
    id: 'invitations-1',
    title: 'Design and order invitations',
    description: 'Create guest list and order wedding invitations',
    category: 'invitations',
    priority: 'medium',
    monthsBeforeWedding: 4,
    estimatedHours: 10
  },
  {
    id: 'invitations-2',
    title: 'Send wedding invitations',
    description: 'Mail invitations to all guests',
    category: 'invitations',
    priority: 'high',
    monthsBeforeWedding: 2,
    estimatedHours: 3
  },
  {
    id: 'legal-1',
    title: 'Obtain marriage license',
    description: 'Apply for and receive marriage license',
    category: 'legal',
    priority: 'high',
    monthsBeforeWedding: 1,
    estimatedHours: 2
  },
  {
    id: 'honeymoon-1',
    title: 'Plan honeymoon',
    description: 'Research destinations and book honeymoon trip',
    category: 'honeymoon',
    priority: 'low',
    monthsBeforeWedding: 3,
    estimatedHours: 12
  }
];


function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in-progress':
      return 'bg-blue-100 text-blue-800';
    case 'not-started':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
    default:
      return 'bg-green-100 text-green-800';
  }
}

function getCategoryColor(category: string) {
  const colors = {
    venue: 'bg-purple-100 text-purple-800',
    catering: 'bg-orange-100 text-orange-800',
    photography: 'bg-pink-100 text-pink-800',
    music: 'bg-indigo-100 text-indigo-800',
    flowers: 'bg-green-100 text-green-800',
    attire: 'bg-blue-100 text-blue-800',
    invitations: 'bg-yellow-100 text-yellow-800',
    transportation: 'bg-gray-100 text-gray-800',
    honeymoon: 'bg-red-100 text-red-800',
    legal: 'bg-teal-100 text-teal-800',
    other: 'bg-slate-100 text-slate-800'
  };
  return colors[category as keyof typeof colors] || colors.other;
}

function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < new Date();
}

function calculateDueDate(monthsBeforeWedding: number, weddingDate?: string): string {
  if (!weddingDate) return '';
  const wedding = new Date(weddingDate);
  wedding.setMonth(wedding.getMonth() - monthsBeforeWedding);
  return wedding.toISOString().split('T')[0];
}

export default function TasksClient({ locale }: TasksClientProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weddingDate, setWeddingDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({});
  const [showWeddingDateModal, setShowWeddingDateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0
  });
  
  // Early return if no authenticated user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view your tasks</p>
        </div>
      </div>
    );
  }

  // Use authenticated user's ID as couple ID
  const coupleId = user.uid;
  
  // Initialize Budget-Tasks service only if we have a couple ID
  const budgetTasksService = coupleId ? createBudgetTasksService(coupleId) : null;

  // Load tasks and wedding date from Firestore
  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasksData, weddingDateData, statsData] = await Promise.all([
          getTasks(coupleId),
          getWeddingDate(coupleId),
          getTaskStats(coupleId)
        ]);
        
        // Convert Firestore tasks to display format
        const displayTasks: Task[] = tasksData.map(task => ({
          ...task,
          dueDate: task.dueDate?.toISOString().split('T')[0],
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        }));
        
        setTasks(displayTasks);
        setWeddingDate(weddingDateData?.toISOString().split('T')[0] || '');
        setTaskStats(statsData);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredAndSortedTasks = tasks
    .filter(task => {
      if (filterCategory !== 'all' && task.category !== filterCategory) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'created':
        default:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.category) return;
    
    try {
      const taskData = {
        title: newTask.title,
        description: newTask.description || '',
        status: 'not-started' as const,
        priority: newTask.priority || 'medium' as const,
        category: newTask.category,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
        assignedTo: newTask.assignedTo || undefined,
        estimatedHours: newTask.estimatedHours || undefined,
        monthsBeforeWedding: newTask.monthsBeforeWedding || undefined,
        notes: newTask.notes || undefined
      };
      
      const taskId = await saveTask(coupleId, taskData);
      
      // Add to local state
      const displayTask: Task = {
        id: taskId,
        ...taskData,
        dueDate: taskData.dueDate?.toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setTasks(prev => [...prev, displayTask]);
      
      // Update stats
      const newStats = await getTaskStats(coupleId);
      setTaskStats(newStats);
      
      setNewTask({});
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask(task);
    setShowAddModal(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !newTask.title || !newTask.category) return;
    
    try {
      const updates = {
        title: newTask.title,
        description: newTask.description || undefined,
        priority: newTask.priority,
        category: newTask.category,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
        assignedTo: newTask.assignedTo || undefined,
        estimatedHours: newTask.estimatedHours || undefined,
        monthsBeforeWedding: newTask.monthsBeforeWedding || undefined,
        notes: newTask.notes || undefined
      };
      
      await updateTask(coupleId, editingTask.id, updates);
      
      // Update local state
      const updatedDisplayTask = {
        ...editingTask,
        ...updates,
        dueDate: updates.dueDate?.toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };
      
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedDisplayTask : t));
      
      // Update stats
      const newStats = await getTaskStats(coupleId);
      setTaskStats(newStats);
      
      setNewTask({});
      setEditingTask(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm(getLocalizedText(locale, 'confirm_delete'))) return;
    
    try {
      await deleteTask(coupleId, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Update stats
      const newStats = await getTaskStats(coupleId);
      setTaskStats(newStats);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    
    try {
      await updateTask(coupleId, taskId, { status: newStatus });
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus, updatedAt: new Date().toISOString() } 
          : task
      ));
      
      // Update stats
      const newStats = await getTaskStats(coupleId);
      setTaskStats(newStats);
      
      // If marking a payment reminder task as completed, sync with budget
      if (newStatus === 'completed' && budgetTasksService) {
        try {
          await budgetTasksService.handleTaskCompletion(taskId);
        } catch (error) {
          console.error('Error syncing task completion with budget:', error);
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  const handleAddTemplateTasks = async () => {
    if (!weddingDate) return;
    
    try {
      const weddingDateObj = new Date(weddingDate);
      await createTasksFromTemplates(coupleId, TASK_TEMPLATES, weddingDateObj);
      
      // Reload tasks from Firestore
      const tasksData = await getTasks(coupleId);
      const displayTasks: Task[] = tasksData.map(task => ({
        ...task,
        dueDate: task.dueDate?.toISOString().split('T')[0],
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      }));
      
      setTasks(displayTasks);
      
      // Update stats
      const newStats = await getTaskStats(coupleId);
      setTaskStats(newStats);
    } catch (error) {
      console.error('Error adding template tasks:', error);
      alert('Failed to add template tasks. Please try again.');
    }
  };

  // Handle wedding date updates
  const handleSaveWeddingDate = async (newWeddingDate: string) => {
    
    try {
      await saveWeddingDate(coupleId, new Date(newWeddingDate));
      setWeddingDate(newWeddingDate);
      setShowWeddingDateModal(false);
    } catch (error) {
      console.error('Error saving wedding date:', error);
      alert('Failed to save wedding date. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{getLocalizedText(locale, 'login_required')}</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{getLocalizedText(locale, 'loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getLocalizedText(locale, 'welcome')}
            </h1>
            <p className="text-gray-600">{getLocalizedText(locale, 'overview')}</p>
          </div>
          <div className="flex gap-3">
            {!weddingDate && (
              <button 
                onClick={() => setShowWeddingDateModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                {getLocalizedText(locale, 'set_wedding_date')}
              </button>
            )}
            {weddingDate && tasks.length === 0 && (
              <button 
                onClick={handleAddTemplateTasks}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                {getLocalizedText(locale, 'add_template_tasks')}
              </button>
            )}
            <button 
              onClick={() => {
                setEditingTask(null);
                setNewTask({});
                setShowAddModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'add_task')}
            </button>
          </div>
        </div>

        {/* Wedding Date Display */}
        {weddingDate && (
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-pink-800">
                  {getLocalizedText(locale, 'wedding_date')}: {new Date(weddingDate).toLocaleDateString()}
                </h3>
                <p className="text-pink-600">
                  {Math.ceil((new Date(weddingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days to go! 💕
                </p>
              </div>
              <button
                onClick={() => setShowWeddingDateModal(true)}
                className="text-pink-600 hover:text-pink-800 text-sm"
              >
                {getLocalizedText(locale, 'edit')}
              </button>
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{taskStats.total}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'total_tasks')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'completed_tasks')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'in_progress_tasks')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{taskStats.notStarted}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'not_started_tasks')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{taskStats.overdue}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'overdue_tasks')}</div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'filter_by_category')}
                </label>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">{getLocalizedText(locale, 'all_categories')}</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{getLocalizedText(locale, cat)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'filter_by_status')}
                </label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">{getLocalizedText(locale, 'all_statuses')}</option>
                  <option value="not-started">{getLocalizedText(locale, 'not-started')}</option>
                  <option value="in-progress">{getLocalizedText(locale, 'in-progress')}</option>
                  <option value="completed">{getLocalizedText(locale, 'completed')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'sort_by')}
                </label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="due_date">{getLocalizedText(locale, 'sort_due_date')}</option>
                  <option value="priority">{getLocalizedText(locale, 'sort_priority')}</option>
                  <option value="status">{getLocalizedText(locale, 'sort_status')}</option>
                  <option value="created">{getLocalizedText(locale, 'sort_created')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded text-sm ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getLocalizedText(locale, 'list')}
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-2 rounded text-sm ${
                  viewMode === 'timeline' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getLocalizedText(locale, 'timeline')}
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredAndSortedTasks.length === 0 && tasks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{getLocalizedText(locale, 'no_tasks')}</h3>
            <p className="text-gray-500 mb-6">{getLocalizedText(locale, 'add_first_task')}</p>
            <div className="flex gap-3 justify-center">
              {weddingDate && (
                <button 
                  onClick={handleAddTemplateTasks}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                >
                  {getLocalizedText(locale, 'add_template_tasks')}
                </button>
              )}
              <button 
                onClick={() => {
                  setEditingTask(null);
                  setNewTask({});
                  setShowAddModal(true);
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                {getLocalizedText(locale, 'add_task')}
              </button>
            </div>
          </div>
        )}

        {/* Task List/Timeline */}
        {filteredAndSortedTasks.length > 0 && (
          <div className="space-y-4">
            {viewMode === 'list' ? (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {getLocalizedText(locale, 'tasks')} ({filteredAndSortedTasks.length})
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {filteredAndSortedTasks.map((task) => (
                    <div key={task.id} className={`p-6 ${isTaskOverdue(task) && task.status !== 'completed' ? 'bg-red-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{task.title}</h4>
                            {isTaskOverdue(task) && task.status !== 'completed' && (
                              <span className="text-red-600 text-xs font-semibold">OVERDUE</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                              {getLocalizedText(locale, task.status)}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                              {getLocalizedText(locale, task.priority)}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(task.category)}`}>
                              {getLocalizedText(locale, task.category)}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.estimatedHours && (
                              <span className="text-xs text-gray-500">
                                ~{task.estimatedHours}h
                              </span>
                            )}
                          </div>
                          {task.assignedTo && (
                            <p className="text-sm text-gray-600">Assigned to: {task.assignedTo}</p>
                          )}
                          {task.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                              <strong>Notes:</strong> {task.notes}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                          >
                            {getLocalizedText(locale, 'edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                          >
                            {getLocalizedText(locale, 'delete')}
                          </button>
                          {task.status !== 'completed' && (
                            <>
                              {task.status === 'not-started' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}
                                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                >
                                  {getLocalizedText(locale, 'start')}
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                              >
                                {getLocalizedText(locale, 'complete')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Timeline View
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">{getLocalizedText(locale, 'timeline')}</h3>
                <div className="space-y-6">
                  {CATEGORIES.map(category => {
                    const categoryTasks = filteredAndSortedTasks.filter(t => t.category === category);
                    if (categoryTasks.length === 0) return null;
                    
                    return (
                      <div key={category} className="border-l-4 border-blue-200 pl-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-3">
                          {getLocalizedText(locale, category)} ({categoryTasks.length})
                        </h4>
                        <div className="space-y-3">
                          {categoryTasks.map(task => (
                            <div key={task.id} className={`p-4 border rounded-lg ${isTaskOverdue(task) && task.status !== 'completed' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">{task.title}</h5>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(task.status)}`}>
                                      {getLocalizedText(locale, task.status)}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
                                      {getLocalizedText(locale, task.priority)}
                                    </span>
                                    {task.dueDate && (
                                      <span className="text-xs text-gray-500">
                                        {new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditTask(task)}
                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                                  >
                                    {getLocalizedText(locale, 'edit')}
                                  </button>
                                  {task.status !== 'completed' && (
                                    <button
                                      onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                                    >
                                      ✓
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            📋 Task management system - Create custom tasks or use templates to organize your wedding planning journey!
          </p>
        </div>
      </div>
    </div>

    {/* Add/Edit Task Modal */}
    {showAddModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {editingTask ? 'Edit Task' : getLocalizedText(locale, 'add_task')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'task_title')} *
              </label>
              <input
                type="text"
                value={newTask.title || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'category')} *
              </label>
              <select
                value={newTask.category || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{getLocalizedText(locale, 'category')}</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{getLocalizedText(locale, cat)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'priority')}
              </label>
              <select
                value={newTask.priority || 'medium'}
                onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="low">{getLocalizedText(locale, 'low')}</option>
                <option value="medium">{getLocalizedText(locale, 'medium')}</option>
                <option value="high">{getLocalizedText(locale, 'high')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'due_date')}
              </label>
              <input
                type="date"
                value={newTask.dueDate || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'assigned_to')}
              </label>
              <input
                type="text"
                value={newTask.assignedTo || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Bride, Groom, Maid of Honor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'estimated_hours')}
              </label>
              <input
                type="number"
                value={newTask.estimatedHours || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, estimatedHours: Number(e.target.value) || undefined }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'months_before')}
              </label>
              <input
                type="number"
                value={newTask.monthsBeforeWedding || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, monthsBeforeWedding: Number(e.target.value) || undefined }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
                placeholder="e.g., 6"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'description')}
              </label>
              <textarea
                value={newTask.description || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'notes')}
              </label>
              <textarea
                value={newTask.notes || ''}
                onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={2}
                placeholder="Additional notes, reminders, or links"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingTask(null);
                setNewTask({});
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              {getLocalizedText(locale, 'cancel')}
            </button>
            <button
              onClick={editingTask ? handleUpdateTask : handleAddTask}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'save')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Wedding Date Modal */}
    {showWeddingDateModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">{getLocalizedText(locale, 'set_wedding_date')}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'wedding_date')}
            </label>
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowWeddingDateModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              {getLocalizedText(locale, 'cancel')}
            </button>
            <button
              onClick={() => setShowWeddingDateModal(false)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'save')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}